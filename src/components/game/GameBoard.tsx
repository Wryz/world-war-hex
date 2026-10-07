import { memo, useState, useCallback, useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GameState, Hex, HexCoordinates, PlayerType, Unit, UnitType } from '@/types/game';
import { HexTile, HexHighlight } from './HexTile';
import { UnitMesh, UnitBattle, OWNER_COLORS } from './UnitMesh';
import { Castle } from './Castle';
import { BoardDecorations } from './BoardDecorations';
import { MovePath } from './MovePath';
import {
  UNITS,
  BASE_MAX_HEALTH,
  TERRAIN_EFFECTS,
  getKillBounty,
  findBaseHex,
  findTerrainPath,
  getActivePlayer,
  getAttackRange,
  getMovePath,
  getValidBaseLocations
} from '@/lib/game/gameState';
import { getHexDistance } from '@/lib/game/hexUtils';
import { axialToWorld, getHexSurfaceHeight } from './utils/boardGeometry';
import { useLoadingManager } from './utils/LoadingManager';
import { AnimatedUnitPreview } from './AnimatedUnitPreview';
import { playSound } from './utils/SoundPlayer';
import { playBattleSound } from './utils/battleSounds';
import { getUnitTypeName } from './utils/UnitHelpers';
import { TERRAIN_SHORT_EFFECTS } from './hud/terrainInfo';
import { AttackIcon, GoldIcon, HealthIcon, SkullIcon, TerrainIcon } from './icons';
import type { UnitBadge } from './UnitMesh';

const coordKey = (c: HexCoordinates) => `${c.q},${c.r}`;

// Camera framing: a fixed, almost top-down view from behind the active side's castle
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(68);
const CAMERA_FOV = 45;
// Radius of the playing field in world units, plus a margin for the HUD
const BOARD_VIEW_RADIUS = 16.5;
// Look slightly towards the viewing side's castle so it stays clear of the bottom HUD
const CAMERA_TARGET_OFFSET = 6;
const CAMERA_TURN_SPEED = 2.2;
// Zoom levels as a fraction of the distance at which the whole board fits on screen
const CAMERA_DEFAULT_ZOOM = 0.8;
const CAMERA_FOCUS_ZOOM = 0.55;
const CAMERA_MIN_ZOOM = 0.35;
const CAMERA_MAX_ZOOM = 1.1;
// How quickly the camera follows zoom and focus changes, and how strongly the wheel zooms
const CAMERA_ZOOM_SPEED = 6;
const CAMERA_WHEEL_SPEED = 0.0015;
// Furthest the view can be panned from the centre of the board (world units)
const CAMERA_MAX_PAN = 12;

interface GameBoardProps {
  gameState: GameState;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (unit: Unit) => void;
  onUnitPurchase: (unitType: UnitType, hex: Hex) => boolean;
  selectedHex?: Hex;
  selectedUnit?: Unit | null;
  validMoves?: HexCoordinates[];
  selectedUnitTypeForPurchase?: UnitType | null;
  gameStarted: boolean;
  isAITurn: boolean;
}

const GameBoardComponent: React.FC<GameBoardProps> = (props) => {
  // Use loading state from the parent provider
  const { isComplete: assetsLoaded } = useLoadingManager();

  // Zoom in on the player's selected unit while they plan its move
  const { selectedUnit, gameState } = props;
  const focusQ = selectedUnit?.position.q;
  const focusR = selectedUnit?.position.r;
  const isFocusing = selectedUnit?.owner === 'player' && gameState.currentPhase === 'planning' && !props.isAITurn;
  const cameraFocus = useMemo<[number, number] | null>(() => {
    if (!isFocusing || focusQ === undefined || focusR === undefined) return null;
    const [x, , z] = axialToWorld({ q: focusQ, r: focusR });
    return [x, z];
  }, [isFocusing, focusQ, focusR]);

  return (
    // Bright sky gradient behind the floating battlefield
    <div className="w-full h-full" style={{ background: 'radial-gradient(ellipse at 50% 40%, #e0f4ff 0%, #b3e1ff 55%, #8ccfff 100%)' }}>
      {/* Flat (no tone mapping) keeps the low-poly colours bright and true; cap the pixel ratio for smoothness */}
      <Canvas shadows flat dpr={[1, 1.5]}>
        <Suspense fallback={null}>

          <BoardScene {...props} assetsLoaded={assetsLoaded} />

          <PerspectiveCamera makeDefault fov={CAMERA_FOV} near={0.1} far={3000} position={[0, 35, 14]} />
          <CameraRig gameState={props.gameState} focus={cameraFocus} />
        </Suspense>
      </Canvas>
    </div>
  );
};

