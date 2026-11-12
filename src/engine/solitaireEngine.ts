import {
  FoundationSlot,
  GameCard,
  GameSnapshot,
  GameState,
  HintSuggestion,
  LevelConfig,
  TableauColumn,
} from '../types/game';

export interface MoveResult {
  state: GameState;
  valid: boolean;
  reason?: string;
}

function cloneCards(cards: GameCard[]): GameCard[] {
  return cards.map((c) => ({ ...c, visual: { ...c.visual } }));
}

function cloneFoundations(foundations: FoundationSlot[]): FoundationSlot[] {
  return foundations.map((f) => ({
    ...f,
    anchorCard: f.anchorCard ? { ...f.anchorCard, visual: { ...f.anchorCard.visual } } : null,
    placedCards: cloneCards(f.placedCards),
  }));
}

function cloneTableau(tableau: TableauColumn[]): TableauColumn[] {
  return tableau.map((col) => ({
    colIndex: col.colIndex,
    cards: cloneCards(col.cards),
  }));
}

export function takeSnapshot(state: GameState): GameSnapshot {
  return {
    stock: cloneCards(state.stock),
    waste: cloneCards(state.waste),
    foundations: cloneFoundations(state.foundations),
    tableau: cloneTableau(state.tableau),
    completedCategoryIds: [...state.completedCategoryIds],
    movesLeft: state.movesLeft,
    movesUsed: state.movesUsed,
    mistakes: state.mistakes,
  };
}

function restoreFromSnapshot(state: GameState, snap: GameSnapshot, history: GameSnapshot[]): GameState {
  return {
    ...state,
    stock: cloneCards(snap.stock),
    waste: cloneCards(snap.waste),
    foundations: cloneFoundations(snap.foundations),
    tableau: cloneTableau(snap.tableau),
    completedCategoryIds: [...snap.completedCategoryIds],
    movesLeft: snap.movesLeft,
    movesUsed: snap.movesUsed,
    mistakes: snap.mistakes,
    status: 'playing',
    history,
  };
}

export function createInitialGameState(
  level: LevelConfig,
  tableau: TableauColumn[],
  stock: GameCard[],
  unlimitedOverride = false
): GameState {
  const foundations: FoundationSlot[] = Array.from(
    { length: level.foundationCount },
    (_, slotIndex) => ({
      slotIndex,
      categoryId: null,
      categoryTitle: null,
      tabTitle: null,
      totalCount: 0,
      anchorCard: null,
      placedCards: [],
    })
  );

  return {
    level,
    stock: cloneCards(stock),
    waste: [],
    foundations,
    tableau: cloneTableau(tableau),
    completedCategoryIds: [],
    movesLeft: unlimitedOverride ? null : level.maxMoves,
    movesUsed: 0,
    mistakes: 0,
    status: 'playing',
    history: [],
    unlockedLocks: [],
  };
}

/**
 * Returns the contiguous movable slice starting at cardIndex down to the end of the column.
 * Returns empty array if that card cannot be picked up.
 */
export function getMovableRun(col: TableauColumn, cardIndex: number): GameCard[] {
  if (cardIndex < 0 || cardIndex >= col.cards.length) return [];
  const base = col.cards[cardIndex];
  if (!base.faceUp || base.kind === 'lock') return [];

  // Single top-most card (category, key, or item)
  if (cardIndex === col.cards.length - 1) {
    return [base];
  }

  // Multi-card run is only allowed for contiguous same-category item cards
  if (base.kind !== 'item' || !base.categoryId) return [];

  const run: GameCard[] = [base];
  for (let i = cardIndex + 1; i < col.cards.length; i++) {
    const c = col.cards[i];
    if (!c.faceUp || c.kind !== 'item' || c.categoryId !== base.categoryId) {
      return [];
    }
    run.push(c);
  }
  return run;
}

function flipExposedTableauCards(tableau: TableauColumn[]): void {
  for (const col of tableau) {
    if (col.cards.length > 0) {
      const top = col.cards[col.cards.length - 1];
      if (!top.faceUp) {
        top.faceUp = true;
      }
    }
  }
}

