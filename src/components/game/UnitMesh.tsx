import { memo, useMemo, useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { HexCoordinates, TerrainType, Unit } from '@/types/game';
import {
  getAttackInterval,
  getUnitLook,
  getAnimationName,
  getProjectile,
  AnimationState,
  Projectile
} from './utils/UnitModelSystem';
import type { CreatureRig, CreatureState } from './utils/creatureTypes';
import { getTimeScale } from './effects/effects';
import { MELEE_IMPACT_POINT, PROJECTILE_FLIGHT_TIME, RANGED_RELEASE_POINT, WALK_SPEED, strikeOffset } from './utils/battleTiming';
import { playBattleSound, BattleSound } from './utils/battleSounds';
import { DRAG_CLICK_TOLERANCE } from './HexTile';
import { instantiateUnitModel, findAnimationClip, disposeUnitModel, UnitModelInstance } from './utils/unitModelCache';
import { ArrowIcon, AttackIcon, BondIcon, CrownIcon, GoldIcon, ShieldIcon, SignatureIcon, TerrainIcon, UnitIcon, WaitIcon } from './icons';

// Small lift so the unit's indicator doesn't z-fight with the tile surface
const UNIT_ELEVATION = 0.02;
// Owner ring height above the unit's base: clear of hovered tiles, which rise slightly
const RING_HEIGHT = 0.05;
const TURN_SPEED = 8; // how quickly units rotate to face their target
const ANIMATION_FADE_DURATION = 0.3;
// How far melee units step towards their target on each strike
const LUNGE_DISTANCE = 0.4;
// Height a bolt or spell is shot from
const PROJECTILE_HEIGHT = 0.6;
// How long a floating damage number stays up (ms)
const HIT_NUMBER_DURATION = 1200;
// A destroyed unit falls, then shrinks and sinks into the ground in a puff of dust (s)
const DEATH_FALL = 0.8;
const DEATH_FADE = 1;
export const DEATH_DURATION = DEATH_FALL + DEATH_FADE;
// How far a fallen unit sinks, and how long its dust puff lasts
const DEATH_SINK = 0.45;
const PUFF_SECONDS = 0.9;
const PUFF_COUNT = 10;
const PUFF_COLOR = '#d6cfc2';

// Colours of glowing projectiles
const PROJECTILE_COLORS: Record<Exclude<Projectile, 'arrow' | 'rock'>, { core: string; glow: string; trail: string }> = {
  magic: { core: '#e9d5ff', glow: '#a855f7', trail: '#c084fc' },
  fire: { core: '#fed7aa', glow: '#f97316', trail: '#fb923c' },
  spit: { core: '#d9f99d', glow: '#65a30d', trail: '#a3e635' },
  frost: { core: '#e0f2fe', glow: '#38bdf8', trail: '#7dd3fc' }
};

export const OWNER_COLORS = {
  player: '#3b82f6',
  ai: '#ef4444'
};

// The fight a unit is taking part in right now, if any
export interface UnitBattle {
  // Changes for every new battle so the animation restarts
  key: string;
  // World position (on the tile surface) of the enemy this unit strikes at, or null if it can't reach any
  target: [number, number, number] | null;
  // Seconds to wait before the fight begins, while the troops walking into it arrive
  startDelay?: number;
  // Blows this unit takes during the battle: when each lands (seconds after the battle starts) and the
  // total damage they add up to, so its health bar can drop hit by hit
  incoming?: { times: number[]; damage: number };
  // How many blows this unit strikes (each of them landing some damage); unlimited if not set
  strikes?: number;
  // When this unit, and the enemy it strikes at, fall in the battle (null if they survive it)
  diesAt?: number | null;
  targetDiesAt?: number | null;
}

// Dust kicked up as a fallen unit sinks into the ground
const DustPuff: React.FC<{ delay: number }> = ({ delay }) => {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(-delay);
  const motes = useMemo(() => Array.from({ length: PUFF_COUNT }, (_, i) => {
    const angle = (i / PUFF_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    return { x: Math.cos(angle), z: Math.sin(angle), speed: 0.6 + Math.random() * 0.6 };
  }), []);

  useFrame((_, rawDelta) => {
    timeRef.current += Math.min(rawDelta, 0.1) * getTimeScale();
    const group = groupRef.current;
    if (!group) return;
    const t = timeRef.current / PUFF_SECONDS;
    group.visible = t >= 0 && t <= 1;
    if (!group.visible) return;
    const spread = 1 - (1 - t) ** 3;
    group.children.forEach((child, i) => {
      const mote = motes[i];
      const mesh = child as THREE.Mesh;
      mesh.position.set(mote.x * spread * 0.75 * mote.speed, 0.08 + spread * 0.4 * mote.speed, mote.z * spread * 0.75 * mote.speed);
      mesh.scale.setScalar(0.08 + spread * 0.16);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
    });
  });

  return (
    <group ref={groupRef} visible={false}>
      {motes.map((_, i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PUFF_COLOR} transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

// A buff (or drawback) working on a unit, shown under its health tag: its icon (a terrain, or a
// bond, gold or attack symbol), name and what it does in numbers
export interface UnitBuff {
  id: string;
  terrain?: TerrainType;
  icon?: 'bond' | 'gold' | 'attack' | 'signature' | 'shield';
  label: string;
  value: string;
  good: boolean;
  // Always on (bonds): listed when the row is opened, but no icon of its own
  quiet?: boolean;
}

// Icons shown under a unit at most; the rest are counted
const MAX_BUFF_ICONS = 3;

const NO_BUFFS: UnitBuff[] = [];

const BuffIcon: React.FC<{ buff: UnitBuff }> = ({ buff }) =>
  buff.icon === 'bond' ? <BondIcon /> : buff.icon === 'gold' ? <GoldIcon /> : buff.icon === 'attack' ? <AttackIcon />
    : buff.icon === 'signature' ? <SignatureIcon /> : buff.icon === 'shield' ? <ShieldIcon />
      : <TerrainIcon terrain={buff.terrain ?? 'plain'} />;

// A unit's buffs as a short row of icons (the first few, then a count); tapping it opens each one's
// name and numbers
// Only the icons take clicks: the open details let clicks through to the board, and close on the
// next click anywhere else
const BuffRow: React.FC<{ buffs: UnitBuff[]; open: boolean; setOpen: (update: (open: boolean) => boolean) => void }> = ({ buffs, open, setOpen }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) setOpen(() => false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open, setOpen]);
  const loud = buffs.filter(buff => !buff.quiet);
  const shown = loud.slice(0, MAX_BUFF_ICONS);
  const hidden = loud.length - shown.length;
  if (loud.length === 0) return null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        ref={buttonRef}
        type="button"
        style={{ pointerEvents: 'auto' }}
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        title="Buffs - tap for details"
        className="flex items-center gap-0.5 rounded-full bg-slate-900/75 px-1 py-px text-[0.6875rem] leading-none shadow hover:bg-slate-800"
      >
        {shown.map(buff => (
          <span
            key={buff.id}
            className={buff.icon === 'signature' ? 'rounded-full bg-fuchsia-500/40 px-px shadow-[0_0_6px_#e879f9]' : buff.good ? '' : 'opacity-80 grayscale-[30%]'}
          >
            <BuffIcon buff={buff} />
          </span>
        ))}
        {hidden > 0 && <span className="px-px text-[0.5625rem] font-bold text-slate-300">+{hidden}</span>}
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 rounded-lg bg-slate-900/90 px-2 py-1 text-[0.625rem] leading-tight shadow-lg">
          {buffs.map(buff => (
            <div key={buff.id} className="flex items-center gap-1 whitespace-nowrap">
              <BuffIcon buff={buff} />
              <b className="text-slate-100">{buff.label}</b>
              <span className={buff.good ? 'text-emerald-300' : 'text-rose-300'}>
                <span aria-hidden>{buff.good ? '▲ ' : '▼ '}</span>{buff.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface UnitMeshProps {
  unit: Unit;
  // Where the unit stands: world x/z of its hex and the height of the tile surface
  position: [number, number, number];
  // World x/z the unit should face while standing still
  facingTarget?: [number, number] | null;
  // World positions (on tile surfaces) a unit walks through to get between two hexes
  computeWalkPath?: (from: HexCoordinates, to: HexCoordinates, flying?: boolean) => THREE.Vector3[];
  onSelect?: (unit: Unit) => void;
  isPendingPurchase?: boolean;
  isSelected?: boolean;
  hasPlannedMove?: boolean;
  battle?: UnitBattle | null;
  // Buffs (and drawbacks) working on this unit now
  buffs?: UnitBuff[];
  // Decorative use (e.g. the menu's island): no label and no battle sounds
  decorative?: boolean;
  // Leave out the ring in its side's colour (card portraits)
  hideRing?: boolean;
  // The unit has just been destroyed: play its death and sink into the ground
  dying?: boolean;
  // ...having already fallen in the battle that destroyed it, so it only sinks away
  fallen?: boolean;
}

// Smallest signed difference between two angles
const angleDelta = (from: number, to: number) => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

const UnitMeshComponent: React.FC<UnitMeshProps> = ({
  unit,
  position,
  facingTarget = null,
  computeWalkPath,
  onSelect,
  isPendingPurchase = false,
  isSelected = false,
  hasPlannedMove = false,
  battle = null,
  buffs = NO_BUFFS,
  decorative = false,
  hideRing = false,
  dying = false,
  fallen = false
}) => {
  const look = getUnitLook(unit.type);
  const ownerColor = OWNER_COLORS[unit.owner];
  // Humanoid models are scaled here; procedural creatures come already sized
  const modelScale = look.kind === 'humanoid' ? look.scale : 1;

  const rootRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  // Horse under a mounted unit, galloping while the unit walks
  const mountRef = useRef<{ mixer: THREE.AnimationMixer; gallop: THREE.AnimationAction } | null>(null);
  const clipsRef = useRef<THREE.AnimationClip[]>([]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  // Procedural monster rig, and wings that flap (demons, pegasi)
  const rigRef = useRef<CreatureRig | null>(null);
  const rigStateRef = useRef<CreatureState | null>(null);
  const wingsRef = useRef<UnitModelInstance['wings'] | null>(null);
  const deathRef = useRef<number | null>(null);
  // Struck down in the battle being fought: it stops fighting and falls where it stands
  const [killed, setKilled] = useState(false);
  const killedRef = useRef(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Damage shown so far in the current battle, and floating numbers for recent hits
  const [shownDamage, setShownDamage] = useState(0);
  // The buff list under the label is open (drawn above every other label while it is)
  const [buffsOpen, setBuffsOpen] = useState(false);
  const [hitNumbers, setHitNumbers] = useState<{ id: number; amount: number }[]>([]);
  const battleProgressRef = useRef<{ key: string; landed: number; shown: number } | null>(null);
  // Seconds since the current battle began, following the game speed and slow motion
  const battleTimeRef = useRef(0);
  const hitTimeoutsRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timeouts = hitTimeoutsRef.current;
    return () => timeouts.forEach(clearTimeout);
  }, []);

  // A new battle (or the end of one) starts the health bar from the unit's real health again;
  // its clock starts once the troops walking into it arrive
  const battleKey = battle?.key ?? null;
  const startDelayRef = useRef(0);
  startDelayRef.current = battle?.startDelay ?? 0;
  useEffect(() => {
    setShownDamage(0);
    setHitNumbers([]);
    battleProgressRef.current = null;
    battleTimeRef.current = -startDelayRef.current;
    // A unit that fell in a battle but survived it after all gets back up
    if (killedRef.current) {
      killedRef.current = false;
      setKilled(false);
      deathRef.current = null;
      rigRef.current?.setState('idle');
      rigStateRef.current = null;
      actionRef.current?.fadeOut(0.2);
      actionRef.current = null;
    }
  }, [battleKey]);

  const showHit = (amount: number) => {
    const id = Date.now() + Math.random();
    setHitNumbers(current => [...current, { id, amount }]);
    const timeout = setTimeout(() => {
      hitTimeoutsRef.current.delete(timeout);
      setHitNumbers(current => current.filter(hit => hit.id !== id));
    }, HIT_NUMBER_DURATION);
    hitTimeoutsRef.current.add(timeout);
  };

  // Walking animation along a path of world positions
  const walkRef = useRef<{ points: THREE.Vector3[]; segment: number; progress: number } | null>(null);
  const lastCoordinatesRef = useRef<HexCoordinates>(unit.position);
  const targetPosition = useRef(new THREE.Vector3());
  targetPosition.current.set(position[0], position[1] + UNIT_ELEVATION, position[2]);

  // Facing direction the unit is currently turned towards
  const headingRef = useRef<number | null>(null);

  // Place the unit on mount; afterwards useFrame owns its position so walking isn't interrupted
  useLayoutEffect(() => {
    rootRef.current?.position.copy(targetPosition.current);
  }, []);

  // When the unit's hex changes, walk there instead of teleporting
  useLayoutEffect(() => {
    const last = lastCoordinatesRef.current;
    lastCoordinatesRef.current = unit.position;
    if (last.q === unit.position.q && last.r === unit.position.r) return;

    const points = computeWalkPath?.(last, unit.position, unit.abilities.includes('flying')) ?? [];
    if (points.length > 1) {
      walkRef.current = { points, segment: 0, progress: 0 };
    }
  }, [unit.position, unit.abilities, computeWalkPath]);

  // Load (a clone of) the model for this unit type and side
  useEffect(() => {
    const container = modelRef.current;
    if (!container) return;

    let cancelled = false;
    let loaded: UnitModelInstance | null = null;

    instantiateUnitModel(unit.type, unit.owner)
      .then(instance => {
        if (cancelled) {
          disposeUnitModel(instance);
          return;
        }
        loaded = instance;
        const { scene, animations, mount, rig, wings } = instance;

        scene.scale.setScalar(modelScale);
        container.add(scene);

        mixerRef.current = rig ? null : new THREE.AnimationMixer(scene);
        mountRef.current = mount ?? null;
        rigRef.current = rig ?? null;
        rigStateRef.current = null;
        wingsRef.current = wings ?? null;
        clipsRef.current = animations;
        setModelLoaded(true);
      })
      .catch(error => {
        console.error(`Error loading model for ${unit.type}:`, error);
      });

    return () => {
      cancelled = true;
      if (loaded) disposeUnitModel(loaded, mixerRef.current);
      mountRef.current?.mixer.stopAllAction();
      mountRef.current = null;
      rigRef.current = null;
      wingsRef.current = null;
      mixerRef.current = null;
      actionRef.current = null;
      clipsRef.current = [];
      container.clear();
      setModelLoaded(false);
    };
  }, [unit.type, unit.owner, modelScale]);

  // Cross-fade to an animation clip if it isn't already playing
  const playAnimation = (state: AnimationState) => {
    const rig = rigRef.current;
    if (rig) {
      const rigState: CreatureState = state === 'walk' ? 'walk' : state === 'holdShield' ? 'hold' : 'idle';
      if (rigStateRef.current !== rigState && rigStateRef.current !== 'attack') {
        rig.setState(rigState);
        rigStateRef.current = rigState;
      }
      return;
    }
    const mixer = mixerRef.current;
    if (!mixer) return;

    const clip = findAnimationClip(clipsRef.current, getAnimationName(unit.type, state));
    if (!clip) return;

    const nextAction = mixer.clipAction(clip);
    if (actionRef.current === nextAction) return;

    actionRef.current?.fadeOut(ANIMATION_FADE_DURATION);
    nextAction.reset().fadeIn(ANIMATION_FADE_DURATION).play();
    actionRef.current = nextAction;
  };

  const playSfx = (sound: BattleSound, volume: number) => {
    if (!decorative) playBattleSound(sound, volume);
  };

  const isRanged = unit.abilities.includes('rangedAttack');
  const projectile = getProjectile(unit.type);
  const isMagicShot = projectile !== 'arrow' && projectile !== 'rock';
  const attackInterval = getAttackInterval(unit.type);
  const arrowRef = useRef<THREE.Group>(null);
  // When the current battle started (clock time) and which strike was last played
  const battleClockRef = useRef<{ key: string; start: number; lastStrike: number; lastImpact: number } | null>(null);
  const targetVector = useRef(new THREE.Vector3());
  // Scratch vector reused every frame for the arrow's flight
  const arrowOffset = useRef(new THREE.Vector3());

  // Play one strike of the attack animation, sped up to fit the unit's attack interval
  const strike = () => {
    const rig = rigRef.current;
    if (rig) {
      if (rigStateRef.current !== 'attack') {
        rig.setState('attack');
        rigStateRef.current = 'attack';
      }
      rig.strike(attackInterval * 0.8);
      return;
    }
    const mixer = mixerRef.current;
    if (!mixer) return;
    const clip = findAnimationClip(clipsRef.current, getAnimationName(unit.type, 'attack'));
    if (!clip) return;

    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    if (actionRef.current && actionRef.current !== action) actionRef.current.fadeOut(0.1);
    action.reset().setEffectiveTimeScale(Math.max(1, clip.duration / (attackInterval * 0.8))).fadeIn(0.05).play();
    actionRef.current = action;
  };

  // Fall when destroyed: the death animation plays (or, for a unit that already fell, is shown
  // finished), then the body sinks into the ground
  const playDeath = (alreadyFallen: boolean) => {
    const rig = rigRef.current;
    if (rig) {
      rig.setState('death');
      rigStateRef.current = 'death';
      if (alreadyFallen) for (let i = 0; i < 20; i++) rig.update(0.1);
      return;
    }
    const mixer = mixerRef.current;
    const clip = findAnimationClip(clipsRef.current, 'Death_A');
    if (!mixer || !clip) return;
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    actionRef.current?.fadeOut(0.1);
    action.reset().play();
    if (alreadyFallen) {
      action.time = clip.duration;
      mixer.update(0);
    } else {
      action.fadeIn(0.1);
    }
    actionRef.current = action;
  };

  useFrame((_, rawDelta) => {
    const root = rootRef.current;
    if (!root) return;
    // Avoid huge jumps after the tab was in the background; follow the game speed and slow motion
    const delta = Math.min(rawDelta, 0.1) * getTimeScale();

    if (!dying) {
      if (battle) battleTimeRef.current += delta;

      // Blows landing on this unit: drop its health bar a step at a time as they hit
      if (battle?.incoming && battle.incoming.damage > 0) {
        if (battleProgressRef.current?.key !== battle.key) {
          battleProgressRef.current = { key: battle.key, landed: 0, shown: 0 };
        }
        const tally = battleProgressRef.current;
        const { times, damage } = battle.incoming;
        const landed = times.filter(time => time <= battleTimeRef.current).length;
        if (landed > tally.landed) {
          tally.landed = landed;
          const shown = Math.round(damage * landed / times.length);
          if (shown > tally.shown) {
            showHit(shown - tally.shown);
            tally.shown = shown;
            setShownDamage(shown);
          }
        }
      }

      // The killing blow has landed: stop fighting and fall
      if (!killedRef.current && battle?.diesAt != null && battleTimeRef.current >= battle.diesAt) {
        killedRef.current = true;
        setKilled(true);
      }
    }

    if (dying || killedRef.current) {
      if (deathRef.current === null && modelLoaded) {
        const alreadyFallen = dying && fallen;
        deathRef.current = alreadyFallen ? DEATH_FALL : 0;
        playDeath(alreadyFallen);
      }
      if (deathRef.current !== null && dying) {
        deathRef.current += delta;
        // Once it has fallen, the body shrinks and sinks into the ground
        const fade = Math.min(1, Math.max(0, deathRef.current - DEATH_FALL) / DEATH_FADE);
        const eased = fade * fade;
        root.position.y = targetPosition.current.y - eased * DEATH_SINK;
        root.scale.setScalar(1 - eased * 0.9);
      }
      if (modelRef.current) modelRef.current.position.set(0, 0, 0);
      if (arrowRef.current) arrowRef.current.visible = false;
      mixerRef.current?.update(delta);
      rigRef.current?.update(delta);
      return;
    }

    let desiredHeading: number | null = null;
    const walk = walkRef.current;

    if (walk) {
      // Move along the path segment by segment
      let remaining = WALK_SPEED * delta;
      while (remaining > 0 && walk.segment < walk.points.length - 1) {
        const from = walk.points[walk.segment];
        const to = walk.points[walk.segment + 1];
        const length = from.distanceTo(to);
        const left = length * (1 - walk.progress);

        if (remaining >= left) {
          remaining -= left;
          walk.segment += 1;
          walk.progress = 0;
        } else {
          walk.progress += remaining / Math.max(length, 0.0001);
          remaining = 0;
        }
      }

      if (walk.segment >= walk.points.length - 1) {
        walkRef.current = null;
        root.position.copy(targetPosition.current);
      } else {
        const from = walk.points[walk.segment];
        const to = walk.points[walk.segment + 1];
        root.position.lerpVectors(from, to, walk.progress);
        desiredHeading = Math.atan2(to.x - from.x, to.z - from.z);
      }
    } else if (root.position.distanceToSquared(targetPosition.current) > 0.0001) {
      root.position.lerp(targetPosition.current, Math.min(1, delta * 10));
    }

    // Battle: strike at the target on this unit's own cadence
    let lunge = 0;
    let isStriking = false;
    const arrow = arrowRef.current;
    if (arrow) arrow.visible = false;
    if (battle && !walkRef.current) {
      const now = battleTimeRef.current;
      if (battleClockRef.current?.key !== battle.key) {
        // Nobody strikes before the battle begins (its clock runs from minus the walk-in time)
        battleClockRef.current = { key: battle.key, start: Math.max(now, 0) + strikeOffset(unit.id), lastStrike: -1, lastImpact: -1 };
      }
      const clock = battleClockRef.current;
      const elapsed = now - clock.start;

      if (battle.target && elapsed >= 0) {
        const [tx, ty, tz] = battle.target;
        targetVector.current.set(tx, ty, tz);
        desiredHeading = Math.atan2(tx - root.position.x, tz - root.position.z);

        const strikeNumber = Math.floor(elapsed / attackInterval);
        const sinceStrike = elapsed - strikeNumber * attackInterval;
        const progress = sinceStrike / attackInterval;

        // Its foe has fallen: finish the strike in hand, then stand down
        const targetDown = battle.targetDiesAt != null && now >= battle.targetDiesAt;
        const outOfBlows = battle.strikes !== undefined && strikeNumber >= battle.strikes;
        if (strikeNumber !== clock.lastStrike && !targetDown && !outOfBlows) {
          clock.lastStrike = strikeNumber;
          strike();
          if (isRanged) playSfx(isMagicShot ? 'spellCast' : 'bowShot', 0.8);
        }

        if (strikeNumber !== clock.lastStrike) {
          // Standing down
        } else if (isRanged) {
          // The bolt (or spell) flies from the shooter to the target in an arc, once the shot is released
          const flightStart = attackInterval * RANGED_RELEASE_POINT;
          if (sinceStrike >= flightStart && sinceStrike < flightStart + PROJECTILE_FLIGHT_TIME && arrow) {
            const flight = (sinceStrike - flightStart) / PROJECTILE_FLIGHT_TIME;
            const arc = isMagicShot ? 0.3 : 0.6;
            const local = arrowOffset.current.copy(targetVector.current).sub(root.position);
            arrow.visible = true;
            arrow.position.set(local.x * flight, PROJECTILE_HEIGHT + local.y * flight + Math.sin(flight * Math.PI) * arc, local.z * flight);
            const ahead = Math.min(1, flight + 0.05);
            arrow.lookAt(
              root.position.x + local.x * ahead,
              root.position.y + PROJECTILE_HEIGHT + local.y * ahead + Math.sin(ahead * Math.PI) * arc,
              root.position.z + local.z * ahead
            );
          } else if (sinceStrike >= flightStart + PROJECTILE_FLIGHT_TIME && strikeNumber !== clock.lastImpact) {
            clock.lastImpact = strikeNumber;
            playSfx(isMagicShot ? 'spellHit' : 'arrowHit', 0.7);
          }
          isStriking = progress < 0.6;
        } else {
          // Step in, strike, step back
          isStriking = progress < 0.6;
          lunge = progress < MELEE_IMPACT_POINT
            ? Math.sin((progress / MELEE_IMPACT_POINT) * Math.PI / 2)
            : progress < 0.6 ? Math.cos(((progress - MELEE_IMPACT_POINT) / (0.6 - MELEE_IMPACT_POINT)) * Math.PI / 2) : 0;
          if (progress >= MELEE_IMPACT_POINT && strikeNumber !== clock.lastImpact) {
            clock.lastImpact = strikeNumber;
            playSfx('swordClash', 0.7);
            playSfx('swordHit', 0.5);
          }
        }
      }
    } else {
      battleClockRef.current = null;
    }

    if (modelRef.current) {
      if (lunge > 0 && desiredHeading !== null) {
        modelRef.current.position.set(Math.sin(desiredHeading) * lunge * LUNGE_DISTANCE, 0, Math.cos(desiredHeading) * lunge * LUNGE_DISTANCE);
      } else {
        modelRef.current.position.set(0, 0, 0);
      }
    }

    if (desiredHeading === null && facingTarget) {
      const dx = facingTarget[0] - root.position.x;
      const dz = facingTarget[1] - root.position.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.01) desiredHeading = Math.atan2(dx, dz);
    }

    // Turn smoothly towards the desired heading
    if (modelRef.current && desiredHeading !== null) {
      if (headingRef.current === null) headingRef.current = desiredHeading;
      headingRef.current += angleDelta(headingRef.current, desiredHeading) * Math.min(1, delta * TURN_SPEED);
    }
    if (modelRef.current) {
      // With nothing to face yet, still apply the model's own facing correction
      modelRef.current.rotation.y = headingRef.current ?? 0;
    }

    // Pick the animation for what the unit is doing right now
    if (walkRef.current) playAnimation('walk');
    else if (battle) {
      // Between strikes, hold the shield up
      if (!isStriking || !actionRef.current?.isRunning()) playAnimation('holdShield');
    }
    else if (isPendingPurchase) playAnimation('holdShield');
    else {
      // Leaving a battle: creatures drop their combat stance
      if (rigStateRef.current === 'attack') rigStateRef.current = null;
      playAnimation('idle');
    }

    mixerRef.current?.update(delta);
    rigRef.current?.update(delta);
    wingsRef.current?.flap(walkRef.current ? 9 : 2.5, delta);

    // The horse gallops while walking and stands still otherwise
    const mount = mountRef.current;
    if (mount) {
      mount.gallop.timeScale = walkRef.current ? 1.6 : 0;
      mount.mixer.update(delta);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onSelect) return;
    e.stopPropagation();
    // A press that moved is a camera drag, not a click
    if (e.delta > DRAG_CLICK_TOLERANCE) return;
    onSelect(unit);
  };

  // During a battle the bar shows the blows landed so far
  const shownHealth = Math.max(0, unit.lifespan - shownDamage);
  const healthRatio = unit.maxLifespan > 0 ? shownHealth / unit.maxLifespan : 1;
  const healthColor = healthRatio > 0.6 ? '#22c55e' : healthRatio > 0.3 ? '#eab308' : '#ef4444';

  return (
    <>
    {/* Dust thrown up as the fallen unit sinks away */}
    {dying && (
      <group position={position}>
        <DustPuff delay={fallen ? 0 : DEATH_FALL} />
      </group>
    )}
    <group
      ref={rootRef}
      onClick={onSelect ? handleClick : undefined}
    >
      {/* Invisible click area */}
      {onSelect && (
        <mesh position={[0, 0.6, 0]} visible={false}>
          <cylinderGeometry args={[0.45, 0.45, 1.2, 10]} />
        </mesh>
      )}

      {/* The 3D model is loaded into this group */}
      <group ref={modelRef} visible={modelLoaded} />

      {/* Crossbow bolt (pointed along +z) or glowing spell fired by ranged units in battle */}
      {isRanged && projectile === 'arrow' && (
        <group ref={arrowRef} visible={false}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.4, 5]} />
            <meshStandardMaterial color="#8d5a3b" />
          </mesh>
          <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.035, 0.08, 6]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
          <mesh position={[0, 0, -0.19]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.045, 0.06, 3]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </group>
      )}
      {isRanged && projectile === 'rock' && (
        <group ref={arrowRef} visible={false}>
          <mesh>
            <dodecahedronGeometry args={[0.07, 0]} />
            <meshStandardMaterial color="#8b8b8b" flatShading />
          </mesh>
        </group>
      )}
      {isRanged && isMagicShot && (
        <group ref={arrowRef} visible={false}>
          <mesh>
            <icosahedronGeometry args={[0.1, 0]} />
            <meshStandardMaterial
              color={PROJECTILE_COLORS[projectile as keyof typeof PROJECTILE_COLORS].core}
              emissive={PROJECTILE_COLORS[projectile as keyof typeof PROJECTILE_COLORS].glow}
              emissiveIntensity={1.5}
              flatShading
            />
          </mesh>
          <mesh position={[0, 0, -0.14]} scale={[0.6, 0.6, 1.6]}>
            <icosahedronGeometry args={[0.07, 0]} />
            <meshBasicMaterial color={PROJECTILE_COLORS[projectile as keyof typeof PROJECTILE_COLORS].trail} transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      {/* Simple placeholder while the model is loading (no external assets so it can't suspend the scene) */}
      {/* (decorative troops, as on the landing page, simply appear once their model is in) */}
      {!modelLoaded && !dying && !decorative && (
        <mesh position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
          <meshStandardMaterial color={ownerColor} />
        </mesh>
      )}

      {/* Owner ring so it's always clear which side a unit belongs to */}
      <mesh visible={!dying && !killed && !hideRing && (modelLoaded || !decorative)} position={[0, RING_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, isSelected ? 0.62 : 0.54, 32]} />
        <meshBasicMaterial
          color={isSelected ? '#facc15' : ownerColor}
          transparent
          opacity={isPendingPurchase ? 0.5 : 0.95}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Compact unit label: type and health, with its buffs underneath */}
      {!decorative && !dying && !killed && (
        <Html
          position={[0, look.labelHeight, 0]}
          center
          zIndexRange={buffsOpen ? [60, 50] : [5, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex flex-col items-center gap-0.5">
          <div
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6875rem] leading-none font-bold text-white whitespace-nowrap shadow select-none"
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: `2px solid ${ownerColor}`,
              opacity: isPendingPurchase ? 0.7 : 1
            }}
          >
            {unit.isBoss && <CrownIcon className="text-[0.8125rem]" />}
            <UnitIcon type={unit.type} className="text-[0.8125rem]" />
            {isPendingPurchase ? (
              <WaitIcon title="Arrives at the end of the turn" />
            ) : (
              <>
                <span className={`${battle ? 'w-9' : 'w-6'} h-1.5 rounded-full bg-slate-600 overflow-hidden inline-block`}>
                  <span
                    className="block h-full transition-[width] duration-200 ease-out"
                    style={{ width: `${healthRatio * 100}%`, background: healthColor }}
                  />
                </span>
                {/* Health as a number while fighting, so each blow is easy to follow */}
                {battle && <span className="tabular-nums">{shownHealth}</span>}
                 {hasPlannedMove && <ArrowIcon />}
              </>
            )}
          </div>
          {/* Buffs under the health tag: tap for what each one does */}
          {!isPendingPurchase && buffs.length > 0 && (
            <BuffRow buffs={buffs} open={buffsOpen} setOpen={setBuffsOpen} />
          )}
          </div>
        </Html>
      )}

      {/* A number pops up for every blow that lands during a battle */}
      {!decorative && !dying && hitNumbers.length > 0 && (
        <Html position={[0, look.labelHeight + 0.35, 0]} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
          <div className="relative h-0 w-0">
            {hitNumbers.map((hit, index) => (
              <span
                key={hit.id}
                className="animate-float-up font-display absolute -translate-x-1/2 whitespace-nowrap text-base font-bold text-red-400 select-none"
                style={{ left: `${(index % 3 - 1) * 10}px`, textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
              >
                -{hit.amount}
              </span>
            ))}
          </div>
        </Html>
      )}
    </group>
    </>
  );
};

export const UnitMesh = memo(UnitMeshComponent);