// Memoised so HUD updates (like the turn timer) don't re-render the 3D scene
export const GameBoard = memo(GameBoardComponent);

// Smallest signed difference between two angles
const angleDelta = (from: number, to: number) => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

// Fixed camera that looks down on the board from behind the castle of the side whose turn it is,
// swinging smoothly around the board when the turn changes. The player can't move it.
const CameraRig: React.FC<{ gameState: GameState; focus: [number, number] | null }> = ({ gameState, focus }) => {
  const { camera, size, gl } = useThree();
  const azimuthRef = useRef<number | null>(null);

  // Where the camera looks and how far it is pulled back (1 = whole board fits); smoothed every frame
  const lookAtRef = useRef<THREE.Vector3 | null>(null);
  const zoomRef = useRef(CAMERA_DEFAULT_ZOOM);
  // Where the player (or a selection / turn change) wants the camera to go
  const desiredLookAtRef = useRef<THREE.Vector3 | null>(null);
  const desiredZoomRef = useRef(CAMERA_DEFAULT_ZOOM);
  // View to return to after a unit is deselected
  const savedViewRef = useRef<{ lookAt: THREE.Vector3; zoom: number } | null>(null);

  const viewSide: PlayerType = gameState.currentPhase === 'setup' ? 'player' : getActivePlayer(gameState);

  const targetAzimuth = useMemo(() => {
    const base = findBaseHex(gameState, viewSide);
    if (!base) return 0;
    const [x, , z] = axialToWorld(base.coordinates);
    // Camera sits on the castle's side of the board, looking across it
    return Math.atan2(x, z);
    // Only depends on where the bases are, not on the rest of the state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players.player.baseLocation, gameState.players.ai.baseLocation, viewSide]);

  // Default overview: look across the board from just in front of the active side's castle
  const defaultLookAt = useMemo(
    () => new THREE.Vector3(Math.sin(targetAzimuth) * CAMERA_TARGET_OFFSET, 0, Math.cos(targetAzimuth) * CAMERA_TARGET_OFFSET),
    [targetAzimuth]
  );

  // New turn (or castles placed): swing to the active side's default view
  useEffect(() => {
    desiredLookAtRef.current = defaultLookAt.clone();
    desiredZoomRef.current = CAMERA_DEFAULT_ZOOM;
    savedViewRef.current = null;
  }, [defaultLookAt]);

  // Selecting a unit eases in on it; deselecting returns to the previous view
  useEffect(() => {
    if (focus) {
      if (!savedViewRef.current && desiredLookAtRef.current) {
        savedViewRef.current = { lookAt: desiredLookAtRef.current.clone(), zoom: desiredZoomRef.current };
      }
      desiredLookAtRef.current = new THREE.Vector3(focus[0], 0, focus[1]);
      desiredZoomRef.current = Math.min(desiredZoomRef.current, CAMERA_FOCUS_ZOOM);
    } else if (savedViewRef.current) {
      desiredLookAtRef.current = savedViewRef.current.lookAt;
      desiredZoomRef.current = savedViewRef.current.zoom;
      savedViewRef.current = null;
    }
  }, [focus]);

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
        if (horizontal > CAMERA_MAX_PAN) desiredLookAt.multiplyScalar(CAMERA_MAX_PAN / horizontal);
      }
      desiredZoomRef.current = nextZoom;
      // Manual zoom replaces the "return after deselecting" view
      savedViewRef.current = null;
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

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const ease = Math.min(1, delta * CAMERA_TURN_SPEED);
    const current = azimuthRef.current ?? targetAzimuth;
    const azimuth = current + angleDelta(current, targetAzimuth) * ease;
    azimuthRef.current = azimuth;

    const desiredLookAt = desiredLookAtRef.current ?? defaultLookAt;
    if (!lookAtRef.current) lookAtRef.current = desiredLookAt.clone();
    lookAtRef.current.lerp(desiredLookAt, Math.min(1, delta * CAMERA_ZOOM_SPEED));
    zoomRef.current += (desiredZoomRef.current - zoomRef.current) * Math.min(1, delta * CAMERA_ZOOM_SPEED);

    // Distance at which the whole board fits on screen, scaled by the zoom level
    const perspective = camera as THREE.PerspectiveCamera;
    const halfFov = THREE.MathUtils.degToRad(perspective.fov / 2);
    const aspect = size.width / Math.max(size.height, 1);
    const distance = Math.max(
      BOARD_VIEW_RADIUS / Math.tan(halfFov),
      BOARD_VIEW_RADIUS / (Math.tan(halfFov) * aspect)
    ) * zoomRef.current;

    const lookAt = lookAtRef.current;
    const horizontal = distance * Math.cos(CAMERA_ELEVATION);
    camera.position.set(
      lookAt.x + Math.sin(azimuth) * horizontal,
      distance * Math.sin(CAMERA_ELEVATION),
      lookAt.z + Math.cos(azimuth) * horizontal
    );
    camera.lookAt(lookAt);
  });

  return null;
};

