import { TroopId } from '../game/troops';
import { LevelDef, levelEnemies } from './levels';
import { MAX_DECK_SIZE } from '../meta/economy';
import { suggestLoadout } from '../meta/loadout';
import { Profile, getProfile, setDeck } from '../meta/profile';

// Going into a campaign battle (straight from the map: there's no screen before it to pick cards
// on): a deck with slots left empty, when more cards are owned, is filled with the best of the
// rest against the level's enemies

// The deck a level would be fought with
export const deckFor = (level: LevelDef, profile: Profile): TroopId[] => {
  if (profile.deck.length >= MAX_DECK_SIZE) return profile.deck;
  const extra = suggestLoadout(profile.cards, levelEnemies(level)).filter(id => !profile.deck.includes(id));
  return [...profile.deck, ...extra].slice(0, MAX_DECK_SIZE);
};

export const topUpDeck = (level: LevelDef) => {
  const profile = getProfile();
  const deck = deckFor(level, profile);
  if (deck.length > profile.deck.length) setDeck(deck);
};
