import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerType } from '@/types/game';
import { OWNER_COLORS } from './UnitMesh';
import { CrownIcon } from './icons';
import { getTimeScale, setCastleShownDamage } from './effects/effects';
import { KAYKIT_HEX_SCALE, usePropLibrary } from './utils/kaykitProps';

// KayKit's castle fills a hex and stands four units tall; this keeps it about two units high
const KAYKIT_CASTLE_SCALE = KAYKIT_HEX_SCALE * 0.58;
import { CastleStyle, getCastleStyle } from '@/lib/meta/cosmetics';

// Blows landing on a castle during a battle: when each lands (seconds after the battle starts, once
// the troops walking into it arrive) and the damage they add up to
export interface CastleIncoming {
  key: string;
  startDelay: number;
  times: number[];
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
const PENNANT_COLORS = ['#ef4444', '#facc15', '#22c55e', '#f97316', '#a855f7', '#ec4899'];

// Seconds the collapse takes, and how long a hit makes the castle shudder
const COLLAPSE_DURATION = 1.8;
const HIT_DURATION = 0.45;
const DEBRIS_COUNT = 14;
const DUST_COUNT = 7;

const debrisGeometry = new THREE.BoxGeometry(0.14, 0.12, 0.14);
const debrisMaterial = new THREE.MeshStandardMaterial({ color: STONE_DARK, flatShading: true });
const dustGeometry = new THREE.IcosahedronGeometry(0.3, 0);
const dustMaterial = new THREE.MeshStandardMaterial({ color: '#e7e1d6', transparent: true, opacity: 0.8, flatShading: true });

// A floating golden crown marking whose castle this is
const Crown: React.FC<{ gemColor: string; metal: string; glow: string }> = ({ gemColor, metal, glow }) => {
  const spikes = 5;
  return (
    <group>
      {/* Band */}
      <mesh>
        <cylinderGeometry args={[0.32, 0.28, 0.2, 20, 1, true]} />
        <meshStandardMaterial color={metal} metalness={0.8} roughness={0.25} emissive={glow} emissiveIntensity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: spikes }, (_, i) => {
        const angle = (i / spikes) * Math.PI * 2;
        const x = Math.cos(angle) * 0.3;
        const z = Math.sin(angle) * 0.3;
        return (
          <group key={i} position={[x, 0.18, z]}>
            <mesh>
              <coneGeometry args={[0.08, 0.2, 4]} />
              <meshStandardMaterial color={metal} metalness={0.8} roughness={0.25} emissive={glow} emissiveIntensity={0.35} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color={metal} metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
      {/* Gems in the owner's colour */}
      {Array.from({ length: spikes }, (_, i) => {
        const angle = ((i + 0.5) / spikes) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.31, 0, Math.sin(angle) * 0.31]}>
            <octahedronGeometry args={[0.05]} />
            <meshStandardMaterial color={gemColor} emissive={gemColor} emissiveIntensity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
};

// Decorations that set each castle style apart
const CastleDecor: React.FC<{ look: CastleStyle; angles: number[] }> = ({ look, angles }) => {
  switch (look.decor) {
    case 'pennants':
    case 'gilded':
      return (
        <>
          {angles.filter((_, i) => i % 2 === 0).map((angle, i) => (
            <group key={i} position={[Math.cos(angle) * 0.38, 1.06, Math.sin(angle) * 0.38]}>
              <mesh position={[0, 0.14, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 0.28, 5]} />
                <meshStandardMaterial color="#5d4037" />
              </mesh>
              <mesh position={[0.06, 0.23, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.045, 0.13, 3]} />
                <meshStandardMaterial color={look.decor === 'gilded' ? '#ffd700' : PENNANT_COLORS[i % PENNANT_COLORS.length]} flatShading />
              </mesh>
            </group>
          ))}
          {look.decor === 'gilded' && (
            <>
              <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.43, 0.025, 6, 24]} />
                <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.25} emissive="#b8860b" emissiveIntensity={0.3} />
              </mesh>
              <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.5, 0.025, 6, 24]} />
                <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.25} emissive="#b8860b" emissiveIntensity={0.3} />
              </mesh>
            </>
          )}
        </>
      );
    case 'crystals':
      return (
        <>
          {angles.map((angle, i) => (
            <mesh key={i} position={[Math.cos(angle) * 0.38, 1.14 + (i % 2) * 0.05, Math.sin(angle) * 0.38]} scale={[0.6, 1.6 + (i % 2) * 0.5, 0.6]}>
              <octahedronGeometry args={[0.07]} />
              <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.6} transparent opacity={0.85} flatShading />
            </mesh>
          ))}
        </>
      );
    case 'vines':
      return (
        <>
          {angles.map((angle, i) => (
            <group key={i}>
              {[0.2, 0.42, 0.66].map((height, j) => (
                <mesh key={j} position={[Math.cos(angle + j * 0.25) * (0.47 - height * 0.05), height, Math.sin(angle + j * 0.25) * (0.47 - height * 0.05)]}>
                  <icosahedronGeometry args={[0.06 + ((i + j) % 2) * 0.02, 0]} />
                  <meshStandardMaterial color={(i + j) % 3 === 0 ? '#f9a8d4' : '#4d7c0f'} flatShading />
                </mesh>
              ))}
            </group>
          ))}
        </>
      );
    case 'runes':
      return (
        <>
          {angles.map((angle, i) => (
            <mesh
              key={i}
              position={[Math.cos(angle + Math.PI / 6) * 0.44, 0.5, Math.sin(angle + Math.PI / 6) * 0.44]}
              rotation={[0, -(angle + Math.PI / 6) + Math.PI / 2, 0]}
            >
              <boxGeometry args={[0.04, 0.3, 0.02]} />
              <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={1.4} />
            </mesh>
          ))}
        </>
      );
    default:
      return null;
  }
};

