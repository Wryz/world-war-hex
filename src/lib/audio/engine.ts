// Audio graph and players for the music. Works against any BaseAudioContext, so tracks can also be
// rendered offline (e.g. to check levels) with an OfflineAudioContext.

import { INSTRUMENTS, getReverbImpulse } from './instruments';
import type { CompiledTrack, Layer, PartDef } from './score';

// Battle intensity scales the whole track as well as adding layers
const INTENSITY_LEVELS: Record<Layer, number> = { 0: 0.85, 1: 1, 2: 1.1 };
const FILE_INTENSITY_LEVELS: Record<Layer, number> = { 0: 0.8, 1: 1, 2: 1.1 };
const DUCK_LEVEL = 0.35;

// Ramp smoothly from wherever the parameter is now
const rampTo = (param: AudioParam, value: number, time: number, seconds: number) => {
  param.cancelScheduledValues(time);
  param.setValueAtTime(param.value, time);
  param.linearRampToValueAtTime(value, time + seconds);
};

/**
 * The shared output chain: tracks → duck → compressor → master (volume and mute) → speakers.
 * Stingers bypass the duck so they sit on top of the music.
 */
export class MusicMixer {
  readonly music: GainNode;
  readonly stingers: GainNode;
  readonly master: GainNode;
  private readonly compressor: DynamicsCompressorNode;

  constructor(readonly ctx: BaseAudioContext, destination: AudioNode = ctx.destination) {
    this.music = ctx.createGain();
    this.stingers = ctx.createGain();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.25;
    this.music.connect(this.compressor);
    this.stingers.connect(this.compressor);
    this.compressor.connect(this.master).connect(destination);
  }

  setLevel(level: number, seconds = 0.3) {
    rampTo(this.master.gain, level, this.ctx.currentTime, seconds);
  }

  // Dip the music under a stinger, then bring it back
  duck(seconds: number) {
    const now = this.ctx.currentTime;
    const gain = this.music.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(DUCK_LEVEL, now, 0.04);
    gain.setTargetAtTime(1, now + seconds, 0.35);
  }
}

export interface TrackPlayer {
  readonly output: GainNode; // Crossfade fader
  schedule: (until: number) => void;
  setIntensity: (level: Layer, time?: number) => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
}

export const fadeIn = (player: TrackPlayer, ctx: BaseAudioContext, seconds: number, time = ctx.currentTime) => {
  player.output.gain.setValueAtTime(0, time);
  player.output.gain.linearRampToValueAtTime(1, time + seconds);
};

export const fadeOut = (player: TrackPlayer, ctx: BaseAudioContext, seconds: number) => {
  rampTo(player.output.gain, 0, ctx.currentTime, seconds);
};

// Persistent nodes for one part: its level, optional insert effect, pan and intensity gate
interface Channel {
  input: GainNode;
  gate: GainNode;
  nodes: AudioNode[];
}

/**
 * Plays a compiled track with a lookahead scheduler: each call to `schedule` queues every
 * 16th-note step that starts before `until`, using AudioContext time for sample accuracy.
 */
export class SynthTrackPlayer implements TrackPlayer {
  readonly output: GainNode;
  // Length of a one-shot track, after which nothing more is scheduled
  readonly endTime: number;
  private readonly ctx: BaseAudioContext;
  private readonly level: GainNode;
  private readonly dry: GainNode;
  private readonly reverbIn: GainNode;
  private readonly echoIn: GainNode;
  private readonly effectNodes: AudioNode[];
  private readonly channels = new Map<PartDef, Channel>();
  private position = 0;
  private step = 0;
  private nextStepTime: number;
  private finished = false;

  constructor(
    mixer: MusicMixer,
    private readonly track: CompiledTrack,
    destination: AudioNode,
    startTime: number,
    private intensity: Layer
  ) {
    const ctx = mixer.ctx;
    this.ctx = ctx;
    this.nextStepTime = startTime;
    this.endTime = track.loopFrom === null ? startTime + track.duration : Infinity;

    this.output = ctx.createGain();
    this.level = ctx.createGain();
    this.level.gain.value = track.def.level * this.intensityLevel(intensity);
    this.level.connect(this.output).connect(destination);

    this.dry = ctx.createGain();
    this.dry.connect(this.level);

    // Convolution reverb for space; its lows are cut so drums and basses do not turn to mud
    this.reverbIn = ctx.createGain();
    const reverbLowCut = ctx.createBiquadFilter();
    reverbLowCut.type = 'highpass';
    reverbLowCut.frequency.value = 220;
    const reverb = ctx.createConvolver();
    reverb.buffer = getReverbImpulse(ctx);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.9;
    this.reverbIn.connect(reverbLowCut).connect(reverb).connect(reverbReturn).connect(this.level);

    // Tempo-synced echo for leads, darkening with each repeat
    this.echoIn = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = Math.min(1.5, (track.def.echoBeats ?? 0.75) * track.secondsPerBeat);
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2500;
    this.echoIn.connect(delay).connect(echoTone).connect(feedback).connect(delay);
    echoTone.connect(this.level);
    echoTone.connect(this.reverbIn);

    this.effectNodes = [this.output, this.level, this.dry, this.reverbIn, reverbLowCut, reverb, reverbReturn, this.echoIn, delay, feedback, echoTone];
    for (const part of track.parts) this.channels.set(part, this.createChannel(part));
  }

