import { memo, useState, useCallback, useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GameState, Hex, HexCoordinates, PlayerType, Unit, UnitType } from '@/types/game';
import { HexTile, HexHighlight } from './HexTile';
import { UnitMesh, UnitBattle, DEATH_DURATION } from './UnitMesh';
import { sideColor } from './sideColors';
import { Castle, CastleIncoming } from './Castle';
import { Camp } from './Camp';
import { BoardDecorations } from './BoardDecorations';
import { BattlefieldObjects } from './BattlefieldObjects';
import { BossPowerBursts, BossThreats } from './BossPowers';
import { useHealthTimeline } from './effects/healthTimeline';
import { WeatherEffects } from './WeatherEffects';
import { PIN_BONUS, SCREEN_REDUCTION, SHIELD_WALL_REDUCTION, hasScreenBeside, inShieldWall, isPinned } from '@/lib/game/formations';
import { PACK_BONUS, SHAKEN_ATTACK, canRise, furyMultiplier, hasTrait, isShaken } from '@/lib/game/regionRules';
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
  getFellLanding,
  getActionTargets,
  ACTION_NAMES,
  getValidBaseLocations,
  getSiegeDamage,
  getCombatEffects,
  strongestEffects,
  HIGH_GROUND_ELEVATION,
  HEIGHT_DAMAGE_PER_UNIT,
  BERSERK_ATTACK_MULTIPLIER,
  TERRAIN_BONUS_ATTACK_MULTIPLIER,
  getSituationalBonuses,
  getProtections,
  getBesiegedCastles
} from '@/lib/game/gameState';
import { areAllies, getAllUnits, getEnemySides, getEnemyUnits, getFriendlyUnits, isMultiSide } from '@/lib/game/sides';
import { ROMAN, unitSignature } from '@/lib/game/signatures';
import { getHexDistance } from '@/lib/game/hexUtils';
import { estimateDamage, getThreatLevels, getThreats } from '@/lib/game/threats';
import { HEX_SIZE, axialToWorld, getHexHeight, getHexSurfaceHeight } from './utils/boardGeometry';
import { useLoadingManager } from './utils/LoadingManager';
import { AnimatedUnitPreview } from './AnimatedUnitPreview';
import { playSound } from './utils/SoundPlayer';
import { playBattleSound } from './utils/battleSounds';
import { DEFAULT_CASTLE_STYLE, getCastleStyle } from '@/lib/meta/cosmetics';
import { useProfile } from '@/lib/meta/profile';
import { getBattleStartDelay, getDeathTime, getImpactTimes, getImpactTimesUntil } from './utils/battleTiming';
import { getUnitTypeName } from './utils/UnitHelpers';
import { emitCoins, emitMaterial, projectToScreen, setProjector, takeShake, getTimeScale, getGameSpeed } from './effects/effects';
import { TERRAIN_SHORT_EFFECTS } from './hud/terrainInfo';
import { ActionIcon, StakesIcon, CampIcon, EmbersIcon, FallenLogIcon, FellIcon, FireIcon, GoldIcon, HealthIcon, SkullIcon, TerrainIcon, UnitIcon } from './icons';
import { FELL_DAMAGE, FIRE_DAMAGE } from '@/lib/game/battlefield';
import { isCapturable } from '@/lib/game/structures';
import type { UnitBuff } from './UnitMesh';
import type { TutorialVisuals } from './shared/TutorialGuide';
import { TutorialMarkers } from './shared/TutorialMarkers';
import { ALL_THEMES } from '@/lib/game/mapGenerator';
import { isMaterialId } from '@/lib/game/materials';
import { SKY_COLOR } from '@/components/menu/MenuShell';

// Identity of a unit's buffs, to keep its props stable while they don't change
const buffKey = (buffs: UnitBuff[]) => buffs.map(buff => `${buff.id}:${buff.value}`).join('|');

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
const BOARD_NEAR_EDGE_MARGIN_BATTLE_WIDE = 240;
const NARROW_SCREEN = 520;
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
// Looking down on a turn's battles (tilted a little off straight down, so the lie of the land shows):
// the tilt, how much room is left around them, the closest and
// furthest zoom, and how long the view holds after they end before settling back on a side
const BATTLE_VIEW_ELEVATION = THREE.MathUtils.degToRad(72);
const BATTLE_VIEW_MARGIN = 1.35;
const BATTLE_VIEW_MIN_ZOOM = 0.5;
const BATTLE_VIEW_MAX_ZOOM = 0.95;
const BATTLE_VIEW_HOLD_MS = 600;
// The action view, the camera's usual one once you have troops: it takes in all your troops and the
// enemies in sight within this many hexes of them (or of your castle) - or with none that near, the
// nearest enemy in sight within twice that, or else the ground this many hexes ahead of your troops towards the enemy
// castle - as close as that allows (but no closer than the nearest zoom here), with this share of
// the screen's width left clear each side
const ACTION_REACH = 3;
const ACTION_LOOK_AHEAD = 4;
const ACTION_MIN_ZOOM = 0.55;
const ACTION_SIDE_MARGIN = 0.1;
// How near the camera's targets it has to be for a flight to count as over (world units, zoom,
// radians): until then the player can't move it
const ARRIVED = { distance: 0.25, zoom: 0.02, angle: 0.1 };
// Longest a flight keeps the camera from the player (its slow last stretch is theirs to cut short)
const FLIGHT_LOCK_MAX_MS = 1500;
// Watching a castle fall at the end of the battle: the tilt, and how far down the screen the castle
// stands (-1 the bottom of the screen, 1 the top)
const FALL_VIEW_ELEVATION = THREE.MathUtils.degToRad(52);
const FALL_VIEW_SCREEN_Y = -0.5;
// How long the camera looks down on a boss's marked ground or power
const BOSS_FOCUS_HOLD_MS = 3200;

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
  // The first battle's tutorial: where it points the camera, and what it marks on the board
  tutorial?: TutorialVisuals | null;
  // The side the board is seen from (yours): 'player' against the AI
  viewer?: PlayerType;
}

