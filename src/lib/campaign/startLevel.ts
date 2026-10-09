import { LevelDef, levelEnemies } from './levels';
import { MAX_DECK_SIZE } from '../meta/economy';
import { suggestLoadout } from '../meta/loadout';
import { getProfile, setDeck } from '../meta/profile';

// Going into a campaign battle (straight from the map: there's no screen before it to pick cards
// on): a deck with slots left empty, when more cards are owned, is filled with the best of the
// rest against the level's enemies
export const topUpDeck = (level: LevelDef) => {
  const profile = getProfile();
  if (profile.deck.length >= MAX_DECK_SIZE) return;
  const extra = suggestLoadout(profile.cards, levelEnemies(level)).filter(id => !profile.deck.includes(id));
  if (extra.length > 0) setDeck([...profile.deck, ...extra]);
};
