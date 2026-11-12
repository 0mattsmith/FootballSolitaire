import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { BoosterBar } from './components/BoosterBar';
import { CardView } from './components/CardView';
import { FoundationRow } from './components/FoundationRow';
import {
  FieldGuideModal,
  InstallProgressModal,
  MenuModal,
  OutcomeModal,
  UpdatedBannerModal,
  UpdateUiPhase,
} from './components/GameModals';
import { CareerPathModal } from './components/CareerPathModal';
import { StockWasteRow } from './components/StockWasteRow';
import { TableauColumns } from './components/TableauColumns';
import { TopBar } from './components/TopBar';
import { GAME_MODES, JOURNEY_LEVELS, generateModeLevel } from './data/levels';
import {
  DownloadProgressEvent,
  InstallProgressEvent,
  InstalledVersionInfo,
  RemoteReleaseInfo,
  checkForAppUpdate,
  downloadAndroidApk,
  getInstalledAppInfo,
  installAndroidApk,
} from './engine/appUpdater';
import { generateVerifiedLevelDeal } from './engine/levelGenerator';
import {
  CardSource,
  addBonusMoves,
  applyMagicJoker,
  createInitialGameState,
  drawOrRecycleStock,
  findBestHint,
  getMovableRun,
  moveToFoundation,
  moveToTableau,
  smartAutoMove,
  undoLastMove,
  unlockWithKey,
} from './engine/solitaireEngine';
import { soundFx } from './engine/soundEffects';
import {
  DeckTheme,
  GameCard,
  GameState,
  HintSuggestion,
  LevelConfig,
  ModeId,
  PlayerProgress,
} from './types/game';

const STORAGE_KEY = 'football_solitaire_progress_v1';

const DEFAULT_PROGRESS: PlayerProgress = {
  coins: 500,
  hints: 3,
  undos: 3,
  jokers: 2,
  completedLevelIds: [],
  streak: 0,
  cosyUnlimitedMoves: false,
  soundEnabled: true,
  deckTheme: 'blue',
};

function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

interface ActiveDrag {
  source: CardSource;
  cards: GameCard[];
  startX: number;
  startY: number;
  currX: number;
  currY: number;
  offsetX: number;
  offsetY: number;
  hasMoved: boolean;
}

function buildGameForLevel(level: LevelConfig, cosyUnlimited: boolean): GameState {
  const { tableau, stock, recommendedMoves } = generateVerifiedLevelDeal(level);
  const adjustedLevel: LevelConfig = {
    ...level,
    maxMoves: cosyUnlimited ? null : recommendedMoves,
  };
  return createInitialGameState(adjustedLevel, tableau, stock, cosyUnlimited);
}

