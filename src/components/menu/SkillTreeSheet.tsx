'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { TROOPS, TroopId, cardStats } from '@/lib/game/troops';
import { MATERIALS, MaterialId } from '@/lib/game/materials';
import {
  ATTRIBUTES, ATTRIBUTE_PICKS, AttributeId, FormDef, LINEAGES, LineageId, MaterialCost, PLAYER_SKILLS, PlayerSkillId, RESPEC_COST,
  applyTree, canAfford, costEntries, evolvesFrom
} from '@/lib/game/lineages';
import { MAX_DECK_SIZE } from '@/lib/meta/economy';
import {
  deckFormOf, evolveBlock, evolveCard, highestCleared, learnAttribute, learnSkill, respecAttribute, respecSkill, toggleDeckCard,
  treeOf, useProfile
} from '@/lib/meta/profile';
import { getLevel } from '@/lib/campaign/levels';
import { playStinger } from '@/lib/audio/music';
import { RARITY_STYLES } from '../game/cards/TroopCard';
import { cardArtUrl } from '../game/cards/cardArt';
import { MaterialIcon } from '../game/MaterialIcon';
import { CARD_CLASS } from './MenuShell';
import { ATTRIBUTE_ICONS, AttackIcon, CoinIcon, HealthIcon, LockIcon, MoveIcon, PLAYER_SKILL_ICONS } from '../game/icons';
import { disposeUnitModel, instantiateUnitModel } from '../game/utils/unitModelCache';
import type { ShowcaseMoment } from './TroopShowcase';

// A lineage's skill tree, opened from the Army. The troop's picture is the root: its four attributes
// hang below it (two to learn), and to its right branch its two skills (one to learn) and the forms it
// evolves into, each joined by a line that lights up once it's learnt. Tapping a node shows what it
// does and what it costs below the tree. Whatever is learnt or evolved then plays out in the troop's
// own setting: the materials fly in, and it glows - or bursts into its new form and cheers.

const TroopShowcase = dynamic(() => import('./TroopShowcase').then(m => m.TroopShowcase), { ssr: false });

// How long the materials take to fly in, and how long each moment then plays for
const FLIGHT_MS = 750;
const LEARN_MS = 2400;
const EVOLVE_MS = 3600;

const BUTTON = 'font-display flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-[0_3px_0_#1e293b] disabled:hover:translate-y-0';

// --- Cost -----------------------------------------------------------------------------------

const CostList: React.FC<{ cost: MaterialCost; have: Partial<Record<MaterialId, number>> }> = ({ cost, have }) => (
  <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
    {costEntries(cost).map(([id, count]) => {
      const owned = have[id] ?? 0;
      return (
        <li key={id} className={`flex items-center gap-1 ${owned >= count ? 'text-emerald-300' : 'text-slate-400'}`} title={MATERIALS[id].name}>
          <MaterialIcon id={id} />
          <span>{MATERIALS[id].name}</span>
          <span className="tabular-nums">{Math.min(owned, count)}/{count}</span>
        </li>
      );
    })}
  </ul>
);

// --- Nodes ----------------------------------------------------------------------------------

// learnt: done; ready: can be had right now; open: can be had once the materials are in; locked:
// something else comes first
type NodeState = 'learnt' | 'ready' | 'open' | 'locked';

const RING: Record<NodeState, string> = {
  learnt: 'ring-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.65)] bg-amber-500/25',
  ready: 'ring-emerald-400 bg-emerald-500/15',
  open: 'ring-slate-500 bg-slate-800',
  locked: 'ring-slate-700 bg-slate-900 opacity-60 grayscale'
};

interface TreeNodeProps {
  id: string;
  state: NodeState;
  selected: boolean;
  label: string;
  onSelect: () => void;
  nodeRef: (id: string, el: HTMLElement | null) => void;
  children: React.ReactNode;
}

