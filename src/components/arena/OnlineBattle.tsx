'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, PlayerType } from '@/types/game';
import { BattleChannel, RoomMember, fetchSecrets, memberSide, openBattleChannel, updateRoom } from '@/lib/pvp/room';
import { BattleLink, TurnOrders } from '../game/handlers/GameEventHandlers';
import { CARD_CLASS, PRIMARY_BUTTON, SKY_BACKGROUND } from '../menu/MenuShell';
import { ArenaBattle, ArenaBattleControls } from './ArenaBattle';

// The host keeps the battle it runs on this device, so a reload picks it up where it was
const hostedKey = (code: string) => `hexhordes.hostedBattle.${code}`;
const loadHosted = (code: string): GameState | null => {
  try {
    const raw = localStorage.getItem(hostedKey(code));
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
};
const saveHosted = (code: string, state: GameState) => {
  try {
    localStorage.setItem(hostedKey(code), JSON.stringify(state));
  } catch {
    // (a reload would lose it)
  }
};

// How often a guest without the battle yet asks the host for it
const HELLO_EVERY_MS = 3000;

interface OnlineBattleProps {
  code: string;
  userId: string;
  viewer: PlayerType;
  isHost: boolean;
  members: RoomMember[];
  // (host) the battle just built, as it starts
  hostedBattle: GameState | null;
  hostName: string;
  hostId: string;
  onLeave: () => void;
}

// A room's battle: the host runs it and passes every step on; everyone else follows it and sends
// their orders to the host
export const OnlineBattle: React.FC<OnlineBattleProps> = props =>
  props.isHost ? <HostedBattle {...props} /> : <GuestBattle {...props} />;

// --- The host ----------------------------------------------------------------------------------------

const HostedBattle: React.FC<OnlineBattleProps> = ({ code, userId, viewer, members, hostedBattle, onLeave }) => {
  const [initial] = useState(() => hostedBattle ?? loadHosted(code));
  const controlsRef = useRef<ArenaBattleControls | null>(null);
  const channelRef = useRef<BattleChannel | null>(null);
  const secretsRef = useRef<Map<string, string>>(new Map());
  const [online, setOnline] = useState<string[]>([]);
  // States go out one after another, in the order the battle reached them
  const sendingRef = useRef<Promise<void>>(Promise.resolve());

  // Who plays which side
  const sideOf = useMemo(() => new Map(members.map(member => [member.user_id, memberSide(member)])), [members]);
  const nameOf = useMemo(() => new Map(members.map(member => [memberSide(member), member.name])), [members]);
  const remoteSides = useMemo(() => new Set(members.filter(member => member.user_id !== userId).map(memberSide)), [members, userId]);

  const send = (state: GameState) => {
    saveHosted(code, state);
    sendingRef.current = sendingRef.current.then(() => channelRef.current?.sendState(state)).catch(error => console.error('Could not send the battle', error));
    if (state.currentPhase === 'gameOver') void updateRoom(code, { status: 'finished' }).catch(() => undefined);
  };

  // Orders and resignations count only with the sender's own secret, for the sender's own side
  const verified = async (from: string, secret: string): Promise<PlayerType | null> => {
    if (secretsRef.current.get(from) !== secret) secretsRef.current = await fetchSecrets(code);
    return secretsRef.current.get(from) === secret ? sideOf.get(from) ?? null : null;
  };

  useEffect(() => {
    if (!initial) return;
    void fetchSecrets(code).then(secrets => { secretsRef.current = secrets; });
    const channel = openBattleChannel(code, userId, {
      onOrders: (from, secret, orders: TurnOrders) => {
        void verified(from, secret).then(side => {
          if (side && side === orders.side) controlsRef.current?.applyRemoteOrders(orders);
        });
      },
      onResign: (from, secret) => {
        void verified(from, secret).then(side => { if (side) controlsRef.current?.resignSide(side); });
      },
      onHello: () => send(controlsRef.current?.getState() ?? initial),
      onPresence: setOnline
    });
    channelRef.current = channel;
    // (everyone waiting gets the battle as it begins)
    send(initial);
    return () => {
      channel.close();
      channelRef.current = null;
    };
    // The channel lives as long as the battle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, userId]);

  const link: BattleLink = useMemo(() => ({
    role: 'host',
    onState: send,
    isRemoteSide: side => remoteSides.has(side)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [remoteSides]);

  if (!initial) {
    return <Notice title="This battle can't go on" text="The battle was being run on another device, or its progress was lost." onLeave={onLeave} />;
  }

  const away = [...remoteSides].filter(side => {
    const member = members.find(other => memberSide(other) === side);
    return member && !online.includes(member.user_id);
  });
  const status = away.length > 0 ? `${away.map(side => nameOf.get(side)).join(', ')} ${away.length === 1 ? 'is' : 'are'} away: their turns pass after the timer` : null;

  return (
    <ArenaBattle
      state={initial}
      viewer={viewer}
      link={link}
      controlsRef={controlsRef}
      status={status}
      onLeave={() => {
        if (controlsRef.current?.getState().currentPhase !== 'gameOver' &&
          !window.confirm('You are running this battle: if you leave, it stops for everyone until you come back. Leave?')) return;
        onLeave();
      }}
    />
  );
};

// --- Everyone else -----------------------------------------------------------------------------------

const GuestBattle: React.FC<OnlineBattleProps> = ({ code, userId, viewer, hostName, hostId, onLeave }) => {
  const [first, setFirst] = useState<GameState | null>(null);
  const controlsRef = useRef<ArenaBattleControls | null>(null);
  const channelRef = useRef<BattleChannel | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const firstRef = useRef<GameState | null>(null);

  useEffect(() => {
    const channel = openBattleChannel(code, userId, {
      onState: state => {
        if (!firstRef.current) {
          firstRef.current = state;
          setFirst(state);
          return;
        }
        controlsRef.current?.receiveState(state);
      },
      onPresence: setOnline
    });
    channelRef.current = channel;
    // (asking until the battle arrives)
    const asking = setInterval(() => { if (!firstRef.current) channel.sendHello(); }, HELLO_EVERY_MS);
    return () => {
      clearInterval(asking);
      channel.close();
      channelRef.current = null;
    };
  }, [code, userId]);

  const link: BattleLink = useMemo(() => ({
    role: 'guest',
    sendOrders: orders => channelRef.current?.sendOrders(orders)
  }), []);

  if (!first) {
    return <Notice title="Joining the battle…" text={`Waiting for ${hostName}, who runs this battle, to send it.`} onLeave={onLeave} />;
  }

  const hostAway = online.length > 0 && !online.includes(hostId);
  return (
    <ArenaBattle
      state={first}
      viewer={viewer}
      link={link}
      controlsRef={controlsRef}
      status={hostAway ? `${hostName} (who runs the battle) is away - waiting for them to come back` : null}
      onGuestResign={() => channelRef.current?.sendResign()}
      onLeave={onLeave}
    />
  );
};

const Notice: React.FC<{ title: string; text: string; onLeave: () => void }> = ({ title, text, onLeave }) => (
  <div className="flex h-full w-full items-center justify-center px-4" style={{ background: SKY_BACKGROUND }}>
    <div className={`${CARD_CLASS} max-w-md p-6 text-center`}>
      <div className="font-display text-2xl text-amber-300">{title}</div>
      <p className="mt-2 text-sm text-slate-300">{text}</p>
      <button className={`${PRIMARY_BUTTON} mt-4`} onClick={onLeave}>Back</button>
    </div>
  </div>
);
