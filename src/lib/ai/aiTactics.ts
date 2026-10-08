import type { GameState, HeldTactic, HexCoordinates, PlayerType, Unit } from '@/types/game';
import { getHexDistance } from '../game/hexUtils';
import {
  findBaseHex, getAttackRange, getKillBounty, getOpponent, getRosterStats, getRosterTypes, getVisibleEnemies
} from '../game/gameState';
import { getTacticHand, getTacticTargets, canPlayTactic, playTactic } from '../game/battleTactics';
import {
  TACTIC_HAND_LIMIT, bulwarkReduction, earthworksRaise, mendHeal, rallyBonus, sabotageGold, shadowstepBonus,
  sinkholeDepth, smokeRadius, volleyDamage
} from '../game/tactics';

// How the AI plays tactic cards: before moving, it values every card it holds on every target (in
// rough gold terms) and plays the best one if it is worth it - or, with a full hand, the best one
// anyway rather than let the next draw go to waste.

type Difficulty = 'easy' | 'medium' | 'hard';

// Least value worth spending a card on while the hand still has room, and how many cards a turn
const PLAY_THRESHOLD: Record<Difficulty, number> = { easy: 6, medium: 3.5, hard: 2.5 };
const MAX_PLAYS: Record<Difficulty, number> = { easy: 1, medium: 1, hard: 2 };

interface Option {
  card: HeldTactic;
  target?: HexCoordinates;
  value: number;
}

const unitAt = (units: Unit[], at: HexCoordinates) => units.find(unit => unit.position.q === at.q && unit.position.r === at.r);

// Gold value of a share of a unit's health
const healthWorth = (unit: Unit, health: number) => Math.min(health, unit.lifespan) / unit.maxLifespan * unit.cost;

// Enemy troops that could strike a unit on their next turn (roughly: within their move and reach)
const threatsTo = (unit: Unit, enemies: Unit[]) =>
  enemies.filter(enemy => getHexDistance(enemy.position, unit.position) <= enemy.movementRange + getAttackRange(enemy));

const valueOf = (state: GameState, side: PlayerType, card: HeldTactic, target?: HexCoordinates): number => {
  const own = state.players[side].units;
  const enemies = getVisibleEnemies(state, side);
  const level = card.level;
  switch (card.id) {
    case 'mend': {
      const unit = unitAt(own, target!)!;
      const healed = Math.min(unit.maxLifespan - unit.lifespan, mendHeal(level));
      return healed / unit.maxLifespan * unit.cost * (threatsTo(unit, enemies).length > 0 ? 1.5 : 1);
    }
    case 'volley': {
      const enemy = unitAt(enemies, target!)!;
      const damage = volleyDamage(level);
      return damage >= enemy.lifespan ? enemy.cost + getKillBounty(enemy) : healthWorth(enemy, damage);
    }
    case 'rally': {
      // Troops that will likely fight this turn
      const fighters = own.filter(unit => enemies.some(enemy =>
        getHexDistance(enemy.position, unit.position) <= (unit.hasMoved ? 0 : unit.movementRange) + getAttackRange(unit)));
      return rallyBonus(level) * fighters.reduce((sum, unit) => sum + unit.attackPower, 0) * 1.5;
    }
    case 'bulwark': {
      const unit = unitAt(own, target!)!;
      const danger = threatsTo(unit, enemies).reduce((sum, enemy) => sum + enemy.attackPower, 0);
      return healthWorth(unit, danger * bulwarkReduction(level)) * 1.2;
    }
    case 'shadowstep': {
      const unit = unitAt(own, target!)!;
      const prey = enemies.filter(enemy => getHexDistance(enemy.position, unit.position) <= (unit.hasMoved ? 0 : unit.movementRange) + getAttackRange(unit));
      if (prey.length === 0) return 0;
      const strikeBack = Math.max(...prey.map(enemy => enemy.attackPower));
      return healthWorth(unit, strikeBack) + unit.attackPower * shadowstepBonus(level);
    }
    case 'forcedMarch': {
      const unit = unitAt(own, target!)!;
      const castle = findBaseHex(state, getOpponent(side));
      // Worth most to a fast troop still far from the enemy castle
      return castle ? Math.min(4, getHexDistance(unit.position, castle.coordinates) / 3) : 0;
    }
    case 'sabotage':
      return Math.min(state.players[getOpponent(side)].points, sabotageGold(level)) * 0.8;
    case 'smoke': {
      // Own troops under the smoke that enemy archers and mages could otherwise shoot
      const shooters = enemies.filter(enemy => getAttackRange(enemy) > 1);
      if (shooters.length === 0) return 0;
      const covered = own.filter(unit => getHexDistance(unit.position, target!) <= smokeRadius(level) &&
        shooters.some(enemy => getHexDistance(enemy.position, unit.position) <= enemy.movementRange + getAttackRange(enemy)));
      return covered.reduce((sum, unit) => sum + unit.cost * 0.25, 0);
    }
    case 'earthworks': {
      // Raise the ground under a troop about to fight (archers most of all)
      const unit = unitAt(own, target!);
      if (!unit || threatsTo(unit, enemies).length === 0) return 0;
      return earthworksRaise(level) * (getAttackRange(unit) > 1 ? 8 : 5);
    }
    case 'sinkhole': {
      // Drop the ground under enemies next to our troops
      const sunk = enemies.filter(enemy => getHexDistance(enemy.position, target!) <= 1 &&
        own.some(unit => getHexDistance(unit.position, enemy.position) <= getAttackRange(unit) + 1));
      return sinkholeDepth(level) * 6 * sunk.length;
    }
    case 'callToArms': {
      const cheapest = Math.min(...getRosterTypes(state, side).map(type => getRosterStats(state, side, type)?.cost ?? Infinity));
      return Number.isFinite(cheapest) ? cheapest * 0.6 : 0;
    }
    default:
      return 0;
  }
};

const optionsFor = (state: GameState, side: PlayerType): Option[] =>
  getTacticHand(state, side).flatMap(card => {
    if (!canPlayTactic(state, side, card.id)) return [];
    const targets = getTacticTargets(state, side, card.id);
    if (targets.length === 0) return [{ card, value: valueOf(state, side, card) }];
    return targets.map(target => ({ card, target, value: valueOf(state, side, card, target) }));
  });

// Play the side's tactic cards worth playing this turn
export const planTactics = (state: GameState, side: PlayerType, difficulty: Difficulty = 'medium'): GameState => {
  let current = state;
  for (let plays = 0; plays < MAX_PLAYS[difficulty]; plays++) {
    const options = optionsFor(current, side).sort((a, b) => b.value - a.value);
    const best = options[0];
    const handFull = getTacticHand(current, side).length >= TACTIC_HAND_LIMIT;
    if (!best || (!handFull && best.value < PLAY_THRESHOLD[difficulty])) break;
    const next = playTactic(current, side, best.card.uid, best.target);
    if (next === current) break;
    current = next;
  }
  return current;
};
