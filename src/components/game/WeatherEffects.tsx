import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameState } from '@/types/game';
import { WeatherId, activeWeather, getFogBankCentres } from '@/lib/game/regionRules';
import { getNeighbors } from '@/lib/game/hexUtils';
import { axialToWorld } from './utils/boardGeometry';

// The region's weather on the board: banks of fog drifting across the field, and while a storm
// rages, sand streaming sideways, snow driving down or ash drifting on the wind.

// A soft round puff, drawn once and shared
let puffTexture: THREE.Texture | null = null;
const getPuffTexture = () => {
  if (puffTexture || typeof document === 'undefined') return puffTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  puffTexture = new THREE.CanvasTexture(canvas);
  return puffTexture;
};

const FOG_HEIGHT = 1.25;
// Offsets of a bank's puffs from its centre: the centre hex and the ring around it
const BANK_OFFSETS = (() => {
  const [cx, , cz] = axialToWorld({ q: 0, r: 0 });
  return [{ q: 0, r: 0 }, ...getNeighbors({ q: 0, r: 0 })].map(c => {
    const [x, , z] = axialToWorld(c);
    return new THREE.Vector3(x - cx, 0, z - cz);
  });
})();

// One bank of fog: a cluster of puffs gliding to where the bank now lies
const FogBank: React.FC<{ target: THREE.Vector3; seed: number }> = ({ target, seed }) => {
  const groupRef = useRef<THREE.Group>(null);
  const placed = useRef(false);
  const texture = getPuffTexture();
  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    if (!placed.current) {
      group.position.copy(target);
      placed.current = true;
    }
    group.position.lerp(target, Math.min(1, delta * 0.8));
    group.children.forEach((puff, i) => {
      puff.position.y = Math.sin(clock.elapsedTime * 0.5 + i * 1.7 + seed) * 0.12;
    });
  });
  return (
    <group ref={groupRef}>
      {BANK_OFFSETS.flatMap((offset, i) => [0, 1].map(layer => (
        <sprite
          key={`${i}-${layer}`}
          position={[offset.x + (layer ? 0.35 : -0.3), 0, offset.z + (layer ? -0.25 : 0.3)]}
          scale={[layer ? 2.2 : 2.6, layer ? 1.3 : 1.5, 1]}
          renderOrder={5}
        >
          <spriteMaterial map={texture ?? undefined} color="#eef2f7" transparent opacity={layer ? 0.42 : 0.55} depthWrite={false} />
        </sprite>
      )))}
    </group>
  );
};

const STORMS: Partial<Record<WeatherId, { count: number; color: string; size: number; fall: number; wind: number; sway: number; low: number; high: number; opacity: number }>> = {
  sandstorm: { count: 900, color: '#e3b866', size: 0.22, fall: 0.15, wind: 7, sway: 0.4, low: 0.2, high: 3.5, opacity: 0.8 },
  blizzard: { count: 900, color: '#ffffff', size: 0.24, fall: 2.2, wind: 2.5, sway: 0.6, low: 0, high: 7, opacity: 0.95 },
  ashfall: { count: 450, color: '#78716c', size: 0.17, fall: 0.5, wind: 0.6, sway: 0.8, low: 0, high: 6, opacity: 0.9 }
};

// Particles over the whole field, fading in while the storm rages and out when it blows over
const Storm: React.FC<{ kind: WeatherId; on: boolean; extent: number }> = ({ kind, on, extent }) => {
  const style = STORMS[kind]!;
  const pointsRef = useRef<THREE.Points>(null);
  const { geometry, phases } = useMemo(() => {
    const positions = new Float32Array(style.count * 3);
    const phases = new Float32Array(style.count);
    for (let i = 0; i < style.count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * extent;
      positions[i * 3 + 1] = style.low + Math.random() * (style.high - style.low);
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * extent;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry, phases };
  }, [style, extent]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const material = points.material as THREE.PointsMaterial;
    material.opacity += ((on ? style.opacity : 0) - material.opacity) * Math.min(1, delta * 1.5);
    points.visible = material.opacity > 0.01;
    if (!points.visible) return;
    const step = Math.min(delta, 0.05);
    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < style.count; i++) {
      let x = positions[i * 3] + (style.wind + Math.sin(clock.elapsedTime + phases[i]) * style.sway) * step;
      let y = positions[i * 3 + 1] - style.fall * step;
      const z = positions[i * 3 + 2] + Math.cos(clock.elapsedTime * 0.7 + phases[i]) * style.sway * step;
      if (x > extent) x -= extent * 2;
      if (y < style.low) y = style.high;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={pointsRef} geometry={geometry} renderOrder={6}>
      <pointsMaterial map={getPuffTexture() ?? undefined} color={style.color} size={style.size} transparent opacity={0} depthWrite={false} sizeAttenuation />
    </points>
  );
};

export const WeatherEffects: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const weather = gameState.settings?.weather;
  const gridSize = gameState.settings?.gridSize ?? 5;
  const fogCentres = useMemo(
    () => getFogBankCentres(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the banks only move when the round changes
    [weather, gameState.turnNumber, gameState.battleSeed, gameState.hexGrid.length]
  );
  if (!weather) return null;
  const raging = activeWeather(gameState) === weather;
  return (
    <group>
      {fogCentres.map((centre, i) => {
        const [x, , z] = axialToWorld(centre);
        return <FogBank key={i} seed={i * 2.3} target={new THREE.Vector3(x, FOG_HEIGHT, z)} />;
      })}
      {STORMS[weather] && <Storm kind={weather} on={raging} extent={gridSize * 2 + 3} />}
    </group>
  );
};

// A haze over the whole screen while a storm rages (and a faint smoky one under ash), fading in and out
export const WeatherVeil: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const weather = gameState.settings?.weather;
  if (!weather || weather === 'fogBanks') return null;
  const on = activeWeather(gameState) === weather;
  return <div aria-hidden className={`weather-veil weather-veil-${weather} pointer-events-none fixed inset-0 z-[5] transition-opacity duration-1000 ${on ? 'opacity-100' : 'opacity-0'}`} />;
};
