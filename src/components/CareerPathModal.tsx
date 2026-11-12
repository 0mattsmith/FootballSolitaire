import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Coins,
  ExternalLink,
  HelpCircle,
  Loader2,
  Share2,
  Shuffle,
  User,
  X,
} from 'lucide-react';
import { AutocompletePlayerOption, CareerPathPlayer } from '../data/careerPathPlayers';
import {
  CareerDifficultyFilter,
  CareerPathStats,
  PlayerRevealDetails,
  fetchLiveCareerPlayerData,
  fetchPlayerRevealPhoto,
  getDailyPuzzleInfo,
  isExactOptionMatch,
  loadCareerPathStats,
  maskCareerToken,
  maskGoalsToken,
  normalizePlayerText,
  pickRandomCareerPlayer,
  recordCareerPathOutcome,
  searchPlayerOptions,
} from '../engine/careerPathApi';
import { soundFx } from '../engine/soundEffects';

interface CareerPathModalProps {
  open: boolean;
  onClose: () => void;
  onEarnCoins?: (amount: number) => void;
}

type AttemptEntry = {
  type: 'wrong' | 'skip' | 'correct';
  label: string;
};

const MAX_GUESSES = 6;

export const CareerPathModal: React.FC<CareerPathModalProps> = ({
  open,
  onClose,
  onEarnCoins,
}) => {
  const [difficulty, setDifficulty] = useState<CareerDifficultyFilter>('normal');
  const [playMode, setPlayMode] = useState<'daily' | 'random'>('daily');

  const [puzzleNumber, setPuzzleNumber] = useState<number>(1);
  const [dailyDateKey, setDailyDateKey] = useState<string>('');
  const [activePlayer, setActivePlayer] = useState<CareerPathPlayer>(() =>
    getDailyPuzzleInfo('normal').player
  );
  const [dataSource, setDataSource] = useState<'wikipedia-live' | 'verified-archive'>(
    'verified-archive'
  );
  const [infoboxImgHint, setInfoboxImgHint] = useState<string | undefined>(undefined);
  const [loadingLiveWiki, setLoadingLiveWiki] = useState(false);

  // Progression state
  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);
  const [revealedCount, setRevealedCount] = useState<number>(1);
  const [roundStatus, setRoundStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const [shakeInput, setShakeInput] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Post-round Wikipedia photo & summary reveal
  const [revealDetails, setRevealDetails] = useState<PlayerRevealDetails | null>(null);
  const [loadingRevealPhoto, setLoadingRevealPhoto] = useState(false);

  // Sub-modals & share toast
  const [stats, setStats] = useState<CareerPathStats>(() => loadCareerPathStats());
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showHelpBox, setShowHelpBox] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const startRound = (
    targetMode: 'daily' | 'random',
    targetDiff: CareerDifficultyFilter,
    excludeId?: string
  ) => {
    const daily = getDailyPuzzleInfo(targetDiff);
    const pNum = daily.puzzleNumber;
    const dKey = daily.dateKey;
    const basePlayer =
      targetMode === 'daily'
        ? daily.player
        : pickRandomCareerPlayer(targetDiff, excludeId);

    setPlayMode(targetMode);
    setDifficulty(targetDiff);
    setPuzzleNumber(pNum);
    setDailyDateKey(dKey);
    setActivePlayer(basePlayer);
    setDataSource('verified-archive');
    setInfoboxImgHint(undefined);
    setAttempts([]);
    setRevealedCount(targetDiff === 'hard' ? 0 : 1);
    setRoundStatus('playing');
    setQuery('');
    setDropdownOpen(false);
    setHighlightedIdx(0);
    setStatusFeedback(null);
    setRevealDetails(null);
    setCopiedShare(false);

    // Enrich career table live from Wikipedia Action API (graceful offline fallback)
    setLoadingLiveWiki(true);
    fetchLiveCareerPlayerData(basePlayer).then((res) => {
      setLoadingLiveWiki(false);
      // Guard against stale response if user switched puzzle mid-fetch
      setActivePlayer((curr) => (curr.id === res.player.id ? res.player : curr));
      setDataSource(res.dataSource);
      if (res.infoboxImageUrl) {
        setInfoboxImgHint(res.infoboxImageUrl);
      }
    });
  };

  useEffect(() => {
    if (open) {
      setStats(loadCareerPathStats());
      startRound('daily', difficulty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Trigger Wikipedia REST photo & bio fetch ONLY once the round ends
  useEffect(() => {
    if (roundStatus === 'playing') return;
    let cancelled = false;
    setLoadingRevealPhoto(true);
    fetchPlayerRevealPhoto(activePlayer, infoboxImgHint).then((details) => {
      if (cancelled) return;
      setRevealDetails(details);
      setLoadingRevealPhoto(false);
    });
    return () => {
      cancelled = true;
    };
  }, [roundStatus, activePlayer, infoboxImgHint]);

  const excludedNames = useMemo(
    () => new Set(attempts.filter((a) => a.type === 'wrong').map((a) => a.label)),
    [attempts]
  );

  const suggestions = useMemo(
    () => searchPlayerOptions(query, excludedNames, 7),
    [query, excludedNames]
  );

  if (!open) return null;

  const currentGuessNumber = Math.min(MAX_GUESSES, attempts.length + 1);
  const seniorLen = activePlayer.seniorCareer.length;
  const intlRevealed =
    roundStatus !== 'playing' || revealedCount > seniorLen;

  const finalizeRound = (won: boolean, updatedAttempts: AttemptEntry[]) => {
    const guessesUsed = updatedAttempts.length;
    setRoundStatus(won ? 'won' : 'lost');
    setRevealedCount(seniorLen + 1);
    setDropdownOpen(false);
    setQuery('');

    const nextStats = recordCareerPathOutcome(
      won,
      guessesUsed,
      playMode === 'daily',
      dailyDateKey
    );
    setStats(nextStats);

    if (won) {
      soundFx.categoryComplete();
      onEarnCoins?.(25);
    } else {
      soundFx.mistake();
    }
  };

  const handleGuessOption = (option: AutocompletePlayerOption) => {
    if (roundStatus !== 'playing') return;

    const isMatch =
      normalizePlayerText(option.name) === normalizePlayerText(activePlayer.name) ||
      option.wikiTitle === activePlayer.wikiTitle;

    if (isMatch) {
      const nextAttempts: AttemptEntry[] = [
        ...attempts,
        { type: 'correct', label: activePlayer.name },
      ];
      setAttempts(nextAttempts);
      setStatusFeedback(`Solved in ${nextAttempts.length}/${MAX_GUESSES}! (+25 Coins)`);
      finalizeRound(true, nextAttempts);
      return;
    }

    // Incorrect guess: reveals next chronological club
    soundFx.mistake();
    const nextAttempts: AttemptEntry[] = [
      ...attempts,
      { type: 'wrong', label: option.name },
    ];
    setAttempts(nextAttempts);
    setQuery('');
    setDropdownOpen(false);
    setShakeInput(true);
    setTimeout(() => setShakeInput(false), 380);

    if (nextAttempts.length >= MAX_GUESSES) {
      setStatusFeedback(`Full Time — It was ${activePlayer.name}`);
      finalizeRound(false, nextAttempts);
    } else {
      setRevealedCount((prev) => prev + 1);
      setStatusFeedback(`Not ${option.name} — next career clue unlocked`);
      inputRef.current?.focus();
    }
  };

  const handleSkip = () => {
    if (roundStatus !== 'playing') return;
    soundFx.cardSlide();
    const nextAttempts: AttemptEntry[] = [
      ...attempts,
      { type: 'skip', label: 'Skipped' },
    ];
    setAttempts(nextAttempts);
    setQuery('');
    setDropdownOpen(false);

    if (nextAttempts.length >= MAX_GUESSES) {
      setStatusFeedback(`Out of guesses — It was ${activePlayer.name}`);
      finalizeRound(false, nextAttempts);
    } else {
      setRevealedCount((prev) => prev + 1);
      setStatusFeedback('Next career row revealed!');
      inputRef.current?.focus();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roundStatus !== 'playing' || !query.trim()) return;

    if (suggestions.length === 0) {
      setDropdownOpen(true);
      setShakeInput(true);
      setTimeout(() => setShakeInput(false), 380);
      setStatusFeedback('No matching player — check spelling');
      return;
    }

    const picked = suggestions[Math.min(highlightedIdx, suggestions.length - 1)];
    if (suggestions.length === 1 || isExactOptionMatch(query, picked) || highlightedIdx > 0) {
      handleGuessOption(picked);
      return;
    }

    // Multiple players match a broad surname (e.g. Silva / Ronaldo): ask user to pick instead of burning a life
    setDropdownOpen(true);
    setStatusFeedback(`Pick which ${query.trim()} from the list above`);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  const handleShareResult = async () => {
    const squares = attempts
      .map((a) => (a.type === 'correct' ? '🟩' : a.type === 'skip' ? '🟨' : '🟥'))
      .join('');
    const header =
      playMode === 'daily'
        ? `Football Solitaire • Career Path #${puzzleNumber}`
        : `Football Solitaire • Career Path`;
    const score = roundStatus === 'won' ? `${attempts.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const text = `${header} (${score})\n${squares}\nPlay at https://0mattsmith.github.io/FootballSolitaire/`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2200);
    } catch {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2200);
    }
  };

  const winRate =
    stats.totalPlayed > 0 ? Math.round((stats.totalWins / stats.totalPlayed) * 100) : 0;
  const maxDistCount = Math.max(1, ...Object.values(stats.distribution));

  return (
    <div className="fixed inset-0 z-[55] bg-[#18152e]/95 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-[460px] h-[94dvh] max-h-[860px] bg-[#18152e] rounded-3xl border-2 border-[#36315e] shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Top Bar matching playfootball.games header */}
        <div className="px-3.5 py-2.5 bg-[#120f24] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              title="Back to Settings"
              className="w-8 h-8 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowHelpBox((v) => !v)}
              title="How to Play"
              className="w-8 h-8 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 flex items-center justify-center cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center min-w-0">
            <div className="text-[13px] font-black tracking-[0.14em] uppercase text-white truncate">
              CAREER PATH CHALLENGE
            </div>
            <div className="text-[10px] font-bold text-[#ceff27] flex items-center justify-center gap-1.5">
              <span>Wikipedia Infobox Edition</span>
              {loadingLiveWiki && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowStatsModal(true)}
              title="Statistics"
              className="w-8 h-8 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 flex items-center justify-center cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="w-8 h-8 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode & Difficulty Toolbar */}
        <div className="px-3 py-2 bg-[#201c3d] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-black/25 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => startRound('daily', difficulty)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-black cursor-pointer transition ${
                playMode === 'daily'
                  ? 'bg-[#ceff27] text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Daily #{puzzleNumber}
            </button>
            <button
              type="button"
              onClick={() => startRound('random', difficulty, activePlayer.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-black flex items-center gap-1 cursor-pointer transition ${
                playMode === 'random'
                  ? 'bg-[#3b82f6] text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Shuffle className="w-3 h-3" />
              Random
            </button>
          </div>

          <div className="flex items-center gap-1">
            {(['easy', 'normal', 'hard', 'all'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => startRound(playMode, lvl, activePlayer.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide cursor-pointer border transition ${
                  difficulty === lvl
                    ? 'bg-white text-slate-900 border-white'
                    : 'bg-transparent text-slate-300 border-white/15 hover:border-white/35'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Quick Rules Drawer */}
        {showHelpBox && (
          <div className="mx-3 mt-2 p-2.5 rounded-xl bg-slate-800/95 border border-slate-600 text-[11px] text-slate-200 leading-relaxed shrink-0">
            Guess the footballer in <strong className="text-[#ceff27]">6 tries</strong> from their
            Wikipedia Senior &amp; International career table. Unrevealed clubs are dash-masked by
            exact word length. Wrong guesses or <strong className="text-rose-400">SKIP</strong>{' '}
            unlock the next club! Solve to reveal their Wikipedia photo and earn{' '}
            <strong className="text-amber-300">+25 Coins</strong>.
          </div>
        )}

        {/* Main Scrollable Wikipedia Infobox + Outcome Area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Win / Loss Top Banner */}
          {roundStatus !== 'playing' && (
            <div
              className={`rounded-xl px-4 py-2 text-center font-black text-sm shadow-lg animate-pop-in flex items-center justify-center gap-2 ${
                roundStatus === 'won'
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#e11d48] text-white'
              }`}
            >
              <span>
                {roundStatus === 'won'
                  ? `Well done! Solved in ${attempts.length}/${MAX_GUESSES}`
                  : `Full Time — It was ${activePlayer.name}`}
              </span>
              {roundStatus === 'won' && (
                <span className="inline-flex items-center gap-1 bg-amber-300 text-amber-950 text-[11px] px-2 py-0.5 rounded-full">
                  <Coins className="w-3 h-3" /> +25
                </span>
              )}
            </div>
          )}

          {/* Authentic Wikipedia Article / Infobox Card */}
          <div className="bg-[#f8f9fa] text-[#202122] rounded-xl border border-[#a2a9b1] shadow-xl overflow-hidden">
            {/* Wikipedia Page Masthead */}
            <div className="px-3.5 pt-3 pb-2 bg-white border-b border-[#eaecf0]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {roundStatus === 'playing' ? (
                    <h2 className="font-serif text-lg sm:text-xl font-bold text-[#202122] border-b border-[#a2a9b1] pb-1 tracking-tight">
                      <span className="inline-block bg-[#202122] text-[#202122] rounded px-1.5 select-none">
                        Mystery Player
                      </span>
                    </h2>
                  ) : (
                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#202122] border-b border-[#a2a9b1] pb-1">
                      {activePlayer.name}
                    </h2>
                  )}
                  <p className="text-[10px] text-[#54595d] mt-0.5 italic">
                    From Wikipedia, the free encyclopedia
                  </p>
                </div>

                {/* Classic Wikipedia W Globe Emblem */}
                <div className="w-8 h-8 rounded-full bg-[#eaecf0] border border-[#c8ccd1] flex items-center justify-center font-serif font-bold text-[#202122] text-sm shrink-0">
                  W
                </div>
              </div>

              {/* Post-Round Wikipedia Photo & Bio OR In-Round Silhouette */}
              {roundStatus === 'playing' ? (
                <div className="mt-2.5 flex items-center gap-3 bg-[#f8f9fa] border border-[#c8ccd1] rounded-md p-2">
                  <div className="w-12 h-14 bg-[#eaecf0] border border-[#c8ccd1] rounded flex items-center justify-center shrink-0">
                    <User className="w-7 h-7 text-[#72777d]" />
                  </div>
                  <div className="text-[11px] space-y-1 flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-[#54595d]">Position</span>
                      <span className="font-mono text-[#202122] text-right">
                        {difficulty === 'easy'
                          ? activePlayer.position
                          : maskCareerToken(activePlayer.position)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-[#54595d]">Nationality</span>
                      <span className="font-mono text-[#202122] text-right">
                        {difficulty === 'easy'
                          ? activePlayer.nationality
                          : maskCareerToken(activePlayer.nationality)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-[#54595d]">Difficulty</span>
                      <span className="uppercase text-[10px] font-bold px-1.5 py-0.2 bg-[#dce7f5] text-[#202122] rounded">
                        {difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 bg-[#f8f9fa] border border-[#c8ccd1] rounded-md p-2.5 space-y-2 animate-pop-in">
                  <div className="flex gap-3 items-start">
                    {/* Genuine Wikipedia Photo Container */}
                    <div className="w-24 shrink-0 bg-white border border-[#c8ccd1] p-1 rounded-xs text-center shadow-xs">
                      {loadingRevealPhoto ? (
                        <div className="w-full h-28 bg-[#eaecf0] flex flex-col items-center justify-center text-[#72777d] gap-1">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-[9px]">Wiki photo</span>
                        </div>
                      ) : revealDetails?.photoUrl ? (
                        <img
                          src={revealDetails.photoUrl}
                          alt={activePlayer.name}
                          className="w-full h-28 object-cover object-top rounded-xs bg-[#eaecf0]"
                        />
                      ) : (
                        <div className="w-full h-28 bg-[#eaecf0] flex flex-col items-center justify-center text-[#72777d]">
                          <User className="w-8 h-8" />
                          <span className="text-[9px]">No photo</span>
                        </div>
                      )}
                      <div className="text-[9px] text-[#54595d] mt-1 leading-tight truncate">
                        {activePlayer.name}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="grid grid-cols-[62px_1fr] gap-x-1.5 gap-y-0.5 text-[10px] border-b border-[#eaecf0] pb-1.5">
                        <span className="font-bold text-[#54595d]">Born</span>
                        <span className="text-[#202122]">{activePlayer.birthDate}</span>
                        <span className="font-bold text-[#54595d]">Place</span>
                        <span className="text-[#202122] truncate">{activePlayer.birthPlace}</span>
                        <span className="font-bold text-[#54595d]">Position</span>
                        <span className="text-[#202122]">{activePlayer.position}</span>
                      </div>
                      <p className="text-[11px] text-[#202122] leading-snug line-clamp-4">
                        {revealDetails?.extract ||
                          `${activePlayer.name} is a ${activePlayer.nationality} professional footballer (${activePlayer.position}).`}
                      </p>
                      <a
                        href={
                          revealDetails?.wikiUrl ||
                          `https://en.wikipedia.org/wiki/${encodeURIComponent(activePlayer.wikiTitle)}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0645ad] hover:underline"
                      >
                        Read full article on Wikipedia
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SENIOR CAREER* Section (#b0c4de Wikipedia Infobox Blue Header) */}
            <div className="bg-[#b0c4de] text-[#202122] text-center font-bold tracking-[0.16em] text-[11px] py-1 uppercase border-y border-[#9fb4cf]">
              SENIOR CAREER*
            </div>

            <div className="px-2.5 sm:px-4 py-1.5 bg-[#f8f9fa]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-bold text-[#54595d] border-b border-[#e2e8f0]">
                    <th className="py-1 pr-2 w-[78px]">Years</th>
                    <th className="py-1 pr-2">Team</th>
                    <th className="py-1 pr-2 text-right w-[42px]">Apps</th>
                    <th className="py-1 text-right w-[46px]">(Gls)</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[11px] sm:text-xs">
                  {activePlayer.seniorCareer.map((row, idx) => {
                    const rowRevealed = roundStatus !== 'playing' || idx < revealedCount;
                    // Hard mode Guess 1 shows years/apps/goals for row 0 but masks Club name
                    const partialHardFirstRow =
                      roundStatus === 'playing' &&
                      difficulty === 'hard' &&
                      revealedCount === 0 &&
                      idx === 0;

                    return (
                      <tr
                        key={`${activePlayer.id}-sr-${idx}`}
                        className="border-b border-[#eef2f6] last:border-b-0"
                      >
                        <td className="py-1 pr-2 whitespace-nowrap align-top">
                          {rowRevealed ? (
                            <span
                              className="wiki-fade-cell text-[#202122]"
                              style={{ animationDelay: '0ms' }}
                            >
                              {row.years}
                            </span>
                          ) : partialHardFirstRow ? (
                            <span className="text-[#202122]">{row.years}</span>
                          ) : (
                            <span className="text-slate-400 select-none">
                              {maskCareerToken(row.years)}
                            </span>
                          )}
                        </td>
                        <td className="py-1 pr-2 align-top">
                          {rowRevealed ? (
                            <span
                              className="wiki-fade-cell text-[#202122] font-semibold"
                              style={{ animationDelay: '85ms' }}
                            >
                              {row.isLoan ? '→ ' : ''}
                              {row.team}
                              {row.isLoan ? (
                                <span className="font-normal text-[#54595d]"> (loan)</span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-slate-400 select-none">
                              {maskCareerToken(row.team)}
                            </span>
                          )}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums align-top">
                          {rowRevealed ? (
                            <span
                              className="wiki-fade-cell text-[#202122]"
                              style={{ animationDelay: '170ms' }}
                            >
                              {row.apps}
                            </span>
                          ) : partialHardFirstRow ? (
                            <span className="text-[#202122]">{row.apps}</span>
                          ) : (
                            <span className="text-slate-400 select-none">
                              {maskCareerToken(row.apps)}
                            </span>
                          )}
                        </td>
                        <td className="py-1 text-right tabular-nums align-top">
                          {rowRevealed ? (
                            <span
                              className="wiki-fade-cell text-[#202122]"
                              style={{ animationDelay: '250ms' }}
                            >
                              ({row.goals})
                            </span>
                          ) : partialHardFirstRow ? (
                            <span className="text-[#202122]">({row.goals})</span>
                          ) : (
                            <span className="text-slate-400 select-none">
                              {maskGoalsToken(row.goals)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* INTERNATIONAL CAREER Section */}
            {activePlayer.internationalCareer.length > 0 && (
              <>
                <div className="bg-[#b0c4de] text-[#202122] text-center font-bold tracking-[0.16em] text-[11px] py-1 uppercase border-y border-[#9fb4cf]">
                  INTERNATIONAL CAREER‡
                </div>
                <div className="px-2.5 sm:px-4 py-1.5 bg-[#f8f9fa]">
                  <table className="w-full text-left border-collapse">
                    <tbody className="font-mono text-[11px] sm:text-xs">
                      {activePlayer.internationalCareer.map((row, idx) => (
                        <tr key={`${activePlayer.id}-int-${idx}`}>
                          <td className="py-1 pr-2 whitespace-nowrap w-[78px]">
                            {intlRevealed ? (
                              <span className="wiki-fade-cell text-[#202122]">{row.years}</span>
                            ) : (
                              <span className="text-slate-400 select-none">
                                {maskCareerToken(row.years)}
                              </span>
                            )}
                          </td>
                          <td className="py-1 pr-2">
                            {intlRevealed ? (
                              <span
                                className="wiki-fade-cell text-[#202122] font-semibold"
                                style={{ animationDelay: '85ms' }}
                              >
                                {row.team}
                              </span>
                            ) : (
                              <span className="text-slate-400 select-none">
                                {maskCareerToken(row.team)}
                              </span>
                            )}
                          </td>
                          <td className="py-1 pr-2 text-right tabular-nums w-[42px]">
                            {intlRevealed ? (
                              <span
                                className="wiki-fade-cell text-[#202122]"
                                style={{ animationDelay: '170ms' }}
                              >
                                {row.apps}
                              </span>
                            ) : (
                              <span className="text-slate-400 select-none">
                                {maskCareerToken(row.apps)}
                              </span>
                            )}
                          </td>
                          <td className="py-1 text-right tabular-nums w-[46px]">
                            {intlRevealed ? (
                              <span
                                className="wiki-fade-cell text-[#202122]"
                                style={{ animationDelay: '250ms' }}
                              >
                                ({row.goals})
                              </span>
                            ) : (
                              <span className="text-slate-400 select-none">
                                {maskGoalsToken(row.goals)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Wikipedia Infobox Footnote */}
            <div className="px-3 py-1.5 bg-[#eaecf0] border-t border-[#c8ccd1] flex items-center justify-between text-[9px] text-[#54595d]">
              <span>* Club domestic league appearances and goals</span>
              <span className="font-bold">
                {dataSource === 'wikipedia-live' ? '● Live Wikipedia' : 'Verified Archive'}
              </span>
            </div>
          </div>

          {/* Guess Feedback & Pip Strip */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_GUESSES }).map((_, i) => {
                const entry = attempts[i];
                return (
                  <div
                    key={i}
                    className={`w-6 h-2 rounded-full transition-colors ${
                      entry?.type === 'correct'
                        ? 'bg-emerald-400'
                        : entry?.type === 'wrong'
                        ? 'bg-[#e11d48]'
                        : entry?.type === 'skip'
                        ? 'bg-amber-400'
                        : i === attempts.length && roundStatus === 'playing'
                        ? 'bg-[#ceff27]/70 animate-pulse'
                        : 'bg-white/15'
                    }`}
                  />
                );
              })}
            </div>
            {statusFeedback && (
              <span className="text-[11px] font-bold text-slate-200 truncate">
                {statusFeedback}
              </span>
            )}
          </div>

          {/* Explicit Attempt History Chips */}
          {attempts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              {attempts.map((a, idx) => (
                <span
                  key={`${idx}-${a.label}`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    a.type === 'correct'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : a.type === 'skip'
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                      : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                  }`}
                >
                  {a.type === 'correct' ? '✓' : a.type === 'skip' ? '↷' : '✗'} {a.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Interactive Guess Input OR Post-Round Actions */}
        <div className="p-3 bg-[#120f24] border-t border-white/10 shrink-0">
          {roundStatus === 'playing' ? (
            <div className="relative">
              {/* Dark Autocomplete Dropdown opening upward above the input */}
              {dropdownOpen && query.trim().length >= 2 && (
                <div className="absolute left-0 right-0 bottom-full mb-1.5 bg-[#111827] border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-30 max-h-[210px] overflow-y-auto">
                  {suggestions.length === 0 ? (
                    <div className="px-3.5 py-2.5 text-xs text-slate-400 font-bold">
                      No matching footballer found — check spelling
                    </div>
                  ) : (
                    suggestions.map((opt, idx) => (
                      <button
                        key={`${opt.wikiTitle}-${opt.name}`}
                        type="button"
                        onClick={() => handleGuessOption(opt)}
                        className={`w-full px-3.5 py-2 text-left border-b border-slate-800/80 last:border-b-0 flex items-center justify-between gap-2 cursor-pointer transition ${
                          idx === highlightedIdx
                            ? 'bg-slate-800 ring-1 ring-inset ring-[#ceff27]/50'
                            : 'hover:bg-slate-800/70'
                        }`}
                      >
                        <span className="text-xs font-black uppercase tracking-wide text-white">
                          {opt.name}
                        </span>
                        <span className="text-[10px] font-bold text-[#ceff27] flex items-center gap-1.5">
                          {opt.nationality}
                          {idx === highlightedIdx && suggestions.length === 1 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white">
                              Enter ↵
                            </span>
                          )}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="flex items-stretch gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  enterKeyHint="send"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightedIdx(0);
                    setDropdownOpen(true);
                  }}
                  onKeyDown={handleInputKeyDown}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder={`Guess ${currentGuessNumber} of ${MAX_GUESSES} — Search player...`}
                  className={`flex-1 min-w-0 bg-white text-slate-900 placeholder:text-slate-400 font-bold text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-4 focus:ring-[#ceff27] ${
                    shakeInput ? 'animate-card-shake' : ''
                  }`}
                />
                {query.trim().length >= 2 && (
                  <button
                    type="submit"
                    className="px-3.5 py-2.5 rounded-xl bg-gradient-to-b from-[#2fd46d] to-[#16a34a] hover:brightness-105 active:translate-y-0.5 text-white font-black text-xs uppercase tracking-wider shadow cursor-pointer shrink-0"
                  >
                    Guess
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-3.5 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] active:translate-y-0.5 text-white font-black text-xs uppercase tracking-wider shadow cursor-pointer shrink-0"
                >
                  Skip
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareResult}
                className="px-3.5 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-4 h-4 text-[#ceff27]" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Share
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowStatsModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <BarChart3 className="w-4 h-4" />
                Stats
              </button>
              <button
                type="button"
                onClick={() => startRound('random', difficulty, activePlayer.id)}
                className="flex-1 py-2.5 rounded-xl bg-[#ceff27] hover:bg-[#bdf213] text-slate-950 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                Play Random Player
              </button>
            </div>
          )}
        </div>

        {/* Career Path Statistics Overlay (matching playfootball.games #1e293b stats card) */}
        {showStatsModal && (
          <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-[350px] bg-[#1e293b] border border-slate-600 rounded-2xl p-5 text-white shadow-2xl space-y-4 animate-pop-in">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black tracking-wide">Career Path Statistics</h3>
                <button
                  type="button"
                  onClick={() => setShowStatsModal(false)}
                  className="w-7 h-7 rounded-full border border-slate-500 flex items-center justify-center hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-800/80 rounded-xl py-2 px-1">
                  <div className="text-xl font-black">{stats.totalPlayed}</div>
                  <div className="text-[10px] text-slate-300 font-bold">Played</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl py-2 px-1">
                  <div className="text-xl font-black">{winRate}%</div>
                  <div className="text-[10px] text-slate-300 font-bold">Success</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl py-2 px-1">
                  <div className="text-xl font-black">{stats.currentStreak}</div>
                  <div className="text-[10px] text-slate-300 font-bold">Streak</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl py-2 px-1">
                  <div className="text-xl font-black">{stats.bestStreak}</div>
                  <div className="text-[10px] text-slate-300 font-bold">Best streak</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-black text-center text-slate-200 mb-2">
                  Guess Distribution
                </div>
                {([1, 2, 3, 4, 5, 6] as const).map((g) => {
                  const count = stats.distribution[g] ?? 0;
                  const pct = count > 0 ? Math.max(12, Math.round((count / maxDistCount) * 100)) : 0;
                  const highlight =
                    roundStatus === 'won' && attempts.length === g;
                  return (
                    <div key={g} className="flex items-center gap-2 text-xs font-bold">
                      <span className="w-3 text-right text-slate-300">{g}</span>
                      <div className="flex-1 bg-slate-800 rounded h-5 overflow-hidden flex items-center">
                        <div
                          className={`h-full px-2 flex items-center justify-end text-[11px] font-black transition-all ${
                            highlight ? 'bg-[#3b82f6]' : count > 0 ? 'bg-slate-500' : 'bg-slate-700'
                          }`}
                          style={{ width: count > 0 ? `${pct}%` : '22px' }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                {roundStatus !== 'playing' && (
                  <button
                    type="button"
                    onClick={handleShareResult}
                    className="w-full py-2.5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    {copiedShare ? 'Result Copied!' : 'Share Score'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowStatsModal(false);
                    startRound('random', difficulty, activePlayer.id);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#ceff27] hover:bg-[#bdf213] text-slate-950 font-black text-xs cursor-pointer"
                >
                  Play Another Player
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
