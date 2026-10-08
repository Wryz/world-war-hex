import { memo, useState, useCallback, useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GameState, Hex, HexCoordinates, PlayerType, Unit, UnitType } from '@/types/game';
import { HexTile, HexHighlight } from './HexTile';
import { UnitMesh, UnitBattle, OWNER_COLORS, DEATH_DURATION } from './UnitMesh';
import { Castle } from './Castle';
import { Camp } from './Camp';
import { BoardDecorations } from './BoardDecorations';
import { MovePath } from './MovePath';
import {
  DEFAULT_SETTINGS,
  BASE_MAX_HEALTH,
  TERRAIN_EFFECTS,
  getKillBounty,
  getRosterStats,
  findBaseHex,
  findTerrainPath,
  getActivePlayer,
  canStrike,
  getCombatPreview,
  getVisibleHexKeys,
  getRememberedEnemies,
  isFogOfWar,
  getMovePath,
  getValidBaseLocations,
  HIGH_GROUND_ELEVATION
} from '@/lib/game/gameState';
import { getHexDistance } from '@/lib/game/hexUtils';
import { estimateDamage, getThreatLevels, getThreats } from '@/lib/game/threats';
import { HEX_SIZE, axialToWorld, getHexSurfaceHeight } from './utils/boardGeometry';
import { useLoadingManager } from './utils/LoadingManager';
import { AnimatedUnitPreview } from './AnimatedUnitPreview';
import { playSound } from './utils/SoundPlayer';
import { playBattleSound } from './utils/battleSounds';
import { getCastleStyle } from '@/lib/meta/cosmetics';
import { useProfile } from '@/lib/meta/profile';
import { getBattleStartDelay, getDeathTime, getImpactTimesUntil } from './utils/battleTiming';
import { getUnitTypeName } from './utils/UnitHelpers';
import { emitCoins, projectToScreen, setProjector, takeShake, getTimeScale, getGameSpeed } from './effects/effects';
import { TERRAIN_SHORT_EFFECTS } from './hud/terrainInfo';
import { AttackIcon, CampIcon, GoldIcon, HealthIcon, SkullIcon, TerrainIcon, UnitIcon } from './icons';
import type { UnitBadge } from './UnitMesh';

const coordKey = (c: HexCoordinates) => `${c.q},${c.r}`;

// Camera framing: a fixed, almost top-down view from behind the active side's castle
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(68);
const CAMERA_FOV = 45;
// How much of the board's radius the camera frames, beyond the outermost hexes, at zoom 1
const BOARD_VIEW_MARGIN = 1.11;
// In the default view the near edge of the board (behind the viewing side's castle) sits this many
// pixels above the bottom of the screen: just clear of the card hand once the battle has started
const BOARD_NEAR_EDGE_MARGIN_SETUP = 28;
const BOARD_NEAR_EDGE_MARGIN_BATTLE = 170;
// Room left above the board's far edge for the top HUD when the whole board fits on screen
const BOARD_FAR_EDGE_MARGIN = 90;
const CAMERA_TURN_SPEED = 2.2;
// Zoom levels as a fraction of the distance at which the whole board fits on screen
const CAMERA_DEFAULT_ZOOM = 0.8;
const CAMERA_MIN_ZOOM = 0.35;
const CAMERA_MAX_ZOOM = 1.1;
// How quickly the camera follows zoom and turn changes, and how strongly the wheel zooms
const CAMERA_ZOOM_SPEED = 6;
const CAMERA_WHEEL_SPEED = 0.0015;
// Dragging: pixels before a press counts as a drag, rotation and tilt per pixel, and tilt limits
const CAMERA_DRAG_THRESHOLD = 5;
const CAMERA_DRAG_ROTATE_SPEED = 0.008;
const CAMERA_DRAG_TILT_SPEED = 0.004;
const CAMERA_MIN_ELEVATION = THREE.MathUtils.degToRad(45);
const CAMERA_MAX_ELEVATION = THREE.MathUtils.degToRad(85);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
// Furthest the view can be panned from the centre of the board (fraction of the framed radius)
const CAMERA_MAX_PAN = 0.73;
// Looking down on a turn's battles: the tilt, how much room is left around them, the closest and
// furthest zoom, and how long the view holds after they end before settling back on a side
const BATTLE_VIEW_ELEVATION = THREE.MathUtils.degToRad(82);
const BATTLE_VIEW_MARGIN = 1.35;
const BATTLE_VIEW_MIN_ZOOM = 0.5;
const BATTLE_VIEW_MAX_ZOOM = 0.95;
const BATTLE_VIEW_HOLD_MS = 600;

// Sun position; the shadow camera looks from here towards the board centre
const SHADOW_LIGHT_POSITION: [number, number, number] = [12, 30, 18];
const SHADOW_LIGHT_DISTANCE = Math.hypot(...SHADOW_LIGHT_POSITION);

interface GameBoardProps {
  gameState: GameState;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (unit: Unit) => void;
  onUnitPurchase: (unitType: UnitType, hex: Hex) => boolean;
  selectedHex?: Hex;
  selectedUnit?: Unit | null;
  validMoves?: HexCoordinates[];
  selectedUnitTypeForPurchase?: UnitType | null;
  // Every unit really on the board (the state shown may leave out enemies hidden in the fog)
  unitIds?: Set<string>;
  // Tint the hexes enemies can strike next turn, and label damage for the selected troop
  showThreats?: boolean;
}

