import React from 'react';
import { Lightbulb, RotateCcw, Sparkles } from 'lucide-react';

interface BoosterBarProps {
  hintsLeft: number;
  undosLeft: number;
  jokersLeft: number;
  canUndo: boolean;
  coins: number;
  onHint: () => void;
  onUndo: () => void;
  onJoker: () => void;
}

export const BoosterBar: React.FC<BoosterBarProps> = ({
  hintsLeft,
  undosLeft,
  jokersLeft,
  canUndo,
  coins,
  onHint,
  onUndo,
  onJoker,
}) => {
  return (
    <div className="w-full flex items-center justify-center gap-6 py-2 px-3 select-none">
      {/* Hint Booster */}
      <button
        type="button"
        onClick={onHint}
        title={hintsLeft > 0 ? 'Show Hint' : 'Buy Hint (50 coins)'}
        className="relative group cursor-pointer active:scale-95 transition-transform"
      >
        <div className="w-[54px] h-[54px] rounded-2xl bg-white p-[3px] shadow-[0_5px_14px_rgba(0,0,0,0.28)]">
          <div className="w-full h-full rounded-[13px] bg-gradient-to-b from-[#6bb6ff] to-[#2e7cf6] flex items-center justify-center shadow-inner group-hover:brightness-105">
            <Lightbulb className="w-7 h-7 text-white fill-white/30" strokeWidth={2.4} />
          </div>
        </div>
        <span
          className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full text-[11px] font-black flex items-center justify-center shadow border-2 border-white ${
            hintsLeft > 0 ? 'bg-[#ef4444] text-white' : 'bg-amber-400 text-amber-950'
          }`}
        >
          {hintsLeft > 0 ? hintsLeft : '50'}
        </span>
      </button>

      {/* Undo Booster */}
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title={undosLeft > 0 ? 'Undo Last Move' : 'Undo (40 coins)'}
        className={`relative group transition-transform ${
          canUndo ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed'
        }`}
      >
        <div className="w-[54px] h-[54px] rounded-2xl bg-white p-[3px] shadow-[0_5px_14px_rgba(0,0,0,0.28)]">
          <div
            className={`w-full h-full rounded-[13px] bg-gradient-to-b from-[#6bb6ff] to-[#2e7cf6] flex items-center justify-center shadow-inner ${
              canUndo ? 'group-hover:brightness-105' : 'opacity-55 saturate-50'
            }`}
          >
            <RotateCcw className="w-7 h-7 text-white" strokeWidth={2.7} />
          </div>
        </div>
        <span
          className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full text-[11px] font-black flex items-center justify-center shadow border-2 border-white ${
            undosLeft > 0 ? 'bg-[#ef4444] text-white' : 'bg-amber-400 text-amber-950'
          }`}
        >
          {undosLeft > 0 ? undosLeft : '40'}
        </span>
      </button>

      {/* Magic Joker Auto-Match Booster */}
      <button
        type="button"
        onClick={onJoker}
        title={
          jokersLeft > 0
            ? 'Magic Match (auto-plays 1 helpful card!)'
            : coins >= 90
            ? 'Use Magic Match (90 coins)'
            : 'Need 90 coins'
        }
        className="relative group cursor-pointer active:scale-95 transition-transform"
      >
        <div className="w-[46px] h-[56px] rounded-xl bg-gradient-to-b from-[#fde047] via-[#f59e0b] to-[#d97706] p-[3px] shadow-[0_5px_14px_rgba(0,0,0,0.28)] border-2 border-yellow-100">
          <div className="w-full h-full rounded-[8px] border border-yellow-200/70 flex flex-col items-center justify-center gap-0.5 group-hover:brightness-105">
            <Sparkles className="w-6 h-6 text-white fill-white/40 drop-shadow" strokeWidth={2.4} />
          </div>
        </div>
        <span
          className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full text-[11px] font-black flex items-center justify-center shadow border-2 border-white ${
            jokersLeft > 0 ? 'bg-[#ef4444] text-white' : 'bg-amber-400 text-amber-950'
          }`}
        >
          {jokersLeft > 0 ? jokersLeft : '90'}
        </span>
      </button>
    </div>
  );
};
