import { memo, useState, useCallback, useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GameState, Hex, HexCoordinates, PlayerType, Unit, UnitType } from '@/types/game';
import { HexTile, HexHighlight } from './HexTile';
import { UnitMesh, CombatRole, OWNER_COLORS } from './UnitMesh';
import { Castle } from './Castle';
import { BoardDecorations } from './BoardDecorations';
import { MovePath } from './MovePath';
import LandscapeModels from './landscape/LandscapeModels';
import SkyDome from './environment/Sky';
import Fog from './environment/Fog';
import {
  UNITS,
  BASE_MAX_HEALTH,
  TERRAIN_EFFECTS,
  TERRAIN_BONUS_ATTACK_MULTIPLIER,
  findBaseHex,
  findTerrainPath,
  getActivePlayer,
  getMovePath,
  getValidBaseLocations
} from '@/lib/game/gameState';
import { getHexDistance } from '@/lib/game/hexUtils';
import { axialToWorld, getHexSurfaceHeight } from './utils/boardGeometry';
import { useLoadingManager } from './utils/LoadingManager';
import { AnimatedUnitPreview } from './AnimatedUnitPreview';
import { playSound } from './utils/SoundPlayer';
import { getUnitTypeName } from './utils/UnitHelpers';
import { TERRAIN_ICONS, TERRAIN_SHORT_EFFECTS } from './hud/terrainInfo';

const coordKey = (c: HexCoordinates) => `${c.q},${c.r}`;

// Camera framing: a fixed, almost top-down view from behind the active side's castle
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(68);
const CAMERA_FOV = 45;
// Radius of the playing field in world units, plus a margin for the HUD
const BOARD_VIEW_RADIUS = 18;
// Look slightly towards the viewing side's castle so it stays clear of the bottom HUD
const CAMERA_TARGET_OFFSET = 3.5;
const CAMERA_TURN_SPEED = 2.2;

interface GameBoardProps {
  gameState: GameState;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (unit: Unit) => void;
  onUnitPurchase: (unitType: UnitType, hex: Hex) => boolean;
  selectedHex?: Hex;
  selectedUnit?: Unit | null;
  validMoves?: HexCoordinates[];
  selectedUnitTypeForPurchase?: UnitType | null;
  gameStarted: boolean;
  isAITurn: boolean;
}

const GameBoardComponent: React.FC<GameBoardProps> = (props) => {
  // Use loading state from the parent provider
  const { isComplete: assetsLoaded } = useLoadingManager();

  return (
    <div className="w-full h-full">
      {/* Cap the pixel ratio so high-DPI screens stay smooth */}
      <Canvas shadows dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          {/* Sky background - always visible */}
          <SkyDome />

          {/* Basic lighting that's always available */}
          <ambientLight intensity={0.4} />

          <BoardScene {...props} assetsLoaded={assetsLoaded} />

          <PerspectiveCamera makeDefault fov={CAMERA_FOV} near={0.1} far={3000} position={[0, 35, 14]} />
          <CameraRig gameState={props.gameState} />
        </Suspense>
      </Canvas>
    </div>
  );
};

// Memoised so HUD updates (like the turn timer) don't re-render the 3D scene
export const GameBoard = memo(GameBoardComponent);

// Smallest signed difference between two angles
const angleDelta = (from: number, to: number) => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

// Fixed camera that looks down on the board from behind the castle of the side whose turn it is,
// swinging smoothly around the board when the turn changes. The player can't move it.
const CameraRig: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const { camera, size } = useThree();
  const azimuthRef = useRef<number | null>(null);

  const viewSide: PlayerType = gameState.currentPhase === 'setup' ? 'player' : getActivePlayer(gameState);

  const targetAzimuth = useMemo(() => {
    const base = findBaseHex(gameState, viewSide);
    if (!base) return 0;
    const [x, , z] = axialToWorld(base.coordinates);
    // Camera sits on the castle's side of the board, looking across it
    return Math.atan2(x, z);
    // Only depends on where the bases are, not on the rest of the state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players.player.baseLocation, gameState.players.ai.baseLocation, viewSide]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const current = azimuthRef.current ?? targetAzimuth;
    const azimuth = current + angleDelta(current, targetAzimuth) * Math.min(1, delta * CAMERA_TURN_SPEED);
    azimuthRef.current = azimuth;

    // Pull back far enough that the whole board fits on screen
    const perspective = camera as THREE.PerspectiveCamera;
    const halfFov = THREE.MathUtils.degToRad(perspective.fov / 2);
    const aspect = size.width / Math.max(size.height, 1);
    const distance = Math.max(
      BOARD_VIEW_RADIUS / Math.tan(halfFov),
      BOARD_VIEW_RADIUS / (Math.tan(halfFov) * aspect)
    );

    const targetX = Math.sin(azimuth) * CAMERA_TARGET_OFFSET;
    const targetZ = Math.cos(azimuth) * CAMERA_TARGET_OFFSET;
    const horizontal = distance * Math.cos(CAMERA_ELEVATION);
    camera.position.set(
      targetX + Math.sin(azimuth) * horizontal,
      distance * Math.sin(CAMERA_ELEVATION),
      targetZ + Math.cos(azimuth) * horizontal
    );
    camera.lookAt(targetX, 0, targetZ);
  });

  return null;
};

