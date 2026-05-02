import { HuRule, GameContext, HuResult, Tile } from "../../types";

/**
 * 嵊州麻将胡牌规则
 * - 支持财神（百搭）替代任意牌
 * - 财神可代替任何牌组成顺子、刻子、对子
 * - 支持财鸟/飞鸟/抢杠检测
 * - 有财神或存在承包关系时，不能点炮胡（自摸/杠开/抢杠仍可以）
 */
export class ShengzhouHuRule implements HuRule {
    canHu(ctx: GameContext): HuResult {
        const fullHand = ctx.discard ? [...ctx.hand, ctx.discard] : ctx.hand;
        const success = this.checkWinWithCaishen(fullHand, ctx.caishenTile);
        if (!success) return { success: false, patterns: [] };

        // 点炮限制: 有财神、存在承包关系、或永久失去点炮资格时，不能点炮胡
        if (!ctx.isSelfDraw && !ctx.isGangDraw && !ctx.isQiangGang && ctx.discard) {
            // 有财神不能点炮
            if (ctx.caishenTile && this.hasCaishenInHand(ctx.hand, ctx.caishenTile)) {
                return { success: false, patterns: [] };
            }
            // 存在承包关系不能点炮
            if (this.hasLiability(ctx)) {
                return { success: false, patterns: [] };
            }
            // 永久失去点炮资格（打出财神一圈后没胡）
            if (ctx.lostDianPao?.[ctx.playerIndex]) {
                return { success: false, patterns: [] };
            }
        }

        const patterns: string[] = ["standard"];
        if (ctx.isSelfDraw) patterns.push("zimo");
        if (ctx.isGangDraw) patterns.push("gangkai");
        if (ctx.isQiangGang) patterns.push("qianggang");

        // Check 财鸟/飞鸟 - 手牌中连续财神数决定等级
        if (ctx.caishenTile && this.hasCaishenInHand(ctx.hand, ctx.caishenTile)) {
            const consecutiveCount = this.getMaxConsecutiveCaishen(ctx.hand, ctx.caishenTile);
            if (consecutiveCount >= 2) {
                patterns.push("feiniao"); // 2+ consecutive = 飞鸟
            } else if (consecutiveCount === 1) {
                patterns.push("cainio"); // 1 caishen = 财鸟
            }
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

    // 承包检查: 玩家与出牌者之间是否存在承包关系（互相吃/碰3次以上）
    private hasLiability(ctx: GameContext): boolean {
        if (!ctx.liabilityCount || ctx.discard === undefined) return false;
        const player = ctx.playerIndex;
        const discarder = ctx.currentTurn;
        // 我对出牌者的吃碰次数
        const myClaims = ctx.liabilityCount[player]?.[discarder] || 0;
        // 出牌者对我的吃碰次数
        const theirClaims = ctx.liabilityCount[discarder]?.[player] || 0;
        return myClaims >= 3 || theirClaims >= 3;
    }

    // 检测手牌中最长连续财神数
    private getMaxConsecutiveCaishen(hand: Tile[], caishenTile?: Tile): number {
        if (!caishenTile || hand.length === 0) return 0;
        const sorted = [...hand].sort((a, b) => {
            if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
            if (typeof a.rank === "number" && typeof b.rank === "number") return a.rank - b.rank;
            return String(a.rank).localeCompare(String(b.rank));
        });
        let maxConsecutive = 0;
        let currentConsecutive = 0;
        for (const tile of sorted) {
            if (tile.suit === caishenTile.suit && tile.rank === caishenTile.rank) {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 0;
            }
        }
        return maxConsecutive;
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

        // Try standard win (4 melds + 1 pair) with wildcards
        return this.canFormWinningHand(normalTiles, caishenCount);
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

        // Find first non-zero key in sorted order (ensures deterministic behavior regardless of Map insertion order)
        let firstKey = "";
        const sortedKeys = [...countMap.keys()].sort();
        for (const key of sortedKeys) {
            if ((countMap.get(key) || 0) > 0) { firstKey = key; break; }
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
