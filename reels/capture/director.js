/*
 * Reel director for Hex Hordes: injected into the battle page by capture.cjs (before the game's
 * own scripts). Contract: SKILL references/director-contract.md.
 *
 * Hex Hordes is a turn-based React Three Fiber game whose battles are paced by setTimeout and
 * animated by useFrame, so instead of calling a frame function this director runs the whole page
 * on a virtual clock: performance.now, Date.now, timers and requestAnimationFrame all advance by
 * exactly 1/30 s per step. The game's own (opt-in) reel hook, src/lib/reelHook.ts, lets its AI
 * play the player's side, reports the battle's state and callouts, and lets us pull the camera in.
 *
 * Frames are grabbed as page screenshots by capture.cjs (SHOTS=1): the troops' health tags and
 * damage numbers are HTML over the canvas. The planning phase (nothing moves) isn't recorded.
 */
(() => {
  const FPS = 30;
  const DT = 1000 / FPS;
  const R = (window.__reel = { frame: 0, events: [], marks: [], opts: null, koAt: -1, screenshots: true });
  // Recorded time (s): only recorded frames count, so the log lines up with the footage.
  const t = () => R.frame / FPS;

  // ---------------------------------------------------------------- virtual clock
  const real = {
    setTimeout: window.setTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    now: performance.now.bind(performance),
  };
  const dateBase = Date.now() - real.now();
  let vnow = real.now();
  performance.now = () => vnow;
  Date.now = () => Math.floor(dateBase + vnow);
  const timers = new Map();
  let nextId = 1;
  const addTimer = (fn, ms, args, repeat) => {
    const id = nextId++;
    if (typeof fn !== 'function') return id;
    const delay = Math.max(0, +ms || 0);
    timers.set(id, { at: vnow + delay, fn, args, repeat: repeat ? Math.max(1, delay) : 0, seq: id });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => addTimer(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => addTimer(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  let rafs = new Map();
  let rafId = 1;
  window.requestAnimationFrame = (cb) => (rafs.set(rafId, cb), rafId++);
  window.cancelAnimationFrame = (id) => rafs.delete(id);

  const runTimers = (until) => {
    for (;;) {
      let due = null;
      for (const [id, tm] of timers) if (tm.at <= until && (!due || tm.at < due[1].at || (tm.at === due[1].at && tm.seq < due[1].seq))) due = [id, tm];
      if (!due) break;
      const [id, tm] = due;
      if (tm.repeat) tm.at += tm.repeat;
      else timers.delete(id);
      vnow = Math.max(vnow, tm.at - tm.repeat);
      try {
        tm.fn(...(tm.args ?? []));
      } catch (err) {
        console.error('timer', err);
      }
    }
    vnow = until;
  };
  const runRafs = () => {
    const cbs = rafs;
    rafs = new Map();
    for (const cb of cbs.values()) {
      try {
        cb(vnow);
      } catch (err) {
        console.error('raf', err);
      }
    }
  };
  // A real macrotask: lets React (MessageChannel scheduler) commit what the timers set off.
  const yieldTask = () => new Promise((r) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => r();
    ch.port2.postMessage(0);
  });

  // While the page loads, the virtual clock follows real time (the board renders at ~8 fps).
  let pumping = true;
  let lastRaf = 0;
  const pump = real.setInterval(() => {
    if (!pumping) return;
    runTimers(Math.max(vnow, real.now()));
    if (vnow - lastRaf > 120) {
      lastRaf = vnow;
      runRafs();
    }
  }, 16);

  // ---------------------------------------------------------------- settings, before the game reads them
  const shot = (() => {
    try {
      return JSON.parse(decodeURIComponent(new URLSearchParams(location.search).get('reel') || '{}'));
    } catch {
      return {};
    }
  })();
  try {
    localStorage.removeItem('hexStrategyGameSave');
    localStorage.setItem('wwhMuted', 'false');
    localStorage.setItem('wwhSfxVolume', '1');
    localStorage.setItem('wwhMusicVolume', '0');
    localStorage.setItem('wwhGraphics', 'high');
    localStorage.setItem('wwhSpeed', String(shot.speed ?? 2));
    localStorage.setItem('wwhVibration', 'false');
    const level = shot.level ?? 1;
    const deck = shot.deck ?? ['tank', 'pegasus', 'archmage', 'berserker'];
    const cardLevel = shot.cardLevel ?? 15;
    const cards = {};
    for (const id of ['infantry', 'artillery', 'tank', 'rogue', ...deck]) cards[id] = cardLevel;
    const levels = {};
    for (let i = 1; i < level; i++) levels[i] = { stars: 3, wins: 1, losses: 0 };
    localStorage.setItem('wwhProfile', JSON.stringify({ version: 1, coins: 5000, tutorialDone: true, levels, cards, deck }));
  } catch (err) {
    console.error('reel settings', err);
  }


  // ---------------------------------------------------------------- what the camera looks at
  const HEIGHT = { water: 0.5, swamp: 0.6, ice: 0.6, lava: 0.6, plains: 1.3, desert: 1.3, snow: 2.0, hills: 2.1, mountains: 2.7 };
  const world = (c) => {
    const hex = state?.hexGrid?.find((h) => h.coordinates.q === c.q && h.coordinates.r === c.r);
    const y = (HEIGHT[hex?.terrain] ?? 1.3) + (hex?.heightOffset ?? 0) + 0.4;
    return [Math.sqrt(3) * (c.q + c.r / 2), y, 1.5 * c.r];
  };
  const hexDist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
  const mean = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]);
  let aim = null;
  let dist = null;
  let wide = false;
  let held = null;
  /** The fight to watch: a boss's, else the biggest; a siege; the falling castle; else null (the rig's choice). */
  const focus = () => {
    const s = state;
    if (!s) return null;
    wide = false;
    if (s.currentPhase === 'gameOver') {
      const loser = s.winner === 'player' ? 'ai' : 'player';
      const at = s.players?.[loser]?.baseLocation;
      return at ? world(at) : null;
    }
    if (s.currentPhase === 'combat') {
      const fights = (s.combats ?? []).filter((c) => !c.resolved || held === c);
      if (fights.length) {
        const score = (c) => [...c.attackers, ...c.defenders].reduce((n, u) => n + (u.isBoss ? 10 : 1), 0);
        // (keep watching the same fight while it lasts)
        const pick = fights.includes(held) ? held : fights.slice().sort((a, b) => score(b) - score(a))[0];
        held = pick;
        return mean([world(pick.hexCoordinates), world(pick.hexCoordinates), ...pick.attackers.map((u) => world(u.position))]);
      }
      if (s.siege) {
        const at = s.players?.[s.siege.side]?.baseLocation;
        if (at) return world(at);
      }
    }
    held = null;
    // Troops on the march: the player's troops and whatever is near them, from a little further back.
    const mine = (s.players?.player?.units ?? []).map((u) => u.position);
    if (!mine.length) return null;
    const near = (s.players?.ai?.units ?? []).map((u) => u.position).filter((p) => mine.some((m) => hexDist(m, p) <= 3));
    const enemy = s.players?.ai?.baseLocation;
    wide = true;
    const c = mean([...mine, ...near].map(world));
    // (a little toward the enemy castle: the march is going that way, and the near board edge is empty)
    if (enemy) {
      const e = world(enemy);
      const d = Math.hypot(e[0] - c[0], e[2] - c[2]) || 1;
      c[0] += ((e[0] - c[0]) / d) * 1.5;
      c[2] += ((e[2] - c[2]) / d) * 1.5;
    }
    return c;
  };

  // ---------------------------------------------------------------- the game's reel hook
  let state = null;
  let unitIds = null;
  const hook = (window.__reelHook = {
    autoplay: true,
    onState: (s) => {
      state = s;
      if (!R.opts) return;
      // A troop gone from the board: a kill (the board plays the death out just after).
      const ids = new Set();
      for (const p of Object.values(s.players ?? {})) for (const u of p?.units ?? []) ids.add(u.id);
      if (unitIds) for (const id of unitIds) if (!ids.has(id)) R.marks.push({ t: t(), kind: 'kill', label: id });
      unitIds = ids;
      if (s.currentPhase === 'gameOver' && R.koAt < 0) {
        R.koAt = t();
        R.marks.push({ t: t(), kind: 'ko', label: `${s.winner} wins (${s.winReason})` });
      }
    },
    onMoment: (m) => {
      if (!R.opts) return;
      const title = String(m.title ?? '');
      const kind = /defeated|slain/i.test(title) ? 'boss' : /fallen|is out/i.test(title) ? 'castle' : /blood|kill|rampage/i.test(title) ? 'kill' : 'moment';
      R.marks.push({ t: t(), kind, label: m.subtitle ? `${title} - ${m.subtitle}` : title });
    },
    onCamera: (camera, lookAt, delta) => {
      if (!R.opts) return;
      // Our own shot: close on the fight that matters (see focus()), from the rig's side of the board.
      const f = focus() ?? [lookAt.x, lookAt.y, lookAt.z];
      const k = 1 - Math.exp(-(R.opts.follow ?? 2.6) * delta);
      if (!aim) aim = f.slice();
      for (let i = 0; i < 3; i++) aim[i] += (f[i] - aim[i]) * k;
      const over = state?.currentPhase === 'gameOver';
      const wantDist = over ? (R.opts.fallDist ?? 10) : wide ? (R.opts.wideDist ?? 12.5) : (R.opts.dist ?? 11);
      dist = dist ?? wantDist;
      dist += (wantDist - dist) * (1 - Math.exp(-1.8 * delta));
      const el = ((over ? 40 : (R.opts.elevation ?? 48)) * Math.PI) / 180;
      const off = camera.position.clone().sub(lookAt);
      const az = Math.atan2(off.x, off.z) + ((R.opts.turn ?? 0) * Math.PI) / 180;
      camera.position.set(aim[0] + Math.sin(az) * Math.cos(el) * dist, aim[1] + Math.sin(el) * dist, aim[2] + Math.cos(az) * Math.cos(el) * dist);
      camera.lookAt(aim[0], aim[1], aim[2]);
    },
  });

  // ---------------------------------------------------------------- sound: log ZzFX's buffers, don't play
  const origStart = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    // (ZzFX tags its sources with a gain node; the music's own buffers have none)
    if (this.gainNode && this.buffer) {
      if (R.opts) {
        const b = this.buffer;
        const ch = [];
        for (let i = 0; i < b.numberOfChannels; i++) ch.push(new Float32Array(b.getChannelData(i)));
        R.events.push({ t: t(), name: 'zzfx', sampleRate: b.sampleRate, gain: this.gainNode.gain.value, ch });
      }
      return undefined;
    }
    return origStart.apply(this, args);
  };

  // ---------------------------------------------------------------- the contract
  R.ready = () => !!(state && document.querySelector('canvas') && state.currentPhase && state.currentPhase !== 'setup' && state.hexGrid);

  R.setup = (opts) => {
    R.opts = { ...shot, ...opts };
    pumping = false;
    real.clearInterval(pump);
    // Only the board: hide the HUD, keep the canvas and the HTML drawn over it (health tags, hits).
    const canvas = document.querySelector('canvas');
    // (R3F: outer div > div > canvas; drei's <Html> labels go in the outer div)
    const wrap = canvas.parentElement.parentElement;
    wrap.classList.add('reel-keep');
    // The sky is a background further up, which hiding the HUD would hide too: bring it along.
    for (let el = canvas; el; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) {
        wrap.style.background = cs.background;
        break;
      }
    }
    const css = document.createElement('style');
    css.textContent = `body * { visibility: hidden !important; } .reel-keep, .reel-keep * { visibility: visible !important; }`;
    document.head.appendChild(css);
  };

  const recordable = () => state && !['setup', 'planning'].includes(state.currentPhase);
  let gameFrames = 0;

  /** One recorded frame (skipping the planning phase, where nothing moves). */
  R.step = async () => {
    for (let guard = 0; guard < FPS * 30; guard++) {
      runTimers(vnow + DT);
      for (let i = 0; i < 4; i++) await yieldTask();
      runRafs();
      gameFrames++;
      if (recordable() || R.koAt >= 0) break;
    }
    R.frame++;
    return null; // capture.cjs screenshots the page
  };

  R.state = () => ({ frame: R.frame, t: t(), koAt: R.koAt, over: gameFrames > FPS * 60 * 6, phase: state?.currentPhase, turn: state?.turnNumber });

  /** The logged ZzFX sounds, mixed in sync, as 16-bit stereo WAV bytes. */
  R.renderAudio = async (seconds) => {
    const rate = 48000;
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
    for (const ev of R.events) {
      if (ev.t >= seconds) continue;
      const buf = ctx.createBuffer(ev.ch.length, ev.ch[0].length, ev.sampleRate);
      ev.ch.forEach((c, i) => buf.getChannelData(i).set(c));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = ev.gain;
      src.connect(g).connect(ctx.destination);
      src.start(ev.t);
    }
    const out = await ctx.startRendering();
    const n = out.length;
    const view = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    view.setUint32(4, 36 + n * 4, true);
    str(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    str(36, 'data');
    view.setUint32(40, n * 4, true);
    const L = out.getChannelData(0);
    const Rc = out.getChannelData(1);
    for (let i = 0; i < n; i++) {
      view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 0x7fff, true);
      view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rc[i])) * 0x7fff, true);
    }
    // (the events' sample arrays are big: keep them out of the saved log)
    for (const ev of R.events) delete ev.ch;
    return new Uint8Array(view.buffer);
  };
})();
