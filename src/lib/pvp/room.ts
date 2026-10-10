import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameState, PlayerType } from '@/types/game';
import { getSideView, isFogOfWar, isUnitVisibleTo, syncHexUnits } from '../game/gameState';
import { areAllies, getAllUnits } from '../game/sides';
import { TroopId } from '../game/troops';
import { Trees } from '../game/lineages';
import { Profile, createProfile, sanitizeProfile } from '../meta/profile';
import { Difficulty } from '../campaign/battleSetup';
import {
  ArenaSideSpec, ArenaSpec, DEFAULT_FAIR_LEVEL, DEFAULT_MAX_ROUNDS, DEFAULT_TURN_SECONDS, MapStyle, MAX_SIDES, WeatherChoice,
  aiSideSpec, buildArenaBattle, sideId, AI_NAMES
} from './arena';
import { ensureSignedIn, getSupabase } from './supabase';
import type { TurnOrders } from '@/components/game/handlers/GameEventHandlers';

// Online rooms (see supabase/migrations): a host opens a room and shares its invite link, friends join
// with the army saved on their own device, and the host starts the battle. The host's game runs it
// (lib/pvp/arena, the AI's sides included) and passes every step on over the room's private channel;
// everyone else sends their orders back to the host, with a secret only the host can check.

export interface RoomSettings {
  mode: 'ffa' | 'teams';
  weather: WeatherChoice;
  mapStyle: MapStyle;
  // Fair mode: every card at the same level
  fair: boolean;
  fairLevel: number;
  fog: boolean;
  turnSeconds: number;
  maxRounds: number;
  // Sides the AI plays, to make up the numbers, and how well
  bots: number;
  botDifficulty: Difficulty;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  mode: 'ffa',
  weather: 'none',
  mapStyle: 'random',
  fair: true,
  fairLevel: DEFAULT_FAIR_LEVEL,
  fog: false,
  turnSeconds: DEFAULT_TURN_SECONDS,
  maxRounds: DEFAULT_MAX_ROUNDS,
  bots: 0,
  botDifficulty: 'medium'
};

// The cards a member brings, from the profile saved on their device
export interface Army {
  deck: TroopId[];
  cards: Partial<Record<TroopId, number>>;
  trees: Trees;
}

export interface Room {
  id: string;
  host_id: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: Partial<RoomSettings>;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  name: string;
  seat: number;
  color: number;
  team: number | null;
  army: Partial<Army>;
}

// The army a profile brings online
export const armyOf = (profile: Profile): Army => ({ deck: [...profile.deck], cards: { ...profile.cards }, trees: profile.trees });

// An army as it arrived from someone else's device, made valid: real cards at real levels, a real
// deck (checked the same way as an imported save)
export const sanitizeArmy = (raw: Partial<Army> | null | undefined): Army => {
  const profile = sanitizeProfile({ version: createProfile().version, lineagesMerged: true, cards: raw?.cards, deck: raw?.deck, trees: raw?.trees }) ?? createProfile();
  return { deck: profile.deck.length > 0 ? profile.deck : createProfile().deck, cards: profile.cards, trees: profile.trees };
};

export const roomSettings = (room: Pick<Room, 'settings'> | null): RoomSettings => ({ ...DEFAULT_ROOM_SETTINGS, ...(room?.settings ?? {}) });

// --- The player's name and secrets on this device -------------------------------------------------

const NAME_KEY = 'hexhordes.playerName';
const SECRETS_KEY = 'hexhordes.roomSecrets';

export const getPlayerName = (): string => {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};

export const setPlayerName = (name: string) => {
  try {
    localStorage.setItem(NAME_KEY, name.slice(0, 24));
  } catch {
    // (it just won't be remembered)
  }
};

export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, 24) || 'Warlord';

// 32 random hex digits
const randomSecret = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

