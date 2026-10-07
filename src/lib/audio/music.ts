// Background music: procedurally synthesised tracks and stingers, crossfaded and mixed through the
// Web Audio API. Any `/music/<name>.mp3` dropped into `public/music/` (and listed in its manifest.json) replaces its synthesised
// version. Nothing touches `window` until it is used, so this module is safe to import on the server.

import { useEffect, useSyncExternalStore } from 'react';
import { isMuted, subscribeToMute } from '@/components/game/utils/SoundPlayer';
import { FileTrackPlayer, MusicMixer, SynthTrackPlayer, fadeIn, fadeOut, type TrackPlayer } from './engine';
import { compileTrack, type CompiledTrack, type Layer } from './score';
import { STINGERS, TRACKS, type MusicTrack, type Stinger } from './tracks';

export type { MusicTrack, Stinger } from './tracks';

const VOLUME_STORAGE_KEY = 'wwhMusicVolume';
const DEFAULT_VOLUME = 0.5;
const MUSIC_LEVEL = 0.6;           // Full volume still sits under the sound effects
const CROSSFADE_SECONDS = 1.2;
const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_SECONDS = 0.15;
const START_DELAY_SECONDS = 0.05;
const REVERB_TAIL_SECONDS = 3;     // How long a finished synth player keeps ringing out
const SUSPEND_DELAY_MS = 350;      // Lets the master fade finish before the context is suspended

// ---- Volume ----

let volume: number | null = null;
const volumeListeners = new Set<() => void>();

export const getMusicVolume = (): number => {
  if (volume === null) {
    volume = DEFAULT_VOLUME;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
        if (stored !== null && Number.isFinite(Number(stored))) volume = Math.min(1, Math.max(0, Number(stored)));
      } catch {
        // Storage can be unavailable (e.g. private mode); the default applies
      }
    }
  }
  return volume;
};

export const setMusicVolume = (value: number) => {
  volume = Math.min(1, Math.max(0, value));
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
  } catch {
    // Not remembered across visits, but still applies now
  }
  if (runtime && shouldRun()) runtime.mixer.setLevel(volume * MUSIC_LEVEL, 0.1);
  volumeListeners.forEach(listener => listener());
};

const subscribeToVolume = (listener: () => void) => {
  volumeListeners.add(listener);
  return () => {
    volumeListeners.delete(listener);
  };
};

// Current music volume for React components
export const useMusicVolume = () => useSyncExternalStore(subscribeToVolume, getMusicVolume, () => DEFAULT_VOLUME);

// ---- Audio context lifecycle ----

interface Runtime {
  ctx: AudioContext;
  mixer: MusicMixer;
}

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

let runtime: Runtime | null = null;
let audioUnlocked = false;
let unlockListening = false;
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

const shouldRun = () => !isMuted() && document.visibilityState !== 'hidden';

// The context is only created once the page has had a user gesture, which avoids autoplay warnings
const getRuntime = (): Runtime | null => {
  if (runtime || typeof window === 'undefined') return runtime;
  if (!audioUnlocked && !navigator.userActivation?.hasBeenActive) {
    listenForUnlock();
    return null;
  }
  const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AudioContextClass) return null;

  const ctx = new AudioContextClass();
  runtime = { ctx, mixer: new MusicMixer(ctx) };
  subscribeToMute(updateRunState);
  document.addEventListener('visibilitychange', updateRunState);
  updateRunState();
  if (ctx.state !== 'running') listenForUnlock();
  return runtime;
};

// Browsers keep audio blocked until the player interacts, so retry on their first click or key press
const listenForUnlock = () => {
  if (unlockListening) return;
  unlockListening = true;
  const unlock = () => {
    audioUnlocked = true;
    const rt = getRuntime();
    if (!rt) return;
    const finish = () => {
      if (rt.ctx.state !== 'running') return;
      UNLOCK_EVENTS.forEach(type => window.removeEventListener(type, unlock, true));
      unlockListening = false;
    };
    if (shouldRun()) rt.ctx.resume().then(finish, () => {});
    else finish();
    activePlayers().forEach(player => {
      if (player instanceof FileTrackPlayer) player.retry();
    });
    syncPlayback();
  };
  UNLOCK_EVENTS.forEach(type => window.addEventListener(type, unlock, true));
};

