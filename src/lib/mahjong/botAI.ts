import { Tile, GameState, Player } from "./types";

/**
 * Bot AI for Mahjong decisions
 * Improved with tenpai awareness and better heuristics
 */

// Count tiles by suit and rank
function countTiles(hand: Tile[]): Map<string, number> {
    const counts = new Map<string, number>();
    hand.forEach(t => {
        const key = `${t.suit}-${t.rank}`;
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
}

// Check if a tile is part of a pair or triplet
function getMatchCount(hand: Tile[], tile: Tile): number {
    return hand.filter(t => t.suit === tile.suit && t.rank === tile.rank).length;
}

// Check if a tile has adjacent tiles for sequences
function getSequencePotential(hand: Tile[], tile: Tile): number {
    if (typeof tile.rank !== "number") return 0;

    let potential = 0;
    const { suit, rank } = tile;

    // Left neighbor
    if (hand.some(t => t.suit === suit && t.rank === rank - 1)) potential += 2;
    // Right neighbor
    if (hand.some(t => t.suit === suit && t.rank === rank + 1)) potential += 2;
    // Left gap (for waiting)
    if (hand.some(t => t.suit === suit && t.rank === rank - 2)) potential += 1;
    // Right gap (for waiting)
    if (hand.some(t => t.suit === suit && t.rank === rank + 2)) potential += 1;

    return potential;
}

// Tile value scoring for discard decisions
function getTileValue(tile: Tile, hand: Tile[]): number {
    let score = 0;
    const { suit, rank } = tile;
    const matchCount = getMatchCount(hand, tile);

    // Pairs and triplets are very valuable
    if (matchCount >= 3) score += 100; // Already have triplet
    if (matchCount === 2) score += 50;  // Pair

    // For numbered suits, check for potential sequences
    if (typeof rank === "number") {
        const seqPotential = getSequencePotential(hand, tile);
        score += seqPotential * 10;

        // Terminal tiles (1 and 9) are less flexible
        if (rank === 1 || rank === 9) score -= 8;

        // Middle tiles are more flexible
        if (rank >= 3 && rank <= 7) score += 5;

        // Edge tiles (2 and 8) are slightly less flexible
        if (rank === 2 || rank === 8) score += 2;
    }

    // Honor tiles scoring
    if (suit === "wind" || suit === "dragon") {
        if (matchCount === 1) score -= 20; // Lone honor tile - very discardable
        if (matchCount === 2) score += 30; // Pair of honors - valuable
        if (matchCount >= 3) score += 80; // Triplet of honors - very valuable
    }

    // Dragons are generally more valuable than winds
    if (suit === "dragon") {
        score += 5;
    }

    return score;
}

// Count how many tiles away from tenpai (simplified)
function getTenpaiDistance(hand: Tile[]): number {
    const counts = countTiles(hand);
    let pairs = 0;
    let melds = 0;
    let partials = 0;

    for (const [key, count] of counts.entries()) {
        if (count >= 3) melds++;
        else if (count === 2) pairs++;
        else if (count === 1) {
            // Check if this single tile has neighbors
            const [suit, rankStr] = key.split("-");
            const rank = Number(rankStr);
            if (typeof rank === "number") {
                const hasLeft = counts.has(`${suit}-${rank - 1}`);
                const hasRight = counts.has(`${suit}-${rank + 1}`);
                if (hasLeft || hasRight) partials++;
            }
        }
    }

    // Need 4 melds + 1 pair = 5 groups
    // Each meld/pair counts as 1 group, partial sequences count as 0.5
    const groups = melds + pairs + partials * 0.5;
    return Math.max(0, 5 - groups);
}

/**
 * Choose the best tile to discard for a bot
 * Considers tenpai distance and tile value
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
 * Check if taking an action improves the hand
 */
function doesActionImproveHand(
    player: Player,
    action: "chi" | "peng" | "gang",
    discardTile: Tile
): boolean {
    const { hand, melds } = player;
    const currentDistance = getTenpaiDistance(hand);

    // Simulate the action
    let newHand = [...hand];
    let newMelds = [...melds];

    if (action === "peng") {
        // Remove 2 matching tiles from hand
        let removed = 0;
        newHand = hand.filter(t => {
            if (removed < 2 && t.suit === discardTile.suit && t.rank === discardTile.rank) {
                removed++;
                return false;
            }
            return true;
        });
        newMelds = [...newMelds, { type: "peng", tiles: [discardTile, discardTile, discardTile] }];
    } else if (action === "chi") {
        // For chi, we need to remove the two tiles that form the sequence
        // This is simplified - in reality we'd need to know which specific chi
        const rank = discardTile.rank as number;
        const suit = discardTile.suit;

        // Try to find the matching tiles
        const needed = [rank - 2, rank - 1, rank, rank + 1, rank + 2]
            .filter(r => r >= 1 && r <= 9 && r !== rank);

        // Remove first two matching tiles
        let removed = 0;
        newHand = hand.filter(t => {
            if (removed < 2 && t.suit === suit && needed.includes(t.rank as number)) {
                removed++;
                return false;
            }
            return true;
        });
    } else if (action === "gang") {
        // Remove 3 matching tiles from hand
        let removed = 0;
        newHand = hand.filter(t => {
            if (removed < 3 && t.suit === discardTile.suit && t.rank === discardTile.rank) {
                removed++;
                return false;
            }
            return true;
        });
    }

    const newDistance = getTenpaiDistance(newHand);
    return newDistance < currentDistance;
}

/**
 * Decide what action a bot should take when given options
 * Smarter decisions based on hand improvement and game state
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

    // Gang is always valuable - take it
    if (availableActions.gang) {
        return "gang";
    }

    // Peng decision - take if it improves hand or we're close to winning
    if (availableActions.peng) {
        const meldCount = player.melds.length;
        const handTiles = hand.length;

        // If we have 3+ melds already, another peng gets us very close to winning
        if (meldCount >= 3) {
            return "peng";
        }

        // Take peng if it improves hand (reduces tenpai distance)
        if (doesActionImproveHand(player, "peng", lastDiscard)) {
            return "peng";
        }

        // Peng valuable tiles (dragons and winds)
        if (lastDiscard.suit === "dragon" || lastDiscard.suit === "wind") {
            // Only if we have a pair already
            const matchCount = getMatchCount(hand, lastDiscard);
            if (matchCount >= 2) {
                return "peng";
            }
        }

        // If close to tenpai (1-2 groups away), be more aggressive
        const tenpaiDist = getTenpaiDistance(hand);
        if (tenpaiDist <= 2) {
            return "peng";
        }
    }

    // Chi decision - take if it significantly improves hand
    if (availableActions.chi) {
        const meldCount = player.melds.length;

        // Chi more often when close to winning
        if (meldCount >= 3) {
            return "chi";
        }

        // Take chi if it improves hand
        if (doesActionImproveHand(player, "chi", lastDiscard)) {
            return "chi";
        }

        // If close to tenpai, be more aggressive with chi
        const tenpaiDist = getTenpaiDistance(hand);
        if (tenpaiDist <= 2) {
            return "chi";
        }
    }

    return "pass";
}
