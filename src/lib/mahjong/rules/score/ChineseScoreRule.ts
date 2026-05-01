import { ScoreRule, GameContext, HuResult, ScoreResult } from "../../types";

export class ChineseScoreRule implements ScoreRule {
    calculate(ctx: GameContext, _huResult: HuResult): ScoreResult {
        const player = ctx.allPlayers[ctx.playerIndex];
        const { hand, melds } = player;
        const breakdown: string[] = [];
        let fan = 0;
        const base = 8;

        if (ctx.isSelfDraw) {
            fan += 1;
            breakdown.push("自摸 (Zi Mo): +1 番");
        }

        if (melds.length === 0) {
            fan += 2;
            breakdown.push("门前清 (Men Qing): +2 番");
        }

        const allPong = melds.every(m => m.type === "peng" || m.type === "gang");
        if (allPong && melds.length >= 3) {
            fan += 2;
            breakdown.push("碰碰胡 (Peng Peng Hu): +2 番");
        }

        const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
        const suits = new Set(allTiles.map(t => t.suit));
        if (suits.size === 1 && !["wind", "dragon", "flower", "season"].includes([...suits][0])) {
            fan += 6;
            breakdown.push("清一色 (Qing Yi Se): +6 番");
        }

        const numberedSuits = [...suits].filter(s => ["bamboo", "character", "dot"].includes(s));
        const hasHonors = suits.has("wind") || suits.has("dragon");
        if (numberedSuits.length === 1 && hasHonors && suits.size === 2) {
            fan += 3;
            breakdown.push("混一色 (Hun Yi Se): +3 番");
        }

        if (suits.size >= 1 && [...suits].every(s => s === "wind" || s === "dragon")) {
            fan += 8;
            breakdown.push("字一色 (Zi Yi Se): +8 番");
        }

        const dragonMelds = melds.filter(m => m.tiles[0]?.suit === "dragon");
        if (dragonMelds.length === 3) {
            fan += 13;
            breakdown.push("大三元 (Da San Yuan): +13 番");
        } else if (dragonMelds.length >= 1) {
            fan += dragonMelds.length;
            breakdown.push(`箭牌刻子: +${dragonMelds.length} 番`);
        }

        const kongCount = melds.filter(m => m.type === "gang").length;
        if (kongCount > 0) {
            fan += kongCount;
            breakdown.push(`杠牌: +${kongCount} 番`);
        }

        const total = base * Math.pow(2, Math.min(fan, 10));
        return { base, fan, total: Math.round(total), breakdown };
    }
}
