import type { GameState, HexCoordinates, PlayerType, TerrainType } from '@/types/game';
import {
  CAMP_INCOME, ELEVATION_DAMAGE_STEP, FLANK_BONUS, HIGH_GROUND_ELEVATION, HIGH_GROUND_SIGHT_BONUS, MAX_FLANKERS,
  TERRAIN_BONUS_ATTACK_MULTIPLIER, TERRAIN_EFFECTS, canStormCastle, findBaseHex, isFogOfWar
} from './gameState';
import { describeBond, getBond } from './bonds';
import { getTroop } from './troops';

// The advantages on the battlefield a side can use: helpful ground on this map, its bonds, flanking,
// camps and mines, and a breached enemy castle - with how to make the most of each, how many of its
// troops are using it right now, and where it is on the board.

export interface FieldBuff {
  id: string;
  name: string;
  // What it gives, in a few words
  short: string;
  // How to take advantage of it
  howTo: string;
  // The side's troops (or camps, mines) benefiting from it now
  using: number;
  // Where it is on the board, to highlight
  hexes: HexCoordinates[];
  terrain?: TerrainType;
  bondCards?: [string, string];
  kind: 'terrain' | 'bond' | 'tactic' | 'objective';
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export const getFieldBuffs = (state: GameState, side: PlayerType = 'player'): FieldBuff[] => {
  const units = state.players[side].units;
  const hexesWhere = (test: (terrain: TerrainType) => boolean) =>
    state.hexGrid.filter(hex => !hex.isBase && test(hex.terrain)).map(hex => hex.coordinates);
  const onHexes = (coordinates: HexCoordinates[]) => {
    const keys = new Set(coordinates.map(c => `${c.q},${c.r}`));
    return units.filter(unit => keys.has(`${unit.position.q},${unit.position.r}`)).length;
  };
  const fog = isFogOfWar(state);
  const buffs: FieldBuff[] = [];

  // Cover
  for (const terrain of ['forest', 'ruins'] as const) {
    const hexes = hexesWhere(t => t === terrain);
    if (hexes.length === 0) continue;
    const effect = TERRAIN_EFFECTS[terrain];
    const pikes = terrain === 'forest' && units.some(unit => unit.abilities.includes('terrainBonus'));
    buffs.push({
      id: `cover-${terrain}`,
      kind: 'terrain',
      terrain,
      name: terrain === 'forest' ? 'Forest cover' : 'Ruins cover',
      short: `-${percent(1 - effect.damageTakenMultiplier)} damage taken`,
      howTo: [
        `Troops standing here take ${percent(1 - effect.damageTakenMultiplier)} less damage, and archers on level ground can't shoot through.`,
        'Hold it with the troops that will take the most hits, and make the enemy come to you.',
        terrain === 'forest' && fog ? 'In the fog, troops here can only be seen from the next hex - good for ambushes.' : '',
        pikes ? `Pikemen attack ${percent(TERRAIN_BONUS_ATTACK_MULTIPLIER - 1)} harder from a forest.` : ''
      ].filter(Boolean).join(' '),
      using: onHexes(hexes),
      hexes
    });
  }

  // High ground
  const high = hexesWhere(t => TERRAIN_EFFECTS[t].elevation >= HIGH_GROUND_ELEVATION && TERRAIN_EFFECTS[t].moveCost !== null);
  if (high.length > 0) {
    buffs.push({
      id: 'high-ground',
      kind: 'terrain',
      terrain: 'hills',
      name: 'High ground',
      short: `+${percent(ELEVATION_DAMAGE_STEP)} attack downhill, +1 range`,
      howTo: `Attacking from higher ground hits ${percent(ELEVATION_DAMAGE_STEP)} harder per level, and archers and mages on hills or snow reach 1 hex further${fog ? ` and see ${HIGH_GROUND_SIGHT_BONUS} further` : ''}. Climbing costs extra movement, so get there early and let the enemy attack uphill.`,
      using: onHexes(high),
      hexes: high
    });
  }

  // Healing springs
  const springs = hexesWhere(t => t === 'spring');
  if (springs.length > 0) {
    buffs.push({
      id: 'spring',
      kind: 'terrain',
      terrain: 'spring',
      name: 'Healing spring',
      short: `+${TERRAIN_EFFECTS.spring.healPerTurn} health per turn`,
      howTo: `A troop on a spring recovers ${TERRAIN_EFFECTS.spring.healPerTurn} health at the end of each of your turns. Pull wounded troops back here between fights instead of losing them.`,
      using: onHexes(springs),
      hexes: springs
    });
  }

  // Gold mines
  const mines = state.hexGrid.filter(hex => hex.isResourceHex);
  if (mines.length > 0) {
    const gold = mines[0].resourceValue ?? 0;
    buffs.push({
      id: 'mines',
      kind: 'objective',
      terrain: 'resource',
      name: 'Gold mines',
      short: `+${gold} gold per turn each`,
      howTo: `Leave a troop standing on a mine and it pays ${gold} gold at the end of each of your turns - more cards to play. Cheap, sturdy troops make good miners.`,
      using: onHexes(mines.map(hex => hex.coordinates)),
      hexes: mines.map(hex => hex.coordinates)
    });
  }

  // Camps
  const camps = state.hexGrid.filter(hex => hex.isCamp);
  if (camps.length > 0) {
    buffs.push({
      id: 'camps',
      kind: 'objective',
      name: 'Camps',
      short: `+${CAMP_INCOME} gold per turn, deploy there`,
      howTo: `Step a troop onto a camp to claim it: it pays ${CAMP_INCOME} gold every turn and you can deploy new cards next to it, closer to the front. Enemy camps can be taken the same way.`,
      using: camps.filter(hex => hex.owner === side).length,
      hexes: camps.map(hex => hex.coordinates)
    });
  }

  // Bonds this side brought
  for (const bondId of state.bonds ?? []) {
    if (side !== 'player') break;
    const bond = getBond(bondId);
    const [a, b] = bond.cards;
    const members = units.filter(unit => bond.cards.includes(unit.type as typeof a));
    buffs.push({
      id: `bond-${bond.id}`,
      kind: 'bond',
      bondCards: [a, b],
      name: bond.name,
      short: describeBond(bond),
      howTo: `Every ${getTroop(a).name} and ${getTroop(b).name} troop you deploy this battle gets this bonus. ${bond.flavor}`,
      using: members.length,
      hexes: members.map(unit => unit.position)
    });
  }

  // Flanking
  buffs.push({
    id: 'flanking',
    kind: 'tactic',
    name: 'Flanking',
    short: `+${percent(FLANK_BONUS)} damage per extra troop beside`,
    howTo: `When you attack an enemy, each other troop of yours standing next to it adds ${percent(FLANK_BONUS)} damage (up to ${MAX_FLANKERS}). Surround one enemy at a time instead of spreading out.`,
    using: 0,
    hexes: []
  });

  // A breached enemy castle
  if (canStormCastle(state, side)) {
    const castle = findBaseHex(state, side === 'player' ? 'ai' : 'player');
    buffs.push({
      id: 'breach',
      kind: 'objective',
      name: 'Walls breached!',
      short: 'Step onto the enemy castle to win',
      howTo: 'The enemy castle is down to half health or less: move any troop onto it to storm it and win the battle at once.',
      using: 0,
      hexes: castle ? [castle.coordinates] : []
    });
  }

  return buffs;
};