// Each room's secret for this device, kept so a member coming back can still give orders (and kept
// in memory too, so a member whose device can't store it still sends the secret it joined with)
const secretsInMemory: Record<string, string> = {};
const roomSecret = (code: string): string => {
  if (secretsInMemory[code]) return secretsInMemory[code];
  let secrets: Record<string, string> = {};
  try {
    secrets = JSON.parse(localStorage.getItem(SECRETS_KEY) ?? '{}');
  } catch {
    secrets = {};
  }
  if (!secrets[code]) {
    secrets[code] = randomSecret();
    // (only the latest few rooms are kept)
    const recent = Object.entries(secrets).slice(-20);
    try {
      localStorage.setItem(SECRETS_KEY, JSON.stringify(Object.fromEntries(recent)));
    } catch {
      // (a member who can't keep it can still play from this page)
    }
  }
  secretsInMemory[code] = secrets[code];
  return secrets[code];
};
export const mySecret = roomSecret;

// Orders and resignations go out signed with the sender's secret (never the secret itself: everyone
// in the room hears them), so only the host - who can read every member's secret - can check them
const signature = async (secret: string, message: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const signedMessage = (code: string, userId: string, event: string, body: string) => `${code}|${userId}|${event}|${body}`;

// --- Rooms ------------------------------------------------------------------------------------------

export const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export const invitePath = (code: string) => `/pvp?room=${code}`;

// Open a room; the host takes its first seat
export const createRoom = async (name: string, army: Army, settings: RoomSettings): Promise<string> => {
  await ensureSignedIn();
  const supabase = getSupabase();
  // (the room's code isn't known until it is made, so its secret is made first and kept under it)
  const secret = randomSecret();
  const { data, error } = await supabase.rpc('create_room', { p_name: cleanName(name), p_army: army, p_settings: settings, p_secret: secret });
  if (error || typeof data !== 'string') throw new Error(error?.message ?? 'Could not open a room');
  remember(data, secret);
  return data;
};

const remember = (code: string, secret: string) => {
  secretsInMemory[code] = secret;
  try {
    const secrets = JSON.parse(localStorage.getItem(SECRETS_KEY) ?? '{}');
    secrets[code] = secret;
    localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
  } catch {
    // (see roomSecret)
  }
};

// Join a room from its invite (or come back to one), returning the seat
export const joinRoom = async (code: string, name: string, army: Army): Promise<number> => {
  await ensureSignedIn();
  const { data, error } = await getSupabase().rpc('join_room', { p_code: code, p_name: cleanName(name), p_army: army, p_secret: roomSecret(code) });
  if (error) throw new Error(error.message);
  return Number(data);
};

export const fetchRoom = async (code: string): Promise<{ room: Room | null; members: RoomMember[] }> => {
  const supabase = getSupabase();
  const [rooms, members] = await Promise.all([
    supabase.from('rooms').select('id, host_id, status, settings').eq('id', code).maybeSingle(),
    supabase.from('room_members').select('room_id, user_id, name, seat, color, team, army').eq('room_id', code).order('seat')
  ]);
  return { room: (rooms.data as Room | null) ?? null, members: (members.data as RoomMember[] | null) ?? [] };
};

// (host) The room's settings, and whether it is in its lobby, playing or done
export const updateRoom = async (code: string, patch: Partial<Pick<Room, 'status' | 'settings'>>) => {
  const { error } = await getSupabase().from('rooms').update(patch).eq('id', code);
  if (error) throw new Error(error.message);
};

// A member's name, army, colour or team (their own, or anyone's for the host)
export const updateMember = async (code: string, userId: string, patch: Partial<Pick<RoomMember, 'name' | 'army' | 'color' | 'team'>>) => {
  const { error } = await getSupabase().from('room_members').update(patch).eq('room_id', code).eq('user_id', userId);
  if (error) throw new Error(error.message);
};

// Leave a room (or, for the host, remove someone from it)
export const removeMember = async (code: string, userId: string) => {
  const { error } = await getSupabase().from('room_members').delete().eq('room_id', code).eq('user_id', userId);
  if (error) throw new Error(error.message);
};

// (host) Close the room for good
export const closeRoom = async (code: string) => {
  await getSupabase().from('rooms').delete().eq('id', code);
};

// (host) Every member's secret, to check the orders they send
export const fetchSecrets = async (code: string): Promise<Map<string, string>> => {
  const { data } = await getSupabase().from('room_secrets').select('user_id, secret').eq('room_id', code);
  return new Map((data ?? []).map((row: { user_id: string; secret: string }) => [row.user_id, row.secret]));
};

// Follow a room's lobby: called with the room and its members whenever either changes
export const watchRoom = (code: string, onChange: () => void): (() => void) => {
  const channel = getSupabase()
    .channel(`lobby:${code}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${code}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${code}` }, onChange)
    .subscribe();
  return () => { void getSupabase().removeChannel(channel); };
};

