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
export type MahjongActionDecision = "chi" | "peng" | "gang" | "hu" | "pass";

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

export interface DebugScriptStep {
    playerIndex: number;
    phase?: "DISCARD" | "RESOLVE";
    action?: MahjongActionDecision;
    tile?: string;
    note?: string;
}

export interface DebugScenario {
    name: string;
    hands: Partial<Record<number, string[]>>;
    draws?: string[];
    script?: DebugScriptStep[];
    currentTurn?: number;
}

export interface LlmAdviceRecord {
    playerIndex: number;
    mode: "discard" | "action" | "advice";
    result: string;
    analysis: string;
    fallback?: boolean;
    timestamp: number;
}

export interface ReplayEvent {
    id: string;
    type: "init" | "draw" | "discard" | "check" | "action" | "resolve" | "win" | "debug" | "llm";
    message: string;
    timestamp: number;
    playerIndex?: number;
    tile?: Tile;
    action?: MahjongActionDecision | string;
    snapshot: {
        players: Player[];
        deck: Tile[];
        currentTurn: number;
        winner: number | null;
        lastDiscard: Tile | null;
        isGameOver: boolean;
        isWaitingForAction: boolean;
        pendingActions: GameState["pendingActions"];
        actionDecisions: GameState["actionDecisions"];
        wallCount: number;
        rules: GameRules;
        actionTimer: number;
        logs: string[];
        phase: GameState["phase"];
        checkIndex: number;
    };
    llmAdvice?: LlmAdviceRecord[];
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
    debugScenario?: DebugScenario;
    debugScriptIndex?: number;
    replayEvents: ReplayEvent[];
    llmAdvice: LlmAdviceRecord[];
}
