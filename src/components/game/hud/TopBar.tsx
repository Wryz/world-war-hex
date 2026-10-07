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

const CastleHealth: React.FC<{ label: string; health: number; max: number; color: string; alignRight?: boolean }> = ({
  label, health, max, color, alignRight = false
}) => {
  const ratio = max > 0 ? Math.max(0, health) / max : 0;
  const barColor = ratio > 0.6 ? '#22c55e' : ratio > 0.3 ? '#eab308' : '#ef4444';

  return (
    <div className={`flex flex-col gap-1 w-40 ${alignRight ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color }}>
        {!alignRight && <span>👑</span>}
        <span>{label}</span>
        {alignRight && <span>👑</span>}
      </div>
      <div className="relative w-full h-3 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`absolute top-0 bottom-0 transition-all duration-700 ${alignRight ? 'right-0' : 'left-0'}`}
          style={{ width: `${ratio * 100}%`, background: barColor }}
        />
      </div>
      <div className="text-[11px] text-slate-300">{Math.max(0, health)} / {max}</div>
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
      {/* Turn info */}
      <div className={`${PANEL_CLASS} pointer-events-auto flex items-center gap-3 px-4 py-2`}>
        <div className="text-sm font-bold text-slate-300">Round {Math.max(1, turnNumber)}</div>
        <div
          className="rounded-full px-3 py-1 text-sm font-bold text-white"
          style={{ background: isAITurn ? SIDE_COLORS.ai : SIDE_COLORS.player }}
        >
          {isAITurn ? "Enemy's turn" : 'Your turn'}
        </div>
        {showTimer && (
          <div className={`font-mono text-sm font-bold tabular-nums ${timer <= 10 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
            ⏱ {timer}s
          </div>
        )}
      </div>

      {/* Castles */}
      <div className={`${PANEL_CLASS} pointer-events-auto hidden md:flex items-center gap-4 px-4 py-2`}>
        <CastleHealth
          label="Your castle"
          health={players.player.baseHealth ?? BASE_MAX_HEALTH}
          max={players.player.maxBaseHealth ?? BASE_MAX_HEALTH}
          color={SIDE_COLORS.player}
        />
        <div className="text-lg">⚔️</div>
        <CastleHealth
          label="Enemy castle"
          health={players.ai.baseHealth ?? BASE_MAX_HEALTH}
          max={players.ai.maxBaseHealth ?? BASE_MAX_HEALTH}
          color={SIDE_COLORS.ai}
          alignRight
        />
      </div>

      {/* Treasury */}
      <div className={`${PANEL_CLASS} pointer-events-auto flex items-center gap-3 px-4 py-2`}>
        <div className="flex flex-col items-end">
          <div className="text-lg font-bold text-amber-300 leading-tight">💰 {players.player.points}</div>
          <div className="text-[11px] text-slate-400">+{TURN_INCOME + mineIncome} per round</div>
        </div>
        {onSave && (
          <button
            onClick={onSave}
            title="Save game"
            className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2 py-1.5 text-sm"
          >
            💾
          </button>
        )}
      </div>
    </div>
  );
};
