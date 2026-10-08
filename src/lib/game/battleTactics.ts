import type { BattleEffect, GameState, HeldTactic, Hex, HexCoordinates, PlayerType, Unit } from '@/types/game';
import { findHexByCoordinates, getHexDistance, getHexesInRange, getNeighbors } from './hexUtils';
import { shiftHeightOffset } from './hexHeight';
import {
  addLog, canGiveOrders, cloneState, coordsEqual, createUnit, findBaseHex, getOpponent, getOwnedCamps, getRosterStats,
  getRosterTypes, getTroopName, getVisibleEnemies, getVisibleHexKeys, inflictDamage, isImpassable, sideStats,
  syncHexUnits, unitLabel, updateHex
} from './gameState';
import {
  TACTICS, TACTIC_REACH, TacticId, bulwarkReduction, callToArmsHealth, earthworksRaise, marchBonus, mendHeal, rallyBonus,
  sabotageGold, shadowstepBonus, sinkholeDepth, smokeRadius, volleyDamage
} from './tactics';

// Playing tactic cards: where each can be aimed, and what it does to the battle when played.

const key = (c: HexCoordinates) => `${c.q},${c.r}`;

export const getTacticHand = (state: GameState, side: PlayerType): HeldTactic[] => state.tactics?.[side]?.hand ?? [];

// Where a side can aim tactic cards from: its troops, its castle and the camps it holds
const lookoutPoints = (state: GameState, side: PlayerType): HexCoordinates[] => {
  const castle = findBaseHex(state, side);
  return [
    ...state.players[side].units.map(unit => unit.position),
    ...(castle ? [castle.coordinates] : []),
    ...getOwnedCamps(state, side).map(camp => camp.coordinates)
  ];
};

const inReach = (state: GameState, side: PlayerType, at: HexCoordinates) =>
  lookoutPoints(state, side).some(point => getHexDistance(point, at) <= TACTIC_REACH);

// Free hexes next to a side's castle, for a Call to Arms recruit (not ones this turn's orders claim)
const freeCastleHexes = (state: GameState, side: PlayerType): Hex[] => {
  const castle = findBaseHex(state, side);
  if (!castle) return [];
  const taken = new Set([
    ...state.players.player.units.map(unit => key(unit.position)),
    ...state.players.ai.units.map(unit => key(unit.position)),
    ...state.pendingPurchases.map(purchase => key(purchase.position)),
    ...state.pendingMoves.map(move => key(move.to))
  ]);
  return getNeighbors(castle.coordinates)
    .map(coordinates => findHexByCoordinates(state.hexGrid, coordinates))
    .filter((hex): hex is Hex => !!hex && !isImpassable(hex) && !hex.isBase && !taken.has(key(hex.coordinates)));
};

// The troop type a Call to Arms brings: the cheapest the side can recruit
const callToArmsType = (state: GameState, side: PlayerType) =>
  [...getRosterTypes(state, side)].sort((a, b) =>
    (getRosterStats(state, side, a)?.cost ?? Infinity) - (getRosterStats(state, side, b)?.cost ?? Infinity))[0];

// The hexes a card can be aimed at (empty for cards that work at once, without a target)
export const getTacticTargets = (state: GameState, side: PlayerType, id: TacticId): HexCoordinates[] => {
  const own = state.players[side].units;
  switch (id) {
    case 'mend':
      return own.filter(unit => unit.lifespan < unit.maxLifespan).map(unit => unit.position);
    case 'forcedMarch':
      return own.filter(unit => !unit.hasMoved).map(unit => unit.position);
    case 'bulwark':
    case 'shadowstep':
      return own.map(unit => unit.position);
    case 'volley':
      return getVisibleEnemies(state, side).filter(enemy => inReach(state, side, enemy.position)).map(enemy => enemy.position);
    case 'earthworks': {
      // (only the enemies it can see: a hidden one doesn't give itself away by blocking the card)
      const enemyAt = new Set(getVisibleEnemies(state, side).map(unit => key(unit.position)));
      return state.hexGrid
        .filter(hex => !isImpassable(hex) && !hex.isBase && !enemyAt.has(key(hex.coordinates)) && inReach(state, side, hex.coordinates))
        .map(hex => hex.coordinates);
    }
    case 'smoke':
      return state.hexGrid.filter(hex => inReach(state, side, hex.coordinates)).map(hex => hex.coordinates);
    case 'sinkhole': {
      const visible = getVisibleHexKeys(state, side);
      return state.hexGrid
        .filter(hex => !hex.isBase && visible.has(key(hex.coordinates)) && inReach(state, side, hex.coordinates))
        .map(hex => hex.coordinates);
    }
    default:
      return [];
  }
};

