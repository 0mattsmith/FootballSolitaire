import {
  ALL_AUTOCOMPLETE_PLAYERS,
  AutocompletePlayerOption,
  CAREER_PATH_PLAYERS,
  CareerClubRow,
  CareerPathPlayer,
} from '../data/careerPathPlayers';
import { resolveLocalAsset } from './footballApi';

export type CareerDifficultyFilter = 'all' | 'easy' | 'normal' | 'hard';

export interface ParsedWikiInfobox {
  fullName?: string;
  birthDate?: string;
  birthPlace?: string;
  position?: string;
  infoboxImageUrl?: string;
  seniorCareer: CareerClubRow[];
  internationalCareer: CareerClubRow[];
}

export interface LiveCareerRoundData {
  player: CareerPathPlayer;
  dataSource: 'wikipedia-live' | 'verified-archive';
  infoboxImageUrl?: string;
}

export interface PlayerRevealDetails {
  photoUrl: string | null;
  extract: string;
  wikiUrl: string;
}

export interface CareerPathStats {
  totalPlayed: number;
  totalWins: number;
  currentStreak: number;
  bestStreak: number;
  distribution: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
  dailySolvedDates: string[];
  dailyFailedDates: string[];
}

const WIKI_PARSE_CACHE_PREFIX = 'cp_wiki_parse_v1:';
const WIKI_SUMMARY_CACHE_PREFIX = 'cp_wiki_summary_v1:';
const STATS_STORAGE_KEY = 'football_solitaire_career_stats_v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

const MEMORY_PARSE_CACHE = new Map<string, ParsedWikiInfobox>();
const MEMORY_SUMMARY_CACHE = new Map<string, PlayerRevealDetails>();

