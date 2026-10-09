import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameState, HexCoordinates, Unit, UnitType } from '@/types/game';
import { findBaseHex, findTerrainPath, getDeploymentHexes, getHand, getMovePath, getRosterStats, getValidMoveTargets } from '@/lib/game/gameState';
import { PlanStep, bestCastleSite, deployCaption, deploySpot, planTutorialTurn, withPlannedMoves } from '@/lib/game/tutorialPlan';
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

// The campaign battle that is the tutorial (every time it's played)
export const TUTORIAL_BATTLE = 1;

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

// What the hand points at - a part of the screen, or a hex on the board - and a few words on why
type Pointer = ({ selector: string } | { hex: HexCoordinates }) & { caption?: string };

const CONFIRM = '[data-tutorial="end-turn"]';
const key = (c: HexCoordinates) => `${c.q},${c.r}`;

// What the opening flight says at each stop
// The hand: its size, and where its fingertip is in its box (the icon points down and to the right)
const HAND_SIZE = 72;
const FINGERTIP = { x: 0.935, y: 0.8 };
// How far a caption's middle stays from the screen's sides
const CAPTION_MARGIN = 150;

const INTRO_CAPTIONS: Record<Exclude<IntroStage, 'done'>, string> = {
  home: 'Your castle',
  enemy: 'Destroy the enemy castle to win',
  route: 'March your troops across'
};

interface TutorialArgs {
  active: boolean;
  // Open with the flight from castle to castle (the first battle)
  intro: boolean;
  // A hex tapped that a troop could move onto or work on: the choice is showing
  choosingOrder?: boolean;
  // The battle has loaded and can be shown
  ready: boolean;
  gameState: GameState;
  selectedUnit: Unit | null;
  selectedUnitType: UnitType | null;
  validMoves: HexCoordinates[];
}