function spendOneMove(
  state: GameState,
  isMistake = false
): { movesLeft: number | null; movesUsed: number; mistakes: number; lost: boolean } {
  const movesUsed = state.movesUsed + 1;
  const mistakes = state.mistakes + (isMistake ? 1 : 0);
  if (state.movesLeft === null) {
    return { movesLeft: null, movesUsed, mistakes, lost: false };
  }
  const nextMovesLeft = Math.max(0, state.movesLeft - 1);
  return {
    movesLeft: nextMovesLeft,
    movesUsed,
    mistakes,
    lost: nextMovesLeft <= 0,
  };
}

function evaluateWinOrLose(state: GameState, lostIfNoMoves: boolean): 'playing' | 'won' | 'lost' {
  if (state.completedCategoryIds.length >= state.level.categories.length) {
    return 'won';
  }
  if (lostIfNoMoves && state.movesLeft !== null && state.movesLeft <= 0) {
    return 'lost';
  }
  return 'playing';
}

export function drawOrRecycleStock(state: GameState): MoveResult {
  if (state.status !== 'playing') {
    return { state, valid: false, reason: 'Game already ended' };
  }
  if (state.stock.length === 0 && state.waste.length === 0) {
    return { state, valid: false, reason: 'No cards in stock or waste' };
  }

  const snap = takeSnapshot(state);
  const stock = cloneCards(state.stock);
  const waste = cloneCards(state.waste);
  const isRecycle = stock.length === 0;

  if (isRecycle) {
    while (waste.length > 0) {
      const c = waste.pop()!;
      c.faceUp = false;
      stock.push(c);
    }
  } else {
    const drawn = stock.pop()!;
    drawn.faceUp = true;
    waste.push(drawn);
  }

  const moveStats = spendOneMove(state, false);
  const next: GameState = {
    ...state,
    stock,
    waste,
    movesLeft: moveStats.movesLeft,
    movesUsed: moveStats.movesUsed,
    mistakes: moveStats.mistakes,
    history: [...state.history, snap],
    lastEvent: {
      type: isRecycle ? 'recycle' : 'draw',
      timestamp: Date.now(),
    },
  };
  next.status = evaluateWinOrLose(next, moveStats.lost);
  return { state: next, valid: true };
}

export type CardSource =
  | { zone: 'waste' }
  | { zone: 'tableau'; colIndex: number; cardIndex: number };

function extractSourceCards(
  source: CardSource,
  waste: GameCard[],
  tableau: TableauColumn[]
): GameCard[] | null {
  if (source.zone === 'waste') {
    if (waste.length === 0) return null;
    return [waste.pop()!];
  }
  const col = tableau[source.colIndex];
  if (!col) return null;
  const run = getMovableRun(col, source.cardIndex);
  if (run.length === 0) return null;
  return col.cards.splice(source.cardIndex, run.length);
}

function peekSourceCards(
  source: CardSource,
  waste: GameCard[],
  tableau: TableauColumn[]
): GameCard[] | null {
  if (source.zone === 'waste') {
    if (waste.length === 0) return null;
    return [waste[waste.length - 1]];
  }
  const col = tableau[source.colIndex];
  if (!col) return null;
  const run = getMovableRun(col, source.cardIndex);
  return run.length > 0 ? run : null;
}

