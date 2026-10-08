import { useSyncExternalStore } from 'react';
import type { SideStats } from '@/types/game';
import { MAX_CARD_LEVEL, PLAYER_CARD_IDS, TroopId, isTroopId } from '../game/troops';
import {
  BattleReward,
  CARD_UNLOCK_LEVEL,
  ELITE_UNLOCK_LEVEL,
  MAX_DECK_SIZE,
  STARTER_CARDS,
  cardPrice,
  deckPower,
  levelLossReward,
  levelWinReward,
  quickBattleReward,
  upgradeCost,
  TACTIC_UNLOCK_LEVEL,
  tacticPrice,
  tacticUpgradeCost
} from './economy';
import { MAX_TACTIC_LEVEL, STARTER_TACTICS, TACTIC_IDS, TACTIC_LOADOUT_SIZE, TacticId, isTacticId } from '../game/tactics';
import { LEVEL_COUNT } from '../campaign/levels';
import {
  CARD_SKINS, CASTLE_STYLES, CardSkinId, CastleStyleId, DEFAULT_CARD_SKIN, DEFAULT_CASTLE_STYLE, isCardSkinId, isCastleStyleId
} from './cosmetics';
import { trackEvent } from '../analytics';

// The player's saved progress: coins, cards, campaign stars, the bestiary and lifetime stats.
// Kept in localStorage and exportable to a file.

const PROFILE_KEY = 'wwhProfile';
const PROFILE_VERSION = 1;

export interface LevelRecord {
  stars: number;
  wins: number;
  losses: number;
  // Fewest rounds the level was won in
  bestRounds?: number;
}

export interface BestiaryEntry {
  seen: number;
  slain: number;
}

export interface ProfileStats {
  battles: number;
  wins: number;
  losses: number;
  quickBattles: number;
  coinsEarned: number;
  coinsSpent: number;
  unitsDeployed: number;
  enemiesSlain: number;
  unitsLost: number;
  castlesStormed: number;
  castlesDestroyed: number;
  winsOnTime: number;
  bossesDefeated: number;
  campsCaptured: number;
  siegeDamage: number;
  roundsPlayed: number;
  playSeconds: number;
  fastestWinRounds?: number;
  currentStreak: number;
  bestStreak: number;
  cardsPlayed: Partial<Record<TroopId, number>>;
  cardsBought: number;
  upgradesBought: number;
}

export interface ProfileCosmetics {
  cardSkins: CardSkinId[];
  castleStyles: CastleStyleId[];
  cardSkin: CardSkinId;
  castleStyle: CastleStyleId;
}

export interface Profile {
  version: number;
  coins: number;
  // Owned cards and their levels
  cards: Partial<Record<TroopId, number>>;
  deck: TroopId[];
  levels: Record<number, LevelRecord>;
  bestiary: Partial<Record<TroopId, BestiaryEntry>>;
  stats: ProfileStats;
  tutorialDone: boolean;
  // Card frames and castle styles owned, and the ones in use
  cosmetics: ProfileCosmetics;
  // Tactic cards owned and their levels, and the three brought into battle
  tactics: Partial<Record<TacticId, number>>;
  tacticLoadout: TacticId[];
  createdAt: string;
  updatedAt: string;
}

const emptyStats = (): ProfileStats => ({
  battles: 0, wins: 0, losses: 0, quickBattles: 0, coinsEarned: 0, coinsSpent: 0, unitsDeployed: 0,
  enemiesSlain: 0, unitsLost: 0, castlesStormed: 0, castlesDestroyed: 0, winsOnTime: 0, bossesDefeated: 0,
  campsCaptured: 0, siegeDamage: 0, roundsPlayed: 0, playSeconds: 0, currentStreak: 0, bestStreak: 0,
  cardsPlayed: {}, cardsBought: 0, upgradesBought: 0
});