// --- The battle -------------------------------------------------------------------------------------

// Each member's side: by seat (the AI's sides come after everyone's)
export const memberSide = (member: Pick<RoomMember, 'seat'>): PlayerType => sideId(member.seat);
const botSide = (index: number): PlayerType => `ai${index + 1}`;

// How many sides a room's battle will have
export const sideCount = (members: RoomMember[], settings: RoomSettings) => Math.min(MAX_SIDES, members.length + settings.bots);

// The battle a room's members (and its AI sides) fight, as the host builds it
export const buildRoomBattle = (members: RoomMember[], settings: RoomSettings, seed: number): GameState => {
  const seated = [...members].sort((a, b) => a.seat - b.seat).slice(0, MAX_SIDES);
  const bots = Math.max(0, Math.min(settings.bots, MAX_SIDES - seated.length));
  const usedColors = new Set(seated.map(member => member.color));
  const freeColors = Array.from({ length: MAX_SIDES }, (_, color) => color).filter(color => !usedColors.has(color));
  const teams = settings.mode === 'teams';
  const sides: ArenaSideSpec[] = seated.map(member => {
    const army = sanitizeArmy(member.army);
    return { id: memberSide(member), name: member.name, color: member.color, team: teams ? member.team ?? 0 : undefined, ...army };
  });
  // The AI's sides join the smallest teams; they field rival kingdoms at the fair level, or at about
  // the level of the players' cards
  const level = settings.fair ? settings.fairLevel
    : Math.max(1, Math.round(sides.reduce((sum, side) => sum + averageLevel(side), 0) / Math.max(1, sides.length)));
  for (let i = 0; i < bots; i++) {
    const teamSizes = new Map<number, number>();
    for (const side of sides) if (side.team !== undefined) teamSizes.set(side.team, (teamSizes.get(side.team) ?? 0) + 1);
    if (teams && teamSizes.size < 2) teamSizes.set(teamSizes.has(0) ? 1 : 0, 0);
    const team = teams ? [...teamSizes].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0][0] : undefined;
    sides.push(aiSideSpec(botSide(i), AI_NAMES[i % AI_NAMES.length], freeColors[i] ?? i, level, seed + 31 * (i + 1), team));
  }
  // The turn passes from team to team (in a free-for-all, round the seats)
  const order = teams ? interleaveTeams(sides) : sides;
  const spec: ArenaSpec = {
    seed,
    sides: order,
    weather: settings.weather,
    mapStyle: settings.mapStyle,
    fairLevel: settings.fair ? settings.fairLevel : undefined,
    fog: settings.fog,
    difficulty: settings.botDifficulty,
    turnSeconds: settings.turnSeconds,
    maxRounds: settings.maxRounds
  };
  return buildArenaBattle(spec);
};

const averageLevel = (side: ArenaSideSpec) =>
  side.deck.reduce((sum, id) => sum + (side.cards[id] ?? 1), 0) / Math.max(1, side.deck.length);

