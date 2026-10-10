'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { TROOPS, TroopId, cardStats } from '@/lib/game/troops';
import { MATERIALS, MaterialId } from '@/lib/game/materials';
import {
  ATTRIBUTES, ATTRIBUTE_PICKS, AttributeId, LINEAGES, LineageId, MaterialCost, PLAYER_SKILLS, PlayerSkillId, RESPEC_COST,
  applyTree, canAfford, costEntries, evolvesFrom
} from '@/lib/game/lineages';
import { MAX_DECK_SIZE } from '@/lib/meta/economy';
import { disposeUnitModel, instantiateUnitModel } from '../game/utils/unitModelCache';
import {
  deckFormOf, evolveBlock, evolveCard, highestCleared, learnAttribute, learnSkill, respecAttribute, respecSkill, toggleDeckCard,
  treeOf, useProfile
} from '@/lib/meta/profile';
import { getLevel } from '@/lib/campaign/levels';
import { playStinger } from '@/lib/audio/music';
import { TroopCard } from '../game/cards/TroopCard';
import { MaterialIcon } from '../game/MaterialIcon';
import { CARD_CLASS } from './MenuShell';
import { CoinIcon, LockIcon } from '../game/icons';
import type { ShowcaseMoment } from './TroopShowcase';

// A lineage's skill tree, opened from the Army: two attributes to pick from four, then one skill
// from two, then the forms it can evolve into - each paid with the materials carried home from the
// battlefields. Changing a choice already paid for costs coins. At the top the troop stands in its
// own setting and shows off what it learns.

const TroopShowcase = dynamic(() => import('./TroopShowcase').then(m => m.TroopShowcase), { ssr: false });

// How long the materials take to fly into the scene before the troop reacts
const FLIGHT_MS = 750;

const BUTTON = 'font-display flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-[0_3px_0_#1e293b] disabled:hover:translate-y-0';

// What something costs, each material with how many are carried
const CostList: React.FC<{ cost: MaterialCost; have: Partial<Record<MaterialId, number>> }> = ({ cost, have }) => (
  <ul className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs font-bold">
    {costEntries(cost).map(([id, count]) => {
      const owned = have[id] ?? 0;
      return (
        <li key={id} className={`flex items-center gap-1 ${owned >= count ? 'text-emerald-300' : 'text-slate-400'}`} title={MATERIALS[id].name}>
          <MaterialIcon id={id} />
          <span className="max-w-[7rem] truncate">{MATERIALS[id].name}</span>
          <span className="tabular-nums">{Math.min(owned, count)}/{count}</span>
        </li>
      );
    })}
  </ul>
);

interface Flight {
  key: number;
  materials: MaterialId[];
}

interface SkillTreeSheetProps {
  lineage: LineageId;
  onClose: () => void;
}

