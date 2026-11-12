import { CategoryDef, LevelConfig, ModeId } from '../types/game';
import { FOOTBALL_CATEGORIES, getCategoryById } from './footballCatalog';
import { createSeededRng, shuffleWithRng } from '../engine/levelGenerator';

export interface GameModeInfo {
  id: ModeId;
  name: string;
  tagline: string;
  accent: string;
  badgeIcon: string;
}

export const GAME_MODES: GameModeInfo[] = [
  {
    id: 'journey',
    name: 'Classic Journey',
    tagline: '10 curated levels from Kick-Off to Locks & Grand Final',
    accent: '#22c55e',
    badgeIcon: '🏆',
  },
  {
    id: 'leagues_clubs',
    name: 'Leagues & Clubs',
    tagline: 'Divisions, League Winners, Suffixes & Club Badges',
    accent: '#3b82f6',
    badgeIcon: '🛡️',
  },
  {
    id: 'legends_eras',
    name: 'Legends & Eras',
    tagline: '60s–Modern Icons, Silhouettes & Career Clubs',
    accent: '#a855f7',
    badgeIcon: '⭐',
  },
  {
    id: 'cups_nations',
    name: 'Cups, Stadiums & Nations',
    tagline: 'Trophies, Iconic Grounds & Old/New Flags',
    accent: '#f59e0b',
    badgeIcon: '🏟️',
  },
  {
    id: 'endless_mix',
    name: 'Endless Football Mix',
    tagline: 'Fresh solvable boards blending every football theme',
    accent: '#ec4899',
    badgeIcon: '🎲',
  },
];

function categoriesOverlap(a: CategoryDef, b: CategoryDef): boolean {
  const labelsA = new Set(a.items.map((i) => i.label.toLowerCase().trim()));
  for (const item of b.items) {
    if (labelsA.has(item.label.toLowerCase().trim())) {
      return true;
    }
  }
  return false;
}

export function pickDisjointCategories(
  modeId: ModeId,
  desiredCount: number,
  seed: number
): CategoryDef[] {
  const rng = createSeededRng(seed);
  const modePool =
    modeId === 'endless_mix'
      ? FOOTBALL_CATEGORIES
      : FOOTBALL_CATEGORIES.filter((c) => c.modeTags.includes(modeId));

  const primaryPool = shuffleWithRng(modePool, rng);
  const chosen: CategoryDef[] = [];

  for (const cat of primaryPool) {
    if (chosen.length >= desiredCount) break;
    if (!chosen.some((existing) => categoriesOverlap(existing, cat))) {
      chosen.push(cat);
    }
  }

  // Fallback top-up from full catalog if mode pool had overlaps
  if (chosen.length < desiredCount) {
    const fallbackPool = shuffleWithRng(FOOTBALL_CATEGORIES, rng);
    for (const cat of fallbackPool) {
      if (chosen.length >= desiredCount) break;
      if (
        !chosen.some((e) => e.id === cat.id) &&
        !chosen.some((existing) => categoriesOverlap(existing, cat))
      ) {
        chosen.push(cat);
      }
    }
  }

  return chosen;
}

function mustCats(ids: string[]): CategoryDef[] {
  const cats = ids.map((id) => {
    const found = getCategoryById(id);
    if (!found) throw new Error(`Missing category id: ${id}`);
    return found;
  });
  // Verify zero overlap
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      if (categoriesOverlap(cats[i], cats[j])) {
        throw new Error(`Overlapping items between ${cats[i].id} and ${cats[j].id}`);
      }
    }
  }
  return cats;
}