export const createProfile = (): Profile => {
  const now = new Date().toISOString();
  return {
    version: PROFILE_VERSION,
    coins: 0,
    cards: Object.fromEntries(STARTER_CARDS.map(id => [id, 1])),
    deck: [...STARTER_CARDS],
    levels: {},
    bestiary: {},
    stats: emptyStats(),
    tutorialDone: false,
    cosmetics: { cardSkins: [DEFAULT_CARD_SKIN], castleStyles: [DEFAULT_CASTLE_STYLE], cardSkin: DEFAULT_CARD_SKIN, castleStyle: DEFAULT_CASTLE_STYLE },
    tactics: Object.fromEntries(STARTER_TACTICS.map(id => [id, 1])),
    tacticLoadout: [...STARTER_TACTICS],
    createdAt: now,
    updatedAt: now
  };
};

// --- Validation (saves can come from an imported file) --------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toCount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

// Turn whatever was stored into a valid profile, dropping anything unknown
export const sanitizeProfile = (raw: unknown): Profile | null => {
  if (!isRecord(raw) || typeof raw.version !== 'number' || raw.version > PROFILE_VERSION) return null;
  const base = createProfile();

  const cards: Profile['cards'] = {};
  if (isRecord(raw.cards)) {
    for (const [id, level] of Object.entries(raw.cards)) {
      if (isTroopId(id) && PLAYER_CARD_IDS.includes(id)) {
        cards[id] = Math.min(MAX_CARD_LEVEL, Math.max(1, toCount(level)));
      }
    }
  }
  for (const id of STARTER_CARDS) cards[id] ??= 1;

  const deck = (Array.isArray(raw.deck) ? raw.deck : [])
    .filter((id): id is TroopId => typeof id === 'string' && isTroopId(id) && cards[id] !== undefined)
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, MAX_DECK_SIZE);

  const levels: Profile['levels'] = {};
  if (isRecord(raw.levels)) {
    for (const [key, record] of Object.entries(raw.levels)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id < 1 || id > LEVEL_COUNT || !isRecord(record)) continue;
      levels[id] = {
        stars: Math.min(3, toCount(record.stars)),
        wins: toCount(record.wins),
        losses: toCount(record.losses),
        bestRounds: record.bestRounds === undefined ? undefined : toCount(record.bestRounds)
      };
    }
  }

  const bestiary: Profile['bestiary'] = {};
  if (isRecord(raw.bestiary)) {
    for (const [id, entry] of Object.entries(raw.bestiary)) {
      if (isTroopId(id) && isRecord(entry)) bestiary[id] = { seen: toCount(entry.seen), slain: toCount(entry.slain) };
    }
  }

  const stats = emptyStats();
  if (isRecord(raw.stats)) {
    for (const key of Object.keys(stats) as (keyof ProfileStats)[]) {
      const value = raw.stats[key];
      if (key === 'cardsPlayed') {
        if (isRecord(value)) {
          for (const [id, count] of Object.entries(value)) if (isTroopId(id)) stats.cardsPlayed[id] = toCount(count);
        }
      } else if (key === 'fastestWinRounds') {
        stats.fastestWinRounds = value === undefined ? undefined : toCount(value);
      } else {
        stats[key] = toCount(value);
      }
    }
  }

  const cosmetics = { ...base.cosmetics };
  if (isRecord(raw.cosmetics)) {
    const skins = Array.isArray(raw.cosmetics.cardSkins) ? raw.cosmetics.cardSkins.filter(isCardSkinId) : [];
    const styles = Array.isArray(raw.cosmetics.castleStyles) ? raw.cosmetics.castleStyles.filter(isCastleStyleId) : [];
    cosmetics.cardSkins = [...new Set([DEFAULT_CARD_SKIN, ...skins])];
    cosmetics.castleStyles = [...new Set([DEFAULT_CASTLE_STYLE, ...styles])];
    if (isCardSkinId(raw.cosmetics.cardSkin) && cosmetics.cardSkins.includes(raw.cosmetics.cardSkin)) cosmetics.cardSkin = raw.cosmetics.cardSkin;
    if (isCastleStyleId(raw.cosmetics.castleStyle) && cosmetics.castleStyles.includes(raw.cosmetics.castleStyle)) cosmetics.castleStyle = raw.cosmetics.castleStyle;
  }

  // Tactic cards came later: older saves get the starter cards
  const tactics: Profile['tactics'] = {};
  if (isRecord(raw.tactics)) {
    for (const [id, level] of Object.entries(raw.tactics)) {
      if (isTacticId(id)) tactics[id] = Math.min(MAX_TACTIC_LEVEL, Math.max(1, toCount(level)));
    }
  }
  for (const id of STARTER_TACTICS) tactics[id] ??= 1;
  const tacticLoadout = (Array.isArray(raw.tacticLoadout) ? raw.tacticLoadout : [])
    .filter((id): id is TacticId => isTacticId(id) && tactics[id] !== undefined)
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, TACTIC_LOADOUT_SIZE);

  return {
    ...base,
    coins: toCount(raw.coins),
    cards,
    deck: deck.length > 0 ? deck : [...STARTER_CARDS],
    levels,
    bestiary,
    stats,
    tutorialDone: raw.tutorialDone === true,
    cosmetics,
    tactics,
    tacticLoadout: tacticLoadout.length > 0 ? tacticLoadout : STARTER_TACTICS.filter(id => tactics[id] !== undefined),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt
  };
};

