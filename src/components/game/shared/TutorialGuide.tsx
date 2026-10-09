import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameState, HexCoordinates, Unit, UnitType } from '@/types/game';
import {
  canStrikeCastle, findBaseHex, findTerrainPath, getDeploymentHexes, getHand, getMovePath, getRosterStats, getTerrainDistanceMap,
  getValidMoveTargets, getVisibleEnemies
} from '@/lib/game/gameState';
import { getHexDistance } from '@/lib/game/hexUtils';
import { axialToWorld, getHexSurfaceHeight } from '../utils/boardGeometry';
import { projectToScreen } from '../effects/effects';
import { PointingHandIcon, SkipIcon } from '../icons';

// The first battle teaches by showing, never telling. It opens on a short flight: the camera starts
// on your castle, sweeps across to the enemy castle (marked as the target for the whole battle) and
// traces the way between them. From then on a hand taps whatever to do next - a card, the hex to
// deploy it on, your troop, the hex towards the enemy castle, then Confirm - and the board marks the
// same spot with a gold ring. It follows the battle as it unfolds, so whatever the player does, the
// hand always shows a sensible next step.

export interface TutorialVisuals {
  // A spot the camera is flying to show (null: the usual view)
  showcase: { at: HexCoordinates; zoom: number } | null;
  // Pulsing rings: your castle (home), the enemy castle (target) and the hex to tap next (tap)
  rings: { at: HexCoordinates; tone: 'home' | 'target' | 'tap' }[];
  // A way across the board, traced in gold
  path: HexCoordinates[] | null;
  // The enemy castle, crowned with a target
  target: HexCoordinates | null;
  // The hex the hand taps, which the camera keeps clear of the screen's edges and the HUD
  keepInView: HexCoordinates | null;
}

// The opening flight: on your castle, then on the enemy's, then back with the way between them
type IntroStage = 'home' | 'enemy' | 'route' | 'done';
const INTRO_NEXT: Record<Exclude<IntroStage, 'done'>, IntroStage> = { home: 'enemy', enemy: 'route', route: 'done' };
const INTRO_MS: Record<Exclude<IntroStage, 'done'>, number> = { home: 1900, enemy: 2700, route: 2200 };
const SHOWCASE_ZOOM = 0.42;
// The guide has the player play cards until their army is this big
const ARMY_SIZE = 3;

// What the hand points at: a part of the screen, or a hex on the board
type Pointer = { selector: string } | { hex: HexCoordinates };

const FIRST_CARD = '[data-tutorial="first-card"]';
const CONFIRM = '[data-tutorial="end-turn"]';
const key = (c: HexCoordinates) => `${c.q},${c.r}`;

interface TutorialArgs {
  active: boolean;
  // The battle has loaded and can be shown
  ready: boolean;
  gameState: GameState;
  selectedUnit: Unit | null;
  selectedUnitType: UnitType | null;
  validMoves: HexCoordinates[];
}

export const useTutorial = ({ active, ready, gameState, selectedUnit, selectedUnitType, validMoves }: TutorialArgs) => {
  const [stage, setStage] = useState<IntroStage>('home');
  const started = active && ready && gameState.currentPhase === 'planning';
  useEffect(() => {
    if (!started || stage === 'done') return;
    const timer = setTimeout(() => setStage(INTRO_NEXT[stage]), INTRO_MS[stage]);
    return () => clearTimeout(timer);
  }, [started, stage]);

  const home = findBaseHex(gameState, 'player')?.coordinates ?? null;
  const enemy = findBaseHex(gameState, 'ai')?.coordinates ?? null;
  const homeKey = home && key(home);
  const enemyKey = enemy && key(enemy);
  // Steps from every hex to the enemy castle, and the way there from your castle
  const distances = useMemo(
    () => (enemy ? getTerrainDistanceMap(gameState.hexGrid, enemy) : null),
    // The ground only changes the way in rare cases; the castles decide it
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enemyKey]
  );
  const route = useMemo(
    () => (home && enemy ? findTerrainPath(gameState.hexGrid, home, enemy) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homeKey, enemyKey]
  );

  const introRunning = started && stage !== 'done';
  const pointer = active && !introRunning && enemy && distances
    ? nextStep(gameState, enemy, distances, selectedUnit, selectedUnitType, validMoves)
    : null;

  if (!active || !enemy) return { visuals: null, introRunning: false, pointer: null, skipIntro: () => {} };

  // The way to show: during the flight, castle to castle; later, from the troop to point at (or the
  // troop's march to the hex pointed at) on towards the enemy castle
  let path: HexCoordinates[] | null = null;
  if (introRunning) path = stage === 'route' ? route : null;
  else if (pointer && 'hex' in pointer) {
    const live = selectedUnit && gameState.players.player.units.find(unit => unit.id === selectedUnit.id);
    path = live
      ? getMovePath(gameState, live, pointer.hex)
      : gameState.players.player.units.some(unit => unit.position.q === pointer.hex.q && unit.position.r === pointer.hex.r)
        ? findTerrainPath(gameState.hexGrid, pointer.hex, enemy)
        : null;
  }

  const visuals: TutorialVisuals = {
    showcase: introRunning && stage !== 'route' ? { at: stage === 'home' ? home ?? enemy : enemy, zoom: SHOWCASE_ZOOM } : null,
    rings: [
      ...(introRunning && home ? [{ at: home, tone: 'home' as const }] : []),
      { at: enemy, tone: 'target' as const },
      ...(pointer && 'hex' in pointer ? [{ at: pointer.hex, tone: 'tap' as const }] : [])
    ],
    path,
    target: enemy,
    keepInView: pointer && 'hex' in pointer ? pointer.hex : null
  };
  return { visuals, introRunning, pointer, skipIntro: () => setStage('done') };
};

