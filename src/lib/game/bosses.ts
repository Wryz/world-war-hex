import type { HexCoordinates } from '@/types/game';
import type { TroopId } from './troops';
import { getHexDistance, getNeighbors } from './hexUtils';

// Every boss has a power of its own, used at the end of its side's turn whenever it is ready:
//
// - Summoners call minions to their side. The minions are bound to the boss: when it falls, they
//   scatter.
// - Strikers mark the ground first - the hexes they will hit glow red through the enemy's turn - and
//   strike at the end of their next turn, so a troop that sees it coming can step out of the way.
//   Some strikes set the ground alight, and the Frost Giant's freezes troops in place for a turn.
// - The Bog Hydra bites every enemy next to it, every turn.
//
// Below half its health a boss is enraged: its power comes round a turn sooner.

export type BossPowerId =
  | 'callTheGang' | 'goblinBombs' | 'howl' | 'manyHeads' | 'sandstorm'
  | 'iceStomp' | 'raiseDead' | 'rallyHorde' | 'hellfire' | 'dragonBreath';

// The shape a strike takes: a blast (a hex and the six around it), scattered single hexes on
// enemy troops, or a line straight out from the boss
export type StrikeShape = 'blast' | 'scatter' | 'line';

export interface BossPower {
  id: BossPowerId;
  name: string;
  // Turns between uses (counted in its side's turns)
  cooldown: number;
  // Minions it calls
  summon?: { type: TroopId; count: number };
  // A strike marked a turn ahead: its shape, how far from the boss it reaches, its damage (as a share
  // of the boss's attack) and what else it does to the ground or the troops it hits
  strike?: { shape: StrikeShape; range: number; damage: number; fire?: boolean; freeze?: boolean };
  // Bites every adjacent enemy for this share of its attack
  bite?: number;
}

export const BOSS_POWERS: Partial<Record<TroopId, BossPower>> = {
  bandit_king: { id: 'callTheGang', name: 'Call the Gang', cooldown: 3, summon: { type: 'bandit_thug', count: 1 } },
  goblin_warchief: { id: 'goblinBombs', name: 'Goblin Bombs', cooldown: 2, strike: { shape: 'scatter', range: 4, damage: 0.8 } },
  alpha_direwolf: { id: 'howl', name: 'Howl of the Pack', cooldown: 3, summon: { type: 'grey_wolf', count: 1 } },
  bog_hydra: { id: 'manyHeads', name: 'Many Heads', cooldown: 1, bite: 0.5 },
  pharaoh: { id: 'sandstorm', name: 'Sandstorm', cooldown: 2, strike: { shape: 'blast', range: 4, damage: 0.7 } },
  frost_giant: { id: 'iceStomp', name: 'Ice Stomp', cooldown: 2, strike: { shape: 'blast', range: 3, damage: 0.6, freeze: true } },
  lich_king: { id: 'raiseDead', name: 'Raise the Dead', cooldown: 3, summon: { type: 'skeleton_minion', count: 1 } },
  orc_warlord: { id: 'rallyHorde', name: 'Rally the Horde', cooldown: 3, summon: { type: 'orc_grunt', count: 1 } },
  demon_lord: { id: 'hellfire', name: 'Hellfire', cooldown: 2, strike: { shape: 'scatter', range: 4, damage: 0.6, fire: true } },
  elder_dragon: { id: 'dragonBreath', name: 'Dragon Breath', cooldown: 2, strike: { shape: 'line', range: 4, damage: 0.8, fire: true } }
};

export const getBossPower = (type: string): BossPower | undefined => BOSS_POWERS[type as TroopId];

// Turns until the power is ready again after use, enraged or not
export const powerCooldown = (power: BossPower, enraged: boolean) => Math.max(1, power.cooldown - (enraged ? 1 : 0));

// A boss is enraged at half its health or less
export const isBossEnraged = (unit: { lifespan: number; maxLifespan: number }) => unit.lifespan * 2 <= unit.maxLifespan;

// Scattered strikes hit at most this many hexes
export const SCATTER_COUNT = 3;

const DIRECTIONS: HexCoordinates[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];
const key = (c: HexCoordinates) => `${c.q},${c.r}`;

// The hexes a strike will hit, aimed at the enemy troops it can reach (weakest first, for scattered
// strikes), or none when there is nothing to aim at. `board` holds every hex of the board.
export const aimStrike = (
  strike: NonNullable<BossPower['strike']>,
  from: HexCoordinates,
  targets: { position: HexCoordinates; lifespan: number }[],
  board: Set<string>
): HexCoordinates[] => {
  const inReach = targets.filter(target => getHexDistance(target.position, from) <= strike.range);
  if (inReach.length === 0) return [];
  const onBoard = (c: HexCoordinates) => board.has(key(c));

  if (strike.shape === 'scatter') {
    return [...inReach]
      .sort((a, b) => a.lifespan - b.lifespan || getHexDistance(a.position, from) - getHexDistance(b.position, from))
      .slice(0, SCATTER_COUNT)
      .map(target => target.position);
  }

  if (strike.shape === 'line') {
    let best: HexCoordinates[] = [];
    let bestHits = 0;
    for (const dir of DIRECTIONS) {
      const line: HexCoordinates[] = [];
      for (let step = 1; step <= strike.range; step++) {
        const at = { q: from.q + dir.q * step, r: from.r + dir.r * step };
        if (onBoard(at)) line.push(at);
      }
      const keys = new Set(line.map(key));
      const hits = inReach.filter(target => keys.has(key(target.position))).length;
      if (hits > bestHits) {
        best = line;
        bestHits = hits;
      }
    }
    return best;
  }

  // A blast centred where it catches the most troops (on a troop, so it never lands on empty ground)
  const scored = inReach.map(target => {
    const area = [target.position, ...getNeighbors(target.position)].filter(onBoard);
    const keys = new Set(area.map(key));
    return { area, hits: inReach.filter(other => keys.has(key(other.position))).length, distance: getHexDistance(target.position, from) };
  }).sort((a, b) => b.hits - a.hits || a.distance - b.distance);
  return scored[0].area;
};
