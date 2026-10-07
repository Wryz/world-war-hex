// Minimal types for the parts of ZzFX (https://github.com/KilledByAPixel/ZzFX) the game uses
declare module 'zzfx' {
  export function zzfx(...parameters: (number | undefined)[]): AudioBufferSourceNode;
  export const ZZFX: {
    volume: number;
    audioContext: AudioContext;
  };
}