  schedule(until: number) {
    const now = this.ctx.currentTime;
    while (!this.finished && this.nextStepTime < until) {
      // Steps we are already too late for (e.g. after the tab stalled) are skipped, not crammed in
      if (this.nextStepTime >= now - 0.03) this.playStep(this.nextStepTime);
      this.advance();
    }
  }

  setIntensity(level: Layer, time = this.ctx.currentTime) {
    if (!this.track.def.respondsToIntensity || level === this.intensity) return;
    this.intensity = level;
    for (const [part, channel] of this.channels) {
      channel.gate.gain.setTargetAtTime(this.isActive(part) ? 1 : 0, time, 0.4);
    }
    this.level.gain.setTargetAtTime(this.track.def.level * this.intensityLevel(level), time, 0.6);
  }

  // Suspending the AudioContext pauses synthesised music, so there is nothing to do here
  pause() {}
  resume() {}

  dispose() {
    this.finished = true;
    for (const node of this.effectNodes) node.disconnect();
    for (const channel of this.channels.values()) channel.nodes.forEach(node => node.disconnect());
    this.channels.clear();
  }

  private intensityLevel(level: Layer) {
    return this.track.def.respondsToIntensity ? INTENSITY_LEVELS[level] : 1;
  }

  private isActive(part: PartDef) {
    if (!this.track.def.respondsToIntensity) return true;
    return this.intensity >= (part.layer ?? 0) && this.intensity <= (part.maxLayer ?? 2);
  }

  private createChannel(part: PartDef): Channel {
    const ctx = this.ctx;
    const input = ctx.createGain();
    input.gain.value = part.gain;
    const gate = ctx.createGain();
    gate.gain.value = this.isActive(part) ? 1 : 0;
    const nodes: AudioNode[] = [input, gate];

    let tail: AudioNode = input;
    const insert = INSTRUMENTS[part.instrument].createInsert?.(ctx);
    if (insert) {
      tail.connect(insert.input);
      tail = insert.output;
      nodes.push(...insert.nodes);
    }
    if (part.pan) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = part.pan;
      tail.connect(panner);
      tail = panner;
      nodes.push(panner);
    }
    tail.connect(gate).connect(this.dry);

    const sends: [number | undefined, AudioNode][] = [[part.reverb, this.reverbIn], [part.echo, this.echoIn]];
    for (const [amount, target] of sends) {
      if (!amount) continue;
      const send = ctx.createGain();
      send.gain.value = amount;
      gate.connect(send).connect(target);
      nodes.push(send);
    }
    return { input, gate, nodes };
  }

  private playStep(time: number) {
    const { secondsPerBeat } = this.track;
    for (const event of this.track.form[this.position][this.step]) {
      const channel = this.channels.get(event.part);
      if (!channel || !this.isActive(event.part)) continue;

      // A little human looseness in timing and dynamics
      const looseness = event.part.kind === 'drums' ? 0.004 : 0.012;
      const start = time + event.offset * secondsPerBeat + (Math.random() - 0.5) * looseness;
      const velocity = Math.min(1, event.velocity * (0.93 + Math.random() * 0.14));
      const instrument = INSTRUMENTS[event.part.instrument];
      for (const midi of event.midis) {
        instrument.play(this.ctx, channel.input, {
          time: Math.max(0, start),
          midi,
          duration: event.duration * secondsPerBeat,
          velocity
        });
      }
    }
  }

  private advance() {
    this.nextStepTime += this.track.secondsPerStep;
    this.step++;
    if (this.step < this.track.form[this.position].length) return;
    this.step = 0;
    this.position++;
    if (this.position < this.track.form.length) return;
    if (this.track.loopFrom === null) this.finished = true;
    else this.position = this.track.loopFrom;
  }
}

/**
 * Loops an audio file through the same graph, so volume, mute and crossfades apply to it too
 */
export class FileTrackPlayer implements TrackPlayer {
  readonly output: GainNode;
  private readonly level: GainNode;
  private readonly element: HTMLAudioElement;
  private readonly source: MediaElementAudioSourceNode;
  private paused = false;

  constructor(
    private readonly ctx: AudioContext,
    url: string,
    destination: AudioNode,
    private readonly respondsToIntensity: boolean,
    intensity: Layer
  ) {
    this.element = new Audio(url);
    this.element.loop = true;
    this.element.preload = 'auto';
    this.source = ctx.createMediaElementSource(this.element);
    this.level = ctx.createGain();
    this.level.gain.value = respondsToIntensity ? FILE_INTENSITY_LEVELS[intensity] : 1;
    this.output = ctx.createGain();
    this.source.connect(this.level).connect(this.output).connect(destination);
    this.resume();
  }

  // The file streams itself
  schedule() {}

  setIntensity(level: Layer, time = this.ctx.currentTime) {
    if (this.respondsToIntensity) this.level.gain.setTargetAtTime(FILE_INTENSITY_LEVELS[level], time, 0.6);
  }

  pause() {
    this.paused = true;
    this.element.pause();
  }

  resume() {
    this.paused = false;
    this.element.play().catch(() => {
      // Blocked until the player interacts with the page; retried when audio unlocks
    });
  }

  // Retry playback that the browser blocked before the first interaction
  retry() {
    if (!this.paused && this.element.paused) this.resume();
  }

  dispose() {
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.source.disconnect();
    this.level.disconnect();
    this.output.disconnect();
  }
}
