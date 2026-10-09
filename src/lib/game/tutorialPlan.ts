import type { GameState, HexCoordinates, Unit, UnitType } from '@/types/game';
import { GoalKind, planAITurn } from '../ai/aiPlayer';
import {
  canStrike, canStrikeCastle, findBaseHex, getCounterMultiplier, getDeploymentHexes, getHeightDifference, getRosterStats,
  getTerrainDistanceMap, getTroopName, getVisibleEnemies
} from './gameState';
import { getHexDistance } from './hexUtils';
import { isPinned, strikesPinned } from './formations';

// The tutorial's plan for a turn of the player's: what the game's own AI would do with the player's
// troops and cards, as steps for the hand to show, each with a few words on why - the AI's own reason
// (what it set out to do with the troop), never one guessed from the ground it ends on.
//
// The AI plays the player's side boldly here (less afraid of losses than usual): a tutorial teaches
// pressing the attack, and a healthy troop is never sent back the way it came - when the AI would
// do that, the troop simply holds where it is.

export type PlanStep =
  | { kind: 'move'; unitId: string; to: HexCoordinates; caption: string }
  | { kind: 'buy'; unitType: UnitType; at: HexCoordinates; caption: string; placeCaption: string };

// How afraid of losses the AI is when it plans the player's side (1 is its usual)
export const TUTORIAL_CAUTION = 0.35;
// A troop below this share of its health counts as hurt
const HURT = 0.5;

const same = (a: HexCoordinates, b: HexCoordinates) => a.q === b.q && a.r === b.r;

export const planTutorialTurn = (state: GameState): PlanStep[] => {
  const intents = new Map<string, GoalKind>();
  const planned = planAITurn(state, { side: 'player', difficulty: 'hard', caution: TUTORIAL_CAUTION, intents });
  const enemyCastle = findBaseHex(state, 'ai')?.coordinates;
  const steps = enemyCastle ? getTerrainDistanceMap(state.hexGrid, enemyCastle) : null;
  const stepsTo = (c: HexCoordinates) => steps?.get(`${c.q},${c.r}`) ?? (enemyCastle ? getHexDistance(c, enemyCastle) * 3 : 0);

  const before = new Set(state.pendingMoves.map(move => move.unitId));
  const destination = new Map(state.players.player.units.map(unit => [unit.id, unit.position]));
  const moves = planned.pendingMoves.filter(move => !before.has(move.unitId)).flatMap(move => {
    const unit = state.players.player.units.find(other => other.id === move.unitId);
    if (!unit) return [];
    const intent = intents.get(unit.id) ?? 'march';
    const attacks = getVisibleEnemies(state, 'player').some(foe => canStrike(state, { ...unit, position: move.to }, foe)) ||
      canStrikeCastle(state, { ...unit, position: move.to });
    // A healthy troop going back the way it came, with nothing to fight or take there (not even a
    // spring to top up a scratch at): it holds instead
    const backwards = stepsTo(move.to) > stepsTo(unit.position) && !attacks && unit.lifespan > unit.maxLifespan * HURT &&
      !['intercept', 'objective', 'support'].includes(intent);
    // ...and one barely scratched isn't walked to the spring either
    const scratched = intent === 'heal' && !attacks && unit.lifespan > unit.maxLifespan * HURT;
    if (backwards || scratched) return [];
    destination.set(unit.id, move.to);
    return [{ unit, to: move.to, intent }];
  });

  const plan: PlanStep[] = moves.flatMap(({ unit, to, intent }): PlanStep[] => {
    const caption = explainMove(state, unit, to, intent, destination);
    // A march that doesn't get any nearer the enemy castle isn't one: a hurt troop is stepping back
    // from the front, and a healthy one has nothing to show for it, so it holds
    if (/^(March on|All-out)/.test(caption) && stepsTo(to) > stepsTo(unit.position)) {
      return unit.lifespan <= unit.maxLifespan * HURT ? [{ kind: 'move', unitId: unit.id, to, caption: 'Hurt: step back from the front' }] : [];
    }
    return [{ kind: 'move', unitId: unit.id, to, caption }];
  });
  // The AI deploys warily (away from anything that could reach the spot); the tutorial deploys
  // towards the fight instead, so a new troop never seems to be sent the wrong way
  const taken = new Set([...destination.values()].map(c => `${c.q},${c.r}`));
  for (const purchase of planned.pendingPurchases.slice(state.pendingPurchases.length)) {
    const at = deploySpot(state, purchase.unitType, taken) ??
      (taken.has(`${purchase.position.q},${purchase.position.r}`) ? null : purchase.position);
    // (nowhere left to put it: that card waits)
    if (!at) continue;
    taken.add(`${at.q},${at.r}`);
    plan.push({
      kind: 'buy', unitType: purchase.unitType, at,
      caption: explainCard(state, purchase.unitType),
      placeCaption: deployCaption(state, at)
    });
  }
  return plan;
};

