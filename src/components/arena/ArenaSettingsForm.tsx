'use client';

import React from 'react';
import { MAX_FAIR_LEVEL, MAX_SIDES, TURN_SECONDS_CHOICES, WEATHER_CHOICES, arenaGridSize, mirrorSymmetry, weatherChoiceName } from '@/lib/pvp/arena';
import { RoomSettings } from '@/lib/pvp/room';

const LABEL = 'text-xs font-bold uppercase tracking-wider text-slate-400';
const SELECT = 'mt-1 w-full rounded-lg bg-slate-800 px-2 py-1.5 text-sm text-slate-100 ring-1 ring-white/10 disabled:opacity-60';

// The rules of a free-for-all or team battle: the host's to set (everyone else sees them), and the
// same for a practice battle against the AI. `players` counts the people in it (the AI's sides are
// the settings' `bots`).
export const ArenaSettingsForm: React.FC<{
  settings: RoomSettings;
  players: number;
  onChange?: (settings: RoomSettings) => void;
  // Practice against the AI: at least one AI side, and no one else
  practice?: boolean;
}> = ({ settings, players, onChange, practice = false }) => {
  const disabled = !onChange;
  const set = <K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) => onChange?.({ ...settings, [key]: value });
  const sides = Math.min(MAX_SIDES, players + settings.bots);
  const mirrorable = mirrorSymmetry(sides) > 1;
  const maxBots = MAX_SIDES - players;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <label className="block">
        <span className={LABEL}>Battle</span>
        <select className={SELECT} disabled={disabled} value={settings.mode} onChange={event => set('mode', event.target.value as RoomSettings['mode'])}>
          <option value="ffa">Free-for-all</option>
          <option value="teams">Teams</option>
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>{practice ? 'AI opponents' : 'AI sides'}</span>
        <select className={SELECT} disabled={disabled} value={settings.bots} onChange={event => set('bots', Number(event.target.value))}>
          {Array.from({ length: maxBots + 1 }, (_, count) => count).filter(count => !practice || count >= 1).map(count => (
            <option key={count} value={count}>{count === 0 ? 'None' : count}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>AI skill</span>
        <select className={SELECT} disabled={disabled || settings.bots === 0} value={settings.botDifficulty} onChange={event => set('botDifficulty', event.target.value as RoomSettings['botDifficulty'])}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>Weather</span>
        <select className={SELECT} disabled={disabled} value={settings.weather} onChange={event => set('weather', event.target.value as RoomSettings['weather'])}>
          {WEATHER_CHOICES.map(choice => <option key={choice} value={choice}>{weatherChoiceName(choice)}</option>)}
        </select>
      </label>
      <label className="block" title={mirrorable ? 'Mirrored: the map looks the same from every side (or team)' : `A map can't be mirrored for ${sides} sides`}>
        <span className={LABEL}>Map</span>
        <select className={SELECT} disabled={disabled} value={mirrorable ? settings.mapStyle : 'random'} onChange={event => set('mapStyle', event.target.value as RoomSettings['mapStyle'])}>
          <option value="random">Random</option>
          <option value="mirrored" disabled={!mirrorable}>Mirrored{mirrorable ? '' : ' (not for this many)'}</option>
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>Turn time</span>
        <select className={SELECT} disabled={disabled} value={settings.turnSeconds} onChange={event => set('turnSeconds', Number(event.target.value))}>
          {TURN_SECONDS_CHOICES.map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>Cards</span>
        <select className={SELECT} disabled={disabled} value={settings.fair ? 'fair' : 'own'} onChange={event => set('fair', event.target.value === 'fair')}>
          <option value="fair">Fair: all at one level</option>
          <option value="own">Everyone&apos;s own levels</option>
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>Fair level</span>
        <select className={SELECT} disabled={disabled || !settings.fair} value={settings.fairLevel} onChange={event => set('fairLevel', Number(event.target.value))}>
          {Array.from({ length: MAX_FAIR_LEVEL }, (_, i) => i + 1).map(level => <option key={level} value={level}>Level {level}</option>)}
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>Fog of war</span>
        <select className={SELECT} disabled={disabled} value={settings.fog ? 'on' : 'off'} onChange={event => set('fog', event.target.value === 'on')}>
          <option value="off">Off</option>
          <option value="on">On</option>
        </select>
      </label>
      <p className="col-span-2 text-xs text-slate-400 sm:col-span-3">
        {sides} {sides === 1 ? 'side' : 'sides'} · a map {arenaGridSize(sides) * 2 + 1} hexes across · {settings.maxRounds} rounds
        {settings.fair ? ` · every card at level ${settings.fairLevel}, skill trees off` : ''}
      </p>
    </div>
  );
};
