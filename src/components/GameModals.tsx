import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Coins,
  Download,
  ExternalLink,
  Flame,
  Infinity as InfinityIcon,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { FOOTBALL_CATEGORIES } from '../data/footballCatalog';
import { GAME_MODES, JOURNEY_LEVELS } from '../data/levels';
import {
  DownloadProgressEvent,
  InstallProgressEvent,
  InstalledVersionInfo,
  RemoteReleaseInfo,
} from '../engine/appUpdater';
import {
  fetchLiveWikiSummary,
  getManifestStats,
  searchLiveSportsDbTeam,
} from '../engine/footballApi';
import { DeckTheme, LevelConfig, ModeId, PlayerProgress } from '../types/game';
import { CardArtwork } from './CardArtwork';

export type UpdateUiPhase =
  | 'idle'
  | 'checking'
  | 'up_to_date'
  | 'available'
  | 'downloading'
  | 'ready_to_install'
  | 'needs_permission'
  | 'error';

interface MenuModalProps {
  open: boolean;
  currentLevel: LevelConfig;
  progress: PlayerProgress;
  installedInfo: InstalledVersionInfo | null;
  updatePhase: UpdateUiPhase;
  remoteRelease: RemoteReleaseInfo | null;
  downloadProgress: DownloadProgressEvent | null;
  updateError: string | null;
  onCheckUpdate: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
  onClose: () => void;
  onSelectMode: (modeId: ModeId, round?: number) => void;
  onRestartLevel: () => void;
  onToggleCosyMoves: () => void;
  onToggleSound: () => void;
  onChangeDeckTheme: (theme: DeckTheme) => void;
  onOpenCareerPath: () => void;
}