// Where the fight is for a new troop: the enemy in sight nearest your castle, or else the enemy castle
export const frontOf = (state: GameState): HexCoordinates | undefined => {
  const home = findBaseHex(state, 'player')?.coordinates;
  const foes = getVisibleEnemies(state, 'player');
  const nearest = home && [...foes].sort((a, b) => getHexDistance(a.position, home) - getHexDistance(b.position, home))[0];
  return nearest?.position ?? findBaseHex(state, 'ai')?.coordinates;
};

// The free spots a troop may be deployed on, the best kind only. A troop just raised can't move or
// strike first, so it shouldn't stand right beside an enemy, and an archer or mage (frail, and poor
// at arm's length) shouldn't stand where any enemy in sight could already strike it - when there
// are such spots; else any free spot (but never beside an enemy for archers and mages). Keeping
// every recruit out of all reach would push most of them back behind the castle, away from the
// fight. `taken` holds spots the turn's other orders will use.
export const deployCandidates = (state: GameState, type: UnitType, taken: Set<string> = new Set()): GameState['hexGrid'] => {
  const ranged = !!getRosterStats(state, 'player', type)?.abilities.includes('rangedAttack');
  const foes = getVisibleEnemies(state, 'player');
  const beside = (hex: GameState['hexGrid'][number]) => foes.some(foe => getHexDistance(foe.position, hex.coordinates) === 1);
  const inReach = (hex: GameState['hexGrid'][number]) => foes.some(foe =>
    canStrike(state, foe, { ...foe, id: 'recruit', owner: 'player', position: hex.coordinates }));
  const free = getDeploymentHexes(state, 'player').filter(hex => !taken.has(`${hex.coordinates.q},${hex.coordinates.r}`) && !(ranged && beside(hex)));
  const safe = free.filter(hex => ranged ? !inReach(hex) : !beside(hex));
  return safe.length > 0 ? safe : free;
};

// The spot to deploy a troop on: of the candidates, the one nearest the fight (a camp first when
// it's as near)
export const deploySpot = (state: GameState, type: UnitType, taken: Set<string> = new Set()): HexCoordinates | null => {
  const front = frontOf(state);
  if (!front) return null;
  return [...deployCandidates(state, type, taken)].sort((a, b) =>
    getHexDistance(a.coordinates, front) - getHexDistance(b.coordinates, front) || Number(!!b.isCamp) - Number(!!a.isCamp)
  )[0]?.coordinates ?? null;
};

export const deployCaption = (state: GameState, at: HexCoordinates): string =>
  state.hexGrid.some(hex => hex.isCamp && same(hex.coordinates, at))
    ? 'Deploy at your camp, nearer the fight'
    : getVisibleEnemies(state, 'player').length > 0 ? 'Deploy it on the side facing the enemy' : 'Deploy it beside your castle, towards the enemy';

// Why the plan plays a card: what it beats among the enemies in sight
export const explainCard = (state: GameState, type: UnitType): string => {
  const name = getTroopName(type);
  const prey = getVisibleEnemies(state, 'player').find(foe => getCounterMultiplier(type, foe.type) > 1);
  return prey ? `Play ${name}: strong against their ${getTroopName(prey.type)}` : `Play ${name} to raise a troop`;
};

