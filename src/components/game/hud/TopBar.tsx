import React from 'react';
import { GameState } from '@/types/game';
import { BASE_MAX_HEALTH, TURN_INCOME } from '@/lib/game/gameState';
import { PANEL_CLASS, SIDE_COLORS } from './styles';

interface TopBarProps {
  gameState: GameState;
  isAITurn: boolean;
  timer: number;
  showTimer: boolean;
  onSave?: () => void;
}

const CastleHealth: React.FC<{ title: string; health: number; max: number; color: string; alignRight?: boolean }> = ({
  title, health, max, color, alignRight = false
}) => {
  const ratio = max > 0 ? Math.max(0, health) / max : 0;

  return (
    <div className={`flex items-center gap-2 ${alignRight ? 'flex-row-reverse' : ''}`} title={`${title}: ${Math.max(0, health)}/${max}`}>
      <span className="text-base leading-none" style={{ filter: `drop-shadow(0 0 3px ${color})` }}>👑</span>
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
export const TopBar: React.FC<TopBarProps> = ({ gameState, isAITurn, timer, showTimer, onSave }) => {
  const { players, turnNumber } = gameState;
  const mineIncome = gameState.hexGrid
    .filter(hex => hex.isResourceHex && hex.unit?.owner === 'player')
    .reduce((sum, hex) => sum + (hex.resourceValue ?? 0), 0);

  return (
    <div className="fixed top-3 inset-x-3 z-20 flex items-start justify-between gap-3 pointer-events-none">
      {/* Turn */}
      <div className={`${PANEL_CLASS} pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-sm`}>
        <span className="font-bold text-slate-400">Round {Math.max(1, turnNumber)}</span>
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
          max={players.player.maxBaseHealth ?? BASE_MAX_HEALTH}
          color={SIDE_COLORS.player}
        />
        <span className="text-xs font-bold text-slate-500">VS</span>
        <CastleHealth
          title="Enemy castle"
          health={players.ai.baseHealth ?? BASE_MAX_HEALTH}
          max={players.ai.maxBaseHealth ?? BASE_MAX_HEALTH}
          color={SIDE_COLORS.ai}
          alignRight
        />
      </div>

      {/* Treasury */}
      <div className={`${PANEL_CLASS} pointer-events-auto flex items-center gap-2 px-3 py-1.5`}>
        <span className="text-base font-bold text-amber-300" title={`+${TURN_INCOME + mineIncome} gold per round`}>
          💰 {players.player.points}
        </span>
        {onSave && (
          <button onClick={onSave} title="Save game" aria-label="Save game" className="rounded-md px-1.5 py-0.5 text-sm hover:bg-slate-700">
            💾
          </button>
        )}
      </div>
    </div>
  );
};