export const useTutorial = ({ active, intro, ready, gameState, selectedUnit, selectedUnitType, validMoves, choosingOrder = false }: TutorialArgs) => {
  // (a battle resumed part-way through skips the opening flight)
  const [stage, setStage] = useState<IntroStage>(() => (!intro || gameState.turnNumber > 1 ? 'done' : 'home'));
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
  // The way from your castle to the enemy's, shown in the opening flight
  const route = useMemo(
    () => (home && enemy ? findTerrainPath(gameState.hexGrid, home, enemy) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homeKey, enemyKey]
  );

  const introRunning = started && stage !== 'done';
  // The plan for this turn of yours, made when it begins
  const planRef = useRef<{ turn: number; steps: PlanStep[] } | null>(null);
  const yourTurn = active && gameState.currentPhase === 'planning' && gameState.activePlayer === 'player';
  if (yourTurn && planRef.current?.turn !== gameState.turnNumber) {
    planRef.current = { turn: gameState.turnNumber, steps: planTutorialTurn(gameState) };
  }
  // (the plan only ever moves troops: when a hex offers a choice of orders, it is to move)
  const pointer: Pointer | null = !active || introRunning || !enemy || !yourTurn || !planRef.current ? null
    : choosingOrder ? { selector: '[data-tutorial="move-here"]', caption: 'Move there' }
      : nextStep(gameState, planRef.current.steps, selectedUnit, selectedUnitType, validMoves);

  // Before the castles stand: point at the best site to build yours
  const site = active && ready && gameState.currentPhase === 'setup' ? bestCastleSite(gameState) : null;
  if (site) {
    const visuals: TutorialVisuals = { showcase: null, rings: [{ at: site, tone: 'tap' }], path: null, target: null, keepInView: site };
    return { visuals, introRunning: false, introCaption: null, pointer: { hex: site, caption: 'Build your castle here: near camps and high ground' } as Pointer, skipIntro: () => {} };
  }

  if (!active || !enemy) return { visuals: null, introRunning: false, introCaption: null, pointer: null, skipIntro: () => {} };

  // The way to show: during the flight, castle to castle; later, only the march of the troop picked
  // to the hex pointed at (never a way somewhere else, to distract from it)
  let path: HexCoordinates[] | null = null;
  if (introRunning) path = stage === 'route' ? route : null;
  else if (pointer && 'hex' in pointer) {
    const live = selectedUnit && gameState.players.player.units.find(unit => unit.id === selectedUnit.id);
    path = live ? getMovePath(gameState, live, pointer.hex) : null;
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
  const introCaption = introRunning ? INTRO_CAPTIONS[stage as Exclude<IntroStage, 'done'>] : null;
  return { visuals, introRunning, introCaption, pointer, skipIntro: () => setStage('done') };
};

// What to do next, on the player's turn, following the turn's plan: place the card picked where the
// plan would; send the troop picked where the plan would; otherwise point at the next step not yet
// done (a troop, or a card); and once there are none, Confirm
const nextStep = (
  state: GameState,
  plan: PlanStep[],
  selectedUnit: Unit | null,
  selectedUnitType: UnitType | null,
  validMoves: HexCoordinates[]
): Pointer | null => {
  if (state.currentPhase !== 'planning' || state.activePlayer !== 'player') return null;
  const units = state.players.player.units;
  const ordered = new Set(state.pendingMoves.map(move => move.unitId));
  const nearestOf = (hexes: HexCoordinates[], to: HexCoordinates) =>
    [...hexes].sort((a, b) => getHexDistance(a, to) - getHexDistance(b, to))[0];

  // The plan's cards not yet played (as many of each type as it plays)
  const played = new Map<UnitType, number>();
  for (const purchase of state.pendingPurchases) played.set(purchase.unitType, (played.get(purchase.unitType) ?? 0) + 1);
  const buys = plan.filter((step): step is Extract<PlanStep, { kind: 'buy' }> => step.kind === 'buy').filter(step => {
    const count = played.get(step.unitType) ?? 0;
    if (count > 0) {
      played.set(step.unitType, count - 1);
      return false;
    }
    return (getRosterStats(state, 'player', step.unitType)?.cost ?? Infinity) <= state.players.player.points &&
      getHand(state).includes(step.unitType);
  });
  // The plan's moves still to give - and still possible exactly as planned (a hex since taken by
  // another order is dropped, rather than pointing somewhere the caption doesn't describe)
  const moves = plan.filter((step): step is Extract<PlanStep, { kind: 'move' }> => step.kind === 'move').filter(step => {
    const unit = units.find(other => other.id === step.unitId);
    return !!unit && !unit.hasMoved && !ordered.has(unit.id) &&
      getValidMoveTargets(state, unit).some(c => c.q === step.to.q && c.r === step.to.r);
  });

  // The card picked: the spot nearest the fight among those it can go on now, on the board as it will
  // be once the plan's moves still to come are given (the hexes those troops will march onto are
  // spoken for)
  if (selectedUnitType && validMoves.length > 0) {
    const board = withPlannedMoves(state, moves);
    const now = new Set(validMoves.map(key));
    const notNow = new Set(getDeploymentHexes(board, 'player').map(hex => key(hex.coordinates)).filter(at => !now.has(at)));
    const spot = deploySpot(board, selectedUnitType, notNow);
    if (spot) return { hex: spot, caption: deployCaption(board, spot, notNow) };
    const enemy = findBaseHex(state, 'ai')?.coordinates;
    const nearest = enemy ? nearestOf(validMoves, enemy) : validMoves[0];
    return { hex: nearest, caption: deployCaption(board, nearest, notNow) };
  }

  const live = selectedUnit && units.find(unit => unit.id === selectedUnit.id);
  if (live && !live.hasMoved && !ordered.has(live.id)) {
    const move = moves.find(step => step.unitId === live.id);
    if (move) return { hex: move.to, caption: move.caption };
  }

  const next = moves[0];
  if (next) {
    const unit = units.find(other => other.id === next.unitId)!;
    return { hex: unit.position, caption: next.caption };
  }
  if (buys[0]) return { selector: `[data-tutorial="card-${buys[0].unitType}"]`, caption: buys[0].caption };
  return { selector: CONFIRM, caption: 'Confirm your orders' };
};

// The hand tapping at the step's target, the opening flight's skip button, and a curtain that lets
// a tap anywhere end the flight early
export const TutorialOverlay: React.FC<{
  gameState: GameState;
  pointer: Pointer | null;
  introRunning: boolean;
  introCaption?: string | null;
  onSkipIntro: () => void;
}> = ({ gameState, pointer, introRunning, introCaption = null, onSkipIntro }) => {
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const hexGridRef = useRef(gameState.hexGrid);
  hexGridRef.current = gameState.hexGrid;
  const pointerKey = pointer ? ('selector' in pointer ? pointer.selector : key(pointer.hex)) : null;
  const caption = pointer?.caption ?? null;

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

  // The hand reaches in from above and to the left of its target, its fingertip on it - mirrored
  // where that would take it off the screen
  const flipX = !!spot && spot.x < HAND_SIZE * 1.3;
  const flipY = !!spot && spot.y < HAND_SIZE * 1.6;
  const tip = { x: (flipX ? 1 - FINGERTIP.x : FINGERTIP.x) * HAND_SIZE, y: (flipY ? 1 - FINGERTIP.y : FINGERTIP.y) * HAND_SIZE };
  return (
    <>
      {introCaption && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-[47] flex justify-center px-4">
          <span key={introCaption} className="animate-fadeIn font-display rounded-2xl bg-slate-900/85 px-5 py-2 text-center text-xl text-amber-200 shadow-xl ring-2 ring-amber-300/60 sm:text-2xl">
            {introCaption}
          </span>
        </div>
      )}
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
          <span className="tap-ripple absolute -left-7 -top-7 block h-14 w-14 rounded-full border-4 border-amber-300" />
          <span
            className="absolute block"
            style={{ left: -tip.x, top: -tip.y, width: HAND_SIZE, height: HAND_SIZE, transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})` }}
          >
            {/* (it jabs along its finger and presses, pivoting on the fingertip) */}
            <span
              className="tap-hand flex drop-shadow-[0_4px_0_rgba(15,23,42,0.75)]"
              style={{ width: HAND_SIZE, height: HAND_SIZE, fontSize: HAND_SIZE, lineHeight: 1, transformOrigin: `${FINGERTIP.x * 100}% ${FINGERTIP.y * 100}%` }}
            >
              <PointingHandIcon />
            </span>
          </span>
          {/* Why: a few words, beyond the hand (above it, or below it when it reaches up) */}
          {caption && (
            <span
              key={caption}
              className="animate-fadeIn absolute w-max max-w-[min(18rem,80vw)] -translate-x-1/2 rounded-xl bg-slate-900/90 px-3 py-1.5 text-center text-sm font-bold leading-snug text-amber-100 shadow-lg ring-2 ring-amber-300/70"
              style={{
                // (kept on screen near the edges)
                left: Math.max(0, CAPTION_MARGIN - spot.x) - Math.max(0, spot.x - (window.innerWidth - CAPTION_MARGIN)),
                top: flipY ? HAND_SIZE + 24 : -HAND_SIZE - 52
              }}
            >
              {caption}
            </span>
          )}
        </div>
      )}
    </>
  );
};
