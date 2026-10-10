'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TroopId } from '@/lib/game/troops';
import type { LineageSetting } from '@/lib/game/lineages';
import { getAnimationName, getUnitLook } from '../game/utils/UnitModelSystem';
import { disposeUnitModel, findAnimationClip, instantiateUnitModel, MountRig, UnitModelInstance } from '../game/utils/unitModelCache';
import { PropPack, usePropLibrary } from '../game/utils/kaykitProps';
import { useReleaseGpuOnUnmount } from '../game/utils/releaseGpu';
import { canvasQuality, useGraphicsQuality } from '@/lib/graphics';

// A troop standing in its own corner of the realm, shown at the top of its skill tree: Swordsmen
// in a barracks yard, Archers at a woodland range, Mages at a shrine... When it learns something
// it raises its arms in a glow; when it evolves, a burst of light and its new form steps out of it
// and cheers.

export type ShowcaseMoment =
  | { kind: 'learn'; key: number }
  | { kind: 'evolve'; key: number; from: TroopId; to: TroopId };

interface SceneProp {
  model: string;
  at: [number, number];
  turn?: number;
  scale?: number;
}

interface SettingDef {
  ground: string;
  rim: string;
  sky: string;
  packs: PropPack[];
  props: SceneProp[];
}

const SETTINGS: Record<LineageSetting, SettingDef> = {
  // A barracks yard: the hall behind, a weapon rack and the regiment's banner
  barracks: {
    ground: '#b9a27a', rim: '#8a7452', sky: '#cfe3f5', packs: ['medieval', 'buildings', 'dungeon'],
    props: [
      { model: 'building_barracks_blue', at: [0.3, -1.9], turn: 0.1, scale: 1.5 },
      { model: 'weaponrack', at: [-1.1, -0.5], turn: 0.5 },
      { model: 'banner_patternA_red', at: [1.3, -1.0], turn: -0.4, scale: 0.4 },
      { model: 'barrel', at: [-1.35, 0.35], scale: 1.8 },
      { model: 'crate_A_big', at: [1.35, 0.3], turn: 0.3, scale: 1.6 }
    ]
  },
  // A woodland range: trees all round and a stack of straw by the butts
  range: {
    ground: '#8fbf5a', rim: '#5f8f3a', sky: '#d5ecd0', packs: ['medieval'],
    props: [
      { model: 'trees_A_small', at: [-1.2, -1.5], scale: 1.2 },
      { model: 'tree_single_B', at: [1.4, -1.2], scale: 1.1 },
      { model: 'trees_B_small', at: [0.2, -2.0], scale: 1.1 },
      { model: 'sack', at: [1.25, 0.25], turn: 0.6, scale: 1.8 },
      { model: 'crate_B_small', at: [-1.3, 0.2], turn: -0.3, scale: 1.8 }
    ]
  },
  // The stables and the paddock fence
  stables: {
    ground: '#a8b86a', rim: '#7a8a46', sky: '#e4efd4', packs: ['medieval'],
    props: [
      { model: 'tent', at: [-0.9, -1.4], turn: 0.5, scale: 1.3 },
      { model: 'fence_wood_straight', at: [0.9, -1.1], turn: 0.3 },
      { model: 'fence_wood_straight', at: [1.5, -0.4], turn: 1.3 },
      { model: 'sack', at: [-1.3, 0.1], scale: 1.8 },
      { model: 'flag_blue', at: [1.3, 0.5], scale: 2.2 }
    ]
  },
  // A thieves' hideout among dead trees, the loot piled up
  hideout: {
    ground: '#6f6a58', rim: '#4a4638', sky: '#c9c3d8', packs: ['medieval', 'halloween', 'dungeon'],
    props: [
      { model: 'tree_dead_large', at: [-1.2, -1.4], scale: 1.1 },
      { model: 'tree_dead_medium', at: [1.3, -1.3] },
      { model: 'chest_gold', at: [1.6, -0.9], turn: -0.6, scale: 0.75 },
      { model: 'coin_stack_large', at: [1.7, 0.2], scale: 0.5 },
      { model: 'lantern_standing', at: [-1.3, 0.2] }
    ]
  },
  // A shrine of old pillars and candles
  shrine: {
    ground: '#c9c3b5', rim: '#9a9384', sky: '#ddd6f3', packs: ['dungeon', 'halloween'],
    props: [
      { model: 'pillar_decorated', at: [-1.1, -1.2], scale: 0.6 },
      { model: 'pillar_decorated', at: [1.1, -1.2], scale: 0.6 },
      { model: 'shrine_candles', at: [0, -1.6] },
      { model: 'candle_triple', at: [-1.3, 0.3], scale: 0.6 },
      { model: 'torch_lit', at: [1.35, 0.2], scale: 0.7 }
    ]
  },
  // The workshop: a sawmill, a forge and stacked timber
  workshop: {
    ground: '#b49a6a', rim: '#86704a', sky: '#f1e3c8', packs: ['medieval', 'buildings'],
    props: [
      { model: 'building_blacksmith_blue', at: [-0.9, -1.8], turn: 0.3, scale: 1.4 },
      { model: 'resource_lumber', at: [1.2, -1.0], turn: -0.4 },
      { model: 'tree_single_A_cut', at: [1.4, 0.2] },
      { model: 'crate_A_big', at: [-1.35, 0.2], turn: 0.4, scale: 1.6 }
    ]
  }
};

