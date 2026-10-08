import React, { useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { isStoragePersisted } from '@/lib/offline';
import { TroopId, MOB_IDS } from '@/lib/game/troops';
import { LEVEL_COUNT } from '@/lib/campaign/levels';
import {
  exportSave, highestCleared, parseSave, profilePower, replaceProfile, resetProfile, totalStars, useHasHydrated, useProfile
} from '@/lib/meta/profile';
import { useMusic } from '@/lib/audio/music';
import { clearSavedGame, readRawSave, writeRawSave } from '../game/storage/GameStorage';
import { TroopCard } from '../game/cards/TroopCard';
import { MenuShell, CARD_CLASS, SECONDARY_BUTTON } from './MenuShell';
import {
  DownloadIcon, StatsIcon, TrashIcon, UploadIcon
} from '../game/icons';

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds % 60}s`;
};

const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent = '#f1f5f9' }) => (
  <div className="rounded-xl bg-slate-800/80 px-3 py-2">
    <div className="font-display text-2xl" style={{ color: accent }}>{value}</div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
  </div>
);

// Lifetime statistics, settings, and saving progress to (or loading it from) a file
export const StatsScreen: React.FC = () => {
  const profile = useProfile();
  const hydrated = useHasHydrated();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  // Read in the browser only, so the server render matches
  const [savesProtected, setSavesProtected] = useState<boolean | null>(null);
  useEffect(() => {
    void isStoragePersisted().then(setSavesProtected);
  }, []);
  useMusic('menu');

  const s = profile.stats;
  const winRate = s.battles > 0 ? Math.round(s.wins / s.battles * 100) : 0;
  const favourites = (Object.entries(s.cardsPlayed) as [TroopId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const mostPlayed = favourites[0]?.[1] ?? 1;
  const discovered = MOB_IDS.filter(id => (profile.bestiary[id]?.seen ?? 0) > 0).length;

  const handleExport = () => {
    const blob = new Blob([exportSave(readRawSave())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `world-war-hex-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    trackEvent('save_exported');
    setMessage({ text: 'Save file downloaded. Keep it somewhere safe!' });
  };

  const handleImport = async (file: File) => {
    const parsed = parseSave(await file.text());
    if (!parsed) {
      setMessage({ text: 'That file isn\'t a World War Hex save.', isError: true });
      return;
    }
    if (!window.confirm('Load this save? Your current progress on this computer will be replaced.')) return;
    replaceProfile(parsed.profile);
    writeRawSave(parsed.battle);
    trackEvent('save_imported');
    setMessage({ text: 'Save loaded. Welcome back, commander!' });
  };

  const handleReset = () => {
    if (!window.confirm('Erase all progress (coins, cards, stars and stats)? This cannot be undone.')) return;
    resetProfile();
    clearSavedGame();
    setMessage({ text: 'Progress erased. A fresh campaign awaits.' });
  };

  return (
    <MenuShell title="Stats" icon={<StatsIcon />} wide>
      {hydrated && (
        <>
          <section className={`${CARD_CLASS} p-4`}>
            <h2 className="font-display mb-3 text-2xl">Campaign</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Levels cleared" value={`${highestCleared(profile)}/${LEVEL_COUNT}`} accent="#fcd34d" />
              <Stat label="Stars" value={`${totalStars(profile)}/${LEVEL_COUNT * 3}`} accent="#facc15" />
              <Stat label="Army power" value={profilePower(profile)} accent="#fdba74" />
              <Stat label="Bestiary" value={`${discovered}/${MOB_IDS.length}`} accent="#86efac" />
            </div>
          </section>

          <section className={`${CARD_CLASS} mt-4 p-4`}>
            <h2 className="font-display mb-3 text-2xl">Battles</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Fought" value={s.battles} />
              <Stat label="Won" value={s.wins} accent="#86efac" />
              <Stat label="Win rate" value={`${winRate}%`} />
              <Stat label="Best streak" value={s.bestStreak} accent="#fcd34d" />
              <Stat label="Fastest win" value={s.fastestWinRounds ? `${s.fastestWinRounds} rounds` : '-'} />
              <Stat label="Enemies slain" value={s.enemiesSlain} accent="#fca5a5" />
              <Stat label="Troops lost" value={s.unitsLost} />
              <Stat label="Cards played" value={s.unitsDeployed} />
              <Stat label="Bosses defeated" value={s.bossesDefeated} accent="#f87171" />
              <Stat label="Castles stormed" value={s.castlesStormed} />
              <Stat label="Castles razed" value={s.castlesDestroyed} />
              <Stat label="Camps captured" value={s.campsCaptured} />
              <Stat label="Siege damage" value={s.siegeDamage} />
              <Stat label="Coins earned" value={s.coinsEarned} accent="#fde047" />
              <Stat label="Coins spent" value={s.coinsSpent} />
              <Stat label="Time in battle" value={formatTime(s.playSeconds)} />
            </div>
          </section>

          {favourites.length > 0 && (
            <section className={`${CARD_CLASS} mt-4 p-4`}>
              <h2 className="font-display mb-3 text-2xl">Favourite cards</h2>
              <div className="grid grid-cols-2 gap-x-5 gap-y-6 pl-1.5 pt-1.5 sm:grid-cols-4">
                {favourites.map(([id, count]) => (
                  <div key={id} className="flex flex-col gap-2">
                    <TroopCard type={id} level={profile.cards[id] ?? 1} size="lg" fill hideLevel />
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-700">
                        <div className="h-full rounded-full bg-sky-400" style={{ width: `${count / mostPlayed * 100}%` }} />
                      </div>
                      <span className="font-display text-lg" title="Times played">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Saves */}
      <section className={`${CARD_CLASS} mt-4 p-4`}>
        <h2 className="font-display text-2xl">Your save</h2>
        <p className="mt-1 text-xs text-slate-400">
          Progress saves in this browser. Download a save file to back it up or move it to another computer.
        </p>
        {savesProtected !== null && (
          <p className={`mt-1 text-xs ${savesProtected ? 'text-emerald-300' : 'text-slate-400'}`}>
            {savesProtected
              ? 'Protected from browser clean-up.'
              : 'Your browser may clear this if space runs low - keep a backup.'}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={handleExport} className={`${SECONDARY_BUTTON} flex items-center gap-1.5 text-sm`}>
            <DownloadIcon /> Download save
          </button>
          <button onClick={() => fileInputRef.current?.click()} className={`${SECONDARY_BUTTON} flex items-center gap-1.5 text-sm`}>
            <UploadIcon /> Load save file
          </button>
          <button onClick={handleReset} className={`${SECONDARY_BUTTON} flex items-center gap-1.5 bg-red-900 text-sm hover:bg-red-800`}>
            <TrashIcon /> Erase progress
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) handleImport(file);
              event.target.value = '';
            }}
          />
        </div>
        {message && (
          <p className={`mt-3 text-sm font-semibold ${message.isError ? 'text-red-400' : 'text-emerald-300'}`} role="status">{message.text}</p>
        )}
      </section>

      {/* Credits */}
      <section className={`${CARD_CLASS} mt-4 p-4 text-xs text-slate-300`}>
        <h2 className="font-display mb-2 text-2xl text-slate-100">Credits</h2>
        <ul className="flex flex-col gap-1">
          <li><b>Music:</b> &ldquo;Medieval: Exploration&rdquo;, &ldquo;Harvest Season&rdquo;, &ldquo;Battle&rdquo;, &ldquo;Victory Theme&rdquo; and &ldquo;Defeat Theme&rdquo; by RandomMind; &ldquo;Epic Boss Battle&rdquo; by Juhani Junkala (CC0, OpenGameArt)</li>
          <li><b>Characters:</b> KayKit Adventurers and Skeletons by Kay Lousberg (CC0); horse from the three.js examples (MIT)</li>
          <li><b>Battlefield:</b> KayKit Medieval Hexagon Pack, Halloween Bits and Dungeon Remastered by Kay Lousberg (CC0)</li>
          <li><b>Campaign map:</b> Map Pack by Kenney (kenney.nl, CC0)</li>
          <li><b>Fonts:</b> DynaPuff and Fredoka (SIL Open Font License)</li>
          <li><b>Icons:</b> Game Icons (game-icons.net, CC BY 3.0) and Lucide</li>
          <li><b>Sound effects:</b> synthesised with ZzFX</li>
        </ul>
      </section>
    </MenuShell>
  );
};
