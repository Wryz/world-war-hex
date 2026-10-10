import { BASE_MAX_CARD_LEVEL, MAX_CARD_LEVEL, Rarity, TroopId, cardStats, getTroop, statsPower } from '../game/troops';
import {
  ATTRIBUTE_PICKS, BASE_CARD_IDS, LINEAGES, LINEAGE_IDS, LineageId, LineageTree, Trees, applyTree, baseOf, lineageOf
} from '../game/lineages';

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

// Quick battles pay a little, scaled to how far the campaign has got - and down for a rival weaker
// than the player's own cards (a challenge link can field a rival of any level), `rivalShare` being
// its level over theirs
export const quickBattleReward = (won: boolean, highestCleared: number, rivalShare = 1): BattleReward => {
  // (a share that isn't a number - from a damaged save - pays in full)
  const share = Number.isFinite(rivalShare) ? Math.min(1, Math.max(0, rivalShare)) : 1;
  const coins = Math.round(((won ? 12 : 4) + highestCleared * (won ? 0.6 : 0.2)) * share);
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

// A card's upgrades are its lineage's: every form trains with the base card, at the base's cost
const upgradeRarity = (id: TroopId): Rarity => getTroop(baseOf(id)).rarity;

// Elite card levels (past level 10) open once this campaign level is won, and cost less extra per
// level than the first ten, so the last regions still have upgrades within reach
export const ELITE_UNLOCK_LEVEL = 100;
const ELITE_GROWTH = 1.25;

// Coins to raise a card from `level` to `level + 1`, or null at its max level (level 10 until the
// elite levels are open)
export const upgradeCost = (id: TroopId, level: number, eliteUnlocked = false): number | null =>
  upgradeCostAt(upgradeRarity(id), level, eliteUnlocked);

// Coins every upgrade of a card up to `level` cost at the card's own rarity, back when each card was
// upgraded on its own (for refunds to old saves)
export const ownUpgradeLadder = (id: TroopId, level: number): number => {
  let coins = 0;
  for (let from = 1; from < Math.min(level, MAX_CARD_LEVEL); from++) coins += upgradeCostAt(getTroop(id).rarity, from, true) ?? 0;
  return coins;
};

const upgradeCostAt = (rarity: Rarity, level: number, eliteUnlocked: boolean): number | null => {
  if (level >= MAX_CARD_LEVEL || (level >= BASE_MAX_CARD_LEVEL && !eliteUnlocked)) return null;
  const base = UPGRADE_BASE[rarity];
  const cost = level < BASE_MAX_CARD_LEVEL
    ? base * UPGRADE_GROWTH ** (level - 1)
    : base * UPGRADE_GROWTH ** (BASE_MAX_CARD_LEVEL - 2) * ELITE_GROWTH ** (level - BASE_MAX_CARD_LEVEL + 1);
  return Math.round(cost / 5) * 5;
};

// Campaign level that must be cleared before a base card appears in the shop (the starter cards
// are owned from the start)
export const SHOP_UNLOCK_LEVEL: Partial<Record<TroopId, number>> = { engineer: 9, medic: 13 };

// Campaign level that must be cleared before a card can be had: bought (a base card) or evolved
// (a form, see lineages.ts)
export const CARD_UNLOCK_LEVEL: Partial<Record<TroopId, number>> = {
  ...SHOP_UNLOCK_LEVEL,
  ...Object.fromEntries(LINEAGE_IDS.flatMap(id => LINEAGES[id].forms.map(form => [form.id, form.unlockLevel])))
};

export const STARTER_CARDS: TroopId[] = ['infantry', 'artillery', 'tank', 'rogue'];
// Cards brought into a battle: the player picks them before every fight
export const MAX_DECK_SIZE = 4;

// --- Power ---------------------------------------------------------------------------------

// A card's power at a level, with its lineage's skill tree
export const treeCardPower = (id: TroopId, level: number, trees?: Trees) => {
  const lineage = lineageOf(id);
  return statsPower(applyTree(cardStats(id, level), lineage ? trees?.[lineage] : undefined)) + (lineage && trees?.[lineage]?.skill ? SKILL_POWER : 0);
};
// What a learnt skill adds to a card's power
const SKILL_POWER = 4;

// A deck's power: the sum of its cards' power at their levels, with their skill trees
export const deckPower = (deck: TroopId[], levels: Partial<Record<TroopId, number>>, trees?: Trees) =>
  deck.reduce((sum, id) => sum + treeCardPower(id, levels[id] ?? 1, trees), 0);

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
  trees: Trees;
  power: number;
  coinsEarned: number;
}

// The model player gathers what a form needs within a few levels of it opening, fills in its trees
// as it goes (an attribute early on, the second a little later, then a skill), and brings the
// strongest form of each lineage it has
const EVOLVE_DELAY = 5;
const FIRST_ATTRIBUTE_AT = 3;
const SECOND_ATTRIBUTE_AT = 8;
const SKILL_AT = 15;
const REPEAT_CLASS_WORTH = 0.8;

