import type { GameState, HexCoordinates, Unit, UnitType } from '@/types/game';
import { GoalKind, planAITurn } from '../ai/aiPlayer';
import {
  canStrike, canStrikeCastle, findBaseHex, getCounterMultiplier, getHeightDifference, getTerrainDistanceMap, getTroopName,
  getVisibleEnemies
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

  const plan: PlanStep[] = moves.map(({ unit, to, intent }) =>
    ({ kind: 'move', unitId: unit.id, to, caption: explainMove(state, unit, to, intent, destination) }));
  for (const purchase of planned.pendingPurchases.slice(state.pendingPurchases.length)) {
    plan.push({
      kind: 'buy', unitType: purchase.unitType, at: purchase.position,
      caption: explainCard(state, purchase.unitType),
      placeCaption: state.hexGrid.some(hex => hex.isCamp && same(hex.coordinates, purchase.position))
        ? 'Deploy at your camp, nearer the fight' : 'Deploy it beside your castle'
    });
  }
  return plan;
};

// Why the plan plays a card: what it beats among the enemies in sight
export const explainCard = (state: GameState, type: UnitType): string => {
  const name = getTroopName(type);
  const prey = getVisibleEnemies(state, 'player').find(foe => getCounterMultiplier(type, foe.type) > 1);
  return prey ? `Play ${name}: strong against their ${getTroopName(prey.type)}` : `Play ${name} to raise a troop`;
};

// Why the plan sends a troop to a hex: the attack it makes from there (and what favours it), or else
// what the AI set out to do with it
export const explainMove = (
  state: GameState, unit: Unit, to: HexCoordinates, intent: GoalKind, destination: Map<string, HexCoordinates>
): string => {
  const hex = state.hexGrid.find(other => same(other.coordinates, to));
  const there = { ...unit, position: to };
  const foes = getVisibleEnemies(state, 'player');
  const friendsThere = state.players.player.units
    .filter(friend => friend.id !== unit.id)
    .map(friend => ({ ...friend, position: destination.get(friend.id) ?? friend.position }));

  if (intent === 'retreat') return hex?.terrain === 'spring' ? 'Hurt: fall back to the spring to heal' : 'Hurt: fall back out of reach';
  if (intent === 'heal') return 'Hurt: heal at the spring, then back into the fight';

  const targets = foes.filter(foe => canStrike(state, there, foe));
  if (targets.length > 0) {
    const target = [...targets].sort((a, b) => getCounterMultiplier(unit.type, b.type) - getCounterMultiplier(unit.type, a.type) || a.lifespan - b.lifespan)[0];
    const reasons: string[] = [];
    if (getCounterMultiplier(unit.type, target.type) > 1) reasons.push(`${getTroopName(unit.type)} beat ${getTroopName(target.type)}`);
    if (getHeightDifference(state, to, target.position) > 0) reasons.push('from higher ground');
    if (friendsThere.some(friend => canStrike(state, friend, target))) reasons.push('together they flank it');
    if (strikesPinned(unit) && isPinned(target.position, friendsThere)) reasons.push("it's pinned in place");
    if (intent === 'intercept') return `Stop the ${getTroopName(target.type)} before it reaches your castle`;
    return `Attack the ${getTroopName(target.type)}${reasons.length > 0 ? `: ${reasons.join(', ')}` : ''}`;
  }
  if (canStrikeCastle(state, there)) return 'Attack the enemy castle!';
  switch (intent) {
    case 'intercept': return 'Head off the enemy marching on your castle';
    case 'objective': return hex?.isCamp ? 'Take the camp: gold every turn, and a new place to deploy' : hex?.isResourceHex ? 'Take the gold mine: gold every turn' : 'Go and take the camp ahead';
    case 'support': return 'Stay just behind the front line, to heal it';
    case 'push': return 'All-out attack: march on the enemy castle!';
    default: return hex?.terrain === 'forest' ? 'March on, through the woods for cover' : 'March on the enemy castle';
  }
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
