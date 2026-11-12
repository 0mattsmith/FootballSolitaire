import React from 'react';
import { Check, Coins, Menu, Trophy } from 'lucide-react';
import { CategoryDef } from '../types/game';

interface TopBarProps {
  coins: number;
  categories: CategoryDef[];
  completedCategoryIds: string[];
  levelNumber: number;
  modeName: string;
  streak: number;
  onOpenMenu: () => void;
  onOpenFieldGuide: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  coins,
  categories,
  completedCategoryIds,
  levelNumber,
  modeName,
  streak,
  onOpenMenu,
  onOpenFieldGuide,
}) => {
  return (
    <header className="w-full flex items-center justify-between gap-2 px-1 pt-1 pb-1.5 select-none">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu and game modes"
          className="w-9 h-9 rounded-xl bg-black/20 hover:bg-black/30 active:scale-95 transition flex items-center justify-center text-white/95 border border-white/10 shadow-sm cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          className="flex items-center gap-1.5 bg-[#084d21]/85 border border-white/15 rounded-full pl-1.5 pr-3 py-1 shadow-inner"
          title="Coins earned from winning boards"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 flex items-center justify-center shadow border border-yellow-100">
            <Coins className="w-3.5 h-3.5 text-amber-950" strokeWidth={2.6} />
          </div>
          <span className="text-white font-black text-sm tracking-tight tabular-nums">
            {coins}
          </span>
        </div>
      </div>

      {/* Progress squares matching the video/screenshots */}
      <div className="flex items-center gap-1" title={`${completedCategoryIds.length} / ${categories.length} Categories Solved`}>
        {categories.map((cat, idx) => {
          const solved = completedCategoryIds.includes(cat.id);
          return (
            <div
              key={cat.id}
              title={solved ? `Solved: ${cat.title}` : `Category ${idx + 1} (Unsolved)`}
              className={`w-[21px] h-[23px] rounded-[5px] flex items-center justify-center transition-all duration-300 ${
                solved
                  ? 'bg-gradient-to-b from-[#4bb5ff] to-[#1e88e5] border-2 border-white shadow-[0_2px_6px_rgba(30,136,229,0.5)] scale-105'
                  : 'bg-[#084e22]/85 border border-white/15 shadow-inner'
              }`}
            >
              {solved && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
            </div>
          );
        })}
      </div>

      {/* Mode / Level + Field Guide button */}
      <button
        type="button"
        onClick={onOpenFieldGuide}
        title="Football Field Guide & Live API Explorer"
        className="flex items-center gap-1.5 bg-gradient-to-b from-amber-300 to-amber-500 hover:brightness-105 active:scale-95 transition text-amber-950 rounded-xl px-2.5 py-1 shadow border border-yellow-100 cursor-pointer"
      >
        <Trophy className="w-3.5 h-3.5 shrink-0" strokeWidth={2.6} />
        <div className="flex flex-col items-start leading-none">
          <span className="text-[9px] font-black uppercase tracking-wider opacity-80">
            {modeName.split(' ')[0]}
          </span>
          <span className="text-[11px] font-black tabular-nums">
            #{levelNumber} {streak > 0 ? `• 🔥${streak}` : ''}
          </span>
        </div>
      </button>
    </header>
  );
};
