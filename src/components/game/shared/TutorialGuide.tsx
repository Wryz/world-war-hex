import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameState, HexCoordinates, Unit, UnitType } from '@/types/game';
import {
  canStrikeCastle, findBaseHex, findTerrainPath, getDeploymentHexes, getHand, getMovePath, getRosterStats, getTerrainDistanceMap,
  getValidMoveTargets, getVisibleEnemies
} from '@/lib/game/gameState';
import { isBackLine, isFrontLine } from '@/lib/game/formations';
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

// What the hand points at - a part of the screen, or a hex on the board - and a few words on why
type Pointer = ({ selector: string } | { hex: HexCoordinates }) & { caption?: string };

const FIRST_CARD = '[data-tutorial="first-card"]';
const CONFIRM = '[data-tutorial="end-turn"]';
const key = (c: HexCoordinates) => `${c.q},${c.r}`;

// What the opening flight says at each stop
// Room the hand needs below its target (less, and it comes from above instead)
const HAND_ROOM = 170;
// How far a caption's middle stays from the screen's sides
const CAPTION_MARGIN = 150;

const INTRO_CAPTIONS: Record<Exclude<IntroStage, 'done'>, string> = {
  home: 'Your castle',
  enemy: 'Destroy the enemy castle to win',
  route: 'March your troops across'
};

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

  if (!active || !enemy) return { visuals: null, introRunning: false, introCaption: null, pointer: null, skipIntro: () => {} };

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
  const introCaption = introRunning ? INTRO_CAPTIONS[stage as Exclude<IntroStage, 'done'>] : null;
  return { visuals, introRunning, introCaption, pointer, skipIntro: () => setStage('done') };
};

// A troop's lesson this turn, most urgent first: a hurt troop pulls back (to the spring if it can);
// a troop that can reach the enemy castle attacks it; one that can reach a camp takes it; one with
// enemies near steps into the woods; otherwise it marches on the castle (not stopping among enemies
// when a safer hex does nearly as well)
type Lesson = { rank: number; target: HexCoordinates; caption: string };
const HURT = 0.5;
const lessonFor = (
  state: GameState, unit: Unit, enemy: HexCoordinates, stepsTo: (c: HexCoordinates) => number
): Lesson | null => {
  const reach = getValidMoveTargets(state, unit);
  if (reach.length === 0) return null;
  const foes = getVisibleEnemies(state, 'player');
  const nearestFoe = (c: HexCoordinates) => Math.min(99, ...foes.map(foe => getHexDistance(foe.position, c)));
  const hexAt = (c: HexCoordinates) => state.hexGrid.find(hex => hex.coordinates.q === c.q && hex.coordinates.r === c.r);

  if (unit.lifespan <= unit.maxLifespan * HURT && nearestFoe(unit.position) <= 2) {
    const spring = reach.find(c => hexAt(c)?.terrain === 'spring');
    const away = [...reach].sort((a, b) => nearestFoe(b) - nearestFoe(a) || stepsTo(b) - stepsTo(a))[0];
    if (spring) return { rank: 0, target: spring, caption: 'Hurt! Pull back to the spring to heal' };
    if (nearestFoe(away) > nearestFoe(unit.position)) return { rank: 0, target: away, caption: 'Hurt! Pull back out of reach' };
  }
  if (canStrikeCastle(state, unit)) return null;
  const siege = reach.filter(c => getHexDistance(c, enemy) === 1).sort((a, b) => nearestFoe(b) - nearestFoe(a))[0];
  if (siege) return { rank: 1, target: siege, caption: 'Attack the enemy castle!' };
  const camp = reach.find(c => { const hex = hexAt(c); return !!hex?.isCamp && hex.owner !== 'player'; });
  if (camp) return { rank: 2, target: camp, caption: 'Take the camp: gold every turn, and a new place to deploy' };
  if (foes.some(foe => getHexDistance(foe.position, unit.position) <= 3) && hexAt(unit.position)?.terrain !== 'forest') {
    const woods = reach.filter(c => hexAt(c)?.terrain === 'forest' && stepsTo(c) <= stepsTo(unit.position)).sort((a, b) => stepsTo(a) - stepsTo(b))[0];
    if (woods) return { rank: 3, target: woods, caption: 'Into the woods: cover softens every blow' };
  }
  const danger = (c: HexCoordinates) => foes.filter(foe => getHexDistance(foe.position, c) <= 1).length * 2;
  const march = reach.filter(c => stepsTo(c) < stepsTo(unit.position))
    .sort((a, b) => stepsTo(a) + danger(a) - (stepsTo(b) + danger(b)) || stepsTo(a) - stepsTo(b))[0];
  return march ? { rank: 5, target: march, caption: 'March on the enemy castle' } : null;
};

