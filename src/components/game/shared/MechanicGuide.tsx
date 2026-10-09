import { useEffect, useMemo, useRef } from 'react';
import { GameState, HexCoordinates, Unit } from '@/types/game';
import { findBaseHex, getFellTargets, getValidMoveTargets, getVisibleHexKeys, isFellOrder, isFogOfWar } from '@/lib/game/gameState';
import { CATAPULT_RANGE } from '@/lib/game/structures';
import { getHexDistance } from '@/lib/game/hexUtils';

// After the tutorial battles, the tutorial's hand comes back once for each new thing a battle
// brings, the first time it turns up: the fog of war, a boss's marked strike, a great tree a troop
// could fell, a catapult tower and a gatehouse. It points at it with a few words (and for a tree,
// walks through felling it), until the player does it or ends the turn; then it never shows again.

export type MechanicId = 'fog' | 'bossPower' | 'felling' | 'catapult' | 'gate';

const STORAGE_KEY = 'wwhGuideSeen';

const readSeen = (): Set<MechanicId> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as MechanicId[]);
  } catch {
    return new Set();
  }
};

const markSeen = (id: MechanicId) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...readSeen(), id]));
  } catch {
    // Storage blocked: it may show again next visit
  }
};

export interface MechanicPointer {
  id: MechanicId;
  hex: HexCoordinates;
  caption: string;
}

const same = (a: HexCoordinates, b: HexCoordinates) => a.q === b.q && a.r === b.r;

// What the hand would show for a mechanic right now, if it is in play
const pointerFor = (id: MechanicId, state: GameState, selected: Unit | null): MechanicPointer | null => {
  const units = state.players.player.units.filter(unit => !unit.hasMoved && !state.pendingMoves.some(move => move.unitId === unit.id));
  const castle = findBaseHex(state, 'player')?.coordinates;
  const nearestTo = (hexes: HexCoordinates[], to: HexCoordinates | undefined) =>
    to ? [...hexes].sort((a, b) => getHexDistance(a, to) - getHexDistance(b, to))[0] : hexes[0];
  switch (id) {
    case 'bossPower': {
      const boss = state.players.ai.units.find(unit => unit.isBoss && unit.threat && unit.threat.length > 0);
      if (!boss) return null;
      return { id, hex: nearestTo(boss.threat!, castle), caption: 'The boss strikes the red ground at the end of its next turn: get clear!' };
    }
    case 'felling': {
      const live = selected && units.find(unit => unit.id === selected.id);
      const trees = live ? getFellTargets(state, live) : [];
      if (live && trees.length > 0) return { id, hex: trees[0], caption: 'Tap the great tree: it falls away from your troop, crushing whoever is beyond' };
      const feller = units.find(unit => getFellTargets(state, unit).length > 0);
      return feller ? { id, hex: feller.position, caption: 'This troop stands by a great tree: it can chop it down' } : null;
    }
    case 'catapult':
    case 'gate': {
      const terrain = id === 'catapult' ? 'catapult' : 'gate';
      const sites = state.hexGrid.filter(hex => hex.terrain === terrain && hex.owner !== 'player').map(hex => hex.coordinates);
      if (sites.length === 0) return null;
      const site = nearestTo(sites, castle)!;
      const live = selected && units.find(unit => unit.id === selected.id);
      const reachable = live && getValidMoveTargets(state, live).some(c => same(c, site));
      const caption = id === 'catapult'
        ? `Catapult tower: hold it with a troop and it hurls stones at enemies within ${CATAPULT_RANGE} hexes`
        : 'Gatehouse: hold it with a troop and only your side can pass the wall';
      return { id, hex: site, caption: reachable ? `${caption} - move here to take it` : caption };
    }
    case 'fog': {
      if (!isFogOfWar(state) || state.turnNumber > 1) return null;
      const visible = getVisibleHexKeys(state, 'player');
      const hidden = state.hexGrid.filter(hex => !visible.has(`${hex.coordinates.q},${hex.coordinates.r}`) && !hex.isBase).map(hex => hex.coordinates);
      if (hidden.length === 0) return null;
      return { id, hex: nearestTo(hidden, castle)!, caption: 'Fog of war: you only see what your troops can see. Woods hide troops until you\'re beside them' };
    }
  }
};

// Most pressing first
const ORDER: MechanicId[] = ['bossPower', 'fog', 'felling', 'catapult', 'gate'];

export const useMechanicGuide = ({ active, gameState, selectedUnit }: { active: boolean; gameState: GameState; selectedUnit: Unit | null }): MechanicPointer | null => {
  const shownRef = useRef<{ id: MechanicId; turn: number } | null>(null);
  const planning = active && gameState.currentPhase === 'planning' && gameState.activePlayer === 'player';

  const pointer = useMemo(() => {
    if (!planning) return null;
    const seen = readSeen();
    // The one already being shown keeps the hand until it is done; once its turn is over it counts
    // as seen (the effect below records that just after)
    const current = shownRef.current;
    if (current && current.turn !== gameState.turnNumber) seen.add(current.id);
    const ids = current && current.turn === gameState.turnNumber ? [current.id] : ORDER.filter(id => !seen.has(id));
    for (const id of ids) {
      const next = pointerFor(id, gameState, selectedUnit);
      if (next) return next;
    }
    return null;
  }, [planning, gameState, selectedUnit]);

  useEffect(() => {
    const current = shownRef.current;
    // Done: the turn the hand showed it in is over, or the tree is being felled
    if (current && (current.turn !== gameState.turnNumber || !planning ||
      (current.id === 'felling' && gameState.pendingMoves.some(move => isFellOrder(gameState, move))))) {
      markSeen(current.id);
      shownRef.current = null;
    }
    if (pointer && !shownRef.current) shownRef.current = { id: pointer.id, turn: gameState.turnNumber };
  }, [pointer, gameState, planning]);

  return pointer && (!shownRef.current || shownRef.current.id === pointer.id) ? pointer : null;
};
