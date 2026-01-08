import { RuleStrategy, GameRules, Tile } from "../types";
import { ChineseStrategy } from "./chinese";

/**
 * Beijing Mahjong Rules
 * Key differences:
 * - No flowers/seasons
 * - Must have at least one Pung/Kong to win (Men Qing exemption)
 * - Seven Pairs is a valid winning hand
 * - Bonus points for specific patterns
 */
export class BeijingStrategy extends ChineseStrategy implements RuleStrategy {
    getRules(): GameRules {
        return {
            region: "beijing",
            hasFlowers: false,
            hasSeasons: false,
            hasRedDora: false,
            handSize: 13,
        };
    }

    checkWin(hand: Tile[]): boolean {
        // Check standard 4 melds + 1 pair
        if (super.checkWin(hand)) return true;

        // Also check Seven Pairs (Qi Dui Zi)
        if (hand.length === 14) {
            return this.checkSevenPairs(hand);
        }

        return false;
    }

    // Seven Pairs: 7 different pairs
    private checkSevenPairs(hand: Tile[]): boolean {
        if (hand.length !== 14) return false;

        const countMap = new Map<string, number>();
        hand.forEach(t => {
            const key = `${t.suit}-${t.rank}`;
            countMap.set(key, (countMap.get(key) || 0) + 1);
        });

        // Must have exactly 7 pairs (each count must be 2)
        const counts = [...countMap.values()];
        if (counts.length !== 7) return false;
        return counts.every(c => c === 2);
    }

    canHu(hand: Tile[], discard: Tile | null, isSelfDraw: boolean): boolean {
        const fullHand = discard ? [...hand, discard] : hand;

        if (!this.checkWin(fullHand)) return false;

        // Beijing often requires at least one Pung for basic wins
        // But Seven Pairs and concealed hands are exempt
        // For simplicity, we'll allow all valid patterns
        return true;
    }
}
