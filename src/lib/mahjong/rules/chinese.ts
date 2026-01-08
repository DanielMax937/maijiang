import { RuleStrategy, GameRules, Tile } from "../types";

export class ChineseStrategy implements RuleStrategy {
    getRules(): GameRules {
        return {
            region: "chinese",
            hasFlowers: true,
            hasSeasons: true,
            hasRedDora: false,
            handSize: 13,
        };
    }

    checkWin(hand: Tile[]): boolean {
        // Standardize hand length check (14 tiles for standard win)
        // If hand has melds, we need to account for them. 
        // For now, assuming checkWin is called with a full 14-tile array (hand + melds or just hand if no melds)
        // But wait, the current checkWin implementation expects 14 tiles. 
        // If we have melds, the "hand" passed here might be smaller.
        // Let's assume for this implementation that we are only checking the "standing hand" + new tile, 
        // and we treat melds as already "completed" sets.
        // BUT, the recursive algorithm needs ALL tiles to verify 4 sets + 1 pair.
        // If we only pass hidden tiles, we need to know how many sets to find.
        // Given the current simple implementation of checkWin (expecting 14), 
        // we will assume for now that we are checking a "pure" hand or we construct a full 14-tile hand for the check.

        if (hand.length % 3 !== 2) return false; // Must be 2, 5, 8, 11, 14

        // Helper to count tiles
        const countMap = new Map<string, number>();
        hand.forEach(t => {
            const key = `${t.suit}-${t.rank}`;
            countMap.set(key, (countMap.get(key) || 0) + 1);
        });

        // Calculate how many melds we need to find based on hand size
        // 14 tiles = 4 melds + 1 pair
        // 11 tiles = 3 melds + 1 pair
        // 8 tiles = 2 melds + 1 pair
        // 5 tiles = 1 meld + 1 pair
        // 2 tiles = 0 melds + 1 pair
        const targetMelds = (hand.length - 2) / 3;

        // Recursive checker
        const canFormMelds = (map: Map<string, number>, meldCount: number): boolean => {
            if (meldCount === targetMelds) {
                // Check if remaining tiles form a pair
                let pairFound = false;
                for (const count of map.values()) {
                    if (count === 2) {
                        pairFound = true;
                    } else if (count !== 0) {
                        return false;
                    }
                }
                return pairFound;
            }

            let firstKey = "";
            for (const [key, count] of map.entries()) {
                if (count > 0) {
                    firstKey = key;
                    break;
                }
            }
            if (!firstKey) return true; // Should not happen if math is right

            const [suit, rankStr] = firstKey.split("-");
            const rank = isNaN(Number(rankStr)) ? rankStr : Number(rankStr);

            // Try Pong (AAA)
            if ((map.get(firstKey) || 0) >= 3) {
                map.set(firstKey, map.get(firstKey)! - 3);
                if (canFormMelds(map, meldCount + 1)) return true;
                map.set(firstKey, map.get(firstKey)! + 3);
            }

            // Try Chow (ABC) - only for numbered suits
            if (typeof rank === "number" && rank <= 7) {
                const key1 = `${suit}-${rank}`;
                const key2 = `${suit}-${rank + 1}`;
                const key3 = `${suit}-${rank + 2}`;

                if ((map.get(key1) || 0) > 0 && (map.get(key2) || 0) > 0 && (map.get(key3) || 0) > 0) {
                    map.set(key1, map.get(key1)! - 1);
                    map.set(key2, map.get(key2)! - 1);
                    map.set(key3, map.get(key3)! - 1);

                    if (canFormMelds(map, meldCount + 1)) return true;

                    // Backtrack
                    map.set(key1, map.get(key1)! + 1);
                    map.set(key2, map.get(key2)! + 1);
                    map.set(key3, map.get(key3)! + 1);
                }
            }

            return false;
        };

        // We need to find the pair FIRST or LAST?
        // The original implementation tried to find pair first. Let's stick to that for consistency/performance.
        // Iterate over all possible pairs
        const uniqueKeys = Array.from(countMap.keys());

        for (const key of uniqueKeys) {
            if ((countMap.get(key) || 0) >= 2) {
                // Remove pair
                countMap.set(key, countMap.get(key)! - 2);

                if (canFormMelds(countMap, 0)) return true;

                // Backtrack pair
                countMap.set(key, countMap.get(key)! + 2);
            }
        }

        return false;
    }

    canChi(hand: Tile[], discard: Tile): boolean {
        // Chi is only for numbered suits
        if (typeof discard.rank !== "number") return false;

        const suit = discard.suit;
        const rank = discard.rank;

        // Check for potential sequences:
        // 1. discard is 3rd: need (rank-2, rank-1)
        // 2. discard is 2nd: need (rank-1, rank+1)
        // 3. discard is 1st: need (rank+1, rank+2)

        const hasTile = (r: number) => hand.some(t => t.suit === suit && t.rank === r);

        // Case 1: (rank-2, rank-1, discard)
        if (hasTile(rank - 2) && hasTile(rank - 1)) return true;

        // Case 2: (rank-1, discard, rank+1)
        if (hasTile(rank - 1) && hasTile(rank + 1)) return true;

        // Case 3: (discard, rank+1, rank+2)
        if (hasTile(rank + 1) && hasTile(rank + 2)) return true;

        return false;
    }

    canPeng(hand: Tile[], discard: Tile): boolean {
        // Need 2 matching tiles in hand
        const count = hand.filter(t => t.suit === discard.suit && t.rank === discard.rank).length;
        return count >= 2;
    }

    canGang(hand: Tile[], discard: Tile | null, isSelfDraw: boolean): boolean {
        if (isSelfDraw) {
            // An Gang: Need 4 matching tiles in hand
            // We need to check if ANY tile has 4 copies
            const countMap = new Map<string, number>();
            hand.forEach(t => {
                const key = `${t.suit}-${t.rank}`;
                countMap.set(key, (countMap.get(key) || 0) + 1);
            });
            for (const count of countMap.values()) {
                if (count === 4) return true;
            }
            return false;
        } else {
            // Ming Gang: Need 3 matching tiles in hand for the discard
            if (!discard) return false;
            const count = hand.filter(t => t.suit === discard.suit && t.rank === discard.rank).length;
            return count >= 3;
        }
    }

    canHu(hand: Tile[], discard: Tile | null, isSelfDraw: boolean): boolean {
        if (isSelfDraw) {
            return this.checkWin(hand);
        } else {
            if (!discard) return false;
            // Construct a temporary hand with the discard
            const tempHand = [...hand, discard];
            return this.checkWin(tempHand);
        }
    }
}
