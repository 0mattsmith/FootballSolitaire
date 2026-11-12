import React from 'react';
import { resolveLocalAsset } from '../engine/footballApi';
import { CardVisual } from '../types/game';

interface FlagSvgProps {
  code: string;
  compact?: boolean;
}

export const FlagGraphic: React.FC<FlagSvgProps> = ({ code, compact = false }) => {
  const w = compact ? 20 : 54;
  const h = compact ? 14 : 36;

  const renderInner = () => {
    switch (code) {
      case 'BR':
        return (
          <>
            <rect width="60" height="40" fill="#009c3b" />
            <polygon points="30,5 54,20 30,35 6,20" fill="#ffdf00" />
            <circle cx="30" cy="20" r="8.5" fill="#002776" />
            <path d="M22,19 Q30,16 38,21" stroke="#ffffff" strokeWidth="1.6" fill="none" />
          </>
        );
      case 'AR':
        return (
          <>
            <rect width="60" height="40" fill="#74acdf" />
            <rect y="13.3" width="60" height="13.4" fill="#ffffff" />
            <circle cx="30" cy="20" r="4.2" fill="#f6b40e" />
          </>
        );
      case 'FR':
        return (
          <>
            <rect width="20" height="40" fill="#0055a4" />
            <rect x="20" width="20" height="40" fill="#ffffff" />
            <rect x="40" width="20" height="40" fill="#ef4135" />
          </>
        );
      case 'ENG':
        return (
          <>
            <rect width="60" height="40" fill="#ffffff" />
            <rect x="25.5" width="9" height="40" fill="#ce1124" />
            <rect y="15.5" width="60" height="9" fill="#ce1124" />
          </>
        );
      case 'ES':
        return (
          <>
            <rect width="60" height="40" fill="#aa151b" />
            <rect y="10" width="60" height="20" fill="#f1bf00" />
            <rect x="13" y="14.5" width="6.5" height="9" rx="2" fill="#aa151b" />
          </>
        );
      case 'HR':
        return (
          <>
            <rect width="60" height="13.3" fill="#ff0000" />
            <rect y="13.3" width="60" height="13.4" fill="#ffffff" />
            <rect y="26.7" width="60" height="13.3" fill="#171796" />
            <rect x="24" y="12" width="12" height="14" rx="2" fill="#ff0000" stroke="#ffffff" strokeWidth="1" />
            <rect x="28" y="12" width="4" height="4" fill="#ffffff" />
            <rect x="24" y="16" width="4" height="4" fill="#ffffff" />
            <rect x="32" y="16" width="4" height="4" fill="#ffffff" />
            <rect x="28" y="20" width="4" height="4" fill="#ffffff" />
          </>
        );
      case 'JP':
        return (
          <>
            <rect width="60" height="40" fill="#ffffff" />
            <circle cx="30" cy="20" r="10.5" fill="#bc002d" />
          </>
        );
      case 'MA':
        return (
          <>
            <rect width="60" height="40" fill="#c1272d" />
            <polygon
              points="30,11 32.6,18.2 40,18.2 34,22.5 36.4,29.5 30,25.2 23.6,29.5 26,22.5 20,18.2 27.4,18.2"
              fill="none"
              stroke="#006233"
              strokeWidth="2.2"
            />
          </>
        );
      // Historic flags
      case 'DE_WEST':
        return (
          <>
            <rect width="60" height="13.3" fill="#111111" />
            <rect y="13.3" width="60" height="13.4" fill="#dd0000" />
            <rect y="26.7" width="60" height="13.3" fill="#ffce00" />
            <circle cx="30" cy="20" r="4.5" fill="#ffce00" stroke="#111111" strokeWidth="1" />
          </>
        );
      case 'SU':
        return (
          <>
            <rect width="60" height="40" fill="#cc0000" />
            <polygon points="14,7 15.4,11 19.6,11 16.2,13.4 17.5,17.4 14,15 10.5,17.4 11.8,13.4 8.4,11 12.6,11" fill="#ffd700" />
          </>
        );
      case 'YU':
        return (
          <>
            <rect width="60" height="13.3" fill="#003893" />
            <rect y="13.3" width="60" height="13.4" fill="#ffffff" />
            <rect y="26.7" width="60" height="13.3" fill="#de0000" />
            <polygon
              points="30,12 32.3,18 38.5,18 33.5,21.8 35.4,27.8 30,24.2 24.6,27.8 26.5,21.8 21.5,18 27.7,18"
              fill="#de0000"
              stroke="#ffd700"
              strokeWidth="1.2"
            />
          </>
        );
      case 'CS':
        return (
          <>
            <rect width="60" height="20" fill="#ffffff" />
            <rect y="20" width="60" height="20" fill="#d7141a" />
            <polygon points="0,0 28,20 0,40" fill="#11457e" />
          </>
        );
      case 'DDR':
        return (
          <>
            <rect width="60" height="13.3" fill="#111111" />
            <rect y="13.3" width="60" height="13.4" fill="#dd0000" />
            <rect y="26.7" width="60" height="13.3" fill="#ffce00" />
            <circle cx="30" cy="20" r="6" fill="#dd0000" stroke="#ffce00" strokeWidth="2" />
          </>
        );
      case 'ZR':
        return (
          <>
            <rect width="60" height="40" fill="#009543" />
            <circle cx="30" cy="20" r="10.5" fill="#f7d117" />
            <path d="M29,27 L31,15 L34,13 L30,11 L27,14 Z" fill="#ce1021" />
          </>
        );
      default:
        return <rect width="60" height="40" fill="#94a3b8" />;
    }
  };

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 60 40"
      className="rounded-[5px] shadow-sm border border-black/15 shrink-0"
    >
      {renderInner()}
    </svg>
  );
};

