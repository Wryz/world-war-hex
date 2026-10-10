'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GameState } from '@/types/game';
import { MAX_SIDES, mirrorSymmetry } from '@/lib/pvp/arena';
import {
  DEFAULT_ROOM_SETTINGS, Room, RoomMember, RoomSettings, armyOf, buildRoomBattle, cleanName, closeRoom, createRoom, fetchRoom,
  getPlayerName, invitePath, joinRoom, memberSide, normaliseCode, removeMember, roomSettings, setPlayerName, sideCount, updateMember,
  updateRoom, watchRoom
} from '@/lib/pvp/room';
import { ensureSignedIn } from '@/lib/pvp/supabase';
import { getProfile, useHasHydrated, useProfile } from '@/lib/meta/profile';
import { CARD_CLASS, MenuShell, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../menu/MenuShell';
import { AttackIcon, CrownIcon } from '../game/icons';
import { SIDE_PALETTE } from '../game/sideColors';
import { ArenaSettingsForm } from './ArenaSettingsForm';
import { ArenaBattle } from './ArenaBattle';
import { OnlineBattle } from './OnlineBattle';

// How often the lobby looks the room over again, besides following its changes
const LOBBY_REFRESH_MS = 4000;

const INPUT = 'w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 ring-1 ring-white/10 placeholder:text-slate-500';

// Battles against friends online (and practice against the AI): /pvp, and /pvp?room=CODE for a room
export const PvpScreen: React.FC = () => {
  const searchParams = useSearchParams();
  const code = normaliseCode(searchParams.get('room') ?? '');
  const hydrated = useHasHydrated();
  if (!hydrated) return <div className="h-screen w-screen bg-sky-200" />;
  return code.length === 6 ? <RoomScreen key={code} code={code} /> : <PvpHome />;
};

// --- The front page: name, a new room, a code to join, or practice ---------------------------------

// Online rooms sign and seal what they send with the browser's crypto, which only a secure page has
const isSecure = () => typeof window === 'undefined' || (window.isSecureContext && !!window.crypto?.subtle);

const PvpHome: React.FC = () => {
  const router = useRouter();
  const [secure] = useState(isSecure);
  const [name, setName] = useState(() => getPlayerName());
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practice, setPractice] = useState<RoomSettings>({ ...DEFAULT_ROOM_SETTINGS, bots: 3 });
  const [practiceBattle, setPracticeBattle] = useState<{ state: GameState; key: number } | null>(null);

  const saveName = (value: string) => {
    setName(value);
    setPlayerName(value);
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      // (the name the room was opened under is the one to join it with)
      setPlayerName(cleanName(name));
      const room = await createRoom(cleanName(name), armyOf(getProfile()), DEFAULT_ROOM_SETTINGS);
      router.push(invitePath(room));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open a room');
      setBusy(false);
    }
  };

  const startPractice = () => {
    const me: RoomMember = { room_id: '', user_id: 'me', name: cleanName(name), seat: 0, color: 0, team: 0, army: armyOf(getProfile()) };
    setPracticeBattle(current => ({ state: buildRoomBattle([me], practice, Math.floor(Math.random() * 2 ** 31)), key: (current?.key ?? 0) + 1 }));
  };

  if (practiceBattle) {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <ArenaBattle
          key={practiceBattle.key}
          state={practiceBattle.state}
          viewer={memberSide({ seat: 0 })}
          onLeave={() => setPracticeBattle(null)}
          onPlayAgain={startPractice}
        />
      </div>
    );
  }

  return (
    <MenuShell title="Battle Friends" icon={<AttackIcon />}>
      <div className="mt-4 flex flex-col gap-4">
        <section className={`${CARD_CLASS} p-4`}>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Your name</span>
            <input className={`${INPUT} mt-1`} value={name} maxLength={24} placeholder="Warlord" onChange={event => saveName(event.target.value)} />
          </label>
          <p className="mt-2 text-xs text-slate-400">You bring the four cards in your Army. No coins are won or lost in these battles.</p>
        </section>

        <section className={`${CARD_CLASS} p-4`}>
          <h2 className="font-display text-2xl text-amber-300">Play online</h2>
          <p className="mt-1 text-sm text-slate-300">Open a room, send its link to up to seven friends, and start when everyone is in. The map grows with the number of players.</p>
          {!secure && <p className="mt-2 text-sm font-bold text-rose-300">Online battles need the game opened over https (or on localhost). Practice against the AI works anywhere.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className={PRIMARY_BUTTON} disabled={busy || !secure} onClick={create}>{busy ? 'Opening…' : 'Open a room'}</button>
            <span className="text-sm text-slate-400">or join with a code</span>
            <input
              className={`${INPUT} w-32 font-mono uppercase tracking-widest`}
              value={joinCode}
              placeholder="ABC234"
              onChange={event => setJoinCode(normaliseCode(event.target.value))}
              onKeyDown={event => { if (event.key === 'Enter' && joinCode.length === 6) router.push(invitePath(joinCode)); }}
            />
            <button className={SECONDARY_BUTTON} disabled={joinCode.length !== 6 || !secure} onClick={() => router.push(invitePath(joinCode))}>Join</button>
          </div>
          {error && <p className="mt-2 text-sm font-bold text-rose-300">{error}</p>}
        </section>

        <section className={`${CARD_CLASS} p-4`}>
          <h2 className="font-display text-2xl text-amber-300">Practice against the AI</h2>
          <p className="mt-1 mb-3 text-sm text-slate-300">The same battles, offline: a free-for-all or teams against AI kingdoms.</p>
          <ArenaSettingsForm settings={practice} players={1} onChange={setPractice} practice />
          <button className={`${PRIMARY_BUTTON} mt-4`} onClick={startPractice}>Fight!</button>
        </section>
      </div>
    </MenuShell>
  );
};