export function normalizePlayerText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchPlayerOptions(
  query: string,
  excludedNames: Set<string>,
  limit = 7
): AutocompletePlayerOption[] {
  const clean = normalizePlayerText(query);
  if (clean.length < 2) return [];

  const scored: Array<{ option: AutocompletePlayerOption; score: number }> = [];
  for (const option of ALL_AUTOCOMPLETE_PLAYERS) {
    if (excludedNames.has(option.name)) continue;
    const normName = normalizePlayerText(option.name);
    const aliases = (option.searchAliases ?? []).map(normalizePlayerText);

    let score = 0;
    if (normName === clean || aliases.includes(clean)) {
      score = 100;
    } else if (
      normName.startsWith(clean) ||
      normName.split(' ').some((part) => part.startsWith(clean)) ||
      aliases.some((a) => a.startsWith(clean))
    ) {
      score = 75;
    } else if (normName.includes(clean) || aliases.some((a) => a.includes(clean))) {
      score = 45;
    }

    if (score > 0) {
      scored.push({ option, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.option.name.localeCompare(b.option.name))
    .slice(0, limit)
    .map((item) => item.option);
}

/**
 * Replaces letters and digits with dashes while keeping word spacing,
 * matching PlayFootball's Career Path Challenge dash-clue silhouette.
 */
export function maskCareerToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return '-';
  return trimmed
    .replace(/[–—]/g, ' ')
    .replace(/[A-Za-z0-9\u00C0-\u024F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function maskGoalsToken(goals: string): string {
  const clean = goals.replace(/[()]/g, '').trim();
  if (!clean) return '(-)';
  return `(${'-'.repeat(Math.max(1, clean.length))})`;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#160;|&nbsp;/gi, ' ')
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8212;|&mdash;/gi, '—')
    .replace(/&#91;/g, '[')
    .replace(/&#93;/g, ']')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function stripCellHtml(cellHtml: string): string {
  const withoutStyleAndRef = cellHtml
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<sup[\s\S]*?<\/sup>/gi, '');
  const textOnly = withoutStyleAndRef.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(textOnly)
    .replace(/\[\s*[a-zA-Z0-9]+\s*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pure parser for English Wikipedia football biography section-0 HTML.
 * Extracts Senior Career, International Career, and personal fields.
 */
export function parseWikipediaInfoboxHtml(html: string): ParsedWikiInfobox | null {
  if (!html || !/<table/i.test(html)) return null;

  // Focus on the infobox table if present
  const infoboxMatch = html.match(/<table[^>]*infobox[^>]*>([\s\S]*?)<\/table>/i);
  const scopeHtml = infoboxMatch ? infoboxMatch[0] : html;

  let infoboxImageUrl: string | undefined;
  const imgMatch = scopeHtml.match(
    /<td[^>]*infobox-image[\s\S]*?<img[^>]+src="([^"]+)"/i
  );
  if (imgMatch && imgMatch[1]) {
    infoboxImageUrl = imgMatch[1].startsWith('//')
      ? `https:${imgMatch[1]}`
      : imgMatch[1];
  }

  let section: 'none' | 'personal' | 'senior' | 'international' = 'none';
  let fullName: string | undefined;
  let birthDate: string | undefined;
  let birthPlace: string | undefined;
  let position: string | undefined;
  const seniorCareer: CareerClubRow[] = [];
  const internationalCareer: CareerClubRow[] = [];

  const rowMatches = [...scopeHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];
    const cellMatches = [...rowHtml.matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)];
    if (cellMatches.length === 0) continue;

    const cells = cellMatches.map((m) => stripCellHtml(m[2]));
    const firstCell = cells[0] || '';
    const joined = cells.join(' ').trim();

    if (!joined) continue;

    // Detect infobox section headers
    if (cellMatches.length === 1 || /infobox-header/i.test(rowHtml)) {
      if (/^Personal information/i.test(joined)) {
        section = 'personal';
        continue;
      }
      if (/^Youth career/i.test(joined) || /^Managerial career/i.test(joined) || /^Medal record/i.test(joined)) {
        section = 'none';
        continue;
      }
      if (/^Senior career/i.test(joined)) {
        section = 'senior';
        continue;
      }
      if (/^International career/i.test(joined)) {
        section = 'international';
        continue;
      }
    }

    if (section === 'personal' && cells.length >= 2) {
      if (/^Full name$/i.test(firstCell)) fullName = cells[1];
      if (/^Date of birth$/i.test(firstCell)) {
        // Strip hidden ISO prefix like "(1985-02-05) " and "(age 41)" if tidy
        birthDate = cells[1]
          .replace(/^\(\s*\d{4}-\d{2}-\d{2}\s*\)\s*/g, '')
          .replace(/\s*\(age\s*\d+\)\s*/gi, '')
          .trim();
      }
      if (/^Place of birth$/i.test(firstCell)) birthPlace = cells[1].replace(/\s*,\s*/g, ', ');
      if (/^Position(\(s\))?$/i.test(firstCell)) {
        position = cells.slice(1).join(', ').replace(/\s*·\s*/g, ' / ').trim();
      }
      continue;
    }

    if (section === 'senior' || section === 'international') {
      // Skip column header row ("Years | Team | Apps | (Gls)") and "Total"
      if (/^Years$/i.test(firstCell) || /^Total$/i.test(firstCell)) continue;

      if (cells.length >= 2) {
        const years = firstCell.replace(/\s*[–-]\s*/g, '–').trim();
        let team = (cells[1] || '').trim();
        if (!team || /^\*?Club domestic/i.test(joined) || /^National team/i.test(joined)) {
          continue;
        }

        const isLoan = /^→/.test(team) || /\(loan\)/i.test(team);
        team = team
          .replace(/^→\s*/, '')
          .replace(/\s*\(loan\)\s*/gi, '')
          .trim();

        const appsRaw = (cells[2] ?? '').replace(/[^\d—–-]/g, '').trim() || '—';
        const goalsRaw = (cells[3] ?? '').replace(/[()\s]/g, '').trim() || '0';

        // Sanity guard: must look like years + club name
        if (!/\d{4}/.test(years)) continue;

        const row: CareerClubRow = {
          years,
          team,
          isLoan: isLoan || undefined,
          apps: appsRaw,
          goals: goalsRaw.replace(/[^\d]/g, '') || '0',
        };

        if (section === 'senior') {
          seniorCareer.push(row);
        } else {
          // Keep senior international team rows (filter out U15..U23 & B teams)
          if (!/\bU-?\d{2}\b|\bB\b/i.test(team)) {
            internationalCareer.push(row);
          }
        }
      }
    }
  }

  if (seniorCareer.length < 2) return null;

  return {
    fullName,
    birthDate,
    birthPlace,
    position,
    infoboxImageUrl,
    seniorCareer,
    internationalCareer,
  };
}

function readCachedJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: T };
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedJson<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // ignore quota errors
  }
}

/**
 * Fetches live Wikipedia career infobox when online & not throttled,
 * seamlessly falling back to the verified offline career archive.
 */
export async function fetchLiveCareerPlayerData(
  player: CareerPathPlayer
): Promise<LiveCareerRoundData> {
  const cached =
    MEMORY_PARSE_CACHE.get(player.wikiTitle) ??
    readCachedJson<ParsedWikiInfobox>(WIKI_PARSE_CACHE_PREFIX + player.wikiTitle);

  if (cached && cached.seniorCareer.length >= 2) {
    MEMORY_PARSE_CACHE.set(player.wikiTitle, cached);
    return {
      player: {
        ...player,
        position: cached.position || player.position,
        birthDate: cached.birthDate || player.birthDate,
        birthPlace: cached.birthPlace || player.birthPlace,
        seniorCareer: cached.seniorCareer,
        internationalCareer:
          cached.internationalCareer.length > 0
            ? cached.internationalCareer
            : player.internationalCareer,
      },
      dataSource: 'wikipedia-live',
      infoboxImageUrl: cached.infoboxImageUrl,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const url = `https://en.wikipedia.org/w/api.php?action=parse&prop=text&format=json&origin=*&page=${encodeURIComponent(
      player.wikiTitle
    )}&section=0&redirects=1`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('json')) throw new Error('Non-JSON response');

    const json = (await res.json()) as {
      parse?: { text?: { '*'?: string } };
      error?: unknown;
    };
    const html = json?.parse?.text?.['*'];
    if (!html) throw new Error('Missing infobox HTML');

    const parsed = parseWikipediaInfoboxHtml(html);
    if (!parsed) throw new Error('No senior career parsed');

    MEMORY_PARSE_CACHE.set(player.wikiTitle, parsed);
    writeCachedJson(WIKI_PARSE_CACHE_PREFIX + player.wikiTitle, parsed);

    return {
      player: {
        ...player,
        position: parsed.position || player.position,
        birthDate: parsed.birthDate || player.birthDate,
        birthPlace: parsed.birthPlace || player.birthPlace,
        seniorCareer: parsed.seniorCareer,
        internationalCareer:
          parsed.internationalCareer.length > 0
            ? parsed.internationalCareer
            : player.internationalCareer,
      },
      dataSource: 'wikipedia-live',
      infoboxImageUrl: parsed.infoboxImageUrl,
    };
  } catch {
    return {
      player,
      dataSource: 'verified-archive',
    };
  }
}

/**
 * Fetches the player's official Wikipedia summary & portrait image after the round ends.
 */
export async function fetchPlayerRevealPhoto(
  player: CareerPathPlayer,
  infoboxImageHint?: string
): Promise<PlayerRevealDetails> {
  const fallbackImg = resolveLocalAsset(player.localAssetId, 'image').src || infoboxImageHint || null;
  const fallbackWikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(player.wikiTitle)}`;

  const cached =
    MEMORY_SUMMARY_CACHE.get(player.wikiTitle) ??
    readCachedJson<PlayerRevealDetails>(WIKI_SUMMARY_CACHE_PREFIX + player.wikiTitle);
  if (cached && (cached.photoUrl || cached.extract)) {
    MEMORY_SUMMARY_CACHE.set(player.wikiTitle, cached);
    return cached;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(player.wikiTitle)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as {
      extract?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };

    const details: PlayerRevealDetails = {
      photoUrl: data.thumbnail?.source || data.originalimage?.source || fallbackImg,
      extract: data.extract || `${player.name} (${player.nationality}) — ${player.position}.`,
      wikiUrl: data.content_urls?.desktop?.page || fallbackWikiUrl,
    };

    MEMORY_SUMMARY_CACHE.set(player.wikiTitle, details);
    writeCachedJson(WIKI_SUMMARY_CACHE_PREFIX + player.wikiTitle, details);
    return details;
  } catch {
    return {
      photoUrl: fallbackImg,
      extract: `${player.name} (${player.nationality}) — ${player.position}, born ${player.birthDate} in ${player.birthPlace}.`,
      wikiUrl: fallbackWikiUrl,
    };
  }
}

export function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getDailyPuzzleInfo(
  difficulty: CareerDifficultyFilter = 'all',
  date = new Date()
): { puzzleNumber: number; dateKey: string; player: CareerPathPlayer } {
  const pool =
    difficulty === 'all'
      ? CAREER_PATH_PLAYERS
      : CAREER_PATH_PLAYERS.filter((p) => p.difficulty === difficulty);
  const effectivePool = pool.length > 0 ? pool : CAREER_PATH_PLAYERS;

  const epochUtc = Date.UTC(2026, 0, 1);
  const dayUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const puzzleNumber = Math.max(1, Math.floor((dayUtc - epochUtc) / 86400000) + 1);

  // Golden-ratio stride spreads difficulty/era variety smoothly across days
  const index = (puzzleNumber * 17) % effectivePool.length;
  return {
    puzzleNumber,
    dateKey: getUtcDateKey(date),
    player: effectivePool[index],
  };
}

export function pickRandomCareerPlayer(
  difficulty: CareerDifficultyFilter,
  excludePlayerId?: string
): CareerPathPlayer {
  const pool =
    difficulty === 'all'
      ? CAREER_PATH_PLAYERS
      : CAREER_PATH_PLAYERS.filter((p) => p.difficulty === difficulty);
  const filtered = pool.filter((p) => p.id !== excludePlayerId);
  const finalPool = filtered.length > 0 ? filtered : CAREER_PATH_PLAYERS;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

export function defaultCareerPathStats(): CareerPathStats {
  return {
    totalPlayed: 0,
    totalWins: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    dailySolvedDates: [],
    dailyFailedDates: [],
  };
}

export function loadCareerPathStats(): CareerPathStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return defaultCareerPathStats();
    const parsed = JSON.parse(raw) as Partial<CareerPathStats>;
    return {
      ...defaultCareerPathStats(),
      ...parsed,
      distribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        ...(parsed.distribution ?? {}),
      },
    };
  } catch {
    return defaultCareerPathStats();
  }
}

export function recordCareerPathOutcome(
  won: boolean,
  guessUsed: number,
  isDaily: boolean,
  dateKey: string
): CareerPathStats {
  const curr = loadCareerPathStats();
  const clampedGuess = Math.min(6, Math.max(1, guessUsed)) as 1 | 2 | 3 | 4 | 5 | 6;
  const nextStreak = won ? curr.currentStreak + 1 : 0;

  const updated: CareerPathStats = {
    totalPlayed: curr.totalPlayed + 1,
    totalWins: won ? curr.totalWins + 1 : curr.totalWins,
    currentStreak: nextStreak,
    bestStreak: Math.max(curr.bestStreak, nextStreak),
    distribution: {
      ...curr.distribution,
      ...(won ? { [clampedGuess]: (curr.distribution[clampedGuess] ?? 0) + 1 } : {}),
    },
    dailySolvedDates:
      isDaily && won && !curr.dailySolvedDates.includes(dateKey)
        ? [...curr.dailySolvedDates, dateKey]
        : curr.dailySolvedDates,
    dailyFailedDates:
      isDaily && !won && !curr.dailyFailedDates.includes(dateKey)
        ? [...curr.dailyFailedDates, dateKey]
        : curr.dailyFailedDates,
  };

  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore quota
  }
  return updated;
}
