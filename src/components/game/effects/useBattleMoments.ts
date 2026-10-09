import { useEffect, useRef } from 'react';
import { GameState, PlayerType } from '@/types/game';
import { BOSS_POWERS, isBossEnraged } from '@/lib/game/bosses';
import { castleHealthRatio, findBaseHex, getMaxRounds } from '@/lib/game/gameState';
import { playStinger, setMusicIntensity } from '@/lib/audio/music';
import { axialToWorld, getHexSurfaceHeight } from '../utils/boardGeometry';
import { playBattleSound } from '../utils/battleSounds';
import {
  emitCoins, emitConfetti, emitMoment, flashDamage, projectToScreen, shakeScreen, triggerSlowMotion
} from './effects';

const BOSS_POWER_NAMES = Object.fromEntries(Object.values(BOSS_POWERS).map(power => [power!.id, power!.name])) as Record<string, string>;

// A castle down to half its health gets a moment of its own
const HALF_HEALTH = 0.5;
const crossedHalf = (before: GameState, after: GameState, side: 'player' | 'ai') =>
  castleHealthRatio(before, side) > HALF_HEALTH && castleHealthRatio(after, side) <= HALF_HEALTH;

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

    // A boss's power lands, and a boss driven into a rage
    const power = gameState.lastBossPower;
    if (power && power.serial !== previous.lastBossPower?.serial) {
      const used = BOSS_POWER_NAMES[power.power];
      shakeScreen(power.power === 'raiseDead' || power.power === 'callTheGang' || power.power === 'howl' || power.power === 'rallyHorde' ? 0.3 : 0.6);
      emitMoment({ title: `${used}!`, tone: 'red' });
    }
    const boss = gameState.players.ai.units.find(unit => unit.isBoss);
    const bossBefore = boss && previous.players.ai.units.find(unit => unit.id === boss.id);
    if (boss && bossBefore && isBossEnraged(boss) && !isBossEnraged(bossBefore)) {
      shakeScreen(0.5);
      emitMoment({ title: 'Enraged!', tone: 'red' });
    }

    // Ambushes in the fog of war
    if ((after.player.ambushed ?? 0) > (before.player.ambushed ?? 0)) {
      shakeScreen(0.35);
      emitMoment({ title: 'Ambush!', subtitle: 'Hidden enemies stopped your troops', tone: 'red' });
    }
    if ((after.ai.ambushed ?? 0) > (before.ai.ambushed ?? 0)) {
      emitMoment({ title: 'Ambush Sprung!', subtitle: 'The enemy walked into your hidden troops', tone: 'gold' });
    }

    // A great tree crashing down
    const felled = gameState.lastFell;
    if (felled && felled.serial !== previous.lastFell?.serial) {
      shakeScreen(0.45);
      playBattleSound('unitFalls', 0.9);
      emitMoment({ title: 'Timber!', tone: felled.side === 'player' ? 'gold' : 'red' });
    }

    if (after.player.campsCaptured > before.player.campsCaptured) {
      playBattleSound('bounty', 0.7);
      emitMoment({ title: 'Camp Captured!', subtitle: 'Deploy your cards there now', tone: 'green', explain: true });
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
      if (crossedHalf(previous, gameState, 'ai')) {
        playStinger('levelUp');
        emitMoment({ title: 'Walls Cracking!', subtitle: 'Half its health gone - keep attacking', tone: 'gold', big: true });
      } else if (siegeDamage >= CRUSHING_BLOW) {
        emitMoment({ title: 'Crushing Blow!', subtitle: `-${siegeDamage} castle health`, tone: 'gold' });
      }
    }

    const playerCastleBefore = previous.players.player.baseHealth ?? 0;
    const playerCastleAfter = gameState.players.player.baseHealth ?? 0;
    if (playerCastleAfter < playerCastleBefore && gameState.currentPhase !== 'gameOver') {
      shakeScreen(Math.min(0.7, 0.2 + (playerCastleBefore - playerCastleAfter) / 15));
      flashDamage();
      if (crossedHalf(previous, gameState, 'player')) {
        emitMoment({ title: 'Walls Cracking!', subtitle: 'Guard your castle!', tone: 'red', big: true });
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
        emitMoment({ title: 'Final Round!', subtitle: 'Kills, gold and camps decide it', tone: 'red', big: true });
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
        ? { title: 'Victory!', subtitle: gameState.winReason === 'timeout' ? 'You win on points' : 'The enemy castle falls!', tone: 'gold', big: true }
        : { title: 'Defeat', subtitle: gameState.winReason === 'timeout' ? 'Time ran out' : 'Your castle has fallen', tone: 'red', big: true });
    }
  }, [gameState, isReady]);
};