export function App() {
  const [progress, setProgress] = useState<PlayerProgress>(loadProgress);
  const [gameState, setGameState] = useState<GameState>(() =>
    buildGameForLevel(JOURNEY_LEVELS[0], loadProgress().cosyUnlimitedMoves)
  );
  const [selectedSource, setSelectedSource] = useState<{
    source: CardSource;
    card: GameCard;
  } | null>(null);
  const [activeHint, setActiveHint] = useState<HintSuggestion | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [shakingUid, setShakingUid] = useState<string | null>(null);
  const [shakingFoundationSlot, setShakingFoundationSlot] = useState<number | null>(null);
  const [justCompletedSlot, setJustCompletedSlot] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fieldGuideOpen, setFieldGuideOpen] = useState(false);
  const [careerPathOpen, setCareerPathOpen] = useState(false);
  const [showTutorialBanner, setShowTutorialBanner] = useState(true);

  // App Updater State
  const [installedInfo, setInstalledInfo] = useState<InstalledVersionInfo | null>(null);
  const [updatePhase, setUpdatePhase] = useState<UpdateUiPhase>('idle');
  const [remoteRelease, setRemoteRelease] = useState<RemoteReleaseInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressEvent | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgressEvent | null>(null);
  const [isInstallingModalOpen, setIsInstallingModalOpen] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updatedBanner, setUpdatedBanner] = useState<{ version: string; notes: string } | null>(
    null
  );

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [hoverTarget, setHoverTarget] = useState<{
    foundationSlot: number | null;
    tableauCol: number | null;
    lockUid: string | null;
    lockCol: number | null;
    lockIdx: number | null;
  }>({
    foundationSlot: null,
    tableauCol: null,
    lockUid: null,
    lockCol: null,
    lockIdx: null,
  });

  const toastTimerRef = useRef<number | null>(null);
  const winHandledRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2400);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getInstalledAppInfo().then((info) => {
      if (cancelled) return;
      setInstalledInfo(info);
      if (info.justUpdated) {
        setUpdatedBanner({
          version: info.versionName,
          notes: info.updateNotes || 'App updated to the latest version!',
        });
      }
      if (info.downloadedReady && info.downloadedVersion) {
        setUpdatePhase('ready_to_install');
        setRemoteRelease({
          hasUpdate: true,
          currentVersion: info.versionName,
          latestVersion: info.downloadedVersion,
          versionCodeGuess: info.versionCode + 1,
          releaseNotes: info.downloadedNotes || 'Ready to install.',
          apkUrl: null,
          releaseUrl: '',
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setUpdateError(null);
    setUpdatePhase('checking');
    try {
      const curr = installedInfo?.versionName ?? '1.0.0';
      const remote = await checkForAppUpdate(curr);
      setRemoteRelease(remote);
      if (remote.hasUpdate) {
        if (
          installedInfo?.downloadedReady &&
          installedInfo.downloadedVersion === remote.latestVersion
        ) {
          setUpdatePhase('ready_to_install');
        } else {
          setUpdatePhase('available');
        }
      } else {
        setUpdatePhase('up_to_date');
      }
    } catch (err) {
      setUpdatePhase('error');
      setUpdateError(err instanceof Error ? err.message : 'Could not check for updates.');
    }
  }, [installedInfo]);

  const handleDownloadUpdate = useCallback(async () => {
    if (!remoteRelease) return;
    setUpdateError(null);
    setUpdatePhase('downloading');
    setDownloadProgress({ progress: 0, status: 'downloading' });
    try {
      await downloadAndroidApk(remoteRelease, (ev) => {
        setDownloadProgress(ev);
      });
      setUpdatePhase('ready_to_install');
      showToast(`v${remoteRelease.latestVersion} downloaded — tap Update to install!`);
    } catch (err) {
      setUpdatePhase('available');
      setUpdateError(err instanceof Error ? err.message : 'Download failed');
    }
  }, [remoteRelease, showToast]);

  const handleInstallUpdate = useCallback(async () => {
    setUpdateError(null);
    setInstallProgress({ progress: 10, stage: 'preparing' });
    try {
      const result = await installAndroidApk(
        (ev) => {
          setInstallProgress(ev);
        },
        (msg) => {
          setIsInstallingModalOpen(false);
          setUpdateError(msg);
          setUpdatePhase('ready_to_install');
        }
      );

      if (result.needsPermission) {
        setUpdatePhase('needs_permission');
        return;
      }

      setMenuOpen(false);
      setIsInstallingModalOpen(true);
    } catch (err) {
      setIsInstallingModalOpen(false);
      setUpdateError(err instanceof Error ? err.message : 'Install failed');
    }
  }, []);

  useEffect(() => {
    soundFx.enabled = progress.soundEnabled;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore storage errors
    }
  }, [progress]);

  const triggerShake = useCallback((cardUid?: string, foundationSlot?: number) => {
    if (cardUid) {
      setShakingUid(cardUid);
      window.setTimeout(() => setShakingUid(null), 380);
    }
    if (foundationSlot !== undefined) {
      setShakingFoundationSlot(foundationSlot);
      window.setTimeout(() => setShakingFoundationSlot(null), 380);
    }
  }, []);

  // Trigger audio + confetti celebrations based on engine events
  useEffect(() => {
    if (gameState.status === 'won' && winHandledRef.current !== gameState.level.id + gameState.movesUsed) {
      winHandledRef.current = gameState.level.id + gameState.movesUsed;
      soundFx.win();
      confetti({
        particleCount: 95,
        spread: 75,
        origin: { y: 0.6 },
      });
      const bonus =
        gameState.movesLeft !== null ? Math.min(40, Math.floor(gameState.movesLeft / 2)) : 0;
      const earned = gameState.level.coinReward + bonus;
      setProgress((prev) => ({
        ...prev,
        coins: prev.coins + earned,
        streak: prev.streak + 1,
        completedLevelIds: prev.completedLevelIds.includes(gameState.level.id)
          ? prev.completedLevelIds
          : [...prev.completedLevelIds, gameState.level.id],
      }));
    }
  }, [gameState.status, gameState.level.id, gameState.level.coinReward, gameState.movesLeft, gameState.movesUsed]);

  const applyEngineResult = useCallback(
    (
      result: { state: GameState; valid: boolean; reason?: string },
      sourceCardUid?: string,
      targetSlot?: number
    ) => {
      setActiveHint(null);
      if (result.valid) {
        setSelectedSource(null);
        setGameState(result.state);
        const ev = result.state.lastEvent;
        if (ev?.type === 'category_complete') {
          soundFx.categoryComplete();
          if (ev.slotIndex !== undefined) {
            setJustCompletedSlot(ev.slotIndex);
            window.setTimeout(() => setJustCompletedSlot(null), 500);
          }
          confetti({
            particleCount: 28,
            spread: 50,
            origin: { y: 0.35 },
            colors: ['#fbbf24', '#38bdf8', '#4ade80'],
          });
          if (ev.message) showToast(ev.message);
        } else if (ev?.type === 'category_open') {
          soundFx.categoryOpen();
          setShowTutorialBanner(false);
        } else if (ev?.type === 'match') {
          soundFx.match();
          setShowTutorialBanner(false);
        } else if (ev?.type === 'unlock') {
          soundFx.unlock();
          if (ev.message) showToast(ev.message);
        } else if (ev?.type === 'draw' || ev?.type === 'recycle') {
          soundFx.cardFlip();
        } else if (ev?.type === 'tableau_move') {
          soundFx.cardSlide();
        } else if (ev?.type === 'joker') {
          soundFx.categoryComplete();
          if (ev.message) showToast(ev.message);
        }
      } else {
        setGameState(result.state);
        soundFx.mistake();
        triggerShake(sourceCardUid, targetSlot);
        if (result.state.lastEvent?.message) {
          showToast(result.state.lastEvent.message);
        }
      }
    },
    [showToast, triggerShake]
  );

  const startLevel = useCallback(
    (level: LevelConfig) => {
      winHandledRef.current = null;
      setSelectedSource(null);
      setActiveHint(null);
      setShowTutorialBanner(level.id === 'journey_1');
      setGameState(buildGameForLevel(level, progress.cosyUnlimitedMoves));
    },
    [progress.cosyUnlimitedMoves]
  );

  const handleSelectMode = useCallback(
    (modeId: ModeId, round = 1) => {
      const nextLevel =
        modeId === 'journey'
          ? JOURNEY_LEVELS[Math.max(0, Math.min(JOURNEY_LEVELS.length - 1, round - 1))]
          : generateModeLevel(modeId, round, Date.now());
      startLevel(nextLevel);
    },
    [startLevel]
  );

  const handleNextBoard = useCallback(() => {
    const curr = gameState.level;
    if (curr.modeId === 'journey') {
      const nextNum = curr.levelNumber < JOURNEY_LEVELS.length ? curr.levelNumber + 1 : 1;
      handleSelectMode('journey', nextNum);
    } else {
      handleSelectMode(curr.modeId, curr.levelNumber + 1);
    }
  }, [gameState.level, handleSelectMode]);

  const handleDrawStock = useCallback(() => {
    setSelectedSource(null);
    const res = drawOrRecycleStock(gameState);
    applyEngineResult(res);
  }, [gameState, applyEngineResult]);

  // Smart click/tap selection & interaction
  const handleCardTap = useCallback(
    (source: CardSource, card: GameCard) => {
      // If a card is already selected and user taps another column's card -> try moving there!
      if (selectedSource && selectedSource.card.uid !== card.uid) {
        if (source.zone === 'tableau') {
          const res = moveToTableau(gameState, selectedSource.source, source.colIndex);
          applyEngineResult(res, selectedSource.card.uid);
          return;
        }
      }

      // If tapping a Key card and its matching lock is visible, auto-unlock!
      if (card.kind === 'key') {
        for (let c = 0; c < gameState.tableau.length; c++) {
          const lockIdx = gameState.tableau[c].cards.findIndex(
            (x) => x.kind === 'lock' && x.faceUp && x.lockColor === card.lockColor
          );
          if (lockIdx >= 0) {
            const res = unlockWithKey(gameState, source, c, lockIdx);
            applyEngineResult(res, card.uid);
            return;
          }
        }
      }

      // Toggle selection
      if (selectedSource?.card.uid === card.uid) {
        // Second tap on same card -> smart auto-move!
        const res = smartAutoMove(gameState, source);
        if (res.valid) {
          applyEngineResult(res, card.uid);
        } else {
          setSelectedSource(null);
        }
      } else {
        setSelectedSource({ source, card });
      }
    },
    [selectedSource, gameState, applyEngineResult]
  );

  const handleCardDoubleClick = useCallback(
    (source: CardSource, card: GameCard) => {
      const res = smartAutoMove(gameState, source);
      if (res.valid) {
        applyEngineResult(res, card.uid);
      }
    },
    [gameState, applyEngineResult]
  );

  const handleClickFoundation = useCallback(
    (slotIndex: number) => {
      if (!selectedSource) return;
      const res = moveToFoundation(gameState, selectedSource.source, slotIndex);
      applyEngineResult(res, selectedSource.card.uid, slotIndex);
    },
    [selectedSource, gameState, applyEngineResult]
  );

  const handleClickEmptyColumn = useCallback(
    (colIndex: number) => {
      if (!selectedSource) return;
      const res = moveToTableau(gameState, selectedSource.source, colIndex);
      applyEngineResult(res, selectedSource.card.uid);
    },
    [selectedSource, gameState, applyEngineResult]
  );

  const handleClickLockCard = useCallback(
    (colIndex: number, cardIndex: number, lockCard: GameCard) => {
      // If player selected matching key -> unlock
      if (
        selectedSource &&
        selectedSource.card.kind === 'key' &&
        selectedSource.card.lockColor === lockCard.lockColor
      ) {
        const res = unlockWithKey(gameState, selectedSource.source, colIndex, cardIndex);
        applyEngineResult(res, selectedSource.card.uid);
        return;
      }

      // Or if matching key is currently accessible anywhere on board/waste -> auto-unlock on tap!
      if (
        gameState.waste.length > 0 &&
        gameState.waste[gameState.waste.length - 1].kind === 'key' &&
        gameState.waste[gameState.waste.length - 1].lockColor === lockCard.lockColor
      ) {
        const res = unlockWithKey(gameState, { zone: 'waste' }, colIndex, cardIndex);
        applyEngineResult(res);
        return;
      }
      for (const col of gameState.tableau) {
        if (col.cards.length > 0) {
          const idx = col.cards.length - 1;
          const top = col.cards[idx];
          if (top.faceUp && top.kind === 'key' && top.lockColor === lockCard.lockColor) {
            const res = unlockWithKey(
              gameState,
              { zone: 'tableau', colIndex: col.colIndex, cardIndex: idx },
              colIndex,
              cardIndex
            );
            applyEngineResult(res);
            return;
          }
        }
      }

      showToast(`Find the ${lockCard.lockColor?.toUpperCase()} Key card to break this lock!`);
      triggerShake(lockCard.uid);
    },
    [selectedSource, gameState, applyEngineResult, showToast, triggerShake]
  );

  // Hit-test drop targets under pointer coordinates
  const detectDropTarget = useCallback((clientX: number, clientY: number) => {
    const els = document.elementsFromPoint(clientX, clientY);
    let foundationSlot: number | null = null;
    let tableauCol: number | null = null;
    let lockUid: string | null = null;
    let lockCol: number | null = null;
    let lockIdx: number | null = null;

    for (const el of els) {
      const fAttr = el.getAttribute('data-drop-foundation');
      if (fAttr !== null && foundationSlot === null) {
        foundationSlot = Number(fAttr);
      }
      const lUid = el.getAttribute('data-drop-lock-uid');
      if (lUid !== null && lockUid === null) {
        lockUid = lUid;
        lockCol = Number(el.getAttribute('data-drop-lock-col'));
        lockIdx = Number(el.getAttribute('data-drop-lock-idx'));
      }
      const tAttr = el.getAttribute('data-drop-tableau');
      if (tAttr !== null && tableauCol === null) {
        tableauCol = Number(tAttr);
      }
    }

    return { foundationSlot, tableauCol, lockUid, lockCol, lockIdx };
  }, []);

  const beginDrag = useCallback(
    (e: React.PointerEvent, source: CardSource, cards: GameCard[]) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setActiveDrag({
        source,
        cards,
        startX: e.clientX,
        startY: e.clientY,
        currX: e.clientX,
        currY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        hasMoved: false,
      });
    },
    []
  );

  useEffect(() => {
    if (!activeDrag) return;

    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - activeDrag.startX;
      const dy = e.clientY - activeDrag.startY;
      const moved = activeDrag.hasMoved || Math.hypot(dx, dy) > 6;

      setActiveDrag((prev) =>
        prev
          ? {
              ...prev,
              currX: e.clientX,
              currY: e.clientY,
              hasMoved: moved,
            }
          : null
      );

      if (moved) {
        setHoverTarget(detectDropTarget(e.clientX, e.clientY));
      }
    };

    const handleUp = (e: PointerEvent) => {
      const target = detectDropTarget(e.clientX, e.clientY);
      const lead = activeDrag.cards[0];

      if (!activeDrag.hasMoved) {
        // Was a quick tap/click!
        handleCardTap(activeDrag.source, lead);
      } else if (target.foundationSlot !== null) {
        const res = moveToFoundation(gameState, activeDrag.source, target.foundationSlot);
        applyEngineResult(res, lead.uid, target.foundationSlot);
      } else if (
        lead.kind === 'key' &&
        target.lockCol !== null &&
        target.lockIdx !== null
      ) {
        const res = unlockWithKey(
          gameState,
          activeDrag.source,
          target.lockCol,
          target.lockIdx
        );
        applyEngineResult(res, lead.uid);
      } else if (target.tableauCol !== null) {
        const res = moveToTableau(gameState, activeDrag.source, target.tableauCol);
        applyEngineResult(res, lead.uid);
      }

      setActiveDrag(null);
      setHoverTarget({
        foundationSlot: null,
        tableauCol: null,
        lockUid: null,
        lockCol: null,
        lockIdx: null,
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [activeDrag, detectDropTarget, gameState, applyEngineResult, handleCardTap]);

  const draggingCardUids = useMemo(() => {
    const s = new Set<string>();
    if (activeDrag?.hasMoved) {
      activeDrag.cards.forEach((c) => s.add(c.uid));
    }
    return s;
  }, [activeDrag]);

  // Boosters
  const handleHint = () => {
    if (progress.hints <= 0 && progress.coins < 50) {
      showToast('Need 50 coins for a Hint!');
      return;
    }
    const hint = findBestHint(gameState);
    if (!hint) {
      showToast('No direct hint found — try rearranging columns or Undo!');
      return;
    }
    setProgress((p) =>
      p.hints > 0 ? { ...p, hints: p.hints - 1 } : { ...p, coins: p.coins - 50 }
    );
    setActiveHint(hint);
    showToast(hint.description);
    soundFx.categoryOpen();
  };

  const handleUndo = () => {
    if (gameState.history.length === 0) return;
    if (progress.undos <= 0 && progress.coins < 40) {
      showToast('Need 40 coins to Undo!');
      return;
    }
    const undone = undoLastMove(gameState);
    if (undone) {
      setProgress((p) =>
        p.undos > 0 ? { ...p, undos: p.undos - 1 } : { ...p, coins: p.coins - 40 }
      );
      setGameState(undone);
      setSelectedSource(null);
      setActiveHint(null);
      soundFx.cardSlide();
    }
  };

  const handleJoker = () => {
    if (progress.jokers <= 0 && progress.coins < 90) {
      showToast('Need 90 coins for Magic Match!');
      return;
    }
    const res = applyMagicJoker(gameState);
    if (res.valid) {
      setProgress((p) =>
        p.jokers > 0 ? { ...p, jokers: p.jokers - 1 } : { ...p, coins: p.coins - 90 }
      );
      applyEngineResult(res);
    } else {
      showToast('No remaining Joker move available!');
    }
  };

  const handleBuyExtraMoves = () => {
    if (progress.coins < 100) return;
    setProgress((p) => ({ ...p, coins: p.coins - 100 }));
    setGameState((prev) => addBonusMoves(prev, 10));
    showToast('+10 Moves added!');
  };

  const modeName =
    GAME_MODES.find((m) => m.id === gameState.level.modeId)?.name ?? 'Football';

  return (
    <div className="w-full h-[100dvh] bg-[#063e1b] flex items-center justify-center overflow-hidden">
      {/* Centered cosy portrait playfield matching mobile/tablet proportions */}
      <div className="relative w-full max-w-[468px] h-full sm:h-[96dvh] sm:max-h-[880px] sm:rounded-[28px] sm:border-4 sm:border-emerald-900/70 sm:shadow-[0_24px_60px_rgba(0,0,0,0.55)] felt-table flex flex-col justify-between px-2.5 py-2 overflow-hidden">
        {/* Top HUD */}
        <div className="shrink-0 space-y-0.5">
          <TopBar
            coins={progress.coins}
            categories={gameState.level.categories}
            completedCategoryIds={gameState.completedCategoryIds}
            levelNumber={gameState.level.levelNumber}
            modeName={modeName}
            streak={progress.streak}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenFieldGuide={() => setFieldGuideOpen(true)}
          />

          {/* Compact Level Subtitle & Mode Pill */}
          <div className="flex items-center justify-between px-1.5 text-[11px] font-extrabold text-emerald-100/90">
            <span className="truncate">{gameState.level.title}</span>
            <span className="text-amber-300 shrink-0 ml-2">
              {gameState.completedCategoryIds.length}/{gameState.level.categories.length} Done
            </span>
          </div>

          <StockWasteRow
            movesLeft={gameState.movesLeft}
            stock={gameState.stock}
            waste={gameState.waste}
            deckTheme={progress.deckTheme}
            selectedWasteUid={
              selectedSource?.source.zone === 'waste' ? selectedSource.card.uid : null
            }
            hint={activeHint}
            draggingUid={
              activeDrag?.hasMoved && activeDrag.source.zone === 'waste'
                ? activeDrag.cards[0].uid
                : null
            }
            shakingUid={shakingUid}
            onDrawStock={handleDrawStock}
            onWastePointerDown={(e, card) => beginDrag(e, { zone: 'waste' }, [card])}
            onWasteDoubleClick={(card) => handleCardDoubleClick({ zone: 'waste' }, card)}
          />
        </div>

        {/* Foundations */}
        <div className="shrink-0">
          <FoundationRow
            foundations={gameState.foundations}
            deckTheme={progress.deckTheme}
            hint={activeHint}
            hoveredFoundationSlot={hoverTarget.foundationSlot}
            justCompletedSlot={justCompletedSlot}
            shakingFoundationSlot={shakingFoundationSlot}
            hasSelection={Boolean(selectedSource)}
            onClickFoundation={handleClickFoundation}
          />
        </div>

        {/* Tableau Play Area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">
          <TableauColumns
            tableau={gameState.tableau}
            deckTheme={progress.deckTheme}
            selectedCardUid={selectedSource?.card.uid ?? null}
            draggingCardUids={draggingCardUids}
            shakingCardUid={shakingUid}
            hint={activeHint}
            hoveredTableauCol={hoverTarget.tableauCol}
            hoveredLockUid={hoverTarget.lockUid}
            onCardPointerDown={(e, colIndex, cardIndex) => {
              const col = gameState.tableau[colIndex];
              const run = getMovableRun(col, cardIndex);
              if (run.length > 0) {
                beginDrag(e, { zone: 'tableau', colIndex, cardIndex }, run);
              }
            }}
            onCardDoubleClick={(colIndex, cardIndex, card) =>
              handleCardDoubleClick({ zone: 'tableau', colIndex, cardIndex }, card)
            }
            onClickEmptyColumn={handleClickEmptyColumn}
            onClickLockCard={handleClickLockCard}
          />
        </div>

        {/* Level 1 Tutorial Tooltip (faithful to Image 3!) */}
        {showTutorialBanner && gameState.level.id === 'journey_1' && (
          <div
            onClick={() => setShowTutorialBanner(false)}
            className="mx-2 mb-1 px-4 py-2.5 rounded-2xl bg-[#064a1f]/90 border border-white/15 text-center text-[12px] font-bold text-white/95 leading-snug shadow-lg cursor-pointer"
          >
            Your goal is to <span className="text-amber-300 font-black">move all the cards</span> to
            the foundations, stacking them{' '}
            <span className="text-amber-300 font-black">by category</span> starting with the{' '}
            <span className="text-amber-300 font-black">Crown category card</span>. Just{' '}
            <span className="text-amber-300 font-black">drag a card</span> to move it!
          </div>
        )}

        {/* Toast Feedback Pill */}
        {toastMsg && (
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[84px] z-40 px-4 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-black shadow-xl border border-white/15 whitespace-nowrap max-w-[92%] truncate animate-pop-in">
            {toastMsg}
          </div>
        )}

        {/* Bottom Booster Bar */}
        <div className="shrink-0">
          <BoosterBar
            hintsLeft={progress.hints}
            undosLeft={progress.undos}
            jokersLeft={progress.jokers}
            canUndo={gameState.history.length > 0}
            coins={progress.coins}
            onHint={handleHint}
            onUndo={handleUndo}
            onJoker={handleJoker}
          />
        </div>
      </div>

      {/* Floating Dragged Card / Stack Overlay */}
      {activeDrag && activeDrag.hasMoved && (
        <div
          style={{
            position: 'fixed',
            left: `${activeDrag.currX - activeDrag.offsetX}px`,
            top: `${activeDrag.currY - activeDrag.offsetY}px`,
            width: '88px',
            zIndex: 100,
            pointerEvents: 'none',
            transform: 'rotate(2deg) scale(1.06)',
          }}
        >
          {activeDrag.cards.map((card, i) => (
            <div
              key={card.uid}
              style={{
                position: i === 0 ? 'relative' : 'absolute',
                top: i === 0 ? 0 : `${i * 26}px`,
                left: 0,
                width: '88px',
                height: '116px',
                zIndex: i + 1,
              }}
            >
              <CardView
                card={card}
                deckTheme={progress.deckTheme}
                isDragging
                isCoveredStrip={i < activeDrag.cards.length - 1}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <MenuModal
        open={menuOpen}
        currentLevel={gameState.level}
        progress={progress}
        installedInfo={installedInfo}
        updatePhase={updatePhase}
        remoteRelease={remoteRelease}
        downloadProgress={downloadProgress}
        updateError={updateError}
        onCheckUpdate={handleCheckUpdate}
        onDownloadUpdate={handleDownloadUpdate}
        onInstallUpdate={handleInstallUpdate}
        onClose={() => setMenuOpen(false)}
        onSelectMode={handleSelectMode}
        onRestartLevel={() => startLevel(gameState.level)}
        onToggleCosyMoves={() => {
          setProgress((p) => {
            const nextVal = !p.cosyUnlimitedMoves;
            setGameState((g) => ({
              ...g,
              movesLeft: nextVal ? null : g.movesLeft ?? g.level.maxMoves ?? 65,
            }));
            return { ...p, cosyUnlimitedMoves: nextVal };
          });
        }}
        onToggleSound={() =>
          setProgress((p) => ({ ...p, soundEnabled: !p.soundEnabled }))
        }
        onChangeDeckTheme={(deckTheme: DeckTheme) =>
          setProgress((p) => ({ ...p, deckTheme }))
        }
        onOpenCareerPath={() => setCareerPathOpen(true)}
      />

      <CareerPathModal
        open={careerPathOpen}
        onClose={() => setCareerPathOpen(false)}
        onEarnCoins={(amount) => {
          setProgress((p) => ({ ...p, coins: p.coins + amount }));
          showToast(`+${amount} Coins earned from Career Path!`);
        }}
      />

      <FieldGuideModal
        open={fieldGuideOpen}
        onClose={() => setFieldGuideOpen(false)}
      />

      <OutcomeModal
        status={gameState.status}
        level={gameState.level}
        movesUsed={gameState.movesUsed}
        movesLeft={gameState.movesLeft}
        mistakes={gameState.mistakes}
        coins={progress.coins}
        onNextBoard={handleNextBoard}
        onRestart={() => startLevel(gameState.level)}
        onBuyMoves={handleBuyExtraMoves}
        onUndo={() => {
          const undone = undoLastMove(gameState);
          if (undone) setGameState(undone);
        }}
      />

      <InstallProgressModal
        open={isInstallingModalOpen}
        progress={installProgress}
        version={remoteRelease?.latestVersion ?? ''}
      />

      <UpdatedBannerModal
        open={Boolean(updatedBanner)}
        version={updatedBanner?.version ?? ''}
        notes={updatedBanner?.notes ?? ''}
        onClose={() => setUpdatedBanner(null)}
      />
    </div>
  );
}

export default App;
