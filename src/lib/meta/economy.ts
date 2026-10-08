import { BASE_MAX_CARD_LEVEL, MAX_CARD_LEVEL, PLAYER_CARD_IDS, Rarity, TroopId, cardPower, getTroop } from '../game/troops';
import { MAX_TACTIC_LEVEL, TacticId } from '../game/tactics';

// The campaign economy: coins earned from battles, card prices and upgrade costs, and the
// progression model that sets each level's recommended power.

// --- Rewards -------------------------------------------------------------------------------

// Coins for winning a campaign level the first time with one star
export const baseLevelReward = (levelId: number) => 20 + 3 * levelId;

// Each star beyond the first adds a quarter of the base reward
const STAR_BONUS = 0.25;
// Replaying a level you have already beaten pays half
const REPLAY_FACTOR = 0.5;
// Every star earned for the first time pays a one-off bonus
const NEW_STAR_BONUS = 0.2;
// Losing still pays something, more the harder you hit the enemy castle
const LOSS_BASE = 0.15;
const LOSS_PER_DAMAGE = 0.35;

export interface BattleReward {
  coins: number;
  // How the coins were made up, for the results screen
  breakdown: { label: string; coins: number }[];
}

export const levelWinReward = (levelId: number, stars: number, previousStars: number): BattleReward => {
  const base = baseLevelReward(levelId);
  const firstClear = previousStars === 0;
  const victory = Math.round(base * (1 + STAR_BONUS * (stars - 1)) * (firstClear ? 1 : REPLAY_FACTOR));
  const newStars = Math.max(0, stars - previousStars);
  const starBonus = Math.round(base * NEW_STAR_BONUS * newStars);
  const breakdown = [{ label: firstClear ? 'Victory' : 'Victory (replay)', coins: victory }];
  if (starBonus > 0) breakdown.push({ label: `${newStars} new ${newStars === 1 ? 'star' : 'stars'}`, coins: starBonus });
  return { coins: victory + starBonus, breakdown };
};

// `damageRatio` is the share of the enemy castle's health destroyed (0..1)
export const levelLossReward = (levelId: number, damageRatio: number): BattleReward => {
  const coins = Math.max(5, Math.round(baseLevelReward(levelId) * (LOSS_BASE + LOSS_PER_DAMAGE * damageRatio)));
  return { coins, breakdown: [{ label: 'Spoils of battle', coins }] };
};

// Quick battles pay a little, scaled to how far the campaign has got
export const quickBattleReward = (won: boolean, highestCleared: number): BattleReward => {
  const coins = Math.round((won ? 12 : 4) + highestCleared * (won ? 0.6 : 0.2));
  return { coins, breakdown: [{ label: won ? 'Skirmish won' : 'Skirmish fought', coins }] };
};

// Watching the optional ad on the results screen adds half the battle's reward again
export const AD_BONUS_FRACTION = 0.5;
export const adBonusCoins = (reward: BattleReward) => Math.max(5, Math.round(reward.coins * AD_BONUS_FRACTION));

// --- Shop ----------------------------------------------------------------------------------

const CARD_PRICES: Record<Rarity, number> = { common: 120, rare: 300, epic: 700, legendary: 1500, boss: 0 };
const UPGRADE_BASE: Record<Rarity, number> = { common: 30, rare: 50, epic: 80, legendary: 120, boss: 0 };
const UPGRADE_GROWTH = 1.5;

export const cardPrice = (id: TroopId) => CARD_PRICES[getTroop(id).rarity];

// Elite card levels (past level 10) open once this campaign level is won, and cost less extra per
// level than the first ten, so the last regions still have upgrades within reach
export const ELITE_UNLOCK_LEVEL = 100;
const ELITE_GROWTH = 1.25;

// Coins to raise a card from `level` to `level + 1`, or null at its max level (level 10 until the
// elite levels are open)
export const upgradeCost = (id: TroopId, level: number, eliteUnlocked = false): number | null => {
  if (level >= MAX_CARD_LEVEL || (level >= BASE_MAX_CARD_LEVEL && !eliteUnlocked)) return null;
  const base = UPGRADE_BASE[getTroop(id).rarity];
  const cost = level < BASE_MAX_CARD_LEVEL
    ? base * UPGRADE_GROWTH ** (level - 1)
    : base * UPGRADE_GROWTH ** (BASE_MAX_CARD_LEVEL - 2) * ELITE_GROWTH ** (level - BASE_MAX_CARD_LEVEL + 1);
  return Math.round(cost / 5) * 5;
};

// Campaign level that must be cleared before a card appears in the shop (starter cards are owned)
export const CARD_UNLOCK_LEVEL: Partial<Record<TroopId, number>> = {
  helicopter: 5,
  medic: 13,
  shieldbearer: 20,
  berserker: 27,
  longbow: 35,
  cleric: 45,
  sapper: 55,
  pegasus: 65,
  archmage: 78
};

export const STARTER_CARDS: TroopId[] = ['infantry', 'artillery', 'tank', 'rogue'];
// Cards brought into a battle: the player picks them before every fight
export const MAX_DECK_SIZE = 4;

// --- Tactic cards --------------------------------------------------------------------------

