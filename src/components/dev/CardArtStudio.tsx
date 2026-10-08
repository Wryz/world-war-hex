'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Hex, Unit } from '@/types/game';
import { TROOPS, TroopId, cardStats } from '@/lib/game/troops';
import { UnitMesh } from '../game/UnitMesh';
import { HexTile } from '../game/HexTile';
import { getHexSurfaceHeight } from '../game/utils/boardGeometry';
import { CARD_ART_HEIGHT, CARD_ART_WIDTH, FACTION_BACKDROPS, backdropCss } from '../game/cards/cardArt';

const noop = () => {};
// Where the camera looks from: in front, a little to the right and above
const VIEW_DIRECTION = new THREE.Vector3(0.45, 0.42, 1).normalize();
const FOV = 30;
// Frames to wait once the troop's model has loaded before framing it, and after framing before the
// page says it is ready to be photographed
const STABLE_FRAMES = 20;
const SETTLE_FRAMES = 30;

// The box around everything visible in a group, skinned meshes as they are posed right now
const visibleBox = (root: THREE.Object3D): THREE.Box3 => {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverseVisible(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const skinned = mesh as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      skinned.skeleton.update();
      skinned.computeBoundingBox();
      box.union(skinned.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
      return;
    }
    box.expandByObject(mesh, true);
  });
  return box;
};

// How much of the picture the troop should fill, and where its middle should sit (from the top)
const FILL_HEIGHT = 0.74;
const FILL_WIDTH = 0.82;
const CENTRE_FROM_TOP = 0.46;
// Rounds of measuring the rendered troop and re-aiming the camera
const MEASURE_ROUNDS = 3;
const FRAMES_PER_ROUND = 4;

// The troop's outline in the last rendered frame, as shares of the picture (null if nothing is drawn)
const measureDrawn = (gl: THREE.WebGLRenderer) => {
  const context = gl.getContext();
  const { drawingBufferWidth: width, drawingBufferHeight: height } = context;
  const pixels = new Uint8Array(width * height * 4);
  context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  // readPixels counts rows from the bottom
  return {
    width: (maxX - minX + 1) / width,
    height: (maxY - minY + 1) / height,
    centreX: (minX + maxX + 1) / 2 / width,
    centreFromTop: 1 - (minY + maxY + 1) / 2 / height
  };
};

// Once the troop's model has loaded: aim the camera at it from its bounding box, then (with the
// ground hidden) measure what is actually drawn and zoom and re-centre until it fills the picture.
// Then bring the ground back and flag the page ready.
const FrameTroop: React.FC<{ target: React.RefObject<THREE.Group | null>; ground: React.RefObject<THREE.Group | null> }> = ({ target, ground }) => {
  const { camera, size, gl } = useThree();
  const state = useRef({ stable: 0, aimed: false, round: 0, frames: 0, done: false, settled: 0, distance: 0, focus: new THREE.Vector3() });
  useFrame(() => {
    const s = state.current;
    if (!target.current || !ground.current) return;
    const vertical = THREE.MathUtils.degToRad(FOV) / 2;
    const place = () => {
      camera.position.copy(s.focus).addScaledVector(VIEW_DIRECTION, s.distance);
      camera.lookAt(s.focus);
      camera.updateMatrixWorld();
    };

    if (s.done) {
      if (++s.settled === SETTLE_FRAMES) document.body.dataset.ready = '1';
      return;
    }

    if (!s.aimed) {
      // Wait for the real model: while it loads, the troop is a plain capsule
      let loading = false;
      target.current.traverseVisible(object => {
        if ((object as THREE.Mesh).geometry?.type === 'CapsuleGeometry') loading = true;
      });
      const box = visibleBox(target.current);
      // Animated troops never hold perfectly still, so give the model a moment once it has loaded
      if (loading || box.isEmpty() || ++s.stable < STABLE_FRAMES) return;
      const dimensions = box.getSize(new THREE.Vector3());
      const horizontal = Math.atan(Math.tan(vertical) * (size.width / size.height));
      s.focus.copy(box.getCenter(new THREE.Vector3()));
      s.distance = Math.max(dimensions.y / 2 / Math.tan(vertical), Math.max(dimensions.x, dimensions.z) / 2 / Math.tan(horizontal)) * 1.4;
      ground.current.visible = false;
      place();
      s.aimed = true;
      return;
    }

    // Measure the frame drawn since the last change, then zoom and re-centre
    if (++s.frames < FRAMES_PER_ROUND) return;
    s.frames = 0;
    const drawn = measureDrawn(gl);
    if (drawn) {
      const viewHeight = 2 * s.distance * Math.tan(vertical);
      const viewWidth = viewHeight * (size.width / size.height);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      s.focus.addScaledVector(right, (drawn.centreX - 0.5) * viewWidth);
      s.focus.addScaledVector(up, (CENTRE_FROM_TOP - drawn.centreFromTop) * viewHeight);
      s.distance *= Math.max(drawn.height / FILL_HEIGHT, drawn.width / FILL_WIDTH);
      place();
    }
    if (++s.round >= MEASURE_ROUNDS) {
      ground.current.visible = true;
      s.done = true;
    }
  });
  return null;
};

// One troop on its faction's home ground, in front of its faction's backdrop, at the card picture's size
const CardArtStudio: React.FC<{ type: TroopId }> = ({ type }) => {
  const troop = TROOPS[type];
  const owner = troop.faction === 'kingdom' ? 'player' : 'ai';
  const pedestal = useMemo<Hex>(() => ({ id: 'pedestal', coordinates: { q: 0, r: 0 }, terrain: FACTION_BACKDROPS[troop.faction].terrain }), [troop.faction]);
  const surface = getHexSurfaceHeight(pedestal);
  const unit = useMemo<Unit>(() => {
    const stats = cardStats(type, 1);
    return {
      id: `card-art-${type}`, type, owner, position: { q: 0, r: 0 }, movementRange: stats.movementRange,
      attackPower: stats.attackPower, lifespan: stats.maxLifespan, maxLifespan: stats.maxLifespan, cost: stats.cost,
      abilities: stats.abilities, hasMoved: false, isEngagedInCombat: false
    };
  }, [type, owner]);
  const troopRef = useRef<THREE.Group>(null);
  const groundRef = useRef<THREE.Group>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-800">
      <div
        id="card-art"
        style={{ width: CARD_ART_WIDTH, height: CARD_ART_HEIGHT, background: backdropCss(troop.faction) }}
      >
        <Canvas shadows flat gl={{ preserveDrawingBuffer: true, alpha: true }} camera={{ position: [0, 3, 6], fov: FOV }}>
          <hemisphereLight args={['#ffffff', '#9ccfe8', 1.7]} />
          <directionalLight position={[3, 7, 6]} intensity={1.6} castShadow />
          <group position={[0, -surface, 0]}>
            <group ref={groundRef}>
              <HexTile hex={pedestal} onHexClick={noop} onHexHover={noop} onHexHoverEnd={noop} />
            </group>
            <group ref={troopRef}>
              <UnitMesh unit={unit} position={[0, surface, 0]} facingTarget={[2.2, 2.6]} battle={null} decorative hideRing />
            </group>
          </group>
          <FrameTroop target={troopRef} ground={groundRef} />
        </Canvas>
      </div>
    </div>
  );
};

export default CardArtStudio;