const HIT_NUMBER_DURATION = 1200;

const CastleComponent: React.FC<CastleProps> = ({ owner, position, health, maxHealth, hideLabel = false, fallen = false, look = getCastleStyle(undefined), incoming }) => {
  const crownRef = useRef<THREE.Group>(null);
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
  const props = usePropLibrary();
  const kaykitCastle = look.id === 'keep' ? props?.get(owner === 'player' ? 'building_castle_blue' : 'building_castle_red') ?? null : null;
  const shownHealth = Math.max(0, health - (incoming ? shownDamage : 0));
  const healthRatio = maxHealth > 0 ? shownHealth / maxHealth : 0;
  const healthColor = healthRatio > 0.6 ? '#22c55e' : healthRatio > 0.3 ? '#eab308' : '#ef4444';

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1) * getTimeScale();
    const time = state.clock.getElapsedTime();
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
        const shown = Math.min(incoming.damage, Math.round(incoming.damage * landed / incoming.times.length));
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

    if (crownRef.current) {
      if (collapse === null) {
        crownRef.current.rotation.y = time * 0.6;
        crownRef.current.position.y = 1.75 + Math.sin(time * 1.5) * 0.08;
        crownRef.current.rotation.z = 0;
      } else {
        // The crown tumbles to the ground
        crownRef.current.rotation.y += delta * 6;
        crownRef.current.rotation.z = progress * 1.4;
        crownRef.current.position.y = Math.max(0.15, 1.75 - fall * 2);
        crownRef.current.position.x = progress * 0.7;
      }
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

  const towerAngles = [0, 1, 2, 3, 4, 5].map(i => (i / 6) * Math.PI * 2 + Math.PI / 6);

  return (
    <group position={position}>
      <group ref={structureRef}>
      {kaykitCastle ? (
        // The standard Stone Keep is KayKit's castle in the owner's colours
        <mesh geometry={kaykitCastle.geometry} material={kaykitCastle.material} scale={KAYKIT_CASTLE_SCALE} castShadow receiveShadow />
      ) : (<>
      {/* Keep */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.5, 0.9, 6]} />
        <meshStandardMaterial color={look.stone} flatShading />
      </mesh>
      {/* Battlements */}
      {towerAngles.map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * 0.38, 0.98, Math.sin(angle) * 0.38]} castShadow>
          <boxGeometry args={[0.16, 0.16, 0.16]} />
          <meshStandardMaterial color={look.stoneDark} flatShading />
        </mesh>
      ))}
      {/* Roof in the owner's colour */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <coneGeometry args={[0.32, 0.4, 6]} />
        <meshStandardMaterial color={look.roof ?? ownerColor} flatShading />
      </mesh>
      {/* Flag */}
      <mesh position={[0.22, 1.35, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0.36, 1.5, 0]}>
        <boxGeometry args={[0.26, 0.16, 0.01]} />
        <meshStandardMaterial color={ownerColor} side={THREE.DoubleSide} />
      </mesh>
      <CastleDecor look={look} angles={towerAngles} />
      </>)}
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

      {/* Crown (KayKit's castle has its own banners) */}
      <group ref={crownRef} position={[0, 1.75, 0]} visible={!kaykitCastle}>
        <Crown gemColor={ownerColor} metal={look.crown} glow={look.crownGlow} />
      </group>

      {/* Castle health */}
      {!hideLabel && !fallen && (
        <Html position={[0, 2.35, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-none font-bold text-white whitespace-nowrap shadow select-none"
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