export const needsTarget = (id: TacticId) => TACTICS[id].target !== 'none';

// Whether a card can be played right now (the side's turn, and something to aim it at)
export const canPlayTactic = (state: GameState, side: PlayerType, id: TacticId): boolean => {
  if (!canGiveOrders(state, state.players[side])) return false;
  if (needsTarget(id)) return getTacticTargets(state, side, id).length > 0;
  if (id === 'callToArms') return !!callToArmsType(state, side) && freeCastleHexes(state, side).length > 0;
  if (id === 'sabotage') return state.players[getOpponent(side)].points > 0;
  return true;
};

// Why a card can't be played, in words the player can act on
export const whyCantPlay = (state: GameState, side: PlayerType, id: TacticId): string => {
  switch (id) {
    case 'mend': return 'None of your troops is wounded';
    case 'forcedMarch': return 'All your troops have already moved';
    case 'volley': return `No enemy troop in sight within ${TACTIC_REACH} hexes of your army`;
    case 'callToArms': return 'No free hex next to your castle';
    case 'sabotage': return 'The enemy has no gold to burn';
    default: return `${TACTICS[id].name} can't be played right now`;
  }
};

const addEffect = (state: GameState, effect: BattleEffect) => {
  state.effects = [...(state.effects ?? []), effect];
};

