import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CastleStyle } from '@/lib/meta/cosmetics';
import { Castle } from '../game/Castle';
import { HexTile } from '../game/HexTile';
import { getHexSurfaceHeight } from '../game/utils/boardGeometry';
import { SKY_COLOR } from '@/components/menu/MenuShell';

const noop = () => {};
const PEDESTAL = { id: 'castle-preview', coordinates: { q: 0, r: 0 }, terrain: 'plain' as const };
const SURFACE = getHexSurfaceHeight(PEDESTAL);

const Turntable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += Math.min(delta, 0.1) * 0.4;
  });
  return <group ref={ref}>{children}</group>;
};

// Your castle in a style, slowly turning on its hex
export const CastlePreview: React.FC<{ look: CastleStyle }> = ({ look }) => (
  <div className="relative h-56 w-full overflow-hidden rounded-xl" style={{ background: SKY_COLOR }}>
    <Canvas shadows flat dpr={[1, 1.5]} camera={{ position: [0, 2.6, 3.4], fov: 40 }}>
      <hemisphereLight args={['#ffffff', '#9ccfe8', 1.6]} />
      <directionalLight position={[4, 8, 5]} intensity={1.5} castShadow />
      <group position={[0, -SURFACE - 0.6, 0]}>
        <Turntable>
          <HexTile hex={PEDESTAL} onHexClick={noop} onHexHover={noop} onHexHoverEnd={noop} />
          <Castle owner="player" look={look} position={[0, SURFACE, 0]} health={1} maxHealth={1} hideLabel />
        </Turntable>
      </group>
    </Canvas>
  </div>
);

export default CastlePreview;