const TreeNode: React.FC<TreeNodeProps> = ({ id, state, selected, label, onSelect, nodeRef, children }) => (
  <button
    type="button"
    onClick={onSelect}
    className="group relative flex w-[4.5rem] flex-col items-center gap-1 sm:w-20"
    aria-pressed={selected}
    aria-label={`${label}${state === 'learnt' ? ' (learnt)' : state === 'locked' ? ' (locked)' : ''}`}
  >
    <span
      ref={el => nodeRef(id, el)}
      className={`relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-2xl text-white ring-[3px] transition-transform group-hover:scale-105 sm:h-16 sm:w-16 sm:text-3xl ${RING[state]} ${selected ? 'outline outline-2 outline-offset-4 outline-sky-300' : ''}`}
    >
      {children}
      {state === 'locked' && <span className="absolute bottom-0.5 right-0.5 rounded-full bg-slate-950/90 p-0.5 text-[0.625rem]"><LockIcon /></span>}
    </span>
    {state === 'ready' && <span className="absolute right-1 top-0 h-3 w-3 animate-pulse rounded-full bg-emerald-400 ring-2 ring-slate-900 sm:right-2" />}
    <span className={`line-clamp-2 text-center text-[0.6875rem] font-bold leading-tight ${state === 'locked' ? 'text-slate-500' : 'text-slate-200'}`}>{label}</span>
  </button>
);

// --- Connecting lines -------------------------------------------------------------------------

interface Edge {
  from: string;
  to: string;
  // down: from the bottom of `from` to the top of `to`; trunk: the same, but straight down the middle
  // first (past the nodes in between); right: from its right side to the left side
  direction: 'down' | 'trunk' | 'right';
  lit: boolean;
}

interface Path {
  d: string;
  lit: boolean;
}

