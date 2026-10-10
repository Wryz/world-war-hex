// Tests for lineages, skill trees and the evolved forms' abilities. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UnitType } from '@/types/game';
import {
  ARMOR_REDUCTION, canStrike, getActionTargets, getStrikePowerOnTerrain, getFormationMultiplier, getPointBlankMultiplier, getSightRange, getSituationalBonuses, getUnitAttackRange
} from './gameState';
import {
  ATTRIBUTES, ATTRIBUTE_PICKS, BASE_CARD_IDS, LINEAGES, LINEAGE_IDS, PLAYER_SKILLS, applyTree, canAfford, evolvesFrom, lineageCards,
  lineageOf, spend
} from './lineages';
import { MATERIALS } from './materials';
import { getMobSkill } from './mobSkills';
import { isFearless } from './regionRules';
import { getSignature } from './signatures';
import { PLAYER_CARD_IDS, cardStats } from './troops';
import { CARD_UNLOCK_LEVEL, SHOP_UNLOCK_LEVEL } from '../meta/economy';
import { sanitizeProfile } from '../meta/profile';
import { getHexDistance } from './hexUtils';
import { at, makeBattle, makeUnit, place } from './testUtils';

const troop = (owner: 'player' | 'ai', type: string, position: { q: number; r: number }, extra = {}) =>
  makeUnit(owner, position, { type: type as UnitType, ...extra });

test('every Kingdom card belongs to exactly one lineage, and every form can be reached from its base', () => {
  for (const id of PLAYER_CARD_IDS) {
    const lineage = lineageOf(id);
    assert.ok(lineage, `${id} has a lineage`);
    assert.equal(LINEAGE_IDS.filter(l => lineageCards(l).includes(id)).length, 1, id);
    let steps = 0;
    for (let form = id; form !== LINEAGES[lineage!].base; form = evolvesFrom(form)) assert.ok(++steps < 5, `${id} reaches its base`);
    assert.ok(getSignature(id), `${id} has a signature`);
  }
  assert.equal(BASE_CARD_IDS.length, 6);
  // Only base cards are sold; every form opens at a campaign level, after the form it grows from
  for (const lineage of LINEAGE_IDS) {
    for (const form of LINEAGES[lineage].forms) {
      assert.equal(SHOP_UNLOCK_LEVEL[form.id], undefined, form.id);
      assert.equal(CARD_UNLOCK_LEVEL[form.id], form.unlockLevel);
      if (form.from) assert.ok(LINEAGES[lineage].forms.find(f => f.id === form.from)!.unlockLevel < form.unlockLevel, form.id);
      for (const material of Object.keys(form.cost)) assert.ok(material in MATERIALS, `${form.id}: ${material}`);
    }
    assert.equal(new Set(LINEAGES[lineage].attributes).size, 4);
    for (const id of LINEAGES[lineage].skills) for (const material of Object.keys(PLAYER_SKILLS[id].cost)) assert.ok(material in MATERIALS);
  }
  for (const attribute of Object.values(ATTRIBUTES)) for (const material of Object.keys(attribute.cost)) assert.ok(material in MATERIALS);
});

test('a tree\'s attributes change the stats, and its skill is carried into battle', () => {
  const base = cardStats('infantry', 5);
  const trained = applyTree(base, { attributes: ['hardy', 'trailblazer'], skill: 'executioner' });
  assert.equal(trained.maxLifespan, Math.round(base.maxLifespan * 1.2));
  assert.ok(trained.abilities.includes('pathfinder'));
  assert.equal(trained.skill, 'executioner');
  assert.deepEqual(applyTree(base, undefined), base);
  // An ability the troop already has isn't added twice
  assert.equal(applyTree(cardStats('wolf_rider', 1), { attributes: ['trailblazer'] }).abilities.filter(a => a === 'pathfinder').length, 1);
});

test('materials are paid out of the satchel', () => {
  assert.ok(canAfford({ timber: 4, granite: 3 }, ATTRIBUTES.drilled.cost));
  assert.ok(!canAfford({ timber: 3, granite: 3 }, ATTRIBUTES.drilled.cost));
  assert.deepEqual(spend({ timber: 4, granite: 5 }, ATTRIBUTES.drilled.cost), { granite: 2 });
});

test('a learnt skill works as a monster\'s does: Executioner finishes off the wounded', () => {
  const { state, centre } = makeBattle('player');
  const prey = troop('ai', 'bandit_thug', centre, { lifespan: 8 });
  const friend = troop('ai', 'bandit_thug', at(centre, 0, -1));
  const sword = troop('player', 'infantry', at(centre, 1, 0), { skill: 'executioner' });
  place(state, prey, friend, sword);
  assert.equal(getMobSkill(sword)?.name, 'Executioner');
  const plain = { ...sword, skill: undefined };
  const ratio = getFormationMultiplier(state, sword, prey) / getFormationMultiplier(state, plain, prey);
  assert.ok(Math.abs(ratio - (1 + PLAYER_SKILLS.executioner.skill.share!)) < 1e-9, `${ratio}`);
});

