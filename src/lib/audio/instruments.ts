// Synthesised instruments for the procedural music. Every note builds a short-lived voice from
// oscillators, noise, filters and gain envelopes, and disconnects itself once it has finished.

export interface VoiceNote {
  time: number;     // AudioContext time the note starts
  midi: number;     // MIDI note number (untuned drums ignore it)
  duration: number; // Seconds the note is held before its release
  velocity: number; // 0..1
}

// An effect shared by every note of one part (e.g. the choir's vowel filters)
export interface Insert {
  input: AudioNode;
  output: AudioNode;
  nodes: AudioNode[];
}

export interface Instrument {
  play: (ctx: BaseAudioContext, out: AudioNode, note: VoiceNote) => void;
  createInsert?: (ctx: BaseAudioContext) => Insert;
}

export const midiToFrequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Voices stop this many time constants into an exponential fade (about -60 dB), so the cut is inaudible
const FADE_LENGTH = 7;

// Small random offset so stacked oscillators never phase-lock into a static tone
const jitter = (amount: number) => (Math.random() - 0.5) * 2 * amount;

// ---- Shared buffers ----

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
const reverbImpulses = new WeakMap<BaseAudioContext, AudioBuffer>();

// Two seconds of stereo white noise, reused (looped from a random offset) by every noisy voice
const getNoise = (ctx: BaseAudioContext): AudioBuffer => {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(2, ctx.sampleRate * 2, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
};

/**
 * A hall-like impulse response: decaying stereo noise that darkens as it fades,
 * so the convolution reverb sounds like stone rather than a metal box
 */
export const getReverbImpulse = (ctx: BaseAudioContext): AudioBuffer => {
  let buffer = reverbImpulses.get(ctx);
  if (!buffer) {
    const seconds = 2.6;
    const preDelay = Math.floor(ctx.sampleRate * 0.012);
    const length = Math.floor(ctx.sampleRate * seconds);
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let smoothed = 0;
      for (let i = preDelay; i < length; i++) {
        const progress = i / length;
        const decay = Math.exp(-progress * 7.5);
        // One-pole lowpass that closes as the tail goes on
        const colour = 0.75 - progress * 0.6;
        smoothed += colour * (Math.random() * 2 - 1 - smoothed);
        data[i] = smoothed * decay;
      }
    }
    reverbImpulses.set(ctx, buffer);
  }
  return buffer;
};

// ---- Voice builder ----

/**
 * Collects the nodes of one note so they can all be started, stopped and
 * disconnected together. Sources run from `start` to `end`.
 */
class Voice {
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(readonly ctx: BaseAudioContext, readonly start: number, readonly end: number) {}

  // Pitch modulation (vibrato, scoops) is applied per 128-sample block rather than per sample,
  // which keeps the oscillator on its fast path; drum sweeps ask for sample accuracy instead
  osc(type: OscillatorType, frequency: number, detune = 0, sampleAccurate = false): OscillatorNode {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    if (!sampleAccurate) {
      osc.frequency.automationRate = 'k-rate';
      osc.detune.automationRate = 'k-rate';
    }
    return this.source(osc);
  }

  noise(): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource();
    source.buffer = getNoise(this.ctx);
    source.loop = true;
    this.nodes.push(source);
    this.sources.push(source);
    source.start(this.start, Math.random() * 1.5);
    source.stop(this.end);
    return source;
  }

  gain(value: number): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.value = value;
    return this.node(gain);
  }

  filter(type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    // Filter envelopes only need block-rate updates; per-sample coefficients are expensive
    filter.frequency.automationRate = 'k-rate';
    filter.Q.automationRate = 'k-rate';
    return this.node(filter);
  }

  pan(value: number): StereoPannerNode {
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = value;
    return this.node(panner);
  }

  // Sine modulation in cents for vibrato, faded in over `fadeIn` seconds
  vibrato(rate: number, depth: number, fadeIn = 0): GainNode {
    const lfo = this.osc('sine', rate);
    const amount = this.gain(fadeIn > 0 ? 0 : depth);
    if (fadeIn > 0) {
      amount.gain.setValueAtTime(0, this.start);
      amount.gain.linearRampToValueAtTime(depth, this.start + fadeIn);
    }
    lfo.connect(amount);
    return amount;
  }

  // Disconnect everything once the sources have stopped
  done() {
    const [first] = this.sources;
    if (first) first.onended = () => this.nodes.forEach(node => node.disconnect());
  }

  private source<T extends AudioScheduledSourceNode>(source: T): T {
    this.nodes.push(source);
    this.sources.push(source);
    source.start(this.start);
    source.stop(this.end);
    return source;
  }

  private node<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
}