let suspendTimer: ReturnType<typeof setTimeout> | null = null;

// Muting or hiding the tab fades the music out and then suspends the context so it costs no CPU
const updateRunState = () => {
  if (!runtime) return;
  const { ctx, mixer } = runtime;
  if (suspendTimer !== null) clearTimeout(suspendTimer);
  suspendTimer = null;

  if (shouldRun()) {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    activePlayers().forEach(player => player.resume());
    mixer.setLevel(getMusicVolume() * MUSIC_LEVEL);
    return;
  }
  mixer.setLevel(0, 0.25);
  suspendTimer = setTimeout(() => {
    suspendTimer = null;
    if (shouldRun()) return;
    activePlayers().forEach(player => player.pause());
    ctx.suspend().catch(() => {});
  }, SUSPEND_DELAY_MS);
};

// ---- Players and scheduler ----

interface Retiring {
  player: TrackPlayer;
  until: number; // Context time after which the player is silent and can be disposed
}

let current: { track: MusicTrack; player: TrackPlayer } | null = null;
let retiring: Retiring[] = [];
let schedulerId: ReturnType<typeof setInterval> | null = null;

const activePlayers = (): TrackPlayer[] => [...(current ? [current.player] : []), ...retiring.map(entry => entry.player)];

const tick = () => {
  if (!runtime) return;
  const now = runtime.ctx.currentTime;
  for (const player of activePlayers()) player.schedule(now + LOOKAHEAD_SECONDS);

  retiring = retiring.filter(entry => {
    if (now < entry.until) return true;
    entry.player.dispose();
    return false;
  });
  if (!current && retiring.length === 0 && schedulerId !== null) {
    clearInterval(schedulerId);
    schedulerId = null;
  }
};

const ensureScheduler = () => {
  if (schedulerId === null) schedulerId = setInterval(tick, SCHEDULER_INTERVAL_MS);
  tick();
};

const compiledTracks = new Map<string, CompiledTrack | null>();

// Compiled lazily and cached; a broken score is logged and plays silence rather than throwing
const getCompiled = (name: MusicTrack | Stinger): CompiledTrack | null => {
  if (!compiledTracks.has(name)) {
    const def = name in TRACKS ? TRACKS[name as MusicTrack] : STINGERS[name as Stinger];
    try {
      compiledTracks.set(name, compileTrack(def, name));
    } catch (error) {
      console.error(`[music] Could not compile "${name}"`, error);
      compiledTracks.set(name, null);
    }
  }
  return compiledTracks.get(name) ?? null;
};

// ---- File overrides ----

const fileBuffers = new Map<string, Promise<AudioBuffer | null>>();

// The music files present in public/music, listed in its manifest.json (read once per page load),
// so the game never requests files that aren't there
let manifest: Promise<string[]> | null = null;
const readManifest = () => {
  manifest ??= fetch('/music/manifest.json')
    .then(response => (response.ok ? response.json() : { files: [] }))
    .then((data: { files?: unknown }) => (Array.isArray(data.files) ? data.files.filter((f): f is string => typeof f === 'string') : []))
    .catch(() => []);
  return manifest;
};

// Resolves to the URL of `/music/<name>.mp3` if the manifest lists it
const findMusicFile = (name: string): Promise<string | null> =>
  readManifest().then(files => (files.includes(`${name}.mp3`) ? `/music/${name}.mp3` : null));

const loadStingerBuffer = (ctx: AudioContext, url: string): Promise<AudioBuffer | null> => {
  let buffer = fileBuffers.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then(response => response.arrayBuffer())
      .then(data => ctx.decodeAudioData(data))
      .catch(() => null);
    fileBuffers.set(url, buffer);
  }
  return buffer;
};

// ---- Playback ----

let requested: MusicTrack | null = null;
let intensity: Layer = 1;
let syncToken = 0;