export function moveToFoundation(
  state: GameState,
  source: CardSource,
  slotIndex: number
): MoveResult {
  if (state.status !== 'playing') {
    return { state, valid: false, reason: 'Game already ended' };
  }
  const slot = state.foundations[slotIndex];
  if (!slot) return { state, valid: false, reason: 'Invalid foundation slot' };

  const preview = peekSourceCards(source, state.waste, state.tableau);
  if (!preview || preview.length === 0) {
    return { state, valid: false, reason: 'No movable card selected' };
  }
  const lead = preview[0];

  // Empty foundation slot: must receive a Category Anchor card
  if (!slot.anchorCard) {
    if (lead.kind !== 'category' || preview.length !== 1) {
      return {
        state: {
          ...state,
          lastEvent: {
            type: 'mistake',
            timestamp: Date.now(),
            message: 'Place a Crown Category card here first!',
          },
        },
        valid: false,
        reason: 'empty-foundation-needs-category',
      };
    }

    const snap = takeSnapshot(state);
    const waste = cloneCards(state.waste);
    const tableau = cloneTableau(state.tableau);
    const foundations = cloneFoundations(state.foundations);

    const extracted = extractSourceCards(source, waste, tableau)!;
    const anchor = extracted[0];
    const catDef = state.level.categories.find((c) => c.id === anchor.categoryId);

    foundations[slotIndex] = {
      slotIndex,
      categoryId: anchor.categoryId ?? null,
      categoryTitle: catDef?.title ?? anchor.label,
      tabTitle: catDef?.tabTitle ?? anchor.label,
      totalCount: anchor.totalCount ?? catDef?.items.length ?? 0,
      anchorCard: anchor,
      placedCards: [],
    };

    flipExposedTableauCards(tableau);
    const moveStats = spendOneMove(state, false);
    const next: GameState = {
      ...state,
      waste,
      tableau,
      foundations,
      movesLeft: moveStats.movesLeft,
      movesUsed: moveStats.movesUsed,
      mistakes: moveStats.mistakes,
      history: [...state.history, snap],
      lastEvent: {
        type: 'category_open',
        timestamp: Date.now(),
        slotIndex,
        message: `${catDef?.tabTitle ?? anchor.label} opened!`,
      },
    };
    next.status = evaluateWinOrLose(next, moveStats.lost);
    return { state: next, valid: true };
  }

  // Active foundation slot: accepts matching item cards
  if (lead.kind !== 'item') {
    return {
      state: {
        ...state,
        lastEvent: {
          type: 'mistake',
          timestamp: Date.now(),
          message:
            lead.kind === 'category'
              ? 'Category cards go in empty Crown slots!'
              : 'Keys unlock colored padlocks on the board!',
        },
      },
      valid: false,
      reason: 'non-item-on-active-foundation',
    };
  }

  // Wrong category match -> deduct 1 move & bounce back
  if (lead.categoryId !== slot.categoryId) {
    const snap = takeSnapshot(state);
    const moveStats = spendOneMove(state, true);
    const next: GameState = {
      ...state,
      movesLeft: moveStats.movesLeft,
      movesUsed: moveStats.movesUsed,
      mistakes: moveStats.mistakes,
      history: [...state.history, snap],
      lastEvent: {
        type: 'mistake',
        timestamp: Date.now(),
        slotIndex,
        message: `Doesn't belong in ${slot.tabTitle}! (-1 move)`,
      },
    };
    next.status = evaluateWinOrLose(next, moveStats.lost);
    return { state: next, valid: false, reason: 'wrong-category' };
  }

  // Correct match!
  const snap = takeSnapshot(state);
  const waste = cloneCards(state.waste);
  const tableau = cloneTableau(state.tableau);
  const foundations = cloneFoundations(state.foundations);
  const completedCategoryIds = [...state.completedCategoryIds];

  const extracted = extractSourceCards(source, waste, tableau)!;
  const targetSlot = foundations[slotIndex];
  targetSlot.placedCards.push(...extracted);

  const isCompleted = targetSlot.placedCards.length >= targetSlot.totalCount;
  const completedTitle = targetSlot.tabTitle ?? '';

  if (isCompleted && targetSlot.categoryId) {
    if (!completedCategoryIds.includes(targetSlot.categoryId)) {
      completedCategoryIds.push(targetSlot.categoryId);
    }
    // Clear the completed foundation slot immediately so new categories can use it
    foundations[slotIndex] = {
      slotIndex,
      categoryId: null,
      categoryTitle: null,
      tabTitle: null,
      totalCount: 0,
      anchorCard: null,
      placedCards: [],
    };
  }

  flipExposedTableauCards(tableau);
  const moveStats = spendOneMove(state, false);
  const next: GameState = {
    ...state,
    waste,
    tableau,
    foundations,
    completedCategoryIds,
    movesLeft: moveStats.movesLeft,
    movesUsed: moveStats.movesUsed,
    mistakes: moveStats.mistakes,
    history: [...state.history, snap],
    lastEvent: {
      type: isCompleted ? 'category_complete' : 'match',
      timestamp: Date.now(),
      slotIndex,
      message: isCompleted ? `${completedTitle} Complete!` : undefined,
    },
  };
  next.status = evaluateWinOrLose(next, moveStats.lost);
  return { state: next, valid: true };
}