// Linear attack to `peak`, then hold until `release` and fade with the given time constant
const shapeAmp = (param: AudioParam, start: number, attack: number, peak: number, release: number, fade: number) => {
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(peak, start + attack);
  param.setTargetAtTime(0, release, fade);
};

// Instant attack and exponential-style decay for percussive sounds
const shapeHit = (param: AudioParam, start: number, peak: number, decay: number, attack = 0.002) => {
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(peak, start + attack);
  param.setTargetAtTime(0, start + attack, decay);
};

// ---- Strings ----

// Ensemble strings: three detuned saws spread across the stereo field, softened by a lowpass
const strings: Instrument = {
  play(ctx, out, { time, midi, duration, velocity }) {
    const frequency = midiToFrequency(midi);
    const attack = Math.min(0.32, duration * 0.4);
    const release = 0.12;
    const voice = new Voice(ctx, time, time + duration + release * FADE_LENGTH);
    const tone = voice.filter('lowpass', clamp(frequency * 5, 1100, 2400), 0.5);
    const amp = voice.gain(0);
    shapeAmp(amp.gain, time, attack, 0.075 * velocity, time + duration, release);

    const vibrato = voice.vibrato(4.8 + Math.random() * 0.8, 6, 0.2);
    [-0.6, 0, 0.6].forEach((pan, i) => {
      const osc = voice.osc('sawtooth', frequency, (i - 1) * 9 + jitter(3));
      vibrato.connect(osc.detune);
      if (pan) osc.connect(voice.pan(pan)).connect(tone);
      else osc.connect(tone);
    });
    tone.connect(amp).connect(out);
    voice.done();
  }
};

// Short bowed notes for driving ostinatos
const spiccato: Instrument = {
  play(ctx, out, { time, midi, duration, velocity }) {
    const frequency = midiToFrequency(midi);
    const length = Math.min(duration, 0.2);
    const voice = new Voice(ctx, time, time + length + 0.2);
    const tone = voice.filter('lowpass', clamp(frequency * 10, 2200, 5000), 1.1);
    tone.frequency.setTargetAtTime(clamp(frequency * 4, 900, 2400), time, 0.05);
    const amp = voice.gain(0);
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(0.11 * velocity, time + 0.008);
    amp.gain.setTargetAtTime(0.045 * velocity, time + 0.008, 0.06);
    amp.gain.setTargetAtTime(0, time + length, 0.03);

    // Kept lean (no per-oscillator panning) because ostinatos play many of these
    voice.osc('sawtooth', frequency, -7 + jitter(2)).connect(tone);
    voice.osc('sawtooth', frequency, 7 + jitter(2)).connect(tone);
    tone.connect(amp).connect(out);
    voice.done();
  }
};

// Cellos and basses: dark saws with a contrabass octave below for weight
const lowStrings: Instrument = {
  play(ctx, out, { time, midi, duration, velocity }) {
    const frequency = midiToFrequency(midi);
    const voice = new Voice(ctx, time, time + duration + 0.07 * FADE_LENGTH);
    const tone = voice.filter('lowpass', clamp(frequency * 8, 450, 1300), 0.8);
    const amp = voice.gain(0);
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(0.13 * velocity, time + Math.min(0.04, duration * 0.3));
    amp.gain.setTargetAtTime(0.1 * velocity, time + 0.05, 0.2);
    amp.gain.setTargetAtTime(0, time + duration, 0.07);

    voice.osc('sawtooth', frequency, -6 + jitter(2)).connect(tone);
    voice.osc('sawtooth', frequency, 6 + jitter(2)).connect(tone);
    if (frequency > 55) voice.osc('triangle', frequency / 2).connect(voice.gain(0.5)).connect(tone);
    tone.connect(amp).connect(out);
    voice.done();
  }
};

