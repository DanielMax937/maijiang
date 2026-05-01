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

export type Region = "chinese" | "hangzhou" | "shengzhou";

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
        caishenTile?: Tile;
        caishenSourceTile?: Tile;
        diceValues?: [number, number];
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
    getTenpaiTiles(hand: Tile[]): Tile[];
}

// ===== New Strategy Pattern Architecture =====

// Game context for rule decisions
export interface GameContext {
    hand: Tile[];
    discard?: Tile;
    isSelfDraw: boolean;
    melds: Meld[];
    allPlayers: Player[];
    rules: GameRules;
    phase: string;
    currentTurn: number;
    playerIndex: number;
    caishenTile?: Tile; // Shengzhou: the wildcard tile type
    isGangDraw?: boolean; // Whether this draw was from a gang (杠上开花)
}

// Hu result
export interface HuResult {
    success: boolean;
    patterns: string[];
}

// Sub-rule interfaces
export interface ChiRule {
    canChi(ctx: GameContext): boolean;
}

export interface PengRule {
    canPeng(ctx: GameContext): boolean;
}

export interface GangRule {
    canGang(ctx: GameContext): boolean;
    getSelfDrawGangTile?(ctx: GameContext): Tile | null;
}

export interface HuRule {
    canHu(ctx: GameContext): HuResult;
    checkWin(hand: Tile[]): boolean;
    getTenpaiTiles(hand: Tile[], caishenTile?: Tile): Tile[];
}

export interface ScoreRule {
    calculate(ctx: GameContext, huResult: HuResult): ScoreResult;
}

export interface DrawRule {
    shouldReplaceFlower(tile: Tile): boolean;
}

// Composable rule set
export interface MahjongRuleSet {
    config: GameRules;
    chiRule: ChiRule;
    pengRule: PengRule;
    gangRule: GangRule;
    huRule: HuRule;
    scoreRule: ScoreRule;
    drawRule: DrawRule;
}

export interface ScoreResult {
    base: number;
    fan: number;
    total: number;
    breakdown: string[];
}

// Game action record for review mode
export interface GameActionRecord {
    id: string;
    sequenceNumber: number;
    playerIndex: number;
    action: "draw" | "discard" | "chi" | "peng" | "gang" | "hu" | "pass" | "tsumo_gang" | "jia_gang";
    tile?: Tile;
    timestamp: number;
    gameStateSnapshot: ReplayEvent["snapshot"]; // Full snapshot at this point
    llmAnalysis?: string; // LLM analysis for this action
    isLlmFallback?: boolean; // Whether LLM fallback was used
    deferredAnalysis?: DeferredAnalysis; // Filled in during review
}

// Deferred analysis result for review mode
export interface DeferredAnalysis {
    recommended: string; // What should have been done
    actual: string;      // What was actually done
    pros: string[];      // Advantages of the actual move
    cons: string[];      // Disadvantages of the actual move
    score?: number;      // Quality score 0-100
}

export interface GameState {
    players: Player[];
    deck: Tile[];
    currentTurn: number; // Player index (0-3)
    winner: number | null;
    lastDiscard: Tile | null;
    isGameOver: boolean;
    scoreResult?: ScoreResult;
    selfDrawPassed?: boolean; // Track if player passed on self-draw actions
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
    actionHistory: GameActionRecord[]; // All actions for review
    // Shengzhou Mahjong specific
    caishenTile?: Tile; // The wildcard/joker tile type (e.g., 6万 if flipped 5万)
    caishenSourceTile?: Tile; // The tile that was flipped to determine caishen
    diceValues?: [number, number]; // Dice roll values for game start ceremony
    dealerIndex?: number; // Dealer (庄家) index
}