const modelTree = (lineage: LineageId, level: number): LineageTree | undefined => {
  const { attributes, skills } = LINEAGES[lineage];
  if (level < FIRST_ATTRIBUTE_AT) return undefined;
  return {
    attributes: attributes.slice(0, level >= SECOND_ATTRIBUTE_AT ? ATTRIBUTE_PICKS : 1),
    skill: level >= SKILL_AT ? skills[0] : undefined
  };
};

const buildProgression = (lastLevel: number): ProgressionSnapshot[] => {
  // Lineage levels, keyed by base card
  const owned: Partial<Record<TroopId, number>> = Object.fromEntries(STARTER_CARDS.map(id => [id, 1]));
  let coins = 0;
  let coinsEarned = 0;
  const snapshots: ProgressionSnapshot[] = [];

  // Every card the model player has at a campaign level, at its lineage's level
  const cardsAt = (bases: Partial<Record<TroopId, number>>, level: number): Partial<Record<TroopId, number>> => {
    const cards: Partial<Record<TroopId, number>> = {};
    for (const [base, cardLevel] of Object.entries(bases) as [TroopId, number][]) {
      const lineage = lineageOf(base)!;
      cards[base] = cardLevel;
      for (const form of LINEAGES[lineage].forms) {
        if (form.unlockLevel + EVOLVE_DELAY <= level) cards[form.id] = cardLevel;
      }
    }
    return cards;
  };
  const treesAt = (level: number): Trees => Object.fromEntries(LINEAGE_IDS.map(id => [id, modelTree(id, level)]).filter(([, tree]) => tree));
  const bestDeck = (cards: Partial<Record<TroopId, number>>, trees: Trees) => {
    // The strongest form of each lineage, then the strongest lineages
    const best = new Map<LineageId, TroopId>();
    for (const id of Object.keys(cards) as TroopId[]) {
      const lineage = lineageOf(id)!;
      const current = best.get(lineage);
      if (!current || treeCardPower(id, cards[id]!, trees) > treeCardPower(current, cards[current]!, trees)) best.set(lineage, id);
    }
    // A second troop of a class it already brings counts for less (an army needs a mix)
    const left = [...best.values()];
    const deck: TroopId[] = [];
    while (deck.length < MAX_DECK_SIZE && left.length > 0) {
      const worth = (id: TroopId) => treeCardPower(id, cards[id]!, trees) * (deck.some(d => getTroop(d).troopClass === getTroop(id).troopClass) ? REPEAT_CLASS_WORTH : 1);
      left.sort((a, b) => worth(b) - worth(a));
      deck.push(left.shift()!);
    }
    return deck;
  };
  const powerOf = (bases: Partial<Record<TroopId, number>>, level: number, trees: Trees) => {
    const cards = cardsAt(bases, level);
    return deckPower(bestDeck(cards, trees), cards, trees);
  };

  for (let level = 1; level <= lastLevel; level++) {
    const trees = treesAt(level);
    const cards = cardsAt(owned, level);
    const deck = bestDeck(cards, trees);
    snapshots.push({ deck, levels: cards, trees, power: deckPower(deck, cards, trees), coinsEarned });

    // Clear the level, then shop
    const earned = Math.round(levelWinReward(level, AVERAGE_STARS, 0).coins * EXTRA_EARNINGS);
    coins += earned;
    coinsEarned += earned;

    const nextTrees = treesAt(level + 1);
    for (;;) {
      const currentPower = powerOf(owned, level + 1, nextTrees);
      let bestOption: { apply: () => void; cost: number; gain: number } | null = null;

      const consider = (cost: number, next: Partial<Record<TroopId, number>>, apply: () => void) => {
        if (cost > coins) return;
        const gain = powerOf(next, level + 1, nextTrees) - currentPower;
        if (gain > 0 && (!bestOption || gain / cost > bestOption.gain / bestOption.cost)) {
          bestOption = { apply, cost, gain };
        }
      };

      // Investing in a lineage: buying it if need be and training it up one or more levels (a
      // lineage pays off only once it's strong enough to make the deck)
      for (const id of BASE_CARD_IDS) {
        const from = owned[id];
        let cost = 0;
        if (from === undefined) {
          const unlockAt = SHOP_UNLOCK_LEVEL[id];
          if (unlockAt === undefined || unlockAt > level) continue;
          cost = cardPrice(id);
        }
        for (let to = from ?? 1; ; to++) {
          if (to > (from ?? 0)) {
            const target = to;
            consider(cost, { ...owned, [id]: target }, () => { owned[id] = target; });
          }
          const step = upgradeCost(id, to, level >= ELITE_UNLOCK_LEVEL);
          if (step === null) break;
          cost += step;
          if (cost > coins) break;
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