export const settingSky = (setting: LineageSetting) => SETTINGS[setting].sky;

const Props: React.FC<{ setting: SettingDef }> = ({ setting }) => {
  const library = usePropLibrary(setting.packs);
  if (!library) return null;
  return (
    <>
      {setting.props.map((prop, i) => {
        const model = library.get(prop.model);
        if (!model) return null;
        return (
          <mesh
            key={i}
            geometry={model.geometry}
            material={model.material}
            position={[prop.at[0], 0, prop.at[1]]}
            rotation={[0, prop.turn ?? 0, 0]}
            scale={prop.scale ?? 1}
            // (the library's meshes are shared: they're released with the rest, not with this scene)
            dispose={null}
            castShadow
            receiveShadow
          />
        );
      })}
    </>
  );
};

// How long each part of a moment lasts, in seconds
const LEARN_SECONDS = 2.2;
const BURST_PEAK = 0.9;
const EVOLVE_SECONDS = 3.2;

// `onSwap` turns the form on show into the evolved one (unless the player has turned to another form
// meanwhile, when it says no)
const Troop: React.FC<{ type: TroopId; moment: ShowcaseMoment | null; onSwap: (from: TroopId, to: TroopId) => boolean }> = ({ type, moment, onSwap }) => {
  const containerRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipsRef = useRef<THREE.AnimationClip[]>([]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const rigRef = useRef<UnitModelInstance['rig'] | null>(null);
  const mountRef = useRef<MountRig | null>(null);
  const invalidate = useThree(state => state.invalidate);
  const ringRef = useRef<THREE.Mesh>(null);
  const burstRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const momentRef = useRef<{ moment: ShowcaseMoment; time: number; swapped: boolean } | null>(null);
  // The model on show, and whether the next one to load should step out cheering (it evolved)
  const instanceRef = useRef<UnitModelInstance | null>(null);
  const cheerRef = useRef(false);
  const [loaded, setLoaded] = useState(0);

  const removeModel = (container: THREE.Group | null) => {
    const old = instanceRef.current;
    if (!old) return;
    disposeUnitModel(old, mixerRef.current);
    container?.remove(old.scene);
    instanceRef.current = null;
    mixerRef.current = null;
    rigRef.current = null;
    mountRef.current = null;
    actionRef.current = null;
  };

  // Load the troop's model; the one on show stays until its replacement is ready, so the scene is
  // never empty while a new form downloads
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const look = getUnitLook(type);
    instantiateUnitModel(type, 'player').then(loadedInstance => {
      if (cancelled) {
        disposeUnitModel(loadedInstance);
        return;
      }
      removeModel(container);
      instanceRef.current = loadedInstance;
      loadedInstance.scene.scale.setScalar(look.kind === 'humanoid' ? look.scale * 1.5 : 1.5);
      container.add(loadedInstance.scene);
      mixerRef.current = loadedInstance.rig ? null : new THREE.AnimationMixer(loadedInstance.scene);
      clipsRef.current = loadedInstance.animations;
      rigRef.current = loadedInstance.rig ?? null;
      mountRef.current = loadedInstance.mount ?? null;
      mountRef.current?.setWalking(false);
      actionRef.current = null;
      setLoaded(n => n + 1);
      // (a paused scene draws it once, so its shaders are ready before the scene is shown)
      invalidate();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [type, invalidate]);
  // (and the last one goes when the scene closes)
  useEffect(() => {
    const container = containerRef.current;
    return () => removeModel(container);
  }, []);

  const play = (clipName: string, once = false) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    const clip = findAnimationClip(clipsRef.current, clipName);
    if (!clip) return;
    const next = mixer.clipAction(clip);
    if (once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = false;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    if (actionRef.current !== next) actionRef.current?.fadeOut(0.25);
    next.reset().fadeIn(0.25).play();
    actionRef.current = next;
  };

  // Idle once loaded
  useEffect(() => {
    if (loaded > 0) play(getAnimationName(type, 'idle'));
    rigRef.current?.setState('idle');
    // A form that has just evolved steps out cheering, however long its model took to arrive
    if (loaded > 0 && cheerRef.current) {
      cheerRef.current = false;
      play('Cheer', true);
      rigRef.current?.strike(0.8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Start a moment
  useEffect(() => {
    // (a moment cut short is dropped, rather than picking up where it was when the next scene opens)
    if (!moment) {
      momentRef.current = null;
      return;
    }
    momentRef.current = { moment, time: 0, swapped: false };
    if (moment.kind === 'learn') {
      play('Spellcast_Raise', true);
      rigRef.current?.strike(0.8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment?.key]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    rigRef.current?.update(delta);
    mountRef.current?.update(delta);
    // Back to idle when a one-off clip ends
    const action = actionRef.current;
    if (action && action.loop === THREE.LoopOnce && !action.isRunning()) play(getAnimationName(type, 'idle'));

    const ring = ringRef.current;
    const burst = burstRef.current;
    const light = lightRef.current;
    const current = momentRef.current;
    if (!ring || !burst || !light) return;
    if (!current) {
      ring.visible = false;
      burst.visible = false;
      light.intensity = 0;
      return;
    }
    current.time += delta;
    const t = current.time;
    if (current.moment.kind === 'learn') {
      // A ring of light rises around the troop and fades
      const p = Math.min(1, t / LEARN_SECONDS);
      ring.visible = p < 1;
      ring.position.y = 0.1 + p * 1.6;
      ring.scale.setScalar(0.9 + Math.sin(p * Math.PI) * 0.25);
      (ring.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.9;
      light.intensity = Math.sin(p * Math.PI) * 6;
      burst.visible = false;
      if (p >= 1) momentRef.current = null;
    } else {
      // A burst of light swells over the old form, the new one appears at its peak, then it fades
      const p = Math.min(1, t / EVOLVE_SECONDS);
      const swell = t < BURST_PEAK ? t / BURST_PEAK : Math.max(0, 1 - (t - BURST_PEAK) / (EVOLVE_SECONDS - BURST_PEAK));
      burst.visible = swell > 0.01;
      burst.scale.setScalar(0.3 + swell * 1.6);
      (burst.material as THREE.MeshBasicMaterial).opacity = swell * 0.95;
      light.intensity = swell * 14;
      ring.visible = true;
      ring.position.y = 0.05;
      ring.scale.setScalar(0.6 + p * 2.2);
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.8;
      if (!current.swapped && t >= BURST_PEAK) {
        current.swapped = true;
        if (onSwap(current.moment.from, current.moment.to)) cheerRef.current = true;
      }
      if (p >= 1) momentRef.current = null;
    }
  });

  return (
    <group>
      {/* (turned three-quarters to the camera, so a rider isn't hidden behind its mount's head) */}
      <group ref={containerRef} rotation={[0, -0.55, 0]} />
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[0.75, 0.05, 8, 48]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={burstRef} position={[0, 0.9, 0]} visible={false}>
        <sphereGeometry args={[0.8, 24, 16]} />
        <meshBasicMaterial color="#fffbeb" transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 1.4, 0.6]} color="#fde68a" intensity={0} distance={6} />
    </group>
  );
};

interface TroopShowcaseProps {
  type: TroopId;
  setting: LineageSetting;
  moment: ShowcaseMoment | null;
  // The form shown changed mid-evolution
  onEvolved?: (type: TroopId) => void;
  // Kept loaded but only drawing on changes (the scene only plays while it's on show)
  paused?: boolean;
  className?: string;
}

export const TroopShowcase: React.FC<TroopShowcaseProps> = ({ type, setting, moment, onEvolved, paused = false, className = '' }) => {
  const quality = useGraphicsQuality();
  useReleaseGpuOnUnmount();
  const def = SETTINGS[setting];
  // The form on show: follows `type`, and mid-evolution switches to the new form at the burst's peak
  // (before the parent hears of it through onEvolved)
  const [shown, setShown] = useState(type);
  const [prevType, setPrevType] = useState(type);
  if (prevType !== type) {
    setPrevType(type);
    setShown(type);
  }
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(${def.sky}, #ffffff00 120%)` }}>
      {/* (paused, it still draws whenever something in it changes - a model arriving - so its shaders
          and textures are ready before it's shown, rather than stalling its first moment) */}
      <Canvas key={quality} {...canvasQuality(quality, [1, 2])} frameloop={paused ? 'demand' : 'always'} camera={{ position: [0, 2.3, 5.4], fov: 34 }} onCreated={({ camera }) => camera.lookAt(0, 0.75, 0)}>
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 6, 4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[2.6, 40]} />
          <meshStandardMaterial color={def.ground} />
        </mesh>
        {/* (its top sits just below the ground, so the two never fight over the same depth) */}
        <mesh position={[0, -0.09, 0]}>
          <cylinderGeometry args={[2.62, 2.75, 0.16, 40]} />
          <meshStandardMaterial color={def.rim} />
        </mesh>
        <Props setting={def} />
        <Troop
          type={shown}
          moment={moment}
          onSwap={(from, next) => {
            if (shown !== from) return false;
            setShown(next);
            onEvolved?.(next);
            return true;
          }}
        />
      </Canvas>
    </div>
  );
};