const GameBoardComponent: React.FC<GameBoardProps> = (props) => {
  // Use loading state from the parent provider
  const { isComplete: assetsLoaded } = useLoadingManager();


  return (
    // Bright sky behind the floating battlefield
    <div className="w-full h-full" style={{ background: SKY_COLOR }}>
      {/* Flat (no tone mapping) keeps the low-poly colours bright and true; cap the pixel ratio for smoothness */}
      <Canvas shadows flat dpr={[1, 1.5]}>
        <Suspense fallback={null}>

          <BoardScene {...props} assetsLoaded={assetsLoaded} />

          <PerspectiveCamera makeDefault fov={CAMERA_FOV} near={0.1} far={3000} position={[0, 35, 14]} />
          <CameraRig
            gameState={props.gameState}
            viewer={props.viewer ?? 'player'}
            focus={props.selectedUnit?.position ?? (props.selectedHex && (props.selectedHex.isCamp || props.selectedHex.isBase) ? props.selectedHex.coordinates : null)}
            focusIsOurs={props.selectedUnit ? props.selectedUnit.owner === (props.viewer ?? 'player') : props.selectedHex?.owner === (props.viewer ?? 'player')}
            deployingCard={props.selectedUnitTypeForPurchase}
            showcase={props.tutorial?.showcase ?? null}
            keepInView={props.tutorial?.keepInView ?? null}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

// Memoised so HUD updates (like the turn timer) don't re-render the 3D scene
export const GameBoard = memo(GameBoardComponent);

// Keep a point the camera looks at over the battlefield (a board framed at `viewRadius`)
const keepOverBoard = (point: THREE.Vector3, viewRadius: number): THREE.Vector3 => {
  const maxPan = viewRadius * CAMERA_MAX_PAN;
  const horizontal = Math.hypot(point.x, point.z);
  if (horizontal > maxPan) point.multiplyScalar(maxPan / horizontal);
  return point;
};

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

// Where on screen (as shares of its width and height) a hex the tutorial points at should be: clear
// of the edges, the top HUD and the hand of cards
const KEEP_IN_VIEW = { left: 0.12, right: 0.88, top: 0.16, bottom: 0.66 };

// What the action view takes in: your troops; the enemies in sight near them or your castle; the
// enemy castle when your troops are near it; and your castle while a card is being played or
// enemies are near it. Null (nothing to frame: the overview instead) before you have troops.
const getActionPoints = (state: GameState, deploying: boolean, viewer: PlayerType): HexCoordinates[] | null => {
  if (state.currentPhase === 'setup' || state.currentPhase === 'gameOver') return null;
  const ours = state.players[viewer]?.units.map(unit => unit.position) ?? [];
  if (ours.length === 0) return null;
  const home = findBaseHex(state, viewer)?.coordinates;
  const near = (at: HexCoordinates, anchors: HexCoordinates[]) => anchors.some(anchor => getHexDistance(anchor, at) <= ACTION_REACH);
  const closest = (from: HexCoordinates[], to: HexCoordinates[]) =>
    Math.min(...from.flatMap(a => to.map(b => getHexDistance(a, b))));
  // (the nearest enemy castle to your troops)
  const enemyCastle = getEnemySides(state, viewer)
    .map(side => findBaseHex(state, side)?.coordinates)
    .filter((at): at is HexCoordinates => !!at)
    .sort((a, b) => closest(ours, [a]) - closest(ours, [b]))[0];
  const enemies = getEnemyUnits(state, viewer);
  const foes = enemies.map(unit => unit.position).filter(at => near(at, home ? [...ours, home] : ours));
  const points = [...ours, ...foes];
  if (enemyCastle && near(enemyCastle, ours)) points.push(enemyCastle);
  // (nothing to fight close by: where the fight is, or lies)
  if (foes.length === 0) {
    const seen = enemies.map(unit => unit.position);
    const nearest = [...seen].sort((a, b) => closest(ours, [a]) - closest(ours, [b]))[0];
    if (nearest && closest(ours, [nearest]) <= ACTION_REACH * 2) points.push(nearest);
    else if (enemyCastle) {
      const ahead = state.hexGrid
        .filter(hex => closest(ours, [hex.coordinates]) <= ACTION_LOOK_AHEAD)
        .sort((a, b) => getHexDistance(a.coordinates, enemyCastle) - getHexDistance(b.coordinates, enemyCastle))[0];
      if (ahead) points.push(ahead.coordinates);
    }
  }
  if (home && (deploying || foes.some(at => getHexDistance(at, home) <= ACTION_REACH))) points.push(home);
  return points;
};

const CameraRig: React.FC<{
  gameState: GameState;
  viewer: PlayerType;
  focus: HexCoordinates | null;
  focusIsOurs?: boolean;
  deployingCard?: UnitType | null;
  // A point the tutorial is showing: the camera flies there, and back to your side when it's done
  showcase?: TutorialVisuals['showcase'];
  // A hex the tutorial is pointing at: the camera drifts until it is well on screen
  keepInView?: HexCoordinates | null;
}> = ({
  gameState, viewer, focus, focusIsOurs = true, deployingCard, showcase = null, keepInView = null
}) => {
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
  // Set while the camera flies somewhere on its own (until it gets there): the player can't drag or
  // zoom it meanwhile
  const autoMovingRef = useRef(false);
  // (and when it set off: a flight locks the camera for a moment at most)
  const flightStartedRef = useRef(0);
  const desiredZoomRef = useRef(CAMERA_DEFAULT_ZOOM);
  // Extra rotation around the centre of the map and camera tilt chosen by the player
  const azimuthOffsetRef = useRef(0);
  const elevationRef = useRef(CAMERA_ELEVATION);
  const desiredElevationRef = useRef(CAMERA_ELEVATION);
  // Send the camera somewhere on its own
  const flyTo = useCallback((lookAt: THREE.Vector3, zoom: number, elevation: number) => {
    autoMovingRef.current = true;
    flightStartedRef.current = performance.now();
    desiredLookAtRef.current = lookAt;
    desiredZoomRef.current = zoom;
    desiredElevationRef.current = elevation;
  }, []);

  // The camera always works from your side of the board, whoever's turn it is
  const viewSide: PlayerType = viewer;

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
  }, [gameState.players[viewSide]?.baseLocation, viewSide, gridSize]);

  const sizeRef = useRef(size);
  sizeRef.current = size;
  // The battle hand's cards are bigger on wide screens, so the board leaves more room for them there
  const nearEdgeMargin = gameState.currentPhase === 'setup' ? BOARD_NEAR_EDGE_MARGIN_SETUP
    : size.width < NARROW_SCREEN ? BOARD_NEAR_EDGE_MARGIN_BATTLE : BOARD_NEAR_EDGE_MARGIN_BATTLE_WIDE;

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

  // What the action view is worked out from (only when the camera reframes)
  const actionSourceRef = useRef({ gameState, deploying: !!deployingCard, viewer });
  actionSourceRef.current = { gameState, deploying: !!deployingCard, viewer };
  const nearEdgeMarginRef = useRef(nearEdgeMargin);
  nearEdgeMarginRef.current = nearEdgeMargin;

  // Where to look and how far to pull back for the action view from a direction (an azimuth around
  // the board): everything in it on screen between the top HUD and the hand of cards, centred
  const frameAction = useCallback((azimuth: number): { lookAt: THREE.Vector3; zoom: number } | null => {
    const points = getActionPoints(actionSourceRef.current.gameState, actionSourceRef.current.deploying, actionSourceRef.current.viewer);
    if (!points) return null;
    const perspective = camera as THREE.PerspectiveCamera;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const { width, height } = sizeRef.current;
    const aspect = width / Math.max(height, 1);
    const sin = Math.sin(CAMERA_ELEVATION);
    const cos = Math.cos(CAMERA_ELEVATION);
    // Per unit of camera distance, how far in front of the look-at point (towards the camera) a
    // ground point appears at a screen height (-1 the bottom of the screen, 1 the top)
    const groundAt = (screenY: number) => screenY * tanHalfFov / (screenY * tanHalfFov * cos - sin);
    const bottom = groundAt(Math.min(0, -1 + (2 * nearEdgeMarginRef.current) / Math.max(height, 1)));
    const top = groundAt(Math.max(0, 1 - (2 * BOARD_FAR_EDGE_MARGIN) / Math.max(height, 1)));
    // Each point across the view (to the right) and along it (towards the camera); troops stand
    // tall, so the far ones get more room above them
    const towards = new THREE.Vector3(Math.sin(azimuth), 0, Math.cos(azimuth));
    const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
    const world = points.map(point => {
      const [x, , z] = axialToWorld(point);
      return { across: x * right.x + z * right.z, along: x * towards.x + z * towards.z };
    });
    const nearest = Math.max(...world.map(point => point.along)) + HEX_SIZE;
    const furthest = Math.min(...world.map(point => point.along)) - HEX_SIZE * 2;
    const leftmost = Math.min(...world.map(point => point.across)) - HEX_SIZE;
    const rightmost = Math.max(...world.map(point => point.across)) + HEX_SIZE;
    const fit = getViewDistance(viewRadiusRef.current, tanHalfFov, aspect, 1);
    const needed = Math.max(
      (nearest - furthest) / (bottom - top),
      (rightmost - leftmost) / 2 / (tanHalfFov * aspect * (1 - 2 * ACTION_SIDE_MARGIN))
    );
    // (as far out as it takes to get them all in)
    const zoom = THREE.MathUtils.clamp(needed / fit, ACTION_MIN_ZOOM, CAMERA_MAX_ZOOM);
    const distance = zoom * fit;
    // Along the view: midway between keeping the nearest point above the cards and the furthest
    // below the top HUD
    const along = ((nearest - bottom * distance) + (furthest - top * distance)) / 2;
    const lookAt = towards.multiplyScalar(along).add(right.multiplyScalar((leftmost + rightmost) / 2));
    keepOverBoard(lookAt, viewRadiusRef.current);
    return { lookAt, zoom };
  }, [camera]);

  // The usual view from one of the four sides of the board: the action view, or before you have
  // troops the overview
  const showSide = useCallback((side: number) => {
    const turn = side * Math.PI / 2;
    const action = frameAction(targetAzimuth + turn);
    flyTo(action?.lookAt ?? defaultLookAt.clone().applyAxisAngle(Y_AXIS, turn), action?.zoom ?? CAMERA_DEFAULT_ZOOM, CAMERA_ELEVATION);
    azimuthOffsetRef.current = turn;
  }, [defaultLookAt, frameAction, targetAzimuth, flyTo]);

  // Set while the camera is looking down on a turn's battles (until it settles back on a side)
  const battleViewRef = useRef(false);
  // A camp captured while the battles were being watched: settle on its side afterwards
  const pendingSideRef = useRef<number | null>(null);

  // Castles placed: start from your castle's side
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
  const currentSide = () => nearestSide(azimuthRef.current ?? targetAzimuth + azimuthOffsetRef.current, targetAzimuth);

  // "Home" sides: those showing your castle or a camp you hold (null: one is near the middle, so
  // every side shows it)
  const homeSides = (): number[] | null => {
    const sides = gameState.hexGrid
      .filter(hex => hex.owner === viewSide && (hex.isBase || hex.isCamp))
      .map(hex => (hex.isBase ? 0 : sideOf(hex.coordinates)));
    return sides.includes(null) ? null : [...new Set(sides as number[])];
  };
  // The home side whose view is closest to a direction (an azimuth around the board)
  const nearestHomeSide = (azimuth: number): number => {
    const sides = homeSides();
    if (!sides) return nearestSide(azimuth, targetAzimuth);
    const away = (side: number) => Math.abs(angleDelta(azimuth, targetAzimuth + side * Math.PI / 2));
    return sides.reduce((best, side) => (away(side) < away(best) ? side : best));
  };
  const goToSide = (side: number) => {
    if (side !== currentSide()) showSide(side);
  };

  // A selection on another side of the board: swing round to the side nearest it - or, for the
  // enemy's troops, castle and camps (and camps no one holds), to your own side closest to it
  const focusKey = focus ? `${focus.q},${focus.r}` : null;
  useEffect(() => {
    if (!focus || gameState.currentPhase !== 'planning') return;
    const side = sideOf(focus);
    if (side === null) return;
    if (focusIsOurs) goToSide(side);
    else {
      const [x, , z] = axialToWorld(focus);
      goToSide(nearestHomeSide(Math.atan2(x, z)));
    }
    // Only reacts to a new selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Picking a card to play: frame the action with your castle in it too - from this side if it
  // shows the castle or a camp of ours to deploy at, otherwise from the nearest side that does
  useEffect(() => {
    if (!deployingCard || gameState.currentPhase !== 'planning') return;
    const sides = homeSides();
    showSide(!sides || sides.includes(currentSide()) ? currentSide() : nearestHomeSide(azimuthRef.current ?? targetAzimuth));
    // Only reacts to picking a card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployingCard]);

  // Your turn begins: frame the action afresh - from the nearest side with your castle or a camp in
  // view, if the camera ended up somewhere with none
  const yourTurn = gameState.currentPhase === 'planning' && getActivePlayer(gameState) === viewer ? gameState.turnNumber : null;
  useEffect(() => {
    if (yourTurn === null || battleViewRef.current) return;
    const sides = homeSides();
    showSide(sides && !sides.includes(currentSide()) ? nearestHomeSide(azimuthRef.current ?? targetAzimuth) : currentSide());
    // Only reacts to a new turn of yours
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourTurn]);

  // The tutorial showing a spot on the board: fly there, close and from higher up; then come back
  const showcaseKey = showcase ? `${showcase.at.q},${showcase.at.r},${showcase.zoom}` : null;
  const wasShowcasingRef = useRef(false);
  useEffect(() => {
    if (showcase) {
      const [x, , z] = axialToWorld(showcase.at);
      flyTo(new THREE.Vector3(x, 0, z), showcase.zoom, THREE.MathUtils.degToRad(62));
      wasShowcasingRef.current = true;
    } else if (wasShowcasingRef.current) {
      wasShowcasingRef.current = false;
      showSide(0);
    }
    // Only reacts to the tutorial moving the camera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showcaseKey]);

  // A camp you've just captured: swing round to its side
  const ownedCamps = gameState.hexGrid.filter(hex => hex.isCamp && hex.owner === viewSide).map(hex => coordKey(hex.coordinates)).sort().join(' ');
  const ownedCampsRef = useRef(ownedCamps);
  useEffect(() => {
    const before = new Set(ownedCampsRef.current.split(' '));
    ownedCampsRef.current = ownedCamps;
    const captured = gameState.hexGrid.find(hex => hex.isCamp && hex.owner === viewSide && !before.has(coordKey(hex.coordinates)));
    if (!captured || gameState.currentPhase === 'gameOver') return;
    const side = sideOf(captured.coordinates);
    if (side === null) return;
    if (battleViewRef.current || gameState.currentPhase === 'combat') pendingSideRef.current = side;
    else goToSide(side);
    // Only reacts to camps changing hands
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedCamps]);

  // Battles about to be fought: rise to a view from above that takes in every fight (and any castle
  // under attack), then once they're over settle on the nearest side showing your castle or a camp
  // (or the side of a camp just captured)
  const battleKey = gameState.currentPhase === 'combat' ? `${gameState.turnNumber}-${getActivePlayer(gameState)}` : null;
  const isGameOver = gameState.currentPhase === 'gameOver';
  // Look down on some points of the board (a turn's battles, a boss's power), with `pad` around them
  const flyOver = (points: HexCoordinates[], pad: number) => {
    const world = points.map(point => axialToWorld(point));
    const centre = new THREE.Vector3(
      world.reduce((sum, [x]) => sum + x, 0) / world.length, 0,
      world.reduce((sum, [, , z]) => sum + z, 0) / world.length
    );
    const spread = Math.max(...world.map(([x, , z]) => Math.hypot(x - centre.x, z - centre.z))) + pad;
    keepOverBoard(centre, viewRadiusRef.current);
    flyTo(centre, THREE.MathUtils.clamp(spread * BATTLE_VIEW_MARGIN / viewRadiusRef.current, BATTLE_VIEW_MIN_ZOOM, BATTLE_VIEW_MAX_ZOOM), BATTLE_VIEW_ELEVATION);
  };
  // Set while the camera holds on a turn's battles once they're over, before settling
  const battleHoldRef = useRef(false);
  const settleRef = useRef<() => void>(() => {});
  settleRef.current = () => {
    // (a boss's power still being shown settles when it is done; once the battle is over the camera
    // stays on its ending)
    if (Date.now() < bossFocusUntilRef.current || isGameOver) return;
    battleViewRef.current = false;
    const side = pendingSideRef.current ?? nearestHomeSide(azimuthRef.current ?? targetAzimuth);
    pendingSideRef.current = null;
    showSide(side);
  };
  useEffect(() => {
    if (battleKey) {
      const points = gameState.combats.flatMap(combat => [combat.hexCoordinates, ...combat.attackers.map(unit => unit.position)]);
      if (gameState.siege) {
        for (const { side } of getBesiegedCastles(gameState)) {
          const castle = findBaseHex(gameState, side);
          if (castle) points.push(castle.coordinates);
        }
        for (const id of gameState.siege.attackerIds) {
          const unit = gameState.players[gameState.siege.side].units.find(candidate => candidate.id === id);
          if (unit) points.push(unit.position);
        }
      }
      if (points.length === 0) return;
      battleViewRef.current = true;
      flyOver(points, HEX_SIZE * 1.5);
      return;
    }
    if (!battleViewRef.current || isGameOver) {
      battleViewRef.current = false;
      pendingSideRef.current = null;
      return;
    }
    // Hold on the aftermath for a moment, then settle
    battleHoldRef.current = true;
    const settle = setTimeout(() => {
      battleHoldRef.current = false;
      settleRef.current();
    }, BATTLE_VIEW_HOLD_MS / getGameSpeed());
    return () => {
      clearTimeout(settle);
      battleHoldRef.current = false;
      battleViewRef.current = false;
    };
    // Only reacts to battles starting and ending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleKey, isGameOver]);

  // A boss marking the ground it will strike, or unleashing its power: look down on it for a moment,
  // then settle back (the marked ground keeps glowing for whenever the player looks again)
  const bossFocusUntilRef = useRef(0);
  const phaseRef = useRef(gameState.currentPhase);
  phaseRef.current = gameState.currentPhase;
  const bossThreat = getAllUnits(gameState).find(unit => unit.isBoss && unit.threat)?.threat ?? null;
  const bossFocus: HexCoordinates[] | null = bossThreat ??
    (gameState.lastBossPower ? [gameState.lastBossPower.from, ...gameState.lastBossPower.hexes] : null);
  const bossFocusKey = bossThreat
    ? `threat:${bossThreat.map(coordKey).join(' ')}`
    : gameState.lastBossPower ? `power:${gameState.lastBossPower.serial}` : null;
  const firstBossFocusRef = useRef(bossFocusKey);
  useEffect(() => {
    if (!bossFocusKey || bossFocusKey === firstBossFocusRef.current || !bossFocus || isGameOver) return;
    firstBossFocusRef.current = null;
    battleViewRef.current = true;
    flyOver(bossFocus, HEX_SIZE * 2);
    const hold = BOSS_FOCUS_HOLD_MS / getGameSpeed();
    bossFocusUntilRef.current = Date.now() + hold - 50;
    const settle = setTimeout(() => settleRef.current(), hold);
    return () => {
      clearTimeout(settle);
      // (cut short - by a new mark, or the mark going: hand the camera back where it is, unless
      // battles are being watched or held on, which settle on their own; a new mark takes it again)
      if (Date.now() < bossFocusUntilRef.current) {
        bossFocusUntilRef.current = 0;
        if (phaseRef.current !== 'combat' && !battleHoldRef.current) battleViewRef.current = false;
      }
    };
    // Only reacts to a new mark or power
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossFocusKey]);

  // A castle destroyed: swoop down on it as it falls (a battle won on points or given up leaves
  // both standing)
  // (in a battle between more sides, the castle that fell last)
  const loser = gameState.currentPhase === 'gameOver' && gameState.winner && gameState.winReason === 'destroyed'
    ? isMultiSide(gameState)
      ? Object.values(gameState.players).filter(player => player.eliminated && (player.baseHealth ?? 1) <= 0)
        .sort((a, b) => (b.eliminatedOrder ?? 0) - (a.eliminatedOrder ?? 0))[0]?.type ?? null
      : (gameState.winner === 'player' ? 'ai' : 'player')
    : null;
  useEffect(() => {
    if (!loser) return;
    const base = findBaseHex(gameState, loser);
    if (!base) return;
    const [x, , z] = axialToWorld(base.coordinates);
    // (looking a little beyond the castle, so it stands in the lower part of the screen with room
    // below it, clear of the results that follow)
    const perspective = camera as THREE.PerspectiveCamera;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const { width, height } = sizeRef.current;
    const distance = getViewDistance(viewRadiusRef.current, tanHalfFov, width / Math.max(height, 1), CAMERA_MIN_ZOOM);
    const sin = Math.sin(FALL_VIEW_ELEVATION);
    const cos = Math.cos(FALL_VIEW_ELEVATION);
    const y = FALL_VIEW_SCREEN_Y;
    const towardsCamera = y * tanHalfFov * distance / (y * tanHalfFov * cos - sin);
    const azimuth = targetAzimuth + azimuthOffsetRef.current;
    const lookAt = new THREE.Vector3(x - Math.sin(azimuth) * towardsCamera, 0, z - Math.cos(azimuth) * towardsCamera);
    flyTo(lookAt, CAMERA_MIN_ZOOM, FALL_VIEW_ELEVATION);
    // Only reacts to the battle ending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loser]);

  // Orbit around the centre of the map, carrying the current view along with the camera
  const rotateBy = useCallback((radians: number) => {
    azimuthOffsetRef.current += radians;
    desiredLookAtRef.current?.applyAxisAngle(Y_AXIS, radians);
  }, []);

  // The camera is the game's to move while it flies somewhere, looks down on the turn's battles or
  // a boss's power, or shows the tutorial's flight
  const cameraLocked = useCallback(
    () => (autoMovingRef.current && performance.now() - flightStartedRef.current < FLIGHT_LOCK_MAX_MS) ||
      battleViewRef.current || wasShowcasingRef.current,
    []
  );

  // Dragging: one finger (or the left mouse button) pans across the board, which moves with it; the
  // right mouse button (or Shift and the left) orbits around the board, left and right, and tilts the
  // view, up and down; two fingers pinch to zoom, twist to turn the board and slide up or down
  // together to tilt it
  useEffect(() => {
    const element = gl.domElement;
    // (the board takes every touch gesture itself, rather than the page)
    const touchActionBefore = element.style.touchAction;
    element.style.touchAction = 'none';
    type Mode = 'pan' | 'orbit';
    // (a drag belongs to the pointer that began it)
    let drag: { pointerId: number; startX: number; startY: number; lastX: number; lastY: number; active: boolean; onLabel: boolean; mode: Mode } | null = null;
    // Fingers on the board, and the pinch two of them are making
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number; angle: number; middleY: number } | null = null;
    // A drag that began on a troop's label doesn't then pick the troop when it ends
    let swallowClickUntil = 0;
    const pinchOf = () => {
      const [a, b] = [...touches.values()];
      return { distance: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x), middleY: (a.y + b.y) / 2 };
    };

    // Move the view across the board by a drag of (dx, dy) pixels, so the ground follows the pointer
    const panBy = (dx: number, dy: number) => {
      const perspective = camera as THREE.PerspectiveCamera;
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
      const { width, height } = sizeRef.current;
      const distance = getViewDistance(viewRadiusRef.current, tanHalfFov, width / Math.max(height, 1), zoomRef.current);
      const perPixel = 2 * distance * tanHalfFov / Math.max(height, 1);
      const azimuth = azimuthRef.current ?? 0;
      const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
      const towards = new THREE.Vector3(Math.sin(azimuth), 0, Math.cos(azimuth));
      const shift = right.multiplyScalar(-dx * perPixel)
        .add(towards.multiplyScalar(-dy * perPixel / Math.max(0.3, Math.sin(elevationRef.current))));
      for (const target of [desiredLookAtRef.current, lookAtRef.current]) {
        if (target) keepOverBoard(target.add(shift), viewRadiusRef.current);
      }
    };

    // (a drag can begin on the board or on a troop's label over it; one begun while the camera is
    // showing something on its own waits, and takes over once it is free)
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 2) return;
      const onLabel = event.target instanceof Element && !!event.target.closest('[data-unit]');
      if (event.target !== element && !onLabel) return;
      if (event.pointerType === 'touch') {
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touches.size === 2) {
          // A second finger: pinch and twist instead
          pinch = pinchOf();
          drag = null;
          return;
        }
        if (touches.size > 2) return;
      }
      const mode: Mode = event.button === 2 || event.shiftKey ? 'orbit' : 'pan';
      drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, active: false, onLabel, mode };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!drag && !pinch) return;
      // (the camera is busy: the gesture waits, from wherever the fingers are when it's free)
      if (cameraLocked()) {
        if (pinch && touches.size >= 2) pinch = pinchOf();
        if (drag && drag.pointerId === event.pointerId) {
          drag.lastX = event.clientX;
          drag.lastY = event.clientY;
        }
        return;
      }
      if (pinch && touches.size >= 2) {
        const next = pinchOf();
        desiredZoomRef.current = THREE.MathUtils.clamp(
          desiredZoomRef.current * pinch.distance / Math.max(1, next.distance), CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM
        );
        rotateBy(-angleDelta(pinch.angle, next.angle));
        // (both fingers sliding up or down tilt the view, as a mouse's right-drag does)
        desiredElevationRef.current = THREE.MathUtils.clamp(
          desiredElevationRef.current + (next.middleY - pinch.middleY) * CAMERA_DRAG_TILT_SPEED,
          CAMERA_MIN_ELEVATION,
          CAMERA_MAX_ELEVATION
        );
        pinch = next;
        return;
      }
      if (!drag || drag.pointerId !== event.pointerId) return;
      // Ignore tiny movements so ordinary clicks never nudge the camera
      if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < CAMERA_DRAG_THRESHOLD) return;
      drag.active = true;
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      if (drag.mode === 'pan') panBy(dx, dy);
      else {
        rotateBy(-dx * CAMERA_DRAG_ROTATE_SPEED);
        desiredElevationRef.current = THREE.MathUtils.clamp(
          desiredElevationRef.current + dy * CAMERA_DRAG_TILT_SPEED,
          CAMERA_MIN_ELEVATION,
          CAMERA_MAX_ELEVATION
        );
      }
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      if (touches.size < 2) pinch = null;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.active && drag.onLabel) swallowClickUntil = performance.now() + 400;
      drag = null;
    };
    const onClick = (event: MouseEvent) => {
      if (performance.now() > swallowClickUntil) return;
      swallowClickUntil = 0;
      event.stopPropagation();
    };
    // (the right button turns the view rather than opening the browser's menu)
    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    window.addEventListener('pointerdown', onPointerDown);
    // Track the drag on the window so it keeps working when the cursor passes over the HUD
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('click', onClick, true);
    element.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('click', onClick, true);
      element.removeEventListener('contextmenu', onContextMenu);
      element.style.touchAction = touchActionBefore;
    };
  }, [gl, camera, rotateBy, cameraLocked]);

  // Mouse wheel / trackpad pinch zooms towards whatever is under the cursor
  useEffect(() => {
    const element = gl.domElement;
    const raycaster = new THREE.Raycaster();
    // Roughly the height of an average tile surface
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.3);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (cameraLocked()) return;
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
        keepOverBoard(desiredLookAt, viewRadiusRef.current);
      }
      desiredZoomRef.current = nextZoom;
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [gl, camera, cameraLocked]);

  // Expose the camera in development so automated browser tests can aim clicks precisely (and see
  // when the player may move it, and the zoom it is heading for)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      Object.assign(window, { __wwhCamera: camera, __wwhCameraRig: { locked: cameraLocked, moving: () => autoMovingRef.current, zoom: () => desiredZoomRef.current, lookAt: () => desiredLookAtRef.current?.toArray() } });
    }
  }, [camera, cameraLocked]);

  const keepInViewRef = useRef(keepInView);
  keepInViewRef.current = keepInView;
  const probe = useMemo(() => new THREE.Vector3(), []);

  useFrame((frame, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const ease = Math.min(1, delta * CAMERA_TURN_SPEED);

    // Drift towards the hex the tutorial points at while it is near an edge or under the HUD
    const spot = keepInViewRef.current;
    if (spot) {
      const [x, , z] = axialToWorld(spot);
      probe.set(x, 0, z).project(camera);
      const screenX = (probe.x + 1) / 2;
      const screenY = (1 - probe.y) / 2;
      if (probe.z > 1 || screenX < KEEP_IN_VIEW.left || screenX > KEEP_IN_VIEW.right || screenY < KEEP_IN_VIEW.top || screenY > KEEP_IN_VIEW.bottom) {
        const desired = desiredLookAtRef.current ?? defaultLookAt.clone();
        const pull = Math.min(1, delta * 1.5);
        desired.x += (x - desired.x) * pull;
        desired.z += (z - desired.z) * pull;
        desiredLookAtRef.current = desired;
      }
    }
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
    // A flight is over once the camera is (all but) there
    if (autoMovingRef.current && lookAtRef.current.distanceTo(desiredLookAt) < ARRIVED.distance &&
      Math.abs(desiredZoomRef.current - zoomRef.current) < ARRIVED.zoom &&
      Math.abs(desiredElevationRef.current - elevation) < ARRIVED.angle &&
      Math.abs(angleDelta(azimuth, desiredAzimuth)) < ARRIVED.angle) {
      autoMovingRef.current = false;
    }

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

// The blows each troop attacking a castle lands on it in the battle being fought: one per point of
// damage it deals (as many as it can strike in the battle). One struck down by the castle's guards
// lands none, as it does no damage. Also the total, as the castle will take it.
// A blow bigger than this shows on the castle as a quick run of smaller hits, so its health
// visibly counts down even when one swing takes it all
const MAX_CASTLE_HIT = 4;
const CASTLE_HIT_GAP = 0.12;

type SiegeBlows = {
  blows: Map<string, number[]>;
  // The hits the castle shows: when each lands and how much it takes, in order
  hits: { time: number; amount: number }[];
  damage: number;
  fallsAt: number | null;
};

// (for the castle of `castleSide`, against the troops attacking it)
const getSiegeBlows = (state: GameState, castleSide: PlayerType): SiegeBlows => {
  const blows = new Map<string, number[]>();
  const siege = state.currentPhase === 'combat' ? state.siege : undefined;
  if (!siege) return { blows, hits: [], damage: 0, fallsAt: null };
  const attackerIds = getBesiegedCastles(state).find(castle => castle.side === castleSide)?.attackerIds ?? [];
  const doomed = new Set(state.combats
    .filter(combat => combat.intercept && !combat.resolved)
    .flatMap(combat => getCombatPreview(state, combat).defenders.filter(entry => entry.destroyed).map(entry => entry.unit.id)));
  let total = 0;
  const all: { id: string; time: number; damage: number }[] = [];
  for (const id of attackerIds) {
    const unit = state.players[siege.side].units.find(candidate => candidate.id === id);
    if (!unit || doomed.has(id)) {
      blows.set(id, []);
      continue;
    }
    const damage = getSiegeDamage(unit);
    total += damage;
    const times = getImpactTimes(unit).slice(0, Math.max(1, Math.round(damage)));
    blows.set(id, times);
    for (const time of times) all.push({ id, time, damage: damage / times.length });
  }
  // The castle falls at the blow that empties its health: nobody strikes it after that
  const health = state.players[castleSide]?.baseHealth ?? BASE_MAX_HEALTH;
  let landed = 0;
  let fallsAt: number | null = null;
  for (const blow of all.sort((a, b) => a.time - b.time)) {
    landed += blow.damage;
    if (Math.round(landed) >= health) {
      fallsAt = blow.time;
      break;
    }
  }
  if (fallsAt !== null) {
    for (const [id, times] of blows) blows.set(id, times.filter(time => time <= fallsAt!));
  }
  const damage = Math.min(health, Math.round(total));
  // Whole-number hits, in order, adding up to the damage the castle takes (big blows split up)
  const hits: SiegeBlows['hits'] = [];
  let dealt = 0;
  let exact = 0;
  for (const blow of all) {
    if (fallsAt !== null && blow.time > fallsAt) break;
    exact += blow.damage;
    let amount = Math.min(damage, Math.round(exact)) - dealt;
    for (let part = 0; amount > 0; part++) {
      const piece = Math.min(MAX_CASTLE_HIT, amount);
      hits.push({ time: blow.time + part * CASTLE_HIT_GAP, amount: piece });
      dealt += piece;
      amount -= piece;
    }
  }
  hits.sort((a, b) => a.time - b.time);
  return { blows, hits, damage, fallsAt };
};

interface BoardSceneProps extends GameBoardProps {
  assetsLoaded: boolean;
}

// Effects called out over a battle at most (the biggest ones)
const MAX_CALLOUTS = 2;

// High above a hex, clear of the troops fighting on it
const calloutPosition = (hex: Hex): [number, number, number] => {
  const [x, y, z] = surfacePosition(hex);
  return [x, y + 3.4, z];
};

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

// The buffs (and the odd drawback) working on a unit right now, shown under its health tag, most
// telling first: its signature while its condition is met, hazards, then the ground.
const getUnitBuffs = (state: GameState, unit: Unit, hex: Hex | undefined): UnitBuff[] => {
  if (!hex) return [];
  const buffs: UnitBuff[] = [];
  const effect = TERRAIN_EFFECTS[hex.terrain];
  const pct = (value: number) => `${Math.round(value * 100)}%`;

  // Its signature, while it is working
  const signature = unitSignature(unit);
  const situational = getSituationalBonuses(state, unit);
  if (signature) {
    const bonus = situational.find(entry => entry.label === signature.def.name);
    const warding = signature.def.id === 'ward' &&
      getFriendlyUnits(state, unit.owner).some(ally => ally.id !== unit.id && getHexDistance(ally.position, unit.position) === 1);
    if (bonus || warding) {
      buffs.push({
        id: 'signature', icon: 'signature', label: `${signature.def.name} ${ROMAN[signature.rank]}`,
        value: bonus ? `+${pct(bonus.multiplier - 1)} attack` : signature.def.short(signature.rank), good: true
      });
    }
  }
  // Its bonuses from others (Ward)
  for (const bonus of situational) {
    if (bonus.label !== signature?.def.name) {
      // (a blacksmith's edge is on every troop, so it only shows in the list)
      buffs.push({ id: `bonus-${bonus.label}`, icon: 'attack', label: bonus.label, value: `+${pct(bonus.multiplier - 1)} attack`, good: true, quiet: bonus.label === 'Blacksmith' });
    }
  }
  for (const protection of getProtections(state, unit)) {
    buffs.push({ id: `guard-${protection.label}`, icon: 'shield', label: protection.label, value: `-${pct(protection.reduction)} damage`, good: true });
  }
  // Formations: screened by a front-line friend, standing in a shield wall, or pinned by the enemy
  const friends = getFriendlyUnits(state, unit.owner);
  const foes = getEnemyUnits(state, unit.owner);
  if (hasScreenBeside(unit, unit.position, friends)) {
    buffs.push({ id: 'screened', icon: 'shield', label: 'Screened', value: `-${pct(SCREEN_REDUCTION)} damage from beyond its screen`, good: true });
  }
  if (inShieldWall(unit, unit.position, friends)) {
    buffs.push({ id: 'shieldwall', icon: 'shield', label: 'Shield wall', value: `-${pct(SHIELD_WALL_REDUCTION)} damage`, good: true });
  }
  if (isPinned(unit.position, foes)) {
    buffs.push({ id: 'pinned', icon: 'pinned', label: 'Pinned', value: `Archers and riders deal +${pct(PIN_BONUS)}`, good: false });
  }
  // Morale and its faction's trait
  if (isShaken(unit)) {
    // (it steadies at the end of each of its side's turns: on its own turn, this one counts)
    const turns = unit.shaken ?? 1;
    const ownTurn = getActivePlayer(state) === unit.owner;
    const lasting = ownTurn
      ? turns === 1 ? 'until the end of this turn' : `this turn and ${turns - 1 === 1 ? 'its next' : `its next ${turns - 1} turns`}`
      : turns === 1 ? 'until the end of its next turn' : `for its next ${turns} turns`;
    buffs.push({ id: 'shaken', icon: 'shaken', label: 'Shaken', value: `-${pct(1 - SHAKEN_ATTACK)} attack ${lasting}`, good: false });
  }
  // A monster's venom or web working in it
  if (unit.poisoned) {
    // (venom taken on its own turn waits for the end of the next one)
    const thisTurn = getActivePlayer(state) === unit.owner && !unit.poisonFresh;
    buffs.push({ id: 'venom', icon: 'venom', label: 'Poisoned', value: `-${unit.poisoned} health at the end of ${thisTurn ? 'this' : 'its next'} turn`, good: false });
  }
  if (unit.slowed) {
    // (on its own turn, the turn it's slowed for is this one - unless the web caught it this very turn)
    const thisTurn = getActivePlayer(state) === unit.owner && unit.slowed === 1;
    buffs.push({ id: 'slowed', icon: 'slowed', label: 'Slowed', value: `-1 movement ${thisTurn ? 'this turn' : 'on its next turn'}`, good: false });
  }
  if (canRise(unit)) buffs.push({ id: 'undying', icon: 'undying', label: 'Undying', value: 'Rises again once (not against Clerics or fire)', good: true, quiet: true });
  if (furyMultiplier(unit) >= 1.05) buffs.push({ id: 'fury', icon: 'fury', label: 'Fury', value: `+${pct(furyMultiplier(unit) - 1)} attack`, good: true });
  // (when an enemy beside it has another of its pack beside it too)
  if (hasTrait(unit, 'pack') && foes.some(foe => getHexDistance(foe.position, unit.position) === 1 &&
    friends.some(friend => friend.id !== unit.id && hasTrait(friend, 'pack') && getHexDistance(friend.position, foe.position) === 1))) {
    buffs.push({ id: 'pack', icon: 'pack', label: 'Pack Hunters', value: `+${pct(PACK_BONUS)} attack for each other beast beside its prey`, good: true });
  }
  // Its own fury
  if (unit.abilities.includes('berserk') && unit.lifespan * 2 <= unit.maxLifespan) {
    buffs.push({ id: 'berserk', icon: 'attack', label: 'Berserk', value: `+${pct(BERSERK_ATTACK_MULTIPLIER - 1)} attack`, good: true });
  }
  // Hazards
  if (hex.fire?.stage === 'burning') {
    buffs.push(unit.abilities.includes('fireborn')
      ? { id: 'fire', icon: 'fire', label: 'On fire', value: 'Unharmed', good: true }
      : { id: 'fire', icon: 'fire', label: 'On fire', value: `-${FIRE_DAMAGE} health/turn`, good: false });
  } else if (hex.fire?.stage === 'smoulder' && !unit.abilities.includes('fireborn')) {
    buffs.push({ id: 'embers', icon: 'fire', label: 'Embers', value: 'Catches fire next turn', good: false });
  }
  if (effect.damagePerTurn) {
    const immune = (hex.terrain === 'lava' && unit.abilities.includes('fireborn')) || (hex.terrain === 'cursed' && unit.abilities.includes('undead'));
    buffs.push(immune
      ? { id: 'scorch', terrain: hex.terrain, label: effect.name, value: hex.terrain === 'cursed' ? `+${effect.damagePerTurn} health/turn` : 'Unharmed', good: true }
      : { id: 'scorch', terrain: hex.terrain, label: effect.name, value: `-${effect.damagePerTurn} health/turn`, good: false });
  }
  // The ground
  if (hex.heightOffset) {
    buffs.push({
      id: 'dug', terrain: hex.terrain, label: hex.heightOffset > 0 ? 'Raised ground' : 'Sunken ground',
      value: `${hex.heightOffset > 0 ? '+' : ''}${hex.heightOffset.toFixed(2)} height`, good: hex.heightOffset > 0
    });
  }
  if (effect.damageTakenMultiplier < 1) {
    buffs.push({ id: 'cover', terrain: hex.terrain, label: `${effect.name} cover`, value: `-${pct(1 - effect.damageTakenMultiplier)} damage`, good: true });
  }
  if (effect.elevation >= HIGH_GROUND_ELEVATION) {
    buffs.push({ id: 'high', terrain: hex.terrain, label: 'High ground', value: `+${pct(HEIGHT_DAMAGE_PER_UNIT)} attack per height${unit.abilities.includes('rangedAttack') ? ', +1 range' : ''}`, good: true });
  }
  if (effect.elevation < 1) {
    buffs.push({ id: 'low', terrain: hex.terrain, label: 'Low ground', value: `+${pct(HEIGHT_DAMAGE_PER_UNIT)} damage taken per height`, good: false });
  }
  if (hex.terrain === 'forest' && unit.abilities.includes('terrainBonus')) {
    buffs.push({ id: 'pikes', icon: 'attack', label: 'Forest pikes', value: `+${pct(TERRAIN_BONUS_ATTACK_MULTIPLIER - 1)} attack`, good: true });
  }
  if (effect.healPerTurn) {
    buffs.push({ id: 'heal', terrain: hex.terrain, label: effect.name, value: `+${effect.healPerTurn} health/turn`, good: true });
  }
  if (hex.isResourceHex) {
    buffs.push({ id: 'gold', icon: 'gold', label: 'Gold mine', value: `+${hex.resourceValue ?? 0} gold/turn`, good: true });
  }
  return buffs;
};

interface DamagePopup {
  id: number;
  position: [number, number, number];
  // Gold paid out for this unit's destruction, shown with a skull
  bounty?: number;
  text: string;
  color: string;
}

// How long after the turn's state lands a gathered material flies off (once the troop has walked there)
const GATHER_POPUP_DELAY = 1100;

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
  showThreats = false,
  tutorial = null,
  viewer = 'player'
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const unitIdsRef = useRef(unitIds);
  unitIdsRef.current = unitIds;
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  // Your castle wears the style you picked
  const castleStyleId = useProfile().cosmetics.castleStyle;
  const playerCastleStyle = getCastleStyle(castleStyleId);
  // (in a battle between more sides your castle is built in your side's colour, unless you picked a
  // style of your own)
  const wearsStyle = !isMultiSide(gameState) || (!!castleStyleId && castleStyleId !== DEFAULT_CASTLE_STYLE);
  // Units destroyed a moment ago, still falling on the battlefield
  const [dyingUnits, setDyingUnits] = useState<{ unit: Unit; position: [number, number, number]; fallen: boolean }[]>([]);

  const { hexGrid, currentPhase, pendingMoves, pendingPurchases, combats, players, turnNumber } = gameState;
  const activePlayerSide = getActivePlayer(gameState);
  // Tells one battle from the next (a new battle has new players)
  const gameId = Object.values(players)[0]?.id ?? '';
  // Where a side's troops face when there is nothing nearer: the enemy castle nearest its own
  const enemyCenterOf = (side: PlayerType): [number, number, number] | null => {
    const home = findBaseHex(gameState, side)?.coordinates;
    const castle = getEnemySides(gameState, side)
      .map(enemy => findBaseHex(gameState, enemy))
      .filter((hex): hex is Hex => !!hex)
      .sort((a, b) => (home ? getHexDistance(home, a.coordinates) - getHexDistance(home, b.coordinates) : 0))[0];
    return castle ? axialToWorld(castle.coordinates) : null;
  };
  const isSetupPhase = currentPhase === 'setup';

  const hexByKey = useMemo(() => new Map(hexGrid.map(hex => [coordKey(hex.coordinates), hex])), [hexGrid]);
  // The map's decor style (a dungeon's stone floors and pillars, a haunted wood's pumpkins)
  const decor = ALL_THEMES.find(theme => theme.name === gameState.mapName)?.decor;
  const hoveredHex = hoveredKey ? hexByKey.get(hoveredKey) ?? null : null;

  // Which hexes are highlighted and how
  const validMoveKeys = useMemo(() => new Set(validMoves.map(coordKey)), [validMoves]);
  // During setup: the castle sites on offer (or, without a list, anywhere a castle may go)
  const validBaseKeys = useMemo(
    () => !isSetupPhase ? new Set<string>()
      : new Set((gameState.castleChoices ?? getValidBaseLocations(gameState).map(h => h.coordinates)).map(coordKey)),
    // Castle sites only depend on the map during setup
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSetupPhase, hexGrid, gameState.castleChoices]
  );

  // Hexes the selected troop can work on (demolish, set alight, build), highlighted like trees to fell
  const actionKeys = useMemo(() => {
    const live = selectedUnit && players[selectedUnit.owner].units.find(unit => unit.id === selectedUnit.id);
    return new Set(live && live.owner === viewer ? getActionTargets(gameState, live).map(target => coordKey(target.at)) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnit, players, hexGrid, pendingMoves]);

  const getHighlight = (key: string): HexHighlight => {
    if (isSetupPhase) return validBaseKeys.has(key) ? 'base' : 'none';
    if (!validMoveKeys.has(key)) return 'none';
    if (hexByKey.get(key)?.feature === 'greatTree' || actionKeys.has(key)) return 'fell';
    return selectedUnitTypeForPurchase ? 'deploy' : 'move';
  };

  const selectedKey = selectedHex ? coordKey(selectedHex.coordinates) : null;

  // The special effects at work in each of the turn's battles, called out above them
  const battleCallouts = useMemo(() => {
    if (currentPhase !== 'combat') return [];
    return combats.flatMap((combat, index) => {
      if (combat.resolved) return [];
      const hex = hexByKey.get(coordKey(combat.hexCoordinates));
      const effects = getCombatEffects(gameState, combat);
      return hex && effects.length > 0
        ? [{ key: `callout-${turnNumber}-${index}`, hex, effects, playerAttacking: areAllies(gameState, combat.attackers[0]?.owner, viewer) }]
        : [];
    });
    // The turn's battles decide the callouts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase, combats, hexByKey, turnNumber]);

  // --- Fog and threats ------------------------------------------------------------------------

  // Hexes the player's troops can see (null without fog)
  const visibleKeys = useMemo(
    () => (isFogOfWar(gameState) ? getVisibleHexKeys(gameState, viewer) : null),
    // Sight only changes when units move or camps change hands
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, hexGrid]
  );
  const threats = useMemo(
    () => (showThreats ? getThreats(gameState, viewer) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showThreats, players, hexGrid]
  );
  const threatLevels = useMemo(() => (threats ? getThreatLevels(threats) : null), [threats]);
  // Enemy troops that slipped back into the fog, marked where they were last seen
  const lastSeen = useMemo(() => {
    const occupied = new Set(getAllUnits(gameState).map(unit => coordKey(unit.position)));
    return getRememberedEnemies(gameState, viewer).flatMap(sighting => {
      const hex = hexByKey.get(coordKey(sighting.unit.position));
      return hex && !occupied.has(coordKey(hex.coordinates)) ? [{ ...sighting, hex }] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, hexByKey, gameState.sightings]);
  // With a troop selected: the most damage it could take next turn on each hex it can move to
  const damageLabels = useMemo(() => {
    if (!threats || !selectedUnit || selectedUnit.owner !== viewer) return [];
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

  const stateUnits = useMemo(() => getAllUnits({ players }), [players]);
  // The units as the board shows them: each change to their health outside a fight shows when its
  // animation lands, and a troop it destroyed stands until then (see healthTimeline)
  const timeline = useHealthTimeline(gameState, stateUnits);
  const allUnits = timeline.units;
  const landedRef = useRef(timeline.landed);
  landedRef.current = timeline.landed;

  // Per-unit render data, memoised so units only re-render when something about them changes
  const unitRenderData = useMemo(() => {
    // (each side faces the enemy castle nearest its own)
    const enemyBaseCenters: Record<PlayerType, [number, number] | null> = {};
    for (const side of Object.keys(players)) {
      const home = findBaseHex(gameState, side)?.coordinates;
      const enemyBase = getEnemySides(gameState, side)
        .map(enemy => findBaseHex(gameState, enemy))
        .filter((hex): hex is Hex => !!hex)
        .sort((a, b) => (home ? getHexDistance(home, a.coordinates) - getHexDistance(home, b.coordinates) : 0))[0];
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
      // Whom each fighter strikes, so they all stand down once that unit falls (to any fight)
      const targetOfFighter = new Map<string, string>();
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

        // Who strikes each unit: attackers are struck back by the defenders (if they can reach them),
        // defenders by the attackers
        const strikersOf = (unit: Unit) => liveAttackers.some(a => a.id === unit.id)
          ? (hitBack.has(unit.id) ? liveDefenders : [])
          : liveAttackers;
        const fighters = [...liveAttackers, ...liveDefenders];
        // A striker lands no more blows than the damage it deals, so every blow visibly lands
        const blowLimit = new Map<string, number>();
        for (const unit of fighters) {
          const strikers = strikersOf(unit);
          const share = Math.max(1, Math.floor((damageTo.get(unit.id) ?? 0) / Math.max(1, strikers.length)));
          for (const striker of strikers) blowLimit.set(striker.id, Math.min(blowLimit.get(striker.id) ?? Infinity, share));
        }
        // When a striker's blows land; a fallen unit strikes no more
        const blowsBy = (striker: Unit, diesAt: Map<string, number | null>) =>
          getImpactTimesUntil(striker, diesAt.get(striker.id) ?? null).slice(0, blowLimit.get(striker.id) ?? Infinity);
        const blowsOn = (unit: Unit, diesAt: Map<string, number | null>) =>
          strikersOf(unit).flatMap(striker => blowsBy(striker, diesAt)).sort((a, b) => a - b);
        const deathsOf = (diesAt: Map<string, number | null>) => new Map(fighters.map(unit =>
          [unit.id, getDeathTime(blowsOn(unit, diesAt), damageTo.get(unit.id) ?? 0, unit.lifespan)]));
        const firstGuess = deathsOf(new Map());
        const diesAt = deathsOf(firstGuess);

        const defenderAt = liveDefenders.find(d => coordKey(d.position) === coordKey(combat.hexCoordinates)) ?? liveDefenders[0];
        for (const attacker of liveAttackers) {
          if (defenderAt) targetOfFighter.set(attacker.id, defenderAt.id);
          battles.set(attacker.id, {
            key,
            target: worldOf(combat.hexCoordinates),
            startDelay,
            incoming: { times: blowsOn(attacker, diesAt), damage: damageTo.get(attacker.id) ?? 0 },
            strikes: blowsBy(attacker, diesAt).length,
            diesAt: diesAt.get(attacker.id) ?? null,
            targetDiesAt: defenderAt ? diesAt.get(defenderAt.id) ?? null : null
          });
        }
        for (const live of liveDefenders) {
          // Struck back at while it attacks something else: it keeps its own attack, and takes these
          // blows on top of any from that fight
          const prior = combat.intercept ? battles.get(live.id) : undefined;
          if (prior) {
            const damage = (prior.incoming?.damage ?? 0) + (damageTo.get(live.id) ?? 0);
            const allTimes = [...(prior.incoming?.times ?? []), ...blowsOn(live, diesAt)].sort((a, b) => a - b);
            const fallsAt = getDeathTime(allTimes, damage, live.lifespan);
            // Once it falls (to either fight), nobody strikes it again and no more blows land on it
            const times = fallsAt === null ? allTimes : allTimes.filter(time => time <= fallsAt);
            battles.set(live.id, { ...prior, incoming: { times, damage }, diesAt: fallsAt });
            if (fallsAt !== null) {
              for (const [id, targetId] of targetOfFighter) {
                const record = battles.get(id);
                if (targetId !== live.id || !record) continue;
                battles.set(id, { ...record, targetDiesAt: record.targetDiesAt == null ? fallsAt : Math.min(record.targetDiesAt, fallsAt) });
              }
            }
            continue;
          }
          const target = defenderTarget.get(live.id) ?? null;
          if (target) targetOfFighter.set(live.id, target.id);
          battles.set(live.id, {
            key,
            target: target ? worldOf(target.position) : null,
            startDelay,
            incoming: { times: blowsOn(live, diesAt), damage: damageTo.get(live.id) ?? 0 },
            strikes: target && hitBack.size > 0 ? blowsBy(live, diesAt).length : 0,
            diesAt: diesAt.get(live.id) ?? null,
            targetDiesAt: target ? diesAt.get(target.id) ?? null : null
          });
        }
      });
    }

    // Troops attacking a castle strike at it, one blow per point of damage they deal
    for (const besieged of currentPhase === 'combat' && gameState.siege ? getBesiegedCastles(gameState) : []) {
      const siegeBlows = getSiegeBlows(gameState, besieged.side);
      const castle = findBaseHex(gameState, besieged.side);
      if (castle && gameState.siege) {
        const target = surfacePosition(castle);
        for (const id of besieged.attackerIds) {
          combatFacing.set(id, castle.coordinates);
          // Guards may be striking it as it attacks: keep the blows it takes
          const struck = battles.get(id);
          battles.set(id, {
            key: `${turnNumber}-${gameState.siege.side}-siege`,
            target,
            startDelay: getBattleStartDelay(),
            incoming: struck?.incoming,
            strikes: siegeBlows.blows.get(id)?.length ?? 0,
            diesAt: struck?.diesAt ?? null,
            // Once the castle's health runs out, its attackers stand down
            targetDiesAt: siegeBlows.fallsAt
          });
        }
      }
    }

    const plannedUnitIds = new Set(pendingMoves.map(m => m.unitId));

    return allUnits.map(unit => {
      const hex = hexByKey.get(coordKey(unit.position));
      const enemies = getEnemyUnits(gameState, unit.owner);

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
        buffs: getUnitBuffs(gameState, unit, hex)
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
        buffs: buffKey(previous.buffs) === buffKey(data.buffs) ? previous.buffs : data.buffs,
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
      const owner: PlayerType = Object.values(players).find(player => player.id === purchase.playerId)?.type ?? 'ai';
      const id = `pending-${coordKey(purchase.position)}`;
      const previous = pendingUnitCache.current.get(id);
      if (previous && previous.unit.type === purchase.unitType && previous.unit.owner === owner) {
        next.set(id, previous);
        continue;
      }

      const info = getRosterStats(gameState, owner, purchase.unitType);
      if (!info) continue;
      // Face the enemy castle, like units already on the board
      const enemyCenter = enemyCenterOf(owner);
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
  }, [pendingPurchases, hexByKey, hexGrid, gameId]);

  // --- Planned moves -----------------------------------------------------------------------

  const plannedPaths = useMemo(() => pendingMoves.flatMap(move => {
    const unit = allUnits.find(u => u.id === move.unitId);
    // (orders to fell a tree show where it will land instead)
    if (!unit || move.action || hexByKey.get(coordKey(move.to))?.feature === 'greatTree') return [];

    const stateWithoutMove = { ...gameState, pendingMoves: pendingMoves.filter(m => m !== move) };
    const route = getMovePath(stateWithoutMove, unit, move.to) ?? [unit.position, move.to];
    const points = route
      .map(c => hexByKey.get(coordKey(c)))
      .filter((hex): hex is Hex => !!hex)
      .map(hex => toVector(surfacePosition(hex)));

    return [{ id: move.unitId, points, color: sideColor(unit.owner) }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pendingMoves, allUnits, hexByKey]);

  // Trees about to fall: the ones ordered felled, and the one the selected troop is pointing at
  const fellMarkers = useMemo(() => {
    const orders = pendingMoves
      .filter(move => hexByKey.get(coordKey(move.to))?.feature === 'greatTree')
      .map(move => ({ unit: allUnits.find(u => u.id === move.unitId), tree: move.to }));
    const hovered = hoveredKey && hexByKey.get(hoveredKey);
    if (selectedUnit && hovered && hovered.feature === 'greatTree' && validMoveKeys.has(hoveredKey) &&
      !orders.some(order => coordKey(order.tree) === hoveredKey)) {
      orders.push({ unit: selectedUnit, tree: hovered.coordinates });
    }
    return orders.flatMap(({ unit, tree }) => {
      const landing = unit && getFellLanding(gameState, unit.position, tree);
      const hex = landing && hexByKey.get(coordKey(landing));
      return hex ? [{ key: coordKey(tree), hex, crushes: !!hex.unit }] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMoves, allUnits, hexByKey, hoveredKey, selectedUnit, validMoveKeys]);

  // Preview the route to the hovered hex while a unit is selected
  const hoverPreviewPath = useMemo(() => {
    if (!selectedUnit || selectedUnit.owner !== viewer || !hoveredKey || !validMoveKeys.has(hoveredKey)) return null;
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
  const previousGameIdRef = useRef(gameId);
  // (who fights whom, for the coins a fallen enemy pays out)
  const sidesRef = useRef({ state: gameState, viewer });
  sidesRef.current = { state: gameState, viewer };
  const popupIdRef = useRef(0);
  const popupTimeoutsRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => () => popupTimeoutsRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    // A new game started - forget the old units instead of reporting them all as destroyed
    if (previousGameIdRef.current !== gameId) {
      previousGameIdRef.current = gameId;
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
        // (the blow that destroyed it outside a fight, which it fell before it could show)
        const blow = landedRef.current.get(id)?.find(change => change.fatal);
        if (blow) {
          created.push({
            id: ++popupIdRef.current,
            position: [before.position[0], before.position[1] + 0.7, before.position[2]],
            text: `${blow.amount}`,
            color: '#f87171'
          });
        }
        fallen.push(before);
        playBattleSound('unitFalls', 0.8);
        // Coins fly from the fallen enemy to the player's treasury
        if (!areAllies(sidesRef.current.state, before.unit.owner, sidesRef.current.viewer)) {
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
  }, [unitRenderData, gameId]);

  // Materials gathered this turn fly from where they were found into the satchel
  const gatheredSeenRef = useRef<{ game: string; serial: number } | null>(null);
  useEffect(() => {
    const gathered = gameState.gathered ?? [];
    const latest = gathered[gathered.length - 1]?.serial ?? 0;
    const seen = gatheredSeenRef.current;
    gatheredSeenRef.current = { game: gameId, serial: latest };
    // (nothing to show for what was gathered before the board appeared; in a battle begun since, all
    // of it is new)
    if (!seen) return;
    const after = seen.game === gameId ? seen.serial : 0;
    const fresh = gathered.filter(entry => entry.serial > after && isMaterialId(entry.material));
    if (fresh.length === 0) return;
    const timeout = setTimeout(() => {
      popupTimeoutsRef.current.delete(timeout);
      let flown = 0;
      for (const entry of fresh) {
        const hex = hexByKey.get(coordKey(entry.at));
        const screen = hex && projectToScreen((([x, y, z]) => [x, y + 0.3, z] as [number, number, number])(surfacePosition(hex)));
        if (!screen) continue;
        emitMaterial(screen, entry.material, flown * 0.15);
        flown++;
      }
      if (flown > 0) playBattleSound('bounty', 0.4);
    }, GATHER_POPUP_DELAY / getTimeScale());
    popupTimeoutsRef.current.add(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.gathered, gameId]);

  // --- Rendering ---------------------------------------------------------------------------

  // Fit the shadow map to the board (plus headroom for castles and units) so shadows stay crisp
  const boardRadius = (gameState.settings?.gridSize ?? DEFAULT_SETTINGS.gridSize) * Math.sqrt(3) + HEX_SIZE;
  const shadowExtent = boardRadius + 2;
  const shadowFar = SHADOW_LIGHT_DISTANCE + boardRadius + 10;

  // Every castle on the board (the castles of sides knocked out stand in ruins)
  const castleSignature = hexGrid.filter(hex => hex.isBase).map(hex => `${coordKey(hex.coordinates)}:${hex.owner ?? ''}`).join('|');
  const castles = useMemo(
    () => hexGrid.filter(hex => hex.isBase && hex.owner).map(hex => ({ owner: hex.owner!, position: surfacePosition(hex) })),
    // Only castles going up matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [castleSignature]
  );
  // The castles under attack in the battle being fought, and the blows landing on each
  const castleIncoming = useMemo((): Map<PlayerType, CastleIncoming> => {
    const incoming = new Map<PlayerType, CastleIncoming>();
    if (currentPhase !== 'combat' || !gameState.siege) return incoming;
    for (const { side } of getBesiegedCastles(gameState)) {
      const { hits, damage } = getSiegeBlows(gameState, side);
      if (hits.length === 0 || damage === 0) continue;
      incoming.set(side, {
        key: `${turnNumber}-${gameState.siege.side}-siege-${side}`,
        startDelay: getBattleStartDelay(),
        times: hits.map(hit => hit.time),
        amounts: hits.map(hit => hit.amount),
        damage
      });
    }
    return incoming;
    // The siege and the fights around it decide the blows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase, gameState.siege, combats, players, turnNumber]);

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
            decor={decor}
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

      {/* Callouts over each battle for the special effects at work in it */}
      {battleCallouts.map(({ key, hex, effects, playerAttacking }) => (
        <Html key={key} position={calloutPosition(hex)} center zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center gap-0.5">
            {strongestEffects(effects, MAX_CALLOUTS).map((effect, index) => {
              const helpsYou = effect.tone === 'neutral' ? null : (effect.tone === 'good') === playerAttacking;
              return (
                <span
                  key={effect.label}
                  className="battle-callout flex items-stretch overflow-hidden whitespace-nowrap rounded-full text-xs shadow-lg"
                  style={{
                    animationDelay: `${getBattleStartDelay() / getGameSpeed() + index * 0.18}s`,
                    animationDuration: `${2.6 / getGameSpeed()}s`
                  }}
                >
                  {/* The number (if it has one) on a light chip, then the effect's name */}
                  {effect.value && (
                    <span className="flex items-center bg-slate-100 px-1.5 font-bold tabular-nums text-slate-800">{effect.value}</span>
                  )}
                  <span
                    className="font-display flex items-center gap-1 px-2 py-0.5"
                    style={{
                      background: helpsYou === null ? '#fbbf24' : helpsYou ? '#34d399' : '#fb7185',
                      color: '#0f172a'
                    }}
                  >
                    {/* A shape as well as a colour: up for you, down for the enemy */}
                    <span aria-hidden className="text-[0.625rem]">{helpsYou === null ? '!' : helpsYou ? '▲' : '▼'}</span>
                    {effect.label}
                  </span>
                </span>
              );
            })}
          </div>
        </Html>
      ))}

      {/* Last-seen markers for enemies hidden in the fog */}
      {lastSeen.map(({ unit, turn, hex }) => (
        <Html key={`seen-${unit.id}`} position={labelPosition(hex)} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
          <span
            className="flex items-center gap-0.5 whitespace-nowrap rounded-full border-2 border-dashed border-red-400/70 bg-slate-900/60 px-1.5 py-0.5 text-[0.6875rem] font-bold text-red-200 opacity-80"
            title={`${getUnitTypeName(unit.type)} last seen here ${turnNumber - turn <= 0 ? 'this round' : `${turnNumber - turn} round${turnNumber - turn === 1 ? '' : 's'} ago`}`}
          >
            <UnitIcon type={unit.type} className="text-[0.8125rem]" />?
          </span>
        </Html>
      ))}

      {/* Trees, peaks, dunes and gold that show each hex's terrain */}
      <BoardDecorations hexGrid={hexGrid} decor={decor} mapName={gameState.mapName} />
      {/* The tutorial's marks: your castle, the enemy castle to take, the hex to tap, the way there */}
      {tutorial && <TutorialMarkers visuals={tutorial} hexByKey={hexByKey} />}
      {/* Great trees, felled trunks and fires */}
      <BattlefieldObjects hexGrid={hexGrid} lastFell={gameState.lastFell} lastBombard={gameState.lastBombard} visibleKeys={visibleKeys} />
      {/* Bosses' powers: the ground they have marked to strike, and each power as it lands */}
      <BossThreats units={stateUnits} hexByKey={hexByKey} />
      <BossPowerBursts last={gameState.lastBossPower} hexByKey={hexByKey} />
      <WeatherEffects gameState={gameState} />

      {/* Castles (yours wears the style you picked) */}
      {castles.map(({ owner, position }) => (
        <Castle
          key={owner}
          owner={owner}
          look={owner === viewer && wearsStyle ? playerCastleStyle : undefined}
          name={isMultiSide(gameState) ? players[owner]?.name : undefined}
          position={position}
          health={timeline.castleHealth(owner, players[owner]?.baseHealth ?? BASE_MAX_HEALTH)}
          maxHealth={players[owner]?.maxBaseHealth ?? BASE_MAX_HEALTH}
          incoming={castleIncoming.get(owner)}
          fallen={isMultiSide(gameState)
            ? !!players[owner]?.eliminated && (players[owner]?.baseHealth ?? 1) <= 0
            : currentPhase === 'gameOver' && gameState.winReason === 'destroyed' && gameState.winner !== owner}
        />
      ))}

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
          buffs={data.buffs}
          changes={timeline.landed.get(data.unit.id)}
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

      {/* Work ordered this turn: what each troop will do to the hex next to it */}
      {pendingMoves.filter(move => move.action).map(move => {
        const hex = hexByKey.get(coordKey(move.to));
        return hex && (
          <Html key={`work-${move.unitId}`} position={labelPosition(hex)} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
            <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.6875rem] font-bold text-slate-900 shadow select-none">
              <ActionIcon action={move.action!} />{ACTION_NAMES[move.action!]}
            </span>
          </Html>
        );
      })}

      {/* Where felled trees will land */}
      {fellMarkers.map(marker => (
        <Html key={`fell-${marker.key}`} position={labelPosition(marker.hex)} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <span
            className={`flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold shadow select-none ${marker.crushes ? 'bg-rose-600 text-white' : 'bg-slate-900/85 text-amber-200'}`}
            title={`The tree lands here${marker.crushes ? `: -${FELL_DAMAGE} to the troop on it` : ', leaving its trunk across the hex'}`}
          >
            <FellIcon color="currentColor" />{marker.crushes ? `-${FELL_DAMAGE}` : <FallenLogIcon color="currentColor" />}
          </span>
        </Html>
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
        <HoverTooltip hex={hoveredHex} gameState={gameState} viewer={viewer} />
      )}
    </>
  );
};

// One-line description of the hovered hex: its terrain effect and what's standing on it
const HoverTooltip: React.FC<{ hex: Hex; gameState: GameState; viewer: PlayerType }> = ({ hex, gameState, viewer }) => {
  const [x, y, z] = surfacePosition(hex);
  const holder = !hex.owner ? 'unclaimed' : hex.owner === viewer ? 'yours'
    : isMultiSide(gameState) ? `${gameState.players[hex.owner]?.name ?? 'enemy'}${areAllies(gameState, hex.owner, viewer) ? ' (ally)' : ''}` : 'enemy';
  const effect = hex.isCamp
    ? hex.owner === viewer ? 'your camp: recruits deploy here' : `${!hex.owner ? 'neutral' : holder} camp: move onto it to capture`
    : hex.isResourceHex
      ? `+${hex.resourceValue ?? 0} gold/turn`
      : TERRAIN_SHORT_EFFECTS[hex.terrain];
  // What is on the hex, which matters more than its ground
  const object = hex.fire?.stage === 'burning'
    ? <><FireIcon /> On fire: impassable, -{FIRE_DAMAGE} health/turn to troops caught in it</>
    : hex.fire?.stage === 'smoulder'
      ? <><EmbersIcon /> Embers: catches fire next turn</>
      : hex.feature === 'greatTree'
        ? <><FellIcon /> Great tree: blocks the way and arrows. Chop it from a hex next to it: it falls away from you (-{FELL_DAMAGE})</>
        : hex.feature === 'log'
          ? <><FallenLogIcon /> Fallen trunk: blocks the way</>
          : hex.feature === 'logBridge'
            ? <><FallenLogIcon /> Log bridge: troops can cross</>
            : hex.feature === 'stakes'
              ? <><StakesIcon /> Stakes: cavalry can&apos;t cross, +1 movement for others</>
              : null;

  return (
    <Html position={[x, y + 0.2, z]} zIndexRange={[9, 0]} style={{ pointerEvents: 'none' }}>
      <div className="ml-5 -mt-5 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[0.6875rem] text-slate-100 shadow-lg select-none">
        <span className="font-bold">
          {hex.isCamp ? <><CampIcon /> Camp</> : <><TerrainIcon terrain={hex.terrain} /> {TERRAIN_EFFECTS[hex.terrain].name}</>}
        </span>
        <span className="text-slate-400"> · height {getHexHeight(hex).toFixed(1)}</span>
        {isCapturable(hex.terrain) && (
          <span className="font-semibold" style={{ color: hex.owner ? sideColor(hex.owner) : '#cbd5e1' }}>
            {' '}· {holder}
          </span>
        )}
        {object ? <span className="text-amber-200"> · {object}</span> : <span className="text-slate-400"> · {effect}</span>}
        {hex.unit && (
          <span className="ml-1 font-semibold" style={{ color: sideColor(hex.unit.owner) }}>
            · {getUnitTypeName(hex.unit.type)} <HealthIcon /> {hex.unit.lifespan}
          </span>
        )}
      </div>
    </Html>
  );
};
