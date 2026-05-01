import { HuRule, GameContext, HuResult, Tile } from "../../types";

export class StandardHuRule implements HuRule {
    canHu(ctx: GameContext): HuResult {
        const fullHand = ctx.discard ? [...ctx.hand, ctx.discard] : ctx.hand;
        const success = this.checkWin(fullHand);
        return { success, patterns: success ? ["standard"] : [] };
    }

    checkWin(hand: Tile[]): boolean {
        if (hand.length % 3 !== 2) return false;

        const countMap = new Map<string, number>();
        hand.forEach(t => {
            const key = `${t.suit}-${t.rank}`;
            countMap.set(key, (countMap.get(key) || 0) + 1);
        });

        const targetMelds = (hand.length - 2) / 3;

        const canFormMelds = (map: Map<string, number>, meldCount: number): boolean => {
            if (meldCount === targetMelds) {
                let pairFound = false;
                for (const count of map.values()) {
                    if (count === 2) pairFound = true;
                    else if (count !== 0) return false;
                }
                return pairFound;
            }

            let firstKey = "";
            for (const [key, count] of map.entries()) {
                if (count > 0) { firstKey = key; break; }
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
                    map.set(key1, map.get(key1)! + 1);
                    map.set(key2, map.get(key2)! + 1);
                    map.set(key3, map.get(key3)! + 1);
                }
            }

            return false;
        };

        const uniqueKeys = Array.from(countMap.keys());
        for (const key of uniqueKeys) {
            if ((countMap.get(key) || 0) >= 2) {
                countMap.set(key, countMap.get(key)! - 2);
                if (canFormMelds(countMap, 0)) return true;
                countMap.set(key, countMap.get(key)! + 2);
            }
        }

        return false;
    }

    getTenpaiTiles(hand: Tile[]): Tile[] {
        const allTileTypes: { suit: Tile["suit"]; rank: Tile["rank"] }[] = [];

        for (const suit of ["bamboo", "character", "dot"] as const) {
            for (let rank = 1; rank <= 9; rank++) {
                allTileTypes.push({ suit, rank: rank as Tile["rank"] });
            }
        }
        for (const rank of ["east", "south", "west", "north"] as const) {
            allTileTypes.push({ suit: "wind", rank });
        }
        for (const rank of ["red", "green", "white"] as const) {
            allTileTypes.push({ suit: "dragon", rank });
        }

        const tenpaiTiles: Tile[] = [];
        let tileIdCounter = 0;

        for (const tileType of allTileTypes) {
            const testTile: Tile = {
                id: `tenpai-test-${tileIdCounter++}`,
                suit: tileType.suit,
                rank: tileType.rank,
            };
            if (this.checkWin([...hand, testTile])) {
                tenpaiTiles.push(testTile);
            }
        }

        return tenpaiTiles;
    }
}
