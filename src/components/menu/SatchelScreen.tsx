import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cameFromAnotherPage } from '@/lib/navigation';
import { MATERIALS, MATERIAL_IDS, MaterialCategory, MaterialId, haulSize } from '@/lib/game/materials';
import { CHRONICLE, ChroniclePage, pageUnlocked } from '@/lib/game/lore';
import { useHasHydrated, useProfile } from '@/lib/meta/profile';
import { useMusic } from '@/lib/audio/music';
import { MaterialIcon, MaterialTile, RARITY_COLORS } from '../game/MaterialIcon';
import { MenuShell, CARD_CLASS } from './MenuShell';
import { ChronicleIcon, CloseIcon, SatchelIcon } from '../game/icons';

// The player's inventory: every material gathered on the battlefield, and the Chronicle pages the
// rarest of them have uncovered

const CATEGORIES: { id: MaterialCategory; title: string; detail: string }[] = [
  { id: 'land', title: 'From the land', detail: 'Lying on open ground: end a turn on it to gather it' },
  { id: 'deed', title: 'From your deeds', detail: 'Felling trees, burning, mining and drawing water' },
  { id: 'building', title: 'From buildings', detail: 'The stores of each building or camp you take first' },
  { id: 'spoils', title: 'Spoils', detail: 'Left behind by the enemies you defeat' },
  { id: 'trophy', title: 'Trophies', detail: 'Taken from each region\'s boss' },
  { id: 'relic', title: 'Relics', detail: 'Dug up at each region\'s story site' }
];

type Tab = 'materials' | 'chronicle';

const MaterialDetail: React.FC<{ id: MaterialId; count: number; found: boolean; onClose: () => void }> = ({ id, count, found, onClose }) => {
  const material = MATERIALS[id];
  const rarity = RARITY_COLORS[material.rarity];
  const page = CHRONICLE.find(entry => entry.unlockedBy === id);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 pl-[var(--safe-l)] pr-[var(--safe-r)] pt-[var(--safe-t)] backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        className={`${CARD_CLASS} animate-fadeIn relative w-full max-w-md rounded-b-none p-5 pb-[calc(1.25rem+var(--safe-b))] sm:rounded-2xl`}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-label={found ? material.name : 'Undiscovered material'}
      >
        <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Close">
          <CloseIcon className="text-lg" />
        </button>
        <div className="flex items-center gap-4">
          <MaterialTile id={id} size="lg" dim={!found} />
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: rarity.text }}>{rarity.label}</div>
            <h2 className="font-display text-2xl">{found ? material.name : '???'}</h2>
            {found && <div className="text-sm text-slate-300">In your satchel: <b className="text-white">{count}</b></div>}
          </div>
        </div>
        {found && <p className="mt-3 text-sm italic leading-relaxed text-slate-300">{material.flavour}</p>}
        <div className="mt-3 rounded-lg bg-slate-800/80 px-3 py-2 text-sm">
          <span className="font-bold text-slate-400">Found: </span>{material.source}
        </div>
        {page && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-950/60 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-500/40">
            <ChronicleIcon /> {found ? <>Opens the Chronicle page <b>{page.title}</b></> : 'Opens a page of the Chronicle'}
          </div>
        )}
      </div>
    </div>
  );
};

