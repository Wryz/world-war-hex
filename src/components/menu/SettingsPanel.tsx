import React, { useEffect, useState } from 'react';
import { FELL_DAMAGE, FIRE_DAMAGE } from '@/lib/game/battlefield';
import {
  CAMP_INCOME, FLANK_BONUS, HEIGHT_DAMAGE_PER_UNIT, MAX_HEIGHT_BONUS, FREE_UPKEEP_UNITS, MAX_FLANKERS, SIGHT_RANGE,
  SPEED_POINTS_PER_ROUND, TERRAIN_EFFECTS, TIME_SCORE_WEIGHTS, TURN_INCOME, UPKEEP_PER_UNIT
} from '@/lib/game/gameState';
import { PLAYER_CARD_IDS, TROOPS, TROOP_CLASSES, TroopClass, strongAgainst } from '@/lib/game/troops';
import { SIGNATURE_UNLOCK_LEVEL, getSignature } from '@/lib/game/signatures';
import { FOG_FROM_LEVEL } from '@/lib/campaign/levels';
import { MUSIC_CHANNELS, setChannelVolume, setMusicVolume, useMusicMix, useMusicVolume } from '@/lib/audio/music';
import { isAnalyticsAvailable, isAnalyticsEnabled, setAnalyticsEnabled } from '@/lib/analytics';
import { setMuted, setSfxVolume, useMuted, useSfxVolume } from '../game/utils/SoundPlayer';
import { setGameSpeed, useGameSpeed } from '../game/effects/effects';
import { TERRAIN_ORDER, TERRAIN_SHORT_EFFECTS } from '../game/hud/terrainInfo';
import { CARD_CLASS, SECONDARY_BUTTON } from './MenuShell';
import {
  AttackIcon, BondIcon, CampIcon, CloseIcon, CrownIcon, FogIcon, GameplayIcon, GoldIcon, GuideIcon, MusicIcon,
  SettingsIcon, ShieldIcon, SkullIcon, SoundOffIcon, SoundOnIcon, SpeedIcon, TerrainIcon, ThreatIcon, SignatureIcon, FellIcon, AbilityIcon
} from '../game/icons';
import type { Difficulty } from '../game/storage/GameStorage';
import { UI_SIZES, setUiSize, useUiSize } from '@/lib/uiSize';

export type SettingsTab = 'sound' | 'gameplay' | 'guide';
type Tab = SettingsTab;

const TABS: { id: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'sound', label: 'Sound', Icon: MusicIcon },
  { id: 'gameplay', label: 'Gameplay', Icon: GameplayIcon },
  { id: 'guide', label: 'Guide', Icon: GuideIcon }
];

const Slider: React.FC<{ label: string; detail?: string; value: number; onChange: (value: number) => void; disabled?: boolean }> = ({
  label, detail, value, onChange, disabled = false
}) => (
  <label className={`grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 ${disabled ? 'opacity-50' : ''}`}>
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-slate-100">{label}</span>
      {detail && <span className="block truncate text-xs text-slate-400">{detail}</span>}
    </span>
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      disabled={disabled}
      onChange={event => onChange(Number(event.target.value))}
      className="w-full accent-amber-400"
      aria-label={`${label} volume`}
    />
    <span className="text-right text-sm tabular-nums text-slate-300">{Math.round(value * 100)}%</span>
  </label>
);