interface BoardSceneProps extends GameBoardProps {
  assetsLoaded: boolean;
}

// World position on top of a hex's tile
const surfacePosition = (hex: Hex): [number, number, number] => {
  const [x, , z] = axialToWorld(hex.coordinates);
  return [x, getHexSurfaceHeight(hex), z];
};

const toVector = ([x, y, z]: [number, number, number]) => new THREE.Vector3(x, y, z);

// Short labels for the terrain effects that currently help a unit
const getTerrainBadges = (unit: Unit, hex: Hex | undefined): string[] => {
  if (!hex) return [];
  const badges: string[] = [];
  const effect = TERRAIN_EFFECTS[hex.terrain];

  if (effect.damageTakenMultiplier < 1) {
    badges.push(`${TERRAIN_ICONS[hex.terrain]} -${Math.round((1 - effect.damageTakenMultiplier) * 100)}% dmg`);
  }
  if (hex.terrain === 'forest' && unit.abilities.includes('terrainBonus')) {
    badges.push(`⚔️ +${Math.round((TERRAIN_BONUS_ATTACK_MULTIPLIER - 1) * 100)}% atk`);
  }
  if (hex.isResourceHex) {
    badges.push(`${TERRAIN_ICONS.resource} +${hex.resourceValue ?? 0} gold`);
  }
  return badges;
};

interface DamagePopup {
  id: number;
  position: [number, number, number];
  text: string;
  color: string;
}