// Campaign level that must be cleared before a tactic card appears in the shop (starters are owned)
export const TACTIC_UNLOCK_LEVEL: Partial<Record<TacticId, number>> = {
  forcedMarch: 8,
  bulwark: 15,
  barricade: 22,
  smoke: 30,
  earthworks: 40,
  shadowstep: 50,
  callToArms: 60,
  sinkhole: 70
};

// Later tactics cost more
export const tacticPrice = (id: TacticId) => Math.round((100 + 4 * (TACTIC_UNLOCK_LEVEL[id] ?? 0)) / 10) * 10;

const TACTIC_UPGRADE_BASE = 25;
const TACTIC_UPGRADE_GROWTH = 1.45;

// Coins to raise a tactic card from `level` to `level + 1`, or null at its max level
export const tacticUpgradeCost = (level: number): number | null =>
  level >= MAX_TACTIC_LEVEL ? null : Math.round(TACTIC_UPGRADE_BASE * TACTIC_UPGRADE_GROWTH ** (level - 1) / 5) * 5;

// --- Power ---------------------------------------------------------------------------------

// A deck's power: the sum of its cards' power at their levels
export const deckPower = (deck: TroopId[], levels: Partial<Record<TroopId, number>>) =>
  deck.reduce((sum, id) => sum + cardPower(id, levels[id] ?? 1), 0);

// --- Progression model ---------------------------------------------------------------------

// What a player who clears each level once (with two stars on average, plus the odd replay or
// loss) can afford by each campaign level, spending coins as they come in on whatever adds the
// most power per coin. Recommended power is set from this, and enemy strength is tuned against it.
const AVERAGE_STARS = 2;
// Extra coins from replays and losses on top of first clears
const EXTRA_EARNINGS = 1.25;
// Recommended power sits a little below the model player's power, so it is reachable
export const RECOMMENDED_POWER_FACTOR = 0.92;

export interface ProgressionSnapshot {
  deck: TroopId[];
  levels: Partial<Record<TroopId, number>>;
  power: number;
  coinsEarned: number;
}

const buildProgression = (lastLevel: number): ProgressionSnapshot[] => {
  const levels: Partial<Record<TroopId, number>> = Object.fromEntries(STARTER_CARDS.map(id => [id, 1]));
  let coins = 0;
  let coinsEarned = 0;
  const snapshots: ProgressionSnapshot[] = [];

  const bestDeck = () => (Object.keys(levels) as TroopId[])
    .sort((a, b) => cardPower(b, levels[b]!) - cardPower(a, levels[a]!))
    .slice(0, MAX_DECK_SIZE);

  for (let level = 1; level <= lastLevel; level++) {
    const deck = bestDeck();
    snapshots.push({ deck, levels: { ...levels }, power: deckPower(deck, levels), coinsEarned });

    // Clear the level, then shop
    const earned = Math.round(levelWinReward(level, AVERAGE_STARS, 0).coins * EXTRA_EARNINGS);
    coins += earned;
    coinsEarned += earned;

    for (;;) {
      const current = bestDeck();
      const currentPower = deckPower(current, levels);
      let bestOption: { apply: () => void; cost: number; gain: number } | null = null;

      const consider = (cost: number, nextLevels: Partial<Record<TroopId, number>>, apply: () => void) => {
        if (cost > coins) return;
        const nextDeck = (Object.keys(nextLevels) as TroopId[])
          .sort((a, b) => cardPower(b, nextLevels[b]!) - cardPower(a, nextLevels[a]!))
          .slice(0, MAX_DECK_SIZE);
        const gain = deckPower(nextDeck, nextLevels) - currentPower;
        if (gain > 0 && (!bestOption || gain / cost > bestOption.gain / bestOption.cost)) {
          bestOption = { apply, cost, gain };
        }
      };

      for (const id of PLAYER_CARD_IDS) {
        const owned = levels[id];
        if (owned === undefined) {
          const unlockAt = CARD_UNLOCK_LEVEL[id];
          if (unlockAt !== undefined && unlockAt <= level) {
            consider(cardPrice(id), { ...levels, [id]: 1 }, () => { levels[id] = 1; });
          }
        } else {
          const cost = upgradeCost(id, owned, level > ELITE_UNLOCK_LEVEL);
          if (cost !== null) consider(cost, { ...levels, [id]: owned + 1 }, () => { levels[id] = owned + 1; });
        }
      }

      const chosen = bestOption as { apply: () => void; cost: number; gain: number } | null;
      if (!chosen) break;
      coins -= chosen.cost;
      chosen.apply();
    }
  }
  return snapshots;
};

// Campaign levels the model covers (levels.ts LEVEL_COUNT; not imported, as levels.ts imports this file)
const MODELLED_LEVELS = 150;
let progressionCache: ProgressionSnapshot[] | null = null;

// The model player's state when starting a campaign level (1-based)
export const expectedProgression = (levelId: number): ProgressionSnapshot => {
  progressionCache ??= buildProgression(MODELLED_LEVELS);
  return progressionCache[Math.min(Math.max(levelId, 1), progressionCache.length) - 1];
};

export const recommendedPower = (levelId: number) =>
  Math.round(expectedProgression(levelId).power * RECOMMENDED_POWER_FACTOR / 5) * 5;