// --- Store ---------------------------------------------------------------------------------

let current: Profile | null = null;
const listeners = new Set<() => void>();

const readStoredProfile = (): Profile => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return sanitizeProfile(JSON.parse(raw)) ?? createProfile();
  } catch {
    // Unreadable storage: start fresh (and keep playing in memory)
  }
  return createProfile();
};

export const getProfile = (): Profile => {
  if (!current) current = typeof window === 'undefined' ? createProfile() : readStoredProfile();
  return current;
};

const setProfile = (profile: Profile) => {
  current = { ...profile, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(current));
  } catch (error) {
    console.error('Could not save progress:', error);
  }
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Server render (and the first client render) use a fresh profile, so hydration always matches
const serverProfile = createProfile();

// The current profile for React components
export const useProfile = (): Profile => useSyncExternalStore(subscribe, getProfile, () => serverProfile);

// Whether the client has read the stored profile yet (false during server render and hydration)
export const useHasHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

// --- Derived values ------------------------------------------------------------------------

// Highest campaign level won
export const highestCleared = (profile: Profile): number =>
  Object.entries(profile.levels).reduce((max, [id, record]) => (record.wins > 0 ? Math.max(max, Number(id)) : max), 0);

// The furthest level the player may play
export const highestUnlocked = (profile: Profile): number => Math.min(LEVEL_COUNT, highestCleared(profile) + 1);

export const isLevelUnlocked = (profile: Profile, levelId: number) => levelId <= highestUnlocked(profile);

// Whether cards may train past level 10
export const eliteUnlocked = (profile: Profile) => highestCleared(profile) >= ELITE_UNLOCK_LEVEL;

export const totalStars = (profile: Profile) =>
  Object.values(profile.levels).reduce((sum, record) => sum + record.stars, 0);

export const profilePower = (profile: Profile) => deckPower(profile.deck, profile.cards);

// Whether a card can be bought in the shop yet
export const isCardAvailable = (profile: Profile, id: TroopId) => {
  const unlockAt = CARD_UNLOCK_LEVEL[id];
  return unlockAt !== undefined && highestCleared(profile) >= unlockAt;
};

// --- Shop and deck -------------------------------------------------------------------------

export const buyCard = (id: TroopId): boolean => {
  const profile = getProfile();
  if (profile.cards[id] !== undefined || !isCardAvailable(profile, id)) return false;
  const price = cardPrice(id);
  if (profile.coins < price) return false;
  setProfile({
    ...profile,
    coins: profile.coins - price,
    cards: { ...profile.cards, [id]: 1 },
    // New cards join the deck if there is room
    deck: profile.deck.length < MAX_DECK_SIZE ? [...profile.deck, id] : profile.deck,
    stats: { ...profile.stats, coinsSpent: profile.stats.coinsSpent + price, cardsBought: profile.stats.cardsBought + 1 }
  });
  trackEvent('card_bought', { card: id, price, highest_cleared: highestCleared(profile) });
  return true;
};

