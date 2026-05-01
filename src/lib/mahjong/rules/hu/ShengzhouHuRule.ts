import { HuRule, GameContext, HuResult, Tile } from "../../types";

/**
 * 嵊州麻将胡牌规则
 * - 支持财神（百搭）替代任意牌
 * - 支持推倒胡、七对子
 * - 财神可代替任何牌组成顺子、刻子、对子
 */
export class ShengzhouHuRule implements HuRule {
    canHu(ctx: GameContext): HuResult {
        const fullHand = ctx.discard ? [...ctx.hand, ctx.discard] : ctx.hand;
        const success = this.checkWinWithCaishen(fullHand, ctx.caishenTile);
        if (!success) return { success: false, patterns: [] };

        const patterns: string[] = ["standard"];
        if (ctx.isSelfDraw) patterns.push("zimo");
        if (ctx.isGangDraw) patterns.push("gangkai");
        if (this.checkSevenPairsWithCaishen(fullHand, ctx.caishenTile)) patterns.push("qiduizi");

        // Check for 碰碰和 (all triplets + pair)
        if (this.checkPengPengHu(fullHand, ctx.melds, ctx.caishenTile)) patterns.push("pengpenghu");

        // Check 清一色
        const allTiles = [...fullHand, ...ctx.melds.flatMap(m => m.tiles)];
        if (this.checkQingYiSe(allTiles, ctx.caishenTile)) patterns.push("qingyise");

        // Check if caishen is used in winning hand
        if (ctx.caishenTile && this.hasCaishenInHand(fullHand, ctx.caishenTile)) {
            patterns.push("cainio");
        }

        return { success: true, patterns };
    }

    checkWin(hand: Tile[]): boolean {
        return this.checkWinWithCaishen(hand, undefined);
    }

    private isCaishen(tile: Tile, caishenTile?: Tile): boolean {
        if (!caishenTile) return false;
        return tile.suit === caishenTile.suit && tile.rank === caishenTile.rank;
    }

    private hasCaishenInHand(hand: Tile[], caishenTile?: Tile): boolean {
        if (!caishenTile) return false;
        return hand.some(t => this.isCaishen(t, caishenTile));
    }

    checkWinWithCaishen(hand: Tile[], caishenTile?: Tile): boolean {
        if (hand.length % 3 !== 2) return false;

        // Count caishen tiles (wildcards)
        const caishenCount = caishenTile
            ? hand.filter(t => this.isCaishen(t, caishenTile)).length
            : 0;

        // Non-caishen tiles
        const normalTiles = caishenTile
            ? hand.filter(t => !this.isCaishen(t, caishenTile))
            : hand;

        // Try standard win with wildcards
        if (this.canFormWinningHand(normalTiles, caishenCount)) return true;

        // Try seven pairs
        if (hand.length === 14 && this.checkSevenPairsWithCaishen(hand, caishenTile)) return true;

        return false;
    }

    private canFormWinningHand(normalTiles: Tile[], wildcards: number): boolean {
        const countMap = new Map<string, number>();
        normalTiles.forEach(t => {
            const key = `${t.suit}-${t.rank}`;
            countMap.set(key, (countMap.get(key) || 0) + 1);
        });

        const totalTiles = normalTiles.length + wildcards;
        if (totalTiles % 3 !== 2) return false;
        const targetMelds = (totalTiles - 2) / 3;

        // Try each possible pair
        const allKeys = this.getAllTileKeys();
        for (const pairKey of allKeys) {
            const pairCount = countMap.get(pairKey) || 0;
            let pairWildcardsNeeded = Math.max(0, 2 - pairCount);
            if (pairWildcardsNeeded > wildcards) continue;
            if (pairCount === 0 && pairWildcardsNeeded === 0) continue;

            // Use tiles for pair
            const mapCopy = new Map(countMap);
            const actualPairTaken = Math.min(pairCount, 2);
            mapCopy.set(pairKey, pairCount - actualPairTaken);
            const remainingWildcards = wildcards - pairWildcardsNeeded;

            if (this.canFormMelds(mapCopy, remainingWildcards, targetMelds)) {
                return true;
            }
        }

        return false;
    }

    private canFormMelds(countMap: Map<string, number>, wildcards: number, targetMelds: number): boolean {
        if (targetMelds === 0) {
            // All remaining counts should be 0
            for (const count of countMap.values()) {
                if (count < 0) return false;
            }
            const remaining = Array.from(countMap.values()).reduce((sum, c) => sum + Math.max(0, c), 0);
            return remaining === 0 && wildcards >= 0;
        }

        // Find first non-zero key
        let firstKey = "";
        for (const [key, count] of countMap.entries()) {
            if (count > 0) { firstKey = key; break; }
        }

        if (!firstKey) {
            // All normal tiles used, need wildcards to fill remaining melds
            return wildcards >= targetMelds * 3;
        }

        const [suit, rankStr] = firstKey.split("-");
        const rank = isNaN(Number(rankStr)) ? rankStr : Number(rankStr);
        const count = countMap.get(firstKey) || 0;

        // Try Pong (AAA) - use up to 3 tiles, fill rest with wildcards
        for (let fromHand = Math.min(count, 3); fromHand >= 1; fromHand--) {
            const needed = 3 - fromHand;
            if (needed <= wildcards) {
                const mapCopy = new Map(countMap);
                mapCopy.set(firstKey, count - fromHand);
                if (this.canFormMelds(mapCopy, wildcards - needed, targetMelds - 1)) {
                    return true;
                }
            }
        }

        // Try Chow (ABC) - only for numbered suits
        if (typeof rank === "number" && ["bamboo", "character", "dot"].includes(suit)) {
            // Try sequences starting at this rank
            if (rank <= 7) {
                const key1 = firstKey;
                const key2 = `${suit}-${rank + 1}`;
                const key3 = `${suit}-${rank + 2}`;

                const c1 = countMap.get(key1) || 0;
                const c2 = countMap.get(key2) || 0;
                const c3 = countMap.get(key3) || 0;

                // How many wildcards needed to complete the sequence
                let wildsNeeded = 0;
                if (c1 <= 0) wildsNeeded++;
                if (c2 <= 0) wildsNeeded++;
                if (c3 <= 0) wildsNeeded++;

                if (wildsNeeded <= wildcards && c1 > 0) {
                    const mapCopy = new Map(countMap);
                    mapCopy.set(key1, c1 - 1);
                    if (c2 > 0) mapCopy.set(key2, c2 - 1);
                    if (c3 > 0) mapCopy.set(key3, c3 - 1);
                    if (this.canFormMelds(mapCopy, wildcards - wildsNeeded, targetMelds - 1)) {
                        return true;
                    }
                }
            }
        }

        // Try using wildcard as entire meld fill (3 wildcards for any meld)
        if (wildcards >= 3) {
            if (this.canFormMelds(countMap, wildcards - 3, targetMelds - 1)) {
                return true;
            }
        }

        return false;
    }

