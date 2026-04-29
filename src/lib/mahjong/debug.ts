import { generateDeck } from "./deck";
import { getStrategy } from "./rules";
import { DebugScenario, GameRules, Player, Rank, Region, Suit, Tile } from "./types";

type TileKey = `${Suit}-${string}`;

const CODE_TO_TILE: Record<string, { suit: Suit; rank: Rank }> = {
    east: { suit: "wind", rank: "east" },
    south: { suit: "wind", rank: "south" },
    west: { suit: "wind", rank: "west" },
    north: { suit: "wind", rank: "north" },
    red: { suit: "dragon", rank: "red" },
    green: { suit: "dragon", rank: "green" },
    white: { suit: "dragon", rank: "white" },
};

function parseTileCode(code: string): { suit: Suit; rank: Rank } {
    const normalized = code.trim().toLowerCase();
    if (CODE_TO_TILE[normalized]) return CODE_TO_TILE[normalized];

    const match = normalized.match(/^([1-9])([mps])$/);
    if (!match) {
        throw new Error(`Invalid tile code "${code}". Use 1m-9m, 1p-9p, 1s-9s, east/south/west/north/red/green/white.`);
    }

    const rank = Number(match[1]) as Rank;
    const suitByCode: Record<string, Suit> = {
        m: "character",
        p: "dot",
        s: "bamboo",
    };
    return { suit: suitByCode[match[2]], rank };
}

function tileKey(tile: Pick<Tile, "suit" | "rank">): TileKey {
    return `${tile.suit}-${String(tile.rank)}` as TileKey;
}

function takeTile(pool: Tile[], code: string): Tile {
    const parsed = parseTileCode(code);
    const index = pool.findIndex((tile) => tile.suit === parsed.suit && tile.rank === parsed.rank);
    if (index === -1) {
        throw new Error(`Tile "${code}" is not available in the deck.`);
    }
    const [tile] = pool.splice(index, 1);
    return tile;
}

export function sortTiles(tiles: Tile[]): Tile[] {
    return [...tiles].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        if (typeof a.rank === "number" && typeof b.rank === "number") {
            return a.rank - b.rank;
        }
        return String(a.rank).localeCompare(String(b.rank));
    });
}

export function formatTile(tile: Tile): string {
    const suitCode: Record<Suit, string> = {
        character: "m",
        dot: "p",
        bamboo: "s",
        wind: "",
        dragon: "",
        flower: "flower",
        season: "season",
    };
    if (typeof tile.rank === "number" && ["character", "dot", "bamboo"].includes(tile.suit)) {
        return `${tile.rank}${suitCode[tile.suit]}`;
    }
    return String(tile.rank);
}

export function buildDebugGamePieces(
    rules: GameRules,
    players: Player[],
    scenario: DebugScenario
): { players: Player[]; deck: Tile[] } {
    const pool = generateDeck(rules);
    const nextPlayers = players.map((player, index) => {
        const handCodes = scenario.hands[index];
        if (!handCodes) return { ...player, hand: [] };

        return {
            ...player,
            hand: sortTiles(handCodes.map((code) => takeTile(pool, code))),
            discards: [],
            melds: [],
        };
    });

    nextPlayers.forEach((player, index) => {
        if (scenario.hands[index]) return;
        const targetCount = index === (scenario.currentTurn ?? 0) ? rules.handSize + 1 : rules.handSize;
        player.hand = sortTiles(pool.splice(Math.max(0, pool.length - targetCount), targetCount));
    });

    const drawTiles = (scenario.draws || []).map((code) => takeTile(pool, code));
    const deck = [...pool, ...drawTiles.reverse()];
    return { players: nextPlayers, deck };
}

export function validateDebugScenario(region: Region, scenario: DebugScenario): void {
    if (!scenario.name || typeof scenario.name !== "string") {
        throw new Error("Debug scenario requires a name.");
    }
    if (!scenario.hands || typeof scenario.hands !== "object") {
        throw new Error("Debug scenario requires hands.");
    }

    const strategy = getStrategy(region);
    const rules = strategy.getRules();
    const maxCounts = new Map<TileKey, number>();
    generateDeck(rules).forEach((tile) => {
        const key = tileKey(tile);
        maxCounts.set(key, (maxCounts.get(key) || 0) + 1);
    });

    const usedCounts = new Map<TileKey, number>();
    const allCodes = [
        ...Object.values(scenario.hands).flat(),
        ...(scenario.draws || []),
    ].filter((code): code is string => typeof code === "string");
    allCodes.forEach((code) => {
        const parsed = parseTileCode(code);
        const key = tileKey(parsed);
        const nextCount = (usedCounts.get(key) || 0) + 1;
        usedCounts.set(key, nextCount);
        if (nextCount > (maxCounts.get(key) || 0)) {
            throw new Error(`Debug scenario uses too many copies of "${code}".`);
        }
    });
}

export const DEBUG_SCENARIOS: DebugScenario[] = [
    {
        name: "Peng / Chi check",
        currentTurn: 0,
        hands: {
            0: ["1s", "8s", "2s", "3s", "4m", "5m", "6m", "2p", "3p", "4p", "red", "red", "east", "9m"],
            1: ["2s", "3s", "5m", "6m", "7m", "1p", "2p", "3p", "4p", "5p", "south", "south", "white"],
            2: ["1s", "1s", "4s", "5s", "6s", "7m", "8m", "9m", "6p", "7p", "8p", "green", "green"],
            3: ["2m", "3m", "4m", "5s", "6s", "7s", "1p", "1p", "1p", "north", "north", "white", "white"],
        },
        draws: ["4s", "red", "9p", "5m", "2p"],
        script: [
            { playerIndex: 0, phase: "DISCARD", tile: "1s", note: "Player 2 can Peng after this discard." },
            { playerIndex: 1, phase: "RESOLVE", action: "pass" },
            { playerIndex: 2, phase: "RESOLVE", action: "peng" },
        ],
    },
    {
        name: "Self draw Hu",
        currentTurn: 0,
        hands: {
            0: ["1m", "1m", "1m", "2m", "3m", "4m", "5p", "6p", "7p", "2s", "3s", "4s", "east"],
            1: ["1s", "2s", "3s", "4s", "5s", "6s", "7m", "8m", "9m", "red", "red", "south", "south"],
            2: ["1p", "2p", "3p", "4p", "5p", "6p", "7s", "8s", "9s", "green", "green", "west", "west"],
            3: ["2m", "3m", "4m", "5m", "6m", "7m", "7p", "8p", "9p", "white", "white", "north", "north"],
        },
        draws: ["east"],
        script: [
            { playerIndex: 0, phase: "RESOLVE", action: "hu", note: "After drawing east, Player 0 can Hu." },
        ],
    },
];