test('Halberdiers strike from 2 hexes away, hand to hand', () => {
  const { state, centre } = makeBattle('player');
  const halberd = troop('player', 'halberdier', centre, { abilities: ['reach'] });
  const target = troop('ai', 'bandit_thug', at(centre, 2, 0));
  place(state, halberd, target);
  assert.equal(getUnitAttackRange(state, halberd), 2);
  assert.ok(canStrike(state, halberd, target));
  assert.equal(getPointBlankMultiplier(halberd, 1), 1);
});

test('Crossbowmen fight at arm\'s length and their bolts go through armour', () => {
  const crossbow = troop('player', 'crossbow', { q: 0, r: 0 }, { abilities: ['rangedAttack', 'heavyBolts'] });
  const archer = troop('player', 'artillery', { q: 0, r: 0 }, { abilities: ['rangedAttack'] });
  assert.equal(getPointBlankMultiplier(crossbow, 1), 1);
  assert.ok(getPointBlankMultiplier(archer, 1) < 1);
  const armoured = troop('ai', 'bandit_thug', { q: 2, r: 0 }, { abilities: ['armored'] });
  const plainShooter = { ...crossbow, abilities: ['rangedAttack' as const] };
  const strike = (unit: typeof crossbow) => getStrikePowerOnTerrain(unit, 'plain', armoured, 'plain', 2);
  assert.equal(strike(crossbow) - strike(plainShooter), ARMOR_REDUCTION, 'what the armour soaks comes back');
});

test('keen eyes see further; the steadfast are fearless', () => {
  const { state, centre } = makeBattle('player');
  const scout = troop('player', 'infantry', centre);
  const keen = troop('player', 'infantry', at(centre, 1, 0), { abilities: ['keenEyed'] });
  place(state, scout, keen);
  assert.equal(getSightRange(state, keen), getSightRange(state, scout) + 1);
  assert.ok(isFearless({ type: 'infantry', abilities: ['fearless'] }));
  assert.ok(!isFearless({ type: 'infantry', abilities: [] }));
});

test('a Warlord\'s war cry makes the friends beside it hit harder', () => {
  const { state, centre } = makeBattle('player');
  const sword = troop('player', 'infantry', centre, { level: 1 });
  const warlord = troop('player', 'warlord', at(centre, 1, 0), { level: 6 });
  place(state, sword, warlord);
  assert.ok(getSituationalBonuses(state, sword).some(bonus => bonus.label === 'War Cry'));
  const far = { ...warlord, position: at(centre, 3, 0) };
  state.players.player.units = [sword, far];
  assert.ok(!getSituationalBonuses(state, sword).some(bonus => bonus.label === 'War Cry'));
});

test('Siege Engineers work on hexes 2 away', () => {
  const { state, centre } = makeBattle('player');
  const engineer = troop('player', 'engineer', centre, { abilities: ['engineering'] });
  const master = troop('player', 'siege_engineer', at(centre, -2, 0), { abilities: ['engineering', 'masterBuilder'] });
  place(state, engineer, master);
  const far = (unit: typeof engineer) => getActionTargets(state, unit).filter(t => getHexDistance(t.at, unit.position) === 2);
  assert.equal(far(engineer).length, 0);
  assert.ok(far(master).length > 0);
});

test('an old save keeps its evolved cards: their bases and earlier forms come too, all at one level', () => {
  const profile = sanitizeProfile({
    version: 1,
    cards: { infantry: 3, artillery: 1, tank: 4, rogue: 1, pegasus: 6, cleric: 2, berserker: 7 },
    deck: ['pegasus', 'tank', 'cleric', 'berserker'],
    trees: { tank: { attributes: ['hardy', 'swift', 'mender'], skill: 'impale' }, rogue: { attributes: ['nonsense'] } }
  })!;
  assert.equal(profile.cards.helicopter, 6, 'Knights come with Pegasus Knights');
  assert.equal(profile.cards.tank, 6, 'the lineage takes its highest level');
  assert.equal(profile.cards.medic, 2, 'War Clerics bring the Mages');
  assert.equal(profile.cards.infantry, 7);
  assert.deepEqual(profile.deck, ['pegasus', 'cleric', 'berserker'], 'one form of each lineage');
  assert.deepEqual(profile.trees.tank, { attributes: ['hardy', 'swift'].slice(0, ATTRIBUTE_PICKS), skill: 'impale' });
  assert.equal(profile.trees.rogue, undefined);
});