// Play a tactic card from a side's hand, aimed at `target` if it needs one. Returns the state
// unchanged if it can't be played.
export const playTactic = (state: GameState, side: PlayerType, uid: string, target?: HexCoordinates): GameState => {
  const card = getTacticHand(state, side).find(held => held.uid === uid);
  if (!card || !canPlayTactic(state, side, card.id)) return state;
  if (needsTarget(card.id) && (!target || !getTacticTargets(state, side, card.id).some(c => coordsEqual(c, target)))) return state;

  const next = cloneState(state);
  const tactics = next.tactics![side];
  next.tactics = { ...next.tactics!, [side]: { ...tactics, hand: tactics.hand.filter(held => held.uid !== uid) } };
  next.lastTactic = { side, id: card.id, level: card.level, at: target, serial: (state.lastTactic?.serial ?? 0) + 1 };

  const level = card.level;
  const who = side === 'player' ? 'You play' : 'The enemy plays';
  const ownAt = (at?: HexCoordinates): Unit | undefined => at && next.players[side].units.find(unit => coordsEqual(unit.position, at));
  const enemySide = getOpponent(side);

  switch (card.id) {
    case 'rally':
      addEffect(next, { kind: 'rally', side, value: rallyBonus(level), lasts: 'turn' });
      addLog(next, side, `${who} Rally: ${side === 'player' ? 'your' : 'their'} troops attack ${Math.round(rallyBonus(level) * 100)}% harder this turn.`);
      break;
    case 'mend': {
      const unit = ownAt(target)!;
      const healed = Math.min(unit.maxLifespan - unit.lifespan, mendHeal(level));
      unit.lifespan += healed;
      addLog(next, side, `${who} Mend: ${unitLabel(unit)} recovers ${healed} health.`);
      break;
    }
    case 'volley': {
      const enemy = next.players[enemySide].units.find(unit => coordsEqual(unit.position, target!))!;
      const result = inflictDamage(next, enemy, volleyDamage(level), side);
      addLog(next, side, `${who} Volley: ${unitLabel(enemy)} takes ${result.damage} damage${result.destroyed ? ' and falls' : ''}.`);
      break;
    }
    case 'forcedMarch': {
      const unit = ownAt(target)!;
      unit.movementRange += marchBonus(level);
      addEffect(next, { kind: 'march', side, unitId: unit.id, value: marchBonus(level), lasts: 'turn' });
      addLog(next, side, `${who} Forced March: ${unitLabel(unit)} gets +${marchBonus(level)} movement this turn.`);
      break;
    }
    case 'bulwark': {
      const unit = ownAt(target)!;
      next.effects = (next.effects ?? []).filter(effect => !(effect.kind === 'bulwark' && effect.unitId === unit.id));
      addEffect(next, { kind: 'bulwark', side, unitId: unit.id, value: bulwarkReduction(level), lasts: 'nextTurn' });
      addLog(next, side, `${who} Bulwark: ${unitLabel(unit)} takes ${Math.round(bulwarkReduction(level) * 100)}% less damage until ${side === 'player' ? 'your' : 'their'} next turn.`);
      break;
    }
    case 'shadowstep': {
      const unit = ownAt(target)!;
      addEffect(next, { kind: 'shadowstep', side, unitId: unit.id, value: shadowstepBonus(level), lasts: 'turn' });
      addLog(next, side, `${who} Shadowstep: ${unitLabel(unit)}'s target can't strike back this turn.`);
      break;
    }
    case 'sabotage': {
      const lost = Math.min(next.players[enemySide].points, sabotageGold(level));
      next.players[enemySide] = { ...next.players[enemySide], points: next.players[enemySide].points - lost };
      addLog(next, side, `${who} Sabotage: ${enemySide === 'player' ? 'you lose' : 'the enemy loses'} ${lost} gold.`);
      break;
    }
    case 'smoke': {
      const radius = smokeRadius(level);
      const hexes = getHexesInRange(next.hexGrid, target!, radius).map(hex => key(hex.coordinates));
      addEffect(next, { kind: 'smoke', side, hexes, value: radius, lasts: 'nextTurn' });
      addLog(next, side, `${who} Smoke Screen: nothing in the smoke can be shot at from afar until ${side === 'player' ? 'your' : 'their'} next turn.`);
      break;
    }
    case 'earthworks': {
      const hex = findHexByCoordinates(next.hexGrid, target!)!;
      updateHex(next, target!, { heightOffset: shiftHeightOffset(hex.heightOffset, earthworksRaise(level)) });
      syncHexUnits(next);
      addLog(next, side, `${who} Earthworks: the ground rises ${earthworksRaise(level).toFixed(2)}.`);
      break;
    }
    case 'sinkhole': {
      const depth = sinkholeDepth(level);
      for (const hex of getHexesInRange(next.hexGrid, target!, 1)) {
        if (!hex.isBase) updateHex(next, hex.coordinates, { heightOffset: shiftHeightOffset(hex.heightOffset, -depth) });
      }
      syncHexUnits(next);
      addLog(next, side, `${who} Sinkhole: the ground caves in ${depth.toFixed(2)}.`);
      break;
    }
    case 'callToArms': {
      const type = callToArmsType(next, side)!;
      const stats = getRosterStats(next, side, type)!;
      const enemyCastle = findBaseHex(next, enemySide);
      const spot = freeCastleHexes(next, side).sort((a, b) =>
        enemyCastle ? getHexDistance(a.coordinates, enemyCastle.coordinates) - getHexDistance(b.coordinates, enemyCastle.coordinates) : 0)[0];
      const health = Math.round(stats.maxLifespan * (1 + callToArmsHealth(level)));
      const unit = createUnit(type, side, spot.coordinates, { ...stats, maxLifespan: health });
      next.players[side] = { ...next.players[side], units: [...next.players[side].units, unit] };
      const tally = sideStats(next, side);
      tally.recruited++;
      tally.played[type] = (tally.played[type] ?? 0) + 1;
      syncHexUnits(next);
      addLog(next, side, `${who} Call to Arms: ${getTroopName(type)} join${side === 'player' ? ' you' : ' the enemy'} for free.`);
      break;
    }
  }
  return next;
};
