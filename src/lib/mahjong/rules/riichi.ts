import { RuleStrategy, GameRules, Tile } from "../types";
import { ChineseStrategy } from "./chinese";

/**
 * Japanese Riichi Mahjong Rules
 * Key differences from Chinese:
 * - No flowers/seasons
 * - Red Dora (red 5s) 
 * - Riichi declaration mechanic
 * - Furiten rule (cannot win on tiles you've discarded)
 * - Yaku requirement (must have at least 1 yaku to win)
 */
export class RiichiStrategy extends ChineseStrategy implements RuleStrategy {
    getRules(): GameRules {
        return {
            region: "riichi",
            hasFlowers: false,
            hasSeasons: false,
            hasRedDora: true,
            handSize: 13,
        };
    }

    // Riichi-specific win check includes yaku validation
    canHu(hand: Tile[], discard: Tile | null, isSelfDraw: boolean): boolean {
        const fullHand = discard ? [...hand, discard] : hand;

        // First check basic win pattern
        if (!this.checkWin(fullHand)) return false;

        // Check for at least one yaku (simplified check)
        // In real Riichi, you need specific yaku patterns
        // For basic implementation, we'll allow if:
        // 1. Self-draw (Tsumo is a yaku)
        // 2. Has all triplets (Toitoi)
        // 3. Has all concealed (Menzen Tsumo)
        // 4. Has a dragon/wind triplet (Yakuhai)

        if (isSelfDraw) return true; // Tsumo is always valid

        // Check for Yakuhai (value tiles)
        const hasValueTile = fullHand.some(t =>
            t.suit === "dragon" ||
            (t.suit === "wind" && (t.rank === "east" || t.rank === "south"))
        );

        if (hasValueTile) return true;

        // Check for pure/mixed suit (simplified)
        const suits = new Set(fullHand.map(t => t.suit));
        const numberedSuits = [...suits].filter(s =>
            ["bamboo", "character", "dot"].includes(s)
        );
        if (numberedSuits.length === 1) return true; // Chinitsu/Honitsu

        return false; // No yaku found
    }
}