// Lessons ranked 4 and up wait until the army is raised: playing cards comes first
const CARD_RANK = 4;
const ARMY_SIZE = 3;

// What to do next, on the player's turn: place the card picked; carry out the lesson of the troop
// picked; otherwise point at the troop with the most urgent lesson, a card while the army is small,
// or Confirm
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
  const units = state.players.player.units;

  // A card picked: archers and mages go behind a front-line troop, where they are screened;
  // everyone else as near the enemy castle as can be
  if (selectedUnitType && validMoves.length > 0) {
    if (isBackLine({ type: selectedUnitType })) {
      const screened = validMoves
        .filter(c => units.some(unit => isFrontLine(unit) && getHexDistance(unit.position, c) === 1 && stepsTo(unit.position) < stepsTo(c)))
        .sort((a, b) => stepsTo(a) - stepsTo(b))[0];
      if (screened) return { hex: screened, caption: 'Archers behind your swords are shielded' };
    }
    const nearest = [...validMoves].sort((a, b) => stepsTo(a) - stepsTo(b) || getHexDistance(a, enemy) - getHexDistance(b, enemy))[0];
    return { hex: nearest, caption: 'Place it by your castle' };
  }

  const live = selectedUnit && units.find(unit => unit.id === selectedUnit.id);
  if (live && !live.hasMoved) {
    const lesson = lessonFor(state, live, enemy, stepsTo);
    if (lesson) return { hex: lesson.target, caption: lesson.caption };
  }

  const ordered = new Set(state.pendingMoves.map(move => move.unitId));
  const lessons = units
    .filter(unit => !unit.hasMoved && !ordered.has(unit.id))
    .map(unit => ({ unit, lesson: lessonFor(state, unit, enemy, stepsTo) }))
    .filter((entry): entry is { unit: Unit; lesson: Lesson } => !!entry.lesson)
    .sort((a, b) => a.lesson.rank - b.lesson.rank || stepsTo(a.unit.position) - stepsTo(b.unit.position));
  const urgent = lessons[0];
  if (urgent && urgent.lesson.rank < CARD_RANK) return { hex: urgent.unit.position, caption: urgent.lesson.caption };

  // Raise an army while gold allows and there is room to deploy
  const cheapest = Math.min(...getHand(state).map(type => getRosterStats(state, 'player', type)?.cost ?? Infinity));
  if (units.length + state.pendingPurchases.length < ARMY_SIZE && state.players.player.points >= cheapest &&
    getDeploymentHexes(state, 'player').length > 0) return { selector: FIRST_CARD, caption: 'Play a card to raise a troop' };

  if (urgent) return { hex: urgent.unit.position, caption: urgent.lesson.caption };
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

  const fromAbove = !!spot && spot.y > window.innerHeight - HAND_ROOM;
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
          {/* (near the bottom of the screen it comes down from above, so it stays in view) */}
          <span className={`${fromAbove ? 'tap-hand-down' : 'tap-hand'} absolute block text-7xl drop-shadow-[0_4px_0_rgba(15,23,42,0.75)]`} style={{ left: -10, top: fromAbove ? -70 : -2 }}>
            <PointingHandIcon />
          </span>
          {/* Why: a few words, above the hand (below it near the top of the screen) */}
          {caption && (
            <span
              key={caption}
              className="animate-fadeIn absolute w-max max-w-[min(18rem,80vw)] -translate-x-1/2 rounded-xl bg-slate-900/90 px-3 py-1.5 text-center text-sm font-bold leading-snug text-amber-100 shadow-lg ring-2 ring-amber-300/70"
              style={{
                // (kept on screen near the edges)
                left: Math.max(0, CAPTION_MARGIN - spot.x) - Math.max(0, spot.x - (window.innerWidth - CAPTION_MARGIN)),
                top: spot.y < 150 ? 96 : fromAbove ? -150 : -84
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