export const PlayerSilhouetteSvg: React.FC<{ className?: string; color?: string }> = ({
  className = 'w-8 h-8',
  color = '#1e293b',
}) => (
  <svg viewBox="0 0 64 64" className={className} fill="none">
    {/* Dynamic footballer kicking/dribbling silhouette */}
    <circle cx="35" cy="12" r="6.5" fill={color} />
    <path
      d="M27 21c2-2 6-2.5 9-1.5l9 4.5c2 1 2.5 3.2 1.2 4.8-1 1.3-2.8 1.5-4.4.7l-4.5-2.3-2 9.5 8.5 7.2c1.5 1.3 1.8 3.5.7 5-1.2 1.6-3.5 1.8-5 .5l-8.2-6.8-5.8 12.2c-.9 1.8-3.1 2.5-4.9 1.6-1.8-.9-2.5-3.1-1.6-4.9l6.2-13.2 2.4-10.2-5.6 2.8c-1.7.8-3.7.1-4.5-1.6-.8-1.7-.1-3.7 1.6-4.5l7.9-4z"
      fill={color}
    />
    <circle cx="49" cy="52" r="5" fill={color} opacity="0.9" />
    <path d="M46.5 50.5l2.5-1.5 2.5 1.5-1 3h-3z" fill="#ffffff" opacity="0.85" />
  </svg>
);

interface CardArtworkProps {
  visual: CardVisual;
  label: string;
  compact?: boolean;
  isCategory?: boolean;
}

