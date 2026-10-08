import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlayerType, Unit } from '@/types/game';
import { TroopId, cardStats } from '@/lib/game/troops';
import { UnitMesh } from '../game/UnitMesh';
import { HexTile } from '../game/HexTile';
import { getHexSurfaceHeight } from '../game/utils/boardGeometry';
import { SKY_COLOR } from '@/components/menu/MenuShell';

const noop = () => {};
const PEDESTAL = { id: 'viewer', coordinates: { q: 0, r: 0 }, terrain: 'plain' as const };
const SURFACE = getHexSurfaceHeight(PEDESTAL);

// Slowly turns the troop on its pedestal
const Turntable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += Math.min(delta, 0.1) * 0.5;
  });
  return <group ref={ref}>{children}</group>;
};

// A troop's 3D model on a hex pedestal, for the bestiary; it can show off its attack
export const TroopModelViewer: React.FC<{ type: TroopId; owner: PlayerType }> = ({ type, owner }) => {
  const [attacking, setAttacking] = useState(false);
  const unit = useMemo<Unit>(() => {
    const stats = cardStats(type, 1);
    return {
      id: `viewer-${type}`, type, owner, position: { q: 0, r: 0 }, movementRange: stats.movementRange,
      attackPower: stats.attackPower, lifespan: stats.maxLifespan, maxLifespan: stats.maxLifespan, cost: stats.cost,
      abilities: stats.abilities, hasMoved: false, isEngagedInCombat: false
    };
  }, [type, owner]);
  const battle = useMemo(() => (attacking ? { key: `viewer-${type}`, target: [0, SURFACE, 1.6] as [number, number, number] } : null), [attacking, type]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl" style={{ background: SKY_COLOR }}>
      <Canvas shadows flat dpr={[1, 1.5]} camera={{ position: [0, 3.2, 4.2], fov: 38 }}>
        <hemisphereLight args={['#ffffff', '#9ccfe8', 1.6]} />
        <directionalLight position={[4, 8, 5]} intensity={1.5} castShadow />
        <group position={[0, -SURFACE - 0.1, 0]}>
          <Turntable>
            <HexTile hex={PEDESTAL} onHexClick={noop} onHexHover={noop} onHexHoverEnd={noop} />
            <UnitMesh unit={unit} position={[0, SURFACE, 0]} facingTarget={[0, 2]} battle={battle} decorative />
          </Turntable>
        </group>
      </Canvas>
      <button
        type="button"
        onClick={() => setAttacking(value => !value)}
        className="font-display absolute bottom-2 right-2 rounded-lg bg-slate-900/80 px-3 py-1 text-sm text-slate-100 hover:bg-slate-800"
      >
        {attacking ? 'Rest' : 'Attack!'}
      </button>
    </div>
  );
};

export default TroopModelViewer;