// Lines between the nodes, measured from where they ended up on screen
const useTreeLines = (edges: Edge[], deps: unknown[]) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<Path[]>([]);
  const nodeRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  }, []);
  const key = JSON.stringify(edges);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    const next: Path[] = [];
    for (const edge of JSON.parse(key) as Edge[]) {
      const a = nodes.current.get(edge.from)?.getBoundingClientRect();
      const b = nodes.current.get(edge.to)?.getBoundingClientRect();
      if (!a || !b) continue;
      if (edge.direction === 'down') {
        const x1 = a.left + a.width / 2 - box.left, y1 = a.bottom - box.top;
        const x2 = b.left + b.width / 2 - box.left, y2 = b.top - box.top;
        const mid = (y1 + y2) / 2;
        next.push({ d: `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`, lit: edge.lit });
      } else if (edge.direction === 'trunk') {
        const x1 = a.left + a.width / 2 - box.left, y1 = a.bottom - box.top;
        const x2 = b.left + b.width / 2 - box.left, y2 = b.top - box.top;
        const bend = y2 - 22;
        next.push({ d: `M${x1},${y1} L${x1},${bend} C${x1},${y2 - 6} ${x2},${bend + 4} ${x2},${y2}`, lit: edge.lit });
      } else {
        const x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top;
        const x2 = b.left - box.left, y2 = b.top + b.height / 2 - box.top;
        const mid = (x1 + x2) / 2;
        next.push({ d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`, lit: edge.lit });
      }
    }
    setPaths(next);
  }, [key]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return { containerRef, nodeRef, paths };
};

// --- The sheet ----------------------------------------------------------------------------------

type Selection =
  | { kind: 'root' }
  | { kind: 'attribute'; id: AttributeId }
  | { kind: 'skill'; id: PlayerSkillId }
  | { kind: 'form'; id: TroopId };

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
  const cleared = highestCleared(profile);
  // The form pictured at the root
  const [viewing, setViewing] = useState<TroopId>(deckForm ?? def.base);
  const [selected, setSelected] = useState<Selection>({ kind: 'root' });
  // A moment playing in the troop's own setting (over the tree), with the materials flying in first
  const [scene, setScene] = useState<{ key: number; type: TroopId } | null>(null);
  const [moment, setMoment] = useState<ShowcaseMoment | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  // A form just evolved into: pictured at the root once its moment is over (or skipped)
  const evolvedRef = useRef<TroopId | null>(null);
  const endScene = useCallback((key?: number) => {
    setScene(current => (key === undefined || current?.key === key ? null : current));
    if (evolvedRef.current) {
      setViewing(evolvedRef.current);
      evolvedRef.current = null;
    }
  }, []);

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

  // Materials fly into the troop's setting, then it shows off; the scene closes once it's done (or
  // when tapped)
  const celebrate = (cost: MaterialCost, next: ShowcaseMoment, type: TroopId) => {
    const key = Date.now();
    const materials = costEntries(cost).flatMap(([id, count]) => Array.from({ length: Math.min(3, count) }, () => id));
    setScene({ key, type });
    setFlight(materials.length > 0 ? { key, materials } : null);
    const delay = materials.length > 0 ? FLIGHT_MS : 200;
    later(() => {
      setFlight(current => (current?.key === key ? null : current));
      setMoment(next);
    }, delay);
    later(() => endScene(key), delay + (next.kind === 'evolve' ? EVOLVE_MS : LEARN_MS));
  };

  // --- Actions ---
  const learn = (id: AttributeId) => {
    if (!learnAttribute(lineage, id)) return;
    playStinger('levelUp');
    celebrate(ATTRIBUTES[id].cost, { kind: 'learn', key: Date.now() }, viewing);
  };
  const replace = (from: AttributeId, to: AttributeId) => {
    if (!respecAttribute(lineage, from, to)) return;
    playStinger('levelUp');
    celebrate({}, { kind: 'learn', key: Date.now() }, viewing);
  };
  const learnTheSkill = (id: PlayerSkillId) => {
    const switching = !!tree.skill;
    if (!(switching ? respecSkill(lineage, id) : learnSkill(lineage, id))) return;
    playStinger('levelUp');
    celebrate(switching ? {} : PLAYER_SKILLS[id].cost, { kind: 'learn', key: Date.now() }, viewing);
  };
  const evolve = (form: FormDef) => {
    const from = evolvesFrom(form.id);
    if (!evolveCard(form.id)) return;
    playStinger('unlock');
    // (start fetching the new form's model while the materials fly in)
    instantiateUnitModel(form.id, 'player').then(disposeUnitModel).catch(() => {});
    evolvedRef.current = form.id;
    celebrate(form.cost, { kind: 'evolve', key: Date.now(), from, to: form.id }, from);
  };

  // --- Node states ---
  const attributeState = (id: AttributeId): NodeState =>
    tree.attributes.includes(id) ? 'learnt'
      : tree.attributes.length >= ATTRIBUTE_PICKS ? 'open'
        : canAfford(profile.materials, ATTRIBUTES[id].cost) ? 'ready' : 'open';
  const skillState = (id: PlayerSkillId): NodeState =>
    tree.skill === id ? 'learnt'
      : tree.attributes.length === 0 ? 'locked'
        : !tree.skill && canAfford(profile.materials, PLAYER_SKILLS[id].cost) ? 'ready' : 'open';
  const formState = (id: TroopId): NodeState => {
    const block = evolveBlock(profile, id);
    return profile.cards[id] !== undefined ? 'learnt' : block === null ? 'ready' : block === 'materials' ? 'open' : 'locked';
  };

  // Evolution branches: each form straight from the base, followed by the forms that grow from it
  const branches = def.forms.filter(form => !form.from).map(first => {
    const chain: FormDef[] = [first];
    for (let next = def.forms.find(f => f.from === first.id); next; next = def.forms.find(f => f.from === next!.id)) chain.push(next);
    return chain;
  });

  const edges: Edge[] = [
    // (the attributes sit two by two: the second pair's lines run down between the first pair)
    ...def.attributes.map((id, i) => ({ from: 'root', to: `attribute:${id}`, direction: i < 2 ? 'down' as const : 'trunk' as const, lit: tree.attributes.includes(id) })),
    ...def.skills.map(id => ({ from: 'root', to: `skill:${id}`, direction: 'right' as const, lit: tree.skill === id })),
    ...branches.flatMap(chain => chain.map((form, i) => ({
      from: i === 0 ? 'root' : `form:${chain[i - 1].id}`, to: `form:${form.id}`, direction: 'right' as const, lit: profile.cards[form.id] !== undefined
    })))
  ];
  const { containerRef, nodeRef, paths } = useTreeLines(edges, [viewing]);

  const rarity = RARITY_STYLES[TROOPS[viewing].rarity];
  const deckFull = !deckForm && profile.deck.length >= MAX_DECK_SIZE;
  const isSelected = (s: Selection) => JSON.stringify(s) === JSON.stringify(selected);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 pl-[var(--safe-l)] pr-[var(--safe-r)] pt-[var(--safe-t)] backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`${def.name} skill tree`}
        onClick={event => event.stopPropagation()}
        className={`${CARD_CLASS} animate-fadeIn relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-b-none p-0 sm:rounded-b-2xl`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-700/60 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display truncate text-xl leading-tight text-white">{def.name} skill tree</h2>
            <p className="text-xs font-bold text-slate-400">Level {level} · tap a node to see it</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-slate-300 hover:bg-slate-700" aria-label="Close">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {/* The tree */}
          <div ref={containerRef} className="relative grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-x-6 px-3 py-4 sm:gap-x-12 sm:px-6">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {paths.map((path, i) => (
                <path
                  key={i}
                  d={path.d}
                  fill="none"
                  stroke={path.lit ? '#fcd34d' : '#475569'}
                  strokeWidth={path.lit ? 3 : 2}
                  strokeDasharray={path.lit ? undefined : '5 5'}
                  strokeLinecap="round"
                />
              ))}
            </svg>

            {/* Left: the troop, and its attributes below it */}
            <div className="relative flex flex-col items-center">
              <button
                type="button"
                ref={el => nodeRef('root', el)}
                onClick={() => setSelected({ kind: 'root' })}
                className={`relative w-full max-w-[11rem] overflow-hidden rounded-2xl transition-transform hover:scale-[1.02] ${isSelected({ kind: 'root' }) ? 'outline outline-2 outline-offset-4 outline-sky-300' : ''}`}
                style={{ background: `radial-gradient(ellipse at 50% 60%, ${rarity.frame}66, #0f172a 75%)`, boxShadow: `0 0 0 4px ${rarity.frame}` }}
                aria-label={TROOPS[viewing].name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cardArtUrl(viewing)} alt="" className="aspect-[5/4] w-full object-cover" draggable={false} />
                <span className="block bg-slate-950/85 px-2 py-1 text-center">
                  <span className="font-display block truncate text-base leading-tight text-white">{TROOPS[viewing].name}</span>
                  <span className="block text-[0.6875rem] font-bold" style={{ color: rarity.text }}>Level {level}</span>
                </span>
              </button>

              <div className="mt-8 grid grid-cols-2 gap-x-2 gap-y-3">
                {def.attributes.map(id => {
                  const Icon = ATTRIBUTE_ICONS[id];
                  return (
                    <TreeNode
                      key={id}
                      id={`attribute:${id}`}
                      state={attributeState(id)}
                      selected={isSelected({ kind: 'attribute', id })}
                      label={ATTRIBUTES[id].name}
                      onSelect={() => setSelected({ kind: 'attribute', id })}
                      nodeRef={nodeRef}
                    >
                      <Icon />
                    </TreeNode>
                  );
                })}
              </div>
              <h3 className="mt-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                Attributes · {tree.attributes.length}/{ATTRIBUTE_PICKS}
              </h3>
            </div>

            {/* Right: its skills, then the forms it evolves into */}
            <div className="relative flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Skill · pick 1</h3>
              <div className="mt-2 flex gap-2">
                {def.skills.map(id => {
                  const Icon = PLAYER_SKILL_ICONS[id];
                  return (
                    <TreeNode
                      key={id}
                      id={`skill:${id}`}
                      state={skillState(id)}
                      selected={isSelected({ kind: 'skill', id })}
                      label={PLAYER_SKILLS[id].skill.name}
                      onSelect={() => setSelected({ kind: 'skill', id })}
                      nodeRef={nodeRef}
                    >
                      <Icon />
                    </TreeNode>
                  );
                })}
              </div>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">Evolutions</h3>
              <div className="mt-2 flex flex-col gap-3">
                {branches.map(chain => (
                  <div key={chain[0].id} className="flex gap-2">
                    {chain.map(form => (
                      <TreeNode
                        key={form.id}
                        id={`form:${form.id}`}
                        state={formState(form.id)}
                        selected={isSelected({ kind: 'form', id: form.id })}
                        label={TROOPS[form.id].name}
                        onSelect={() => setSelected({ kind: 'form', id: form.id })}
                        nodeRef={nodeRef}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cardArtUrl(form.id)} alt="" className="h-full w-full scale-125 object-cover" draggable={false} />
                      </TreeNode>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* What the selected node does */}
        <div className="border-t border-slate-700/60 bg-slate-950/60 px-4 py-3 pb-[calc(0.75rem+var(--safe-b))]">
          <Details
            selection={selected}
            lineage={lineage}
            viewing={viewing}
            deckFull={deckFull}
            cleared={cleared}
            onLearn={learn}
            onReplace={replace}
            onSkill={learnTheSkill}
            onEvolve={evolve}
            onView={setViewing}
          />
        </div>

        {/* The troop in its own setting, playing out what it just learnt (kept loaded, paused while hidden) */}
        <div
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/85 transition-opacity duration-300 ${scene ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0 [&_*]:pointer-events-none'}`}
          onClick={() => endScene()}
          aria-hidden={!scene}
        >
          <div className="relative w-full max-w-lg px-3">
            <TroopShowcase
              type={scene?.type ?? viewing}
              setting={def.setting}
              moment={moment}
              paused={!scene}
              onEvolved={setViewing}
              className="h-64 w-full rounded-2xl sm:h-80"
            />
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
          <p className="mt-3 text-xs font-bold text-slate-400">Tap to continue</p>
        </div>
      </div>
    </div>
  );
};

// --- The details panel ----------------------------------------------------------------------------

interface DetailsProps {
  selection: Selection;
  lineage: LineageId;
  viewing: TroopId;
  deckFull: boolean;
  cleared: number;
  onLearn: (id: AttributeId) => void;
  onReplace: (from: AttributeId, to: AttributeId) => void;
  onSkill: (id: PlayerSkillId) => void;
  onEvolve: (form: FormDef) => void;
  onView: (id: TroopId) => void;
}

const Details: React.FC<DetailsProps> = ({ selection, lineage, viewing, deckFull, cleared, onLearn, onReplace, onSkill, onEvolve, onView }) => {
  const profile = useProfile();
  const def = LINEAGES[lineage];
  const tree = treeOf(profile, lineage);
  const level = profile.cards[def.base] ?? 1;

  if (selection.kind === 'root') {
    const owned = [def.base, ...def.forms.map(f => f.id)].filter(id => profile.cards[id] !== undefined).length;
    return (
      <div className="text-sm">
        <div className="font-display text-lg text-white">{TROOPS[viewing].name}</div>
        <p className="text-slate-300">
          Learn two attributes, then a skill, and evolve the {def.name} into new forms with the materials you bring home from battle.
          Every form shares this level and tree.{owned > 1 && ' Tap a form you have to see it here.'}
        </p>
      </div>
    );
  }

  if (selection.kind === 'attribute') {
    const attribute = ATTRIBUTES[selection.id];
    const learnt = tree.attributes.includes(selection.id);
    const full = tree.attributes.length >= ATTRIBUTE_PICKS;
    const Icon = ATTRIBUTE_ICONS[selection.id];
    return (
      <div className="flex flex-col gap-2 text-sm">
        <Title icon={<Icon />} name={attribute.name} kind="Attribute" learnt={learnt} />
        <p className="text-slate-300">{attribute.description}</p>
        {learnt ? (
          <p className="text-xs font-bold text-slate-400">Pick another attribute to swap this one out ({RESPEC_COST} coins).</p>
        ) : full ? (
          <div className="flex flex-wrap gap-2">
            {tree.attributes.map(old => (
              <button
                key={old}
                onClick={() => onReplace(old, selection.id)}
                disabled={profile.coins < RESPEC_COST}
                className={`${BUTTON} bg-amber-500 text-slate-900 shadow-[0_3px_0_#b45309] hover:bg-amber-400`}
              >
                Replace {ATTRIBUTES[old].name} · <CoinIcon />{RESPEC_COST}
              </button>
            ))}
          </div>
        ) : (
          <>
            <CostList cost={attribute.cost} have={profile.materials} />
            <div>
              <button
                onClick={() => onLearn(selection.id)}
                disabled={!canAfford(profile.materials, attribute.cost)}
                className={`${BUTTON} bg-emerald-600 text-white shadow-[0_3px_0_#065f46] hover:bg-emerald-500`}
              >
                Learn
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (selection.kind === 'skill') {
    const { skill, cost } = PLAYER_SKILLS[selection.id];
    const learnt = tree.skill === selection.id;
    const Icon = PLAYER_SKILL_ICONS[selection.id];
    return (
      <div className="flex flex-col gap-2 text-sm">
        <Title icon={<Icon />} name={skill.name} kind="Skill" learnt={learnt} />
        <p className="text-slate-300">{skill.description}</p>
        {learnt ? null : tree.attributes.length === 0 ? (
          <p className="flex items-center gap-1 text-xs font-bold text-slate-400"><LockIcon /> Learn an attribute first</p>
        ) : tree.skill ? (
          <div>
            <button
              onClick={() => onSkill(selection.id)}
              disabled={profile.coins < RESPEC_COST}
              className={`${BUTTON} bg-amber-500 text-slate-900 shadow-[0_3px_0_#b45309] hover:bg-amber-400`}
            >
              Switch to {skill.name} · <CoinIcon />{RESPEC_COST}
            </button>
          </div>
        ) : (
          <>
            <CostList cost={cost} have={profile.materials} />
            <div>
              <button
                onClick={() => onSkill(selection.id)}
                disabled={!canAfford(profile.materials, cost)}
                className={`${BUTTON} bg-emerald-600 text-white shadow-[0_3px_0_#065f46] hover:bg-emerald-500`}
              >
                Learn
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // A form
  const form = def.forms.find(f => f.id === selection.id)!;
  const troop = TROOPS[form.id];
  const owned = profile.cards[form.id] !== undefined;
  const block = evolveBlock(profile, form.id);
  const inDeck = profile.deck.includes(form.id);
  const stats = applyTree(cardStats(form.id, level), tree);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <Title
        // eslint-disable-next-line @next/next/no-img-element
        icon={<img src={cardArtUrl(form.id)} alt="" className="h-full w-full scale-125 object-cover" />}
        name={troop.name}
        kind={`Evolves from ${TROOPS[evolvesFrom(form.id)].name}`}
        learnt={owned}
      />
      <p className="text-slate-300">{troop.role}</p>
      <div className="flex gap-4 text-xs font-bold tabular-nums text-slate-200">
        <span className="flex items-center gap-1" title="Attack"><AttackIcon />{Number.isInteger(stats.attackPower) ? stats.attackPower : stats.attackPower.toFixed(1)}</span>
        <span className="flex items-center gap-1" title="Health"><HealthIcon />{stats.maxLifespan}</span>
        <span className="flex items-center gap-1" title="Movement"><MoveIcon />{stats.movementRange}</span>
      </div>
      {owned ? (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => toggleDeckCard(form.id)}
            disabled={inDeck || deckFull}
            className={`${BUTTON} bg-sky-500 text-slate-900 shadow-[0_3px_0_#0369a1] hover:bg-sky-400 ${inDeck ? 'disabled:!bg-emerald-700 disabled:!text-white' : ''}`}
            title={deckFull ? 'Your battle cards are full: leave one behind in the Army first' : undefined}
          >
            {inDeck ? 'In battle' : deckFull ? 'Battle cards full' : 'Bring to battle'}
          </button>
          {viewing !== form.id && (
            <button onClick={() => onView(form.id)} className={`${BUTTON} bg-slate-700 text-slate-100 shadow-[0_3px_0_#1e293b] hover:bg-slate-600`}>
              Show
            </button>
          )}
        </div>
      ) : block === 'level' ? (
        <p className="flex items-center gap-1 text-xs font-bold text-slate-400">
          <LockIcon /> Beat level {form.unlockLevel} · {getLevel(form.unlockLevel).name}
          {form.unlockLevel > cleared && ` (${form.unlockLevel - cleared} to go)`}
        </p>
      ) : block === 'previous' ? (
        <p className="flex items-center gap-1 text-xs font-bold text-slate-400">
          <LockIcon /> Evolve {TROOPS[evolvesFrom(form.id)].name} first{form.unlockLevel > cleared && `, and beat level ${form.unlockLevel}`}
        </p>
      ) : (
        <>
          <CostList cost={form.cost} have={profile.materials} />
          <div>
            <button
              onClick={() => onEvolve(form)}
              disabled={block !== null}
              className={`${BUTTON} bg-amber-500 text-slate-900 shadow-[0_3px_0_#b45309] hover:bg-amber-400`}
            >
              Evolve
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const Title: React.FC<{ icon: React.ReactNode; name: string; kind: string; learnt: boolean }> = ({ icon, name, kind, learnt }) => (
  <div className="flex items-center gap-3">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl text-white ring-2 ${learnt ? 'bg-amber-500/25 ring-amber-300' : 'bg-slate-800 ring-slate-500'}`}>
      {icon}
    </span>
    <div className="min-w-0">
      <div className="font-display truncate text-lg leading-tight text-white">{name}</div>
      <div className="text-xs font-bold text-slate-400">
        {kind}
        {learnt && <span className="text-amber-300"> · {kind === 'Attribute' || kind === 'Skill' ? 'Learnt' : 'Unlocked'}</span>}
      </div>
    </div>
  </div>
);
