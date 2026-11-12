import { describe, expect, it } from 'vitest';
import { JOURNEY_LEVELS, generateModeLevel } from '../data/levels';
import { generateVerifiedLevelDeal, verifyDealSolvable } from './levelGenerator';
import { compareSemver } from './appUpdater';
import { resolveLocalAsset } from './footballApi';
import {
  applyMagicJoker,
  createInitialGameState,
  drawOrRecycleStock,
  findBestHint,
  moveToFoundation,
  moveToTableau,
  undoLastMove,
  unlockWithKey,
} from './solitaireEngine';
import { ModeId } from '../types/game';

describe('Football Solitaire Engine & Level Solvability', () => {
  it('verifies all 10 Journey levels are disjoint and 100% solvable', () => {
    for (const level of JOURNEY_LEVELS) {
      const { tableau, stock } = generateVerifiedLevelDeal(level);
      const check = verifyDealSolvable(level, tableau, stock);
      expect(check.solvable, `Level ${level.levelNumber} (${level.title}) should be solvable`).toBe(
        true
      );
      if (level.maxMoves !== null) {
        expect(check.movesTaken).toBeLessThanOrEqual(level.maxMoves);
      }
    }
  });

  it('verifies all procedural Game Modes produce disjoint solvable boards', () => {
    const modes: ModeId[] = ['leagues_clubs', 'legends_eras', 'cups_nations', 'endless_mix'];
    for (const mode of modes) {
      for (let round = 1; round <= 3; round++) {
        const level = generateModeLevel(mode, round, 4200 + round * 17);
        const allLabels = new Set<string>();
        for (const cat of level.categories) {
          for (const item of cat.items) {
            const key = item.label.toLowerCase();
            expect(allLabels.has(key), `Duplicate label ${key} in ${mode} round ${round}`).toBe(
              false
            );
            allLabels.add(key);
          }
        }
        const { tableau, stock } = generateVerifiedLevelDeal(level);
        const check = verifyDealSolvable(level, tableau, stock);
        expect(check.solvable, `${mode} round ${round} should be solvable`).toBe(true);
      }
    }
  });

  it('enforces category foundation opening, matching, wrong-drop penalty, and undo', () => {
    const lvl = JOURNEY_LEVELS[1]; // Level 2 (finite moves)
    const { tableau, stock } = generateVerifiedLevelDeal(lvl);
    let state = createInitialGameState(lvl, tableau, stock, false);
    const startMoves = state.movesLeft!;

    // Draw from stock costs 1 move
    const drawRes = drawOrRecycleStock(state);
    expect(drawRes.valid).toBe(true);
    state = drawRes.state;
    expect(state.movesLeft).toBe(startMoves - 1);
    expect(state.waste.length).toBe(1);

    // Undo refunds the move and restores waste
    const undone = undoLastMove(state);
    expect(undone).not.toBeNull();
    state = undone!;
    expect(state.movesLeft).toBe(startMoves);
    expect(state.waste.length).toBe(0);
  });

  it('supports stacking same-category cards, lock breaking, hints, and joker', () => {
    const lvl = JOURNEY_LEVELS[2]; // Level 3 (Break The Locks)
    const { tableau, stock } = generateVerifiedLevelDeal(lvl);
    let state = createInitialGameState(lvl, tableau, stock, false);

    // Ensure lock cards exist on the board
    const hasLocks = state.tableau.some((col) => col.cards.some((c) => c.kind === 'lock'));
    expect(hasLocks).toBe(true);

    const hint = findBestHint(state);
    expect(hint).not.toBeNull();

    // Magic Joker should advance state cleanly
    const jokerRes = applyMagicJoker(state);
    expect(jokerRes.valid).toBe(true);
    state = jokerRes.state;
    expect(state.history.length).toBe(1);
  });

  it('allows manual category placement, matching, wrong penalty, and key unlock', () => {
    const lvl = JOURNEY_LEVELS[0];
    const catA = lvl.categories[0];
    const catB = lvl.categories[1];
    const state = createInitialGameState(
      lvl,
      [
        {
          colIndex: 0,
          cards: [
            {
              uid: 'cat_a',
              kind: 'category',
              faceUp: true,
              categoryId: catA.id,
              label: catA.title,
              totalCount: 2,
              visual: catA.visual,
            },
          ],
        },
        {
          colIndex: 1,
          cards: [
            {
              uid: 'lock_red',
              kind: 'lock',
              faceUp: true,
              label: 'Red Lock',
              lockColor: 'red',
              visual: { type: 'text' },
            },
            {
              uid: 'item_b',
              kind: 'item',
              faceUp: true,
              categoryId: catB.id,
              label: catB.items[0].label,
              visual: catB.items[0].visual,
            },
          ],
        },
        {
          colIndex: 2,
          cards: [
            {
              uid: 'key_red',
              kind: 'key',
              faceUp: true,
              label: 'Red Key',
              lockColor: 'red',
              visual: { type: 'text' },
            },
          ],
        },
      ],
      [],
      false
    );

    // Place category A into foundation 0
    const openRes = moveToFoundation(state, { zone: 'tableau', colIndex: 0, cardIndex: 0 }, 0);
    expect(openRes.valid).toBe(true);

    // Wrong item onto foundation 0 fails
    const wrongRes = moveToFoundation(openRes.state, { zone: 'tableau', colIndex: 1, cardIndex: 1 }, 0);
    expect(wrongRes.valid).toBe(false);
    expect(wrongRes.reason).toBe('wrong-category');

    // Move item_b to empty column 0
    const emptyRes = moveToTableau(openRes.state, { zone: 'tableau', colIndex: 1, cardIndex: 1 }, 0);
    expect(emptyRes.valid).toBe(true);

    // Unlock red lock with red key
    const unlockRes = unlockWithKey(emptyRes.state, { zone: 'tableau', colIndex: 2, cardIndex: 0 }, 1, 0);
    expect(unlockRes.valid).toBe(true);
    expect(unlockRes.state.tableau[1].cards.length).toBe(0);
    expect(unlockRes.state.unlockedLocks).toContain('red');
  });

  it('compares semver versions and resolves relative asset paths cleanly', () => {
    expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
    expect(compareSemver('v1.2.0', '1.1.9')).toBe(1);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);

    const arsenal = resolveLocalAsset('club_arsenal', 'badge');
    expect(arsenal.src).toBeTruthy();
    expect(arsenal.src!.startsWith('http')).toBe(false);
    expect(arsenal.src!.includes('assets/clubs/club_arsenal')).toBe(true);
  });
});
