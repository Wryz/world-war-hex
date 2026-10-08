import type { Faction } from './troops';

// Tactic cards: one-off orders played during a battle. Each side brings three. From round 2, every
// second round each side draws one of its three at random (it can hold three at most), and plays
// them on its own turn. Cards level up to 10 in the Army and grow stronger as they do.

export type TacticId =
  | 'rally' | 'mend' | 'volley' | 'forcedMarch' | 'bulwark' | 'sabotage' | 'smoke' | 'earthworks'
  | 'shadowstep' | 'callToArms' | 'sinkhole';

// What a card is played on: nothing (it works at once), one of your troops, an enemy troop, or a hex
export type TacticTarget = 'none' | 'ownUnit' | 'enemyUnit' | 'hex';

export interface TacticDef {
  id: TacticId;
  name: string;
  target: TacticTarget;
  // What it does at a level
  describe: (level: number) => string;
  flavor: string;
}

export const TACTIC_LOADOUT_SIZE = 3;
export const TACTIC_HAND_LIMIT = 3;
export const MAX_TACTIC_LEVEL = 10;
// Cards are drawn at the start of each side's turn in round 2 and every second round after
export const FIRST_TACTIC_ROUND = 2;
export const TACTIC_DRAW_EVERY = 2;
// Cards aimed at a troop or a hex reach this far from your troops, castle and camps
export const TACTIC_REACH = 3;

export const isTacticDrawRound = (round: number) =>
  round >= FIRST_TACTIC_ROUND && (round - FIRST_TACTIC_ROUND) % TACTIC_DRAW_EVERY === 0;

const pct = (share: number) => `${Math.round(share * 100)}%`;
const round2 = (value: number) => Math.round(value * 100) / 100;

// --- The numbers behind each card, by level --------------------------------------------------

export const rallyBonus = (level: number) => round2(0.1 + 0.02 * (level - 1));
export const mendHeal = (level: number) => 5 + level;
export const volleyDamage = (level: number) => 2 + level;
export const marchBonus = (level: number) => (level >= 6 ? 3 : 2);
export const bulwarkReduction = (level: number) => round2(0.25 + 0.03 * (level - 1));
export const sabotageGold = (level: number) => 3 + level;
export const smokeRadius = (level: number) => (level >= 6 ? 2 : 1);
export const earthworksRaise = (level: number) => round2(0.4 + 0.06 * (level - 1));
export const shadowstepBonus = (level: number) => round2(0.05 + 0.03 * (level - 1));
export const callToArmsHealth = (level: number) => round2(0.05 * (level - 1));
export const sinkholeDepth = (level: number) => round2(0.3 + 0.05 * (level - 1));

export const TACTICS: Record<TacticId, TacticDef> = {
  rally: {
    id: 'rally', name: 'Rally', target: 'none',
    describe: level => `All your troops attack ${pct(rallyBonus(level))} harder this turn.`,
    flavor: 'Banners up, drums rolling - every blade swings harder.'
  },
  mend: {
    id: 'mend', name: 'Mend', target: 'ownUnit',
    describe: level => `Heal one of your troops ${mendHeal(level)} health.`,
    flavor: 'Bandages, salves and a stiff drink.'
  },
  volley: {
    id: 'volley', name: 'Volley', target: 'enemyUnit',
    describe: level => `Arrows rain on an enemy troop you can see within ${TACTIC_REACH} hexes of your army: ${volleyDamage(level)} damage.`,
    flavor: 'Every bow on the field, one target.'
  },
  forcedMarch: {
    id: 'forcedMarch', name: 'Forced March', target: 'ownUnit',
    describe: level => `One of your troops that hasn't moved gets +${marchBonus(level)} movement this turn.`,
    flavor: 'Rest is for after the battle.'
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', target: 'ownUnit',
    describe: level => `One of your troops takes ${pct(bulwarkReduction(level))} less damage until your next turn.`,
    flavor: 'Shields locked, heads down.'
  },
  sabotage: {
    id: 'sabotage', name: 'Sabotage', target: 'none',
    describe: level => `Spies burn the enemy's stores: they lose ${sabotageGold(level)} gold.`,
    flavor: 'A spark in the right granary.'
  },
  smoke: {
    id: 'smoke', name: 'Smoke Screen', target: 'hex',
    describe: level => `Smoke covers a hex and everything within ${smokeRadius(level)} of it until your next turn: nothing in it can be shot at from 2 or more hexes away, castles included.`,
    flavor: 'Wet straw and a good wind.'
  },
  earthworks: {
    id: 'earthworks', name: 'Earthworks', target: 'hex',
    describe: level => `Raise the ground of a hex (not one an enemy stands on) by ${earthworksRaise(level).toFixed(2)} for the rest of the battle.`,
    flavor: 'Dig here, pile it there - instant high ground.'
  },
  shadowstep: {
    id: 'shadowstep', name: 'Shadowstep', target: 'ownUnit',
    describe: level => `One of your troops strikes from the shadows this turn: its target can't strike back, and it attacks ${pct(shadowstepBonus(level))} harder.`,
    flavor: 'Gone before they turn around.'
  },
  callToArms: {
    id: 'callToArms', name: 'Call to Arms', target: 'none',
    describe: level => `The cheapest troop in your army joins for free next to your castle` +
      (callToArmsHealth(level) > 0 ? `, with ${pct(callToArmsHealth(level))} more health.` : '.'),
    flavor: 'Every farmhand with a pitchfork.'
  },
  sinkhole: {
    id: 'sinkhole', name: 'Sinkhole', target: 'hex',
    describe: level => `The ground of a hex and the hexes around it sinks ${sinkholeDepth(level).toFixed(2)} for the rest of the battle.`,
    flavor: 'The tunnels below give way.'
  }
};

export const TACTIC_IDS = Object.keys(TACTICS) as TacticId[];

export const isTacticId = (value: unknown): value is TacticId => typeof value === 'string' && value in TACTICS;

// Cards every player starts with
export const STARTER_TACTICS: TacticId[] = ['rally', 'mend', 'volley'];

// The tactics each enemy faction brings into battle: two all-rounders and one in its own style
export const FACTION_TACTICS: Record<Faction, TacticId[]> = {
  kingdom: ['rally', 'volley', 'bulwark'],
  bandits: ['volley', 'rally', 'shadowstep'],
  goblins: ['volley', 'callToArms', 'sabotage'],
  beasts: ['rally', 'mend', 'forcedMarch'],
  swamp: ['mend', 'volley', 'smoke'],
  desert: ['volley', 'bulwark', 'earthworks'],
  frost: ['bulwark', 'mend', 'sinkhole'],
  undead: ['callToArms', 'mend', 'smoke'],
  orcs: ['rally', 'callToArms', 'volley'],
  infernal: ['volley', 'rally', 'sinkhole'],
  dragons: ['volley', 'rally', 'earthworks']
};

// Level of the enemy's tactic cards on a campaign level: they grow with the campaign
export const enemyTacticLevel = (levelId: number) => Math.min(MAX_TACTIC_LEVEL, 1 + Math.floor((levelId - 1) / 15));