export function moveToTableau(
  state: GameState,
  source: CardSource,
  targetColIndex: number
): MoveResult {
  if (state.status !== 'playing') {
    return { state, valid: false, reason: 'Game already ended' };
  }
  if (source.zone === 'tableau' && source.colIndex === targetColIndex) {
    return { state, valid: false, reason: 'Same column' };
  }

  const targetCol = state.tableau[targetColIndex];
  if (!targetCol) return { state, valid: false, reason: 'Invalid column' };

  const preview = peekSourceCards(source, state.waste, state.tableau);
  if (!preview || preview.length === 0) {
    return { state, valid: false, reason: 'No movable card selected' };
  }
  const lead = preview[0];

  // Empty column: accepts any movable card/run
  if (targetCol.cards.length === 0) {
    const snap = takeSnapshot(state);
    const waste = cloneCards(state.waste);
    const tableau = cloneTableau(state.tableau);
    const extracted = extractSourceCards(source, waste, tableau)!;
    tableau[targetColIndex].cards.push(...extracted);
    flipExposedTableauCards(tableau);

    const moveStats = spendOneMove(state, false);
    const next: GameState = {
      ...state,
      waste,
      tableau,
      movesLeft: moveStats.movesLeft,
      movesUsed: moveStats.movesUsed,
      mistakes: moveStats.mistakes,
      history: [...state.history, snap],
      lastEvent: {
        type: 'tableau_move',
        timestamp: Date.now(),
        colIndex: targetColIndex,
      },
    };
    next.status = evaluateWinOrLose(next, moveStats.lost);
    return { state: next, valid: true };
  }

  const targetTop = targetCol.cards[targetCol.cards.length - 1];

  // Key onto matching Lock at bottom of column
  if (lead.kind === 'key' && targetTop.kind === 'lock') {
    if (lead.lockColor === targetTop.lockColor) {
      return unlockWithKey(state, source, targetColIndex, targetCol.cards.length - 1);
    }
    return {
      state: {
        ...state,
        lastEvent: {
          type: 'mistake',
          timestamp: Date.now(),
          message: 'Key color does not match this lock!',
        },
      },
      valid: false,
      reason: 'wrong-lock-color',
    };
  }

  // Stacking items in tableau: must both be items and share categoryId
  if (lead.kind === 'item' && targetTop.kind === 'item') {
    if (lead.categoryId === targetTop.categoryId) {
      const snap = takeSnapshot(state);
      const waste = cloneCards(state.waste);
      const tableau = cloneTableau(state.tableau);
      const extracted = extractSourceCards(source, waste, tableau)!;
      tableau[targetColIndex].cards.push(...extracted);
      flipExposedTableauCards(tableau);

      const moveStats = spendOneMove(state, false);
      const next: GameState = {
        ...state,
        waste,
        tableau,
        movesLeft: moveStats.movesLeft,
        movesUsed: moveStats.movesUsed,
        mistakes: moveStats.mistakes,
        history: [...state.history, snap],
        lastEvent: {
          type: 'tableau_move',
          timestamp: Date.now(),
          colIndex: targetColIndex,
        },
      };
      next.status = evaluateWinOrLose(next, moveStats.lost);
      return { state: next, valid: true };
    }

    // Mismatched category stack attempt costs 1 move & bounces
    const snap = takeSnapshot(state);
    const moveStats = spendOneMove(state, true);
    const next: GameState = {
      ...state,
      movesLeft: moveStats.movesLeft,
      movesUsed: moveStats.movesUsed,
      mistakes: moveStats.mistakes,
      history: [...state.history, snap],
      lastEvent: {
        type: 'mistake',
        timestamp: Date.now(),
        colIndex: targetColIndex,
        message: 'Those cards belong to different categories! (-1 move)',
      },
    };
    next.status = evaluateWinOrLose(next, moveStats.lost);
    return { state: next, valid: false, reason: 'wrong-tableau-category' };
  }

  return {
    state: {
      ...state,
      lastEvent: {
        type: 'mistake',
        timestamp: Date.now(),
        message:
          targetTop.kind === 'category'
            ? 'Move the Crown Category card to a foundation slot first!'
            : 'Cannot stack onto that card.',
      },
    },
    valid: false,
    reason: 'incompatible-target',
  };
}