// Sides in turn order taking turns between the teams: the first of each team, then the second...
const interleaveTeams = (sides: ArenaSideSpec[]): ArenaSideSpec[] => {
  const byTeam = new Map<number, ArenaSideSpec[]>();
  for (const side of sides) byTeam.set(side.team ?? -1, [...(byTeam.get(side.team ?? -1) ?? []), side]);
  const teams = [...byTeam.values()];
  const order: ArenaSideSpec[] = [];
  for (let round = 0; order.length < sides.length; round++) {
    for (const team of teams) if (team[round]) order.push(team[round]);
  }
  return order;
};

// --- Sending the battle over the channel -------------------------------------------------------------

// The battle as one side may know it, in the fog of war: the enemy troops it can't see are left out,
// and so is anything else that would give them away (what its enemies have ordered, what other sides
// remember seeing, their hands, and blows landing out of its sight). Without fog, once the side is out
// of the battle, or once it is over, it sees everything.
export const sideViewOf = (state: GameState, side: PlayerType): GameState => {
  if (!isFogOfWar(state) || state.players[side]?.eliminated || state.currentPhase === 'gameOver') return state;
  const view = getSideView(state, side);
  const friendly = (owner: PlayerType | undefined) => areAllies(state, owner, side);
  const ordersOf = (playerId: string) => friendly(Object.values(state.players).find(player => player.id === playerId)?.type);
  return {
    ...view,
    pendingMoves: state.pendingMoves.filter(move => ordersOf(move.playerId)),
    pendingPurchases: state.pendingPurchases.filter(purchase => ordersOf(purchase.playerId)),
    sightings: Object.fromEntries(Object.entries(state.sightings ?? {}).filter(([owner]) => friendly(owner))),
    decks: state.decks && Object.fromEntries(Object.entries(state.decks).filter(([owner]) => owner === side)),
    healthEvents: state.healthEvents?.filter(event => !event.unit || isUnitVisibleTo(state, side, event.unit)),
    knownUnitIds: getAllUnits(state).map(unit => unit.id)
  };
};

