import { useEffect, useRef } from 'react';
import { GameState, PlayerType } from '@/types/game';
import { BOSS_POWERS, isBossEnraged } from '@/lib/game/bosses';
import { WEATHER, activeWeather } from '@/lib/game/regionRules';
import { castleHealthRatio, findBaseHex, getMaxRounds } from '@/lib/game/gameState';
import { playStinger, setMusicIntensity } from '@/lib/audio/music';
import { axialToWorld, getHexSurfaceHeight } from '../utils/boardGeometry';
import { pendingHealthWait } from './healthTimeline';
import { playBattleSound } from '../utils/battleSounds';
import { DEFEAT_PATTERN, VICTORY_PATTERN, buzzPattern } from '@/lib/haptics';
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
  // Announcements waiting for a blow to land (dropped if the battle ends or another begins)
  const waitingRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => {
    waitingRef.current.forEach(clearTimeout);
    waitingRef.current.clear();
  }, []);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = gameState;
    if (!isReady || !previous || previous.players.player.id !== gameState.players.player.id) {
      flagsRef.current = { lastStand: false, finalRound: false };
      waitingRef.current.forEach(clearTimeout);
      waitingRef.current.clear();
      return;
    }

    const before = previous.battleStats;
    const after = gameState.battleStats;
    if (!before || !after) return;

    // Troops destroyed, castles hit and a boss enraged outside a fight (a falling tree, a stone, a
    // boss's strike) are announced when the blow lands on the board, not when the rules decide it
    const wait = pendingHealthWait(gameState, event => !!event.fatal || !!event.castle || !!event.unit?.isBoss);
    if (wait > 0) {
      const timer = setTimeout(() => {
        waitingRef.current.delete(timer);
        announce(previous, gameState, before, after, flagsRef.current);
      }, wait);
      waitingRef.current.add(timer);
    }
    else announce(previous, gameState, before, after, flagsRef.current);
  }, [gameState, isReady]);
};

type Flags = { lastStand: boolean; finalRound: boolean };

// The callouts, shakes, coins and music for the change from one state to the next
const announce = (
  previous: GameState, gameState: GameState, before: NonNullable<GameState['battleStats']>, after: NonNullable<GameState['battleStats']>, flags: Flags
) => {
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

  // A storm blowing up, or blowing over
  const weather = gameState.settings?.weather;
  if (weather && WEATHER[weather].storm && activeWeather(gameState) !== activeWeather(previous)) {
    emitMoment(activeWeather(gameState)
      ? { title: `${WEATHER[weather].name}!`, subtitle: WEATHER[weather].description, tone: 'purple', explain: true }
      : { title: 'The storm passes', tone: 'green' });
  }
  // Undead rising again, and troops losing their nerve
  const rose = gameState.players.ai.units.filter(unit => unit.risen && !previous.players.ai.units.find(other => other.id === unit.id)?.risen).length;
  if (rose > 0) emitMoment({ title: 'They Rise Again!', subtitle: 'Finish the undead with War Clerics or fire', tone: 'purple' });
  const wavering = (side: PlayerType) => gameState.players[side].units.filter(unit =>
    unit.shaken && !previous.players[side].units.find(other => other.id === unit.id)?.shaken && !unit.isBoss).length;
  // (a fallen boss or champion shakes the whole army: the boss has its own moment, a champion this one)
  const leaderFell = previous.players.ai.units.some(unit => (unit.isBoss || unit.isChampion) &&
    !gameState.players.ai.units.some(other => other.id === unit.id));
  const bossFell = previous.players.ai.units.some(unit => unit.isBoss && !gameState.players.ai.units.some(other => other.id === unit.id));
  if (leaderFell) {
    if (!bossFell && wavering('ai') > 0) emitMoment({ title: 'Champion Down!', subtitle: 'The enemy army is shaken', tone: 'gold' });
  } else if (wavering('ai') > 0) {
    emitMoment({ title: 'Wavering!', subtitle: 'Surrounded and alone, it hits softer', tone: 'gold' });
  } else if (wavering('player') > 0) {
    emitMoment({ title: 'Your troop wavers!', subtitle: 'Surrounded and alone: send help', tone: 'red' });
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
    if (!flags.lastStand && castleHealthRatio(gameState, 'player') <= LAST_STAND_RATIO) {
      flags.lastStand = true;
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

    if (!flags.finalRound && gameState.turnNumber >= getMaxRounds(gameState)) {
      flags.finalRound = true;
      setMusicIntensity(2);
      emitMoment({ title: 'Final Round!', subtitle: 'Kills, gold and camps decide it', tone: 'red', big: true });
    }
  }

  // The battle is decided
  if (gameState.currentPhase === 'gameOver' && previous.currentPhase !== 'gameOver') {
    const won = gameState.winner === 'player';
    // (only a castle destroyed falls in slow motion: a battle won on points or given up just ends)
    if (gameState.winReason === 'destroyed') {
      triggerSlowMotion(0.35, 1600);
      shakeScreen(won ? 0.8 : 1);
    }
    if (won) emitConfetti();
    playStinger(won ? 'victory' : 'defeat');
    // (after the castle's own thud, if it fell)
    setTimeout(() => buzzPattern(won ? VICTORY_PATTERN : DEFEAT_PATTERN), gameState.winReason === 'destroyed' ? 700 : 0);
    emitMoment(won
      ? { title: 'Victory!', subtitle: gameState.winReason === 'timeout' ? 'You win on points' : 'The enemy castle falls!', tone: 'gold', big: true }
      : { title: 'Defeat', subtitle: gameState.winReason === 'timeout' ? 'Time ran out' : gameState.winReason === 'resigned' ? 'You withdrew' : 'Your castle has fallen', tone: 'red', big: true });
  }
};

