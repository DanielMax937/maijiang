import { RuleStrategy, GameRules, Tile } from "../types";
import { ChineseStrategy } from "./chinese";

/**
 * Sichuan Bloody Mahjong Rules
 * Key differences:
 * - Only 3 suits (no winds or dragons)
 * - Must "Que Men" (lack one suit) to win
 * - "Bloody" variant: game continues after first Hu until only one player remains
 * - No Chi allowed (only Peng and Gang)
 */
export class SichuanStrategy extends ChineseStrategy implements RuleStrategy {
    getRules(): GameRules {
        return {
            region: "sichuan",
            hasFlowers: false,
            hasSeasons: false,
            hasRedDora: false,
            handSize: 13,
        };
    }

    // Sichuan: No Chi allowed
    canChi(hand: Tile[], discard: Tile): boolean {
        return false; // Chi is not allowed in Sichuan Mahjong
    }

    // Sichuan win: Must be missing one of the three numbered suits (Que Men)
    checkWin(hand: Tile[]): boolean {
        if (!super.checkWin(hand)) return false;

        // Check Que Men: hand must only have 2 of the 3 numbered suits
        const suits = new Set(hand.map(t => t.suit));
        const numberedSuits = [...suits].filter(s =>
            ["bamboo", "character", "dot"].includes(s)
        );

        // Must have exactly 1 or 2 numbered suits (missing at least one)
        if (numberedSuits.length > 2) return false;

        // Cannot have winds or dragons (Sichuan uses only numbered tiles)
        if (suits.has("wind") || suits.has("dragon")) return false;

        return true;
    }

    canHu(hand: Tile[], discard: Tile | null, isSelfDraw: boolean): boolean {
        const fullHand = discard ? [...hand, discard] : hand;
        return this.checkWin(fullHand);
    }
}
