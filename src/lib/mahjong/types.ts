export type Suit = "bamboo" | "character" | "dot" | "wind" | "dragon" | "flower" | "season";

export type Rank =
    | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 // Numbered suits
    | "east" | "south" | "west" | "north" // Winds
    | "red" | "green" | "white" // Dragons
    | 1 | 2 | 3 | 4; // Flowers/Seasons

export interface Tile {
    id: string; // Unique ID for React keys
    suit: Suit;
    rank: Rank;
    isDora?: boolean; // Optional: for future use
}

export type MeldType = "chi" | "peng" | "gang";

export interface Meld {
    type: MeldType;
    tiles: Tile[];
    fromPlayer?: number; // Index of player who discarded the tile
}

export interface Player {
    id: number;
    name: string;
    hand: Tile[];
    discards: Tile[];
    melds: Meld[];
    isTurn: boolean;
    score: number;
    wind: "east" | "south" | "west" | "north";
}

export type Region = "chinese" | "riichi" | "sichuan" | "beijing";

export interface GameRules {
    region: Region;
    hasFlowers: boolean;
    hasSeasons: boolean;
    hasRedDora: boolean; // Riichi specific
    handSize: 13 | 16; // 16 for Taiwan style, usually 13
}

export interface RuleStrategy {
    getRules(): GameRules;
    checkWin(hand: Tile[]): boolean;
    canChi(hand: Tile[], discard: Tile): boolean;
    canPeng(hand: Tile[], discard: Tile): boolean;
    canGang(hand: Tile[], discard: Tile | null, isSelfDraw: boolean): boolean;
    canHu(hand: Tile[], discard: Tile | null, isSelfDraw: boolean): boolean;
    // Future: getValidMelds, getScore, etc.
}

export interface GameState {
    players: Player[];
    deck: Tile[];
    currentTurn: number; // Player index (0-3)
    winner: number | null;
    lastDiscard: Tile | null;
    isGameOver: boolean;
    // New fields for turn interrupt logic
    isWaitingForAction: boolean;
    pendingActions: {
        [playerIndex: number]: {
            chi: boolean;
            peng: boolean;
            gang: boolean;
            hu: boolean;
        };
    };
    actionDecisions: {
        [playerIndex: number]: string; // "chi", "peng", "gang", "hu", "pass"
    };
    wallCount: number; // Remaining tiles
    rules: GameRules;
    actionTimer: number; // Countdown for player actions
    logs: string[]; // Game event logs
    // Step-by-step debugging state
    phase: "DRAW" | "DISCARD" | "CHECK" | "RESOLVE";
    checkIndex: number; // Player index being checked
}