interface BoardSceneProps extends GameBoardProps {
  assetsLoaded: boolean;
}

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

  if (TERRAIN_EFFECTS[hex.terrain].damageTakenMultiplier < 1) badges.push('cover');
  if (hex.terrain === 'forest' && unit.abilities.includes('terrainBonus')) badges.push('attack');
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
  selectedUnitTypeForPurchase = null
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [placedUnitHex, setPlacedUnitHex] = useState<Hex | null>(null);
  const [popups, setPopups] = useState<DamagePopup[]>([]);

  const { hexGrid, currentPhase, pendingMoves, pendingPurchases, combats, players, turnNumber } = gameState;
  const activePlayerSide = getActivePlayer(gameState);
  const isSetupPhase = currentPhase === 'setup';

  const hexByKey = useMemo(() => new Map(hexGrid.map(hex => [coordKey(hex.coordinates), hex])), [hexGrid]);
  const hoveredHex = hoveredKey ? hexByKey.get(hoveredKey) ?? null : null;

  // Clear the placement preview when leaving placement mode
  useEffect(() => {
    if (!selectedUnitTypeForPurchase || currentPhase !== 'planning') {
      setPlacedUnitHex(null);
    }
  }, [selectedUnitTypeForPurchase, currentPhase]);

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

  // --- Interaction -----------------------------------------------------------------------

  const confirmPurchase = (hex: Hex) => {
    if (!selectedUnitTypeForPurchase) return;
    if (onUnitPurchase(selectedUnitTypeForPurchase, hex)) {
      playSound('hex-select-sound', 0.5);
      setPlacedUnitHex(null);
    }
  };

  const handleHexClick = (hex: Hex) => {
    if (!assetsLoaded) return;
    const key = coordKey(hex.coordinates);

    // Placing a unit from the barracks: first click previews, second click confirms
    if (selectedUnitTypeForPurchase && validMoveKeys.has(key)) {
      if (placedUnitHex && coordKey(placedUnitHex.coordinates) === key) {
        confirmPurchase(hex);
        return;
      }
      setPlacedUnitHex(hex);
    }

    onHexClick(hex);
  };

  const handleHexDoubleClick = (hex: Hex) => {
    if (!assetsLoaded || currentPhase !== 'planning') return;
    if (selectedUnitTypeForPurchase && validMoveKeys.has(coordKey(hex.coordinates))) {
      confirmPurchase(hex);
    }
  };

  // Stable callbacks so memoised tiles and units don't re-render when unrelated state changes
  const handlersRef = useRef({ handleHexClick, handleHexDoubleClick, onUnitClick, assetsLoaded });
  handlersRef.current = { handleHexClick, handleHexDoubleClick, onUnitClick, assetsLoaded };

  const stableHexClick = useCallback((hex: Hex) => handlersRef.current.handleHexClick(hex), []);
  const stableHexDoubleClick = useCallback((hex: Hex) => handlersRef.current.handleHexDoubleClick(hex), []);
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
  const computeWalkPath = useCallback((from: HexCoordinates, to: HexCoordinates) => {
    const grid = hexGridRef.current;
    const byKey = new Map(grid.map(hex => [coordKey(hex.coordinates), hex]));
    return findTerrainPath(grid, from, to)
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
      const activeIndex = combats.findIndex(c => !c.resolved);
      combats.forEach((combat, index) => {
        if (combat.resolved) return;
        for (const defender of combat.defenders) {
          if (combat.attackers[0]) combatFacing.set(defender.id, combat.attackers[0].position);
        }
        for (const attacker of combat.attackers) combatFacing.set(attacker.id, combat.hexCoordinates);
        if (index !== activeIndex) return;

        const key = `${turnNumber}-${activePlayerSide}-${index}`;
        const worldOf = (coordinates: HexCoordinates): [number, number, number] => {
          const hex = hexByKey.get(coordKey(coordinates));
          return hex ? surfacePosition(hex) : axialToWorld(coordinates);
        };
        const liveAttackers = combat.attackers
          .map(a => players[a.owner].units.find(u => u.id === a.id))
          .filter((u): u is Unit => !!u);

        for (const attacker of liveAttackers) {
          battles.set(attacker.id, { key, target: worldOf(combat.hexCoordinates) });
        }
        for (const defender of combat.defenders) {
          const live = players[defender.owner].units.find(u => u.id === defender.id);
          if (!live) continue;
          // Defenders strike back at the nearest attacker they can reach
          const reachable = liveAttackers
            .filter(a => getHexDistance(a.position, live.position) <= getAttackRange(live))
            .sort((a, b) => getHexDistance(a.position, live.position) - getHexDistance(b.position, live.position));
          battles.set(defender.id, { key, target: reachable[0] ? worldOf(reachable[0].position) : null });
        }
      });
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
  }, [allUnits, hexByKey, combats, currentPhase, pendingMoves, players, turnNumber, activePlayerSide]);

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
        terrainBadges: sameArray(previous.terrainBadges, data.terrainBadges) ? previous.terrainBadges : data.terrainBadges
      } : data;
      next.set(data.unit.id, stable);
      return stable;
    });
    unitPropsCache.current = next;
    return result;
  }, [unitRenderData]);

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

  const previousUnitsRef = useRef(new Map<string, { unit: Unit; position: [number, number, number] }>());
  const previousGameIdRef = useRef(players.player.id);
  const popupIdRef = useRef(0);
  const popupTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => popupTimeoutsRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    // A new game started - forget the old units instead of reporting them all as destroyed
    if (previousGameIdRef.current !== players.player.id) {
      previousGameIdRef.current = players.player.id;
      previousUnitsRef.current = new Map();
    }

    const previous = previousUnitsRef.current;
    const next = new Map<string, { unit: Unit; position: [number, number, number] }>();
    const created: DamagePopup[] = [];

    for (const { unit, position } of unitRenderData) {
      next.set(unit.id, { unit, position });
      const before = previous.get(unit.id);
      if (before && unit.lifespan < before.unit.lifespan) {
        created.push({ id: ++popupIdRef.current, position, text: `-${before.unit.lifespan - unit.lifespan}`, color: '#f87171' });
      }
    }
    for (const [id, before] of previous) {
      if (!next.has(id)) {
        created.push({
          id: ++popupIdRef.current,
          position: before.position,
          text: '',
          color: '#ffffff',
          bounty: getKillBounty(before.unit)
        });
        playBattleSound('unitFalls', 0.8);
        // Coin chime when the player earns the bounty
        if (before.unit.owner === 'ai') playBattleSound('bounty', 0.6);
      }
    }
    previousUnitsRef.current = next;

    if (created.length === 0) return;
    setPopups(current => [...current, ...created]);
    const ids = new Set(created.map(p => p.id));
    popupTimeoutsRef.current.push(
      setTimeout(() => setPopups(current => current.filter(p => !ids.has(p.id))), 1600)
    );
  }, [unitRenderData, players.player.id]);

  // --- Rendering ---------------------------------------------------------------------------

  const unresolvedCombats = currentPhase === 'combat' ? combats.filter(c => !c.resolved) : [];
  const activeCombat = unresolvedCombats[0];
  const playerBase = findBaseHex(gameState, 'player');
  const aiBase = findBaseHex(gameState, 'ai');
  const playerCastlePosition = useMemo(() => playerBase ? surfacePosition(playerBase) : null, [playerBase]);
  const aiCastlePosition = useMemo(() => aiBase ? surfacePosition(aiBase) : null, [aiBase]);

  const showHoverPreview =
    assetsLoaded &&
    selectedUnitTypeForPurchase &&
    hoveredHex &&
    validMoveKeys.has(coordKey(hoveredHex.coordinates)) &&
    (!placedUnitHex || coordKey(placedUnitHex.coordinates) !== coordKey(hoveredHex.coordinates));

  return (
    <>
      {/* Soft, bright lighting for the low-poly look */}
      <hemisphereLight args={['#ffffff', '#9ccfe8', 1.6]} />
      <directionalLight
        position={[12, 30, 18]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={80}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
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
            onHexDoubleClick={stableHexDoubleClick}
            onHexHover={handleHexHover}
            onHexHoverEnd={handleHexHoverEnd}
          />
        );
      })}

      {/* Trees, peaks, dunes and gold that show each hex's terrain */}
      <BoardDecorations hexGrid={hexGrid} />

      {/* Castles */}
      {playerCastlePosition && (
        <Castle
          owner="player"
          position={playerCastlePosition}
          health={players.player.baseHealth ?? BASE_MAX_HEALTH}
          maxHealth={players.player.maxBaseHealth ?? BASE_MAX_HEALTH}
        />
      )}
      {aiCastlePosition && (
        <Castle
          owner="ai"
          position={aiCastlePosition}
          health={players.ai.baseHealth ?? BASE_MAX_HEALTH}
          maxHealth={players.ai.maxBaseHealth ?? BASE_MAX_HEALTH}
        />
      )}

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

      {/* Units queued in the barracks appear at their deployment hex */}
      {assetsLoaded && pendingPurchases.map(purchase => {
        const hex = hexByKey.get(coordKey(purchase.position));
        const owner: PlayerType = purchase.playerId === players.player.id ? 'player' : 'ai';
        if (!hex) return null;

        const info = UNITS[purchase.unitType];
        const tempUnit: Unit = {
          ...info,
          abilities: [...info.abilities],
          id: `pending-${coordKey(purchase.position)}`,
          owner,
          position: purchase.position,
          hasMoved: false,
          isEngagedInCombat: false
        };

        return (
          <UnitMesh
            key={tempUnit.id}
            unit={tempUnit}
            position={surfacePosition(hex)}
            facingTarget={null}
            isPendingPurchase
          />
        );
      })}

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
      {assetsLoaded && currentPhase === 'planning' && selectedUnitTypeForPurchase && placedUnitHex && (
        <AnimatedUnitPreview
          unitType={selectedUnitTypeForPurchase}
          position={axialToWorld(placedUnitHex.coordinates)}
          hexHeight={getHexSurfaceHeight(placedUnitHex)}
          isPlaced
        />
      )}

      {/* Battle markers */}
      {unresolvedCombats.map(combat => {
        const hex = hexByKey.get(coordKey(combat.hexCoordinates));
        if (!hex) return null;
        const [x, y, z] = surfacePosition(hex);
        const isActive = combat === activeCombat;
        return (
          <Html key={coordKey(combat.hexCoordinates)} position={[x, y + 2.2, z]} center zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
            <div
              className={`select-none rounded-full bg-slate-900/80 p-1 ${isActive ? 'text-3xl animate-bounce' : 'text-xl opacity-70'}`}
            >
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
  const effect = hex.isResourceHex
    ? `+${hex.resourceValue ?? 0} gold/round`
    : TERRAIN_SHORT_EFFECTS[hex.terrain];

  return (
    <Html position={[x, y + 0.2, z]} zIndexRange={[9, 0]} style={{ pointerEvents: 'none' }}>
      <div className="ml-5 -mt-5 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[11px] text-slate-100 shadow-lg select-none">
        <span className="font-bold"><TerrainIcon terrain={hex.terrain} /> {TERRAIN_EFFECTS[hex.terrain].name}</span>
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
