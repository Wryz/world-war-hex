import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Hex, HexCoordinates, PlayerType, Unit, UnitType } from '@/types/game';
import { DEFAULT_SETTINGS, isImpassable } from '@/lib/game/gameState';
import { cardStats } from '@/lib/game/troops';
import { createHexagonalGrid, REGION_THEMES as MAP_THEMES } from '@/lib/game/mapGenerator';
import { HexTile } from '../HexTile';
import { BoardDecorations } from '../BoardDecorations';
import { Castle } from '../Castle';
import { getCastleStyle } from '@/lib/meta/cosmetics';
import { useProfile } from '@/lib/meta/profile';
import { Camp } from '../Camp';
import { UnitMesh } from '../UnitMesh';
import { axialToWorld, getHexSurfaceHeight } from '../utils/boardGeometry';
import { PropPack, usePropLibrary } from '../utils/kaykitProps';

// A small, slowly turning island made of the game's own pieces: themed terrain, both castles,
// the two camps and a few troops squaring up. It reshapes into a new map theme every few seconds.
// The landing page shows a picture of the first island's terrain (public/hero-island.webp, made
// with scripts/render-hero-poster.mjs) until the live island's terrain and scenery are ready; only
// then does it start turning and the troops' models load in.

const ISLAND_RADIUS = 3;
const THEME_DURATION = 7000;
const SPIN_SPEED = 0.12;
const CAMERA_FOV = 36;

const CASTLES: [HexCoordinates, PlayerType][] = [[{ q: 0, r: 3 }, 'player'], [{ q: 0, r: -3 }, 'ai']];
const CAMPS: [HexCoordinates, PlayerType | null][] = [[{ q: -2, r: 1 }, 'player'], [{ q: 2, r: -1 }, null]];
// Your Kingdom's cards face a few of the campaign's monsters
const TROOPS: [UnitType, PlayerType, HexCoordinates][] = [
  ['infantry', 'player', { q: 0, r: 1 }],
  ['artillery', 'player', { q: 1, r: 1 }],
  ['pegasus', 'player', { q: -2, r: 1 }],
  ['medic', 'player', { q: -1, r: 2 }],
  ['orc_grunt', 'ai', { q: 0, r: 0 }],
  ['grey_wolf', 'ai', { q: 1, r: 0 }],
  ['skeleton_archer', 'ai', { q: -1, r: -1 }],
  ['wyvern', 'ai', { q: 2, r: -2 }]
];
// Skirmishes that play on a loop: [attacker index, target index] into TROOPS
const SKIRMISHES: [number, number][] = [[0, 4], [4, 0], [1, 4], [5, 1], [3, 0]];
// Hexes that must be open ground so the pieces above have somewhere to stand
const OPEN_HEXES = [...CASTLES.map(([c]) => c), ...CAMPS.map(([c]) => c), ...TROOPS.map(([, , c]) => c)];

const key = (c: HexCoordinates) => `${c.q},${c.r}`;
const noop = () => {};

// A small map in the given theme, with the castle, camp and troop hexes cleared
const buildIsland = (themeIndex: number): Hex[] => {
  const settings = { ...DEFAULT_SETTINGS, gridSize: ISLAND_RADIUS, resourceHexCount: 1 };
  const { hexGrid } = createHexagonalGrid(settings, themeIndex * 1000 + 1, MAP_THEMES[themeIndex].name);

  const open = new Set(OPEN_HEXES.map(key));
  return hexGrid.map(hex => {
    const coordinates = key(hex.coordinates);
    const castle = CASTLES.find(([c]) => key(c) === coordinates);
    const camp = CAMPS.find(([c]) => key(c) === coordinates);
    if (castle) return { ...hex, terrain: 'plain', isResourceHex: false, isBase: true, owner: castle[1] };
    if (camp) return { ...hex, terrain: 'plain', isResourceHex: false, isCamp: true, owner: camp[1] ?? undefined };
    if (open.has(coordinates) && (isImpassable(hex) || hex.isResourceHex)) {
      return { ...hex, terrain: 'plain', isResourceHex: false };
    }
    return hex;
  });
};

const surface = (hexGrid: Hex[], c: HexCoordinates): [number, number, number] => {
  const hex = hexGrid.find(h => key(h.coordinates) === key(c));
  const [x, , z] = axialToWorld(c);
  return [x, hex ? getHexSurfaceHeight(hex) : 1, z];
};

// Frames drawn with the scenery in place before the island counts as ready
const SETTLE_FRAMES = 3;

