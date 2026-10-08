import React, { useState } from 'react';
import { BONDS, BondDef, activeBonds, bondPartner, describeBond } from '@/lib/game/bonds';
import { TroopId, getTroop } from '@/lib/game/troops';
import { BondIcon, UnitIcon } from '../icons';

// One line per bond: its cards and name. Tapping it opens what it does underneath the list.
const BriefBondChip: React.FC<{ bond: BondDef; active: boolean; missing?: TroopId; open: boolean; onToggle: () => void }> = ({
  bond, active, missing, open, onToggle
}) => (
  <li>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs transition-colors hover:bg-slate-700 ${
        open ? 'bg-slate-700 ring-1 ring-amber-300' : active ? 'bg-amber-400/15 ring-1 ring-amber-300/60' : 'bg-slate-800/80 text-slate-400'
      }`}
    >
      <UnitIcon type={bond.cards[0]} />
      <BondIcon className={active ? '' : 'opacity-40'} />
      <UnitIcon type={bond.cards[1]} />
      <b className={active ? 'text-amber-200' : 'text-slate-300'}>{bond.name}</b>
      {missing && <span>+ {getTroop(missing).name}</span>}
    </button>
  </li>
);

// What a bond opened from the brief list does
const BondDetails: React.FC<{ bond: BondDef; missing?: TroopId }> = ({ bond, missing }) => (
  <div className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs leading-snug text-slate-300">
    <b className="text-amber-200">{bond.name}:</b> {describeBond(bond)}
    <span className="mt-0.5 block text-slate-400">
      {missing ? `Bring ${getTroop(missing).name} too to switch it on. ` : `Every ${getTroop(bond.cards[0]).name} and ${getTroop(bond.cards[1]).name} troop you deploy gets it. `}
      <i>{bond.flavor}</i>
    </span>
  </div>
);

const BondChip: React.FC<{ bond: BondDef; active: boolean; hint?: string }> = ({ bond, active, hint }) => (
  <li
    className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${active ? 'bg-amber-400/15 ring-1 ring-amber-300/60' : 'bg-slate-800/80 text-slate-400'}`}
    title={bond.flavor}
  >
    <span className="mt-0.5 flex shrink-0 items-center gap-0.5">
      <UnitIcon type={bond.cards[0]} />
      <BondIcon className={active ? '' : 'opacity-40'} />
      <UnitIcon type={bond.cards[1]} />
    </span>
    <span className="min-w-0">
      <b className={active ? 'text-amber-200' : 'text-slate-300'}>{bond.name}</b>
      <span className="block">{hint ?? describeBond(bond)}</span>
    </span>
  </li>
);

// The bonds a loadout completes, and (optionally) the ones a single swap away from cards you own;
// `brief` shows each on one line with the details in a tooltip
export const BondList: React.FC<{ deck: readonly TroopId[]; owned?: readonly TroopId[]; compact?: boolean; brief?: boolean }> = ({
  deck, owned, compact = false, brief = false
}) => {
  const active = activeBonds(deck);
  const nearby = owned
    ? BONDS.filter(bond => !active.includes(bond) && bond.cards.some(card => deck.includes(card)) && bond.cards.every(card => owned.includes(card)))
    : [];
  if (active.length === 0 && nearby.length === 0) {
    return compact || brief ? null : <p className="text-[11px] text-slate-400">No bonds yet: some cards fight better together.</p>;
  }
  if (brief) return <BriefBondList deck={deck} active={active} nearby={nearby} />;
  return (
    <ul className={`grid gap-1.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {active.map(bond => <BondChip key={bond.id} bond={bond} active />)}
      {nearby.map(bond => {
        const missing = bond.cards.find(card => !deck.includes(card))!;
        return (
          <BondChip
            key={bond.id}
            bond={bond}
            active={false}
            hint={`Bring ${getTroop(missing).name} too: ${describeBond(bond)}`}
          />
        );
      })}
    </ul>
  );
};

// Every bond a card can form, for its details
export const CardBonds: React.FC<{ card: TroopId; owned: readonly TroopId[] }> = ({ card, owned }) => (
  <ul className="flex flex-col gap-1">
    {BONDS.filter(bond => bond.cards.includes(card)).map(bond => {
      const partner = bondPartner(bond, card);
      return (
        <BondChip
          key={bond.id}
          bond={bond}
          active={owned.includes(partner)}
          hint={`With ${getTroop(partner).name}${owned.includes(partner) ? '' : ' (not owned yet)'}: ${describeBond(bond)}`}
        />
      );
    })}
  </ul>
);

const BriefBondList: React.FC<{ deck: readonly TroopId[]; active: BondDef[]; nearby: BondDef[] }> = ({ deck, active, nearby }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const missingFor = (bond: BondDef) => bond.cards.find(card => !deck.includes(card));
  const open = [...active, ...nearby].find(bond => bond.id === openId);
  const chip = (bond: BondDef, isActive: boolean) => (
    <BriefBondChip
      key={bond.id}
      bond={bond}
      active={isActive}
      missing={isActive ? undefined : missingFor(bond)}
      open={openId === bond.id}
      onToggle={() => setOpenId(current => (current === bond.id ? null : bond.id))}
    />
  );
  return (
    <div>
      <ul className="flex flex-wrap gap-1.5">
        {active.map(bond => chip(bond, true))}
        {nearby.map(bond => chip(bond, false))}
      </ul>
      {open && <BondDetails bond={open} missing={active.includes(open) ? undefined : missingFor(open)} />}
    </div>
  );
};
