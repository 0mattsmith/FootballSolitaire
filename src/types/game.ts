export type LockColor = 'red' | 'orange' | 'purple' | 'blue';

export type DeckTheme = 'blue' | 'orange' | 'emerald';

export type ModeId =
  | 'journey'
  | 'leagues_clubs'
  | 'legends_eras'
  | 'cups_nations'
  | 'endless_mix';

export type CategoryKind =
  | 'league_clubs'
  | 'league_players'
  | 'cup_players'
  | 'player_clubs'
  | 'stadiums'
  | 'suffixes'
  | 'league_winners'
  | 'cups'
  | 'leagues'
  | 'nationalities_modern'
  | 'nationalities_historic'
  | 'eras_players'
  | 'managers'
  | 'nicknames';

export type VisualType =
  | 'text'
  | 'club_badge'
  | 'league_badge'
  | 'cup_trophy'
  | 'stadium'
  | 'player_cutout'
  | 'player_silhouette'
  | 'league_with_silhouette'
  | 'cup_with_silhouette'
  | 'flag_modern'
  | 'flag_historic';

export interface CardVisual {
  type: VisualType;
  assetId?: string;
  flagCode?: string;
  accentColor?: string;
  subtitle?: string;
}

export interface CategoryDef {
  id: string;
  title: string;
  tabTitle: string; // Short title for yellow tab above active foundation
  kind: CategoryKind;
  modeTags: ModeId[];
  visual: CardVisual;
  hint: string;
  items: ItemTemplate[];
}

export interface ItemTemplate {
  id: string;
  label: string;
  shortLabel?: string; // Used in narrow fanned/stacked strip if needed
  visual: CardVisual;
}

export type CardKind = 'category' | 'item' | 'lock' | 'key';

export interface GameCard {
  uid: string;
  kind: CardKind;
  faceUp: boolean;
  // For 'category' and 'item'
  categoryId?: string;
  label: string;
  shortLabel?: string;
  visual: CardVisual;
  totalCount?: number; // For 'category' card (0/N)
  // For 'lock' and 'key'
  lockColor?: LockColor;
}

export interface FoundationSlot {
  slotIndex: number;
  categoryId: string | null;
  categoryTitle: string | null;
  tabTitle: string | null;
  totalCount: number;
  anchorCard: GameCard | null;
  placedCards: GameCard[];
  isCompleting?: boolean;
}

export interface TableauColumn {
  colIndex: number;
  cards: GameCard[]; // index 0 = top/deepest card, last = exposed/front-most card
}

export interface LevelConfig {
  id: string;
  levelNumber: number;
  modeId: ModeId;
  title: string;
  subtitle: string;
  foundationCount: number;
  tableauCount: number;
  maxMoves: number | null; // null = infinity (tutorial / cosy)
  categories: CategoryDef[];
  hasLocks?: boolean;
  seed: number;
  coinReward: number;
}

export interface GameSnapshot {
  stock: GameCard[];
  waste: GameCard[];
  foundations: FoundationSlot[];
  tableau: TableauColumn[];
  completedCategoryIds: string[];
  movesLeft: number | null;
  movesUsed: number;
  mistakes: number;
}

export interface GameState extends GameSnapshot {
  level: LevelConfig;
  status: 'playing' | 'won' | 'lost';
  history: GameSnapshot[];
  unlockedLocks: LockColor[];
  lastEvent?: {
    type:
      | 'match'
      | 'category_open'
      | 'category_complete'
      | 'tableau_move'
      | 'draw'
      | 'recycle'
      | 'unlock'
      | 'mistake'
      | 'undo'
      | 'joker';
    timestamp: number;
    slotIndex?: number;
    colIndex?: number;
    lockColor?: LockColor;
    message?: string;
  };
}

export interface HintSuggestion {
  description: string;
  source:
    | { zone: 'tableau'; colIndex: number; cardIndex: number; cardUid: string }
    | { zone: 'waste'; cardUid: string }
    | { zone: 'stock' };
  target?:
    | { zone: 'foundation'; slotIndex: number }
    | { zone: 'tableau'; colIndex: number }
    | { zone: 'lock'; colIndex: number; cardUid: string };
}

export interface PlayerProgress {
  coins: number;
  hints: number;
  undos: number;
  jokers: number;
  completedLevelIds: string[];
  streak: number;
  cosyUnlimitedMoves: boolean;
  soundEnabled: boolean;
  deckTheme: DeckTheme;
}
