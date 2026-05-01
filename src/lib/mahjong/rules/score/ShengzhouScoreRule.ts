import { ScoreRule, GameContext, HuResult, ScoreResult } from "../../types";

/**
 * 嵊州麻将计分规则
 * 
 * 基础：推倒胡 1番
 * 自摸：+1番（三家付）
 * 七对子：+2番
 * 碰碰和：+2番
 * 清一色：+6番
 * 混一色：+3番
 * 字一色：+8番
 * 杠上开花：+2番
 * 财鸟（用财神胡牌）：+3番
 * 杠牌：明杠+1，暗杠+2
 * 
 * 结算：base × 2^fan
 * 自摸：三家各付
 * 点炮：放冲者付双倍
 */
export class ShengzhouScoreRule implements ScoreRule {
    calculate(ctx: GameContext, huResult: HuResult): ScoreResult {
        const player = ctx.allPlayers[ctx.playerIndex];
        const { melds } = player;
        const hand = ctx.hand;
        const breakdown: string[] = [];
        let fan = 0;
        const base = 8;

        // 推倒胡 base
        fan += 1;
        breakdown.push("推倒胡 (Tui Dao Hu): +1 番");

        // 自摸
        if (huResult.patterns.includes("zimo")) {
            fan += 1;
            breakdown.push("自摸 (Zi Mo): +1 番");
        }

        // 杠上开花
        if (huResult.patterns.includes("gangkai")) {
            fan += 2;
            breakdown.push("杠上开花 (Gang Shang Kai Hua): +2 番");
        }

        // 七对子
        if (huResult.patterns.includes("qiduizi")) {
            fan += 2;
            breakdown.push("七对子 (Qi Dui Zi): +2 番");
        }

        // 碰碰和
        if (huResult.patterns.includes("pengpenghu")) {
            fan += 2;
            breakdown.push("碰碰和 (Peng Peng Hu): +2 番");
        }

        // 清一色
        if (huResult.patterns.includes("qingyise")) {
            fan += 6;
            breakdown.push("清一色 (Qing Yi Se): +6 番");
        }

        // 混一色 (check separately)
        const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
        const nonCaishenTiles = ctx.caishenTile
            ? allTiles.filter(t => !(t.suit === ctx.caishenTile!.suit && t.rank === ctx.caishenTile!.rank))
            : allTiles;
        const suits = new Set(nonCaishenTiles.map(t => t.suit));
        const numberedSuits = [...suits].filter(s => ["bamboo", "character", "dot"].includes(s));
        const hasHonors = suits.has("wind") || suits.has("dragon");

        if (!huResult.patterns.includes("qingyise") && numberedSuits.length === 1 && hasHonors && suits.size === 2) {
            fan += 3;
            breakdown.push("混一色 (Hun Yi Se): +3 番");
        }

        // 字一色
        if (suits.size >= 1 && [...suits].every(s => s === "wind" || s === "dragon")) {
            fan += 8;
            breakdown.push("字一色 (Zi Yi Se): +8 番");
        }

        // 门前清 (closed hand)
        if (melds.length === 0) {
            fan += 1;
            breakdown.push("门前清 (Men Qian Qing): +1 番");
        }

        // 财鸟 - hand contains caishen tile and used for winning
        if (huResult.patterns.includes("cainio")) {
            const caishenCount = ctx.caishenTile
                ? hand.filter(t => t.suit === ctx.caishenTile!.suit && t.rank === ctx.caishenTile!.rank).length
                : 0;
            if (caishenCount > 0) {
                const cainioFan = caishenCount * 3;
                fan += cainioFan;
                breakdown.push(`财鸟 (Cai Niao) ×${caishenCount}: +${cainioFan} 番`);
            }
        }

        // 杠牌加分
        const mingGangCount = melds.filter(m => m.type === "gang" && m.fromPlayer !== undefined).length;
        const anGangCount = melds.filter(m => m.type === "gang" && m.fromPlayer === undefined).length;
        if (mingGangCount > 0) {
            fan += mingGangCount;
            breakdown.push(`明杠 (Ming Gang) ×${mingGangCount}: +${mingGangCount} 番`);
        }
        if (anGangCount > 0) {
            fan += anGangCount * 2;
            breakdown.push(`暗杠 (An Gang) ×${anGangCount}: +${anGangCount * 2} 番`);
        }

        // Cap fan at reasonable level
        const cappedFan = Math.min(fan, 13);
        const total = base * Math.pow(2, cappedFan);

        return { base, fan: cappedFan, total: Math.round(total), breakdown };
    }
}