const Island: React.FC<{ themeIndex: number; live: boolean; onReady: () => void }> = ({ themeIndex, live, onReady }) => {
  const playerCastleStyle = getCastleStyle(useProfile().cosmetics.castleStyle);
  const spinRef = useRef<THREE.Group>(null);
  const hexGrid = useMemo(() => buildIsland(themeIndex), [themeIndex]);
  // The scenery packs this island needs (as the board's decorations pick them)
  const packs = useMemo((): PropPack[] => hexGrid.some(hex => hex.terrain === 'cursed') ? ['medieval', 'halloween'] : ['medieval'], [hexGrid]);
  const scenery = usePropLibrary(packs);
  const settledRef = useRef(0);

  // Troops never change, so their unit objects (and models) are created once
  const troops = useMemo(() => TROOPS.map(([type, owner, position], index): Unit => ({
    ...cardStats(type, 1),
    type,
    lifespan: cardStats(type, 1).maxLifespan,
    id: `intro-${index}`,
    owner,
    position,
    hasMoved: false,
    isEngagedInCombat: false
  })), []);

  // Battle targets for the skirmishes, on the current terrain's surface
  const battles = useMemo(
    () => troops.map(unit => ({ key: 'intro', target: surface(hexGrid, unit.position) })),
    [troops, hexGrid]
  );

  useFrame((_, delta) => {
    if (scenery && settledRef.current <= SETTLE_FRAMES && ++settledRef.current === SETTLE_FRAMES) onReady();
    if (live && spinRef.current) spinRef.current.rotation.y += Math.min(delta, 0.1) * SPIN_SPEED;
  });

  return (
    <group ref={spinRef}>
      {hexGrid.map(hex => (
        <HexTile key={hex.id} hex={hex} onHexClick={noop} onHexHover={noop} onHexHoverEnd={noop} />
      ))}
      <BoardDecorations hexGrid={hexGrid} />
      {CASTLES.map(([c, owner]) => (
        <Castle key={owner} owner={owner} look={owner === 'player' ? playerCastleStyle : undefined} position={surface(hexGrid, c)} health={50} maxHealth={50} hideLabel />
      ))}
      {CAMPS.map(([c, owner]) => (
        <Camp key={key(c)} owner={owner} position={surface(hexGrid, c)} hideLabel />
      ))}
      {live && troops.map((unit, index) => {
        // Everyone faces the enemy castle, apart from the units locked in a skirmish
        const [enemyCastle] = CASTLES.find(([, owner]) => owner !== unit.owner)!;
        const [tx, , tz] = axialToWorld(enemyCastle);
        const skirmish = SKIRMISHES.find(([attacker]) => attacker === index);
        return (
          <UnitMesh
            key={unit.id}
            unit={unit}
            position={surface(hexGrid, unit.position)}
            facingTarget={[tx, tz]}
            battle={skirmish ? battles[skirmish[1]] : null}
            decorative
          />
        );
      })}
    </group>
  );
};

interface IslandDioramaProps {
  // Called with the theme on show (once the island is ready), so the page can name it
  onThemeChange?: (name: string) => void;
  // Called once the first island's terrain and scenery are on screen
  onReady?: () => void;
  // For the poster picture: the first island's terrain alone, standing still
  poster?: boolean;
}

const IslandDiorama: React.FC<IslandDioramaProps> = ({ onThemeChange, onReady, poster = false }) => {
  const [themeIndex, setThemeIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const live = ready && !poster;

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => setThemeIndex(index => (index + 1) % MAP_THEMES.length), THEME_DURATION);
    return () => clearInterval(interval);
  }, [live]);

  useEffect(() => {
    if (live) onThemeChange?.(MAP_THEMES[themeIndex].name);
  }, [live, themeIndex, onThemeChange]);

  const handleReady = () => {
    if (ready) return;
    setReady(true);
    onReady?.();
  };

  return (
    <Canvas shadows flat dpr={poster ? 1 : [1, 1.5]} gl={poster ? { preserveDrawingBuffer: true, alpha: true } : undefined} camera={{ position: [0, 15, 19], fov: CAMERA_FOV }}>
      <hemisphereLight args={['#ffffff', '#9ccfe8', 1.6]} />
      <directionalLight
        position={[8, 20, 12]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0005}
      />
      <group position={[0, -1.5, 0]}>
        <Island themeIndex={themeIndex} live={live} onReady={handleReady} />
      </group>
    </Canvas>
  );
};

export default IslandDiorama;
