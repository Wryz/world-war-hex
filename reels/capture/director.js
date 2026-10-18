/*
 * Reel director for Hex Hordes: injected into the battle page by capture.cjs before the game's
 * own scripts. See the make-reels director contract; this one differs in two ways, because the
 * game is a React app full of timers with an HTML HUD over its three.js board:
 *
 *  - Virtual time. performance.now, Date, setTimeout/setInterval and requestAnimationFrame all
 *    run on a clock this script moves, and CSS animations are pinned to it too. step() moves it
 *    1/30 s, fires the timers in order (letting React commit between them), runs one rendered
 *    frame and leaves the page ready for capture.cjs to screenshot (HUD included).
 *  - Autopilot is the game's own AI on both sides (window.__wwhReel.autoplay, see
 *    src/lib/reelHooks.ts). setup() fast-forwards the battle, unrendered, to the shot's
 *    moment (`start`), then filming begins.
 *
 * Sound: every AudioBufferSourceNode.start (the ZzFX battle sounds) is logged with its samples
 * instead of played, then mixed offline at the logged times.
 */
(() => {
  const FPS = 30;
  const DT = 1000 / FPS;
  const R = (window.__reel = { frame: 0, events: [], marks: [], opts: null, koAt: -1, sounds: [] });
  window.__wwhReel = { autoplay: true };

  // ---- Save, settings and first-time hints (the battle should look like a seasoned player's).
  if (window.__reelProfile) {
    try {
      localStorage.setItem('wwhProfile', JSON.stringify(window.__reelProfile));
      localStorage.setItem('wwhGraphics', 'high');
      localStorage.setItem('wwhSpeed', String(window.__reelSpeed ?? 1));
      localStorage.setItem('wwhGuideSeen', JSON.stringify(['fog', 'bossPower', 'felling', 'catapult', 'gate']));
      localStorage.setItem('wwhTipsSeen', JSON.stringify(['flank', 'height', 'village', 'follow', 'signature', 'morale', 'undying',
        'weather-fogBanks', 'weather-sandstorm', 'weather-blizzard', 'weather-ashfall']));
      localStorage.setItem('wwhAnalyticsOptOut', '1');
      localStorage.removeItem('wwhSavedGame');
    } catch (e) {
      console.warn('reel: storage', e);
    }
  }

  // ---- Virtual clock.
  const realSetTimeout = window.setTimeout.bind(window);
  const realSetInterval = window.setInterval.bind(window);
  const RealDate = Date;
  const dateBase = RealDate.now();
  let now = 0;
  performance.now = () => now;
  class VDate extends RealDate {
    constructor(...a) {
      if (a.length) super(...a);
      else super(dateBase + now);
    }
    static now() {
      return dateBase + now;
    }
  }
  window.Date = VDate;

  const timers = new Map();
  let nextId = 1;
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, +ms || 0), fn, args, every: 0, seq: id });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, +ms || 0);
    timers.set(id, { at: now + every, fn, args, every, seq: id });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  let frames = [];
  window.requestAnimationFrame = (fn) => {
    frames.push(fn);
    return frames.length;
  };
  window.cancelAnimationFrame = () => {};

  const runTimer = (id, tm) => {
    if (tm.every) tm.at += tm.every;
    else timers.delete(id);
    try {
      typeof tm.fn === 'function' ? tm.fn(...tm.args) : (0, eval)(tm.fn);
    } catch (e) {
      console.error('reel: timer', e);
    }
  };
  const due = (until) => {
    let best = null;
    for (const [id, tm] of timers) if (tm.at <= until && (!best || tm.at < best[1].at || (tm.at === best[1].at && tm.seq < best[1].seq))) best = [id, tm];
    return best;
  };
  // A real macrotask or two, so React can render and commit what the timers changed
  const channel = new MessageChannel();
  const waiting = [];
  channel.port1.onmessage = () => waiting.shift()?.();
  const tick = () => new Promise((r) => { waiting.push(r); channel.port2.postMessage(0); });
  const flush = async (n = 2) => { for (let i = 0; i < n; i++) await tick(); };

  const advance = async (ms) => {
    const until = now + ms;
    for (let guard = 0; guard < 500; guard++) {
      const next = due(until);
      if (!next) break;
      now = Math.max(now, next[1].at);
      runTimer(...next);
      await flush(2);
    }
    now = until;
  };
  const runFrames = () => {
    const list = frames;
    frames = [];
    for (const fn of list) {
      try {
        fn(now);
      } catch (e) {
        console.error('reel: frame', e);
      }
    }
  };
  // CSS animations and transitions follow the virtual clock too
  const pinAnimations = () => {
    for (const a of document.getAnimations()) {
      if (a.__vStart === undefined) {
        a.__vStart = now - (a.currentTime ?? 0);
        a.pause();
      }
      a.currentTime = now - a.__vStart;
    }
  };

  // Until setup, time runs at about real speed so the page can load
  let freeRun = true;
  const pump = async () => {
    if (!freeRun) return;
    await advance(50);
    runFrames();
    pinAnimations();
    realSetTimeout(pump, 50);
  };
  realSetTimeout(pump, 50);

  // ---- Sound: logged with its samples, never played.
  let recording = false;
  R.t0 = 0;
  const T = () => (now - R.t0) / 1000;
  AudioBufferSourceNode.prototype.start = function () {
    if (!recording || !this.buffer) return;
    const b = this.buffer;
    const ch = [];
    for (let i = 0; i < b.numberOfChannels; i++) ch.push(b.getChannelData(i).slice());
    const gain = this.gainNode?.gain?.value ?? 1;
    R.sounds.push({ t: T(), rate: b.sampleRate, ch, gain });
    R.events.push({ t: T(), name: 'sfx', args: [Math.round(b.length / b.sampleRate * 1000), +gain.toFixed(3)] });
  };
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };

  // ---- The battle.
  const hooks = () => window.__wwhReel;
  const S = () => hooks().battle?.get();
  const castleRatio = (side) => {
    const s = S();
    const p = s?.players?.[side];
    return p && p.maxBaseHealth ? Math.max(0, p.baseHealth ?? p.maxBaseHealth) / p.maxBaseHealth : 1;
  };
  const isBoss = (u) => !!u?.isBoss;
  const bossHp = () => {
    const s = S();
    const b = s?.players?.ai?.units?.find(isBoss);
    return b ? b.lifespan / b.maxLifespan : null;
  };

  R.ready = () => !!(S() && S().currentPhase && S().currentPhase !== 'setup' && document.querySelector('canvas'));

  // Whether the shot's moment has come: { round: n } / { castleBelow: 0.5 } / { bossBelow: 0.6 } /
  // { bossSeen: true }, checked at the start of each of the player's turns
  const startReached = (start) => {
    const s = S();
    if (!start) return true;
    if (s.currentPhase === 'gameOver') return true;
    if (s.currentPhase !== 'planning') return false;
    if (start.side && (s.activePlayer ?? 'player') !== start.side) return false;
    if (start.round && s.turnNumber < start.round) return false;
    if (start.castleBelow && castleRatio('ai') > start.castleBelow) return false;
    if (start.bossBelow) {
      const hp = bossHp();
      if (hp === null || hp > start.bossBelow) return false;
    }
    return true;
  };

  R.setup = async (opts) => {
    R.opts = opts;
    freeRun = false;
    // (let the last free-running pump finish)
    await flush(4);
    const t0 = RealDate.now();
    let n = 0;
    let lastPhase = '';
    // Fast-forward: timers and React only, a rendered frame now and then
    while (!startReached(opts.start) && now < (opts.maxForward ?? 900) * 1000) {
      await advance(250);
      if (++n % 4 === 0) runFrames();
      pinAnimations();
      const s = S();
      const key = `${s.turnNumber}/${s.activePlayer}/${s.currentPhase}`;
      if (key !== lastPhase && s.currentPhase === 'planning') console.log(`reel: ff ${(now / 1000).toFixed(0)}s round ${s.turnNumber} ${s.activePlayer} castle ${castleRatio('ai').toFixed(2)}/${castleRatio('player').toFixed(2)} boss ${bossHp()}`);
      lastPhase = key;
    }
    // Settle the camera and the board for a second before rolling
    for (let i = 0; i < (opts.settle ?? 20); i++) {
      await advance(DT);
      runFrames();
      pinAnimations();
    }
    console.log(`reel: rolling at ${(now / 1000).toFixed(1)}s game time after ${((RealDate.now() - t0) / 1000).toFixed(0)}s`);
    R.t0 = now;
    R.gameStart = now / 1000;
    recording = true;
    R.lastUnits = null;
  };

  let over = false;
  let overAt = -1;
  R.step = async () => {
    R.frame++;
    await advance(DT);
    runFrames();
    pinAnimations();
    await flush(1);
    // Moments: kills (units gone), castle hits, the end of the battle
    const s = S();
    if (s) {
      const count = (side) => s.players?.[side]?.units?.length ?? 0;
      const units = { player: count('player'), ai: count('ai') };
      const castle = castleRatio('ai');
      if (R.lastUnits) {
        if (units.ai < R.lastUnits.ai) R.marks.push({ t: T(), kind: 'kill', label: `${R.lastUnits.ai - units.ai} enemy down` });
        if (units.player < R.lastUnits.player) R.marks.push({ t: T(), kind: 'loss', label: `${R.lastUnits.player - units.player} lost` });
        if (castle < R.lastCastle - 0.001) R.marks.push({ t: T(), kind: 'siege', label: `castle ${(castle * 100).toFixed(0)}%` });
      }
      R.lastUnits = units;
      R.lastCastle = castle;
      if (s.currentPhase === 'gameOver' && overAt < 0) {
        overAt = T();
        R.koAt = overAt;
        R.marks.push({ t: T(), kind: 'ko', label: `winner ${s.winner}` });
        R.winner = s.winner;
      }
    }
    if (R.opts.endOnFirstKill && R.koAt < 0) {
      const k = R.marks.find((m) => m.kind === 'kill' && m.t > 1);
      if (k) R.koAt = k.t;
    }
    over = overAt >= 0 && T() > overAt + (R.opts.tail ?? 4) + 0.1;
    return null;
  };

  R.state = () => ({ frame: R.frame, t: R.frame / FPS, koAt: R.koAt, over });

  R.renderAudio = async (seconds) => {
    const rate = 48000;
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
    for (const s of R.sounds) {
      if (s.t >= seconds) continue;
      const buf = ctx.createBuffer(s.ch.length, s.ch[0].length, s.rate);
      s.ch.forEach((c, i) => buf.getChannelData(i).set(c));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = s.gain;
      src.connect(g).connect(ctx.destination);
      src.start(s.t);
    }
    const buf = await ctx.startRendering();
    const n = buf.length;
    const out = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    out.setUint32(4, 36 + n * 4, true);
    str(8, 'WAVEfmt ');
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true);
    out.setUint16(22, 2, true);
    out.setUint32(24, rate, true);
    out.setUint32(28, rate * 4, true);
    out.setUint16(32, 4, true);
    out.setUint16(34, 16, true);
    str(36, 'data');
    out.setUint32(40, n * 4, true);
    const L = buf.getChannelData(0);
    const Rc = buf.getChannelData(1);
    for (let i = 0; i < n; i++) {
      out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 0x7fff, true);
      out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rc[i])) * 0x7fff, true);
    }
    return new Uint8Array(out.buffer);
  };
})();