// ---- Brass ----

interface BrassSettings {
  oscillators: [OscillatorType, number, number][]; // waveform, detune (cents), level
  filterFloor: number;   // cutoff the filter opens from
  filterPeak: number;    // cutoff at full velocity
  sustain: number;       // fraction of the peak cutoff held after the attack
  q: number;
  attack: number;
  level: number;
  scoop: number;         // cents the pitch slides up from, like a player lipping into the note
  vibrato: number;       // cents
}

// Brass family: saw/square stacks through a lowpass whose envelope gives the "blare" of the attack
const makeBrass = (settings: BrassSettings): Instrument => ({
  play(ctx, out, { time, midi, duration, velocity }) {
    const frequency = midiToFrequency(midi);
    const voice = new Voice(ctx, time, time + duration + 0.05 * FADE_LENGTH);
    const peak = settings.filterFloor + settings.filterPeak * (0.45 + 0.55 * velocity);
    const tone = voice.filter('lowpass', settings.filterFloor, settings.q);
    tone.frequency.setValueAtTime(settings.filterFloor, time);
    tone.frequency.linearRampToValueAtTime(peak, time + settings.attack + 0.03);
    tone.frequency.setTargetAtTime(peak * settings.sustain, time + settings.attack + 0.03, 0.25);
    const amp = voice.gain(0);
    shapeAmp(amp.gain, time, Math.min(settings.attack, duration * 0.5), settings.level * velocity, time + duration, 0.05);

    const vibrato = duration > 0.4 ? voice.vibrato(5.2 + jitter(0.3), settings.vibrato, 0.4) : null;
    for (const [type, detune, level] of settings.oscillators) {
      const osc = voice.osc(type, frequency);
      osc.detune.setValueAtTime(detune - settings.scoop, time);
      osc.detune.linearRampToValueAtTime(detune, time + 0.06);
      vibrato?.connect(osc.detune);
      osc.connect(voice.gain(level)).connect(tone);
    }
    tone.connect(amp).connect(out);
    voice.done();
  }
});

// Mellow French horn for melodies
const horn = makeBrass({
  oscillators: [['sawtooth', 0, 1], ['sawtooth', 7, 0.6], ['square', -5, 0.3]],
  filterFloor: 250,
  filterPeak: 2000,
  sustain: 0.6,
  q: 1.4,
  attack: 0.04,
  level: 0.1,
  scoop: 40,
  vibrato: 9
});

// Brighter trumpet section for stabs and fanfares
const brass = makeBrass({
  oscillators: [['sawtooth', -8, 1], ['sawtooth', 8, 1], ['square', 0, 0.25]],
  filterFloor: 500,
  filterPeak: 3600,
  sustain: 0.55,
  q: 1.2,
  attack: 0.025,
  level: 0.075,
  scoop: 25,
  vibrato: 7
});

// Trombones and tubas with a growling resonance
const lowBrass = makeBrass({
  oscillators: [['sawtooth', 0, 1], ['sawtooth', -9, 0.8], ['square', 5, 0.4]],
  filterFloor: 180,
  filterPeak: 1100,
  sustain: 0.6,
  q: 3,
  attack: 0.05,
  level: 0.12,
  scoop: 30,
  vibrato: 4
});