    private getAllTileKeys(): string[] {
        const keys: string[] = [];
        for (const suit of ["bamboo", "character", "dot"]) {
            for (let rank = 1; rank <= 9; rank++) {
                keys.push(`${suit}-${rank}`);
            }
        }
        for (const rank of ["east", "south", "west", "north"]) {
            keys.push(`wind-${rank}`);
        }
        for (const rank of ["red", "green", "white"]) {
            keys.push(`dragon-${rank}`);
        }
        return keys;
    }

    private checkSevenPairsWithCaishen(hand: Tile[], caishenTile?: Tile): boolean {
        if (hand.length !== 14) return false;

        const caishenCount = caishenTile
            ? hand.filter(t => this.isCaishen(t, caishenTile)).length
            : 0;

        const normalTiles = caishenTile
            ? hand.filter(t => !this.isCaishen(t, caishenTile))
            : hand;

        const countMap = new Map<string, number>();
        normalTiles.forEach(t => {
            const key = `${t.suit}-${t.rank}`;
            countMap.set(key, (countMap.get(key) || 0) + 1);
        });

        // Count how many wildcards needed to form 7 pairs
        let wildcardsNeeded = 0;
        for (const count of countMap.values()) {
            // Odd counts need 1 wildcard to pair
            wildcardsNeeded += count % 2;
        }

        return wildcardsNeeded <= caishenCount;
    }

    private checkPengPengHu(hand: Tile[], melds: { type: string; tiles: Tile[] }[], caishenTile?: Tile): boolean {
        // All melds must be peng or gang
        const meldOk = melds.every(m => m.type === "peng" || m.type === "gang");
        if (!meldOk && melds.length > 0) return false;

        // Hand (remaining tiles) must form only triplets + 1 pair, using caishen as wildcards
        const caishenCount = caishenTile
            ? hand.filter(t => this.isCaishen(t, caishenTile)).length
            : 0;

        const normalTiles = caishenTile
            ? hand.filter(t => !this.isCaishen(t, caishenTile))
            : hand;

        const countMap = new Map<string, number>();
        normalTiles.forEach(t => {
            const key = `${t.suit}-${t.rank}`;
            countMap.set(key, (countMap.get(key) || 0) + 1);
        });

        // Check: each group should be 3 (triplet) or part of pair (2)
        // With wildcards filling in
        let wildsLeft = caishenCount;
        let pairFound = false;

        const counts = [...countMap.values()].sort((a, b) => b - a);
        for (const count of counts) {
            let remaining = count;
            while (remaining > 0) {
                if (remaining >= 3) {
                    remaining -= 3;
                } else if (remaining === 2) {
                    if (!pairFound) {
                        pairFound = true;
                        remaining = 0;
                    } else {
                        // Need 1 wildcard to make triplet
                        if (wildsLeft >= 1) {
                            wildsLeft--;
                            remaining = 0;
                        } else {
                            return false;
                        }
                    }
                } else { // remaining === 1
                    // Need 2 wildcards for triplet, or use as pair if not found
                    if (!pairFound && wildsLeft >= 1) {
                        pairFound = true;
                        wildsLeft--;
                        remaining = 0;
                    } else if (wildsLeft >= 2) {
                        wildsLeft -= 2;
                        remaining = 0;
                    } else {
                        return false;
                    }
                }
            }
        }

        // Remaining wildcards form triplets (groups of 3)
        while (wildsLeft >= 3) wildsLeft -= 3;
        if (wildsLeft === 2) {
            if (!pairFound) { pairFound = true; wildsLeft = 0; }
            else return false;
        }
        if (wildsLeft === 1) {
            return false;
        }

        return pairFound;
    }

    private checkQingYiSe(allTiles: Tile[], caishenTile?: Tile): boolean {
        const nonCaishen = caishenTile
            ? allTiles.filter(t => !this.isCaishen(t, caishenTile))
            : allTiles;

        if (nonCaishen.length === 0) return true;

        const suits = new Set(nonCaishen.map(t => t.suit));
        if (suits.size !== 1) return false;
        return ["bamboo", "character", "dot"].includes([...suits][0]);
    }

    getTenpaiTiles(hand: Tile[], caishenTile?: Tile): Tile[] {
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
            if (this.checkWinWithCaishen([...hand, testTile], caishenTile)) {
                tenpaiTiles.push(testTile);
            }
        }

        return tenpaiTiles;
    }
}
