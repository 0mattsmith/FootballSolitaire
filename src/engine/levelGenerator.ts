import {
  CategoryDef,
  GameCard,
  GameState,
  LevelConfig,
  LockColor,
  TableauColumn,
} from '../types/game';
import {
  createInitialGameState,
  drawOrRecycleStock,
  getMovableRun,
  moveToFoundation,
  moveToTableau,
  unlockWithKey,
} from './solitaireEngine';

// Deterministic Mulberry32 PRNG
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildDeckCards(categories: CategoryDef[]): {
  anchors: GameCard[];
  items: GameCard[];
} {
  const anchors: GameCard[] = [];
  const items: GameCard[] = [];

  for (const cat of categories) {
    anchors.push({
      uid: `cat_${cat.id}`,
      kind: 'category',
      faceUp: false,
      categoryId: cat.id,
      label: cat.title,
      shortLabel: cat.tabTitle,
      visual: { ...cat.visual },
      totalCount: cat.items.length,
    });

    for (const item of cat.items) {
      items.push({
        uid: `item_${cat.id}_${item.id}`,
        kind: 'item',
        faceUp: false,
        categoryId: cat.id,
        label: item.label,
        shortLabel: item.shortLabel ?? item.label,
        visual: { ...item.visual },
      });
    }
  }

  return { anchors, items };
}

function buildRawDeal(
  level: LevelConfig,
  attemptSeed: number
): { tableau: TableauColumn[]; stock: GameCard[] } {
  const rng = createSeededRng(attemptSeed);
  const { anchors, items } = buildDeckCards(level.categories);

  const shuffledAnchors = shuffleWithRng(anchors, rng);
  const shuffledItems = shuffleWithRng(items, rng);

  const colCount = level.tableauCount;
  const columns: GameCard[][] = Array.from({ length: colCount }, () => []);

  // Ensure at least 1-2 category anchors start accessible or shallow so the board opens cleanly
  const anchorOnBoardCount = Math.min(
    shuffledAnchors.length,
    Math.max(2, Math.min(level.foundationCount, colCount))
  );
  const boardAnchors = shuffledAnchors.slice(0, anchorOnBoardCount);
  const stockAnchors = shuffledAnchors.slice(anchorOnBoardCount);

  // Target column depths based on difficulty
  const totalDeckSize = anchors.length + items.length;
  const tableauRatio = level.hasLocks ? 0.56 : totalDeckSize <= 20 ? 0.65 : 0.52;
  const targetTableauCards = Math.min(
    totalDeckSize - Math.max(2, stockAnchors.length + 2),
    Math.max(colCount * 2, Math.round(totalDeckSize * tableauRatio))
  );

  // Combine remaining pool for tableau vs stock
  const pool = shuffleWithRng([...boardAnchors, ...shuffledItems], rng);
  const tableauPool = pool.slice(0, targetTableauCards);
  const stockPool = shuffleWithRng([...pool.slice(targetTableauCards), ...stockAnchors], rng);

  // Distribute tableauPool across columns with staggered solitaire heights
  const baseDepth = Math.floor(tableauPool.length / colCount);
  const extra = tableauPool.length % colCount;
  let cursor = 0;
  for (let c = 0; c < colCount; c++) {
    const count = baseDepth + (c < extra ? 1 : 0);
    columns[c] = tableauPool.slice(cursor, cursor + count);
    cursor += count;
  }

  // Guarantee at least one Category card is face-up on top of a column OR near top of stock
  const hasVisibleAnchor = columns.some(
    (col) => col.length > 0 && col[col.length - 1].kind === 'category'
  );
  if (!hasVisibleAnchor) {
    // Swap an anchor into the bottom-most position of column 0 (if any anchor is buried)
    let found = false;
    for (let c = 0; c < colCount && !found; c++) {
      for (let i = 0; i < columns[c].length; i++) {
        if (columns[c][i].kind === 'category') {
          const lastIdx = columns[0].length - 1;
          if (lastIdx >= 0) {
            const tmp = columns[0][lastIdx];
            columns[0][lastIdx] = columns[c][i];
            columns[c][i] = tmp;
            found = true;
            break;
          }
        }
      }
    }
    if (!found && stockPool.length > 0) {
      const idx = stockPool.findIndex((x) => x.kind === 'category');
      if (idx >= 0) {
        const lastIdx = columns[colCount - 1].length - 1;
        if (lastIdx >= 0) {
          const tmp = columns[colCount - 1][lastIdx];
          columns[colCount - 1][lastIdx] = stockPool[idx];
          stockPool[idx] = tmp;
        }
      }
    }
  }

  // Inject Locks & Keys if level.hasLocks
  if (level.hasLocks && colCount >= 4) {
    const lockColors: LockColor[] = ['red', 'orange'];
    // Lock 1 sits exposed at bottom of col 1, Key 1 buried 1 card deep in col 0
    // Lock 2 sits 1 card deep under exposed card in col 2, Key 2 buried 1-2 cards deep in col 3
    const locksConfig: Array<{ color: LockColor; lockCol: number; underTop: boolean; keyCol: number }> = [
      { color: lockColors[0], lockCol: 1, underTop: false, keyCol: 0 },
      { color: lockColors[1], lockCol: 2, underTop: true, keyCol: 3 },
    ];

    for (const cfg of locksConfig) {
      const lockCard: GameCard = {
        uid: `lock_${cfg.color}_${attemptSeed}`,
        kind: 'lock',
        faceUp: true,
        label: `${cfg.color[0].toUpperCase()}${cfg.color.slice(1)} Lock`,
        visual: { type: 'text' },
        lockColor: cfg.color,
      };
      const keyCard: GameCard = {
        uid: `key_${cfg.color}_${attemptSeed}`,
        kind: 'key',
        faceUp: false,
        label: `${cfg.color[0].toUpperCase()}${cfg.color.slice(1)} Key`,
        visual: { type: 'text' },
        lockColor: cfg.color,
      };

      // Insert lock into lockCol
      if (cfg.underTop && columns[cfg.lockCol].length >= 1) {
        columns[cfg.lockCol].splice(columns[cfg.lockCol].length - 1, 0, lockCard);
      } else {
        columns[cfg.lockCol].push(lockCard);
      }

      // Insert key into keyCol (1 or 2 cards above the bottom so player digs for it, just like Image 1!)
      const kCol = columns[cfg.keyCol];
      const insertPos = Math.max(0, kCol.length - 1);
      kCol.splice(insertPos, 0, keyCard);
    }
  }

  // Set faceUp for bottom-most card of each column, faceDown for buried cards (except locks stay visible if right behind top!)
  const tableau: TableauColumn[] = columns.map((cards, colIndex) => {
    const mapped = cards.map((card, idx) => {
      const isBottom = idx === cards.length - 1;
      const isLockBehindTop =
        card.kind === 'lock' && idx === cards.length - 2 && cards.length >= 2;
      return {
        ...card,
        faceUp: isBottom || isLockBehindTop,
      };
    });
    return { colIndex, cards: mapped };
  });

  const stock = stockPool.map((c) => ({ ...c, faceUp: false }));
  return { tableau, stock };
}

