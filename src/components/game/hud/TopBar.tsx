import React, { useState } from 'react';
import { GameState, PlayerType } from '@/types/game';
import { BASE_MAX_HEALTH, getActivePlayer, getCastleMaxHealth, getIncome, getMaxRounds, getTimeScore, isFogOfWar } from '@/lib/game/gameState';
import { getSides, isMultiSide } from '@/lib/game/sides';
import { sideColor } from '../sideColors';
import { sideLabel } from './sideLabels';
import { WEATHER, activeWeather, stormForecast } from '@/lib/game/regionRules';
import { PANEL_CLASS } from './styles';
import { CrownIcon, FogIcon, GoldIcon, HomeIcon, ResignIcon, SaveIcon, SoundOffIcon, SoundOnIcon, SpeedIcon, ThreatIcon, WeatherIcon } from '../icons';
import { setGameSpeed, useCastleShownDamage, useGameSpeed } from '../effects/effects';
import { useShownCastleHealth } from '../effects/healthTimeline';

// The time-up points show for this many final rounds
const POINTS_SHOWN_ROUNDS = 3;

interface TopBarProps {
  gameState: GameState;
  isAITurn: boolean;
  timer: number;
  showTimer: boolean;
  onSave?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onQuit: () => void;
  // Give up the battle (offered on your own turn)
  onResign?: () => void;
  // The threat preview: hexes enemies can strike next turn
  showThreats: boolean;
  onToggleThreats: () => void;
  // The side the battle is seen from
  viewer?: PlayerType;
  // What resigning means (a defeat against the AI; leaving the battle when others play on)
  resignNote?: string;
}

const ICON_BUTTON_CLASS = 'rounded-md p-1 text-slate-300 hover:bg-slate-700 hover:text-white';

const CastleHealth: React.FC<{ title: string; health: number; max: number; color: string; alignRight?: boolean }> = ({
  title, health, max, color, alignRight = false
}) => {
  const ratio = max > 0 ? Math.max(0, health) / max : 0;

  return (
    <div className={`flex items-center gap-2 ${alignRight ? 'flex-row-reverse' : ''}`} title={`${title}: ${Math.max(0, health)}/${max}`}>
      <CrownIcon className="text-lg" color={color} />
      <div className="relative w-28 h-2.5 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`absolute top-0 bottom-0 transition-all duration-700 ${alignRight ? 'right-0' : 'left-0'}`}
          style={{ width: `${ratio * 100}%`, background: color }}
        />
      </div>
      <span className="w-6 text-xs font-bold tabular-nums" style={{ textAlign: alignRight ? 'right' : 'left' }}>
        {Math.max(0, health)}
      </span>
    </div>
  );
};