const ChronicleView: React.FC<{ found: (id: MaterialId) => boolean; openId: string | null; onOpen: (id: string | null) => void }> = ({ found, openId, onOpen }) => {
  const unlocked = CHRONICLE.filter(page => pageUnlocked(page, found)).length;
  return (
    <div>
      <p className="mb-3 text-sm text-slate-700">
        <b>{unlocked}/{CHRONICLE.length}</b> pages recovered. Every region hides a story site, and every region&apos;s boss carries
        something from the past: bring them home to piece together what happened to the realm.
      </p>
      <ol className="flex flex-col gap-2">
        {CHRONICLE.map((page: ChroniclePage, index) => {
          const open = pageUnlocked(page, found);
          const expanded = open && openId === page.id;
          return (
            <li key={page.id}>
              <button
                type="button"
                disabled={!open}
                onClick={() => onOpen(expanded ? null : page.id)}
                className={`${CARD_CLASS} flex w-full items-start gap-3 px-4 py-3 text-left ${open ? 'hover:bg-slate-800/95' : 'cursor-default opacity-70'}`}
                aria-expanded={expanded}
              >
                <span className="font-display w-6 shrink-0 text-right text-lg text-slate-500">{index + 1}</span>
                <span className="mt-0.5 shrink-0 text-2xl">
                  {page.unlockedBy ? <MaterialIcon id={page.unlockedBy} color={open ? undefined : '#475569'} /> : <ChronicleIcon />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`font-display block text-lg leading-tight ${open ? 'text-amber-200' : 'text-slate-400'}`}>{open ? page.title : 'A lost page'}</span>
                  {!open && <span className="block text-xs text-slate-400">{page.clue}</span>}
                  {expanded && <span className="mt-2 block font-serif text-[0.9375rem] leading-relaxed text-slate-200">{page.text}</span>}
                  {open && !expanded && <span className="block truncate text-xs text-slate-400">{page.text}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export const SatchelScreen: React.FC = () => {
  const router = useRouter();
  const profile = useProfile();
  const hydrated = useHasHydrated();
  useMusic('menu');
  const [tab, setTab] = useState<Tab>('materials');
  const [selected, setSelected] = useState<MaterialId | null>(null);
  const [openPage, setOpenPage] = useState<string | null>('prologue');

  // Opened from a battle's results
  const [fromBattle, setFromBattle] = useState(false);
  // A link to a page of the Chronicle (from the results screen) opens it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFromBattle(params.get('from') === 'battle');
    const page = params.get('page');
    if (page && CHRONICLE.some(entry => entry.id === page)) {
      setTab('chronicle');
      setOpenPage(page);
    }
  }, []);

  const materials = hydrated ? profile.materials : {};
  const foundSet = new Set(hydrated ? profile.materialsFound : []);
  const found = (id: MaterialId) => foundSet.has(id);

  return (
    // (back where the player came from - from a battle's results, the campaign map, as that battle is
    // over - or home if they came straight here)
    <MenuShell
      title="Satchel"
      icon={<SatchelIcon />}
      onBack={() => (fromBattle ? router.push('/campaign') : cameFromAnotherPage() ? router.back() : router.push('/'))}
    >
      <div className="mb-4 flex gap-2">
        {([['materials', 'Materials', <SatchelIcon key="m" />], ['chronicle', 'Chronicle', <ChronicleIcon key="c" />]] as const).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`font-display flex items-center gap-1.5 rounded-xl px-4 py-2 text-lg shadow-[0_4px_0_#020617] ${tab === id ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
            aria-pressed={tab === id}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'materials' ? (
        <>
          <p className="mb-3 text-sm text-slate-700">
            <b>{foundSet.size}/{MATERIAL_IDS.length}</b> materials found · <b>{haulSize(materials)}</b> in your satchel.
            Gather them on the battlefield; soon they will evolve your troops.
          </p>
          <div className="flex flex-col gap-3">
            {CATEGORIES.map(category => {
              const ids = MATERIAL_IDS.filter(id => MATERIALS[id].category === category.id);
              return (
                <section key={category.id} className={`${CARD_CLASS} p-4`}>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
                    <h2 className="font-display text-xl">{category.title}</h2>
                    <span className="text-xs text-slate-400">{category.detail} · {ids.filter(found).length}/{ids.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {ids.map(id => (
                      <button key={id} type="button" onClick={() => setSelected(id)} className="rounded-xl transition-transform hover:-translate-y-0.5" aria-label={found(id) ? MATERIALS[id].name : 'Undiscovered material'}>
                        <MaterialTile id={id} count={materials[id]} dim={!found(id)} title={found(id) ? MATERIALS[id].name : `??? (${MATERIALS[id].source})`} />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <ChronicleView found={found} openId={openPage} onOpen={setOpenPage} />
      )}

      {selected && <MaterialDetail id={selected} count={materials[selected] ?? 0} found={found(selected)} onClose={() => setSelected(null)} />}
    </MenuShell>
  );
};