const GameBoardComponent: React.FC<GameBoardProps> = (props) => {
  // Use loading state from the parent provider
  const { isComplete: assetsLoaded } = useLoadingManager();


  return (
    // Bright sky gradient behind the floating battlefield
    <div className="w-full h-full" style={{ background: 'radial-gradient(ellipse at 50% 40%, #e0f4ff 0%, #b3e1ff 55%, #8ccfff 100%)' }}>
      {/* Flat (no tone mapping) keeps the low-poly colours bright and true; cap the pixel ratio for smoothness */}
      <Canvas shadows flat dpr={[1, 1.5]}>
        <Suspense fallback={null}>

          <BoardScene {...props} assetsLoaded={assetsLoaded} />

          <PerspectiveCamera makeDefault fov={CAMERA_FOV} near={0.1} far={3000} position={[0, 35, 14]} />
          <CameraRig
            gameState={props.gameState}
            focus={props.selectedUnit?.position ?? (props.selectedHex && (props.selectedHex.isCamp || props.selectedHex.isBase) ? props.selectedHex.coordinates : null)}
            deployingCard={props.selectedUnitTypeForPurchase}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

// Memoised so HUD updates (like the turn timer) don't re-render the 3D scene
export const GameBoard = memo(GameBoardComponent);

// Camera distance at which a circle of `radius` fits the screen, scaled by the zoom level
const getViewDistance = (radius: number, tanHalfFov: number, aspect: number, zoom: number) =>
  Math.max(radius / tanHalfFov, radius / (tanHalfFov * aspect)) * zoom;

// Smallest signed difference between two angles
const angleDelta = (from: number, to: number) => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

// Camera that looks down on the board from behind the castle of the side whose turn it is,
// swinging smoothly around the board when the turn changes. Players can drag to orbit/tilt and scroll to zoom.
// Selections this close to the middle of the board (as a share of its radius) don't move the camera
const CAMERA_FOCUS_MIN_RADIUS = 0.35;

// The camera views the board from one of four sides: behind the active castle (side 0), or a quarter,
// half or three-quarter turn around the board, each framed the same way. Selecting something on
// another side of the board swings the camera round to the side nearest it.
// Which of the four camera sides (quarter turns from the castle side at `castleAzimuth`) an
// azimuth is nearest
const nearestSide = (azimuth: number, castleAzimuth: number) => {
  let best = 0;
  for (let side = 1; side < 4; side++) {
    if (Math.abs(angleDelta(azimuth, castleAzimuth + side * Math.PI / 2)) < Math.abs(angleDelta(azimuth, castleAzimuth + best * Math.PI / 2))) best = side;
  }
  return best;
};

const CameraRig: React.FC<{ gameState: GameState; focus: HexCoordinates | null; deployingCard?: UnitType | null }> = ({ gameState, focus, deployingCard }) => {
  const { camera, size, gl } = useThree();

  // Let the HUD place things (flying coins) over points on the board
  useEffect(() => {
    const vector = new THREE.Vector3();
    setProjector(([x, y, z]) => {
      vector.set(x, y, z).project(camera);
      if (vector.z > 1) return null;
      const rect = gl.domElement.getBoundingClientRect();
      return { x: rect.left + (vector.x + 1) / 2 * rect.width, y: rect.top + (1 - vector.y) / 2 * rect.height };
    });
    return () => setProjector(null);
  }, [camera, gl]);
  const azimuthRef = useRef<number | null>(null);

  // Where the camera looks and how far it is pulled back (1 = whole board fits); smoothed every frame
  const lookAtRef = useRef<THREE.Vector3 | null>(null);
  const zoomRef = useRef(CAMERA_DEFAULT_ZOOM);
  // Where the player (or a turn change) wants the camera to go
  const desiredLookAtRef = useRef<THREE.Vector3 | null>(null);
  const desiredZoomRef = useRef(CAMERA_DEFAULT_ZOOM);
  // Extra rotation around the centre of the map and camera tilt chosen by the player
  const azimuthOffsetRef = useRef(0);
  const elevationRef = useRef(CAMERA_ELEVATION);
  const desiredElevationRef = useRef(CAMERA_ELEVATION);

  const viewSide: PlayerType = gameState.currentPhase === 'setup' ? 'player' : getActivePlayer(gameState);

  // Radius (world units) the camera frames at zoom 1: the board out to its edge hexes plus a margin
  const gridSize = gameState.settings?.gridSize ?? DEFAULT_SETTINGS.gridSize;
  const viewRadius = (gridSize * Math.sqrt(3) + HEX_SIZE) * BOARD_VIEW_MARGIN;
  const viewRadiusRef = useRef(viewRadius);
  viewRadiusRef.current = viewRadius;

  // Camera sits on the viewing side's castle side of the board, looking across it.
  // Also returns how far the board's near edge (behind that castle) is from the centre.
  const { targetAzimuth, nearEdgeDistance } = useMemo(() => {
    const base = findBaseHex(gameState, viewSide);
    // Before castles are placed, look from the south edge
    if (!base) return { targetAzimuth: 0, nearEdgeDistance: gridSize * 1.5 + HEX_SIZE };
    const [x, , z] = axialToWorld(base.coordinates);
    return { targetAzimuth: Math.atan2(x, z), nearEdgeDistance: Math.hypot(x, z) + HEX_SIZE };
    // Only depends on where the bases are, not on the rest of the state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players.player.baseLocation, gameState.players.ai.baseLocation, viewSide, gridSize]);

  const sizeRef = useRef(size);
  sizeRef.current = size;
  const nearEdgeMargin = gameState.currentPhase === 'setup' ? BOARD_NEAR_EDGE_MARGIN_SETUP : BOARD_NEAR_EDGE_MARGIN_BATTLE;

  // Default overview: aim the camera so the near edge of the board lands just above the bottom HUD,
  // whatever the shape of the screen, leaving as much room as possible for the rest of the board.
  // On tall screens where the whole board fits, centre it between the top and bottom HUD instead.
  const getDefaultLookAt = useCallback(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const { width, height } = sizeRef.current;
    const aspect = width / Math.max(height, 1);
    const distance = getViewDistance(viewRadius, tanHalfFov, aspect, CAMERA_DEFAULT_ZOOM);
    const sin = Math.sin(CAMERA_ELEVATION);
    const cos = Math.cos(CAMERA_ELEVATION);
    // How far in front of the look-at point (towards the camera) a ground point appears at a given
    // screen height, in normalised device coordinates (-1 is the bottom of the screen, 1 the top)
    const groundDistanceAt = (screenY: number) =>
      screenY * tanHalfFov * distance / (screenY * tanHalfFov * cos - sin);
    const bottomY = Math.min(0, -1 + (2 * nearEdgeMargin) / Math.max(height, 1));
    const topY = Math.max(0, 1 - (2 * BOARD_FAR_EDGE_MARGIN) / Math.max(height, 1));
    // Offsets that put the near edge at the bottom target, or the far edge at the top target
    const nearPinned = nearEdgeDistance - groundDistanceAt(bottomY);
    const farPinned = -groundDistanceAt(topY) - nearEdgeDistance;
    // Looking at a point nearer the camera moves the board up the screen, so if pinning the far edge
    // needs a nearer look-at point than pinning the near edge, the whole board fits: centre it
    const offset = farPinned > nearPinned ? (nearPinned + farPinned) / 2 : nearPinned;
    return new THREE.Vector3(Math.sin(targetAzimuth) * offset, 0, Math.cos(targetAzimuth) * offset);
  }, [camera, viewRadius, nearEdgeDistance, targetAzimuth, nearEdgeMargin]);
  const defaultLookAt = useMemo(() => getDefaultLookAt(), [getDefaultLookAt]);

  // The default view, from one of the four sides of the board
  const showSide = useCallback((side: number) => {
    const turn = side * Math.PI / 2;
    desiredLookAtRef.current = defaultLookAt.clone().applyAxisAngle(Y_AXIS, turn);
    desiredZoomRef.current = CAMERA_DEFAULT_ZOOM;
    azimuthOffsetRef.current = turn;
    desiredElevationRef.current = CAMERA_ELEVATION;
  }, [defaultLookAt]);

  // Set while the camera is looking down on a turn's battles (until it settles back on a side)
  const battleViewRef = useRef(false);

  // New turn (or castles placed): swing to the active side's default view, unless the turn's
  // battles are still being watched from above (the camera settles from there instead)
  useEffect(() => {
    if (!battleViewRef.current) showSide(0);
  }, [showSide]);

  // Which of the four sides a point on the board is nearest, or null for points near the middle
  // (they're in view from every side)
  const sideOf = useCallback((coordinates: HexCoordinates): number | null => {
    const [x, , z] = axialToWorld(coordinates);
    if (Math.hypot(x, z) < viewRadiusRef.current * CAMERA_FOCUS_MIN_RADIUS) return null;
    return nearestSide(Math.atan2(x, z), targetAzimuth);
  }, [targetAzimuth]);
  const currentSide = () => nearestSide(targetAzimuth + azimuthOffsetRef.current, targetAzimuth);

  // A selection on another side of the board: swing round to the side nearest it
  const focusKey = focus ? `${focus.q},${focus.r}` : null;
  useEffect(() => {
    if (!focus || gameState.currentPhase !== 'planning') return;
    const side = sideOf(focus);
    if (side !== null && side !== currentSide()) showSide(side);
    // Only reacts to a new selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Picking a card to play: stay on this side if it shows the castle or a camp of ours to deploy
  // at, otherwise swing to the nearest side that does
  useEffect(() => {
    if (!deployingCard || gameState.currentPhase !== 'planning') return;
    const spots = gameState.hexGrid.filter(hex => hex.owner === viewSide && (hex.isBase || hex.isCamp));
    const sides = spots.map(hex => sideOf(hex.coordinates));
    // A spot near the middle is in view whichever side the camera is on
    if (sides.includes(null)) return;
    const from = currentSide();
    if (sides.includes(from)) return;
    // Fewest quarter turns away (the castle's own side first on a tie)
    const steps = (side: number) => Math.min((side - from + 4) % 4, (from - side + 4) % 4);
    const best = (sides as number[]).reduce((a, b) => (steps(b) < steps(a) || (steps(b) === steps(a) && b === 0) ? b : a));
    showSide(best);
    // Only reacts to picking a card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployingCard]);

  // Battles about to be fought: rise to a view from above that takes in every fight (and any castle
  // under attack), then once they're over settle on whichever side the camera is nearest
  const targetAzimuthRef = useRef(targetAzimuth);
  targetAzimuthRef.current = targetAzimuth;
  const battleKey = gameState.currentPhase === 'combat' ? `${gameState.turnNumber}-${viewSide}` : null;
  const isGameOver = gameState.currentPhase === 'gameOver';
  useEffect(() => {
    if (battleKey) {
      const points = gameState.combats.flatMap(combat => [combat.hexCoordinates, ...combat.attackers.map(unit => unit.position)]);
      if (gameState.siege) {
        const castle = findBaseHex(gameState, gameState.siege.side === 'player' ? 'ai' : 'player');
        if (castle) points.push(castle.coordinates);
        for (const id of gameState.siege.attackerIds) {
          const unit = gameState.players[gameState.siege.side].units.find(candidate => candidate.id === id);
          if (unit) points.push(unit.position);
        }
      }
      if (points.length === 0) return;
      const world = points.map(point => axialToWorld(point));
      const centre = new THREE.Vector3(
        world.reduce((sum, [x]) => sum + x, 0) / world.length, 0,
        world.reduce((sum, [, , z]) => sum + z, 0) / world.length
      );
      const spread = Math.max(...world.map(([x, , z]) => Math.hypot(x - centre.x, z - centre.z))) + HEX_SIZE * 1.5;
      const maxPan = viewRadiusRef.current * CAMERA_MAX_PAN;
      const horizontal = Math.hypot(centre.x, centre.z);
      if (horizontal > maxPan) centre.multiplyScalar(maxPan / horizontal);
      battleViewRef.current = true;
      desiredLookAtRef.current = centre;
      desiredZoomRef.current = THREE.MathUtils.clamp(spread * BATTLE_VIEW_MARGIN / viewRadiusRef.current, BATTLE_VIEW_MIN_ZOOM, BATTLE_VIEW_MAX_ZOOM);
      desiredElevationRef.current = BATTLE_VIEW_ELEVATION;
      return;
    }
    if (!battleViewRef.current || isGameOver) {
      battleViewRef.current = false;
      return;
    }
    // Hold on the aftermath for a moment, then settle on the nearest side
    const settle = setTimeout(() => {
      battleViewRef.current = false;
      const castleAzimuth = targetAzimuthRef.current;
      showSide(nearestSide(azimuthRef.current ?? castleAzimuth, castleAzimuth));
    }, BATTLE_VIEW_HOLD_MS / getGameSpeed());
    return () => {
      clearTimeout(settle);
      battleViewRef.current = false;
    };
    // Only reacts to battles starting and ending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleKey, isGameOver]);

  // The battle is won: swoop down on the losing castle as it falls
  const loser = gameState.currentPhase === 'gameOver' && gameState.winner
    ? (gameState.winner === 'player' ? 'ai' : 'player')
    : null;
  useEffect(() => {
    if (!loser) return;
    const base = findBaseHex(gameState, loser);
    if (!base) return;
    const [x, , z] = axialToWorld(base.coordinates);
    desiredLookAtRef.current = new THREE.Vector3(x, 0, z);
    desiredZoomRef.current = CAMERA_MIN_ZOOM;
    desiredElevationRef.current = THREE.MathUtils.degToRad(52);
    // Only reacts to the battle ending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loser]);

  // Orbit around the centre of the map, carrying the current view along with the camera
  const rotateBy = useCallback((radians: number) => {
    azimuthOffsetRef.current += radians;
    desiredLookAtRef.current?.applyAxisAngle(Y_AXIS, radians);
  }, []);

  // Click and drag: left/right orbits around the centre of the map, up/down tilts the view
  useEffect(() => {
    const element = gl.domElement;
    let drag: { startX: number; startY: number; lastX: number; lastY: number; active: boolean } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      drag = { startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, active: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return;
      // Ignore tiny movements so ordinary clicks never nudge the camera
      if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < CAMERA_DRAG_THRESHOLD) return;
      drag.active = true;
      rotateBy(-(event.clientX - drag.lastX) * CAMERA_DRAG_ROTATE_SPEED);
      desiredElevationRef.current = THREE.MathUtils.clamp(
        desiredElevationRef.current + (event.clientY - drag.lastY) * CAMERA_DRAG_TILT_SPEED,
        CAMERA_MIN_ELEVATION,
        CAMERA_MAX_ELEVATION
      );
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
    };
    const onPointerUp = () => {
      drag = null;
    };

    element.addEventListener('pointerdown', onPointerDown);
    // Track the drag on the window so it keeps working when the cursor passes over the HUD
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [gl, rotateBy]);

  // Mouse wheel / trackpad pinch zooms towards whatever is under the cursor
  useEffect(() => {
    const element = gl.domElement;
    const raycaster = new THREE.Raycaster();
    // Roughly the height of an average tile surface
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.3);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const desiredLookAt = desiredLookAtRef.current;
      if (!desiredLookAt) return;

      const currentZoom = desiredZoomRef.current;
      const nextZoom = THREE.MathUtils.clamp(
        currentZoom * Math.exp(event.deltaY * CAMERA_WHEEL_SPEED),
        CAMERA_MIN_ZOOM,
        CAMERA_MAX_ZOOM
      );
      if (nextZoom === currentZoom) return;

      // Scale the view about the point under the cursor so that point stays put on screen
      const rect = element.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const anchor = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
      if (anchor) {
        desiredLookAt.sub(anchor).multiplyScalar(nextZoom / currentZoom).add(anchor);
        desiredLookAt.y = 0;
        // Keep the view over the battlefield
        const horizontal = Math.hypot(desiredLookAt.x, desiredLookAt.z);
        const maxPan = viewRadiusRef.current * CAMERA_MAX_PAN;
        if (horizontal > maxPan) desiredLookAt.multiplyScalar(maxPan / horizontal);
      }
      desiredZoomRef.current = nextZoom;
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [gl, camera]);

  // Expose the camera in development so automated browser tests can aim clicks precisely
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __wwhCamera?: THREE.Camera }).__wwhCamera = camera;
    }
  }, [camera]);

  useFrame((frame, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const ease = Math.min(1, delta * CAMERA_TURN_SPEED);
    const [shakeX, shakeY, shakeZ] = takeShake(delta, frame.clock.getElapsedTime());
    const desiredAzimuth = targetAzimuth + azimuthOffsetRef.current;
    const current = azimuthRef.current ?? desiredAzimuth;
    const azimuth = current + angleDelta(current, desiredAzimuth) * ease;
    azimuthRef.current = azimuth;

    const desiredLookAt = desiredLookAtRef.current ?? defaultLookAt;
    if (!lookAtRef.current) lookAtRef.current = desiredLookAt.clone();
    lookAtRef.current.lerp(desiredLookAt, Math.min(1, delta * CAMERA_ZOOM_SPEED));
    zoomRef.current += (desiredZoomRef.current - zoomRef.current) * Math.min(1, delta * CAMERA_ZOOM_SPEED);
    elevationRef.current += (desiredElevationRef.current - elevationRef.current) * Math.min(1, delta * CAMERA_ZOOM_SPEED);
    const elevation = elevationRef.current;

    // Distance at which the whole board fits on screen, scaled by the zoom level
    const perspective = camera as THREE.PerspectiveCamera;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const aspect = size.width / Math.max(size.height, 1);
    const distance = getViewDistance(viewRadius, tanHalfFov, aspect, zoomRef.current);

    const lookAt = lookAtRef.current;
    const horizontal = distance * Math.cos(elevation);
    camera.position.set(
      lookAt.x + Math.sin(azimuth) * horizontal + shakeX,
      distance * Math.sin(elevation) + shakeY,
      lookAt.z + Math.cos(azimuth) * horizontal + shakeZ
    );
    camera.lookAt(lookAt.x + shakeX * 0.5, lookAt.y, lookAt.z + shakeZ * 0.5);
  });

  return null;
};

interface BoardSceneProps extends GameBoardProps {
  assetsLoaded: boolean;
}

// Just above a hex's tile, for labels lying on it
const labelPosition = (hex: Hex): [number, number, number] => {
  const [x, y, z] = surfacePosition(hex);
  return [x, y + 0.15, z];
};

// World position on top of a hex's tile
const surfacePosition = (hex: Hex): [number, number, number] => {
  const [x, , z] = axialToWorld(hex.coordinates);
  return [x, getHexSurfaceHeight(hex), z];
};

const toVector = ([x, y, z]: [number, number, number]) => new THREE.Vector3(x, y, z);

// Terrain effects that currently help a unit, shown as small icons on its label
const getTerrainBadges = (unit: Unit, hex: Hex | undefined): UnitBadge[] => {
  if (!hex) return [];
  const badges: UnitBadge[] = [];

  const effect = TERRAIN_EFFECTS[hex.terrain];
  if (effect.damageTakenMultiplier < 1) badges.push('cover');
  // Low ground: anyone attacking from above hits harder
  if (effect.elevation < 1) badges.push('exposed');
  // High ground, or Pikemen fighting from a forest
  if ((hex.terrain === 'forest' && unit.abilities.includes('terrainBonus')) || effect.elevation >= HIGH_GROUND_ELEVATION) {
    badges.push('attack');
  }
  if (effect.healPerTurn) badges.push('heal');
  if (hex.isResourceHex) badges.push('gold');
  return badges;
};

interface DamagePopup {
  id: number;
  position: [number, number, number];
  // Gold paid out for this unit's destruction, shown with a skull
  bounty?: number;
  text: string;
  color: string;
}

const BoardScene: React.FC<BoardSceneProps> = ({
  gameState,
  onHexClick,
  onUnitClick,
  onUnitPurchase,
  selectedHex,
  selectedUnit = null,
  validMoves = [],
  assetsLoaded,
  selectedUnitTypeForPurchase = null,
  unitIds,
  showThreats = false
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const unitIdsRef = useRef(unitIds);
  unitIdsRef.current = unitIds;
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  // Your castle wears the style you picked
  const playerCastleStyle = getCastleStyle(useProfile().cosmetics.castleStyle);
  // Units destroyed a moment ago, still falling on the battlefield
  const [dyingUnits, setDyingUnits] = useState<{ unit: Unit; position: [number, number, number]; fallen: boolean }[]>([]);

  const { hexGrid, currentPhase, pendingMoves, pendingPurchases, combats, players, turnNumber } = gameState;
  const activePlayerSide = getActivePlayer(gameState);
  const isSetupPhase = currentPhase === 'setup';

  const hexByKey = useMemo(() => new Map(hexGrid.map(hex => [coordKey(hex.coordinates), hex])), [hexGrid]);
  const hoveredHex = hoveredKey ? hexByKey.get(hoveredKey) ?? null : null;

  // Which hexes are highlighted and how
  const validMoveKeys = useMemo(() => new Set(validMoves.map(coordKey)), [validMoves]);
  const validBaseKeys = useMemo(
    () => isSetupPhase ? new Set(getValidBaseLocations(gameState).map(h => coordKey(h.coordinates))) : new Set<string>(),
    // Valid base locations only depend on the map during setup
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSetupPhase, hexGrid]
  );

  const getHighlight = (key: string): HexHighlight => {
    if (isSetupPhase) return validBaseKeys.has(key) ? 'base' : 'none';
    if (!validMoveKeys.has(key)) return 'none';
    return selectedUnitTypeForPurchase ? 'deploy' : 'move';
  };

  const selectedKey = selectedHex ? coordKey(selectedHex.coordinates) : null;

  // --- Fog and threats ------------------------------------------------------------------------

  // Hexes the player's troops can see (null without fog)
  const visibleKeys = useMemo(
    () => (isFogOfWar(gameState) ? getVisibleHexKeys(gameState, 'player') : null),
    // Sight only changes when units move or camps change hands
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, hexGrid]
  );
  const threats = useMemo(
    () => (showThreats ? getThreats(gameState, 'player') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showThreats, players, hexGrid]
  );
  const threatLevels = useMemo(() => (threats ? getThreatLevels(threats) : null), [threats]);
  // Enemy troops that slipped back into the fog, marked where they were last seen
  const lastSeen = useMemo(() => {
    const occupied = new Set([...players.player.units, ...players.ai.units].map(unit => coordKey(unit.position)));
    return getRememberedEnemies(gameState, 'player').flatMap(sighting => {
      const hex = hexByKey.get(coordKey(sighting.unit.position));
      return hex && !occupied.has(coordKey(hex.coordinates)) ? [{ ...sighting, hex }] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, hexByKey, gameState.sightings]);
  // With a troop selected: the most damage it could take next turn on each hex it can move to
  const damageLabels = useMemo(() => {
    if (!threats || !selectedUnit || selectedUnit.owner !== 'player') return [];
    return [selectedUnit.position, ...validMoves].flatMap(coordinates => {
      const hex = hexByKey.get(coordKey(coordinates));
      const damage = estimateDamage(gameState, selectedUnit, coordinates, threats.get(coordKey(coordinates)));
      return hex && damage > 0 ? [{ key: coordKey(coordinates), hex, damage, lethal: damage >= selectedUnit.lifespan }] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threats, selectedUnit, validMoves, hexByKey]);

  // --- Interaction -----------------------------------------------------------------------

  const handleHexClick = (hex: Hex) => {
    if (!assetsLoaded) return;
    // Playing a card onto a highlighted hex deploys it straight away
    if (selectedUnitTypeForPurchase && validMoveKeys.has(coordKey(hex.coordinates))) {
      if (onUnitPurchase(selectedUnitTypeForPurchase, hex)) playSound('hex-select-sound', 0.5);
      return;
    }
    onHexClick(hex);
  };


  // Stable callbacks so memoised tiles and units don't re-render when unrelated state changes
  const handlersRef = useRef({ handleHexClick, onUnitClick, assetsLoaded });
  handlersRef.current = { handleHexClick, onUnitClick, assetsLoaded };

  const stableHexClick = useCallback((hex: Hex) => handlersRef.current.handleHexClick(hex), []);
  const stableUnitSelect = useCallback((unit: Unit) => {
    if (handlersRef.current.assetsLoaded) handlersRef.current.onUnitClick(unit);
  }, []);
  const handleHexHover = useCallback((hex: Hex) => {
    if (handlersRef.current.assetsLoaded) setHoveredKey(coordKey(hex.coordinates));
  }, []);
  const handleHexHoverEnd = useCallback((hex: Hex) => {
    const key = coordKey(hex.coordinates);
    setHoveredKey(current => current === key ? null : current);
  }, []);

  // --- Units -------------------------------------------------------------------------------

  const hexGridRef = useRef(hexGrid);
  hexGridRef.current = hexGrid;

  // World route between two hexes for walking animations
  const computeWalkPath = useCallback((from: HexCoordinates, to: HexCoordinates, flying = false) => {
    const grid = hexGridRef.current;
    const byKey = new Map(grid.map(hex => [coordKey(hex.coordinates), hex]));
    return findTerrainPath(grid, from, to, flying)
      .map(c => byKey.get(coordKey(c)))
      .filter((hex): hex is Hex => !!hex)
      .map(hex => toVector(surfacePosition(hex)));
  }, []);

  const allUnits = useMemo(() => [...players.player.units, ...players.ai.units], [players]);

  // Per-unit render data, memoised so units only re-render when something about them changes
  const unitRenderData = useMemo(() => {
    const enemyBaseCenters: Record<PlayerType, [number, number] | null> = { player: null, ai: null };
    for (const side of ['player', 'ai'] as const) {
      const enemyBase = findBaseHex(gameState, side === 'player' ? 'ai' : 'player');
      if (enemyBase) {
        const [x, , z] = axialToWorld(enemyBase.coordinates);
        enemyBaseCenters[side] = [x, z];
      }
    }

    // Units in other unresolved battles face their opponent; the battle being fought right now animates
    const combatFacing = new Map<string, HexCoordinates>();
    const battles = new Map<string, UnitBattle>();
    if (currentPhase === 'combat') {
      // Every battle of the turn is fought at the same time, once the troops walking into them arrive
      const startDelay = getBattleStartDelay();
      combats.forEach((combat, index) => {
        if (combat.resolved) return;
        for (const defender of combat.defenders) {
          if (combat.attackers[0]) combatFacing.set(defender.id, combat.attackers[0].position);
        }
        for (const attacker of combat.attackers) combatFacing.set(attacker.id, combat.hexCoordinates);

        const key = `${turnNumber}-${activePlayerSide}-${index}`;
        const worldOf = (coordinates: HexCoordinates): [number, number, number] => {
          const hex = hexByKey.get(coordKey(coordinates));
          return hex ? surfacePosition(hex) : axialToWorld(coordinates);
        };
        const liveAttackers = combat.attackers
          .map(a => players[a.owner].units.find(u => u.id === a.id))
          .filter((u): u is Unit => !!u);
        const liveDefenders = combat.defenders
          .map(d => players[d.owner].units.find(u => u.id === d.id))
          .filter((u): u is Unit => !!u);
        // The same outcome the battle will resolve to, so health drops blow by blow to the final result
        const preview = getCombatPreview(gameState, combat);
        const damageTo = new Map(
          [...preview.attackers, ...preview.defenders].map(entry => [entry.unit.id, entry.damageTaken])
        );
        const hitBack = new Set(preview.attackers.filter(a => a.canBeHitBack).map(a => a.unit.id));
        // Who strikes whom: defenders strike back at the nearest attacker they can reach
        const defenderTarget = new Map(liveDefenders.map(live => [live.id, liveAttackers
          .filter(a => canStrike(gameState, live, a))
          .sort((a, b) => getHexDistance(a.position, live.position) - getHexDistance(b.position, live.position))[0] ?? null]));

        // When each blow lands, and so when each unit falls; a fallen unit strikes no more
        const blowsOn = (unit: Unit, diesAt: Map<string, number | null>) => {
          const strikers = liveAttackers.some(a => a.id === unit.id)
            ? (hitBack.has(unit.id) ? liveDefenders : [])
            : liveAttackers;
          return strikers.flatMap(striker => getImpactTimesUntil(striker, diesAt.get(striker.id) ?? null)).sort((a, b) => a - b);
        };
        const fighters = [...liveAttackers, ...liveDefenders];
        const deathsOf = (diesAt: Map<string, number | null>) => new Map(fighters.map(unit =>
          [unit.id, getDeathTime(blowsOn(unit, diesAt), damageTo.get(unit.id) ?? 0, unit.lifespan)]));
        const firstGuess = deathsOf(new Map());
        const diesAt = deathsOf(firstGuess);

        const defenderAt = liveDefenders.find(d => coordKey(d.position) === coordKey(combat.hexCoordinates)) ?? liveDefenders[0];
        for (const attacker of liveAttackers) {
          battles.set(attacker.id, {
            key,
            target: worldOf(combat.hexCoordinates),
            startDelay,
            incoming: { times: blowsOn(attacker, diesAt), damage: damageTo.get(attacker.id) ?? 0 },
            diesAt: diesAt.get(attacker.id) ?? null,
            targetDiesAt: defenderAt ? diesAt.get(defenderAt.id) ?? null : null
          });
        }
        for (const live of liveDefenders) {
          const target = defenderTarget.get(live.id) ?? null;
          battles.set(live.id, {
            key,
            target: target ? worldOf(target.position) : null,
            startDelay,
            incoming: { times: blowsOn(live, diesAt), damage: damageTo.get(live.id) ?? 0 },
            diesAt: diesAt.get(live.id) ?? null,
            targetDiesAt: target ? diesAt.get(target.id) ?? null : null
          });
        }
      });
    }

    // Troops attacking a castle strike at it for the whole battle
    if (currentPhase === 'combat' && gameState.siege) {
      const castle = findBaseHex(gameState, gameState.siege.side === 'player' ? 'ai' : 'player');
      if (castle) {
        const target = surfacePosition(castle);
        for (const id of gameState.siege.attackerIds) {
          combatFacing.set(id, castle.coordinates);
          battles.set(id, { key: `${turnNumber}-${gameState.siege.side}-siege`, target, startDelay: getBattleStartDelay() });
        }
      }
    }

    const plannedUnitIds = new Set(pendingMoves.map(m => m.unitId));

    return allUnits.map(unit => {
      const hex = hexByKey.get(coordKey(unit.position));
      const enemies = unit.owner === 'player' ? players.ai.units : players.player.units;

      // Face the unit we're fighting, else the nearest enemy close by, else the enemy castle
      let faceCoordinates = combatFacing.get(unit.id) ?? null;
      if (!faceCoordinates) {
        let nearest: Unit | null = null;
        let nearestDistance = 4;
        for (const enemy of enemies) {
          const distance = getHexDistance(unit.position, enemy.position);
          if (distance < nearestDistance) {
            nearest = enemy;
            nearestDistance = distance;
          }
        }
        faceCoordinates = nearest?.position ?? null;
      }

      let facingTarget = enemyBaseCenters[unit.owner];
      if (faceCoordinates) {
        const [x, , z] = axialToWorld(faceCoordinates);
        facingTarget = [x, z];
      }

      return {
        unit,
        position: hex ? surfacePosition(hex) : axialToWorld(unit.position),
        facingTarget,
        battle: battles.get(unit.id) ?? null,
        hasPlannedMove: plannedUnitIds.has(unit.id),
        terrainBadges: getTerrainBadges(unit, hex)
      };
    });
    // gameState is only used to find the bases
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUnits, hexByKey, combats, currentPhase, pendingMoves, players, turnNumber, activePlayerSide, gameState.siege]);

  // Keep prop identities stable between renders so memoised units can skip re-rendering
  const unitPropsCache = useRef(new Map<string, (typeof unitRenderData)[number]>());
  const stableUnitRenderData = useMemo(() => {
    const next = new Map<string, (typeof unitRenderData)[number]>();
    const result = unitRenderData.map(data => {
      const previous = unitPropsCache.current.get(data.unit.id);
      const sameArray = (a: readonly unknown[] | null, b: readonly unknown[] | null) =>
        a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));
      const stable = previous ? {
        ...data,
        position: sameArray(previous.position, data.position) ? previous.position : data.position,
        facingTarget: sameArray(previous.facingTarget, data.facingTarget) ? previous.facingTarget : data.facingTarget,
        terrainBadges: sameArray(previous.terrainBadges, data.terrainBadges) ? previous.terrainBadges : data.terrainBadges,
        battle: previous.battle && data.battle && previous.battle.key === data.battle.key &&
          sameArray(previous.battle.target, data.battle.target) ? previous.battle : data.battle
      } : data;
      next.set(data.unit.id, stable);
      return stable;
    });
    unitPropsCache.current = next;
    return result;
  }, [unitRenderData]);

  // Units queued in the barracks, with stable props so hovering the board doesn't re-render them
  const pendingUnitCache = useRef(new Map<string, { unit: Unit; position: [number, number, number]; facingTarget: [number, number] | null }>());
  const pendingUnitRenderData = useMemo(() => {
    const next = new Map<string, { unit: Unit; position: [number, number, number]; facingTarget: [number, number] | null }>();
    for (const purchase of pendingPurchases) {
      const hex = hexByKey.get(coordKey(purchase.position));
      if (!hex) continue;
      const owner: PlayerType = purchase.playerId === players.player.id ? 'player' : 'ai';
      const id = `pending-${coordKey(purchase.position)}`;
      const previous = pendingUnitCache.current.get(id);
      if (previous && previous.unit.type === purchase.unitType && previous.unit.owner === owner) {
        next.set(id, previous);
        continue;
      }

      const info = getRosterStats(gameState, owner, purchase.unitType);
      if (!info) continue;
      // Face the enemy castle, like units already on the board
      const enemyBase = hexGrid.find(h => h.isBase && h.owner === (owner === 'player' ? 'ai' : 'player'));
      const enemyCenter = enemyBase ? axialToWorld(enemyBase.coordinates) : null;
      next.set(id, {
        unit: {
          type: purchase.unitType,
          attackPower: info.attackPower,
          lifespan: info.maxLifespan,
          maxLifespan: info.maxLifespan,
          movementRange: info.movementRange,
          cost: info.cost,
          level: info.level,
          abilities: [...info.abilities],
          id,
          owner,
          position: purchase.position,
          hasMoved: false,
          isEngagedInCombat: false
        },
        position: surfacePosition(hex),
        facingTarget: enemyCenter ? [enemyCenter[0], enemyCenter[2]] : null
      });
    }
    pendingUnitCache.current = next;
    return [...next.values()];
    // Rosters never change during a battle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPurchases, hexByKey, hexGrid, players.player.id]);

  // --- Planned moves -----------------------------------------------------------------------

  const plannedPaths = useMemo(() => pendingMoves.flatMap(move => {
    const unit = allUnits.find(u => u.id === move.unitId);
    if (!unit) return [];

    const stateWithoutMove = { ...gameState, pendingMoves: pendingMoves.filter(m => m !== move) };
    const route = getMovePath(stateWithoutMove, unit, move.to) ?? [unit.position, move.to];
    const points = route
      .map(c => hexByKey.get(coordKey(c)))
      .filter((hex): hex is Hex => !!hex)
      .map(hex => toVector(surfacePosition(hex)));

    return [{ id: move.unitId, points, color: OWNER_COLORS[unit.owner] }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pendingMoves, allUnits, hexByKey]);

  // Preview the route to the hovered hex while a unit is selected
  const hoverPreviewPath = useMemo(() => {
    if (!selectedUnit || selectedUnit.owner !== 'player' || !hoveredKey || !validMoveKeys.has(hoveredKey)) return null;
    const target = hexByKey.get(hoveredKey);
    if (!target) return null;

    const stateWithoutMove = { ...gameState, pendingMoves: pendingMoves.filter(m => m.unitId !== selectedUnit.id) };
    const route = getMovePath(stateWithoutMove, selectedUnit, target.coordinates);
    if (!route) return null;

    return route
      .map(c => hexByKey.get(coordKey(c)))
      .filter((hex): hex is Hex => !!hex)
      .map(hex => toVector(surfacePosition(hex)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnit, hoveredKey, validMoveKeys, hexByKey, pendingMoves]);

  // --- Damage popups -----------------------------------------------------------------------

  const previousUnitsRef = useRef(new Map<string, { unit: Unit; position: [number, number, number]; fallen: boolean }>());
  const previousGameIdRef = useRef(players.player.id);
  const popupIdRef = useRef(0);
  const popupTimeoutsRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => () => popupTimeoutsRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    // A new game started - forget the old units instead of reporting them all as destroyed
    if (previousGameIdRef.current !== players.player.id) {
      previousGameIdRef.current = players.player.id;
      previousUnitsRef.current = new Map();
      setDyingUnits([]);
    }

    const previous = previousUnitsRef.current;
    const next = new Map<string, { unit: Unit; position: [number, number, number]; fallen: boolean }>();
    const created: DamagePopup[] = [];

    // Units struck down in the battle being fought have already fallen on the field
    for (const { unit, position, battle } of unitRenderData) {
      next.set(unit.id, { unit, position, fallen: battle?.diesAt != null });
    }
    const fallen: { unit: Unit; position: [number, number, number]; fallen: boolean }[] = [];
    for (const [id, before] of previous) {
      // A troop that slipped into the fog isn't dead - it just isn't drawn
      if (!next.has(id) && !unitIdsRef.current?.has(id)) {
        const bounty = getKillBounty(before.unit);
        created.push({
          id: ++popupIdRef.current,
          position: before.position,
          text: '',
          color: '#ffffff',
          bounty
        });
        fallen.push(before);
        playBattleSound('unitFalls', 0.8);
        // Coins fly from the fallen enemy to the player's treasury
        if (before.unit.owner === 'ai') {
          playBattleSound('bounty', 0.6);
          const screen = projectToScreen([before.position[0], before.position[1] + 1, before.position[2]]);
          if (screen) emitCoins(screen, Math.min(8, Math.ceil(bounty / 2)));
        }
      }
    }
    if (fallen.length > 0) {
      const ids = new Set(fallen.map(f => f.unit.id));
      setDyingUnits(current => [...current, ...fallen]);
      const timeout = setTimeout(() => {
        popupTimeoutsRef.current.delete(timeout);
        setDyingUnits(current => current.filter(d => !ids.has(d.unit.id)));
      }, DEATH_DURATION * 1000 / getTimeScale() + 200);
      popupTimeoutsRef.current.add(timeout);
    }
    previousUnitsRef.current = next;

    if (created.length === 0) return;
    setPopups(current => [...current, ...created]);
    const ids = new Set(created.map(p => p.id));
    const timeout = setTimeout(() => {
      popupTimeoutsRef.current.delete(timeout);
      setPopups(current => current.filter(p => !ids.has(p.id)));
    }, 1600);
    popupTimeoutsRef.current.add(timeout);
  }, [unitRenderData, players.player.id]);

  // --- Rendering ---------------------------------------------------------------------------

  // Fit the shadow map to the board (plus headroom for castles and units) so shadows stay crisp
  const boardRadius = (gameState.settings?.gridSize ?? DEFAULT_SETTINGS.gridSize) * Math.sqrt(3) + HEX_SIZE;
  const shadowExtent = boardRadius + 2;
  const shadowFar = SHADOW_LIGHT_DISTANCE + boardRadius + 10;

  const unresolvedCombats = currentPhase === 'combat' ? combats.filter(c => !c.resolved) : [];
  const playerBase = findBaseHex(gameState, 'player');
  const aiBase = findBaseHex(gameState, 'ai');
  const playerCastlePosition = useMemo(() => playerBase ? surfacePosition(playerBase) : null, [playerBase]);
  const aiCastlePosition = useMemo(() => aiBase ? surfacePosition(aiBase) : null, [aiBase]);

  const campSignature = hexGrid.filter(hex => hex.isCamp).map(hex => `${coordKey(hex.coordinates)}:${hex.owner ?? ''}`).join('|');
  const campRenderData = useMemo(
    () => hexGrid.filter(hex => hex.isCamp).map(hex => ({
      key: coordKey(hex.coordinates),
      owner: hex.owner ?? null,
      position: surfacePosition(hex)
    })),
    // Only camps changing hands matters, not units moving around
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campSignature]
  );

  const showHoverPreview =
    assetsLoaded &&
    selectedUnitTypeForPurchase &&
    hoveredHex &&
    validMoveKeys.has(coordKey(hoveredHex.coordinates));

  return (
    <>
      {/* Soft, bright lighting for the low-poly look */}
      <hemisphereLight args={['#ffffff', '#9ccfe8', 1.6]} />
      <directionalLight
        position={SHADOW_LIGHT_POSITION}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={shadowFar}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-bias={-0.0005}
      />

      {/* Hex grid */}
      {hexGrid.map(hex => {
        const key = coordKey(hex.coordinates);
        const isSelected = key === selectedKey;
        return (
          <HexTile
            key={hex.id}
            hex={hex}
            highlight={getHighlight(key)}
            isSelected={isSelected}
            isInvalidSelection={isSelected && isSetupPhase && !validBaseKeys.has(key)}
            isHovered={key === hoveredKey}
            onHexClick={stableHexClick}
            onHexHover={handleHexHover}
            onHexHoverEnd={handleHexHoverEnd}
            fogged={!!visibleKeys && !visibleKeys.has(key)}
            threat={threatLevels?.get(key) ?? 0}
          />
        );
      })}

      {/* Threat preview: the most damage the selected troop could take on each hex it can reach */}
      {damageLabels.map(label => (
        <Html
          key={`threat-${label.key}`}
          position={labelPosition(label.hex)}
          center
          zIndexRange={[4, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            className={`font-display whitespace-nowrap rounded-full px-1.5 py-0.5 text-xs shadow ${label.lethal ? 'bg-rose-700 text-white' : 'bg-slate-900/85 text-rose-300'}`}
            title={label.lethal ? 'Enemies could destroy this troop here' : 'Most damage enemies could deal here next turn'}
          >
            {label.lethal ? '☠ ' : ''}-{label.damage}
          </span>
        </Html>
      ))}

      {/* Last-seen markers for enemies hidden in the fog */}
      {lastSeen.map(({ unit, turn, hex }) => (
        <Html key={`seen-${unit.id}`} position={labelPosition(hex)} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
          <span
            className="flex items-center gap-0.5 whitespace-nowrap rounded-full border-2 border-dashed border-red-400/70 bg-slate-900/60 px-1.5 py-0.5 text-[11px] font-bold text-red-200 opacity-80"
            title={`${getUnitTypeName(unit.type)} last seen here ${turnNumber - turn <= 0 ? 'this round' : `${turnNumber - turn} round${turnNumber - turn === 1 ? '' : 's'} ago`}`}
          >
            <UnitIcon type={unit.type} className="text-[13px]" />?
          </span>
        </Html>
      ))}

      {/* Trees, peaks, dunes and gold that show each hex's terrain */}
      <BoardDecorations hexGrid={hexGrid} />

      {/* Castles */}
      {playerCastlePosition && (
        <Castle
          owner="player"
          look={playerCastleStyle}
          position={playerCastlePosition}
          health={players.player.baseHealth ?? BASE_MAX_HEALTH}
          maxHealth={players.player.maxBaseHealth ?? BASE_MAX_HEALTH}
          fallen={currentPhase === 'gameOver' && gameState.winner === 'ai'}
        />
      )}
      {aiCastlePosition && (
        <Castle
          owner="ai"
          position={aiCastlePosition}
          health={players.ai.baseHealth ?? BASE_MAX_HEALTH}
          maxHealth={players.ai.maxBaseHealth ?? BASE_MAX_HEALTH}
          fallen={currentPhase === 'gameOver' && gameState.winner === 'player'}
        />
      )}

      {/* Neutral camps, flying the colours of whoever holds them */}
      {campRenderData.map(camp => (
        <Camp key={camp.key} owner={camp.owner} position={camp.position} />
      ))}

      {/* Units on the board */}
      {assetsLoaded && stableUnitRenderData.map(data => (
        <UnitMesh
          key={data.unit.id}
          unit={data.unit}
          position={data.position}
          facingTarget={data.facingTarget}
          computeWalkPath={computeWalkPath}
          onSelect={stableUnitSelect}
          isSelected={selectedUnit?.id === data.unit.id}
          hasPlannedMove={data.hasPlannedMove}
          battle={data.battle}
          terrainBadges={data.terrainBadges}
        />
      ))}

      {/* Units that just fell, playing out their death */}
      {assetsLoaded && dyingUnits.map(data => (
        <UnitMesh key={`dying-${data.unit.id}`} unit={data.unit} position={data.position} dying fallen={data.fallen} decorative />
      ))}

      {/* Cards played this turn appear at their deployment hex */}
      {assetsLoaded && pendingUnitRenderData.map(data => (
        <UnitMesh
          key={data.unit.id}
          unit={data.unit}
          position={data.position}
          facingTarget={data.facingTarget}
          isPendingPurchase
        />
      ))}

      {/* Planned routes */}
      {assetsLoaded && plannedPaths.map(path => (
        <MovePath key={path.id} points={path.points} color={path.color} />
      ))}
      {assetsLoaded && hoverPreviewPath && (
        <MovePath points={hoverPreviewPath} color="#ffffff" isPreview />
      )}

      {/* Barracks placement previews */}
      {showHoverPreview && hoveredHex && selectedUnitTypeForPurchase && (
        <AnimatedUnitPreview
          unitType={selectedUnitTypeForPurchase}
          position={axialToWorld(hoveredHex.coordinates)}
          hexHeight={getHexSurfaceHeight(hoveredHex)}
          isPlaced={false}
        />
      )}

      {/* Battle markers */}
      {unresolvedCombats.map(combat => {
        const hex = hexByKey.get(coordKey(combat.hexCoordinates));
        if (!hex) return null;
        const [x, y, z] = surfacePosition(hex);
        return (
          <Html key={coordKey(combat.hexCoordinates)} position={[x, y + 2.2, z]} center zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
            <div className="select-none rounded-full bg-slate-900/80 p-1 text-2xl animate-bounce">
              <AttackIcon />
            </div>
          </Html>
        );
      })}

      {/* Damage numbers */}
      {popups.map(popup => (
        <Html
          key={popup.id}
          position={[popup.position[0], popup.position[1] + 1.8, popup.position[2]]}
          center
          zIndexRange={[8, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="animate-float-up flex items-center gap-1 text-2xl font-black select-none"
            style={{ color: popup.color, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
          >
            {popup.bounty !== undefined ? (
              <>
                <SkullIcon className="drop-shadow" />
                <span className="text-lg text-amber-300">+{popup.bounty}</span>
                <GoldIcon className="text-lg drop-shadow" />
              </>
            ) : popup.text}
          </div>
        </Html>
      ))}

      {/* Hover info */}
      {assetsLoaded && hoveredHex && !isSetupPhase && (
        <HoverTooltip hex={hoveredHex} />
      )}
    </>
  );
};

// One-line description of the hovered hex: its terrain effect and what's standing on it
const HoverTooltip: React.FC<{ hex: Hex }> = ({ hex }) => {
  const [x, y, z] = surfacePosition(hex);
  const effect = hex.isCamp
    ? hex.owner === 'player' ? 'your camp: recruits deploy here' : `${hex.owner ? 'enemy' : 'neutral'} camp: move onto it to capture`
    : hex.isResourceHex
      ? `+${hex.resourceValue ?? 0} gold/turn`
      : TERRAIN_SHORT_EFFECTS[hex.terrain];

  return (
    <Html position={[x, y + 0.2, z]} zIndexRange={[9, 0]} style={{ pointerEvents: 'none' }}>
      <div className="ml-5 -mt-5 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[11px] text-slate-100 shadow-lg select-none">
        <span className="font-bold">
          {hex.isCamp ? <><CampIcon /> Camp</> : <><TerrainIcon terrain={hex.terrain} /> {TERRAIN_EFFECTS[hex.terrain].name}</>}
        </span>
        <span className="text-slate-400"> · height {TERRAIN_EFFECTS[hex.terrain].elevation}</span>
        <span className="text-slate-400"> · {effect}</span>
        {hex.unit && (
          <span className="ml-1 font-semibold" style={{ color: OWNER_COLORS[hex.unit.owner] }}>
            · {getUnitTypeName(hex.unit.type)} <HealthIcon /> {hex.unit.lifespan}
          </span>
        )}
      </div>
    </Html>
  );
};