export const upgradeCard = (id: TroopId): boolean => {
  const profile = getProfile();
  const level = profile.cards[id];
  if (level === undefined) return false;
  const cost = upgradeCost(id, level, eliteUnlocked(profile));
  if (cost === null || profile.coins < cost) return false;
  setProfile({
    ...profile,
    coins: profile.coins - cost,
    cards: { ...profile.cards, [id]: level + 1 },
    stats: { ...profile.stats, coinsSpent: profile.stats.coinsSpent + cost, upgradesBought: profile.stats.upgradesBought + 1 }
  });
  trackEvent('card_upgraded', { card: id, level: level + 1, cost });
  return true;
};

// Add a card to the deck, or take it out (a deck always keeps at least one card)
export const toggleDeckCard = (id: TroopId): boolean => {
  const profile = getProfile();
  if (profile.cards[id] === undefined) return false;
  if (profile.deck.includes(id)) {
    if (profile.deck.length <= 1) return false;
    setProfile({ ...profile, deck: profile.deck.filter(card => card !== id) });
    return true;
  }
  if (profile.deck.length >= MAX_DECK_SIZE) return false;
  setProfile({ ...profile, deck: [...profile.deck, id] });
  return true;
};

// Replace the battle loadout (owned cards only, at most MAX_DECK_SIZE, at least one)
export const setDeck = (deck: TroopId[]): boolean => {
  const profile = getProfile();
  const next = deck.filter((id, index) => profile.cards[id] !== undefined && deck.indexOf(id) === index).slice(0, MAX_DECK_SIZE);
  if (next.length === 0) return false;
  setProfile({ ...profile, deck: next });
  return true;
};

// --- Tactic cards --------------------------------------------------------------------------

export const isTacticAvailable = (profile: Profile, id: TacticId) => {
  const unlockAt = TACTIC_UNLOCK_LEVEL[id];
  return unlockAt !== undefined && highestCleared(profile) >= unlockAt;
};

export const buyTactic = (id: TacticId): boolean => {
  const profile = getProfile();
  if (profile.tactics[id] !== undefined || !isTacticAvailable(profile, id)) return false;
  const price = tacticPrice(id);
  if (profile.coins < price) return false;
  setProfile({
    ...profile,
    coins: profile.coins - price,
    tactics: { ...profile.tactics, [id]: 1 },
    tacticLoadout: profile.tacticLoadout.length < TACTIC_LOADOUT_SIZE ? [...profile.tacticLoadout, id] : profile.tacticLoadout,
    stats: { ...profile.stats, coinsSpent: profile.stats.coinsSpent + price }
  });
  trackEvent('tactic_bought', { tactic: id, price, highest_cleared: highestCleared(profile) });
  return true;
};

export const upgradeTactic = (id: TacticId): boolean => {
  const profile = getProfile();
  const level = profile.tactics[id];
  if (level === undefined) return false;
  const cost = tacticUpgradeCost(level);
  if (cost === null || profile.coins < cost) return false;
  setProfile({
    ...profile,
    coins: profile.coins - cost,
    tactics: { ...profile.tactics, [id]: level + 1 },
    stats: { ...profile.stats, coinsSpent: profile.stats.coinsSpent + cost }
  });
  trackEvent('tactic_upgraded', { tactic: id, level: level + 1, cost });
  return true;
};

// Bring a tactic card into battle, or leave it behind (at least one stays)
export const toggleTacticLoadout = (id: TacticId): boolean => {
  const profile = getProfile();
  if (profile.tactics[id] === undefined) return false;
  if (profile.tacticLoadout.includes(id)) {
    if (profile.tacticLoadout.length <= 1) return false;
    setProfile({ ...profile, tacticLoadout: profile.tacticLoadout.filter(card => card !== id) });
    return true;
  }
  if (profile.tacticLoadout.length >= TACTIC_LOADOUT_SIZE) return false;
  setProfile({ ...profile, tacticLoadout: [...profile.tacticLoadout, id] });
  return true;
};

// Owned tactic cards in the order they are listed
export const ownedTactics = (profile: Profile): TacticId[] => TACTIC_IDS.filter(id => profile.tactics[id] !== undefined);

// --- Cosmetics -----------------------------------------------------------------------------