export const SkillTreeSheet: React.FC<SkillTreeSheetProps> = ({ lineage, onClose }) => {
  const profile = useProfile();
  const def = LINEAGES[lineage];
  const tree = treeOf(profile, lineage);
  const level = profile.cards[def.base] ?? 1;
  const deckForm = deckFormOf(profile, lineage);
  // The form on show at the top
  const [viewing, setViewing] = useState<TroopId>(deckForm ?? def.base);
  const [moment, setMoment] = useState<ShowcaseMoment | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  // An attribute picked to swap out (a respec), waiting for the one to swap in
  const [swapping, setSwapping] = useState<AttributeId | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const dialogRef = useRef<HTMLDivElement>(null);
  const cleared = highestCleared(profile);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  // (moments still to come are dropped when the sheet closes)
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, ms);
    timers.current.add(timer);
  };

  // Materials fly into the scene, then the troop shows off
  const celebrate = (cost: MaterialCost, next: ShowcaseMoment) => {
    const key = Date.now();
    // (the scene is at the top: bring it back into view)
    dialogRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    const materials = costEntries(cost).flatMap(([id, count]) => Array.from({ length: Math.min(3, count) }, () => id));
    if (materials.length > 0) setFlight({ key, materials });
    later(() => {
      setFlight(current => (current?.key === key ? null : current));
      setMoment(next);
    }, materials.length > 0 ? FLIGHT_MS : 0);
  };

  const learn = (id: AttributeId) => {
    const cost = ATTRIBUTES[id].cost;
    if (learnAttribute(lineage, id)) {
      playStinger('levelUp');
      celebrate(cost, { kind: 'learn', key: Date.now() });
    }
  };
  const swapIn = (id: AttributeId) => {
    if (swapping && respecAttribute(lineage, swapping, id)) {
      playStinger('levelUp');
      setSwapping(null);
      celebrate({}, { kind: 'learn', key: Date.now() });
    }
  };
  const learnTheSkill = (id: PlayerSkillId) => {
    const cost = PLAYER_SKILLS[id].cost;
    if (tree.skill ? respecSkill(lineage, id) : learnSkill(lineage, id)) {
      playStinger('levelUp');
      celebrate(tree.skill ? {} : cost, { kind: 'learn', key: Date.now() });
    }
  };
  const evolve = (id: TroopId) => {
    const form = def.forms.find(f => f.id === id)!;
    const from = evolvesFrom(id);
    if (!evolveCard(id)) return;
    playStinger('unlock');
    // Show the form it grows out of, so the burst turns that one into the new one - and start
    // fetching the new one's model while the materials fly in
    setViewing(from);
    instantiateUnitModel(id, 'player').then(disposeUnitModel).catch(() => {});
    celebrate(form.cost, { kind: 'evolve', key: Date.now(), from, to: id });
  };

  const ownedForms = [def.base, ...def.forms.map(f => f.id)].filter(id => profile.cards[id] !== undefined);
  // No room for this lineage among the battle cards (a lineage already there just swaps forms)
  const deckFull = !deckForm && profile.deck.length >= MAX_DECK_SIZE;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 pl-[var(--safe-l)] pr-[var(--safe-r)] pt-[var(--safe-t)] backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={`${def.name} skill tree`}
        onClick={event => event.stopPropagation()}
        className={`${CARD_CLASS} animate-fadeIn relative max-h-[94vh] w-full max-w-2xl overflow-y-auto overflow-x-hidden rounded-b-none p-0 pb-[calc(1rem+var(--safe-b))] sm:rounded-b-2xl`}
      >
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-slate-800/90 px-3 py-1 text-sm font-bold text-slate-200 hover:bg-slate-700" aria-label="Close">✕</button>

        {/* The troop in its own setting */}
        <div className="relative">
          <TroopShowcase
            type={viewing}
            setting={def.setting}
            moment={moment}
            onEvolved={setViewing}
            className="h-56 w-full sm:h-64"
          />
          <div className="pointer-events-none absolute bottom-2 left-3 rounded-lg bg-slate-950/70 px-2 py-1">
            <div className="font-display text-xl leading-tight text-white">{TROOPS[viewing].name}</div>
            <div className="text-xs font-bold text-slate-300">{def.name} lineage · level {level}</div>
          </div>
          {/* Materials flying in */}
          {flight && (
            <div key={flight.key} className="pointer-events-none absolute inset-0">
              {flight.materials.map((id, i) => {
                const angle = (i / flight.materials.length) * Math.PI * 2 + 0.4;
                return (
                  <span
                    key={i}
                    className="tree-material-flight absolute left-1/2 top-[55%] text-2xl"
                    style={{
                      '--from-x': `${Math.cos(angle) * 160}px`,
                      '--from-y': `${Math.sin(angle) * 110 + 60}px`,
                      animationDelay: `${i * 45}ms`
                    } as React.CSSProperties}
                  >
                    <MaterialIcon id={id} />
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Forms to look at */}
        {ownedForms.length > 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5">
            {ownedForms.map(id => (
              <button
                key={id}
                onClick={() => setViewing(id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${id === viewing ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
              >
                {TROOPS[id].name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-5 p-4 sm:p-5">
          {/* Tier 1: attributes */}
          <section>
            <h3 className="font-display text-lg text-slate-100">
              Attributes <span className="text-sm text-slate-400">choose {ATTRIBUTE_PICKS} · {tree.attributes.length}/{ATTRIBUTE_PICKS}</span>
            </h3>
            {swapping && (
              <p className="mt-1 text-xs font-bold text-amber-300">
                Pick what replaces {ATTRIBUTES[swapping].name} ({RESPEC_COST} coins) · <button className="underline" onClick={() => setSwapping(null)}>cancel</button>
              </p>
            )}
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {def.attributes.map(id => {
                const attribute = ATTRIBUTES[id];
                const learnt = tree.attributes.includes(id);
                const full = tree.attributes.length >= ATTRIBUTE_PICKS;
                const affordable = canAfford(profile.materials, attribute.cost);
                return (
                  <div key={id} className={`rounded-xl p-3 ring-1 ${learnt ? 'bg-emerald-500/15 ring-emerald-400/50' : 'bg-slate-800/70 ring-slate-600/50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-100">{attribute.name}</span>
                      {learnt && <span className="text-xs font-bold text-emerald-300">Learnt</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-300">{attribute.description}</p>
                    {!learnt && !swapping && !full && <div className="mt-2"><CostList cost={attribute.cost} have={profile.materials} /></div>}
                    <div className="mt-2 flex gap-2">
                      {learnt ? (
                        full && !swapping && (
                          <button
                            onClick={() => setSwapping(id)}
                            disabled={profile.coins < RESPEC_COST}
                            className={`${BUTTON} bg-slate-700 text-slate-100 shadow-[0_3px_0_#1e293b] hover:bg-slate-600`}
                            title="Change this attribute for another"
                          >
                            Swap · <CoinIcon />{RESPEC_COST}
                          </button>
                        )
                      ) : swapping ? (
                        <button onClick={() => swapIn(id)} className={`${BUTTON} bg-amber-500 text-slate-900 shadow-[0_3px_0_#b45309] hover:bg-amber-400`}>
                          Swap in
                        </button>
                      ) : !full ? (
                        <button onClick={() => learn(id)} disabled={!affordable} className={`${BUTTON} bg-emerald-600 text-white shadow-[0_3px_0_#065f46] hover:bg-emerald-500`}>
                          Learn
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Tier 2: a skill */}
          <section>
            <h3 className="font-display text-lg text-slate-100">Skill <span className="text-sm text-slate-400">choose 1</span></h3>
            {tree.attributes.length === 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-400"><LockIcon /> Learn an attribute first</p>
            )}
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {def.skills.map(id => {
                const { skill, cost } = PLAYER_SKILLS[id];
                const learnt = tree.skill === id;
                const open = tree.attributes.length > 0;
                return (
                  <div key={id} className={`rounded-xl p-3 ring-1 ${learnt ? 'bg-rose-500/15 ring-rose-400/50' : 'bg-slate-800/70 ring-slate-600/50'} ${open ? '' : 'opacity-60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-100">{skill.name}</span>
                      {learnt && <span className="text-xs font-bold text-rose-300">Learnt</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-300">{skill.description}</p>
                    {!learnt && !tree.skill && <div className="mt-2"><CostList cost={cost} have={profile.materials} /></div>}
                    {!learnt && open && (
                      <div className="mt-2">
                        {tree.skill ? (
                          <button
                            onClick={() => learnTheSkill(id)}
                            disabled={profile.coins < RESPEC_COST}
                            className={`${BUTTON} bg-slate-700 text-slate-100 shadow-[0_3px_0_#1e293b] hover:bg-slate-600`}
                          >
                            Swap to this · <CoinIcon />{RESPEC_COST}
                          </button>
                        ) : (
                          <button
                            onClick={() => learnTheSkill(id)}
                            disabled={!canAfford(profile.materials, cost)}
                            className={`${BUTTON} bg-rose-600 text-white shadow-[0_3px_0_#9f1239] hover:bg-rose-500`}
                          >
                            Learn
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Tier 3: evolutions */}
          <section>
            <h3 className="font-display text-lg text-slate-100">Evolutions</h3>
            <p className="text-xs text-slate-400">Every form shares this lineage&apos;s level and skill tree. Bring one form of each lineage to battle.</p>
            <div className="mt-2 flex flex-col gap-2">
              {def.forms.map(form => {
                const owned = profile.cards[form.id] !== undefined;
                const block = evolveBlock(profile, form.id);
                const inDeck = profile.deck.includes(form.id);
                return (
                  <div key={form.id} className={`flex gap-3 rounded-xl p-3 ring-1 ${owned ? 'bg-amber-500/10 ring-amber-400/40' : 'bg-slate-800/70 ring-slate-600/50'} ${form.from ? 'ml-6' : ''}`}>
                    <div className="w-16 shrink-0">
                      <TroopCard
                        type={form.id}
                        level={level}
                        stats={applyTree(cardStats(form.id, level), tree)}
                        size="xs"
                        fill
                        locked={!owned}
                        hideLevel={!owned}
                        onClick={() => setViewing(form.id)}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-bold text-slate-100">{TROOPS[form.id].name}</span>
                        <span className="text-xs text-slate-400">from {TROOPS[evolvesFrom(form.id)].name}</span>
                      </div>
                      <p className="text-xs text-slate-300">{TROOPS[form.id].role}</p>
                      {owned ? (
                        <button
                          onClick={() => toggleDeckCard(form.id)}
                          disabled={inDeck || deckFull}
                          className={`${BUTTON} mt-2 bg-sky-500 text-slate-900 shadow-[0_3px_0_#0369a1] hover:bg-sky-400 ${inDeck ? 'disabled:bg-emerald-700 disabled:text-white' : ''}`}
                          title={deckFull ? 'Your battle cards are full: leave one behind in the Army first' : undefined}
                        >
                          {inDeck ? 'In battle' : deckFull ? 'Battle cards full' : 'Bring to battle'}
                        </button>
                      ) : block === 'level' ? (
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-400">
                          <LockIcon /> Beat level {form.unlockLevel} · {getLevel(form.unlockLevel).name}
                          {form.unlockLevel > cleared && ` (${form.unlockLevel - cleared} to go)`}
                        </p>
                      ) : block === 'previous' ? (
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-400"><LockIcon /> Evolve {TROOPS[evolvesFrom(form.id)].name} first</p>
                      ) : (
                        <>
                          <div className="mt-1.5"><CostList cost={form.cost} have={profile.materials} /></div>
                          <button
                            onClick={() => evolve(form.id)}
                            disabled={block !== null}
                            className={`${BUTTON} mt-2 bg-amber-500 text-slate-900 shadow-[0_3px_0_#b45309] hover:bg-amber-400`}
                          >
                            Evolve
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