// --- A room: its lobby, then its battle ------------------------------------------------------------

const RoomScreen: React.FC<{ code: string }> = ({ code }) => {
  const router = useRouter();
  const [secure] = useState(isSecure);
  const profile = useProfile();
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(() => getPlayerName());
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  // The battle this player hosts, once it is built
  const [hostedBattle, setHostedBattle] = useState<GameState | null>(null);

  const refresh = useCallback(async () => {
    const { room: fresh, members: freshMembers } = await fetchRoom(code);
    setRoom(fresh);
    setMembers(freshMembers);
    return { room: fresh, members: freshMembers };
  }, [code]);

  // Sign in, then join (or come back to) the room
  const join = useCallback(async (asName: string) => {
    setError(null);
    try {
      const id = await ensureSignedIn();
      setUserId(id);
      await joinRoom(code, cleanName(asName), armyOf(getProfile()));
      // (the room is loaded before it counts as joined: a room missing after that has closed)
      await refresh();
      setJoined(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not join the room');
    }
  }, [code, refresh]);

  // A player already named joins straight away; someone new to the game is asked their name first
  const triedRef = useRef(false);
  useEffect(() => {
    if (!secure) {
      setError('Online battles need the game opened over https (or on localhost).');
      return;
    }
    if (triedRef.current || !getPlayerName()) return;
    triedRef.current = true;
    void join(getPlayerName());
  }, [join, secure]);

  // The lobby follows the room as it changes - and, in case a change is missed, looks again every few
  // seconds while the battle hasn't begun
  const status = room?.status;
  useEffect(() => {
    if (!joined) return;
    return watchRoom(code, () => { void refresh(); });
  }, [joined, code, refresh]);
  useEffect(() => {
    if (!joined || status !== 'lobby') return;
    const interval = setInterval(() => { void refresh(); }, LOBBY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [joined, status, refresh]);

  const me = members.find(member => member.user_id === userId);
  const isHost = !!room && room.host_id === userId;
  const settings = roomSettings(room);
  const host = members.find(member => member.user_id === room?.host_id);

  // Someone removed from the room (or the room closed) goes back to the front page
  useEffect(() => {
    if (joined && room === null) setError('This room has closed.');
    else if (joined && room && userId && members.length > 0 && !me) setError('You are no longer in this room.');
  }, [joined, room, members, me, userId]);

  const changeSettings = (next: RoomSettings) => {
    setRoom(current => (current ? { ...current, settings: next } : current));
    void updateRoom(code, { settings: next }).catch(failure => setError(failure.message));
  };

  const start = async () => {
    if (!isHost) return;
    const { members: latest } = await refresh();
    const battle = buildRoomBattle(latest, settings, Math.floor(Math.random() * 2 ** 31));
    setHostedBattle(battle);
    await updateRoom(code, { status: 'playing' }).catch(failure => setError(failure.message));
  };

  const leave = async () => {
    if (userId) {
      if (isHost && room?.status === 'lobby') await closeRoom(code);
      else if (room?.status === 'lobby') await removeMember(code, userId).catch(() => undefined);
    }
    router.push('/pvp');
  };

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}${invitePath(code)}` : invitePath(code);
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link and send it to your friends:', inviteLink);
    }
  };

  // The battle: hosted here, or followed from the host
  if (room && room.status !== 'lobby' && userId && me) {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <OnlineBattle
          code={code}
          userId={userId}
          viewer={memberSide(me)}
          isHost={isHost}
          members={members}
          hostedBattle={isHost ? hostedBattle : null}
          hostName={host?.name ?? 'The host'}
          hostId={room.host_id}
          onLeave={() => router.push('/pvp')}
        />
      </div>
    );
  }

  return (
    <MenuShell title="Battle Room" icon={<AttackIcon />} backHref="/pvp" onBack={() => { void leave(); }}>
      <div className="mt-4 flex flex-col gap-4">
        {error && (
          <div className={`${CARD_CLASS} p-4`}>
            <p className="font-bold text-rose-300">{error}</p>
            <button className={`${SECONDARY_BUTTON} mt-3`} onClick={() => router.push('/pvp')}>Back</button>
          </div>
        )}

        {!joined && !error && (
          <section className={`${CARD_CLASS} p-4`}>
            <h2 className="font-display text-2xl text-amber-300">Join room {code}</h2>
            <p className="mt-1 text-sm text-slate-300">You bring the four cards in your Army{profile.deck.length > 0 ? '' : ' (start the campaign to build one)'}.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input className={`${INPUT} max-w-xs`} value={name} maxLength={24} placeholder="Your name" onChange={event => { setName(event.target.value); setPlayerName(event.target.value); }} />
              <button className={PRIMARY_BUTTON} disabled={!name.trim()} onClick={() => { triedRef.current = true; void join(name); }}>Join</button>
            </div>
          </section>
        )}

        {joined && room && !error && (
          <>
            <section className={`${CARD_CLASS} p-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Room</span>
                <span className="font-mono text-2xl font-bold tracking-widest text-amber-300">{code}</span>
                <button className={`${SECONDARY_BUTTON} ml-auto`} onClick={copyInvite}>{copied ? 'Link copied!' : 'Copy invite link'}</button>
              </div>
              <p className="mt-1 break-all text-xs text-slate-500">{inviteLink}</p>
            </section>

            <section className={`${CARD_CLASS} p-4`}>
              <h2 className="font-display text-xl text-slate-100">Players ({members.length}/{MAX_SIDES})</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {members.map(member => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    isMe={member.user_id === userId}
                    isHostMember={member.user_id === room.host_id}
                    canEdit={isHost || member.user_id === userId}
                    canRemove={isHost && member.user_id !== userId}
                    teams={settings.mode === 'teams'}
                    takenColors={new Set(members.filter(other => other.user_id !== member.user_id).map(other => other.color))}
                    onChange={patch => { void updateMember(code, member.user_id, patch).then(refresh).catch(failure => setError(failure.message)); }}
                    onRemove={() => { void removeMember(code, member.user_id).then(refresh); }}
                  />
                ))}
                {Array.from({ length: Math.min(settings.bots, MAX_SIDES - members.length) }, (_, i) => (
                  <li key={`bot-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
                    <span className="h-3 w-3 rounded-full bg-slate-500" /> AI kingdom {i + 1}
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${CARD_CLASS} p-4`}>
              <h2 className="font-display mb-3 text-xl text-slate-100">Rules {isHost ? '' : <span className="text-sm text-slate-400">(set by {host?.name ?? 'the host'})</span>}</h2>
              <ArenaSettingsForm settings={settings} players={members.length} onChange={isHost ? changeSettings : undefined} />
            </section>

            {isHost ? (
              <StartButton members={members} settings={settings} onStart={start} />
            ) : (
              <p className="text-center text-sm font-bold text-slate-700">Waiting for {host?.name ?? 'the host'} to start the battle…</p>
            )}
          </>
        )}
      </div>
    </MenuShell>
  );
};

const StartButton: React.FC<{ members: RoomMember[]; settings: RoomSettings; onStart: () => void }> = ({ members, settings, onStart }) => {
  const sides = sideCount(members, settings);
  const teams = new Set(members.map(member => member.team ?? 0));
  const problem = sides < 2 ? 'Invite a friend, or add an AI side, to start'
    : settings.mode === 'teams' && teams.size < 2 && settings.bots === 0 ? 'Put the players in at least two teams'
      : settings.mapStyle === 'mirrored' && mirrorSymmetry(sides) === 1 ? `A map can't be mirrored for ${sides} sides: pick a random map`
        : null;
  return (
    <div className="flex flex-col items-center gap-1">
      <button className={PRIMARY_BUTTON} disabled={!!problem} onClick={onStart}>Start the battle</button>
      {problem && <p className="text-sm font-bold text-slate-700">{problem}</p>}
    </div>
  );
};

const MemberRow: React.FC<{
  member: RoomMember;
  isMe: boolean;
  isHostMember: boolean;
  canEdit: boolean;
  canRemove: boolean;
  teams: boolean;
  takenColors: Set<number>;
  onChange: (patch: Partial<Pick<RoomMember, 'color' | 'team'>>) => void;
  onRemove: () => void;
}> = ({ member, isMe, isHostMember, canEdit, canRemove, teams, takenColors, onChange, onRemove }) => {
  const color = SIDE_PALETTE[member.color % SIDE_PALETTE.length];
  const cards = useMemo(() => (member.army.deck ?? []).length, [member.army]);
  return (
    <li className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm ${isMe ? 'bg-slate-700/80' : 'bg-slate-800/70'}`}>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color.color }} />
      <span className="font-bold text-slate-100">{member.name}</span>
      {isHostMember && <span className="flex items-center gap-0.5 text-xs text-amber-300"><CrownIcon /> host</span>}
      {isMe && <span className="text-xs text-slate-400">(you)</span>}
      <span className="text-xs text-slate-500">{cards} cards</span>
      <span className="ml-auto flex items-center gap-2">
        {canEdit && (
          <select
            className="rounded bg-slate-900 px-1 py-0.5 text-xs text-slate-200"
            value={member.color}
            aria-label="Colour"
            onChange={event => onChange({ color: Number(event.target.value) })}
          >
            {SIDE_PALETTE.map((entry, index) => (
              <option key={entry.name} value={index} disabled={takenColors.has(index)}>{entry.name}</option>
            ))}
          </select>
        )}
        {teams && (
          <select
            className="rounded bg-slate-900 px-1 py-0.5 text-xs text-slate-200 disabled:opacity-70"
            value={member.team ?? 0}
            disabled={!canEdit}
            aria-label="Team"
            onChange={event => onChange({ team: Number(event.target.value) })}
          >
            {[0, 1, 2, 3].map(team => <option key={team} value={team}>Team {team + 1}</option>)}
          </select>
        )}
        {canRemove && <button className="rounded px-1.5 text-xs font-bold text-rose-300 hover:bg-rose-900/40" onClick={onRemove}>Remove</button>}
      </span>
    </li>
  );
};