export type CosmeticKind = 'cardSkin' | 'castleStyle';

const cosmeticPrice = (kind: CosmeticKind, id: string) =>
  (kind === 'cardSkin' ? CARD_SKINS : CASTLE_STYLES).find(item => item.id === id)?.price;

export const ownsCosmetic = (profile: Profile, kind: CosmeticKind, id: string) =>
  kind === 'cardSkin'
    ? profile.cosmetics.cardSkins.includes(id as CardSkinId)
    : profile.cosmetics.castleStyles.includes(id as CastleStyleId);

// Buy a card frame or castle style and put it on straight away
export const buyCosmetic = (kind: CosmeticKind, id: string): boolean => {
  const profile = getProfile();
  const price = cosmeticPrice(kind, id);
  if (price === undefined || ownsCosmetic(profile, kind, id) || profile.coins < price) return false;
  const cosmetics: ProfileCosmetics = kind === 'cardSkin'
    ? { ...profile.cosmetics, cardSkins: [...profile.cosmetics.cardSkins, id as CardSkinId], cardSkin: id as CardSkinId }
    : { ...profile.cosmetics, castleStyles: [...profile.cosmetics.castleStyles, id as CastleStyleId], castleStyle: id as CastleStyleId };
  setProfile({
    ...profile,
    coins: profile.coins - price,
    cosmetics,
    stats: { ...profile.stats, coinsSpent: profile.stats.coinsSpent + price }
  });
  return true;
};

export const equipCosmetic = (kind: CosmeticKind, id: string): boolean => {
  const profile = getProfile();
  if (!ownsCosmetic(profile, kind, id)) return false;
  setProfile({
    ...profile,
    cosmetics: kind === 'cardSkin'
      ? { ...profile.cosmetics, cardSkin: id as CardSkinId }
      : { ...profile.cosmetics, castleStyle: id as CastleStyleId }
  });
  return true;
};

export const completeTutorial = () => {
  const profile = getProfile();
  if (profile.tutorialDone) return;
  setProfile({ ...profile, tutorialDone: true });
  trackEvent('tutorial_completed');
};

// --- Battle results ------------------------------------------------------------------------

export interface BattleOutcome {
  mode: 'campaign' | 'quick';
  levelId?: number;
  won: boolean;
  stars: number;
  rounds: number;
  reason?: 'stormed' | 'destroyed' | 'timeout';
  // Share of the enemy castle's health destroyed (0..1)
  enemyCastleDamage: number;
  playerStats: SideStats;
  durationSeconds: number;
}

export interface BattleRecordResult {
  reward: BattleReward;
  previousStars: number;
  // Monsters seen for the first time
  discovered: TroopId[];
  // Cards that just became available in the shop
  newCards: TroopId[];
  isNewBest: boolean;
}

