import { Tile, Player, Meld, GameRules } from "./types";

/**
 * Score calculation for Mahjong hands
 * This is a simplified scoring system
 */

interface ScoreResult {
    base: number;
    fan: number;
    total: number;
    breakdown: string[];
}

// Calculate basic hand score
export function calculateScore(
    player: Player,
    isSelfDraw: boolean,
    rules: GameRules
): ScoreResult {
    const hand = player.hand;
    const melds = player.melds;
    const breakdown: string[] = [];
    let fan = 0;

    // Base score
    const base = 8; // Minimum base points

    // Self-draw bonus
    if (isSelfDraw) {
        fan += 1;
        breakdown.push("Self-Draw (Zi Mo): +1 fan");
    }

    // All concealed hand (no exposed melds claimed from others)
    if (melds.length === 0) {
        fan += 2;
        breakdown.push("Concealed Hand (Men Qing): +2 fan");
    }

    // Check for all triplets (Peng Peng Hu)
    const allPong = melds.every(m => m.type === "peng" || m.type === "gang");
    if (allPong && melds.length >= 3) {
        fan += 2;
        breakdown.push("All Pungs (Peng Peng Hu): +2 fan");
    }

    // Check for all one suit (Qing Yi Se)
    const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
    const suits = new Set(allTiles.map(t => t.suit));
    if (suits.size === 1 && !["wind", "dragon", "flower", "season"].includes([...suits][0])) {
        fan += 6;
        breakdown.push("Pure One Suit (Qing Yi Se): +6 fan");
    }

    // Mixed one suit (Hun Yi Se) - one suit + honors
    const numberedSuits = [...suits].filter(s => ["bamboo", "character", "dot"].includes(s));
    const hasHonors = suits.has("wind") || suits.has("dragon");
    if (numberedSuits.length === 1 && hasHonors && suits.size === 2) {
        fan += 3;
        breakdown.push("Mixed One Suit (Hun Yi Se): +3 fan");
    }

    // All honors (Zi Yi Se)
    if (suits.size >= 1 && [...suits].every(s => s === "wind" || s === "dragon")) {
        fan += 8;
        breakdown.push("All Honors (Zi Yi Se): +8 fan");
    }

    // Count dragons for dragon-based scoring
    const dragonMelds = melds.filter(m => m.tiles[0]?.suit === "dragon");
    if (dragonMelds.length === 3) {
        fan += 13; // Yakuman-level
        breakdown.push("Big Three Dragons (Da San Yuan): +13 fan");
    } else if (dragonMelds.length >= 1) {
        fan += dragonMelds.length;
        breakdown.push(`Dragon Pungs: +${dragonMelds.length} fan`);
    }

    // Kong bonus
    const kongCount = melds.filter(m => m.type === "gang").length;
    if (kongCount > 0) {
        fan += kongCount;
        breakdown.push(`Kong(s): +${kongCount} fan`);
    }

    // Calculate total
    // Simplified: total = base * 2^fan
    const total = base * Math.pow(2, Math.min(fan, 10)); // Cap at 10 fan

    return {
        base,
        fan,
        total: Math.round(total),
        breakdown
    };
}

// Apply score changes to players
export function applyScoreChanges(
    players: Player[],
    winnerIndex: number,
    loserIndex: number | null, // null for self-draw (all pay)
    score: number
): Player[] {
    const newPlayers = players.map(p => ({ ...p }));

    if (loserIndex !== null) {
        // Ron/Hu from discard - only discarder pays
        newPlayers[winnerIndex].score += score;
        newPlayers[loserIndex].score -= score;
    } else {
        // Self-draw (Tsumo) - all other players pay
        const perPlayer = Math.floor(score / 3);
        newPlayers.forEach((p, i) => {
            if (i === winnerIndex) {
                p.score += score;
            } else {
                p.score -= perPlayer;
            }
        });
    }

    return newPlayers;
}
