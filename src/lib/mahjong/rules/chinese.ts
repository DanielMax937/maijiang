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
        if (hand.length !== 14) return false;

        // Helper to count tiles
        const countMap = new Map<string, number>();
        hand.forEach(t => {
            const key = `${t.suit}-${t.rank}`;
            countMap.set(key, (countMap.get(key) || 0) + 1);
        });

        // Recursive checker (same as original implementation)
        const canFormMelds = (map: Map<string, number>, meldCount: number): boolean => {
            if (meldCount === 4) return true;

            let firstKey = "";
            for (const [key, count] of map.entries()) {
                if (count > 0) {
                    firstKey = key;
                    break;
                }
            }
            if (!firstKey) return true;

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
}