// Ominous crescendo: the whole note swells and the filter opens, then cuts off
const brassSwell: Instrument = {
  play(ctx, out, { time, midi, duration, velocity }) {
    const frequency = midiToFrequency(midi);
    const end = time + duration;
    const voice = new Voice(ctx, time, end + 0.05 * FADE_LENGTH);
    const tone = voice.filter('lowpass', 200, 2.5);
    tone.frequency.setValueAtTime(200, time);
    tone.frequency.exponentialRampToValueAtTime(2800, end);
    const amp = voice.gain(0);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.1 * velocity, end);
    amp.gain.setTargetAtTime(0, end, 0.05);

    // Detuned against each other so the swell beats and churns
    for (const detune of [0, 14, -17]) voice.osc('sawtooth', frequency, detune).connect(tone);
    tone.connect(amp).connect(out);
    voice.done();
  }
};

// ---- Plucked and struck ----

interface PluckSettings {
  brightness: number; // starting cutoff as a multiple of the note frequency
  decay: number;      // seconds (time constant) for a middle-register note
  saw: number;        // level of the buzzy saw layer over the triangle body
  level: number;
  damped: boolean;    // stops ringing at the end of the note (lute) or rings on (harp)
}

const makePluck = (settings: PluckSettings): Instrument => ({
  play(ctx, out, { time, midi, duration, velocity }) {
    const frequency = midiToFrequency(midi);
    // Low strings ring for longer, like a real harp
    const decay = settings.decay * clamp(330 / frequency, 0.5, 2);
    const ring = settings.damped ? Math.min(duration + 0.03 * FADE_LENGTH, decay * FADE_LENGTH) : decay * FADE_LENGTH;
    const voice = new Voice(ctx, time, time + ring);
    const tone = voice.filter('lowpass', Math.min(frequency * settings.brightness, 9000), 0.8);
    tone.frequency.setTargetAtTime(frequency * 1.5 + 300, time, decay * 0.5);
    const amp = voice.gain(0);
    shapeHit(amp.gain, time, settings.level * velocity, decay, 0.003);
    if (settings.damped) amp.gain.setTargetAtTime(0, time + ring - 0.03 * FADE_LENGTH, 0.03);

    voice.osc('triangle', frequency).connect(tone);
    voice.osc('sawtooth', frequency, 4).connect(voice.gain(settings.saw)).connect(tone);
    tone.connect(amp).connect(out);
    voice.done();
  }
});

const harp = makePluck({ brightness: 7, decay: 0.35, saw: 0.35, level: 0.15, damped: false });
const lute = makePluck({ brightness: 10, decay: 0.22, saw: 0.6, level: 0.14, damped: true });
const pizzicato = makePluck({ brightness: 5, decay: 0.12, saw: 0.5, level: 0.28, damped: true });

// Glockenspiel-like bell from simple FM: a bright inharmonic strike that mellows as it rings
const bell: Instrument = {
  play(ctx, out, { time, midi, velocity }) {
    const frequency = midiToFrequency(midi);
    const voice = new Voice(ctx, time, time + 0.45 * FADE_LENGTH);
    const carrier = voice.osc('sine', frequency);
    const modulator = voice.osc('sine', frequency * 3.5);
    const index = voice.gain(0);
    index.gain.setValueAtTime(frequency * 2.2 * velocity, time);
    index.gain.setTargetAtTime(frequency * 0.15, time, 0.2);
    modulator.connect(index).connect(carrier.frequency);

    const amp = voice.gain(0);
    shapeHit(amp.gain, time, 0.07 * velocity, 0.45);
    carrier.connect(amp);
    voice.osc('sine', frequency * 2).connect(voice.gain(0.25)).connect(amp);
    amp.connect(out);
    voice.done();
  }
};

// ---- Winds and voices ----

