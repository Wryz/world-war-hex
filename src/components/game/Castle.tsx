import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerType } from '@/types/game';
import { OWNER_COLORS } from './UnitMesh';
import { CrownIcon } from './icons';
import { getTimeScale, setCastleShownDamage } from './effects/effects';
import { KAYKIT_HEX_SCALE, PropPack, usePropLibrary } from './utils/kaykitProps';

// KayKit's castle fills a hex and stands four units tall; this keeps it about two units high
const ENEMY_CASTLE_SCALE = 0.58;
// The packs a styled castle's model comes from
const CASTLE_STYLE_PACKS: PropPack[] = ['medieval', 'castles'];
import { CastleStyle, getCastleStyle } from '@/lib/meta/cosmetics';

// Blows landing on a castle during a battle: when each lands (seconds after the battle starts, once
// the troops walking into it arrive) and the damage they add up to
export interface CastleIncoming {
  key: string;
  startDelay: number;
  // When each hit lands (seconds into the battle) and how much it takes off, adding up to `damage`
  times: number[];
  amounts?: number[];
  damage: number;
}

interface CastleProps {
  owner: PlayerType;
  // World x/z of the base hex and the height of its surface
  position: [number, number, number];
  health: number;
  maxHealth: number;
  // Hide the health label (e.g. on the menu's decorative island)
  hideLabel?: boolean;
  // The castle has fallen: it crumbles in a cloud of rubble
  fallen?: boolean;
  // How it looks (your castle wears the style you picked)
  look?: CastleStyle;
  // Blows landing on it in the battle being fought
  incoming?: CastleIncoming;
}


const STONE_DARK = '#a39a8c';

// Seconds the collapse takes, and how long a hit makes the castle shudder
const COLLAPSE_DURATION = 1.8;
const HIT_DURATION = 0.45;
const DEBRIS_COUNT = 14;
const DUST_COUNT = 7;

const debrisGeometry = new THREE.BoxGeometry(0.14, 0.12, 0.14);
const debrisMaterial = new THREE.MeshStandardMaterial({ color: STONE_DARK, flatShading: true });
const dustGeometry = new THREE.IcosahedronGeometry(0.3, 0);
const dustMaterial = new THREE.MeshStandardMaterial({ color: '#e7e1d6', transparent: true, opacity: 0.8, flatShading: true });

const HIT_NUMBER_DURATION = 1200;

