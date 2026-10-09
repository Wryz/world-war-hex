import { TroopId, cardStats, getClassCounter, getTroopClass, statsPower } from '../game/troops';
import { MAX_DECK_SIZE } from './economy';

// Choosing which cards to bring into a battle

// How well a card matches up against a set of enemies: the counter bonus it gets against them, less
// the bonus they get against it (0 is neutral, positive is good)
export const matchupScore = (card: TroopId, enemies: TroopId[]): number => {
  if (enemies.length === 0) return 0;
  const mine = getTroopClass(card);
  return enemies.reduce((sum, enemy) => {
    const theirs = getTroopClass(enemy);
    return sum + (getClassCounter(mine, theirs) - 1) - (getClassCounter(theirs, mine) - 1);
  }, 0) / enemies.length;
};

// How good a loadout is against these enemies: its cards' power, weighted by how well
// each counters them, with a little less for doubling up on one class of troop
export const loadoutScore = (deck: readonly TroopId[], cards: Partial<Record<TroopId, number>>, enemies: TroopId[]): number => {
  const seen = new Set<string>();
  return deck.reduce((sum, id) => {
    const troopClass = getTroopClass(id);
    const repeat = seen.has(troopClass);
    seen.add(troopClass);
    return sum + statsPower(cardStats(id, cards[id] ?? 1)) * (1 + 0.6 * matchupScore(id, enemies)) * (repeat ? 0.8 : 1);
  }, 0);
};

// The best loadout against these enemies, trying every combination of the cards owned
export const suggestLoadout = (cards: Partial<Record<TroopId, number>>, enemies: TroopId[]): TroopId[] => {
  const owned = Object.keys(cards) as TroopId[];
  const size = Math.min(MAX_DECK_SIZE, owned.length);
  let best: TroopId[] = owned.slice(0, size);
  let bestScore = -Infinity;
  const pick = (start: number, chosen: TroopId[]) => {
    if (chosen.length === size) {
      const score = loadoutScore(chosen, cards, enemies);
      if (score > bestScore) {
        bestScore = score;
        best = [...chosen];
      }
      return;
    }
    for (let i = start; i <= owned.length - (size - chosen.length); i++) pick(i + 1, [...chosen, owned[i]]);
  };
  pick(0, []);
  return best;
};
