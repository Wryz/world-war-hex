import { memo, useRef, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Hex, TerrainType } from '@/types/game';
import * as THREE from 'three';
import { playSound } from './utils/SoundPlayer';
import {
  HEX_SIZE,
  BEVEL_THICKNESS,
  axialToWorld,
  getHexHeight,
  getHexSurfaceHeight
} from './utils/boardGeometry';

// Bright low-poly palette for each terrain type
const TERRAIN_COLORS: Record<TerrainType, string> = {
  plain: '#9be15d',
  mountain: '#b8c4cc',
  forest: '#5cc45a',
  water: '#48c6ef',
  desert: '#ffd97a',
  resource: '#ffc94d'
};

// Tiles are drawn slightly smaller than their cell so thin gaps outline every hex
const TILE_SCALE = 0.92;

// Pointer movement (px) between press and release beyond which a click is treated as a camera drag
export const DRAG_CLICK_TOLERANCE = 5;

// What kind of highlight a tile shows
export type HexHighlight = 'none' | 'move' | 'deploy' | 'base';

const HIGHLIGHT_COLORS: Record<Exclude<HexHighlight, 'none'>, string> = {
  move: '#ffffff',
  deploy: '#7dd3fc',
  base: '#86efac'
};

interface HexTileProps {
  hex: Hex;
  highlight?: HexHighlight;
  isSelected?: boolean;
  // Selected but not a legal choice (e.g. an invalid castle location)
  isInvalidSelection?: boolean;
  isHovered?: boolean;
  onHexClick: (hex: Hex) => void;
  onHexDoubleClick?: (hex: Hex) => void;
  onHexHover: (hex: Hex) => void;
  onHexHoverEnd: (hex: Hex) => void;
}

const createHexShape = (size: number) => {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Pointy-top hexagon
    const angle = (Math.PI / 3) * i + Math.PI / 2;
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
};

// Outline ring geometry shared by every tile
const ringGeometry = (() => {
  const outer = createHexShape(HEX_SIZE * 0.92);
  outer.holes.push(createHexShape(HEX_SIZE * 0.76));
  const geometry = new THREE.ShapeGeometry(outer);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
})();

const HexTileComponent: React.FC<HexTileProps> = ({
  hex,
  highlight = 'none',
  isSelected = false,
  isInvalidSelection = false,
  isHovered = false,
  onHexClick,
  onHexDoubleClick,
  onHexHover,
  onHexHoverEnd
}) => {
  const liftRef = useRef<THREE.Group>(null);
  const selectionRingRef = useRef<THREE.Mesh>(null);

  const hexHeight = getHexHeight(hex);
  const surfaceHeight = getHexSurfaceHeight(hex);
  const [x, , z] = axialToWorld(hex.coordinates);

  // Extruded hexagon with bottom at y=0
  const geometry = useMemo(() => {
    const hexGeometry = new THREE.ExtrudeGeometry(createHexShape(HEX_SIZE * TILE_SCALE), {
      steps: 1,
      depth: hexHeight,
      bevelEnabled: true,
      bevelThickness: BEVEL_THICKNESS,
      bevelSize: BEVEL_THICKNESS,
      bevelOffset: 0,
      bevelSegments: 2
    });
    hexGeometry.rotateX(-Math.PI / 2);
    hexGeometry.translate(0, BEVEL_THICKNESS, 0);
    return hexGeometry;
  }, [hexHeight]);

  const color = useMemo(() => {
    const base = new THREE.Color(TERRAIN_COLORS[hex.terrain]);
    if (isHovered) return base.offsetHSL(0, 0.05, 0.12);
    if (highlight !== 'none') return base.offsetHSL(0, 0.05, 0.08);
    return base;
  }, [hex.terrain, isHovered, highlight]);

  const sideColor = useMemo(
    () => new THREE.Color(TERRAIN_COLORS[hex.terrain]).offsetHSL(0, -0.05, -0.18),
    [hex.terrain]
  );

  useFrame((state) => {
    // Gently raise highlighted and hovered tiles
    if (liftRef.current) {
      const targetY = isHovered ? 0.06 : highlight !== 'none' ? 0.03 : 0;
      liftRef.current.position.y = THREE.MathUtils.lerp(liftRef.current.position.y, targetY, 0.2);
    }

    if (selectionRingRef.current) {
      const time = state.clock.getElapsedTime();
      selectionRingRef.current.position.y = surfaceHeight + 0.04 + Math.sin(time * 3) * 0.03;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // Only the tile nearest the camera should react
    e.stopPropagation();
    // A press that moved is a camera drag, not a click
    if (e.delta > DRAG_CLICK_TOLERANCE) return;
    playSound('hex-select-sound', 0.2);
    onHexClick(hex);
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > DRAG_CLICK_TOLERANCE) return;
    onHexDoubleClick?.(hex);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    playSound('hex-hover-sound', 0.05);
    onHexHover(hex);
  };

  const handlePointerOut = () => onHexHoverEnd(hex);

  const isWater = hex.terrain === 'water';
  const highlightColor = highlight !== 'none' ? HIGHLIGHT_COLORS[highlight] : null;
  const selectionColor = isInvalidSelection ? '#ef4444' : '#facc15';

  return (
    <group position={[x, 0, z]}>
      <group ref={liftRef}>
        <mesh
          geometry={geometry}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          receiveShadow
        >
          {/* Top face */}
          <meshStandardMaterial
            attach="material-0"
            color={color}
            roughness={isWater ? 0.4 : 1}
            metalness={0}
            flatShading
          />
          {/* Side faces */}
          <meshStandardMaterial
            attach="material-1"
            color={sideColor}
            roughness={1}
            metalness={0}
            flatShading
          />
        </mesh>

        {/* Highlight outline for tiles that can be chosen */}
        {highlightColor && (
          <mesh geometry={ringGeometry} position={[0, surfaceHeight + 0.02, 0]} renderOrder={2}>
            <meshBasicMaterial color={highlightColor} transparent opacity={0.85} depthWrite={false} />
          </mesh>
        )}
      </group>

      {/* Selection outline */}
      {isSelected && (
        <mesh ref={selectionRingRef} geometry={ringGeometry} position={[0, surfaceHeight + 0.04, 0]} scale={1.08} renderOrder={3}>
          <meshBasicMaterial color={selectionColor} transparent opacity={0.95} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

// Memoised so hovering one tile doesn't re-render the whole board
export const HexTile = memo(HexTileComponent);
