// Writes the save the reel takes play with (reels/capture/profile.json): every level open, every
// Kingdom card owned at its top level, a strong deck, and the tutorial and first-time tips seen.
import { writeFileSync } from 'fs';
import { createProfile } from '@/lib/meta/profile';
import { PLAYER_CARD_IDS, MAX_CARD_LEVEL, TROOPS } from '@/lib/game/troops';
import { LEVEL_COUNT } from '@/lib/campaign/levels';

const deck = (process.argv[2] ?? '').split(',').filter(Boolean);
const profile = {
  ...createProfile(),
  coins: 5000,
  tutorialDone: true,
  cards: Object.fromEntries(PLAYER_CARD_IDS.map(id => [id, MAX_CARD_LEVEL])),
  levels: Object.fromEntries(Array.from({ length: LEVEL_COUNT }, (_, i) => [i + 1, { stars: 3, wins: 1, losses: 0 }])),
  ...(deck.length ? { deck } : {})
};
writeFileSync(new URL('./profile.json', import.meta.url), JSON.stringify(profile));
console.log(PLAYER_CARD_IDS.map(id => `${id}:${TROOPS[id].name}`).join(' '), '\nmax', MAX_CARD_LEVEL, 'deck', profile.deck);