export function unlockWithKey(
  state: GameState,
  keySource: CardSource,
  lockColIndex: number,
  lockCardIndex: number
): MoveResult {
  if (state.status !== 'playing') {
    return { state, valid: false, reason: 'Game already ended' };
  }

  const preview = peekSourceCards(keySource, state.waste, state.tableau);
  if (!preview || preview.length !== 1 || preview[0].kind !== 'key') {
    return { state, valid: false, reason: 'Source is not an accessible key' };
  }

  const lockCol = state.tableau[lockColIndex];
  const lockCard = lockCol?.cards[lockCardIndex];
  if (!lockCard || lockCard.kind !== 'lock' || !lockCard.faceUp) {
    return { state, valid: false, reason: 'Target lock is not visible' };
  }

  if (preview[0].lockColor !== lockCard.lockColor) {
    return { state, valid: false, reason: 'Key color mismatch' };
  }

  const snap = takeSnapshot(state);
  const waste = cloneCards(state.waste);
  const tableau = cloneTableau(state.tableau);

  // Remove the lock first or track indices carefully if same column
  if (keySource.zone === 'tableau' && keySource.colIndex === lockColIndex) {
    // Remove higher index first so lower index doesn't shift
    const kIdx = keySource.cardIndex;
    if (kIdx > lockCardIndex) {
      tableau[lockColIndex].cards.splice(kIdx, 1);
      tableau[lockColIndex].cards.splice(lockCardIndex, 1);
    } else {
      tableau[lockColIndex].cards.splice(lockCardIndex, 1);
      tableau[lockColIndex].cards.splice(kIdx, 1);
    }
  } else {
    extractSourceCards(keySource, waste, tableau);
    tableau[lockColIndex].cards.splice(lockCardIndex, 1);
  }

  flipExposedTableauCards(tableau);
  const moveStats = spendOneMove(state, false);
  const next: GameState = {
    ...state,
    waste,
    tableau,
    unlockedLocks: [...state.unlockedLocks, lockCard.lockColor!],
    movesLeft: moveStats.movesLeft,
    movesUsed: moveStats.movesUsed,
    mistakes: moveStats.mistakes,
    history: [...state.history, snap],
    lastEvent: {
      type: 'unlock',
      timestamp: Date.now(),
      colIndex: lockColIndex,
      lockColor: lockCard.lockColor,
      message: `${lockCard.lockColor?.toUpperCase()} Lock Broken!`,
    },
  };
  next.status = evaluateWinOrLose(next, moveStats.lost);
  return { state: next, valid: true };
}

/**
 * Smart tap/double-click auto-move:
 * 1. If Key -> auto-unlock matching visible lock
 * 2. If Category -> auto-place in first empty foundation
 * 3. If Item -> auto-place in active matching foundation, OR stack on matching tableau card
 */
export function smartAutoMove(state: GameState, source: CardSource): MoveResult {
  const preview = peekSourceCards(source, state.waste, state.tableau);
  if (!preview || preview.length === 0) return { state, valid: false };
  const lead = preview[0];

  if (lead.kind === 'key') {
    for (let c = 0; c < state.tableau.length; c++) {
      const col = state.tableau[c];
      for (let i = col.cards.length - 1; i >= 0; i--) {
        const card = col.cards[i];
        if (card.kind === 'lock' && card.faceUp && card.lockColor === lead.lockColor) {
          return unlockWithKey(state, source, c, i);
        }
      }
    }
    return { state, valid: false, reason: 'No matching lock visible yet' };
  }

  if (lead.kind === 'category') {
    const emptySlot = state.foundations.find((f) => !f.anchorCard);
    if (emptySlot) {
      return moveToFoundation(state, source, emptySlot.slotIndex);
    }
    // Or move from waste to empty tableau column
    if (source.zone === 'waste') {
      const emptyCol = state.tableau.find((col) => col.cards.length === 0);
      if (emptyCol) return moveToTableau(state, source, emptyCol.colIndex);
    }
    return { state, valid: false, reason: 'No empty foundation slot yet' };
  }

  if (lead.kind === 'item') {
    const matchingSlot = state.foundations.find((f) => f.categoryId === lead.categoryId);
    if (matchingSlot) {
      return moveToFoundation(state, source, matchingSlot.slotIndex);
    }
    // Try stacking onto another column with same category top card
    for (let c = 0; c < state.tableau.length; c++) {
      if (source.zone === 'tableau' && source.colIndex === c) continue;
      const col = state.tableau[c];
      if (col.cards.length > 0) {
        const top = col.cards[col.cards.length - 1];
        if (top.faceUp && top.kind === 'item' && top.categoryId === lead.categoryId) {
          return moveToTableau(state, source, c);
        }
      }
    }
    // If from waste and there's an empty column
    if (source.zone === 'waste') {
      const emptyCol = state.tableau.find((col) => col.cards.length === 0);
      if (emptyCol) return moveToTableau(state, source, emptyCol.colIndex);
    }
  }

  return { state, valid: false };
}

