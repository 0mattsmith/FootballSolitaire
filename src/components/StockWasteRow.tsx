import React from 'react';
import { RotateCcw } from 'lucide-react';
import { DeckTheme, GameCard, HintSuggestion } from '../types/game';
import { CardBack, CardView } from './CardView';

interface StockWasteRowProps {
  movesLeft: number | null;
  stock: GameCard[];
  waste: GameCard[];
  deckTheme: DeckTheme;
  selectedWasteUid: string | null;
  hint: HintSuggestion | null;
  draggingUid: string | null;
  shakingUid: string | null;
  onDrawStock: () => void;
  onWastePointerDown: (e: React.PointerEvent, card: GameCard) => void;
  onWasteDoubleClick: (card: GameCard) => void;
}

export const StockWasteRow: React.FC<StockWasteRowProps> = ({
  movesLeft,
  stock,
  waste,
  deckTheme,
  selectedWasteUid,
  hint,
  draggingUid,
  shakingUid,
  onDrawStock,
  onWastePointerDown,
  onWasteDoubleClick,
}) => {
  const isLowMoves = movesLeft !== null && movesLeft <= 8;
  const isStockHinted = hint?.source.zone === 'stock';

  // Show up to 3 most recent waste cards fanned horizontally like the screenshots
  const visibleWaste = waste.slice(-3); // oldest -> newest
  const topWaste = visibleWaste.length > 0 ? visibleWaste[visibleWaste.length - 1] : null;
  const behindWaste = visibleWaste.slice(0, -1).reverse(); // 1st behind, 2nd behind

  return (
    <div className="w-full flex items-start justify-between px-1 py-1 select-none">
      {/* Moves Ribbon Banner (Top-Left, exact ribbon shape from screenshots!) */}
      <div className="relative w-[84px] pt-0.5 shrink-0">
        <div
          className={`moves-ribbon w-full pt-2 pb-5 px-2 flex flex-col items-center justify-center shadow-[0_6px_14px_rgba(0,0,0,0.22)] transition-colors ${
            isLowMoves
              ? 'bg-gradient-to-b from-[#fb7185] to-[#e11d48] text-white'
              : 'bg-gradient-to-b from-[#2fd46d] to-[#1aa850] text-[#053b18]'
          }`}
        >
          <span className="text-[12px] font-extrabold tracking-wide border-b border-current/35 pb-0.5 mb-0.5">
            Moves
          </span>
          <span className="text-[28px] font-black leading-none tabular-nums">
            {movesLeft === null ? '∞' : movesLeft}
          </span>
        </div>
      </div>

      {/* Center-Right: Waste Fan + Stock Stack */}
      <div className="flex items-center gap-3">
        {/* Waste Pile (3-card horizontal fan: Top card on left, 2 peeking right with rotated text!) */}
        <div className="relative w-[138px] h-[112px] flex items-center justify-end">
          {visibleWaste.length === 0 ? (
            <div className="w-[82px] h-[108px] rounded-[11px] border-2 border-dashed border-white/15 bg-black/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white/35 uppercase tracking-wider">
                Waste
              </span>
            </div>
          ) : (
            <div className="relative w-full h-[108px]">
              {/* Fanned behind cards (render furthest right first) */}
              {behindWaste
                .slice()
                .reverse()
                .map((card, revIdx) => {
                  const offsetIdx = behindWaste.length - revIdx; // 1 or 2
                  const leftPx = 56 - (behindWaste.length === 2 ? 22 : 0) + offsetIdx * 23;
                  return (
                    <div
                      key={card.uid}
                      style={{ left: `${leftPx}px`, zIndex: 5 - offsetIdx }}
                      className="absolute top-0 w-[82px] h-[108px] rounded-[11px] bg-[#f7f2e8] border border-[#ddd2bf] shadow-md flex items-center justify-end pr-[5px] pointer-events-none"
                    >
                      <span className="vertical-card-label text-[10px] font-extrabold text-[#57493a] max-h-[92px] truncate">
                        {card.shortLabel || card.label}
                      </span>
                    </div>
                  );
                })}

              {/* Top Playable Waste Card */}
              {topWaste && (
                <div
                  style={{
                    left: `${behindWaste.length === 2 ? 34 : behindWaste.length === 1 ? 48 : 56}px`,
                    zIndex: 10,
                  }}
                  onPointerDown={(e) => onWastePointerDown(e, topWaste)}
                  onDoubleClick={() => onWasteDoubleClick(topWaste)}
                  className={`absolute top-0 w-[82px] h-[108px] cursor-grab active:cursor-grabbing touch-none ${
                    draggingUid === topWaste.uid ? 'opacity-25' : ''
                  }`}
                >
                  <CardView
                    card={topWaste}
                    deckTheme={deckTheme}
                    isSelected={selectedWasteUid === topWaste.uid}
                    isHinted={
                      hint?.source.zone === 'waste' && hint.source.cardUid === topWaste.uid
                    }
                    isShaking={shakingUid === topWaste.uid}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stock Deck */}
        <button
          type="button"
          onClick={onDrawStock}
          aria-label={stock.length > 0 ? `Draw card (${stock.length} left)` : 'Recycle waste pile'}
          className={`relative w-[82px] h-[108px] shrink-0 cursor-pointer active:scale-95 transition-transform ${
            isStockHinted ? 'ring-4 ring-yellow-300 rounded-[11px] animate-pulse' : ''
          }`}
        >
          {stock.length > 0 ? (
            <>
              {stock.length > 4 && (
                <div className="absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-[11px] bg-white/80 shadow" />
              )}
              <CardBack theme={deckTheme} />
              <div className="absolute -top-1.5 -right-1.5 bg-white text-[#1e293b] font-black text-[12px] min-w-[26px] h-[22px] px-1.5 rounded-full flex items-center justify-center shadow-md border border-slate-200 tabular-nums">
                {stock.length}
              </div>
            </>
          ) : (
            <div className="w-full h-full rounded-[11px] border-2 border-dashed border-white/30 bg-black/15 hover:bg-black/25 flex flex-col items-center justify-center gap-1 text-white/75 transition-colors">
              <RotateCcw className="w-6 h-6" strokeWidth={2.4} />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">
                {waste.length > 0 ? 'Recycle' : 'Empty'}
              </span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};