export const JOURNEY_LEVELS: LevelConfig[] = [
  {
    id: 'journey_1',
    levelNumber: 1,
    modeId: 'journey',
    title: 'Kick-Off',
    subtitle: 'Place a Crown category card, then stack matching cards!',
    foundationCount: 3,
    tableauCount: 3,
    maxMoves: null, // Unlimited tutorial just like Image 3!
    categories: mustCats(['cat_top_leagues', 'cat_pl_stadiums', 'cat_suffixes_words']),
    hasLocks: false,
    seed: 101,
    coinReward: 40,
  },
  {
    id: 'journey_2',
    levelNumber: 2,
    modeId: 'journey',
    title: 'European Nights',
    subtitle: 'Clubs, Cups & Gareth Bale’s Career Teams',
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 55,
    categories: mustCats([
      'cat_bundesliga_clubs',
      'cat_seriea_clubs',
      'cat_cups',
      'cat_bale_clubs',
    ]),
    hasLocks: false,
    seed: 202,
    coinReward: 50,
  },
  {
    id: 'journey_3',
    levelNumber: 3,
    modeId: 'journey',
    title: 'Break The Locks',
    subtitle: 'Uncover Keys to shatter colored Locks on the pitch!',
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 72,
    categories: mustCats([
      'cat_pl_winners',
      'cat_euro_stadiums',
      'cat_historic_nations',
      'cat_pl_players_sil',
      'cat_suffixes_words',
    ]),
    hasLocks: true,
    seed: 303,
    coinReward: 65,
  },
  {
    id: 'journey_4',
    levelNumber: 4,
    modeId: 'journey',
    title: 'Legends & Eras',
    subtitle: '60s–80s Icons, Nations & Thierry Henry’s Clubs',
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 70,
    categories: mustCats([
      'cat_60s_70s_players',
      'cat_80s_players',
      'cat_modern_nations',
      'cat_henry_clubs',
      'cat_championship_clubs',
    ]),
    hasLocks: false,
    seed: 404,
    coinReward: 70,
  },
  {
    id: 'journey_5',
    levelNumber: 5,
    modeId: 'journey',
    title: 'Fortress Stadiums',
    subtitle: 'Manage 4 foundation slots across 5 themes + Locks',
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 78,
    categories: mustCats([
      'cat_pl_stadiums',
      'cat_cups',
      'cat_cr7_clubs',
      'cat_historic_nations',
      'cat_nicknames',
    ]),
    hasLocks: true,
    seed: 505,
    coinReward: 80,
  },
  {
    id: 'journey_6',
    levelNumber: 6,
    modeId: 'journey',
    title: 'Club Heritage',
    subtitle: 'Suffixes, Nicknames, Serie A Stars & Ligue 1',
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 76,
    categories: mustCats([
      'cat_suffixes_words',
      'cat_nicknames',
      'cat_seriea_90s_players',
      'cat_ligue1_clubs',
      'cat_world_stadiums',
    ]),
    hasLocks: false,
    seed: 606,
    coinReward: 85,
  },
  {
    id: 'journey_7',
    levelNumber: 7,
    modeId: 'journey',
    title: 'World Cup Fever',
    subtitle: 'Historic & Modern Nations, Legends & Locks',
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 88,
    categories: mustCats([
      'cat_wc_players_sil',
      'cat_historic_nations',
      'cat_modern_nations',
      'cat_world_stadiums',
      'cat_zlatan_clubs',
      'cat_managers',
    ]),
    hasLocks: true,
    seed: 707,
    coinReward: 95,
  },
  {
    id: 'journey_8',
    levelNumber: 8,
    modeId: 'journey',
    title: 'English Pyramid',
    subtitle: 'Divisions, Pre-PL Champs, Wanderers & Albion',
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 82,
    categories: mustCats([
      'cat_efl_pyramid',
      'cat_historic_eng_champs',
      'cat_suffix_wanderers_albion',
      'cat_suffix_wanderers_rovers',
      'cat_pl_stadiums',
      'cat_managers',
    ]),
    hasLocks: false,
    seed: 808,
    coinReward: 100,
  },
  {
    id: 'journey_9',
    levelNumber: 9,
    modeId: 'journey',
    title: 'Continental Giants',
    subtitle: 'Europe’s Elite Clubs, Cathedrals & Beckham',
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 92,
    categories: mustCats([
      'cat_bundesliga_clubs',
      'cat_modern_nations',
      'cat_euro_stadiums',
      'cat_cups',
      'cat_beckham_clubs',
      'cat_pl_players_sil',
    ]),
    hasLocks: true,
    seed: 909,
    coinReward: 110,
  },
  {
    id: 'journey_10',
    levelNumber: 10,
    modeId: 'journey',
    title: 'The Grand Final',
    subtitle: '7 Categories, Locks & Keys — Full Football Mastery',
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 108,
    categories: mustCats([
      'cat_top_leagues',
      'cat_pl_winners',
      'cat_euro_stadiums',
      'cat_wc_players_sil',
      'cat_historic_nations',
      'cat_suffixes_words',
      'cat_managers',
    ]),
    hasLocks: true,
    seed: 1010,
    coinReward: 150,
  },
];

export function generateModeLevel(
  modeId: ModeId,
  roundNumber: number,
  seedBase = Date.now()
): LevelConfig {
  if (modeId === 'journey') {
    const idx = Math.max(0, Math.min(JOURNEY_LEVELS.length - 1, roundNumber - 1));
    return JOURNEY_LEVELS[idx];
  }

  const seed = seedBase + roundNumber * 1337;
  const catCount = roundNumber === 1 ? 4 : roundNumber % 3 === 0 ? 6 : 5;
  const hasLocks = roundNumber >= 2 && roundNumber % 2 === 0;
  const categories = pickDisjointCategories(modeId, catCount, seed);
  const modeInfo = GAME_MODES.find((m) => m.id === modeId)!;

  return {
    id: `${modeId}_${roundNumber}_${seed}`,
    levelNumber: roundNumber,
    modeId,
    title: `${modeInfo.name} #${roundNumber}`,
    subtitle: hasLocks
      ? `${categories.length} Categories • Locks & Keys Active`
      : `${categories.length} Football Categories`,
    foundationCount: 4,
    tableauCount: 4,
    maxMoves: 55 + categories.length * 10 + (hasLocks ? 10 : 0),
    categories,
    hasLocks,
    seed,
    coinReward: 50 + categories.length * 12 + (hasLocks ? 20 : 0),
  };
}