// Compact status bar: whose turn it is, both castles' health, and the player's gold
export const TopBar: React.FC<TopBarProps> = ({
  gameState, isAITurn, timer, showTimer, onSave, isMuted, onToggleMute, onQuit, onResign, showThreats, onToggleThreats,
  viewer = 'player', resignNote = 'It counts as a defeat.'
}) => {
  // Asking to make sure before giving up: on the turn it was asked on, while resigning is on offer
  const [confirmTurn, setConfirmTurn] = useState<number | null>(null);
  const confirmingResign = confirmTurn === gameState.turnNumber && !!onResign;
  const setConfirmingResign = (open: boolean) => setConfirmTurn(open ? gameState.turnNumber : null);
  const { players, turnNumber } = gameState;
  // Hits landing on a castle in the battle being fought, ahead of its result
  const castleHits = useCastleShownDamage();
  // (only while the attack is being fought, so it never counts twice once its result is in)
  const shownDamage: Record<string, number> = gameState.currentPhase === 'combat' && gameState.siege ? castleHits : {};
  const multi = isMultiSide(gameState);
  const enemy = multi ? viewer : 'ai';
  // (and a stone from a catapult once it has landed)
  const yourCastle = useShownCastleHealth(viewer, Math.max(0, (players[viewer]?.baseHealth ?? BASE_MAX_HEALTH) - (shownDamage[viewer] ?? 0)));
  const enemyCastle = useShownCastleHealth(enemy, Math.max(0, (players[enemy]?.baseHealth ?? BASE_MAX_HEALTH) - (shownDamage[enemy] ?? 0)));
  const maxRounds = getMaxRounds(gameState);
  const isFinalRound = turnNumber >= maxRounds;
  const speed = useGameSpeed();
  const income = getIncome(gameState, viewer);
  const active = getActivePlayer(gameState);
  const incomeDetails = [
    `+${income.base} income`,
    income.mines > 0 && `+${income.mines} gold mines`,
    income.camps > 0 && `+${income.camps} camps`,
    income.taverns > 0 && `+${income.taverns} taverns`,
    income.upkeep > 0 && `-${income.upkeep} upkeep`
  ].filter(Boolean).join(', ');

  return (
    <div className="fixed top-[calc(0.75rem+var(--safe-t))] left-[calc(0.75rem+var(--safe-l))] right-[calc(0.75rem+var(--safe-r))] z-30 flex items-start justify-between gap-3 pointer-events-none">
      {/* Turn */}
      <div className={`${PANEL_CLASS} pointer-events-auto flex items-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-sm sm:gap-2 sm:px-3`}>
        <span className={`font-display ${isFinalRound ? 'text-red-400 animate-pulse' : 'text-slate-300'}`} title={`The battle ends after round ${maxRounds}`}>
          <span className="hidden sm:inline">Round </span>{Math.max(1, turnNumber)}<span className="text-slate-500">/{maxRounds}</span>
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold text-white sm:px-2.5"
          style={{ background: sideColor(active), color: active === viewer || !multi ? undefined : '#0f172a' }}
        >
          {multi ? (active === viewer ? 'Your turn' : `${sideLabel(gameState, active, viewer)}'s turn`) : isAITurn ? 'Enemy turn' : 'Your turn'}
        </span>
        {/* The weather: lit while a storm rages, with a word when it is about to change */}
        {gameState.settings?.weather && (() => {
          const weather = gameState.settings.weather;
          const info = WEATHER[weather];
          // (only a storm lights up while it rages; fog and ash are there all battle)
          const raging = info.storm && activeWeather(gameState) === weather;
          const forecast = stormForecast(gameState);
          return (
            <span
              className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${raging ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400'}`}
              title={`${info.name}${info.storm ? (raging ? ' (raging)' : ' (calm)') : ''}: ${info.description}${forecast === 'coming' ? ' A storm blows up next round.' : forecast === 'ending' ? ' It blows over next round.' : ''}`}
              aria-label={info.name}
            >
              <WeatherIcon weather={weather} className={`text-base ${raging ? 'animate-pulse' : ''}`} />
              {forecast && <span className="text-[0.625rem] uppercase">{forecast === 'coming' ? 'Next' : 'Ends'}</span>}
            </span>
          );
        })()}
        {showTimer && (
          <span className={`font-mono text-xs font-bold tabular-nums ${timer <= 10 ? 'text-red-400 animate-pulse' : 'text-slate-300'}`}>
            {timer}s
          </span>
        )}
        {/* Near the end: the points that decide the battle if time runs out */}
        {!multi && turnNumber > maxRounds - POINTS_SHOWN_ROUNDS && (() => {
          const you = getTimeScore(gameState, 'player');
          const enemy = getTimeScore(gameState, 'ai');
          return (
            <span
              className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold tabular-nums"
              title={`If time runs out, the higher score wins. Kills ${you.kills}-${enemy.kills}, gold ${you.gold}-${enemy.gold}, camps ${you.camps}-${enemy.camps}`}
            >
              <span className="hidden sm:inline">Points </span><span className="text-sky-300">{you.total}</span>-<span className="text-rose-300">{enemy.total}</span>
            </span>
          );
        })()}
      </div>

      {/* Castles (from the width it fits at: below that, a landscape phone or small tablet, the
          castles' own health tags on the board show it, and the buttons on the right stay on screen) */}
      {multi ? (
        // (a battle between more sides: every side, its castle's health and its points, in turn order)
        <div className={`${PANEL_CLASS} pointer-events-auto hidden lg:flex items-center gap-2.5 px-3 py-2`}>
          {getSides(gameState).map(side => (
            <SideChip key={side} gameState={gameState} side={side} viewer={viewer} shownDamage={shownDamage[side] ?? 0} active={side === active} />
          ))}
        </div>
      ) : (
      <div className={`${PANEL_CLASS} pointer-events-auto hidden lg:flex items-center gap-3 px-3 py-2`}>
        <CastleHealth
          title="Your castle"
          health={yourCastle}
          max={getCastleMaxHealth(gameState, 'player')}
          color={sideColor('player')}
        />
        <span className="text-xs font-bold text-slate-500">VS</span>
        <CastleHealth
          title="Enemy castle"
          health={enemyCastle}
          max={getCastleMaxHealth(gameState, 'ai')}
          color={sideColor('ai')}
          alignRight
        />
      </div>
      )}

      {/* Treasury */}
      <div className={`${PANEL_CLASS} pointer-events-auto relative flex items-center gap-1 px-2 py-1.5 sm:gap-2 sm:px-3`}>
        {/* (a phone shows the gold beside the hand instead) */}
        <span id="hud-gold" className="font-display hidden items-center gap-1 text-base text-amber-300 sm:flex" title={`${income.total >= 0 ? '+' : ''}${income.total} gold per turn (${incomeDetails})`}>
          <GoldIcon className="text-lg" /> {players[viewer]?.points ?? 0}
          <span className={`text-xs ${income.upkeep > 0 ? 'text-rose-300' : 'text-amber-200/70'}`}>
            {income.total >= 0 ? '+' : ''}{income.total}
          </span>
        </span>
        <span className="mx-0.5 hidden h-5 w-px bg-slate-700 sm:block" />
        <button
          onClick={onToggleThreats}
          title={showThreats ? 'Hide enemy threats (T)' : 'Show where enemies can strike next turn (T)'}
          aria-label="Show enemy threats"
          aria-pressed={showThreats}
          className={`${ICON_BUTTON_CLASS} ${showThreats ? 'bg-rose-900/60 text-rose-200' : ''}`}
        >
          <ThreatIcon className="text-base" />
        </button>
        {isFogOfWar(gameState) && (
          <span className="hidden text-slate-400 sm:inline" title="Fog of war: you only see enemy troops your own troops can see. Forests hide troops unless you're right next to them.">
            <FogIcon className="text-base" />
          </span>
        )}
        <button
          onClick={() => setGameSpeed(speed === 1 ? 2 : 1)}
          title={speed === 1 ? 'Speed up battles' : 'Normal speed'}
          aria-label={speed === 1 ? 'Speed up battles' : 'Normal speed'}
          aria-pressed={speed === 2}
          className={`${ICON_BUTTON_CLASS} flex items-center gap-0.5 text-xs font-bold ${speed === 2 ? 'text-amber-300' : ''}`}
        >
          <SpeedIcon className="text-base" />{speed}x
        </button>
        {onSave && (
          <button onClick={onSave} title="Save game" aria-label="Save game" className={`${ICON_BUTTON_CLASS} hidden sm:inline-flex`}>
            <SaveIcon className="text-base" />
          </button>
        )}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Turn sound on' : 'Mute sound'}
          aria-label={isMuted ? 'Turn sound on' : 'Mute sound'}
          aria-pressed={isMuted}
          className={ICON_BUTTON_CLASS}
        >
          {isMuted ? <SoundOffIcon className="text-base" /> : <SoundOnIcon className="text-base" />}
        </button>
        {onResign && (
          <button onClick={() => setConfirmingResign(true)} title="Resign this battle" aria-label="Resign this battle" className={ICON_BUTTON_CLASS}>
            <ResignIcon className="text-base" />
          </button>
        )}
        <button onClick={onQuit} title="Save and return to the main menu" aria-label="Save and return to the main menu" className={ICON_BUTTON_CLASS}>
          <HomeIcon className="text-base" />
        </button>
        {confirmingResign && onResign && (
          <div role="dialog" aria-label="Resign this battle?" className={`${PANEL_CLASS} absolute right-0 top-full z-50 mt-2 w-60 p-3 text-left`}>
            <div className="text-sm font-bold text-slate-100">Resign this battle?</div>
            <p className="mt-1 text-xs text-slate-400">{resignNote}</p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => { setConfirmingResign(false); onResign(); }}
                className="flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-rose-500"
              >
                Resign
              </button>
              <button onClick={() => setConfirmingResign(false)} className="flex-1 rounded-lg bg-slate-700 px-2 py-1.5 text-xs font-bold text-slate-100 hover:bg-slate-600">
                Keep fighting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// One side of a battle between more sides: its colour, name, castle health and points (out of the
// battle once its castle has fallen)
const SideChip: React.FC<{ gameState: GameState; side: PlayerType; viewer: PlayerType; shownDamage: number; active: boolean }> = ({
  gameState, side, viewer, shownDamage, active
}) => {
  const player = gameState.players[side];
  const health = useShownCastleHealth(side, Math.max(0, (player?.baseHealth ?? BASE_MAX_HEALTH) - shownDamage));
  const out = !!player?.eliminated;
  const score = getTimeScore(gameState, side).total;
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${active ? 'ring-2 ring-white/70' : ''} ${out ? 'opacity-40 line-through' : ''}`}
      title={`${player?.name ?? side}${side === viewer ? ' (you)' : ''}: castle ${health}/${getCastleMaxHealth(gameState, side)}, ${score} points${out ? ' - out of the battle' : ''}`}
    >
      <CrownIcon color={sideColor(side)} />
      <span className="max-w-[5rem] truncate" style={{ color: sideColor(side) }}>{side === viewer ? 'You' : player?.name ?? side}</span>
      <span className="text-slate-200">{out ? 0 : health}</span>
    </span>
  );
};