// Flute: soft sine/triangle tone with a breathy noise "chiff" and delayed vibrato
const flute: Instrument = {
  play(ctx, out, { time, midi, duration, velocity }) {
    const frequency = midiToFrequency(midi);
    const voice = new Voice(ctx, time, time + duration + 0.05 * FADE_LENGTH);
    const amp = voice.gain(0);
    shapeAmp(amp.gain, time, Math.min(0.05, duration * 0.4), 0.1 * velocity, time + duration, 0.05);

    const vibrato = voice.vibrato(5 + jitter(0.3), 14, 0.35);
    const body = voice.osc('sine', frequency);
    const edge = voice.osc('triangle', frequency, 3);
    vibrato.connect(body.detune);
    vibrato.connect(edge.detune);
    body.connect(amp);
    edge.connect(voice.gain(0.3)).connect(amp);

    const breath = voice.gain(0);
    breath.gain.setValueAtTime(0, time);
    breath.gain.linearRampToValueAtTime(0.35, time + 0.015);
    breath.gain.setTargetAtTime(0.1, time + 0.015, 0.05);
    voice.noise()
      .connect(voice.filter('bandpass', Math.min(frequency * 2, 8000), 1.6))
      .connect(breath)
      .connect(amp);
    amp.connect(voice.filter('lowpass', 4500)).connect(out);
    voice.done();
  }
};

// Choir: detuned saws with vibrato; the shared insert shapes them into an "ah" vowel
const choir: Instrument = {
  play(ctx, out, { time, midi, duration, velocity }) {
    const frequency = midiToFrequency(midi);
    const voice = new Voice(ctx, time, time + duration + 0.18 * FADE_LENGTH);
    const amp = voice.gain(0);
    shapeAmp(amp.gain, time, Math.min(0.5, duration * 0.4), 0.11 * velocity, time + duration, 0.18);

    const vibrato = voice.vibrato(4.4 + jitter(0.4), 16, 0.3);
    [-0.4, 0.4].forEach((pan, i) => {
      const osc = voice.osc('sawtooth', frequency, (i ? 11 : -11) + jitter(3));
      vibrato.connect(osc.detune);
      osc.connect(voice.pan(pan)).connect(amp);
    });
    amp.connect(out);
    voice.done();
  },

  // Parallel bandpass filters at the formants of an open "ah"
  createInsert(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    output.gain.value = 2.6;
    const nodes: AudioNode[] = [input, output];
    for (const [frequency, q, level] of [[650, 4, 1], [1080, 5, 0.5], [2650, 6, 0.22]]) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = level;
      input.connect(filter).connect(gain).connect(output);
      nodes.push(filter, gain);
    }
    // A little of the raw tone keeps the low notes full
    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 500;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.15;
    input.connect(body).connect(bodyGain).connect(output);
    nodes.push(body, bodyGain);
    return { input, output, nodes };
  }
};

// ---- Drums ----

// Tuned timpani: pitched sine with a slight drop, an inharmonic overtone and a felt-stick thud
const timpani: Instrument = {
  play(ctx, out, { time, midi, velocity }) {
    const frequency = midiToFrequency(midi);
    const voice = new Voice(ctx, time, time + 0.45 * FADE_LENGTH);
    const body = voice.osc('sine', frequency * 1.1, 0, true);
    body.frequency.setValueAtTime(frequency * 1.1, time);
    body.frequency.exponentialRampToValueAtTime(frequency, time + 0.08);
    const amp = voice.gain(0);
    shapeHit(amp.gain, time, 0.34 * velocity, 0.45, 0.004);
    body.connect(amp);

    const overtone = voice.osc('sine', frequency * 1.5);
    const overtoneAmp = voice.gain(0);
    shapeHit(overtoneAmp.gain, time, 0.1 * velocity, 0.22, 0.004);
    overtone.connect(overtoneAmp).connect(out);

    const stick = voice.gain(0);
    shapeHit(stick.gain, time, 0.22 * velocity, 0.02);
    voice.noise().connect(voice.filter('lowpass', 1200)).connect(stick).connect(out);
    amp.connect(out);
    voice.done();
  }
};