// What to do next, on the player's turn: deploy the card picked (on the hex nearest the enemy
// castle); march the troop picked towards the castle (without stopping among enemies when a safer
// hex does nearly as well); play a card while the army is small and gold allows; pick the troop
// nearest the castle that can still close in; or confirm the turn
const nextStep = (
  state: GameState,
  enemy: HexCoordinates,
  distances: Map<string, number>,
  selectedUnit: Unit | null,
  selectedUnitType: UnitType | null,
  validMoves: HexCoordinates[]
): Pointer | null => {
  if (state.currentPhase !== 'planning' || state.activePlayer !== 'player') return null;
  const stepsTo = (c: HexCoordinates) => distances.get(key(c)) ?? getHexDistance(c, enemy) * 3;
  const nearest = (hexes: HexCoordinates[]) =>
    [...hexes].sort((a, b) => stepsTo(a) - stepsTo(b) || getHexDistance(a, enemy) - getHexDistance(b, enemy))[0];

  if (selectedUnitType && validMoves.length > 0) return { hex: nearest(validMoves) };

  // A hex next to enemy troops costs a couple of steps: a lone troop shouldn't walk into an ambush
  const foes = getVisibleEnemies(state, 'player');
  const danger = (c: HexCoordinates) => foes.filter(foe => getHexDistance(foe.position, c) <= 1).length * 2;

  const units = state.players.player.units;
  const live = selectedUnit && units.find(unit => unit.id === selectedUnit.id);
  if (live && !live.hasMoved) {
    const best = getValidMoveTargets(state, live)
      .filter(c => stepsTo(c) < stepsTo(live.position))
      .sort((a, b) => stepsTo(a) + danger(a) - (stepsTo(b) + danger(b)) || stepsTo(a) - stepsTo(b))[0];
    if (best) return { hex: best };
  }

  // Build an army first, while gold allows and there is room to deploy
  const cheapest = Math.min(...getHand(state).map(type => getRosterStats(state, 'player', type)?.cost ?? Infinity));
  if (units.length + state.pendingPurchases.length < ARMY_SIZE && state.players.player.points >= cheapest &&
    getDeploymentHexes(state, 'player').length > 0) return { selector: FIRST_CARD };

  const ordered = new Set(state.pendingMoves.map(move => move.unitId));
  const movable = units
    .filter(unit => !unit.hasMoved && !ordered.has(unit.id) && !canStrikeCastle(state, unit) &&
      getValidMoveTargets(state, unit).some(c => stepsTo(c) < stepsTo(unit.position)))
    .sort((a, b) => stepsTo(a.position) - stepsTo(b.position));
  if (movable[0]) return { hex: movable[0].position };
  return { selector: CONFIRM };
};

// The hand tapping at the step's target, the opening flight's skip button, and a curtain that lets
// a tap anywhere end the flight early
export const TutorialOverlay: React.FC<{
  gameState: GameState;
  pointer: Pointer | null;
  introRunning: boolean;
  onSkipIntro: () => void;
}> = ({ gameState, pointer, introRunning, onSkipIntro }) => {
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const hexGridRef = useRef(gameState.hexGrid);
  hexGridRef.current = gameState.hexGrid;
  const pointerKey = pointer ? ('selector' in pointer ? pointer.selector : key(pointer.hex)) : null;

  // Follow the target every frame: the camera glides and cards rise and fall
  useEffect(() => {
    if (!pointer) {
      setSpot(null);
      return;
    }
    let frame = 0;
    const update = () => {
      let next: { x: number; y: number } | null = null;
      if ('selector' in pointer) {
        const rect = document.querySelector(pointer.selector)?.getBoundingClientRect();
        if (rect && rect.width > 0) next = { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.35 };
      } else {
        const hex = hexGridRef.current.find(other => other.coordinates.q === pointer.hex.q && other.coordinates.r === pointer.hex.r);
        const [x, , z] = axialToWorld(pointer.hex);
        next = projectToScreen([x, (hex ? getHexSurfaceHeight(hex) : 1) + 0.4, z]);
      }
      setSpot(current => (current && next && Math.abs(current.x - next.x) < 0.5 && Math.abs(current.y - next.y) < 0.5 ? current : next));
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
    // Re-aims when the target changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointerKey]);

  return (
    <>
      {introRunning && (
        <div className="fixed inset-0 z-[46]" onPointerDown={onSkipIntro} aria-hidden>
          <button
            onClick={onSkipIntro}
            aria-label="Skip"
            className="absolute bottom-6 right-6 rounded-full bg-slate-900/80 p-3 text-xl text-slate-100 shadow-lg ring-1 ring-white/20 hover:bg-slate-800"
          >
            <SkipIcon />
          </button>
        </div>
      )}
      {spot && (
        <div className="pointer-events-none fixed z-[45]" style={{ left: spot.x, top: spot.y }} aria-hidden>
          {/* A ripple where the finger lands, and the hand tapping */}
          <span className="tap-ripple absolute -left-6 -top-6 block h-12 w-12 rounded-full border-4 border-amber-300" />
          <span className="tap-hand absolute block text-6xl drop-shadow-[0_4px_0_rgba(15,23,42,0.75)]" style={{ left: -12, top: -4 }}>
            <PointingHandIcon />
          </span>
        </div>
      )}
    </>
  );
};
