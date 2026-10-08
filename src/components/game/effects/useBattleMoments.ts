import { useEffect, useRef } from 'react';
import { GameState, PlayerType } from '@/types/game';
import { canStormCastle, castleHealthRatio, findBaseHex, getMaxRounds } from '@/lib/game/gameState';
import { playStinger, setMusicIntensity } from '@/lib/audio/music';
import { axialToWorld, getHexSurfaceHeight } from '../utils/boardGeometry';
import { playBattleSound } from '../utils/battleSounds';
import {
  emitCoins, emitConfetti, emitMoment, flashDamage, projectToScreen, shakeScreen, triggerSlowMotion
} from './effects';

// Your castle is in danger below this share of its health
const LAST_STAND_RATIO = 0.3;
// Siege damage that earns a callout
const CRUSHING_BLOW = 12;

const KILL_STREAKS: Record<number, { title: string; tone: 'gold' | 'purple' }> = {
  2: { title: 'Double Kill!', tone: 'gold' },
  3: { title: 'Triple Kill!', tone: 'gold' },
  4: { title: 'Rampage!', tone: 'purple' }
};

// Where a side's castle appears on screen
const castleOnScreen = (state: GameState, side: PlayerType) => {
  const base = findBaseHex(state, side);
  if (!base) return null;
  const [x, , z] = axialToWorld(base.coordinates);
  return projectToScreen([x, getHexSurfaceHeight(base) + 1.2, z]);
};

// Watches the battle and turns its big moments into callouts, shakes, coins and music:
// kill streaks, a boss falling, camps changing hands, castle hits, the last stand and the final round
export const useBattleMoments = (gameState: GameState, isReady: boolean) => {
  const previousRef = useRef<GameState | null>(null);
  const flagsRef = useRef({ lastStand: false, finalRound: false });

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = gameState;
    if (!isReady || !previous || previous.players.player.id !== gameState.players.player.id) {
      flagsRef.current = { lastStand: false, finalRound: false };
      return;
    }

    const before = previous.battleStats;
    const after = gameState.battleStats;
    if (!before || !after) return;

    // Enemies destroyed in one go
    const kills = after.player.kills - before.player.kills;
    if (kills > 0) {
      shakeScreen(0.15 + 0.1 * Math.min(kills, 4));
      if (before.player.kills === 0 && after.ai.kills === 0) {
        emitMoment({ title: 'First Blood!', tone: 'red' });
      } else if (kills >= 2) {
        const streak = KILL_STREAKS[Math.min(kills, 4)];
        emitMoment({ title: streak.title, subtitle: `${kills} enemies destroyed`, tone: streak.tone, big: kills >= 4 });
      }
    }

    if (after.player.bossesSlain > before.player.bossesSlain) {
      triggerSlowMotion(0.3, 1400);
      shakeScreen(0.9);
      emitConfetti();
      playStinger('levelUp');
      emitMoment({ title: 'Boss Defeated!', subtitle: 'Its army is shaken', tone: 'gold', big: true });
    }

    // Ambushes in the fog of war
    if ((after.player.ambushed ?? 0) > (before.player.ambushed ?? 0)) {
      shakeScreen(0.35);
      emitMoment({ title: 'Ambush!', subtitle: 'Hidden enemies stopped your troops', tone: 'red' });
    }
    if ((after.ai.ambushed ?? 0) > (before.ai.ambushed ?? 0)) {
      emitMoment({ title: 'Ambush Sprung!', subtitle: 'The enemy walked into your hidden troops', tone: 'gold' });
    }

    if (after.player.campsCaptured > before.player.campsCaptured) {
      playBattleSound('bounty', 0.7);
      emitMoment({ title: 'Camp Captured!', subtitle: 'Deploy your cards there now', tone: 'green' });
    }
    if (after.ai.campsCaptured > before.ai.campsCaptured) {
      emitMoment({ title: 'Camp Lost!', tone: 'red' });
    }

    // Castle hits
    const aiCastleBefore = previous.players.ai.baseHealth ?? 0;
    const aiCastleAfter = gameState.players.ai.baseHealth ?? 0;
    const siegeDamage = aiCastleBefore - aiCastleAfter;
    if (siegeDamage > 0 && gameState.currentPhase !== 'gameOver') {
      shakeScreen(Math.min(0.6, 0.15 + siegeDamage / 20));
      const from = castleOnScreen(gameState, 'ai');
      if (from) emitCoins(from, Math.min(8, Math.ceil(siegeDamage / 3)));
      if (!canStormCastle(previous, 'player') && canStormCastle(gameState, 'player')) {
        playStinger('levelUp');
        emitMoment({ title: 'Walls Breached!', subtitle: 'Storm the castle to win', tone: 'gold', big: true });
      } else if (siegeDamage >= CRUSHING_BLOW) {
        emitMoment({ title: 'Crushing Blow!', subtitle: `-${siegeDamage} castle health`, tone: 'gold' });
      }
    }

    const playerCastleBefore = previous.players.player.baseHealth ?? 0;
    const playerCastleAfter = gameState.players.player.baseHealth ?? 0;
    if (playerCastleAfter < playerCastleBefore && gameState.currentPhase !== 'gameOver') {
      shakeScreen(Math.min(0.7, 0.2 + (playerCastleBefore - playerCastleAfter) / 15));
      flashDamage();
      if (!canStormCastle(previous, 'ai') && canStormCastle(gameState, 'ai')) {
        emitMoment({ title: 'Walls Breached!', subtitle: 'Guard your castle!', tone: 'red', big: true });
      }
      if (!flagsRef.current.lastStand && castleHealthRatio(gameState, 'player') <= LAST_STAND_RATIO) {
        flagsRef.current.lastStand = true;
        setMusicIntensity(2);
        emitMoment({ title: 'Last Stand!', subtitle: 'Defend your castle!', tone: 'red', big: true });
      }
    }

    // Turn income: coins stream from your castle to the treasury
    const startedYourTurn = gameState.currentPhase === 'planning' && gameState.activePlayer === 'player' &&
      !(previous.currentPhase === 'planning' && previous.activePlayer === 'player');
    if (startedYourTurn) {
      const from = castleOnScreen(gameState, 'player');
      if (from) emitCoins(from, 4);

      if (!flagsRef.current.finalRound && gameState.turnNumber >= getMaxRounds(gameState)) {
        flagsRef.current.finalRound = true;
        setMusicIntensity(2);
        emitMoment({ title: 'Final Round!', subtitle: 'The stronger castle wins', tone: 'red', big: true });
      }
    }

    // The battle is decided
    if (gameState.currentPhase === 'gameOver' && previous.currentPhase !== 'gameOver') {
      const won = gameState.winner === 'player';
      triggerSlowMotion(0.35, 1600);
      shakeScreen(won ? 0.8 : 1);
      if (won) emitConfetti();
      playStinger(won ? 'victory' : 'defeat');
      emitMoment(won
        ? { title: 'Victory!', subtitle: gameState.winReason === 'stormed' ? 'The castle is stormed!' : gameState.winReason === 'timeout' ? 'Your side holds the field' : 'The enemy castle falls!', tone: 'gold', big: true }
        : { title: 'Defeat', subtitle: gameState.winReason === 'timeout' ? 'Time ran out' : 'Your castle has fallen', tone: 'red', big: true });
    }
  }, [gameState, isReady]);
};