const retireCurrent = () => {
  if (!runtime || !current) return;
  fadeOut(current.player, runtime.ctx, CROSSFADE_SECONDS);
  retiring.push({ player: current.player, until: runtime.ctx.currentTime + CROSSFADE_SECONDS + 0.1 });
  current = null;
};

const startTrack = (track: MusicTrack, url: string | null) => {
  if (!runtime) return;
  const { ctx, mixer } = runtime;
  let player: TrackPlayer;
  if (url) {
    player = new FileTrackPlayer(ctx, url, mixer.music, track === 'battle', intensity);
  } else {
    const compiled = getCompiled(track);
    if (!compiled) return;
    player = new SynthTrackPlayer(mixer, compiled, mixer.music, ctx.currentTime + START_DELAY_SECONDS, intensity);
  }
  if (!shouldRun()) player.pause();
  retireCurrent();
  fadeIn(player, ctx, CROSSFADE_SECONDS);
  current = { track, player };
  ensureScheduler();
};

// Bring what is playing in line with what was requested
const syncPlayback = () => {
  const token = ++syncToken;
  const rt = getRuntime();
  if (!rt) return;
  const target = requested;
  if ((current?.track ?? null) === target) return;
  if (target === null) {
    retireCurrent();
    return;
  }
  findMusicFile(target).then(url => {
    if (token === syncToken && requested === target) startTrack(target, url);
  });
};

/**
 * Crossfades to the given track, or fades out for null. Requesting the track that is already
 * playing does nothing. Music asked for before the first user gesture starts once audio unlocks.
 */
export const playMusic = (track: MusicTrack | null) => {
  if (typeof window === 'undefined' || track === requested) return;
  // Intensity belongs to one battle, so it resets when the battle music ends
  if (requested === 'battle') intensity = 1;
  requested = track;
  syncPlayback();
};

/**
 * Battle music only: 0 is calm planning (drums and low strings), 1 the full band and
 * 2 the climax (adds choir, high strings and extra percussion). Layers fade in and out smoothly.
 */
export const setMusicIntensity = (level: 0 | 1 | 2) => {
  intensity = level;
  current?.player.setIntensity(level);
};

/**
 * Plays a one-shot jingle over the music, which ducks underneath it. Skipped while muted or
 * before audio has unlocked, since a late jingle is worse than none.
 */
export const playStinger = (stinger: Stinger) => {
  if (typeof window === 'undefined' || isMuted()) return;
  const rt = getRuntime();
  if (!rt || rt.ctx.state !== 'running') return;
  const { ctx, mixer } = rt;

  findMusicFile(stinger).then(async url => {
    if (url) {
      const buffer = await loadStingerBuffer(ctx, url);
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(mixer.stingers);
      source.onended = () => source.disconnect();
      source.start();
      mixer.duck(buffer.duration);
      return;
    }
    const compiled = getCompiled(stinger);
    if (!compiled) return;
    const player = new SynthTrackPlayer(mixer, compiled, mixer.stingers, ctx.currentTime + 0.02, 2);
    retiring.push({ player, until: player.endTime + REVERB_TAIL_SECONDS });
    mixer.duck(compiled.duration + 0.3);
    ensureScheduler();
  });
};

// ---- React ----

// Tracks requested by mounted components; the most recent one plays
const claims: { track: MusicTrack | null }[] = [];
let claimTimer: ReturnType<typeof setTimeout> | null = null;

// Waiting a moment lets a screen that replaces another keep the same track going without a restart
const applyClaimsSoon = () => {
  if (claimTimer !== null) clearTimeout(claimTimer);
  claimTimer = setTimeout(() => {
    claimTimer = null;
    playMusic(claims.length ? claims[claims.length - 1].track : null);
  }, 50);
};

/**
 * Plays the track while the component is mounted. When it unmounts, the track requested by
 * the next most recently mounted component (if any) takes over.
 */
export const useMusic = (track: MusicTrack | null) => {
  useEffect(() => {
    const claim = { track };
    claims.push(claim);
    applyClaimsSoon();
    return () => {
      claims.splice(claims.indexOf(claim), 1);
      applyClaimsSoon();
    };
  }, [track]);
};