export const MenuModal: React.FC<MenuModalProps> = ({
  open,
  currentLevel,
  progress,
  installedInfo,
  updatePhase,
  remoteRelease,
  downloadProgress,
  updateError,
  onCheckUpdate,
  onDownloadUpdate,
  onInstallUpdate,
  onClose,
  onSelectMode,
  onRestartLevel,
  onToggleCosyMoves,
  onToggleSound,
  onChangeDeckTheme,
  onOpenCareerPath,
}) => {
  if (!open) return null;

  const currVersion = installedInfo?.versionName ?? '1.0.0';

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] max-h-[88dvh] bg-[#fffdf7] rounded-3xl shadow-2xl border-4 border-[#15803d] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#13883f] to-[#0f6e33] px-5 py-3.5 flex items-center justify-between text-white">
          <div>
            <h2 className="text-lg font-black tracking-tight">Settings & Modes</h2>
            <p className="text-xs text-emerald-100 font-bold">
              Choose Mode, Journey Level, Updates & Preferences
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Quick Restart & Settings */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                onRestartLevel();
                onClose();
              }}
              className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-extrabold text-xs cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-emerald-700" />
              Restart Deal
            </button>
            <button
              type="button"
              onClick={onToggleCosyMoves}
              className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl border font-extrabold text-xs cursor-pointer ${
                progress.cosyUnlimitedMoves
                  ? 'bg-amber-100 border-amber-400 text-amber-950'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <InfinityIcon className="w-4 h-4" />
              {progress.cosyUnlimitedMoves ? 'Cosy: ∞ On' : 'Cosy: ∞ Off'}
            </button>
            <button
              type="button"
              onClick={onToggleSound}
              className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-extrabold text-xs cursor-pointer"
            >
              {progress.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-700" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              {progress.soundEnabled ? 'Sound: On' : 'Sound: Off'}
            </button>
          </div>

          {/* Career Path Challenge Wikipedia Mini-Game */}
          <button
            type="button"
            onClick={onOpenCareerPath}
            className="w-full text-left rounded-2xl bg-[#18152e] hover:bg-[#221d42] border-2 border-[#393368] p-3 text-white shadow-md transition flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-xl bg-[#f8f9fa] border-2 border-[#b0c4de] text-[#202122] flex flex-col items-center justify-center shrink-0 shadow-xs">
              <span className="font-serif font-black text-base leading-none">W</span>
              <span className="text-[7px] font-black uppercase tracking-tighter text-slate-600 mt-0.5">
                Career
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-white">
                  Career Path Challenge
                </span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-[#ceff27] text-slate-950">
                  Mini-Game
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-semibold mt-0.5 leading-snug">
                Guess the footballer club-by-club from their Wikipedia infobox
              </p>
            </div>
            <span className="px-2.5 py-1.5 rounded-xl bg-[#3b82f6] group-hover:bg-[#2563eb] text-white text-xs font-black shrink-0">
              Play →
            </span>
          </button>

          {/* App Updates Section (Android In-App OTA + Web Release Link) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900">
                    App Version v{currVersion}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500">
                    {installedInfo?.isAndroidNative ? 'Android APK' : 'Web App'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onCheckUpdate}
                disabled={updatePhase === 'checking' || updatePhase === 'downloading'}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-slate-300 text-xs font-black text-slate-800 shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {updatePhase === 'checking' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    Checking...
                  </>
                ) : (
                  'Check Update'
                )}
              </button>
            </div>

            {updatePhase === 'up_to_date' && (
              <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                You are on the latest version (v{currVersion}).
              </div>
            )}

            {updateError && (
              <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {updateError}
              </div>
            )}

            {updatePhase === 'needs_permission' && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 space-y-2">
                <p className="text-xs font-bold text-amber-950">
                  Allow &ldquo;Install unknown apps&rdquo; for Football Solitaire in Android
                  Settings, then tap Update Now.
                </p>
                <button
                  type="button"
                  onClick={onInstallUpdate}
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs cursor-pointer"
                >
                  Update Now
                </button>
              </div>
            )}

            {(updatePhase === 'available' ||
              updatePhase === 'downloading' ||
              updatePhase === 'ready_to_install') &&
              remoteRelease && (
                <div className="bg-white border border-amber-300 rounded-xl p-3 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      Update Available: v{remoteRelease.latestVersion}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 whitespace-pre-line">
                    {remoteRelease.releaseNotes}
                  </p>

                  {updatePhase === 'downloading' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-black text-emerald-800">
                        <span>Downloading in background...</span>
                        <span>{downloadProgress?.progress ?? 0}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-150"
                          style={{ width: `${downloadProgress?.progress ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {updatePhase === 'available' && (
                    <div className="flex gap-2">
                      {installedInfo?.isAndroidNative && remoteRelease.apkUrl ? (
                        <button
                          type="button"
                          onClick={onDownloadUpdate}
                          className="flex-1 py-2 rounded-xl bg-gradient-to-b from-[#2fd46d] to-[#16a34a] text-white font-black text-xs shadow cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Update
                        </button>
                      ) : (
                        <>
                          {remoteRelease.apkUrl && (
                            <a
                              href={remoteRelease.apkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-2 rounded-xl bg-gradient-to-b from-[#2fd46d] to-[#16a34a] text-white font-black text-xs shadow flex items-center justify-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download APK
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="flex-1 py-2 rounded-xl bg-sky-600 text-white font-black text-xs cursor-pointer"
                          >
                            Refresh Web
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {updatePhase === 'ready_to_install' && (
                    <button
                      type="button"
                      onClick={onInstallUpdate}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 font-black text-xs shadow border-b-2 border-amber-700 cursor-pointer"
                    >
                      Update & Install v{remoteRelease.latestVersion}
                    </button>
                  )}
                </div>
              )}
          </div>

          {/* Card Back Theme */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Card Back Theme
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'blue', label: 'Classic Blue', swatch: 'bg-[#2589f2]' },
                  { id: 'orange', label: 'Sunset Gold', swatch: 'bg-[#f5821f]' },
                  { id: 'emerald', label: 'Pitch Green', swatch: 'bg-[#10b981]' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeDeckTheme(t.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-extrabold cursor-pointer ${
                    progress.deckTheme === t.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded ${t.swatch} border border-black/15`} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Game Modes */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Game Modes
            </h3>
            <div className="space-y-2">
              {GAME_MODES.map((m) => {
                const active = currentLevel.modeId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelectMode(m.id, 1);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition flex items-center gap-3 cursor-pointer ${
                      active
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-2xl">{m.badgeIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                        {m.name}
                        {active && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            Playing
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-semibold truncate">{m.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Journey Levels 1..10 */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Classic Journey Levels
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {JOURNEY_LEVELS.map((lvl) => {
                const done = progress.completedLevelIds.includes(lvl.id);
                const isCurr = currentLevel.id === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => {
                      onSelectMode('journey', lvl.levelNumber);
                      onClose();
                    }}
                    title={`${lvl.title}: ${lvl.subtitle}`}
                    className={`relative p-2 rounded-xl border text-center cursor-pointer transition ${
                      isCurr
                        ? 'bg-amber-400 border-amber-600 text-amber-950 shadow-md scale-105'
                        : done
                        ? 'bg-sky-50 border-sky-300 text-sky-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-black">{lvl.levelNumber}</div>
                    <div className="text-[9px] font-bold truncate">
                      {lvl.hasLocks ? '🔒' : lvl.maxMoves === null ? '∞' : `${lvl.categories.length}C`}
                    </div>
                    {done && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 fill-white absolute -top-1 -right-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface OutcomeModalProps {
  status: 'playing' | 'won' | 'lost';
  level: LevelConfig;
  movesUsed: number;
  movesLeft: number | null;
  mistakes: number;
  coins: number;
  onNextBoard: () => void;
  onRestart: () => void;
  onBuyMoves: () => void;
  onUndo: () => void;
}

export const OutcomeModal: React.FC<OutcomeModalProps> = ({
  status,
  level,
  movesUsed,
  movesLeft,
  mistakes,
  coins,
  onNextBoard,
  onRestart,
  onBuyMoves,
  onUndo,
}) => {
  if (status === 'playing') return null;

  const isWon = status === 'won';
  const bonusCoins = isWon && movesLeft ? Math.min(40, Math.floor(movesLeft / 2)) : 0;
  const totalReward = level.coinReward + bonusCoins;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] bg-[#fffdf7] rounded-3xl shadow-2xl border-4 border-amber-400 p-6 text-center space-y-4 animate-pop-in">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 flex items-center justify-center shadow-lg border-2 border-yellow-100">
          {isWon ? (
            <Trophy className="w-9 h-9 text-amber-950" />
          ) : (
            <Flame className="w-9 h-9 text-rose-800" />
          )}
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-900">
            {isWon ? 'Full Time! You Won!' : 'Out of Moves!'}
          </h2>
          <p className="text-sm font-bold text-slate-500 mt-0.5">{level.title}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3">
          <div>
            <div className="text-[10px] font-black uppercase text-emerald-700">Moves Used</div>
            <div className="text-lg font-black text-slate-900">{movesUsed}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-emerald-700">Mistakes</div>
            <div className="text-lg font-black text-slate-900">{mistakes}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-emerald-700">
              {isWon ? 'Earned' : 'Coins'}
            </div>
            <div className="text-lg font-black text-amber-600 flex items-center justify-center gap-1">
              <Coins className="w-4 h-4" />
              {isWon ? `+${totalReward}` : coins}
            </div>
          </div>
        </div>

        {isWon ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onNextBoard}
              className="w-full py-3 rounded-2xl bg-gradient-to-b from-[#2fd46d] to-[#16a34a] text-white font-black text-base shadow-lg border-b-4 border-emerald-800 active:translate-y-0.5 cursor-pointer"
            >
              Next Match →
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm cursor-pointer"
            >
              Replay Board
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onBuyMoves}
              disabled={coins < 100}
              className={`w-full py-3 rounded-2xl font-black text-base shadow-lg border-b-4 cursor-pointer ${
                coins >= 100
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 border-amber-700'
                  : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
              }`}
            >
              +10 Extra Moves (100 Coins)
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onUndo}
                className="py-2.5 rounded-2xl bg-sky-100 hover:bg-sky-200 text-sky-900 font-extrabold text-sm cursor-pointer"
              >
                Undo Last
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm cursor-pointer"
              >
                Restart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface FieldGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const FieldGuideModal: React.FC<FieldGuideModalProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveResult, setLiveResult] = useState<{
    title: string;
    summary: string;
    image?: string;
    source: string;
    url?: string;
  } | null>(null);

  if (!open) return null;

  const stats = getManifestStats();

  const handleLiveLookup = async (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setLiveLoading(true);
    setLiveResult(null);
    const [teamRes, wikiRes] = await Promise.all([
      searchLiveSportsDbTeam(clean),
      fetchLiveWikiSummary(clean),
    ]);
    setLiveLoading(false);

    if (teamRes && teamRes.description) {
      setLiveResult({
        title: `${teamRes.name}${teamRes.formedYear ? ` (${teamRes.formedYear})` : ''}`,
        summary: teamRes.description.slice(0, 320) + '...',
        image: teamRes.badge,
        source: `TheSportsDB API • ${teamRes.league || 'Football'}${teamRes.stadium ? ` • ${teamRes.stadium}` : ''}`,
      });
    } else if (wikiRes) {
      setLiveResult({
        title: wikiRes.title,
        summary: wikiRes.extract,
        image: wikiRes.thumbnail,
        source: 'Wikipedia REST API',
        url: wikiRes.url,
      });
    } else {
      setLiveResult({
        title: clean,
        summary: 'No live API entry matched right now — try a club, stadium, cup, or player name!',
        source: 'Live API',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-[460px] max-h-[88dvh] bg-[#fffdf7] rounded-3xl shadow-2xl border-4 border-amber-400 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#13883f] to-[#0c692f] px-5 py-3.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="text-base font-black leading-tight">Football Field Guide & APIs</h2>
              <p className="text-[11px] text-emerald-100 font-bold">
                {stats.withImages} verified badges, trophies, stadiums & cutouts cached
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Live API Lookup Box */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Live Football Lookup (TheSportsDB + Wikipedia REST API)
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLiveLookup(query);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search e.g. Arsenal, Old Trafford, Cruyff..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-1 cursor-pointer hover:bg-emerald-700"
              >
                <Search className="w-3.5 h-3.5" />
                Go
              </button>
            </form>

            {liveLoading && (
              <div className="text-xs font-bold text-emerald-700 py-1">Fetching live API data...</div>
            )}
            {liveResult && (
              <div className="bg-white rounded-xl p-2.5 border border-emerald-200 flex gap-3 items-start">
                {liveResult.image && (
                  <img
                    src={liveResult.image}
                    alt={liveResult.title}
                    className="w-12 h-12 object-contain rounded-lg bg-slate-50 border border-slate-100 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-slate-900">{liveResult.title}</div>
                  <div className="text-[10px] font-bold text-emerald-700 mb-1">
                    {liveResult.source}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">{liveResult.summary}</p>
                  {liveResult.url && (
                    <a
                      href={liveResult.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-black text-sky-600 mt-1 hover:underline"
                    >
                      Read more <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* All Football Categories Preview */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              All {FOOTBALL_CATEGORIES.length} Football Categories
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {FOOTBALL_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-white rounded-2xl border border-slate-200 p-2.5 flex items-center gap-3 shadow-xs"
                >
                  <div className="w-14 h-14 rounded-xl bg-[#fffdf8] border border-amber-300 flex items-center justify-center shrink-0 overflow-hidden p-1">
                    <CardArtwork visual={cat.visual} label={cat.title} isCategory />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900">{cat.title}</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        {cat.items.length} cards
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{cat.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const InstallProgressModal: React.FC<{
  open: boolean;
  progress: InstallProgressEvent | null;
  version: string;
}> = ({ open, progress, version }) => {
  if (!open) return null;
  const pct = progress?.progress ?? 12;
  const stageLabel =
    progress?.stage === 'writing'
      ? 'Unpacking & verifying APK...'
      : progress?.stage === 'committing' || progress?.stage === 'installing'
      ? 'Installing update & restarting app...'
      : progress?.stage === 'complete'
      ? 'Update complete! Relaunching...'
      : 'Preparing installer...';

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="w-full max-w-[350px] bg-[#fffdf7] rounded-3xl border-4 border-amber-400 shadow-2xl p-6 text-center space-y-4 animate-pop-in">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
          <Download className="w-7 h-7 animate-bounce" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900">Updating to v{version}</h3>
          <p className="text-xs font-bold text-slate-500 mt-1">{stageLabel}</p>
        </div>
        <div className="space-y-1.5">
          <div className="w-full h-3.5 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
            <div
              className="h-full bg-gradient-to-r from-[#2fd46d] via-emerald-500 to-amber-400 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs font-black text-emerald-800 tabular-nums">{pct}%</div>
        </div>
      </div>
    </div>
  );
};

export const UpdatedBannerModal: React.FC<{
  open: boolean;
  version: string;
  notes: string;
  onClose: () => void;
}> = ({ open, version, notes, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-5">
      <div className="w-full max-w-[370px] bg-[#fffdf7] rounded-3xl border-4 border-[#22c55e] shadow-2xl p-6 text-center space-y-4 animate-pop-in">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 flex items-center justify-center shadow-lg border-2 border-yellow-100">
          <Sparkles className="w-8 h-8" />
        </div>
        <div>
          <span className="inline-block px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
            App Updated
          </span>
          <h3 className="text-xl font-black text-slate-900 mt-1.5">
            Now on v{version}
          </h3>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-left">
          <div className="text-[10px] font-black uppercase text-emerald-700 mb-1">
            What&apos;s New
          </div>
          <p className="text-xs font-bold text-slate-700 whitespace-pre-line leading-relaxed">
            {notes || 'Updated with the latest improvements!'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-gradient-to-b from-[#2fd46d] to-[#16a34a] text-white font-black text-sm shadow-lg border-b-4 border-emerald-800 cursor-pointer"
        >
          Let&apos;s Play!
        </button>
      </div>
    </div>
  );
};
