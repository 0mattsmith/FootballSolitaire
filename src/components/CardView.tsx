import React from 'react';
import { Crown, KeyRound } from 'lucide-react';
import { DeckTheme, GameCard, LockColor } from '../types/game';
import { CardArtwork } from './CardArtwork';

const LOCK_PALETTES: Record<
  LockColor,
  { border: string; body: string; shackle: string; plateBg: string; text: string }
> = {
  red: {
    border: '#dc2626',
    body: '#ef4444',
    shackle: '#94a3b8',
    plateBg: '#b8cbe0',
    text: '#991b1b',
  },
  orange: {
    border: '#ea580c',
    body: '#f97316',
    shackle: '#94a3b8',
    plateBg: '#c3d0df',
    text: '#9a3412',
  },
  purple: {
    border: '#9333ea',
    body: '#a855f7',
    shackle: '#94a3b8',
    plateBg: '#c9c4e0',
    text: '#6b21a8',
  },
  blue: {
    border: '#2563eb',
    body: '#3b82f6',
    shackle: '#94a3b8',
    plateBg: '#bfd2ea',
    text: '#1e40af',
  },
};

export const CardBack: React.FC<{
  theme: DeckTheme;
  keyHintColor?: LockColor;
  className?: string;
}> = ({ theme, keyHintColor, className = '' }) => {
  const themeClass =
    theme === 'orange'
      ? 'card-back-orange'
      : theme === 'emerald'
      ? 'card-back-emerald'
      : 'card-back-blue';

  return (
    <div
      className={`relative w-full h-full rounded-[11px] bg-white p-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.22)] border border-black/10 select-none ${className}`}
    >
      <div className={`w-full h-full rounded-[8px] ${themeClass} relative overflow-hidden`}>
        {keyHintColor && (
          <div className="absolute top-[1px] left-1/2 -translate-x-1/2 flex items-center justify-center bg-white rounded-full px-1 py-[1px] shadow-sm border border-black/15">
            <KeyRound
              className="w-2.5 h-2.5"
              style={{ color: LOCK_PALETTES[keyHintColor].body }}
              strokeWidth={2.8}
            />
          </div>
        )}
      </div>
    </div>
  );
};