const SoundTab: React.FC = () => {
  const muted = useMuted();
  const music = useMusicVolume();
  const mix = useMusicMix();
  const sfx = useSfxVolume();
  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => setMuted(!muted)} className={`${SECONDARY_BUTTON} flex w-fit items-center gap-2 text-sm`} aria-pressed={muted}>
        {muted ? <SoundOffIcon /> : <SoundOnIcon />} {muted ? 'Sound is off' : 'Sound is on'}
      </button>
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg text-amber-300">Music</h3>
        <Slider label="All music" value={music} onChange={setMusicVolume} disabled={muted} />
        <div className="ml-1 flex flex-col gap-3 border-l-2 border-slate-700 pl-4">
          {MUSIC_CHANNELS.map(channel => (
            <Slider
              key={channel.id}
              label={channel.label}
              detail={channel.detail}
              value={mix[channel.id]}
              onChange={value => setChannelVolume(channel.id, value)}
              disabled={muted}
            />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg text-amber-300">Effects</h3>
        <Slider label="Sound effects" detail="Swords, arrows, clicks" value={sfx} onChange={setSfxVolume} disabled={muted} />
      </section>
    </div>
  );
};

const DIFFICULTY_OPTIONS: { level: Difficulty; label: string; Icon: React.FC<{ color?: string }> }[] = [
  { level: 'easy', label: 'Easy', Icon: ShieldIcon },
  { level: 'medium', label: 'Medium', Icon: AttackIcon },
  { level: 'hard', label: 'Hard', Icon: SkullIcon }
];

// A one-off battle on a random map against a mixed army, outside the campaign
const QuickBattle: React.FC<{ onStart: (difficulty: Difficulty) => void }> = ({ onStart }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-800/60 p-3">
      <span>
        <b className="block text-slate-100">Quick battle</b>
        <span className="text-xs text-slate-400">A one-off battle on a random map, outside the campaign. Medium and hard are fought in the fog of war.</span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Difficulty">
          {DIFFICULTY_OPTIONS.map(({ level, label, Icon }) => (
            <button
              key={level}
              onClick={() => setDifficulty(level)}
              aria-pressed={difficulty === level}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-bold ${
                difficulty === level ? 'bg-amber-400 text-slate-900' : 'bg-slate-900 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Icon color="currentColor" /> {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => onStart(difficulty)}
          className="font-display ml-auto rounded-lg bg-sky-500 px-5 py-1.5 text-slate-900 shadow-[0_3px_0_#0369a1] hover:bg-sky-400"
        >
          Play
        </button>
      </div>
    </div>
  );
};

const GameplayTab: React.FC<{ onStartQuickBattle?: (difficulty: Difficulty) => void }> = ({ onStartQuickBattle }) => {
  const speed = useGameSpeed();
  const uiSize = useUiSize();
  // Read in the browser only, so the server render matches
  const [analyticsOn, setAnalyticsOn] = useState(false);
  useEffect(() => setAnalyticsOn(isAnalyticsEnabled()), []);
  return (
    <div className="flex flex-col gap-4 text-sm">
      {onStartQuickBattle && <QuickBattle onStart={onStartQuickBattle} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <b className="block text-slate-100">Text size</b>
          <span className="text-xs text-slate-400">Makes text, buttons and cards bigger on every screen.</span>
        </span>
        <div className="flex shrink-0 gap-1" role="radiogroup" aria-label="Text size">
          {UI_SIZES.map(option => (
            <button
              key={option.id}
              role="radio"
              aria-checked={uiSize === option.id}
              onClick={() => setUiSize(option.id)}
              className={`rounded-lg px-3 py-1.5 font-bold ${uiSize === option.id ? 'bg-amber-400 text-slate-900' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span>
          <b className="block text-slate-100">Battle speed</b>
          <span className="text-xs text-slate-400">How fast troops walk and fight. Also on the battle&apos;s top bar.</span>
        </span>
        <button onClick={() => setGameSpeed(speed === 1 ? 2 : 1)} className={`${SECONDARY_BUTTON} flex shrink-0 items-center gap-1.5`} aria-pressed={speed === 2}>
          <SpeedIcon /> {speed}x
        </button>
      </div>
      {isAnalyticsAvailable() && (
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={analyticsOn}
            onChange={event => {
              setAnalyticsEnabled(event.target.checked);
              setAnalyticsOn(event.target.checked);
            }}
            className="mt-1 accent-amber-400"
          />
          <span>
            <b className="block text-slate-100">Share anonymous gameplay stats</b>
            <span className="text-xs text-slate-400">Which levels are hard and which cards get played. No personal details, no recordings.</span>
          </span>
        </label>
      )}
      <p className="text-xs text-slate-400">Your progress, save file and lifetime stats live in Stats &amp; Save on the main menu.</p>
    </div>
  );
};

const GuideSection: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section>
    <h3 className="font-display mb-2 flex items-center gap-2 text-lg text-amber-300">{icon}{title}</h3>
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-200">{children}</div>
  </section>
);

const CLASS_ORDER: TroopClass[] = ['spear', 'cavalry', 'ranged', 'infantry', 'skirmisher', 'brute', 'magic'];

const GuideTab: React.FC = () => (
  <div className="flex flex-col gap-6">
    <GuideSection title="Winning a battle" icon={<CrownIcon />}>
      <p>
        Attack the enemy castle: a troop that can reach it strikes the castle - from the next hex for most troops, from 2-3
        hexes for archers and mages with a clear line of sight - unless it can finish off an enemy troop instead. Your troops strike
        any enemy that attacks within their reach - your castle or another troop - and it can&apos;t hit back. Bring its health down to 0 to win.
        If the last round ends first, it is decided on points: the gold value of the enemy troops you destroyed, half the gold you
        earned, and {TIME_SCORE_WEIGHTS.camps} for every camp you hold.
        The same points, plus {SPEED_POINTS_PER_ROUND} for every round left when you win, earn your second and third stars.
      </p>
    </GuideSection>
    <GuideSection title="Your turn" icon={<AttackIcon />}>
      <ol className="ml-5 list-decimal space-y-1.5">
        <li>Tap a card, then a glowing hex next to your castle or a camp you hold, to deploy it.</li>
        <li>Tap a troop, then a highlighted hex, to move it. Rough ground costs more; water and mountains block the way.</li>
        <li>End your turn. Troops in range fight automatically, each picking one enemy it can reach.</li>
      </ol>
    </GuideSection>
    <GuideSection title="Gold" icon={<GoldIcon />}>
      <p>
        You earn {TURN_INCOME} gold a turn, plus whatever gold mines your troops stand on and {CAMP_INCOME} for each camp you
        hold. Armies of more than {FREE_UPKEEP_UNITS} troops cost {UPKEEP_PER_UNIT} gold upkeep for each extra troop.
        Destroying an enemy pays half its cost, and damaging the enemy castle plunders gold.
      </p>
    </GuideSection>
    <GuideSection title="Tactics" icon={<ThreatIcon />}>
      <ul className="ml-5 list-disc space-y-1.5">
        <li><b>Zones of control:</b> stepping next to an enemy ends a troop&apos;s move. Fliers pass over enemy lines.</li>
        <li><b>Flanking:</b> when two or more of your troops attack the same enemy, each extra attacker adds +{Math.round(FLANK_BONUS * 100)}% damage, up to +{Math.round(FLANK_BONUS * MAX_FLANKERS * 100)}%. A lone attacker gets no bonus.</li>
        <li><b>Height:</b> every 1.0 of height (the number on each hex) you stand above your target adds +{Math.round(HEIGHT_DAMAGE_PER_UNIT * 100)}% damage, rounded to a whole percent and up to +{Math.round(MAX_HEIGHT_BONUS * 100)}%; attacking uphill loses the same. Ridges and forests block arrows from below.</li>
        <li><b>Threat preview:</b> press <kbd className="rounded bg-slate-700 px-1">T</kbd> in battle (or the crosshair) to see where enemies can strike next turn, and how much a selected troop would take.</li>
      </ul>
    </GuideSection>
    <GuideSection title="The battlefield" icon={<FellIcon />}>
      <p>
        <b>Great trees</b> tower over some forests: nothing walks through one, and they block arrows. Move a troop next to one,
        then tap the tree (it glows gold) to chop it down. It falls away from your troop onto the hex beyond, dealing {FELL_DAMAGE} damage
        to whoever stands there, friend or foe, and its trunk blocks that hex for the rest of the battle. Felled across water, it makes a bridge.
      </p>
      <p>
        <b>Wildfire</b>: lava sets the grass and woods around it alight now and then. Glowing embers warn you a turn ahead; then the hex
        burns for a round and a half: nothing can enter it, its smoke blocks arrows, and troops caught in it lose {FIRE_DAMAGE} health a turn.
        Fire spreads through forest and burns it down to open ground - cover can go up in smoke.
      </p>
    </GuideSection>
    <GuideSection title="Buildings" icon={<TerrainIcon terrain="watchtower" />}>
      <p>Buildings stand where neither side has the longer march. Step a troop onto one to take it; it stays yours, in your colours, until the enemy takes it back.</p>
      <ul className="flex flex-col gap-1">
        <li><TerrainIcon terrain="watchtower" /> <b>Watchtower</b>: high ground - a troop up there sees 2 hexes further and its arrows reach 1 further, and the tower keeps watch for you even when empty.</li>
        <li><TerrainIcon terrain="house" /> <b>House</b>: garrison a troop inside - 40% less damage, no flanking, hidden from anyone not next to it. Houses burn.</li>
        <li><TerrainIcon terrain="catapult" /> <b>Catapult tower</b>: a troop in it hurls a stone at the weakest enemy within 4 hexes every turn (5 damage), or at the enemy castle (2).</li>
        <li><TerrainIcon terrain="gate" /> <b>Walls and gates</b>: some battlefields have a stone wall across the middle. Whoever holds its gatehouse decides who passes; go round, or tear it down.</li>
        <li><TerrainIcon terrain="bridge" /> <b>Bridges</b> cross the water - chokepoints that can be torn down, or built anew.</li>
        <li><TerrainIcon terrain="blacksmith" /> <b>Blacksmith</b>: all your troops attack 10% harder. <TerrainIcon terrain="barracks" /> <b>Barracks</b>: deploy there; recruits get 20% more health. <TerrainIcon terrain="tavern" /> <b>Tavern</b>: +3 gold a turn. <TerrainIcon terrain="lumbermill" /> <b>Lumber mill</b>: fell great trees from 2 hexes away.</li>
      </ul>
    </GuideSection>
    <GuideSection title="Work orders" icon={<AbilityIcon ability="engineering" />}>
      <p>Some troops can work on the hex next to them instead of moving: select the troop, then tap a gold hex (if it could also move there, pick Move or the work).</p>
      <ul className="flex flex-col gap-1">
        <li><AbilityIcon ability="demolition" /> <b>Siege Sappers</b> tear down walls, gates, bridges, fallen trunks and stakes.</li>
        <li><AbilityIcon ability="firebrand" /> <b>Rogues</b> set dry ground alight: it smoulders through the enemy&apos;s turn, then burns.</li>
        <li><AbilityIcon ability="engineering" /> <b>Engineers</b> build a bridge over the water, or plant stakes on open ground that cavalry can&apos;t cross.</li>
        <li><FellIcon /> Any troop on foot can fell a great tree next to it.</li>
      </ul>
    </GuideSection>
    <GuideSection title="Fog of war" icon={<FogIcon />}>
      <p>
        From level {FOG_FROM_LEVEL} you only see enemy troops your own troops, castle and camps can see: {SIGHT_RANGE} hexes,
        one more from hills and snow, and one more for scouts (skirmishers and fliers). Forests hide troops unless you are
        right next to them. A troop that attacks gives itself away, and walking into a hidden enemy stops you short - an ambush.
      </p>
    </GuideSection>
    <GuideSection title="Counters" icon={<AttackIcon />}>
      <p>Every troop belongs to a class, and each class hits some others 50% harder (spears hit cavalry twice as hard):</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {CLASS_ORDER.map(troopClass => (
          <li key={troopClass} className="rounded-lg bg-slate-800/80 px-3 py-2">
            <b>{TROOP_CLASSES[troopClass].plural}</b>
            <span className="text-slate-400"> beat </span>
            {strongAgainst(troopClass).length > 0
              ? strongAgainst(troopClass).map(other => TROOP_CLASSES[other].plural).join(', ')
              : <span className="text-slate-400">no one - but their spells ignore cover</span>}
          </li>
        ))}
      </ul>
    </GuideSection>
    <GuideSection title="Cards and bonds" icon={<BondIcon />}>
      <p>
        You bring four cards into each battle. Some pairs of cards form bonds: bring both and their troops fight better.
        The Army screen lists every bond.
      </p>
    </GuideSection>
    <GuideSection title="Signature abilities" icon={<SignatureIcon />}>
      <p>
        From level {SIGNATURE_UNLOCK_LEVEL} every card has a signature ability that works only when its condition is met, and it grows stronger every two levels (rank I at level 2 up to VII):
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {PLAYER_CARD_IDS.map(id => {
          const signature = getSignature(id);
          return signature && (
            <li key={id} className="rounded-lg bg-slate-800/80 px-3 py-2">
              <b>{TROOPS[id].name}: {signature.name}</b>
              <span className="block text-slate-400">{signature.describe(1)}</span>
            </li>
          );
        })}
      </ul>
    </GuideSection>
    <GuideSection title="Your castle" icon={<CrownIcon />}>
      <p>
        Before the first turn, pick one of a few sites on your edge of the map for your castle. The enemy builds across the map from you,
        and the camps go up halfway between - so where you build shapes the whole battle.
      </p>
    </GuideSection>
    <GuideSection title="Terrain" icon={<CampIcon />}>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {TERRAIN_ORDER.map(terrain => (
          <li key={terrain} className="flex items-start gap-2 rounded-lg bg-slate-800/80 px-3 py-2" title={TERRAIN_EFFECTS[terrain].description}>
            <TerrainIcon terrain={terrain} className="mt-0.5 shrink-0 text-base" />
            <span className="min-w-0">
              <b className="block">{TERRAIN_EFFECTS[terrain].name}</b>
              <span className="text-xs text-slate-400">{TERRAIN_SHORT_EFFECTS[terrain]}</span>
            </span>
          </li>
        ))}
      </ul>
    </GuideSection>
  </div>
);

// Settings, opened from the main menu: sound levels for each kind of music, gameplay options (and
// quick battles) and the guide
export const SettingsPanel: React.FC<{
  onClose: () => void;
  initialTab?: Tab;
  onStartQuickBattle?: (difficulty: Difficulty) => void;
}> = ({ onClose, initialTab = 'sound', onStartQuickBattle }) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`${CARD_CLASS} animate-fadeIn flex max-h-[92vh] w-full max-w-2xl flex-col rounded-b-none sm:rounded-2xl`}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <h2 className="font-display flex items-center gap-2 text-2xl"><SettingsIcon /> Settings</h2>
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Close">
            <CloseIcon className="text-lg" />
          </button>
        </div>
        <div className="flex gap-2 border-b border-white/10 px-5 py-3" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                tab === id ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto px-5 py-5">
          {tab === 'sound' && <SoundTab />}
          {tab === 'gameplay' && <GameplayTab onStartQuickBattle={onStartQuickBattle} />}
          {tab === 'guide' && <GuideTab />}
        </div>
      </div>
    </div>
  );
};