const CastleComponent: React.FC<CastleProps> = ({ owner, position, health, maxHealth, hideLabel = false, fallen = false, look = getCastleStyle(undefined), incoming }) => {
  const structureRef = useRef<THREE.Group>(null);
  const debrisRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Group>(null);
  // Time since the last hit and since the collapse began (null when not happening)
  const hitRef = useRef<number | null>(null);
  const collapseRef = useRef<number | null>(null);
  const previousHealthRef = useRef(health);

  // Each piece of rubble flies off in its own direction
  const debrisVelocities = useMemo(() => Array.from({ length: DEBRIS_COUNT }, (_, i) => {
    const angle = (i / DEBRIS_COUNT) * Math.PI * 2 + (i % 3) * 0.4;
    const speed = 1.2 + (i % 4) * 0.45;
    return new THREE.Vector3(Math.cos(angle) * speed, 2.2 + (i % 5) * 0.5, Math.sin(angle) * speed);
  }), []);

  // Damage shown so far in the battle being fought, so the health bar drops blow by blow, and
  // floating numbers for recent hits
  const [shownDamage, setShownDamage] = useState(0);
  const [hitNumbers, setHitNumbers] = useState<{ id: number; amount: number }[]>([]);
  const tallyRef = useRef<{ key: string; time: number; landed: number; shown: number } | null>(null);
  const hitTimeoutsRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timeouts = hitTimeoutsRef.current;
    return () => timeouts.forEach(clearTimeout);
  }, []);
  const incomingKey = incoming?.key ?? null;
  useEffect(() => {
    setShownDamage(0);
    tallyRef.current = null;
  }, [incomingKey]);
  // Share it with the top bar (only the battle's real castles have an owner's label)
  useEffect(() => {
    if (!hideLabel) setCastleShownDamage(owner, incoming ? shownDamage : 0);
  }, [owner, hideLabel, incoming, shownDamage]);
  const showHit = (amount: number) => {
    const id = Date.now() + Math.random();
    setHitNumbers(current => [...current, { id, amount }]);
    const timeout = setTimeout(() => {
      hitTimeoutsRef.current.delete(timeout);
      setHitNumbers(current => current.filter(hit => hit.id !== id));
    }, HIT_NUMBER_DURATION);
    hitTimeoutsRef.current.add(timeout);
  };

  useEffect(() => {
    // Hits already shown blow by blow don't shake it again when the battle's result is applied
    if (health < previousHealthRef.current && shownDamage === 0) hitRef.current = 0;
    previousHealthRef.current = health;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health]);

  useEffect(() => {
    if (fallen && collapseRef.current === null) collapseRef.current = 0;
    if (!fallen) collapseRef.current = null;
  }, [fallen]);
  const ownerColor = OWNER_COLORS[owner];
  // Your castle is the KayKit building of your chosen style; the enemy's is always the red castle
  const isStyled = owner === 'player';
  const props = usePropLibrary(isStyled && look.pack === 'castles' ? CASTLE_STYLE_PACKS : undefined);
  const kaykitCastle = props?.get(isStyled ? look.model : 'building_castle_red') ?? null;
  const kaykitScale = KAYKIT_HEX_SCALE * (isStyled ? look.scale : ENEMY_CASTLE_SCALE);
  const shownHealth = Math.max(0, health - (incoming ? shownDamage : 0));
  const healthRatio = maxHealth > 0 ? shownHealth / maxHealth : 0;
  const healthColor = healthRatio > 0.6 ? '#22c55e' : healthRatio > 0.3 ? '#eab308' : '#ef4444';

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1) * getTimeScale();
    const structure = structureRef.current;

    // Blows landing during a battle: drop the health bar a step at a time, and shudder at each
    if (incoming && incoming.damage > 0 && incoming.times.length > 0) {
      if (tallyRef.current?.key !== incoming.key) tallyRef.current = { key: incoming.key, time: -incoming.startDelay, landed: 0, shown: 0 };
      const tally = tallyRef.current;
      tally.time += delta;
      const landed = incoming.times.filter(at => at <= tally.time).length;
      if (landed > tally.landed) {
        tally.landed = landed;
        hitRef.current = 0;
        const shown = Math.min(incoming.damage, incoming.amounts
          ? incoming.amounts.slice(0, landed).reduce((sum, amount) => sum + amount, 0)
          : Math.round(incoming.damage * landed / incoming.times.length));
        if (shown > tally.shown) {
          showHit(shown - tally.shown);
          tally.shown = shown;
          setShownDamage(shown);
        }
      }
    }

    // A hit makes the castle shudder
    let wobble = 0;
    if (hitRef.current !== null) {
      hitRef.current += delta;
      const left = 1 - hitRef.current / HIT_DURATION;
      if (left <= 0) hitRef.current = null;
      else wobble = Math.sin(hitRef.current * 60) * 0.06 * left;
    }

    const collapse = collapseRef.current;
    if (collapse !== null) collapseRef.current = collapse + delta;
    const progress = collapse === null ? 0 : Math.min(1, collapse / COLLAPSE_DURATION);
    // Ease in: it holds for a moment, then gives way
    const fall = progress * progress;

    if (structure) {
      structure.rotation.z = wobble + fall * 0.55;
      structure.rotation.x = fall * 0.25;
      structure.position.y = -fall * 0.95;
      structure.scale.y = 1 - fall * 0.45;
    }

    // Rubble arcs out and settles; dust billows and fades
    const debris = debrisRef.current;
    if (debris) {
      debris.visible = collapse !== null && collapse < COLLAPSE_DURATION + 1.5;
      if (debris.visible && collapse !== null) {
        const t = Math.min(collapse, 1.4);
        debris.children.forEach((piece, i) => {
          const v = debrisVelocities[i];
          piece.position.set(v.x * t, Math.max(0.06, 0.6 + v.y * t - 4.9 * t * t), v.z * t);
          piece.rotation.set(t * 5 + i, t * 3, t * 4);
        });
      }
    }
    const dust = dustRef.current;
    if (dust) {
      dust.visible = collapse !== null && collapse < 2.4;
      if (dust.visible && collapse !== null) {
        const t = Math.min(collapse / 2.4, 1);
        dust.children.forEach((puff, i) => {
          const angle = (i / DUST_COUNT) * Math.PI * 2;
          puff.position.set(Math.cos(angle) * (0.3 + t * 1.1), 0.2 + t * 0.5, Math.sin(angle) * (0.3 + t * 1.1));
          puff.scale.setScalar(0.6 + t * 1.8);
        });
        dustMaterial.opacity = 0.8 * (1 - t);
      }
    }
  });

  return (
    <group position={position}>
      <group ref={structureRef}>
      {kaykitCastle ? (
        <mesh geometry={kaykitCastle.geometry} material={kaykitCastle.material} scale={kaykitScale} castShadow receiveShadow />
      ) : (
        // A plain keep for the moment before the models arrive
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.5, 0.9, 6]} />
          <meshStandardMaterial color="#cfc6b8" flatShading />
        </mesh>
      )}
      </group>

      {/* Rubble and dust when the castle falls */}
      <group ref={debrisRef} visible={false}>
        {Array.from({ length: DEBRIS_COUNT }, (_, i) => (
          <mesh key={i} geometry={debrisGeometry} material={debrisMaterial} castShadow />
        ))}
      </group>
      <group ref={dustRef} visible={false}>
        {Array.from({ length: DUST_COUNT }, (_, i) => (
          <mesh key={i} geometry={dustGeometry} material={dustMaterial} />
        ))}
      </group>

      {/* Castle health */}
      {!hideLabel && !fallen && (
        <Html position={[0, 2.35, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] leading-none font-bold text-white whitespace-nowrap shadow select-none"
            style={{ background: 'rgba(15, 23, 42, 0.85)', border: `2px solid ${ownerColor}` }}
          >
            <CrownIcon />
            <span className="w-10 h-1.5 rounded-full bg-slate-600 overflow-hidden inline-block">
              <span className="block h-full" style={{ width: `${healthRatio * 100}%`, background: healthColor }} />
            </span>
            <span>{shownHealth}</span>
          </div>
        </Html>
      )}
      {/* A number pops up for every blow that lands during a battle */}
      {!hideLabel && !fallen && hitNumbers.length > 0 && (
        <Html position={[0, 2.75, 0]} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
          <div className="relative h-0 w-0">
            {hitNumbers.map((hit, index) => (
              <span
                key={hit.id}
                className="animate-float-up font-display absolute -translate-x-1/2 whitespace-nowrap text-lg font-bold text-red-400 select-none"
                style={{ left: `${(index % 3 - 1) * 12}px`, textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
              >
                -{hit.amount}
              </span>
            ))}
          </div>
        </Html>
      )}
    </group>
  );
};

export const Castle = memo(CastleComponent);