export const recordBattle = (outcome: BattleOutcome): BattleRecordResult => {
  const profile = getProfile();
  const clearedBefore = highestCleared(profile);
  const previous = outcome.levelId ? profile.levels[outcome.levelId] : undefined;
  const previousStars = previous?.stars ?? 0;

  const reward = outcome.mode === 'quick'
    ? quickBattleReward(outcome.won, clearedBefore)
    : outcome.won
      ? levelWinReward(outcome.levelId!, outcome.stars, previousStars)
      : levelLossReward(outcome.levelId!, outcome.enemyCastleDamage);

  const levels = { ...profile.levels };
  let isNewBest = false;
  if (outcome.mode === 'campaign' && outcome.levelId) {
    const record = { stars: 0, wins: 0, losses: 0, ...previous };
    if (outcome.won) {
      record.wins++;
      record.stars = Math.max(record.stars, outcome.stars);
      isNewBest = record.bestRounds === undefined || outcome.rounds < record.bestRounds;
      record.bestRounds = Math.min(record.bestRounds ?? Infinity, outcome.rounds);
    } else {
      record.losses++;
    }
    levels[outcome.levelId] = record;
  }

  // Bestiary: every enemy type met, and how many of each were slain
  const bestiary = { ...profile.bestiary };
  const discovered: TroopId[] = [];
  for (const id of outcome.playerStats.seen) {
    const entry = bestiary[id] ?? { seen: 0, slain: 0 };
    if (entry.seen === 0) discovered.push(id);
    bestiary[id] = { ...entry, seen: entry.seen + 1 };
  }
  for (const [id, count] of Object.entries(outcome.playerStats.slain) as [TroopId, number][]) {
    const entry = bestiary[id] ?? { seen: 1, slain: 0 };
    bestiary[id] = { ...entry, slain: entry.slain + count };
  }

  const s = profile.stats;
  const cardsPlayed = { ...s.cardsPlayed };
  for (const [id, count] of Object.entries(outcome.playerStats.played) as [TroopId, number][]) {
    cardsPlayed[id] = (cardsPlayed[id] ?? 0) + count;
  }
  const streak = outcome.won ? s.currentStreak + 1 : 0;
  const stats: ProfileStats = {
    ...s,
    battles: s.battles + 1,
    wins: s.wins + (outcome.won ? 1 : 0),
    losses: s.losses + (outcome.won ? 0 : 1),
    quickBattles: s.quickBattles + (outcome.mode === 'quick' ? 1 : 0),
    coinsEarned: s.coinsEarned + reward.coins,
    unitsDeployed: s.unitsDeployed + outcome.playerStats.recruited,
    enemiesSlain: s.enemiesSlain + outcome.playerStats.kills,
    unitsLost: s.unitsLost + outcome.playerStats.lost,
    castlesStormed: s.castlesStormed + (outcome.won && outcome.reason === 'stormed' ? 1 : 0),
    castlesDestroyed: s.castlesDestroyed + (outcome.won && outcome.reason === 'destroyed' ? 1 : 0),
    winsOnTime: s.winsOnTime + (outcome.won && outcome.reason === 'timeout' ? 1 : 0),
    bossesDefeated: s.bossesDefeated + outcome.playerStats.bossesSlain,
    campsCaptured: s.campsCaptured + outcome.playerStats.campsCaptured,
    siegeDamage: s.siegeDamage + outcome.playerStats.siegeDamage,
    roundsPlayed: s.roundsPlayed + outcome.rounds,
    playSeconds: s.playSeconds + Math.round(outcome.durationSeconds),
    fastestWinRounds: outcome.won ? Math.min(s.fastestWinRounds ?? Infinity, outcome.rounds) : s.fastestWinRounds,
    currentStreak: streak,
    bestStreak: Math.max(s.bestStreak, streak),
    cardsPlayed
  };

  const next: Profile = { ...profile, coins: profile.coins + reward.coins, levels, bestiary, stats };
  const clearedAfter = highestCleared(next);
  const newCards = PLAYER_CARD_IDS.filter(id => {
    const unlockAt = CARD_UNLOCK_LEVEL[id];
    return unlockAt !== undefined && unlockAt > clearedBefore && unlockAt <= clearedAfter;
  });

  setProfile(next);
  return { reward, previousStars, discovered, newCards, isNewBest };
};

// Coins from watching the optional ad after a battle
export const grantBonusCoins = (coins: number) => {
  const profile = getProfile();
  setProfile({ ...profile, coins: profile.coins + coins, stats: { ...profile.stats, coinsEarned: profile.stats.coinsEarned + coins } });
};

// --- Export / import -----------------------------------------------------------------------

const SAVE_FORMAT = 'world-war-hex-save';

// Everything needed to restore progress on another computer: the profile and any battle in progress
export const exportSave = (battle: unknown): string =>
  JSON.stringify({ format: SAVE_FORMAT, exportedAt: new Date().toISOString(), profile: getProfile(), battle: battle ?? null }, null, 2);

export const parseSave = (text: string): { profile: Profile; battle: unknown } | null => {
  try {
    const data: unknown = JSON.parse(text);
    if (!isRecord(data) || data.format !== SAVE_FORMAT) return null;
    const profile = sanitizeProfile(data.profile);
    return profile ? { profile, battle: data.battle ?? null } : null;
  } catch {
    return null;
  }
};

export const replaceProfile = (profile: Profile) => setProfile(profile);

export const resetProfile = () => setProfile(createProfile());