// A state sent to one member only is sealed with a key from their secret (AES-GCM), so the others in
// the room - who hear every message - can't read it
const sealingKey = async (code: string, secret: string): Promise<CryptoKey> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${code}|${secret}`));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};
const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), char => char.charCodeAt(0));
const seal = async (key: CryptoKey, text: string): Promise<{ data: string; iv: string }> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  return { data: toBase64(sealed), iv: toBase64(iv) };
};
const unseal = async (key: CryptoKey, data: string, iv: string): Promise<string> =>
  new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(data)));

// (host) Who the battle is sent to, each with the side they play and the secret their copy is sealed with
export interface StateRecipient {
  userId: string;
  side: PlayerType;
  secret: string;
}

// A state made small to send: the troops on each hex are left out (they follow from each side's troops)
// and the whole thing is gzipped
const packState = async (state: GameState): Promise<string> => {
  const slim = { ...state, hexGrid: state.hexGrid.map(hex => (hex.unit ? { ...hex, unit: undefined } : hex)) };
  const json = JSON.stringify(slim);
  if (typeof CompressionStream === 'undefined') return `j:${json}`;
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return `z:${toBase64(bytes)}`;
};

const unpackState = async (packed: string): Promise<GameState> => {
  let json: string;
  if (packed.startsWith('j:')) json = packed.slice(2);
  else {
    const stream = new Blob([fromBase64(packed.slice(2))]).stream().pipeThrough(new DecompressionStream('gzip'));
    json = await new Response(stream).text();
  }
  const state = JSON.parse(json) as GameState;
  syncHexUnits(state);
  return state;
};

export interface BattleChannelHandlers {
  // (guests) the battle as the host has it
  onState?: (state: GameState, seq: number) => void;
  // (host) a member's orders or resignation, with a check of its signature against a member's secret
  onOrders?: (userId: string, orders: TurnOrders, signedWith: (secret: string) => Promise<boolean>) => void;
  onResign?: (userId: string, signedWith: (secret: string) => Promise<boolean>) => void;
  // (host) someone (back) in the room asks for the battle as it stands
  onHello?: (userId: string) => void;
  // Who is in the room right now
  onPresence?: (userIds: string[]) => void;
}

export interface BattleChannel {
  // (host) the battle to everyone - in the fog, each recipient its own side's view of it
  sendState: (state: GameState, recipients?: StateRecipient[]) => Promise<void>;
  sendOrders: (orders: TurnOrders) => void;
  sendResign: () => void;
  sendHello: () => void;
  close: () => void;
}

// The room's private channel for its battle (only members can use it: see the migration)
export const openBattleChannel = (code: string, userId: string, handlers: BattleChannelHandlers): BattleChannel => {
  const supabase = getSupabase();
  const secret = roomSecret(code);
  const ownKey = sealingKey(code, secret);
  let seq = 0;
  // States arrive in the order they were sent, unpacked one after another
  let unpacking: Promise<void> = Promise.resolve();
  const channel: RealtimeChannel = supabase.channel(`room:${code}`, {
    config: { private: true, broadcast: { self: false }, presence: { key: userId } }
  });
  channel
    .on('broadcast', { event: 'state' }, ({ payload }) => {
      const { data, seq: sent, to, iv } = payload as { data: string; seq: number; to?: string; iv?: string };
      // (a copy sealed for someone else isn't ours to read)
      if (to && to !== userId) return;
      unpacking = unpacking.then(async () => {
        try {
          const packed = to && iv ? await unseal(await ownKey, data, iv) : data;
          handlers.onState?.(await unpackState(packed), sent);
        } catch (error) {
          console.error('Could not read the battle from the host', error);
        }
      });
    })
    .on('broadcast', { event: 'orders' }, ({ payload }) => {
      const { userId: from, body, sig } = payload as { userId: string; body: string; sig: string };
      let orders: TurnOrders;
      try {
        orders = JSON.parse(body) as TurnOrders;
      } catch {
        return;
      }
      handlers.onOrders?.(from, orders, async memberSecret => (await signature(memberSecret, signedMessage(code, from, 'orders', body))) === sig);
    })
    .on('broadcast', { event: 'resign' }, ({ payload }) => {
      const { userId: from, sig } = payload as { userId: string; sig: string };
      handlers.onResign?.(from, async memberSecret => (await signature(memberSecret, signedMessage(code, from, 'resign', ''))) === sig);
    })
    .on('broadcast', { event: 'hello' }, ({ payload }) => handlers.onHello?.((payload as { userId: string }).userId))
    .on('presence', { event: 'sync' }, () => handlers.onPresence?.(Object.keys(channel.presenceState())))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ userId, at: Date.now() });
        void channel.send({ type: 'broadcast', event: 'hello', payload: { userId } });
      }
    });
  return {
    sendState: async (state, recipients) => {
      seq++;
      // (without fog, or once the battle is over, everyone gets the same)
      if (!recipients || !isFogOfWar(state) || state.currentPhase === 'gameOver') {
        await channel.send({ type: 'broadcast', event: 'state', payload: { data: await packState(state), seq } });
        return;
      }
      for (const recipient of recipients) {
        const view = sideViewOf(state, recipient.side);
        const sealed = await seal(await sealingKey(code, recipient.secret), await packState(view));
        await channel.send({ type: 'broadcast', event: 'state', payload: { ...sealed, seq, to: recipient.userId } });
      }
    },
    sendOrders: orders => {
      const body = JSON.stringify(orders);
      void signature(secret, signedMessage(code, userId, 'orders', body))
        .then(sig => channel.send({ type: 'broadcast', event: 'orders', payload: { userId, body, sig } }));
    },
    sendResign: () => {
      void signature(secret, signedMessage(code, userId, 'resign', ''))
        .then(sig => channel.send({ type: 'broadcast', event: 'resign', payload: { userId, sig } }));
    },
    sendHello: () => { void channel.send({ type: 'broadcast', event: 'hello', payload: { userId } }); },
    close: () => { void supabase.removeChannel(channel); }
  };
};