// Why the plan sends a troop to a hex, in a few words that always match the move itself (what the AI
// set out to do with the troop only colours them): the attack it makes from there and what favours
// it; the enemy castle; the spring it heals at, or the reach it falls back out of; the camp or gold
// mine it takes or is heading for; otherwise the march on the enemy castle
export const explainMove = (
  state: GameState, unit: Unit, to: HexCoordinates, intent: GoalKind, destination: Map<string, HexCoordinates>
): string => {
  const hexAt = (c: HexCoordinates) => state.hexGrid.find(other => same(other.coordinates, c));
  const hex = hexAt(to);
  const there = { ...unit, position: to };
  const foes = getVisibleEnemies(state, 'player');
  const nearestFoe = (c: HexCoordinates) => Math.min(99, ...foes.map(foe => getHexDistance(foe.position, c)));
  const nearest = (c: HexCoordinates, wanted: (hex: GameState['hexGrid'][number]) => boolean) =>
    Math.min(99, ...state.hexGrid.filter(wanted).map(other => getHexDistance(other.coordinates, c)));
  const closerTo = (wanted: (hex: GameState['hexGrid'][number]) => boolean) => nearest(to, wanted) < nearest(unit.position, wanted);
  const isPrize = (other: GameState['hexGrid'][number]) => (other.isCamp || !!other.isResourceHex) && other.owner !== 'player';
  const hurt = unit.lifespan < unit.maxLifespan;
  const friendsThere = state.players.player.units
    .filter(friend => friend.id !== unit.id)
    .map(friend => ({ ...friend, position: destination.get(friend.id) ?? friend.position }));

  const targets = foes.filter(foe => canStrike(state, there, foe));
  if (targets.length > 0) {
    const target = [...targets].sort((a, b) => getCounterMultiplier(unit.type, b.type) - getCounterMultiplier(unit.type, a.type) || a.lifespan - b.lifespan)[0];
    if (intent === 'intercept') return `Stop the ${getTroopName(target.type)} before it reaches your castle`;
    const reasons: string[] = [];
    if (getCounterMultiplier(unit.type, target.type) > 1) reasons.push(`${getTroopName(unit.type)} beat ${getTroopName(target.type)}`);
    if (getHeightDifference(state, to, target.position) > 0) reasons.push('from higher ground');
    if (friendsThere.some(friend => canStrike(state, friend, target))) reasons.push('together they flank it');
    if (strikesPinned(unit) && isPinned(target.position, friendsThere)) reasons.push("it's pinned in place");
    return `Attack the ${getTroopName(target.type)}${reasons.length > 0 ? `: ${reasons.join(', ')}` : ''}`;
  }
  if (canStrikeCastle(state, there)) return 'Attack the enemy castle!';
  if (hurt && hex?.terrain === 'spring') return 'Hurt: heal at the spring, then back into the fight';
  if (intent === 'retreat' && nearestFoe(to) > nearestFoe(unit.position)) return 'Hurt: fall back out of reach';
  if (hurt && (intent === 'heal' || intent === 'retreat') && closerTo(other => other.terrain === 'spring')) return 'Hurt: make for the spring to heal';
  if (hex && isPrize(hex)) return hex.isCamp ? 'Take the camp: gold every turn, and a new place to deploy' : 'Take the gold mine: gold every turn';
  if (intent === 'objective' && closerTo(isPrize)) return 'Head for the camp ahead: take it next turn';
  if (intent === 'intercept' && foes.length > 0 && nearestFoe(to) < nearestFoe(unit.position)) return 'Head off the enemy marching on your castle';
  if (intent === 'support') return 'Stay just behind the front line, to heal it';
  if (intent === 'push') return 'All-out attack: march on the enemy castle!';
  return hex?.terrain === 'forest' ? 'March on, through the woods for cover' : 'March on the enemy castle';
};

// The castle site to suggest: the one with the most camps, gold and high ground near it
export const bestCastleSite = (state: GameState): HexCoordinates | null => {
  const choices = state.castleChoices ?? [];
  const score = (site: HexCoordinates) => state.hexGrid.reduce((sum, hex) => {
    const distance = getHexDistance(hex.coordinates, site);
    if (distance === 0 || distance > 3) return sum;
    return sum + (hex.isCamp ? 3 : 0) + (hex.isResourceHex ? 2 : 0) + (hex.terrain === 'hills' ? 1 : 0) + (hex.terrain === 'forest' ? 0.5 : 0);
  }, 0);
  return [...choices].sort((a, b) => score(b) - score(a))[0] ?? null;
};
