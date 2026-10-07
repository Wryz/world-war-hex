import { TroopId, cardPower, getClassCounter, getTroopClass } from '../game/troops';
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

// A good loadout against these enemies: strong cards that counter them, without doubling up on one
// class of troop when another would do nearly as well
export const suggestLoadout = (cards: Partial<Record<TroopId, number>>, enemies: TroopId[]): TroopId[] => {
  const owned = Object.keys(cards) as TroopId[];
  const value = (id: TroopId) => cardPower(id, cards[id] ?? 1) * (1 + 0.6 * matchupScore(id, enemies));
  const chosen: TroopId[] = [];
  const remaining = [...owned];
  while (chosen.length < MAX_DECK_SIZE && remaining.length > 0) {
    const classes = new Set(chosen.map(getTroopClass));
    remaining.sort((a, b) =>
      value(b) * (classes.has(getTroopClass(b)) ? 0.8 : 1) - value(a) * (classes.has(getTroopClass(a)) ? 0.8 : 1));
    chosen.push(remaining.shift()!);
  }
  return chosen;
};
