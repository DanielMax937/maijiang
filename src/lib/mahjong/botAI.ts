import { Tile, GameState, Player } from "./types";
import { getStrategy } from "./rules";

/**
 * Bot AI for Mahjong decisions
 */

// Tile value scoring for discard decisions
function getTileValue(tile: Tile, hand: Tile[]): number {
    let score = 0;
    const { suit, rank } = tile;

    // Count matching tiles in hand
    const matchCount = hand.filter(t => t.suit === suit && t.rank === rank).length;

    // Pairs and triplets are valuable
    if (matchCount >= 3) score += 100; // Already have triplet
    if (matchCount === 2) score += 50;  // Pair

    // For numbered suits, check for potential sequences
    if (typeof rank === "number") {
        const hasNeighbor = (offset: number) =>
            hand.some(t => t.suit === suit && t.rank === rank + offset);

        // Check for adjacent tiles (potential chow)
        if (hasNeighbor(-1)) score += 20;
        if (hasNeighbor(1)) score += 20;
        if (hasNeighbor(-2)) score += 10;
        if (hasNeighbor(2)) score += 10;

        // Terminal tiles (1 and 9) are less flexible
        if (rank === 1 || rank === 9) score -= 5;

        // Middle tiles are more flexible
        if (rank >= 3 && rank <= 7) score += 5;
    }

    // Honor tiles without pairs are less useful
    if (suit === "wind" || suit === "dragon") {
        if (matchCount === 1) score -= 15;
    }

    return score;
}

/**
 * Choose the best tile to discard for a bot
 */
export function chooseBotDiscard(hand: Tile[]): string {
    if (hand.length === 0) return "";

    // Calculate value for each tile
    const tileValues = hand.map(tile => ({
        tile,
        value: getTileValue(tile, hand)
    }));

    // Sort by value (lowest first - we want to discard the least valuable)
    tileValues.sort((a, b) => a.value - b.value);

    // Return the ID of the least valuable tile
    return tileValues[0].tile.id;
}

/**
 * Decide what action a bot should take when given options
 */
export function decideBotAction(
    gameState: GameState,
    playerIndex: number,
    availableActions: { chi: boolean; peng: boolean; gang: boolean; hu: boolean }
): "chi" | "peng" | "gang" | "hu" | "pass" {
    const player = gameState.players[playerIndex];
    const hand = player.hand;
    const lastDiscard = gameState.lastDiscard;

    if (!lastDiscard) return "pass";

    // Always Hu if possible!
    if (availableActions.hu) {
        return "hu";
    }

    // Gang is valuable - open gang from discard
    if (availableActions.gang) {
        // Generally take Gang for points
        return "gang";
    }

    // Peng decision - take if we're close to winning or it's a good tile
    if (availableActions.peng) {
        // Calculate if peng is beneficial
        // Simple heuristic: peng if we have few tiles left (closer to tenpai)
        const meldCount = player.melds.length;
        const handTiles = hand.length;

        // If we have 3+ melds already, another peng gets us very close
        if (meldCount >= 2) {
            return "peng";
        }

        // Peng valuable tiles (dragons and winds for yakuman potential)
        if (lastDiscard.suit === "dragon" || lastDiscard.suit === "wind") {
            return "peng";
        }

        // 50% chance to peng other tiles (adds variety)
        if (Math.random() > 0.5) {
            return "peng";
        }
    }

    // Chi decision - usually less urgent than peng
    if (availableActions.chi) {
        const meldCount = player.melds.length;

        // Chi more often when close to winning
        if (meldCount >= 2) {
            return "chi";
        }

        // 30% chance to chi normally
        if (Math.random() > 0.7) {
            return "chi";
        }
    }

    return "pass";
}
