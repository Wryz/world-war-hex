import type { GameState, HexCoordinates, PlayerType, Unit } from '@/types/game';
import { getHeightAt, getHexHeightOf } from './hexHeight';
import { getHexDistance, getHexesInRange, findHexByCoordinates } from './hexUtils';
import {
  getAttackRange, getStrikePowerOnTerrain, getValidMoveTargets, getVisibleEnemies, hasLineOfSight, ARMOR_REDUCTION,
  canBeFlanked, getFlankers, FLANK_BONUS
} from './gameState';

// The threat preview: which hexes the enemy troops a side can see could strike on their next turn,
// from anywhere they could move to, and how hard they would hit a given troop standing there.

export interface Threat {
  enemy: Unit;
  // Hexes the enemy could strike this one from
  from: HexCoordinates[];
}

const key = (c: HexCoordinates) => `${c.q},${c.r}`;

// Every hex at least one visible enemy could strike next turn, with the enemies that could
export const getThreats = (state: GameState, side: PlayerType = 'player'): Map<string, Threat[]> => {
  const threats = new Map<string, Threat[]>();
  for (const enemy of getVisibleEnemies(state, side)) {
    // Where it could stand next turn: here, or anywhere it could move (it moves before it strikes)
    const positions = [enemy.position, ...getValidMoveTargets({ ...state, pendingMoves: [], pendingPurchases: [] }, { ...enemy, hasMoved: false })];
    const reach = new Map<string, HexCoordinates[]>();
    for (const position of positions) {
      const terrain = findHexByCoordinates(state.hexGrid, position)?.terrain ?? 'plain';
      const range = getAttackRange(enemy, terrain, state);
      for (const hex of getHexesInRange(state.hexGrid, position, range)) {
        const distance = getHexDistance(position, hex.coordinates);
        if (distance === 0) continue;
        if (distance > 1 && !enemy.abilities.includes('magic') && !hasLineOfSight(state.hexGrid, position, hex.coordinates)) continue;
        const k = key(hex.coordinates);
        const from = reach.get(k);
        if (from) from.push(position);
        else reach.set(k, [position]);
      }
    }
    for (const [k, from] of reach) {
      const list = threats.get(k);
      if (list) list.push({ enemy, from });
      else threats.set(k, [{ enemy, from }]);
    }
  }
  return threats;
};

// The most damage these threats could deal to a troop standing on a hex (if every enemy that can
// reach it picked it as its target), after cover, height, counters, flanking and armour
export const estimateDamage = (state: GameState, unit: Unit, at: HexCoordinates, threats: Threat[] | undefined): number => {
  if (!threats || threats.length === 0) return 0;
  const targetHex = findHexByCoordinates(state.hexGrid, at);
  const targetTerrain = targetHex?.terrain ?? 'plain';
  const heightOf = (position: HexCoordinates, hex = findHexByCoordinates(state.hexGrid, position)) =>
    hex ? getHexHeightOf(hex) : getHeightAt(position, 'plain');
  const total = threats.reduce((sum, { enemy, from }) => sum + Math.max(...from.map(position => {
    const terrain = findHexByCoordinates(state.hexGrid, position)?.terrain ?? 'plain';
    return getStrikePowerOnTerrain(enemy, terrain, unit, targetTerrain, getHexDistance(position, at),
      heightOf(position) - heightOf(at, targetHex));
  })), 0);
  // (all of them together fight one fight: flanking it, and its armour soaking some of it once -
  // unless a crossbow's bolts go through it)
  const flanking = canBeFlanked(state, unit, at) ? 1 + FLANK_BONUS * getFlankers(threats.length) : 1;
  const damage = Math.max(1, Math.round(total * flanking));
  const pierced = threats.some(({ enemy }) => enemy.abilities.includes('heavyBolts'));
  return unit.abilities.includes('armored') && !pierced ? Math.max(1, damage - ARMOR_REDUCTION) : damage;
};

// How dangerous each threatened hex is, from 0 to 1: the attack power that can reach it compared
// with the most threatened hex
export const getThreatLevels = (threats: Map<string, Threat[]>): Map<string, number> => {
  const power = new Map([...threats].map(([k, list]) => [k, list.reduce((sum, t) => sum + t.enemy.attackPower, 0)]));
  const most = Math.max(1, ...power.values());
  return new Map([...power].map(([k, value]) => [k, 0.25 + 0.75 * value / most]));
};