const BoardScene: React.FC<BoardSceneProps> = ({
  gameState,
  onHexClick,
  onUnitClick,
  onUnitPurchase,
  selectedHex,
  selectedUnit = null,
  validMoves = [],
  assetsLoaded,
  gameStarted,
  selectedUnitTypeForPurchase = null
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [placedUnitHex, setPlacedUnitHex] = useState<Hex | null>(null);
  const [popups, setPopups] = useState<DamagePopup[]>([]);

  const { hexGrid, currentPhase, pendingMoves, pendingPurchases, combats, players } = gameState;
  const isSetupPhase = currentPhase === 'setup';

  const hexByKey = useMemo(() => new Map(hexGrid.map(hex => [coordKey(hex.coordinates), hex])), [hexGrid]);
  const hoveredHex = hoveredKey ? hexByKey.get(hoveredKey) ?? null : null;

  // Clear the placement preview when leaving placement mode
  useEffect(() => {
    if (!selectedUnitTypeForPurchase || currentPhase !== 'planning') {
      setPlacedUnitHex(null);
    }
  }, [selectedUnitTypeForPurchase, currentPhase]);

  // Which hexes are highlighted and how
  const validMoveKeys = useMemo(() => new Set(validMoves.map(coordKey)), [validMoves]);
  const validBaseKeys = useMemo(
    () => isSetupPhase ? new Set(getValidBaseLocations(gameState).map(h => coordKey(h.coordinates))) : new Set<string>(),
    // Valid base locations only depend on the map during setup
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSetupPhase, hexGrid]
  );

  const getHighlight = (key: string): HexHighlight => {
    if (isSetupPhase) return validBaseKeys.has(key) ? 'base' : 'none';
    if (!validMoveKeys.has(key)) return 'none';
    return selectedUnitTypeForPurchase ? 'deploy' : 'move';
  };

  const selectedKey = selectedHex ? coordKey(selectedHex.coordinates) : null;

  // --- Interaction -----------------------------------------------------------------------

  const confirmPurchase = (hex: Hex) => {
    if (!selectedUnitTypeForPurchase) return;
    if (onUnitPurchase(selectedUnitTypeForPurchase, hex)) {
      playSound('hex-select-sound', 0.5);
      setPlacedUnitHex(null);
    }
  };

  const handleHexClick = (hex: Hex) => {
    if (!assetsLoaded) return;
    const key = coordKey(hex.coordinates);

    // Placing a unit from the barracks: first click previews, second click confirms
    if (selectedUnitTypeForPurchase && validMoveKeys.has(key)) {
      if (placedUnitHex && coordKey(placedUnitHex.coordinates) === key) {
        confirmPurchase(hex);
        return;
      }
      setPlacedUnitHex(hex);
    }

    onHexClick(hex);
  };

  const handleHexDoubleClick = (hex: Hex) => {
    if (!assetsLoaded || currentPhase !== 'planning') return;
    if (selectedUnitTypeForPurchase && validMoveKeys.has(coordKey(hex.coordinates))) {
      confirmPurchase(hex);
    }
  };

  // Stable callbacks so memoised tiles and units don't re-render when unrelated state changes
  const handlersRef = useRef({ handleHexClick, handleHexDoubleClick, onUnitClick, assetsLoaded });
  handlersRef.current = { handleHexClick, handleHexDoubleClick, onUnitClick, assetsLoaded };

  const stableHexClick = useCallback((hex: Hex) => handlersRef.current.handleHexClick(hex), []);
  const stableHexDoubleClick = useCallback((hex: Hex) => handlersRef.current.handleHexDoubleClick(hex), []);
  const stableUnitSelect = useCallback((unit: Unit) => {
    if (handlersRef.current.assetsLoaded) handlersRef.current.onUnitClick(unit);
  }, []);
  const handleHexHover = useCallback((hex: Hex) => {
    if (handlersRef.current.assetsLoaded) setHoveredKey(coordKey(hex.coordinates));
  }, []);
  const handleHexHoverEnd = useCallback((hex: Hex) => {
    const key = coordKey(hex.coordinates);
    setHoveredKey(current => current === key ? null : current);
  }, []);

  // --- Units -------------------------------------------------------------------------------

  const hexGridRef = useRef(hexGrid);
  hexGridRef.current = hexGrid;

  // World route between two hexes for walking animations
  const computeWalkPath = useCallback((from: HexCoordinates, to: HexCoordinates) => {
    const grid = hexGridRef.current;
    const byKey = new Map(grid.map(hex => [coordKey(hex.coordinates), hex]));
    return findTerrainPath(grid, from, to)
      .map(c => byKey.get(coordKey(c)))
      .filter((hex): hex is Hex => !!hex)
      .map(hex => toVector(surfacePosition(hex)));
  }, []);

  const allUnits = useMemo(() => [...players.player.units, ...players.ai.units], [players]);

  // Per-unit render data, memoised so units only re-render when something about them changes
  const unitRenderData = useMemo(() => {
    const enemyBaseCenters: Record<PlayerType, [number, number] | null> = { player: null, ai: null };
    for (const side of ['player', 'ai'] as const) {
      const enemyBase = findBaseHex(gameState, side === 'player' ? 'ai' : 'player');
      if (enemyBase) {
        const [x, , z] = axialToWorld(enemyBase.coordinates);
        enemyBaseCenters[side] = [x, z];
      }
    }

    const roles = new Map<string, CombatRole>();
    const combatFacing = new Map<string, HexCoordinates>();
    if (currentPhase === 'combat') {
      for (const combat of combats) {
        if (combat.resolved) continue;
        for (const defender of combat.defenders) {
          roles.set(defender.id, 'defender');
          if (combat.attackers[0]) combatFacing.set(defender.id, combat.attackers[0].position);
        }
        for (const attacker of combat.attackers) {
          roles.set(attacker.id, 'attacker');
          combatFacing.set(attacker.id, combat.hexCoordinates);
        }
      }
    }

    const plannedUnitIds = new Set(pendingMoves.map(m => m.unitId));

    return allUnits.map(unit => {
      const hex = hexByKey.get(coordKey(unit.position));
      const enemies = unit.owner === 'player' ? players.ai.units : players.player.units;

      // Face the unit we're fighting, else the nearest enemy close by, else the enemy castle
      let faceCoordinates = combatFacing.get(unit.id) ?? null;
      if (!faceCoordinates) {
        let nearest: Unit | null = null;
        let nearestDistance = 4;
        for (const enemy of enemies) {
          const distance = getHexDistance(unit.position, enemy.position);
          if (distance < nearestDistance) {
            nearest = enemy;
            nearestDistance = distance;
          }
        }
        faceCoordinates = nearest?.position ?? null;
      }

      let facingTarget = enemyBaseCenters[unit.owner];
      if (faceCoordinates) {
        const [x, , z] = axialToWorld(faceCoordinates);
        facingTarget = [x, z];
      }

      return {
        unit,
        position: hex ? surfacePosition(hex) : axialToWorld(unit.position),
        facingTarget,
        combatRole: roles.get(unit.id) ?? null,
        hasPlannedMove: plannedUnitIds.has(unit.id),
        terrainBadges: getTerrainBadges(unit, hex)
      };
    });
    // gameState is only used to find the bases
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUnits, hexByKey, combats, currentPhase, pendingMoves, players]);

  // Keep prop identities stable between renders so memoised units can skip re-rendering
  const unitPropsCache = useRef(new Map<string, (typeof unitRenderData)[number]>());
  const stableUnitRenderData = useMemo(() => {
    const next = new Map<string, (typeof unitRenderData)[number]>();
    const result = unitRenderData.map(data => {
      const previous = unitPropsCache.current.get(data.unit.id);
      const sameArray = (a: readonly unknown[] | null, b: readonly unknown[] | null) =>
        a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));
      const stable = previous ? {
        ...data,
        position: sameArray(previous.position, data.position) ? previous.position : data.position,
        facingTarget: sameArray(previous.facingTarget, data.facingTarget) ? previous.facingTarget : data.facingTarget,
        terrainBadges: sameArray(previous.terrainBadges, data.terrainBadges) ? previous.terrainBadges : data.terrainBadges
      } : data;
      next.set(data.unit.id, stable);
      return stable;
    });
    unitPropsCache.current = next;
    return result;
  }, [unitRenderData]);

  // --- Planned moves -----------------------------------------------------------------------

  const plannedPaths = useMemo(() => pendingMoves.flatMap(move => {
    const unit = allUnits.find(u => u.id === move.unitId);
    if (!unit) return [];

    const stateWithoutMove = { ...gameState, pendingMoves: pendingMoves.filter(m => m !== move) };
    const route = getMovePath(stateWithoutMove, unit, move.to) ?? [unit.position, move.to];
    const points = route
      .map(c => hexByKey.get(coordKey(c)))
      .filter((hex): hex is Hex => !!hex)
      .map(hex => toVector(surfacePosition(hex)));

    return [{ id: move.unitId, points, color: OWNER_COLORS[unit.owner] }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pendingMoves, allUnits, hexByKey]);

  // Preview the route to the hovered hex while a unit is selected
  const hoverPreviewPath = useMemo(() => {
    if (!selectedUnit || selectedUnit.owner !== 'player' || !hoveredKey || !validMoveKeys.has(hoveredKey)) return null;
    const target = hexByKey.get(hoveredKey);
    if (!target) return null;

    const stateWithoutMove = { ...gameState, pendingMoves: pendingMoves.filter(m => m.unitId !== selectedUnit.id) };
    const route = getMovePath(stateWithoutMove, selectedUnit, target.coordinates);
    if (!route) return null;

    return route
      .map(c => hexByKey.get(coordKey(c)))
      .filter((hex): hex is Hex => !!hex)
      .map(hex => toVector(surfacePosition(hex)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnit, hoveredKey, validMoveKeys, hexByKey, pendingMoves]);

  // --- Damage popups -----------------------------------------------------------------------

  const previousUnitsRef = useRef(new Map<string, { lifespan: number; position: [number, number, number] }>());
  const previousGameIdRef = useRef(players.player.id);
  const popupIdRef = useRef(0);
  const popupTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => popupTimeoutsRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    // A new game started - forget the old units instead of reporting them all as destroyed
    if (previousGameIdRef.current !== players.player.id) {
      previousGameIdRef.current = players.player.id;
      previousUnitsRef.current = new Map();
    }

    const previous = previousUnitsRef.current;
    const next = new Map<string, { lifespan: number; position: [number, number, number] }>();
    const created: DamagePopup[] = [];

    for (const { unit, position } of unitRenderData) {
      next.set(unit.id, { lifespan: unit.lifespan, position });
      const before = previous.get(unit.id);
      if (before && unit.lifespan < before.lifespan) {
        created.push({ id: ++popupIdRef.current, position, text: `-${before.lifespan - unit.lifespan}`, color: '#f87171' });
      }
    }
    for (const [id, before] of previous) {
      if (!next.has(id)) {
        created.push({ id: ++popupIdRef.current, position: before.position, text: '💀', color: '#ffffff' });
      }
    }
    previousUnitsRef.current = next;

    if (created.length === 0) return;
    setPopups(current => [...current, ...created]);
    const ids = new Set(created.map(p => p.id));
    popupTimeoutsRef.current.push(
      setTimeout(() => setPopups(current => current.filter(p => !ids.has(p.id))), 1600)
    );
  }, [unitRenderData, players.player.id]);

  // --- Rendering ---------------------------------------------------------------------------

  const unresolvedCombats = currentPhase === 'combat' ? combats.filter(c => !c.resolved) : [];
  const activeCombat = unresolvedCombats[0];
  const playerBase = findBaseHex(gameState, 'player');
  const aiBase = findBaseHex(gameState, 'ai');
  const playerCastlePosition = useMemo(() => playerBase ? surfacePosition(playerBase) : null, [playerBase]);
  const aiCastlePosition = useMemo(() => aiBase ? surfacePosition(aiBase) : null, [aiBase]);

  const showHoverPreview =
    assetsLoaded &&
    selectedUnitTypeForPurchase &&
    hoveredHex &&
    validMoveKeys.has(coordKey(hoveredHex.coordinates)) &&
    (!placedUnitHex || coordKey(placedUnitHex.coordinates) !== coordKey(hoveredHex.coordinates));

  return (
    <>
      {assetsLoaded && <Fog color="#e6f7ff" near={90} far={170} />}

      {/* Lighting */}
      {assetsLoaded && (
        <>
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[20, 30, 10]}
            intensity={1.3}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-far={150}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
            color="#fffaf0"
          />
          <directionalLight position={[-15, 10, -15]} intensity={0.5} color="#e6f7ff" />
        </>
      )}

      {/* Own Suspense boundary so loading scenery never hides the game board */}
      {gameStarted && assetsLoaded && (
        <Suspense fallback={null}>
          <LandscapeModels boardRadius={15} />
        </Suspense>
      )}

      {/* Hex grid */}
      {hexGrid.map(hex => {
        const key = coordKey(hex.coordinates);
        const isSelected = key === selectedKey;
        return (
          <HexTile
            key={hex.id}
            hex={hex}
            highlight={getHighlight(key)}
            isSelected={isSelected}
            isInvalidSelection={isSelected && isSetupPhase && !validBaseKeys.has(key)}
            isHovered={key === hoveredKey}
            onHexClick={stableHexClick}
            onHexDoubleClick={stableHexDoubleClick}
            onHexHover={handleHexHover}
            onHexHoverEnd={handleHexHoverEnd}
          />
        );
      })}

      {/* Trees, peaks, dunes and gold that show each hex's terrain */}
      <BoardDecorations hexGrid={hexGrid} />

      {/* Castles */}
      {playerCastlePosition && (
        <Castle
          owner="player"
          position={playerCastlePosition}
          health={players.player.baseHealth ?? BASE_MAX_HEALTH}
          maxHealth={players.player.maxBaseHealth ?? BASE_MAX_HEALTH}
        />
      )}
      {aiCastlePosition && (
        <Castle
          owner="ai"
          position={aiCastlePosition}
          health={players.ai.baseHealth ?? BASE_MAX_HEALTH}
          maxHealth={players.ai.maxBaseHealth ?? BASE_MAX_HEALTH}
        />
      )}

      {/* Units on the board */}
      {assetsLoaded && stableUnitRenderData.map(data => (
        <UnitMesh
          key={data.unit.id}
          unit={data.unit}
          position={data.position}
          facingTarget={data.facingTarget}
          computeWalkPath={computeWalkPath}
          onSelect={stableUnitSelect}
          isSelected={selectedUnit?.id === data.unit.id}
          hasPlannedMove={data.hasPlannedMove}
          combatRole={data.combatRole}
          terrainBadges={data.terrainBadges}
        />
      ))}

      {/* Units queued in the barracks appear at their deployment hex */}
      {assetsLoaded && pendingPurchases.map(purchase => {
        const hex = hexByKey.get(coordKey(purchase.position));
        const owner: PlayerType = purchase.playerId === players.player.id ? 'player' : 'ai';
        if (!hex) return null;

        const info = UNITS[purchase.unitType];
        const tempUnit: Unit = {
          ...info,
          abilities: [...info.abilities],
          id: `pending-${coordKey(purchase.position)}`,
          owner,
          position: purchase.position,
          hasMoved: false,
          isEngagedInCombat: false
        };

        return (
          <UnitMesh
            key={tempUnit.id}
            unit={tempUnit}
            position={surfacePosition(hex)}
            facingTarget={null}
            isPendingPurchase
          />
        );
      })}

      {/* Planned routes */}
      {assetsLoaded && plannedPaths.map(path => (
        <MovePath key={path.id} points={path.points} color={path.color} />
      ))}
      {assetsLoaded && hoverPreviewPath && (
        <MovePath points={hoverPreviewPath} color="#ffffff" isPreview />
      )}

      {/* Barracks placement previews */}
      {showHoverPreview && hoveredHex && selectedUnitTypeForPurchase && (
        <AnimatedUnitPreview
          unitType={selectedUnitTypeForPurchase}
          position={axialToWorld(hoveredHex.coordinates)}
          hexHeight={getHexSurfaceHeight(hoveredHex)}
          isPlaced={false}
        />
      )}
      {assetsLoaded && currentPhase === 'planning' && selectedUnitTypeForPurchase && placedUnitHex && (
        <AnimatedUnitPreview
          unitType={selectedUnitTypeForPurchase}
          position={axialToWorld(placedUnitHex.coordinates)}
          hexHeight={getHexSurfaceHeight(placedUnitHex)}
          isPlaced
        />
      )}

      {/* Battle markers */}
      {unresolvedCombats.map(combat => {
        const hex = hexByKey.get(coordKey(combat.hexCoordinates));
        if (!hex) return null;
        const [x, y, z] = surfacePosition(hex);
        const isActive = combat === activeCombat;
        return (
          <Html key={coordKey(combat.hexCoordinates)} position={[x, y + 2.2, z]} center zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`select-none ${isActive ? 'text-3xl animate-bounce' : 'text-xl opacity-70'}`}>⚔️</div>
          </Html>
        );
      })}

      {/* Damage numbers */}
      {popups.map(popup => (
        <Html
          key={popup.id}
          position={[popup.position[0], popup.position[1] + 1.8, popup.position[2]]}
          center
          zIndexRange={[8, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="animate-float-up text-2xl font-black select-none" style={{ color: popup.color, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            {popup.text}
          </div>
        </Html>
      ))}

      {/* Hover info */}
      {assetsLoaded && hoveredHex && !isSetupPhase && (
        <HoverTooltip hex={hoveredHex} />
      )}
    </>
  );
};

// One-line description of the hovered hex: its terrain effect and what's standing on it
const HoverTooltip: React.FC<{ hex: Hex }> = ({ hex }) => {
  const [x, y, z] = surfacePosition(hex);
  const effect = hex.isResourceHex
    ? `+${hex.resourceValue ?? 0} gold/round`
    : TERRAIN_SHORT_EFFECTS[hex.terrain];

  return (
    <Html position={[x, y + 0.2, z]} zIndexRange={[9, 0]} style={{ pointerEvents: 'none' }}>
      <div className="ml-5 -mt-5 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[11px] text-slate-100 shadow-lg select-none">
        <span className="font-bold">{TERRAIN_ICONS[hex.terrain]} {TERRAIN_EFFECTS[hex.terrain].name}</span>
        <span className="text-slate-400"> · {effect}</span>
        {hex.unit && (
          <span className="ml-1 font-semibold" style={{ color: OWNER_COLORS[hex.unit.owner] }}>
            · {getUnitTypeName(hex.unit.type)} ❤️{hex.unit.lifespan}
          </span>
        )}
      </div>
    </Html>
  );
};
