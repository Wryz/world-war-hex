import { useEffect, useState } from 'react';
import { LEVEL_COUNT } from '../campaign/levels';
import { MAX_CARD_LEVEL, PLAYER_CARD_IDS, TroopId } from '../game/troops';
import { MAX_DECK_SIZE, STARTER_CARDS } from './economy';
import { MATERIAL_IDS } from '../game/materials';
import { Profile, getProfile, replaceProfile } from './profile';

// Developer shortcuts for trying things out on a local copy of the game: every level open, coins on
// tap, cards owned, levelled or reset. They only exist on the dev server (`npm run dev`) or a game
// served from localhost, never on the live site.

export const DEV_COINS = 999_999;
const INFINITE_COINS_KEY = 'wwhDevInfiniteCoins';

const isLocalHost = () =>
  typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export const isDevMode = () => process.env.NODE_ENV === 'development' || isLocalHost();

// Whether dev tools are on, read after hydration so the server render always matches
export const useDevMode = () => {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(isDevMode()), []);
  return on;
};

const update = (change: (profile: Profile) => Partial<Profile>) => {
  const profile = getProfile();
  replaceProfile({ ...profile, ...change(profile) });
};

// --- Coins ---------------------------------------------------------------------------------

export const devSetCoins = (coins: number) => update(() => ({ coins }));

export const isInfiniteCoins = (): boolean => {
  try {
    return isDevMode() && localStorage.getItem(INFINITE_COINS_KEY) === '1';
  } catch {
    return false;
  }
};

export const setInfiniteCoins = (on: boolean) => {
  try {
    if (on) localStorage.setItem(INFINITE_COINS_KEY, '1');
    else localStorage.removeItem(INFINITE_COINS_KEY);
  } catch {
    // Storage blocked: it lasts for this page only
  }
  if (on) devSetCoins(DEV_COINS);
};

// With infinite coins on, the purse is topped up again whenever anything is bought
export const topUpCoins = (profile: Profile) => {
  if (profile.coins < DEV_COINS && isInfiniteCoins()) devSetCoins(DEV_COINS);
};

// --- Campaign ------------------------------------------------------------------------------

// Every level won with three stars, so every level (and the shop's later cards) is open
export const devUnlockAllLevels = () => update(profile => ({
  levels: Object.fromEntries(Array.from({ length: LEVEL_COUNT }, (_, i) => {
    const id = i + 1;
    const record = profile.levels[id];
    return [id, { stars: 3, wins: Math.max(1, record?.wins ?? 0), losses: record?.losses ?? 0, bestRounds: record?.bestRounds }];
  }))
}));

// Back to the start of the campaign (cards and coins stay)
export const devLockAllLevels = () => update(() => ({ levels: {} }));

// --- Cards ---------------------------------------------------------------------------------

// Own every troop card (new ones join at level 1)
export const devOwnEverything = () => update(profile => ({
  cards: Object.fromEntries(PLAYER_CARD_IDS.map(id => [id, profile.cards[id] ?? 1]))
}));

// A satchel holding plenty of every material (every Chronicle page open), or an empty one
export const devFillSatchel = () => update(profile => ({
  materials: Object.fromEntries(MATERIAL_IDS.map(id => [id, (profile.materials[id] ?? 0) + 20])),
  materialsFound: [...MATERIAL_IDS]
}));
export const devEmptySatchel = () => update(() => ({ materials: {}, materialsFound: [] }));

// Set every owned card to one level
export const devSetAllLevels = (level: number) => update(profile => ({
  cards: Object.fromEntries((Object.keys(profile.cards) as TroopId[]).map(id => [id, Math.min(MAX_CARD_LEVEL, Math.max(1, level))]))
}));

export const devSetCardLevel = (id: TroopId, level: number) => update(profile => ({
  cards: { ...profile.cards, [id]: Math.min(MAX_CARD_LEVEL, Math.max(1, level)) }
}));

// Back to the four starter cards, all at level 1
export const devResetCards = () => update(() => ({
  cards: Object.fromEntries(STARTER_CARDS.map(id => [id, 1])),
  deck: STARTER_CARDS.slice(0, MAX_DECK_SIZE)
}));
