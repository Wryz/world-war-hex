import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Hex, HexCoordinates, Unit } from '@/types/game';
import { isBackLine, isFrontLine } from '@/lib/game/formations';
import { getHexDistance } from '@/lib/game/hexUtils';
import { axialToWorld, getHexSurfaceHeight } from './utils/boardGeometry';

// Your formations drawn on the ground: a gold bar between a front-line troop and the archer or mage
// it screens, a steel-blue bar between front-line troops standing in a shield wall

const key = (c: HexCoordinates) => `${c.q},${c.r}`;
const SCREEN_COLOR = '#fbbf24';
const WALL_COLOR = '#93c5fd';

const Link: React.FC<{ from: THREE.Vector3; to: THREE.Vector3; color: string }> = ({ from, to, color }) => {
  const { position, rotation, length } = useMemo(() => {
    const middle = from.clone().add(to).multiplyScalar(0.5);
    const direction = to.clone().sub(from);
    return { position: middle, rotation: Math.atan2(direction.x, direction.z), length: direction.length() * 0.45 };
  }, [from, to]);
  return (
    <mesh position={[position.x, position.y + 0.08, position.z]} rotation={[-Math.PI / 2, 0, rotation]} renderOrder={2}>
      <planeGeometry args={[0.16, length]} />
      <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

export const FormationLinks: React.FC<{ units: Unit[]; hexByKey: Map<string, Hex> }> = ({ units, hexByKey }) => {
  const links = useMemo(() => {
    const at = (c: HexCoordinates) => {
      const [x, , z] = axialToWorld(c);
      const hex = hexByKey.get(key(c));
      return new THREE.Vector3(x, hex ? getHexSurfaceHeight(hex) : 1, z);
    };
    const found: { id: string; from: THREE.Vector3; to: THREE.Vector3; color: string }[] = [];
    units.forEach((a, i) => units.slice(i + 1).forEach(b => {
      if (getHexDistance(a.position, b.position) !== 1) return;
      const screen = (isFrontLine(a) && isBackLine(b)) || (isBackLine(a) && isFrontLine(b));
      const wall = isFrontLine(a) && isFrontLine(b);
      if (screen || wall) found.push({ id: `${a.id}-${b.id}`, from: at(a.position), to: at(b.position), color: screen ? SCREEN_COLOR : WALL_COLOR });
    }));
    return found;
  }, [units, hexByKey]);
  return <group>{links.map(link => <Link key={link.id} from={link.from} to={link.to} color={link.color} />)}</group>;
};
