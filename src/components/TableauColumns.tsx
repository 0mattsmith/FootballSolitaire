import React from 'react';
import { DeckTheme, GameCard, HintSuggestion, TableauColumn } from '../types/game';
import { getMovableRun } from '../engine/solitaireEngine';
import { CardView } from './CardView';

interface TableauColumnsProps {
  tableau: TableauColumn[];
  deckTheme: DeckTheme;
  selectedCardUid: string | null;
  draggingCardUids: Set<string>;
  shakingCardUid: string | null;
  hint: HintSuggestion | null;
  hoveredTableauCol: number | null;
  hoveredLockUid: string | null;
  onCardPointerDown: (
    e: React.PointerEvent,
    colIndex: number,
    cardIndex: number,
    card: GameCard
  ) => void;
  onCardDoubleClick: (colIndex: number, cardIndex: number, card: GameCard) => void;
  onClickEmptyColumn: (colIndex: number) => void;
  onClickLockCard: (colIndex: number, cardIndex: number, card: GameCard) => void;
}

export const TableauColumns: React.FC<TableauColumnsProps> = ({
  tableau,
  deckTheme,
  selectedCardUid,
  draggingCardUids,
  shakingCardUid,
  hint,
  hoveredTableauCol,
  hoveredLockUid,
  onCardPointerDown,
  onCardDoubleClick,
  onClickEmptyColumn,
  onClickLockCard,
}) => {
  const colsClass = tableau.length === 3 ? 'grid-cols-3 max-w-[330px] mx-auto' : 'grid-cols-4';

  return (
    <div className={`w-full grid ${colsClass} gap-2.5 px-1 pt-2 pb-4 flex-1 items-start select-none`}>
      {tableau.map((col) => {
        const isColHovered = hoveredTableauCol === col.colIndex;
        const isHintTargetCol =
          hint?.target?.zone === 'tableau' && hint.target.colIndex === col.colIndex;

        // Compute top offsets so face-down cards peek 17px and covered face-up strips peek 27px
        const offsets: number[] = [];
        let acc = 0;
        for (let i = 0; i < col.cards.length; i++) {
          offsets.push(acc);
          const card = col.cards[i];
          if (!card.faceUp) {
            acc += 17;
          } else {
            acc += 27;
          }
        }
        const totalHeight =
          col.cards.length === 0 ? 116 : offsets[col.cards.length - 1] + 118;

        return (
          <div
            key={col.colIndex}
            data-drop-tableau={col.colIndex}
            style={{ minHeight: `${Math.max(122, totalHeight)}px` }}
            onClick={() => {
              if (col.cards.length === 0) {
                onClickEmptyColumn(col.colIndex);
              }
            }}
            className="relative w-full"
          >
            {/* Empty Tableau Column Slot */}
            {col.cards.length === 0 && (
              <div
                className={`w-full h-[116px] rounded-[11px] border-2 border-dashed transition-all flex items-center justify-center ${
                  isColHovered || isHintTargetCol
                    ? 'border-yellow-300 bg-yellow-300/15 scale-[1.03]'
                    : 'border-white/15 bg-black/10'
                }`}
              >
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">
                  Space
                </span>
              </div>
            )}

            {/* Cards Stack */}
            {col.cards.map((card, cardIndex) => {
              const isLast = cardIndex === col.cards.length - 1;
              const movableRun = getMovableRun(col, cardIndex);
              const isMovable = movableRun.length > 0;
              const isCoveredFaceUp = card.faceUp && !isLast && card.kind !== 'lock';
              const isDraggingThis = draggingCardUids.has(card.uid);

              const isHintSrc =
                hint?.source.zone === 'tableau' && hint.source.cardUid === card.uid;
              const isHintTargetLock =
                hint?.target?.zone === 'lock' && hint.target.cardUid === card.uid;
              const isHintTargetTopCard = isLast && isHintTargetCol;

              const isTargetHighlighted =
                (isLast && isColHovered) ||
                (card.kind === 'lock' && hoveredLockUid === card.uid) ||
                isHintTargetLock ||
                isHintTargetTopCard;

              return (
                <div
                  key={card.uid}
                  data-drop-lock-col={card.kind === 'lock' && card.faceUp ? col.colIndex : undefined}
                  data-drop-lock-idx={card.kind === 'lock' && card.faceUp ? cardIndex : undefined}
                  data-drop-lock-uid={card.kind === 'lock' && card.faceUp ? card.uid : undefined}
                  style={{
                    top: `${offsets[cardIndex]}px`,
                    zIndex: cardIndex + 1,
                    height: '116px',
                  }}
                  onPointerDown={(e) => {
                    if (card.kind === 'lock' && card.faceUp) {
                      e.stopPropagation();
                      onClickLockCard(col.colIndex, cardIndex, card);
                      return;
                    }
                    if (isMovable) {
                      onCardPointerDown(e, col.colIndex, cardIndex, card);
                    }
                  }}
                  onDoubleClick={() => {
                    if (isMovable) {
                      onCardDoubleClick(col.colIndex, cardIndex, card);
                    }
                  }}
                  className={`absolute inset-x-0 transition-[top] duration-200 ${
                    isMovable
                      ? 'cursor-grab active:cursor-grabbing touch-none'
                      : card.kind === 'lock'
                      ? 'cursor-pointer'
                      : ''
                  } ${isDraggingThis ? 'opacity-20 pointer-events-none' : ''} ${
                    isTargetHighlighted ? 'ring-4 ring-yellow-300 rounded-[11px]' : ''
                  }`}
                >
                  <CardView
                    card={card}
                    deckTheme={deckTheme}
                    isCoveredStrip={isCoveredFaceUp}
                    isSelected={selectedCardUid === card.uid}
                    isHinted={isHintSrc || isHintTargetLock || isHintTargetTopCard}
                    isShaking={shakingCardUid === card.uid}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
