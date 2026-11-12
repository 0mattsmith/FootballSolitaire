import React from 'react';
import { Crown } from 'lucide-react';
import { DeckTheme, FoundationSlot, HintSuggestion } from '../types/game';
import { CardView } from './CardView';

interface FoundationRowProps {
  foundations: FoundationSlot[];
  deckTheme: DeckTheme;
  hint: HintSuggestion | null;
  hoveredFoundationSlot: number | null;
  justCompletedSlot: number | null;
  shakingFoundationSlot: number | null;
  hasSelection: boolean;
  onClickFoundation: (slotIndex: number) => void;
}

export const FoundationRow: React.FC<FoundationRowProps> = ({
  foundations,
  deckTheme,
  hint,
  hoveredFoundationSlot,
  justCompletedSlot,
  shakingFoundationSlot,
  hasSelection,
  onClickFoundation,
}) => {
  const colsClass = foundations.length === 3 ? 'grid-cols-3 max-w-[330px] mx-auto' : 'grid-cols-4';

  return (
    <div className={`w-full grid ${colsClass} gap-2.5 px-1 pt-4 pb-2 select-none`}>
      {foundations.map((slot) => {
        const isHintTarget =
          hint?.target?.zone === 'foundation' && hint.target.slotIndex === slot.slotIndex;
        const isHovered = hoveredFoundationSlot === slot.slotIndex;
        const isBursting = justCompletedSlot === slot.slotIndex;
        const isShaking = shakingFoundationSlot === slot.slotIndex;
        const placedCount = slot.placedCards.length;
        const topPlaced = placedCount > 0 ? slot.placedCards[placedCount - 1] : null;

        return (
          <div
            key={slot.slotIndex}
            data-drop-foundation={slot.slotIndex}
            onClick={() => onClickFoundation(slot.slotIndex)}
            className={`relative w-full aspect-[82/108] max-h-[126px] rounded-[11px] transition-all ${
              hasSelection ? 'cursor-pointer' : ''
            } ${isHovered ? 'scale-[1.04] ring-4 ring-yellow-300' : ''} ${
              isHintTarget ? 'ring-4 ring-yellow-300 shadow-[0_0_20px_rgba(253,224,71,0.85)]' : ''
            } ${isShaking ? 'animate-card-shake' : ''}`}
          >
            {/* Golden Tab Pill protruding above when active with at least 1 item! */}
            {slot.anchorCard && placedCount > 0 && (
              <div className="absolute -top-[18px] left-1/2 -translate-x-1/2 z-20 max-w-[96%] bg-gradient-to-b from-[#fcd34d] to-[#f59e0b] text-[#451a03] px-2.5 py-[2px] rounded-t-[8px] rounded-b-[3px] shadow-sm border border-[#fde68a] flex items-center justify-center">
                <span className="text-[10.5px] font-black leading-tight truncate">
                  {slot.tabTitle}
                </span>
              </div>
            )}

            {/* Golden Completion Burst */}
            {isBursting && (
              <div className="absolute -inset-2 z-30 rounded-2xl bg-yellow-300/40 ring-4 ring-yellow-200 animate-ping pointer-events-none" />
            )}

            {!slot.anchorCard ? (
              /* Empty Recessed Crown Foundation Slot */
              <div
                className={`w-full h-full rounded-[11px] bg-[#085324]/70 border-2 transition-colors flex items-center justify-center shadow-inner ${
                  isHovered || isHintTarget
                    ? 'border-yellow-300 bg-[#0d6d31]/80'
                    : 'border-white/10'
                }`}
              >
                <Crown className="w-8 h-8 text-[#043b18]/80 fill-[#043b18]/70" />
              </div>
            ) : !topPlaced ? (
              /* Category Anchor Placed (0/N), waiting for first item */
              <CardView
                card={slot.anchorCard}
                deckTheme={deckTheme}
                countBadgeOverride={`0/${slot.totalCount}`}
                isHinted={isHintTarget}
              />
            ) : (
              /* Active Stack showing latest Item Card + k/N progress in top-right */
              <div className="relative w-full h-full">
                {placedCount >= 2 && (
                  <div className="absolute inset-0 translate-y-[3px] rounded-[11px] bg-[#ebe2d1] border border-[#d6c9b2] shadow" />
                )}
                <div className="relative w-full h-full">
                  <CardView card={topPlaced} deckTheme={deckTheme} />
                  {/* Progress counter k/N overlaid neatly at top-right */}
                  <span className="absolute top-1.5 right-2 text-[10px] font-black text-[#78716c] bg-[#fffdf8]/90 px-1 rounded leading-tight pointer-events-none">
                    {placedCount}/{slot.totalCount}
                  </span>
                  <Crown className="absolute top-1.5 left-1.5 w-3 h-3 text-[#f59e0b] fill-[#fbbf24] pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
