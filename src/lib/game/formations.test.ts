// Tests for formations: screens, pinning, shield walls and holding a crossing. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UnitType } from '@/types/game';
import { getCombatPreview, getFormationMultiplier, updateHex } from './gameState';
import { PIN_BONUS, SCREEN_REDUCTION, ARMORED_SCREEN_REDUCTION, SHIELD_WALL_REDUCTION } from './formations';
import { at, makeBattle, makeUnit, place } from './testUtils';

const troop = (owner: 'player' | 'ai', type: string, position: { q: number; r: number }, extra = {}) =>
  makeUnit(owner, position, { type: type as UnitType, ...extra });
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);

test('a front-line troop between an archer and its attacker screens it', () => {
  const { state, centre } = makeBattle('ai');
  const archer = troop('player', 'artillery', centre);
  const enemy = troop('ai', 'infantry', at(centre, 3, 0));
  const front = troop('player', 'infantry', at(centre, 1, 0));
  place(state, archer, enemy, front);
  close(getFormationMultiplier(state, enemy, archer), 1 - SCREEN_REDUCTION);

  // From the other side, the same troop is no screen
  const behind = makeBattle('ai');
  const archer2 = troop('player', 'artillery', behind.centre);
  const enemy2 = troop('ai', 'infantry', at(behind.centre, 3, 0));
  place(behind.state, archer2, enemy2, troop('player', 'infantry', at(behind.centre, -1, 0)));
  close(getFormationMultiplier(behind.state, enemy2, archer2), 1);

  // Armour screens better
  const armour = makeBattle('ai');
  const archer3 = troop('player', 'artillery', armour.centre);
  const enemy3 = troop('ai', 'infantry', at(armour.centre, 3, 0));
  place(armour.state, archer3, enemy3, troop('player', 'shieldbearer', at(armour.centre, 1, 0), { abilities: ['armored'] }));
  close(getFormationMultiplier(armour.state, enemy3, archer3), 1 - ARMORED_SCREEN_REDUCTION);
});

test('an enemy next to a front-line troop is pinned: archers and riders hit it harder', () => {
  const { state, centre } = makeBattle('player');
  const enemy = troop('ai', 'artillery', centre);
  const anvil = troop('player', 'infantry', at(centre, 1, 0));
  const archer = troop('player', 'artillery', at(centre, -2, 0));
  const rider = troop('player', 'helicopter', at(centre, 0, 1));
  const sword = troop('player', 'infantry', at(centre, -1, 0));
  place(state, enemy, anvil, archer, rider, sword);
  close(getFormationMultiplier(state, archer, enemy), 1 + PIN_BONUS);
  close(getFormationMultiplier(state, rider, enemy), 1 + PIN_BONUS);
  close(getFormationMultiplier(state, sword, enemy), 1);

  // Nobody holding it: no pin
  const loose = makeBattle('player');
  const enemy2 = troop('ai', 'artillery', loose.centre);
  const archer2 = troop('player', 'artillery', at(loose.centre, -2, 0));
  place(loose.state, enemy2, archer2);
  close(getFormationMultiplier(loose.state, archer2, enemy2), 1);
});

test('front-line troops side by side form a shield wall', () => {
  const { state, centre } = makeBattle('player');
  const wall = troop('ai', 'infantry', centre);
  const neighbour = troop('ai', 'tank', at(centre, 0, 1));
  const attacker = troop('player', 'infantry', at(centre, 1, -1));
  place(state, wall, neighbour, attacker);
  close(getFormationMultiplier(state, attacker, wall), 1 - SHIELD_WALL_REDUCTION);
});

test('a troop holding a bridge cannot be flanked', () => {
  const damage = (terrain: 'plain' | 'bridge') => {
    const { state, centre } = makeBattle('player');
    updateHex(state, centre, { terrain });
    const target = troop('ai', 'rogue', centre, { lifespan: 100, maxLifespan: 100 });
    const a = troop('player', 'rogue', at(centre, 1, 0));
    const b = troop('player', 'rogue', at(centre, -1, 0));
    place(state, target, a, b);
    return getCombatPreview(state, { hexCoordinates: centre, attackers: [a, b], defenders: [target], resolved: false }).defenders[0].damageTaken;
  };
  assert.ok(damage('bridge') < damage('plain'), 'flanking lands on open ground only');
});
