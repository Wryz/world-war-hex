import { MAX_CARD_LEVEL, PLAYER_CARD_IDS, Rarity, TroopId, cardPower, getTroop } from '../game/troops';

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

// --- Shop ----------------------------------------------------------------------------------

const CARD_PRICES: Record<Rarity, number> = { common: 120, rare: 300, epic: 700, legendary: 1500, boss: 0 };
const UPGRADE_BASE: Record<Rarity, number> = { common: 30, rare: 50, epic: 80, legendary: 120, boss: 0 };
const UPGRADE_GROWTH = 1.5;

export const cardPrice = (id: TroopId) => CARD_PRICES[getTroop(id).rarity];

// Coins to raise a card from `level` to `level + 1`, or null at max level
export const upgradeCost = (id: TroopId, level: number): number | null =>
  level >= MAX_CARD_LEVEL ? null : Math.round(UPGRADE_BASE[getTroop(id).rarity] * UPGRADE_GROWTH ** (level - 1) / 5) * 5;

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
          const cost = upgradeCost(id, owned);
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