export function undoLastMove(state: GameState): GameState | null {
  if (state.history.length === 0) return null;
  const history = [...state.history];
  const prev = history.pop()!;
  const restored = restoreFromSnapshot(state, prev, history);
  restored.lastEvent = {
    type: 'undo',
    timestamp: Date.now(),
    message: 'Move undone',
  };
  return restored;
}

export function addBonusMoves(state: GameState, count: number): GameState {
  return {
    ...state,
    movesLeft: state.movesLeft === null ? null : state.movesLeft + count,
    status: 'playing',
  };
}

export function findBestHint(state: GameState): HintSuggestion | null {
  if (state.status !== 'playing') return null;

  const accessibleSources: Array<{
    source: CardSource;
    run: GameCard[];
    uid: string;
    uncoversFaceDown: boolean;
  }> = [];

  for (let c = 0; c < state.tableau.length; c++) {
    const col = state.tableau[c];
    for (let i = 0; i < col.cards.length; i++) {
      const run = getMovableRun(col, i);
      if (run.length > 0) {
        accessibleSources.push({
          source: { zone: 'tableau', colIndex: c, cardIndex: i },
          run,
          uid: run[0].uid,
          uncoversFaceDown: i > 0 && !col.cards[i - 1].faceUp,
        });
        break; // Highest movable run in column is strictly best if moving same-category group
      }
    }
  }

  if (state.waste.length > 0) {
    const topWaste = state.waste[state.waste.length - 1];
    accessibleSources.push({
      source: { zone: 'waste' },
      run: [topWaste],
      uid: topWaste.uid,
      uncoversFaceDown: false,
    });
  }

  // 1. Key -> visible Lock
  for (const acc of accessibleSources) {
    const lead = acc.run[0];
    if (lead.kind === 'key') {
      for (const col of state.tableau) {
        const lockIdx = col.cards.findIndex(
          (card) => card.kind === 'lock' && card.faceUp && card.lockColor === lead.lockColor
        );
        if (lockIdx >= 0) {
          return {
            description: `Use ${lead.label} to break the ${lead.lockColor} lock!`,
            source:
              acc.source.zone === 'waste'
                ? { zone: 'waste', cardUid: acc.uid }
                : {
                    zone: 'tableau',
                    colIndex: acc.source.colIndex,
                    cardIndex: acc.source.cardIndex,
                    cardUid: acc.uid,
                  },
            target: {
              zone: 'lock',
              colIndex: col.colIndex,
              cardUid: col.cards[lockIdx].uid,
            },
          };
        }
      }
    }
  }

  // 2. Item -> Active matching Foundation (prefer ones that finish a category or uncover cards)
  const itemMatches = accessibleSources
    .filter((acc) => acc.run[0].kind === 'item')
    .map((acc) => {
      const slot = state.foundations.find((f) => f.categoryId === acc.run[0].categoryId);
      if (!slot) return null;
      const completes = slot.placedCards.length + acc.run.length >= slot.totalCount;
      const score = (completes ? 100 : 0) + (acc.uncoversFaceDown ? 30 : 0) + acc.run.length * 10;
      return { acc, slot, score };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  if (itemMatches.length > 0) {
    const best = itemMatches[0];
    return {
      description: `Match "${best.acc.run[0].label}" to ${best.slot.tabTitle}`,
      source:
        best.acc.source.zone === 'waste'
          ? { zone: 'waste', cardUid: best.acc.uid }
          : {
              zone: 'tableau',
              colIndex: best.acc.source.colIndex,
              cardIndex: best.acc.source.cardIndex,
              cardUid: best.acc.uid,
            },
      target: { zone: 'foundation', slotIndex: best.slot.slotIndex },
    };
  }

  // 3. Category card -> Empty Foundation
  const emptyFoundation = state.foundations.find((f) => !f.anchorCard);
  if (emptyFoundation) {
    const catAcc = accessibleSources.find((acc) => acc.run[0].kind === 'category');
    if (catAcc) {
      return {
        description: `Place category "${catAcc.run[0].label}" in the empty Crown slot`,
        source:
          catAcc.source.zone === 'waste'
            ? { zone: 'waste', cardUid: catAcc.uid }
            : {
                zone: 'tableau',
                colIndex: catAcc.source.colIndex,
                cardIndex: catAcc.source.cardIndex,
                cardUid: catAcc.uid,
              },
        target: { zone: 'foundation', slotIndex: emptyFoundation.slotIndex },
      };
    }
  }

  // 4. Stack same-category items in tableau if it uncovers something or clears waste
  for (const acc of accessibleSources) {
    const lead = acc.run[0];
    if (lead.kind !== 'item') continue;
    const movesFromBase =
      acc.source.zone === 'waste' || acc.source.cardIndex > 0 || acc.uncoversFaceDown;
    if (!movesFromBase) continue;

    for (const col of state.tableau) {
      if (acc.source.zone === 'tableau' && acc.source.colIndex === col.colIndex) continue;
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      if (top.faceUp && top.kind === 'item' && top.categoryId === lead.categoryId) {
        return {
          description: `Stack "${lead.label}" with "${top.label}"`,
          source:
            acc.source.zone === 'waste'
              ? { zone: 'waste', cardUid: acc.uid }
              : {
                  zone: 'tableau',
                  colIndex: acc.source.colIndex,
                  cardIndex: acc.source.cardIndex,
                  cardUid: acc.uid,
                },
          target: { zone: 'tableau', colIndex: col.colIndex },
        };
      }
    }
  }

  // 5. Move blocking card to an empty tableau column if it uncovers a face-down card
  const emptyTableauCol = state.tableau.find((c) => c.cards.length === 0);
  if (emptyTableauCol) {
    const blockingAcc = accessibleSources.find(
      (acc) => acc.source.zone === 'tableau' && acc.uncoversFaceDown
    );
    if (blockingAcc && blockingAcc.source.zone === 'tableau') {
      return {
        description: `Move "${blockingAcc.run[0].label}" to empty column to uncover buried card`,
        source: {
          zone: 'tableau',
          colIndex: blockingAcc.source.colIndex,
          cardIndex: blockingAcc.source.cardIndex,
          cardUid: blockingAcc.uid,
        },
        target: { zone: 'tableau', colIndex: emptyTableauCol.colIndex },
      };
    }
  }

  // 6. Draw or recycle from stock
  if (state.stock.length > 0 || state.waste.length > 0) {
    return {
      description:
        state.stock.length > 0
          ? 'Draw a new card from the deck'
          : 'Recycle the waste pile back into the deck',
      source: { zone: 'stock' },
    };
  }

  return null;
}

/**
 * Magic Joker booster: pulls one helpful card (even if buried!) and executes
 * a free smart placement (opens a category, completes a match, or breaks a lock).
 */
export function applyMagicJoker(state: GameState): MoveResult {
  if (state.status !== 'playing') return { state, valid: false };

  const snap = takeSnapshot(state);
  const stock = cloneCards(state.stock);
  const waste = cloneCards(state.waste);
  const tableau = cloneTableau(state.tableau);
  const foundations = cloneFoundations(state.foundations);
  const completedCategoryIds = [...state.completedCategoryIds];
  const unlockedLocks = [...state.unlockedLocks];

  const pullCardByPredicate = (pred: (c: GameCard) => boolean): GameCard | null => {
    // Prefer waste top, then tableau exposed, then stock, then buried tableau
    if (waste.length > 0 && pred(waste[waste.length - 1])) {
      return waste.pop()!;
    }
    for (const col of tableau) {
      if (col.cards.length > 0 && pred(col.cards[col.cards.length - 1])) {
        const c = col.cards.pop()!;
        c.faceUp = true;
        return c;
      }
    }
    for (let i = stock.length - 1; i >= 0; i--) {
      if (pred(stock[i])) {
        const [c] = stock.splice(i, 1);
        c.faceUp = true;
        return c;
      }
    }
    for (let i = waste.length - 1; i >= 0; i--) {
      if (pred(waste[i])) {
        const [c] = waste.splice(i, 1);
        c.faceUp = true;
        return c;
      }
    }
    for (const col of tableau) {
      for (let i = col.cards.length - 1; i >= 0; i--) {
        if (pred(col.cards[i])) {
          const [c] = col.cards.splice(i, 1);
          c.faceUp = true;
          return c;
        }
      }
    }
    return null;
  };

  // Priority 1: Fill an active foundation (closest to completion first)
  const activeSlots = foundations
    .filter((f) => f.anchorCard && f.categoryId)
    .sort((a, b) => b.totalCount - b.placedCards.length - (a.totalCount - a.placedCards.length));

  if (activeSlots.length > 0) {
    // Pick the one nearest completion first
    activeSlots.sort(
      (a, b) => a.totalCount - a.placedCards.length - (b.totalCount - b.placedCards.length)
    );
    const slot = activeSlots[0];
    const pulled = pullCardByPredicate(
      (c) => c.kind === 'item' && c.categoryId === slot.categoryId
    );
    if (pulled) {
      slot.placedCards.push(pulled);
      let msg = `Joker matched "${pulled.label}" to ${slot.tabTitle}!`;
      if (slot.placedCards.length >= slot.totalCount && slot.categoryId) {
        if (!completedCategoryIds.includes(slot.categoryId)) {
          completedCategoryIds.push(slot.categoryId);
        }
        msg = `Joker completed ${slot.tabTitle}!`;
        foundations[slot.slotIndex] = {
          slotIndex: slot.slotIndex,
          categoryId: null,
          categoryTitle: null,
          tabTitle: null,
          totalCount: 0,
          anchorCard: null,
          placedCards: [],
        };
      }
      flipExposedTableauCards(tableau);
      const next: GameState = {
        ...state,
        stock,
        waste,
        tableau,
        foundations,
        completedCategoryIds,
        history: [...state.history, snap],
        lastEvent: { type: 'joker', timestamp: Date.now(), slotIndex: slot.slotIndex, message: msg },
      };
      next.status = evaluateWinOrLose(next, false);
      return { state: next, valid: true };
    }
  }

  // Priority 2: Open an empty foundation with an available Category anchor
  const emptySlot = foundations.find((f) => !f.anchorCard);
  if (emptySlot) {
    const pulledCat = pullCardByPredicate((c) => c.kind === 'category');
    if (pulledCat) {
      const catDef = state.level.categories.find((c) => c.id === pulledCat.categoryId);
      foundations[emptySlot.slotIndex] = {
        slotIndex: emptySlot.slotIndex,
        categoryId: pulledCat.categoryId ?? null,
        categoryTitle: catDef?.title ?? pulledCat.label,
        tabTitle: catDef?.tabTitle ?? pulledCat.label,
        totalCount: pulledCat.totalCount ?? catDef?.items.length ?? 0,
        anchorCard: pulledCat,
        placedCards: [],
      };
      flipExposedTableauCards(tableau);
      const next: GameState = {
        ...state,
        stock,
        waste,
        tableau,
        foundations,
        history: [...state.history, snap],
        lastEvent: {
          type: 'joker',
          timestamp: Date.now(),
          slotIndex: emptySlot.slotIndex,
          message: `Joker opened "${catDef?.tabTitle ?? pulledCat.label}"!`,
        },
      };
      next.status = evaluateWinOrLose(next, false);
      return { state: next, valid: true };
    }
  }

  // Priority 3: Break a visible lock
  for (const col of tableau) {
    const lockIdx = col.cards.findIndex((c) => c.kind === 'lock' && c.faceUp);
    if (lockIdx >= 0) {
      const lockColor = col.cards[lockIdx].lockColor!;
      const key = pullCardByPredicate((c) => c.kind === 'key' && c.lockColor === lockColor);
      if (key) {
        col.cards.splice(lockIdx, 1);
        unlockedLocks.push(lockColor);
        flipExposedTableauCards(tableau);
        const next: GameState = {
          ...state,
          stock,
          waste,
          tableau,
          unlockedLocks,
          history: [...state.history, snap],
          lastEvent: {
            type: 'joker',
            timestamp: Date.now(),
            colIndex: col.colIndex,
            lockColor,
            message: `Joker shattered the ${lockColor} lock!`,
          },
        };
        next.status = evaluateWinOrLose(next, false);
        return { state: next, valid: true };
      }
    }
  }

  return { state, valid: false };
}
