import type { Ability, Roster } from '@/types/game';
import { ABILITIES, TroopId, getTroop } from './troops';

// Bonds: pairs of cards that fight better together. Bring both into a battle and the bond's
// bonuses apply to the troops you recruit from them for the whole battle.

export type BondId =
  | 'shieldWall' | 'coveringFire' | 'crossfire' | 'hammerAndAnvil' | 'arcaneWard' | 'holyOrder'
  | 'wolfPack' | 'volley' | 'crusade' | 'escort' | 'skyRiders' | 'highMagic';

export interface BondBonus {
  // Extra share of attack and health, e.g. 0.15 for +15%
  attack?: number;
  health?: number;
  // An ability the troop gains
  ability?: Ability;
}

export interface BondDef {
  id: BondId;
  name: string;
  cards: [TroopId, TroopId];
  bonuses: Partial<Record<TroopId, BondBonus>>;
  flavor: string;
}

export const BONDS: BondDef[] = [
  {
    id: 'shieldWall', name: 'Shield Wall', cards: ['infantry', 'tank'],
    bonuses: { infantry: { health: 0.15 }, tank: { health: 0.15 } },
    flavor: 'Swords in front, pikes behind - a line that does not break.'
  },
  {
    id: 'coveringFire', name: 'Covering Fire', cards: ['artillery', 'infantry'],
    bonuses: { artillery: { attack: 0.15 } },
    flavor: 'With a wall of blades ahead, the archers take careful aim.'
  },
  {
    id: 'crossfire', name: 'Crossfire', cards: ['rogue', 'artillery'],
    bonuses: { rogue: { attack: 0.1 }, artillery: { attack: 0.1 } },
    flavor: 'Bolts from the front, knives from the side.'
  },
  {
    id: 'hammerAndAnvil', name: 'Hammer and Anvil', cards: ['helicopter', 'shieldbearer'],
    bonuses: { helicopter: { attack: 0.2 } },
    flavor: 'The shields hold the foe in place; the knights ride it down.'
  },
  {
    id: 'arcaneWard', name: 'Arcane Ward', cards: ['medic', 'shieldbearer'],
    bonuses: { medic: { health: 0.25 }, shieldbearer: { attack: 0.15 } },
    flavor: 'Shields raised around the mages, spells woven around the shields.'
  },
  {
    id: 'holyOrder', name: 'Holy Order', cards: ['cleric', 'helicopter'],
    bonuses: { helicopter: { attack: 0.1, health: 0.15 } },
    flavor: 'Knights who ride out blessed come home again.'
  },
  {
    id: 'wolfPack', name: 'Wolf Pack', cards: ['berserker', 'rogue'],
    bonuses: { berserker: { attack: 0.15 }, rogue: { health: 0.2 } },
    flavor: 'The rogues pick the target; the berserkers do the rest.'
  },
  {
    id: 'volley', name: 'Volley', cards: ['artillery', 'longbow'],
    bonuses: { artillery: { attack: 0.15 }, longbow: { attack: 0.15 } },
    flavor: 'The sky goes dark with arrows.'
  },
  {
    id: 'crusade', name: 'Crusade', cards: ['cleric', 'berserker'],
    bonuses: { berserker: { ability: 'regenerate' } },
    flavor: 'The clerics pray over the berserkers, and their wounds close as they fight.'
  },
  {
    id: 'escort', name: 'Escort', cards: ['sapper', 'tank'],
    bonuses: { sapper: { health: 0.25 } },
    flavor: 'A ring of pikes keeps the powder dry until the walls are reached.'
  },
  {
    id: 'skyRiders', name: 'Sky Riders', cards: ['pegasus', 'helicopter'],
    bonuses: { pegasus: { attack: 0.15 }, helicopter: { attack: 0.15 } },
    flavor: 'One charge on the ground, one from the clouds.'
  },
  {
    id: 'highMagic', name: 'High Magic', cards: ['archmage', 'medic'],
    bonuses: { archmage: { attack: 0.2 }, medic: { attack: 0.2 } },
    flavor: 'The archmage leads the circle, and every spell burns brighter.'
  }
];

export const getBond = (id: BondId) => BONDS.find(bond => bond.id === id)!;

// Bonds a set of cards completes
export const activeBonds = (cards: readonly TroopId[]): BondDef[] =>
  BONDS.filter(bond => bond.cards.every(card => cards.includes(card)));

// Bonds the card takes part in
export const bondsOf = (card: TroopId): BondDef[] => BONDS.filter(bond => bond.cards.includes(card));

// The other card of a bond
export const bondPartner = (bond: BondDef, card: TroopId): TroopId => bond.cards[0] === card ? bond.cards[1] : bond.cards[0];

// A roster with the bonuses of these bonds applied
export const applyBonds = (roster: Roster, bonds: readonly BondDef[]): Roster => {
  const result: Roster = {};
  for (const [id, stats] of Object.entries(roster) as [TroopId, NonNullable<Roster[TroopId]>][]) {
    let attack = 1;
    let health = 1;
    const abilities = [...stats.abilities];
    for (const bond of bonds) {
      const bonus = bond.bonuses[id];
      if (!bonus) continue;
      attack += bonus.attack ?? 0;
      health += bonus.health ?? 0;
      if (bonus.ability && !abilities.includes(bonus.ability)) abilities.push(bonus.ability);
    }
    result[id] = {
      ...stats,
      attackPower: Math.round(stats.attackPower * attack * 10) / 10,
      maxLifespan: Math.round(stats.maxLifespan * health),
      abilities
    };
  }
  return result;
};

// "Archers +15% attack", "Berserkers gain Regenerates"
export const describeBonus = (card: TroopId, bonus: BondBonus): string => {
  const parts: string[] = [];
  if (bonus.attack) parts.push(`+${Math.round(bonus.attack * 100)}% attack`);
  if (bonus.health) parts.push(`+${Math.round(bonus.health * 100)}% health`);
  if (bonus.ability) parts.push(`gain ${ABILITIES[bonus.ability].name}`);
  return `${getTroop(card).name} ${parts.join(', ')}`;
};

export const describeBond = (bond: BondDef): string =>
  (Object.entries(bond.bonuses) as [TroopId, BondBonus][]).map(([card, bonus]) => describeBonus(card, bonus)).join('; ');
