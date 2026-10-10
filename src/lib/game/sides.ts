import type { GameState, Player, PlayerType, Unit } from '@/types/game';

// The sides of a battle. The campaign and quick battles are fought between two: 'player' and 'ai'. A
// battle between more sides (a free-for-all, or teams) lists them in `state.sides` in turn order, each
// with a name, a colour and maybe a team; sides on the same team are allies, everyone else an enemy.

export const TWO_SIDES: PlayerType[] = ['player', 'ai'];
// Most sides a battle can have
export const MAX_SIDES = 8;

type SidesOf = Pick<GameState, 'sides' | 'players'>;

// Whether the battle is between more sides than the player and the AI (sides have names, teams and
// colours, and the board is seen from whichever side the viewer plays)
export const isMultiSide = (state: Pick<GameState, 'sides'>): boolean => !!state.sides;

// Every side, in turn order (knocked-out sides included)
export const getSides = (state: Pick<GameState, 'sides'>): PlayerType[] => state.sides ?? TWO_SIDES;

// The sides still in the battle, in turn order
export const getLivingSides = (state: SidesOf): PlayerType[] =>
  getSides(state).filter(side => !state.players[side]?.eliminated);

export const isEliminated = (state: Pick<GameState, 'players'>, side: PlayerType): boolean => !!state.players[side]?.eliminated;

// A side's team: its own unless it was given one
export const teamOf = (state: Pick<GameState, 'players'>, side: PlayerType): string => {
  const team = state.players[side]?.team;
  return team === undefined ? `side:${side}` : `team:${team}`;
};

// Whether two sides fight together (a side is its own ally)
export const areAllies = (state: Pick<GameState, 'players'>, a: PlayerType | undefined, b: PlayerType | undefined): boolean =>
  a !== undefined && b !== undefined && (a === b || teamOf(state, a) === teamOf(state, b));

// The sides still in the battle that a side fights against
export const getEnemySides = (state: SidesOf, side: PlayerType): PlayerType[] =>
  livingPlayers(state).filter(player => !areAllies(state, side, player.type)).map(player => player.type);

// The sides still in the battle on a side's team, itself included
export const getAllySides = (state: SidesOf, side: PlayerType): PlayerType[] =>
  livingPlayers(state).filter(player => areAllies(state, side, player.type)).map(player => player.type);

// Every troop on the battlefield
export const getAllUnits = (state: Pick<GameState, 'players'>): Unit[] =>
  Object.values(state.players).flatMap(player => player.units);

// The troops a side fights against
export const getEnemyUnits = (state: SidesOf, side: PlayerType): Unit[] =>
  getEnemySides(state, side).flatMap(enemy => state.players[enemy].units);

// The troops fighting on a side's team, its own included
export const getFriendlyUnits = (state: SidesOf, side: PlayerType): Unit[] =>
  getAllySides(state, side).flatMap(ally => state.players[ally].units);

// Whether the AI plays a side: the campaign's enemy, or a side of a bigger battle given to it
export const isAiSide = (state: Pick<GameState, 'players' | 'sides'>, side: PlayerType): boolean =>
  state.sides ? !!state.players[side]?.ai : side === 'ai';

// Whether the sides plan each round at the same time (see GameSettings.simultaneous)
export const isSimultaneous = (state: Pick<GameState, 'settings'>): boolean => !!state.settings?.simultaneous;

type TurnsOf = SidesOf & Pick<GameState, 'settings' | 'turnNumber'>;

// The order the sides play in a round (knocked-out sides included). When they plan at the same time
// their orders are carried out in this order, and the side that goes first moves down it each round.
export const roundOrder = (state: TurnsOf, round = state.turnNumber): PlayerType[] => {
  const sides = getSides(state);
  if (!isSimultaneous(state)) return sides;
  const shift = ((round - 1) % sides.length + sides.length) % sides.length;
  return [...sides.slice(shift), ...sides.slice(0, shift)];
};

// The side whose turn comes after `side` (skipping sides that are out), and whether passing to it
// starts a new round
export const nextSide = (state: TurnsOf, side: PlayerType): { side: PlayerType; newRound: boolean } => {
  const alive = (candidate: PlayerType) => !state.players[candidate]?.eliminated;
  if (isSimultaneous(state)) {
    const order = roundOrder(state);
    const later = order.slice(order.indexOf(side) + 1).find(alive);
    return later
      ? { side: later, newRound: false }
      : { side: roundOrder(state, state.turnNumber + 1).find(alive) ?? side, newRound: true };
  }
  const order = getSides(state);
  const start = order.indexOf(side);
  for (let step = 1; step <= order.length; step++) {
    const index = (start + step) % order.length;
    const candidate = order[index];
    if (alive(candidate)) return { side: candidate, newRound: index <= start };
  }
  return { side, newRound: true };
};

// The side that plays first in this round
export const firstInRound = (state: TurnsOf): PlayerType | undefined =>
  roundOrder(state).find(side => !state.players[side]?.eliminated);

// The last side to play in a round (a round ends after its turn)
export const isLastInRound = (state: TurnsOf, side: PlayerType): boolean => nextSide(state, side).newRound;

// Whether only one team is left standing
export const lastTeamStanding = (state: SidesOf): boolean =>
  new Set(getLivingSides(state).map(side => teamOf(state, side))).size <= 1;

// --- Words for the battle log -------------------------------------------------------------------

// How the log names a side: "You"/"The enemy" in a battle against the AI, its name otherwise
export const sideName = (state: Pick<GameState, 'players' | 'sides'>, side: PlayerType): string =>
  state.sides ? state.players[side]?.name ?? side : side === 'player' ? 'You' : 'The enemy';

// A side's troops, castle and so on: "Your"/"Enemy" against the AI, "Name's" otherwise
export const sidePossessive = (state: Pick<GameState, 'players' | 'sides'>, side: PlayerType, enemyWord = 'Enemy'): string =>
  state.sides ? `${state.players[side]?.name ?? side}'s` : side === 'player' ? 'Your' : enemyWord;

// A verb after a side's name: "You earn" but "The enemy earns", "Ada earns"
export const sideVerb = (state: Pick<GameState, 'players' | 'sides'>, side: PlayerType, plural: string, singular: string): string =>
  `${sideName(state, side)} ${!state.sides && side === 'player' ? plural : singular}`;

// The players of the sides still in the battle (every side in the players' list: the AI plans on a
// board where its allies stand outside the turn order)
const livingPlayers = (state: Pick<GameState, 'players'>): Player[] =>
  Object.values(state.players).filter(player => !player.eliminated);
