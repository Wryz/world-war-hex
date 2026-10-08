import React from 'react';
import { BONDS, BondDef, activeBonds, bondPartner, describeBond } from '@/lib/game/bonds';
import { TroopId, getTroop } from '@/lib/game/troops';
import { BondIcon, UnitIcon } from '../icons';

// One line per bond: its cards and name, with what it does in the tooltip
const BriefBondChip: React.FC<{ bond: BondDef; active: boolean; missing?: TroopId }> = ({ bond, active, missing }) => (
  <li
    className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-amber-400/15 ring-1 ring-amber-300/60' : 'bg-slate-800/80 text-slate-400'}`}
    title={missing ? `Bring ${getTroop(missing).name} too: ${describeBond(bond)}` : describeBond(bond)}
  >
    <UnitIcon type={bond.cards[0]} />
    <BondIcon className={active ? '' : 'opacity-40'} />
    <UnitIcon type={bond.cards[1]} />
    <b className={active ? 'text-amber-200' : 'text-slate-300'}>{bond.name}</b>
    {missing && <span>+ {getTroop(missing).name}</span>}
  </li>
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
  if (brief) {
    return (
      <ul className="flex flex-wrap gap-1.5">
        {active.map(bond => <BriefBondChip key={bond.id} bond={bond} active />)}
        {nearby.map(bond => <BriefBondChip key={bond.id} bond={bond} active={false} missing={bond.cards.find(card => !deck.includes(card))} />)}
      </ul>
    );
  }
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
