import React from 'react';
import { GameState } from '@/types/game';
import { BASE_MAX_HEALTH, getCastleMaxHealth, getIncome, getMaxRounds, isFogOfWar } from '@/lib/game/gameState';
import { PANEL_CLASS, SIDE_COLORS } from './styles';
import { CrownIcon, FogIcon, GoldIcon, HomeIcon, SaveIcon, SoundOffIcon, SoundOnIcon, SpeedIcon, ThreatIcon } from '../icons';
import { setGameSpeed, useGameSpeed } from '../effects/effects';

interface TopBarProps {
  gameState: GameState;
  isAITurn: boolean;
  timer: number;
  showTimer: boolean;
  onSave?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onQuit: () => void;
  // The threat preview: hexes enemies can strike next turn
  showThreats: boolean;
  onToggleThreats: () => void;
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
  gameState, isAITurn, timer, showTimer, onSave, isMuted, onToggleMute, onQuit, showThreats, onToggleThreats
}) => {
  const { players, turnNumber } = gameState;
  const maxRounds = getMaxRounds(gameState);
  const isFinalRound = turnNumber >= maxRounds;
  const speed = useGameSpeed();
  const income = getIncome(gameState, 'player');
  const incomeDetails = [
    `+${income.base} income`,
    income.mines > 0 && `+${income.mines} gold mines`,
    income.camps > 0 && `+${income.camps} camps`,
    income.upkeep > 0 && `-${income.upkeep} upkeep`
  ].filter(Boolean).join(', ');

  return (
    <div className="fixed top-3 inset-x-3 z-20 flex items-start justify-between gap-3 pointer-events-none">
      {/* Turn */}
      <div className={`${PANEL_CLASS} pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-sm`}>
        <span className={`font-display ${isFinalRound ? 'text-red-400 animate-pulse' : 'text-slate-300'}`} title={`The battle ends after round ${maxRounds}`}>
          Round {Math.max(1, turnNumber)}<span className="text-slate-500">/{maxRounds}</span>
        </span>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
          style={{ background: isAITurn ? SIDE_COLORS.ai : SIDE_COLORS.player }}
        >
          {isAITurn ? 'Enemy turn' : 'Your turn'}
        </span>
        {showTimer && (
          <span className={`font-mono text-xs font-bold tabular-nums ${timer <= 10 ? 'text-red-400 animate-pulse' : 'text-slate-300'}`}>
            {timer}s
          </span>
        )}
      </div>

      {/* Castles */}
      <div className={`${PANEL_CLASS} pointer-events-auto hidden md:flex items-center gap-3 px-3 py-2`}>
        <CastleHealth
          title="Your castle"
          health={players.player.baseHealth ?? BASE_MAX_HEALTH}
          max={getCastleMaxHealth(gameState, 'player')}
          color={SIDE_COLORS.player}
        />
        <span className="text-xs font-bold text-slate-500">VS</span>
        <CastleHealth
          title="Enemy castle"
          health={players.ai.baseHealth ?? BASE_MAX_HEALTH}
          max={getCastleMaxHealth(gameState, 'ai')}
          color={SIDE_COLORS.ai}
          alignRight
        />
      </div>

      {/* Treasury */}
      <div className={`${PANEL_CLASS} pointer-events-auto flex items-center gap-2 px-3 py-1.5`}>
        <span id="hud-gold" className="font-display flex items-center gap-1 text-base text-amber-300" title={`${income.total >= 0 ? '+' : ''}${income.total} gold per turn (${incomeDetails})`}>
          <GoldIcon className="text-lg" /> {players.player.points}
          <span className={`text-xs ${income.upkeep > 0 ? 'text-rose-300' : 'text-amber-200/70'}`}>
            {income.total >= 0 ? '+' : ''}{income.total}
          </span>
        </span>
        <span className="mx-0.5 h-5 w-px bg-slate-700" />
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
          <span className="text-slate-400" title="Fog of war: you only see enemy troops your own troops can see. Forests hide troops unless you're right next to them.">
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
          <button onClick={onSave} title="Save game" aria-label="Save game" className={ICON_BUTTON_CLASS}>
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
        <button onClick={onQuit} title="Save and return to the main menu" aria-label="Save and return to the main menu" className={ICON_BUTTON_CLASS}>
          <HomeIcon className="text-base" />
        </button>
      </div>
    </div>
  );
};
