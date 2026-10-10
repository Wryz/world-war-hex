// Tests for lineages, skill trees and the evolved forms' abilities. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Ability, UnitType } from '@/types/game';
import {
  canStrike, getActionTargets, getCombatPreview, isUnitVisibleTo, getFormationMultiplier, getPointBlankMultiplier, getSightRange, getSituationalBonuses, getUnitAttackRange
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
import { CARD_UNLOCK_LEVEL, SHOP_UNLOCK_LEVEL, ownUpgradeLadder } from '../meta/economy';
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
  // Armour soaks nothing in a fight a Crossbowman strikes in - no more than nothing, with several
  const damageTo = (abilities: Ability[], shooters: number) => {
    const { state, centre } = makeBattle('player');
    const target = troop('ai', 'bandit_thug', centre, { abilities, lifespan: 200, maxLifespan: 200 });
    const bows = Array.from({ length: shooters }, (_, i) =>
      troop('player', 'crossbow', at(centre, i === 0 ? 2 : i === 1 ? -2 : 0, i === 2 ? 2 : 0), { abilities: ['rangedAttack', 'heavyBolts'], attackPower: 12 }));
    place(state, target, ...bows);
    const preview = getCombatPreview(state, { hexCoordinates: centre, attackers: bows, defenders: [target], resolved: false });
    return { taken: preview.defenders[0].damageTaken, armourShown: preview.defenders[0].modifiers.some(m => m.label === 'Armored') };
  };
  for (const shooters of [1, 2, 3]) {
    assert.equal(damageTo(['armored'], shooters).taken, damageTo([], shooters).taken, `${shooters} crossbows`);
  }
  assert.ok(!damageTo(['armored'], 1).armourShown, 'no armour in the preview');
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
  assert.deepEqual(profile.deck.slice(0, 3), ['pegasus', 'cleric', 'berserker'], 'one form of each lineage');
  assert.equal(profile.deck.length, 4, 'topped back up from another lineage');
  assert.equal(new Set(profile.deck.map(lineageOf)).size, 4);
  // The training of the cards that now share a level comes back as coins, once
  assert.equal(profile.coins, ownUpgradeLadder('infantry', 3) + ownUpgradeLadder('tank', 4));
  assert.equal(sanitizeProfile(profile)!.coins, profile.coins, 'not paid twice');
  // A deck left short on purpose stays short
  assert.deepEqual(sanitizeProfile({ ...profile, deck: ['pegasus'] })!.deck, ['pegasus']);
  assert.deepEqual(profile.trees.tank, { attributes: ['hardy', 'swift'].slice(0, ATTRIBUTE_PICKS), skill: 'impale' });
  assert.equal(profile.trees.rogue, undefined);
});

test('a hide turns shots, not a halberd swung from 2 hexes', () => {
  const { state, centre } = makeBattle('player');
  const skeleton = troop('ai', 'skeleton_warrior', centre);
  const halberd = troop('player', 'halberdier', at(centre, 2, 0), { abilities: ['reach'] });
  const archer = troop('player', 'artillery', at(centre, -2, 0), { abilities: ['rangedAttack'] });
  place(state, skeleton, halberd, archer);
  const plain = { ...skeleton, type: 'infantry' as UnitType };
  assert.equal(getFormationMultiplier(state, halberd, skeleton), getFormationMultiplier(state, halberd, plain));
  assert.ok(getFormationMultiplier(state, archer, skeleton) < getFormationMultiplier(state, archer, plain));
});

test('a master builder\'s work two hexes away gives no hidden enemy away', () => {
  const { state, centre } = makeBattle('player', {});
  state.settings = { ...state.settings, fogOfWar: true };
  const master = troop('player', 'siege_engineer', centre, { abilities: ['engineering', 'masterBuilder'] });
  place(state, master);
  const before = getActionTargets(state, master).map(t => `${t.at.q},${t.at.r},${t.action}`).sort();
  // A troop out of sight two hexes away (behind a mountain) changes nothing on offer
  for (const hex of state.hexGrid) {
    if (getHexDistance(hex.coordinates, centre) === 1 && hex.coordinates.q === centre.q + 1 && hex.coordinates.r === centre.r) hex.terrain = 'mountain';
  }
  const offered = getActionTargets(state, master).map(t => `${t.at.q},${t.at.r},${t.action}`).sort();
  const hidden = troop('ai', 'bandit_thug', at(centre, 2, 0));
  place(state, hidden);
  assert.ok(!isUnitVisibleTo(state, 'player', hidden), 'out of sight');
  assert.ok(offered.includes(`${centre.q + 2},${centre.r},stakes`), 'stakes on offer there');
  assert.deepEqual(getActionTargets(state, master).map(t => `${t.at.q},${t.at.r},${t.action}`).sort(), offered);
  assert.ok(before.length > 0);
});