interface CardViewProps {
  card: GameCard;
  deckTheme: DeckTheme;
  isSelected?: boolean;
  isHinted?: boolean;
  isShaking?: boolean;
  isDragging?: boolean;
  isCoveredStrip?: boolean;
  countBadgeOverride?: string;
  hideFooterText?: boolean;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  deckTheme,
  isSelected = false,
  isHinted = false,
  isShaking = false,
  isDragging = false,
  isCoveredStrip = false,
  countBadgeOverride,
  hideFooterText = false,
}) => {
  if (!card.faceUp) {
    return (
      <CardBack
        theme={deckTheme}
        keyHintColor={card.kind === 'key' ? card.lockColor : undefined}
      />
    );
  }

  // Padlock Blocker Card (Image 1 style!)
  if (card.kind === 'lock') {
    const pal = LOCK_PALETTES[card.lockColor ?? 'red'];
    return (
      <div
        className={`relative w-full h-full rounded-[11px] p-[3px] shadow-[0_3px_10px_rgba(0,0,0,0.28)] select-none transition-transform ${
          isHinted ? 'ring-3 ring-yellow-300 animate-pulse' : ''
        } ${isShaking ? 'animate-card-shake' : ''}`}
        style={{ backgroundColor: pal.border }}
      >
        <div
          className="relative w-full h-full rounded-[8px] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: `linear-gradient(165deg, ${pal.plateBg} 0%, #8ea4bf 100%)`,
          }}
        >
          {/* Metallic corner rivets */}
          <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/60 shadow-inner" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/60 shadow-inner" />
          <span className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/60 shadow-inner" />
          <span className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/60 shadow-inner" />

          {/* Chunky SVG Padlock with 0/1 inside */}
          <svg viewBox="0 0 80 86" className="w-[62px] h-[68px] drop-shadow-md">
            <path
              d="M22 36 V24 C22 12 58 12 58 24 V36"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path
              d="M22 36 V24 C22 12 58 12 58 24 V36"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <rect
              x="12"
              y="34"
              width="56"
              height="44"
              rx="10"
              fill={pal.body}
              stroke="#ffffff"
              strokeWidth="2"
            />
            <rect x="24" y="42" width="32" height="16" rx="6" fill="#ffffff" opacity="0.95" />
            <text
              x="40"
              y="54"
              textAnchor="middle"
              fontSize="12"
              fontWeight="900"
              fill="#1e293b"
              fontFamily="Nunito, sans-serif"
            >
              0/1
            </text>
            <circle cx="40" cy="66" r="3.5" fill="#450a0a" opacity="0.7" />
            <path d="M38.5 67 L41.5 67 L42.5 73 L37.5 73 Z" fill="#450a0a" opacity="0.7" />
          </svg>
        </div>
      </div>
    );
  }

  // Face-up Key Card
  if (card.kind === 'key') {
    const pal = LOCK_PALETTES[card.lockColor ?? 'red'];
    return (
      <div
        className={`relative w-full h-full rounded-[11px] bg-[#fffdf8] p-1.5 shadow-[0_3px_10px_rgba(0,0,0,0.22)] flex flex-col items-center justify-center select-none border-[2.5px] ${
          isSelected ? 'ring-3 ring-amber-400 -translate-y-0.5' : ''
        } ${isHinted ? 'ring-3 ring-yellow-300 shadow-[0_0_16px_rgba(253,224,71,0.85)]' : ''} ${
          isShaking ? 'animate-card-shake' : ''
        } ${isDragging ? 'scale-105 shadow-2xl' : ''}`}
        style={{ borderColor: pal.border }}
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center mb-1 shadow-inner"
          style={{ backgroundColor: `${pal.body}22` }}
        >
          <KeyRound className="w-7 h-7" style={{ color: pal.body }} strokeWidth={2.5} />
        </div>
        <span className="text-[11px] font-black leading-tight text-center" style={{ color: pal.text }}>
          {card.label}
        </span>
        <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
          Tap Lock
        </span>
      </div>
    );
  }

  // Covered strip view when stacked under another same-category card in tableau
  if (isCoveredStrip) {
    return (
      <div
        className={`relative w-full h-full rounded-[11px] bg-[#fffdf8] border border-[#ddd3c1] shadow-[0_1px_4px_rgba(0,0,0,0.14)] px-1.5 pt-[4px] flex items-start justify-center select-none ${
          isHinted ? 'ring-2 ring-yellow-300' : ''
        }`}
      >
        <div className="flex items-center justify-center gap-1 w-full overflow-hidden">
          <CardArtwork visual={card.visual} label={card.label} compact />
          <span className="text-[11px] font-extrabold text-[#3c3024] truncate leading-none pt-[1px]">
            {card.shortLabel || card.label}
          </span>
        </div>
      </div>
    );
  }

  // Category Anchor Card (0/N with Gold border + Crown)
  if (card.kind === 'category') {
    const countStr = countBadgeOverride ?? `0/${card.totalCount ?? '?'}`;
    return (
      <div
        className={`relative w-full h-full rounded-[11px] bg-[#fffdf8] border-[2.5px] border-[#f5b82e] shadow-[0_3px_10px_rgba(0,0,0,0.22)] flex flex-col justify-between p-1.5 select-none transition-transform ${
          isSelected ? 'ring-3 ring-sky-400 -translate-y-0.5' : ''
        } ${
          isHinted
            ? 'ring-4 ring-yellow-300 shadow-[0_0_18px_rgba(253,224,71,0.9)]'
            : ''
        } ${isShaking ? 'animate-card-shake' : ''} ${isDragging ? 'scale-105 shadow-2xl' : ''}`}
      >
        <div className="flex items-center justify-between w-full px-0.5">
          <Crown className="w-3.5 h-3.5 text-[#f59e0b] fill-[#fbbf24]" />
          <span className="text-[10px] font-extrabold text-[#78716c] leading-none">
            {countStr}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-1 px-0.5 my-0.5 overflow-hidden">
          <CardArtwork visual={card.visual} label={card.label} isCategory />
          {!hideFooterText && (
            <span className="text-[11.5px] font-black text-[#292118] text-center leading-[1.15] line-clamp-2">
              {card.label}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Standard Item Card (Club, Stadium, Trophy, Flag, Player, Suffix, Nickname)
  const isTextOnly = card.visual.type === 'text';

  return (
    <div
      className={`relative w-full h-full rounded-[11px] bg-[#fffdf8] border border-[#e3dac9] shadow-[0_3px_8px_rgba(0,0,0,0.2)] flex flex-col justify-between p-1.5 select-none transition-transform ${
        isSelected ? 'ring-3 ring-amber-400 -translate-y-0.5' : ''
      } ${
        isHinted
          ? 'ring-4 ring-yellow-300 shadow-[0_0_18px_rgba(253,224,71,0.9)]'
          : ''
      } ${isShaking ? 'animate-card-shake' : ''} ${isDragging ? 'scale-105 shadow-2xl' : ''}`}
    >
      {/* Subtle inner card bevel line like the screenshots */}
      <div className="w-full h-full rounded-[8px] border border-[#f2eadb] flex flex-col items-center justify-center px-1 py-1 overflow-hidden">
        {isTextOnly ? (
          <span className="text-[13.5px] font-black text-[#2c241b] text-center leading-[1.18] break-words px-0.5">
            {card.label}
          </span>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 w-full">
            <CardArtwork visual={card.visual} label={card.label} />
            <span className="text-[10.5px] font-extrabold text-[#2c241b] text-center leading-[1.12] line-clamp-2 px-0.5">
              {card.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