/**
 * Fast greedy/prioritized automated player used to verify a deal is 100% solvable
 * without Boosters, and to compute a fair move budget.
 */
export function verifyDealSolvable(
  level: LevelConfig,
  tableau: TableauColumn[],
  stock: GameCard[]
): { solvable: boolean; movesTaken: number } {
  let state: GameState = createInitialGameState(level, tableau, stock, true);
  const visited = new Set<string>();
  let steps = 0;
  const maxSteps = 260;

  while (state.status === 'playing' && steps < maxSteps) {
    steps++;

    // 1. Unlock any visible lock if matching key is accessible
    let progressed = false;
    for (let c = 0; c < state.tableau.length && !progressed; c++) {
      const col = state.tableau[c];
      for (let i = 0; i < col.cards.length && !progressed; i++) {
        const run = getMovableRun(col, i);
        if (run.length === 1 && run[0].kind === 'key') {
          for (let lc = 0; lc < state.tableau.length && !progressed; lc++) {
            const lockIdx = state.tableau[lc].cards.findIndex(
              (x) => x.kind === 'lock' && x.faceUp && x.lockColor === run[0].lockColor
            );
            if (lockIdx >= 0) {
              const res = unlockWithKey(state, { zone: 'tableau', colIndex: c, cardIndex: i }, lc, lockIdx);
              if (res.valid) {
                state = res.state;
                progressed = true;
              }
            }
          }
        }
      }
    }
    if (progressed) continue;

    if (state.waste.length > 0 && state.waste[state.waste.length - 1].kind === 'key') {
      const keyCard = state.waste[state.waste.length - 1];
      for (let lc = 0; lc < state.tableau.length && !progressed; lc++) {
        const lockIdx = state.tableau[lc].cards.findIndex(
          (x) => x.kind === 'lock' && x.faceUp && x.lockColor === keyCard.lockColor
        );
        if (lockIdx >= 0) {
          const res = unlockWithKey(state, { zone: 'waste' }, lc, lockIdx);
          if (res.valid) {
            state = res.state;
            progressed = true;
          }
        }
      }
      if (progressed) continue;
    }

    // 2. Move matching accessible item to active foundation (prefer finishing categories or revealing buried cards)
    const itemCandidates: Array<{
      src: { zone: 'waste' } | { zone: 'tableau'; colIndex: number; cardIndex: number };
      slotIndex: number;
      score: number;
    }> = [];

    for (let c = 0; c < state.tableau.length; c++) {
      const col = state.tableau[c];
      for (let i = 0; i < col.cards.length; i++) {
        const run = getMovableRun(col, i);
        if (run.length > 0 && run[0].kind === 'item') {
          const slot = state.foundations.find((f) => f.categoryId === run[0].categoryId);
          if (slot) {
            const completes = slot.placedCards.length + run.length >= slot.totalCount;
            const uncovers = i > 0 && !col.cards[i - 1].faceUp;
            itemCandidates.push({
              src: { zone: 'tableau', colIndex: c, cardIndex: i },
              slotIndex: slot.slotIndex,
              score: (completes ? 100 : 0) + (uncovers ? 40 : 0) + run.length * 10,
            });
          }
          break;
        }
      }
    }
    if (state.waste.length > 0) {
      const top = state.waste[state.waste.length - 1];
      if (top.kind === 'item') {
        const slot = state.foundations.find((f) => f.categoryId === top.categoryId);
        if (slot) {
          const completes = slot.placedCards.length + 1 >= slot.totalCount;
          itemCandidates.push({
            src: { zone: 'waste' },
            slotIndex: slot.slotIndex,
            score: (completes ? 95 : 0) + 15,
          });
        }
      }
    }

    if (itemCandidates.length > 0) {
      itemCandidates.sort((a, b) => b.score - a.score);
      const best = itemCandidates[0];
      const res = moveToFoundation(state, best.src, best.slotIndex);
      if (res.valid) {
        state = res.state;
        continue;
      }
    }

    // 3. Place accessible Category anchor card into empty foundation (prefer categories with most visible items)
    const emptySlot = state.foundations.find((f) => !f.anchorCard);
    if (emptySlot) {
      const visibleCountByCat = new Map<string, number>();
      for (const col of state.tableau) {
        for (const c of col.cards) {
          if (c.faceUp && c.kind === 'item' && c.categoryId) {
            visibleCountByCat.set(c.categoryId, (visibleCountByCat.get(c.categoryId) ?? 0) + 1);
          }
        }
      }
      if (state.waste.length > 0 && state.waste[state.waste.length - 1].kind === 'item') {
        const cid = state.waste[state.waste.length - 1].categoryId!;
        visibleCountByCat.set(cid, (visibleCountByCat.get(cid) ?? 0) + 1);
      }

      const catCandidates: Array<{
        src: { zone: 'waste' } | { zone: 'tableau'; colIndex: number; cardIndex: number };
        score: number;
      }> = [];

      for (let c = 0; c < state.tableau.length; c++) {
        const col = state.tableau[c];
        if (col.cards.length > 0) {
          const top = col.cards[col.cards.length - 1];
          if (top.faceUp && top.kind === 'category' && top.categoryId) {
            const uncovers = col.cards.length >= 2 && !col.cards[col.cards.length - 2].faceUp;
            const catItems = top.totalCount ?? 5;
            catCandidates.push({
              src: { zone: 'tableau', colIndex: c, cardIndex: col.cards.length - 1 },
              score:
                (visibleCountByCat.get(top.categoryId) ?? 0) * 15 +
                (uncovers ? 30 : 0) +
                (10 - catItems) * 4,
            });
          }
        }
      }
      if (state.waste.length > 0 && state.waste[state.waste.length - 1].kind === 'category') {
        const wCat = state.waste[state.waste.length - 1];
        catCandidates.push({
          src: { zone: 'waste' },
          score: (visibleCountByCat.get(wCat.categoryId!) ?? 0) * 15 + (10 - (wCat.totalCount ?? 5)) * 4,
        });
      }

      if (catCandidates.length > 0) {
        catCandidates.sort((a, b) => b.score - a.score);
        const res = moveToFoundation(state, catCandidates[0].src, emptySlot.slotIndex);
        if (res.valid) {
          state = res.state;
          continue;
        }
      }
    }

    // 4. Stack same-category items in tableau if it uncovers a card or clears waste
    let stacked = false;
    for (let c = 0; c < state.tableau.length && !stacked; c++) {
      const col = state.tableau[c];
      for (let i = 0; i < col.cards.length && !stacked; i++) {
        const run = getMovableRun(col, i);
        if (run.length === 0 || run[0].kind !== 'item') continue;
        const uncovers = i > 0;
        if (!uncovers) break; // don't ping-pong root items endlessly
        for (let tc = 0; tc < state.tableau.length; tc++) {
          if (tc === c) continue;
          const tCol = state.tableau[tc];
          if (tCol.cards.length > 0) {
            const tTop = tCol.cards[tCol.cards.length - 1];
            if (tTop.faceUp && tTop.kind === 'item' && tTop.categoryId === run[0].categoryId) {
              const res = moveToTableau(state, { zone: 'tableau', colIndex: c, cardIndex: i }, tc);
              if (res.valid) {
                state = res.state;
                stacked = true;
                break;
              }
            }
          }
        }
        break;
      }
    }
    if (stacked) continue;

    // Also pull from waste onto matching tableau column if useful
    if (state.waste.length > 0 && state.waste[state.waste.length - 1].kind === 'item') {
      const w = state.waste[state.waste.length - 1];
      for (let tc = 0; tc < state.tableau.length; tc++) {
        const tCol = state.tableau[tc];
        if (tCol.cards.length > 0) {
          const tTop = tCol.cards[tCol.cards.length - 1];
          if (tTop.faceUp && tTop.kind === 'item' && tTop.categoryId === w.categoryId) {
            const res = moveToTableau(state, { zone: 'waste' }, tc);
            if (res.valid) {
              state = res.state;
              stacked = true;
              break;
            }
          }
        }
      }
      if (stacked) continue;
    }

    // 5. Move a blocking card/run to an empty column ONLY if it reveals buried cards
    const emptyCol = state.tableau.find((col) => col.cards.length === 0);
    if (emptyCol) {
      let movedToEmpty = false;
      for (let c = 0; c < state.tableau.length; c++) {
        const col = state.tableau[c];
        for (let i = 1; i < col.cards.length; i++) {
          const run = getMovableRun(col, i);
          if (run.length > 0) {
            const res = moveToTableau(
              state,
              { zone: 'tableau', colIndex: c, cardIndex: i },
              emptyCol.colIndex
            );
            if (res.valid) {
              state = res.state;
              movedToEmpty = true;
              break;
            }
          }
        }
        if (movedToEmpty) break;
      }
      if (movedToEmpty) continue;
    }

    // 6. Draw or recycle from stock
    const sig =
      state.stock.map((c) => c.uid).join(',') +
      '|' +
      state.waste.map((c) => c.uid).join(',') +
      '|' +
      state.foundations.map((f) => `${f.categoryId}:${f.placedCards.length}`).join(',');
    if (visited.has(sig)) {
      // Last-ditch: move waste top to empty column if available to change cycle
      if (emptyCol && state.waste.length > 0) {
        const res = moveToTableau(state, { zone: 'waste' }, emptyCol.colIndex);
        if (res.valid) {
          state = res.state;
          continue;
        }
      }
      break;
    }
    visited.add(sig);

    const drawRes = drawOrRecycleStock(state);
    if (!drawRes.valid) break;
    state = drawRes.state;
  }

  return {
    solvable: state.status === 'won',
    movesTaken: state.movesUsed,
  };
}

export function generateVerifiedLevelDeal(level: LevelConfig): {
  tableau: TableauColumn[];
  stock: GameCard[];
  recommendedMoves: number | null;
} {
  for (let attempt = 0; attempt < 40; attempt++) {
    const attemptSeed = level.seed + attempt * 7919;
    const { tableau, stock } = buildRawDeal(level, attemptSeed);
    const check = verifyDealSolvable(level, tableau, stock);
    if (check.solvable) {
      const recommendedMoves =
        level.maxMoves === null
          ? null
          : Math.max(level.maxMoves, Math.ceil(check.movesTaken * 1.65) + 12);
      return { tableau, stock, recommendedMoves };
    }
  }

  // Fallback deal if rare random constraints occur
  const fallback = buildRawDeal(level, level.seed + 99991);
  return {
    tableau: fallback.tableau,
    stock: fallback.stock,
    recommendedMoves: level.maxMoves,
  };
}