export const CardArtwork: React.FC<CardArtworkProps> = ({
  visual,
  label,
  compact = false,
  isCategory = false,
}) => {
  const needsDarkEmblemBg =
    visual.assetId === 'league_eredivisie' || visual.assetId === 'league_scottish_prem';

  if (compact) {
    // Small 18px-20px miniature icon for stacked card strip or fanned waste edge
    if (visual.type === 'flag_modern' || visual.type === 'flag_historic') {
      return <FlagGraphic code={visual.flagCode ?? ''} compact />;
    }
    if (visual.type === 'player_silhouette' || visual.type === 'league_with_silhouette' || visual.type === 'cup_with_silhouette') {
      return <PlayerSilhouetteSvg className="w-4 h-4 shrink-0" color="#334155" />;
    }
    const prefer = visual.type === 'cup_trophy' ? 'trophy' : visual.type === 'stadium' || visual.type === 'player_cutout' ? 'image' : 'badge';
    const { src } = resolveLocalAsset(visual.assetId, prefer);
    if (src) {
      return (
        <img
          src={src}
          alt={label}
          className={`w-4 h-4 object-contain rounded-[3px] shrink-0 ${
            needsDarkEmblemBg ? 'bg-slate-900 p-[1px]' : ''
          }`}
          draggable={false}
        />
      );
    }
    return null;
  }

  // Full card artwork
  switch (visual.type) {
    case 'club_badge':
    case 'league_badge': {
      const { src } = resolveLocalAsset(visual.assetId, 'badge');
      if (!src) return null;
      return (
        <div className="flex items-center justify-center w-full h-[54px] pointer-events-none">
          {needsDarkEmblemBg ? (
            <div className="w-[50px] h-[50px] rounded-xl bg-gradient-to-br from-[#0f172a] to-[#1e3a8a] p-1.5 flex items-center justify-center shadow-sm border border-slate-200">
              <img
                src={src}
                alt={label}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            </div>
          ) : (
            <img
              src={src}
              alt={label}
              className="max-w-[56px] max-h-[52px] object-contain drop-shadow-[0_2px_4px_rgba(15,23,42,0.16)]"
              draggable={false}
            />
          )}
        </div>
      );
    }

    case 'cup_trophy': {
      const { src } = resolveLocalAsset(visual.assetId, 'trophy');
      if (!src) return null;
      return (
        <div className="flex items-center justify-center w-full h-[56px] pointer-events-none">
          <img
            src={src}
            alt={label}
            className="max-w-[58px] max-h-[54px] object-contain drop-shadow-[0_3px_6px_rgba(180,83,9,0.24)]"
            draggable={false}
          />
        </div>
      );
    }

    case 'stadium': {
      const { src } = resolveLocalAsset(visual.assetId, 'image');
      if (!src) return null;
      return (
        <div className="w-full px-1 pointer-events-none">
          <div className="relative w-full h-[54px] rounded-[9px] overflow-hidden border-2 border-[#ebe2cf] shadow-sm bg-[#e7f0e6]">
            <img
              src={src}
              alt={label}
              className="w-full h-full object-cover saturate-[1.1] contrast-[1.03]"
              draggable={false}
            />
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-t from-emerald-900/25 to-transparent" />
          </div>
        </div>
      );
    }

    case 'player_cutout': {
      const { src, isCutout } = resolveLocalAsset(visual.assetId, 'image');
      return (
        <div className="relative flex items-center justify-center w-full h-[56px] pointer-events-none">
          {src ? (
            isCutout ? (
              <img
                src={src}
                alt={label}
                className="max-w-[58px] max-h-[56px] object-contain drop-shadow-[0_3px_5px_rgba(15,23,42,0.22)]"
                draggable={false}
              />
            ) : (
              <div className="w-[50px] h-[50px] rounded-full overflow-hidden border-[2.5px] border-amber-400 shadow-sm bg-amber-50">
                <img
                  src={src}
                  alt={label}
                  className="w-full h-full object-cover object-top saturate-[1.05]"
                  draggable={false}
                />
              </div>
            )
          ) : (
            <PlayerSilhouetteSvg className="w-11 h-11" color="#334155" />
          )}
          {isCategory && (
            <span className="absolute -bottom-0.5 right-1 px-1.5 py-[1px] rounded-full bg-amber-400 text-[#451a03] text-[7.5px] font-black uppercase tracking-wider shadow-sm border border-white">
              Clubs
            </span>
          )}
        </div>
      );
    }

    case 'league_with_silhouette':
    case 'cup_with_silhouette': {
      const prefer = visual.type === 'cup_with_silhouette' ? 'trophy' : 'badge';
      const { src } = resolveLocalAsset(visual.assetId, prefer);
      return (
        <div className="relative flex items-center justify-center w-full h-[56px] pointer-events-none">
          <div className="flex items-center justify-center gap-0.5">
            {src && (
              <img
                src={src}
                alt={label}
                className="w-[34px] h-[34px] object-contain drop-shadow-sm"
                draggable={false}
              />
            )}
            <div className="-ml-1.5 flex items-center justify-center w-[36px] h-[36px] rounded-full bg-amber-100/90 border border-amber-300 shadow-sm">
              <PlayerSilhouetteSvg className="w-7 h-7" color="#1e293b" />
            </div>
          </div>
          <span className="absolute -bottom-0.5 right-1 px-1.5 py-[1px] rounded-full bg-indigo-600 text-white text-[7.5px] font-black uppercase tracking-wider shadow-sm border border-white">
            Players
          </span>
        </div>
      );
    }

    case 'player_silhouette': {
      return (
        <div className="relative flex items-center justify-center w-full h-[54px] pointer-events-none">
          <div className="w-[48px] h-[48px] rounded-full bg-amber-100/85 border-2 border-amber-300 flex items-center justify-center shadow-inner">
            <PlayerSilhouetteSvg className="w-9 h-9" color="#1e293b" />
          </div>
          {visual.subtitle && (
            <span className="absolute -bottom-0.5 px-1.5 py-[1px] rounded-full bg-amber-500 text-white text-[7.5px] font-black uppercase tracking-wider shadow-sm border border-white">
              {visual.subtitle}
            </span>
          )}
        </div>
      );
    }

    case 'flag_modern':
    case 'flag_historic': {
      return (
        <div className="relative flex items-center justify-center w-full h-[48px] pointer-events-none">
          <FlagGraphic code={visual.flagCode ?? ''} />
          {visual.type === 'flag_historic' && isCategory && (
            <span className="absolute -bottom-1 right-1 px-1.5 py-[1px] rounded-full bg-amber-700 text-amber-50 text-[7px] font-black uppercase tracking-wider shadow-sm border border-white">
              Retro
            </span>
          )}
        </div>
      );
    }

    case 'text':
    default: {
      if (isCategory && visual.subtitle) {
        return (
          <div className="flex items-center justify-center w-full h-[38px] pointer-events-none">
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: visual.accentColor || '#0f766e' }}
            >
              {visual.subtitle}
            </span>
          </div>
        );
      }
      return null;
    }
  }
};
