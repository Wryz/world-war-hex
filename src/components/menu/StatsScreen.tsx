import React from 'react';
import { TroopId, MOB_IDS } from '@/lib/game/troops';
import { LEVEL_COUNT } from '@/lib/campaign/levels';
import { highestCleared, profilePower, totalStars, useHasHydrated, useProfile } from '@/lib/meta/profile';
import { useMusic } from '@/lib/audio/music';
import { TroopCard } from '../game/cards/TroopCard';
import { MenuShell, CARD_CLASS } from './MenuShell';
import { SaveFileControls } from './SaveFileControls';
import { StatsIcon } from '../game/icons';

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds % 60}s`;
};

const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent = '#f1f5f9' }) => (
  <div className="rounded-xl bg-slate-800/80 px-3 py-2">
    <div className="font-display text-2xl" style={{ color: accent }}>{value}</div>
    <div className="text-[0.625rem] font-bold uppercase tracking-wider text-slate-400">{label}</div>
  </div>
);

// Lifetime statistics, settings, and saving progress to (or loading it from) a file
export const StatsScreen: React.FC = () => {
  const profile = useProfile();
  const hydrated = useHasHydrated();
  useMusic('menu');

  const s = profile.stats;
  const winRate = s.battles > 0 ? Math.round(s.wins / s.battles * 100) : 0;
  const favourites = (Object.entries(s.cardsPlayed) as [TroopId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const mostPlayed = favourites[0]?.[1] ?? 1;
  const discovered = MOB_IDS.filter(id => (profile.bestiary[id]?.seen ?? 0) > 0).length;

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
        <SaveFileControls title={<h2 className="font-display text-2xl">Your save</h2>} />
      </section>

      {/* Credits */}
      <section className={`${CARD_CLASS} mt-4 p-4 text-xs text-slate-300`}>
        <h2 className="font-display mb-2 text-2xl text-slate-100">Credits</h2>
        <ul className="flex flex-col gap-1">
          <li><b>Music:</b> &ldquo;Medieval: Exploration&rdquo;, &ldquo;Harvest Season&rdquo;, &ldquo;Battle&rdquo;, &ldquo;Victory Theme&rdquo; and &ldquo;Defeat Theme&rdquo; by RandomMind; &ldquo;Epic Boss Battle&rdquo; by Juhani Junkala; &ldquo;Battle Theme A&rdquo; by cynicmusic (all CC0, OpenGameArt)</li>
          <li>
            <b>Region battle music</b> (CC BY, OpenGameArt): &ldquo;Wind Run&rdquo; by TAD; &ldquo;Land of Misdeeds&rdquo; composed by Jonathan Shaw
            (www.jshaw.co.uk); &ldquo;The Eternal Sands&rdquo; by HitCtrl; &ldquo;Steeps of Destiny&rdquo;, &ldquo;Ef Humeni Glorem&rdquo; and
            &ldquo;Demonium&rdquo; by Alexandr Zhelanov (soundcloud.com/alexandr-zhelanov); &ldquo;Dark Descent&rdquo; and &ldquo;Colossal Boss
            Battle Theme&rdquo; by Matthew Pablo (www.matthewpablo.com)
          </li>
          <li>
            <b>Region boss music</b> (OpenGameArt): &ldquo;A Slave To No One&rdquo; and &ldquo;Showdown of Misdeeds&rdquo; composed by Jonathan Shaw
            (www.jshaw.co.uk, CC BY 3.0); &ldquo;Drums in the Deepwood&rdquo; by Elyvilon (CC BY 4.0); &ldquo;Determined Pursuit&rdquo; by Emma_MA (CC0);
            &ldquo;Jrpg Desert Boss Theme&rdquo; by ProjectHelmet (CC BY 4.0); &ldquo;Ragnar&ouml;k&rdquo; by William Hector (CC BY 4.0); &ldquo;The
            Desecrated Temple&rdquo; by Insydnis (CC BY 3.0); &ldquo;Wasteland Showdown&rdquo; and &ldquo;Theme of Com-Mecha&rdquo;, music by Matthew
            Pablo (www.matthewpablo.com, CC BY 3.0); &ldquo;The March Upon the Red Mountain&rdquo; by Hitctrl (CC BY 3.0)
          </li>
          <li>Music tracks were trimmed to loop and levelled in volume; sources at opengameart.org</li>
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
