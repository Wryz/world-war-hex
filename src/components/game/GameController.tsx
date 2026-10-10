import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { haulSize } from '@/lib/game/materials';
import { showBreakAd } from '@/lib/ads';
import { requestPersistentStorage } from '@/lib/offline';
import { useRouter } from 'next/navigation';
import { GameBoard } from './GameBoard';
import { CombatResolver } from './combat/CombatResolver';
import { ResultsScreen } from './shared/ResultsScreen';
import { TUTORIAL_BATTLE, TutorialOverlay, TutorialVisuals, useTutorial } from './shared/TutorialGuide';
import { RuleTips } from './shared/RuleTips';
import { BattleReplay } from './replay/BattleReplay';
import { ReplayFrame, canReplay } from './replay/replay';
import { BossBar } from './hud/BossBar';
import { WeatherVeil } from './WeatherEffects';
import { challengeMet } from '@/lib/campaign/challenges';
import { dailyRegion } from '@/lib/campaign/daily';
import { useMechanicGuide } from './shared/MechanicGuide';
import { BossIntro } from './shared/BossIntro';
import { useGameHandlers } from './handlers/GameEventHandlers';
import { LoadingManagerProvider } from './utils/LoadingManager';
import LoadingScreen from './utils/LoadingScreen';
import { setMuted, useMuted } from './utils/SoundPlayer';
import { BattleConfig } from './storage/GameStorage';
import { TopBar } from './hud/TopBar';
import { CardHand } from './hud/CardHand';
import { SelectionCard } from './hud/SelectionCard';
import { EventFeed } from './hud/EventFeed';
import { TurnBanner } from './hud/TurnBanner';
import { getUnitTypeName } from './utils/UnitHelpers';
import { ActionIcon, ArrowIcon, WarningIcon } from './icons';
import { EffectsLayer } from './effects/EffectsLayer';
import { emitMoment, resetEffects } from './effects/effects';
import { useBattleMoments } from './effects/useBattleMoments';
import { ACTION_NAMES, castleHealthRatio, getMaxRounds, getSideView, getStarScore, isFogOfWar } from '@/lib/game/gameState';
import { getLevel, starsForWin, LEVEL_COUNT } from '@/lib/campaign/levels';
import { averageCardLevel, battleTroopTypes } from '@/lib/campaign/battleSetup';
import {
  BattleRecordResult, completeTutorial, getProfile, profilePower, recordBattle
} from '@/lib/meta/profile';
import { setMusicIntensity, useMusic } from '@/lib/audio/music';

interface GameControllerProps {
  battle: BattleConfig;
  // Continue the saved battle if there is one
  shouldContinueGame?: boolean;
}

// Returns a function with a stable identity that always calls the latest version of `fn`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStableCallback = <T extends (...args: any[]) => any>(fn: T): T => {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
};

// How long the castle takes to fall before the results appear
const RESULTS_DELAY = 2600;
const RESULTS_DELAY_RESIGNED = 700;

interface FinishedBattle {
  won: boolean;
  stars: number;
  record: BattleRecordResult;
}