// Taiko-style drum: a sine thump that drops sharply in pitch plus a skin slap
const makeDrum = (base: number, decay: number, slap: number, level: number): Instrument => ({
  play(ctx, out, { time, velocity }) {
    const voice = new Voice(ctx, time, time + decay * FADE_LENGTH);
    const body = voice.osc('sine', base * 2.4, 0, true);
    body.frequency.setValueAtTime(base * 2.4, time);
    body.frequency.exponentialRampToValueAtTime(base, time + 0.045);
    body.frequency.linearRampToValueAtTime(base * 0.85, time + decay * FADE_LENGTH);
    const amp = voice.gain(0);
    shapeHit(amp.gain, time, level * velocity, decay);
    body.connect(amp).connect(out);

    const shell = voice.osc('sine', base * 1.6);
    const shellAmp = voice.gain(0);
    shapeHit(shellAmp.gain, time, level * 0.25 * velocity, decay * 0.5);
    shell.connect(shellAmp).connect(out);

    const skin = voice.gain(0);
    shapeHit(skin.gain, time, slap * velocity, 0.025);
    voice.noise().connect(voice.filter('bandpass', base * 8, 0.8)).connect(skin).connect(out);
    voice.done();
  }
});

const taikoLow = makeDrum(55, 0.2, 0.25, 0.5);
const taikoHigh = makeDrum(120, 0.1, 0.3, 0.45);
const tom = makeDrum(150, 0.09, 0.25, 0.35);
const bassDrum = makeDrum(48, 0.25, 0.1, 0.45);

// Snare: bandpassed noise rattle over a short tonal crack
const snare: Instrument = {
  play(ctx, out, { time, velocity }) {
    const voice = new Voice(ctx, time, time + 0.4);
    const rattle = voice.gain(0);
    shapeHit(rattle.gain, time, 0.32 * velocity, 0.055, 0.001);
    voice.noise().connect(voice.filter('bandpass', 2800, 0.6)).connect(rattle).connect(out);

    const crack = voice.osc('triangle', 200, 0, true);
    crack.frequency.setValueAtTime(200, time);
    crack.frequency.exponentialRampToValueAtTime(150, time + 0.04);
    const crackAmp = voice.gain(0);
    shapeHit(crackAmp.gain, time, 0.22 * velocity, 0.03, 0.001);
    crack.connect(crackAmp).connect(out);
    voice.done();
  }
};

// Shaker: a soft, short burst of high noise
const shaker: Instrument = {
  play(ctx, out, { time, velocity }) {
    const voice = new Voice(ctx, time, time + 0.15);
    const amp = voice.gain(0);
    shapeHit(amp.gain, time, 0.16 * velocity, 0.022, 0.012);
    voice.noise().connect(voice.filter('highpass', 6500)).connect(amp).connect(out);
    voice.done();
  }
};

// Crash cymbal: wide high noise with a long shimmering decay
const crash: Instrument = {
  play(ctx, out, { time, velocity }) {
    const voice = new Voice(ctx, time, time + 0.7 * FADE_LENGTH);
    const amp = voice.gain(0);
    shapeHit(amp.gain, time, 0.14 * velocity, 0.7, 0.003);
    const noise = voice.noise();
    noise.connect(voice.filter('highpass', 3500)).connect(amp);
    noise.connect(voice.filter('bandpass', 6000, 1.5)).connect(voice.gain(0.6)).connect(amp);
    amp.connect(out);
    voice.done();
  }
};

// Reversed-cymbal swell that builds over the note and cuts off on the next downbeat
const swell: Instrument = {
  play(ctx, out, { time, duration, velocity }) {
    const end = time + duration;
    const voice = new Voice(ctx, time, end + 0.1);
    const amp = voice.gain(0);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.16 * velocity, end);
    amp.gain.linearRampToValueAtTime(0, end + 0.05);
    voice.noise().connect(voice.filter('highpass', 2500)).connect(amp).connect(out);
    voice.done();
  }
};

export const INSTRUMENTS = {
  strings,
  spiccato,
  lowStrings,
  horn,
  brass,
  lowBrass,
  brassSwell,
  harp,
  lute,
  pizzicato,
  bell,
  flute,
  choir,
  timpani,
  taikoLow,
  taikoHigh,
  tom,
  bassDrum,
  snare,
  shaker,
  crash,
  swell
} satisfies Record<string, Instrument>;

export type InstrumentName = keyof typeof INSTRUMENTS;