// The inner game component that uses the preloaded assets
const GameControllerInner: React.FC<GameControllerProps & { isReady: boolean }> = ({
  battle,
  shouldContinueGame = false,
  isReady
}) => {
  const router = useRouter();
  const isMuted = useMuted();
  const level = battle.mode === 'campaign' ? getLevel(battle.levelId) : undefined;

  // The first battle is the tutorial (see TutorialGuide), every time it's played; from the second on
  // the battles are the player's own (only a new mechanic gets a pointer, the first time it turns up)
  const [showTutorial, setShowTutorial] = useState(() => battle.mode === 'campaign' && battle.levelId === TUTORIAL_BATTLE);
  const {
    gameState,
    selectedHex,
    selectedUnit,
    validMoves,
    selectedUnitTypeForPurchase,
    isAITurn,
    timer,
    elapsedRef,
    handleHexClick,
    handleUnitSelect,
    handleUnitPurchase,
    handleEndTurn,
    handleRestart,
    saveGame,
    handleUnitTypeSelect,
    handleCancelSelection,
    handleUndo,
    handleResign,
    canUndo,
    notice,
    actionChoice,
    handleActionChoice,
    getReplayFrames
  } = useGameHandlers({ battle, resume: shouldContinueGame, isReady, untimed: showTutorial });

  // Each region of the campaign can have battle (and boss) music of its own, by its enemy faction
  useMusic(level?.isBoss ? 'boss' : 'battle', level?.region.faction);
  useEffect(() => {
    setMusicIntensity(1);
    return () => resetEffects();
  }, []);
  useBattleMoments(gameState, isReady);

  // Analytics: a battle begins once the board is ready (not again when a saved one is continued)
  const startedRef = useRef(false);
  useEffect(() => {
    if (!isReady || startedRef.current) return;
    startedRef.current = true;
    if (isFogOfWar(gameState)) {
      setTimeout(() => emitMoment({ title: 'Fog of War', subtitle: 'You only see what your troops can see', tone: 'purple', explain: true }), 1200);
    }
    // A friend's challenge: their score is the one to beat (said once, as the battle begins); the
    // daily challenge is announced the same way
    if (battle.mode === 'quick' && (battle.challenge || battle.daily) && !(shouldContinueGame && gameState.turnNumber > 1)) {
      const subtitle = battle.challenge
        ? `Your friend scored ${battle.challenge.score} points here - beat it`
        : `${dailyRegion(battle.daily!).name} · the same battlefield for everyone today`;
      const title = battle.daily ? 'Daily Challenge' : 'Challenge!';
      setTimeout(() => emitMoment({ title, subtitle, tone: 'blue', explain: true }), isFogOfWar(gameState) ? 3600 : 1200);
    }
    if (shouldContinueGame && gameState.turnNumber > 1) return;
    const profile = getProfile();
    trackEvent('battle_started', {
      mode: battle.mode,
      level: level?.id,
      region: level?.region.name,
      boss: level?.isBoss ?? false,
      difficulty: battle.mode === 'quick' ? battle.difficulty : level?.settings.aiDifficulty,
      power: profilePower(profile),
      recommended_power: level?.recommendedPower,
      deck: profile.deck,
      daily: battle.mode === 'quick' && !!battle.daily
    });
    // Runs once per battle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // Expose the battle in development so automated browser tests can aim clicks precisely
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __wwhGame?: object }).__wwhGame = { gameState, validMoves };
    }
  }, [gameState, validMoves]);

  const [toast, setToast] = useState<{ id: number; text: string; isWarning?: boolean } | null>(null);
  const [finished, setFinished] = useState<FinishedBattle | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showBossIntro, setShowBossIntro] = useState(() => !!level?.isBoss && gameState.turnNumber <= 1);
  // Watching the battle again from the results screen
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[] | null>(null);

  // The first battle shows what to do (see TutorialGuide); it counts as done once the battle is over
  const tutorial = useTutorial({
    active: showTutorial, intro: showTutorial, ready: isReady, choosingOrder: !!actionChoice, gameState, selectedUnit, selectedUnitType: selectedUnitTypeForPurchase, validMoves
  });
  // Later battles: the hand points out each new mechanic the first time it turns up
  const mechanic = useMechanicGuide({
    active: isReady && !showTutorial && !showBossIntro && !finished && battle.mode === 'campaign', gameState, selectedUnit
  });
  // (the board only redraws its marks when they actually change)
  // (a mechanic being pointed out gets the same gold ring, kept in view)
  const mechanicHex = mechanic?.hex;
  const [ruleTipOpen, setRuleTipOpen] = useState(false);
  const boardGuide: TutorialVisuals | null = tutorial.visuals ?? (mechanicHex
    ? { showcase: null, rings: [{ at: mechanicHex, tone: 'tap' }], path: null, target: null, keepInView: mechanicHex }
    : null);
  const tutorialVisualsKey = JSON.stringify(boardGuide);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tutorialVisuals = useMemo(() => boardGuide, [tutorialVisualsKey]);

  // Stable handlers so the memoised 3D board doesn't re-render on every timer tick
  const onBoardHexClick = useStableCallback(handleHexClick);
  const onBoardUnitClick = useStableCallback(handleUnitSelect);
  const onBoardUnitPurchase = useStableCallback(handleUnitPurchase);

  // Marks the page as a battle while it is open (phones keep the battle at normal size: see globals.css)
  useEffect(() => {
    document.documentElement.dataset.screen = 'battle';
    return () => { delete document.documentElement.dataset.screen; };
  }, []);

  // Escape cancels the current selection
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCancelSelection();
      // Ctrl/Cmd+Z takes back the last order
      if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z') && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCancelSelection, handleUndo]);

  // Warnings from the game (e.g. picking a hex a unit can't reach) appear as a brief toast
  useEffect(() => {
    if (notice) setToast({ id: notice.id, text: notice.text, isWarning: true });
  }, [notice]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.isWarning ? 1800 : 2000);
    return () => clearTimeout(timeout);
  }, [toast]);

  // The battle is over: record it once, then show the results after the castle has fallen
  const { currentPhase } = gameState;
  useEffect(() => {
    if (currentPhase !== 'gameOver' || finished) return;
    const won = gameState.winner === 'player';
    const stars = won && level ? starsForWin(level, getStarScore(gameState, 'player').total) : 0;
    const playerStats = gameState.battleStats!.player;
    const record = recordBattle({
      mode: battle.mode,
      levelId: level?.id,
      won,
      stars,
      rounds: gameState.turnNumber,
      reason: gameState.winReason,
      enemyCastleDamage: 1 - castleHealthRatio(gameState, 'ai'),
      playerStats,
      durationSeconds: elapsedRef.current,
      challengeMet: challengeMet(gameState),
      haul: gameState.haul,
      // (against the player's cards as they were when the battle began: an upgrade since changes nothing)
      rivalShare: gameState.rivalLevel !== undefined ? gameState.rivalLevel / (gameState.ownCardLevel ?? averageCardLevel(getProfile())) : undefined,
      daily: battle.mode === 'quick' ? battle.daily : undefined,
      dailyStartedOn: gameState.dailyStartedOn
    });
    trackEvent('battle_ended', {
      mode: battle.mode,
      level: level?.id,
      region: level?.region.name,
      won,
      reason: gameState.winReason,
      stars,
      rounds: gameState.turnNumber,
      duration_seconds: Math.round(elapsedRef.current),
      kills: playerStats.kills,
      lost: playerStats.lost,
      coins_earned: record.reward.coins,
      challenge_completed: record.challengeCompleted,
      daily: battle.mode === 'quick' && !!battle.daily,
      daily_streak: record.dailyStreak,
      materials_gathered: haulSize(gameState.haul),
      materials_kept: haulSize(record.haul)
    });
    // Now there's progress worth keeping, ask the browser not to clear it
    void requestPersistentStorage();
    // (the first battle counts as the tutorial done once it is won - it still guides every time
    // it's played)
    if (level?.id === 1 && won) completeTutorial();
    setShowTutorial(false);
    setFinished({ won, stars, record });
    // (after the castle has fallen - or at once for a battle given up, with nothing to watch)
    const timeout = setTimeout(() => setShowResults(true), gameState.winReason === 'resigned' ? RESULTS_DELAY_RESIGNED : RESULTS_DELAY);
    return () => clearTimeout(timeout);
    // Runs once when the battle ends
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase]);

  const handleSave = () => {
    const saved = saveGame();
    setToast({ id: Date.now(), text: saved ? 'Game saved' : 'Could not save the game' });
  };

  const exitPath = battle.mode === 'campaign' ? '/campaign' : '/';

  // Leave the battle; it is saved so it can be continued later
  const handleQuit = () => {
    if (currentPhase !== 'gameOver') {
      trackEvent('battle_abandoned', { mode: battle.mode, level: level?.id, round: gameState.turnNumber });
    }
    saveGame();
    router.push(exitPath);
  };

  const handleRetry = () => {
    setReplayFrames(null);
    setFinished(null);
    // (the tutorial battle is the tutorial again)
    setShowTutorial(battle.mode === 'campaign' && battle.levelId === TUTORIAL_BATTLE);
    setShowResults(false);
    resetEffects();
    setMusicIntensity(1);
    setShowBossIntro(!!level?.isBoss);
    handleRestart();
  };

  const nextLevel = level && level.id < LEVEL_COUNT ? level.id + 1 : null;

  // Leaving the results screen is a natural break, so an ad may play before the next screen
  const leaveResults = (path: string) => () => showBreakAd('after_battle', getProfile().stats.battles, () => router.push(path));

  const activePlayer = gameState.activePlayer ?? 'player';
  const isPlayerPlanning = currentPhase === 'planning' && !isAITurn;
  const deckTypes = useMemo(() => gameState.deck ?? [], [gameState.deck]);

  // What the player knows: in the fog of war, enemy troops they can't see are left off the board and HUD
  const viewState = useMemo(() => getSideView(gameState, 'player'), [gameState]);
  // Every unit really on the board, so the board can tell a fallen troop from one that slipped into the fog
  const unitIds = useMemo(
    () => new Set([...gameState.players.player.units, ...gameState.players.ai.units].map(unit => unit.id)),
    [gameState.players]
  );

  // The threat preview (T toggles it)
  const [showThreats, setShowThreats] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 't' || event.key === 'T') && !(event.target instanceof HTMLInputElement)) setShowThreats(value => !value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Short instruction while the player is in the middle of an action
  const hint = selectedUnitTypeForPurchase
    ? `Tap a glowing hex to deploy ${getUnitTypeName(selectedUnitTypeForPurchase)} · Esc to cancel`
    : selectedUnit?.owner === 'player' && isPlayerPlanning
      ? validMoves.length > 0
        ? 'Tap a highlighted hex to move there · Esc to cancel'
        : "This unit can't move this turn"
      : null;

  // A quick battle can be fought again by a friend: the same map and rival, with this score to beat
  const skirmish = battle.mode === 'quick' && gameState.settings?.seed !== undefined && gameState.rivalLevel !== undefined
    ? { difficulty: battle.difficulty, seed: gameState.settings.seed, rivalLevel: gameState.rivalLevel, target: battle.challenge, daily: battle.daily }
    : undefined;

  return (
    <div className="relative w-full h-full">
      {/* (watching the battle again swaps in a board of its own; the results stay as they were, hidden) */}
      {replayFrames && <BattleReplay frames={replayFrames} onClose={() => { resetEffects(); setReplayFrames(null); }} />}
      {!replayFrames && <WeatherVeil gameState={gameState} />}
      {!replayFrames && <GameBoard
        gameState={viewState}
        unitIds={unitIds}
        showThreats={showThreats && isPlayerPlanning}
        selectedHex={selectedHex ?? undefined}
        selectedUnit={selectedUnit}
        validMoves={validMoves}
        selectedUnitTypeForPurchase={selectedUnitTypeForPurchase}
        onHexClick={onBoardHexClick}
        onUnitClick={onBoardUnitClick}
        onUnitPurchase={onBoardUnitPurchase}
        tutorial={tutorialVisuals}
      />}

      {(currentPhase === 'planning' || currentPhase === 'combat' || currentPhase === 'execution') && (
        <>
          <TopBar
            gameState={viewState}
            showThreats={showThreats}
            onToggleThreats={() => setShowThreats(value => !value)}
            isAITurn={isAITurn}
            timer={timer}
            showTimer={isPlayerPlanning && !showTutorial}
            onSave={isPlayerPlanning ? handleSave : undefined}
            isMuted={isMuted}
            onToggleMute={() => setMuted(!isMuted)}
            onQuit={handleQuit}
            onResign={isPlayerPlanning && !showTutorial ? handleResign : undefined}
          />
          <BossBar gameState={gameState} />
          {/* (on a phone it sits just above the hand, clear of the boss bar and tips at the top) */}
          <div className="fixed bottom-[calc(10.75rem+var(--safe-b))] left-[calc(0.5rem+var(--safe-l))] z-20 pointer-events-none sm:bottom-auto sm:left-[calc(0.75rem+var(--safe-l))] sm:top-[calc(4rem+var(--safe-t))]">
            <SelectionCard gameState={viewState} selectedHex={selectedHex} selectedUnit={selectedUnit} />
          </div>
          {/* Capped above the battle card and the hand so panels never run under them */}
          <div className="fixed right-[calc(0.75rem+var(--safe-r))] top-[calc(4rem+var(--safe-t))] z-20 hidden max-h-[calc(100vh-17rem-var(--safe-t)-var(--safe-b))] w-64 flex-col gap-2 overflow-y-auto pointer-events-none sm:flex">
            <EventFeed log={gameState.log ?? []} />
          </div>
          <TurnBanner phase={currentPhase} activePlayer={activePlayer} turnNumber={gameState.turnNumber} maxRounds={getMaxRounds(gameState)} />
        </>
      )}

      {currentPhase === 'planning' && deckTypes && (
        <CardHand
          gameState={gameState}
          isAITurn={isAITurn}
          selectedUnitType={selectedUnitTypeForPurchase}
          hint={showTutorial ? null : hint}
          onCardSelect={handleUnitTypeSelect}
          onEndTurn={handleEndTurn}
          canUndo={canUndo}
          onUndo={handleUndo}
        />
      )}

      {/* Move onto the hex, or work on it? */}
      {actionChoice && isPlayerPlanning && (
        <div className="fixed inset-x-0 bottom-[calc(12rem+var(--safe-b))] z-40 flex justify-center px-3">
          <div className="animate-fadeIn flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-slate-900/95 p-2 shadow-2xl ring-1 ring-white/10" role="group" aria-label="Choose an order">
            {actionChoice.canMove && (
              <button onClick={() => handleActionChoice(null)} data-tutorial="move-here" className="font-display flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-900 hover:bg-white">
                <ArrowIcon /> Move here
              </button>
            )}
            {actionChoice.actions.map(action => (
              <button key={action} onClick={() => handleActionChoice(action)} className="font-display flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-sm text-slate-900 hover:bg-amber-300">
                <ActionIcon action={action} /> {ACTION_NAMES[action]}
              </button>
            ))}
            <button onClick={handleCancelSelection} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800" aria-label="Cancel">✕</button>
          </div>
        </div>
      )}

      {/* Before the first turn: choose the castle's site */}
      {currentPhase === 'setup' && isReady && gameState.castleChoices && (
        <div className="fixed inset-x-3 top-[calc(1rem+var(--safe-t))] z-20 flex justify-center pointer-events-none">
          <div className="max-w-md rounded-2xl bg-slate-900/90 px-5 py-3 text-center text-slate-100 shadow-xl ring-1 ring-emerald-300/50">
            <div className="font-display text-xl text-emerald-300">Choose your castle&apos;s site</div>
            <p className="mt-1 text-sm text-slate-300">
              Tap one of the glowing hexes on your edge of the map. Look for high ground, cover and gold mines nearby - the enemy builds across the map from you.
            </p>
          </div>
        </div>
      )}

      {currentPhase === 'combat' && <CombatResolver gameState={viewState} />}

      {/* First-time tips for the newer rules (not while the first battle's tutorial is running) */}
      {!showTutorial && isReady && currentPhase !== 'gameOver' && <RuleTips gameState={gameState} onOpenChange={setRuleTipOpen} />}
      {showTutorial && isReady && currentPhase !== 'gameOver' && (
        <TutorialOverlay gameState={gameState} pointer={tutorial.pointer} introRunning={tutorial.introRunning} introCaption={tutorial.introCaption} onSkipIntro={tutorial.skipIntro} />
      )}
      {mechanic?.hex && <TutorialOverlay gameState={gameState} pointer={{ hex: mechanic.hex, caption: mechanic.caption }} introRunning={false} onSkipIntro={() => undefined} />}
      {/* (a caption without a hex waits while a rule tip is open: they share the top of the screen) */}
      {mechanic && !mechanic.hex && !ruleTipOpen && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(5rem+var(--safe-t))] z-[45] flex justify-center px-4">
          <span className="animate-fadeIn max-w-md rounded-xl bg-slate-900/90 px-4 py-2 text-center text-sm font-bold leading-snug text-amber-100 shadow-lg ring-2 ring-amber-300/70">
            {mechanic.caption}
          </span>
        </div>
      )}

      {showBossIntro && isReady && level && (
        <BossIntro boss={level.region.boss} level={level.enemyTier} stats={level.guards.find(guard => guard.isBoss)?.stats} onDone={() => setShowBossIntro(false)} />
      )}

      <EffectsLayer />

      {finished && showResults && (
        <div className={replayFrames ? 'hidden' : 'contents'}>
          <ResultsScreen
            won={finished.won}
            reason={gameState.winReason}
            level={level}
            stars={finished.stars}
            record={finished.record}
            gathered={haulSize(gameState.haul)}
            rounds={gameState.turnNumber}
            stats={gameState.battleStats!.player}
            durationSeconds={elapsedRef.current}
            coinsTotal={getProfile().coins}
            power={profilePower(getProfile())}
            onNext={nextLevel ? leaveResults(`/play?level=${nextLevel}`) : undefined}
            onRetry={handleRetry}
            onMap={leaveResults(exitPath)}
            onArmy={leaveResults('/army')}
            onOpen={path => leaveResults(path)()}
            points={{ you: getStarScore(gameState, 'player'), enemy: getStarScore(gameState, 'ai') }}
            challengeMet={challengeMet(gameState)}
            skirmish={skirmish}
            onWatchReplay={canReplay(getReplayFrames()) ? () => { resetEffects(); setReplayFrames([...getReplayFrames()]); } : undefined}
          />
        </div>
      )}

      {toast && (
        <div className="fixed top-[calc(5rem+var(--safe-t))] inset-x-0 z-40 flex justify-center pointer-events-none" role="status" aria-live="polite">
          <div
            key={toast.id}
            className={`animate-fadeIn flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${
              toast.isWarning ? 'bg-amber-500/95 text-slate-900' : 'bg-slate-900/90 text-slate-100'
            }`}
          >
            {toast.isWarning && <WarningIcon />}
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
};

// The main controller that provides the loading manager
export const GameController: React.FC<GameControllerProps> = (props) => {
  // The board renders behind the loading screen; turns don't start until it has faded away
  const [loadingComplete, setLoadingComplete] = useState(false);
  const handleLoadingComplete = useCallback(() => setLoadingComplete(true), []);
  const [types] = useState(() => battleTroopTypes(props.battle, getProfile()));

  return (
    <LoadingManagerProvider types={types}>
      <div className="relative w-full h-full">
        <GameControllerInner {...props} isReady={loadingComplete} />
        {!loadingComplete && <LoadingScreen onLoadingComplete={handleLoadingComplete} />}
      </div>
    </LoadingManagerProvider>
  );
};
