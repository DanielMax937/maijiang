import { ScoreRule, GameContext, HuResult, ScoreResult, Tile } from "../../types";

/**
 * 嵊州麻将计分规则 (来源: tcy365.com)
 *
 * 点炮：放冲者付2份，其他两家各付1份
 * 自摸：三家各付2份
 *
 * 番数:
 * - 自摸：2番
 * - 杠上开花：等于财鸟（5番）+ 杠子番数
 * - 抢杠：5番
 * - 财鸟（1个财神）：5番
 * - 飞鸟（2连续财神）：10番，每多一个翻倍（3连续=20番，4连续=40番...）
 * - 庄家：+1番
 * - 明杠：+1番/个
 * - 暗杠：+2番/个
 *
 * 连庄：每多一次连庄，胡牌分数翻倍（杠钱不受影响）
 *
 * 结算公式:
 *   胡牌分 = base × 2^(fan + 连庄加倍)
 *   杠分 = base × 2^(kongFan)
 *   总分 = 胡牌分 + 杠分
 */
export class ShengzhouScoreRule implements ScoreRule {
    calculate(ctx: GameContext, huResult: HuResult): ScoreResult {
        const player = ctx.allPlayers[ctx.playerIndex];
        const { melds } = player;
        const hand = ctx.hand;
        const breakdown: string[] = [];
        let mainFan = 0;    // 胡牌相关番数（受连庄影响）
        let kongFan = 0;    // 杠相关番数（不受连庄影响）
        const base = 8;

        // 庄家 +1番
        if (ctx.isDealer) {
            mainFan += 1;
            breakdown.push("庄家 (Dealer): +1 番");
        }

        // Determine base fan from win method (mutually exclusive)
        if (huResult.patterns.includes("gangkai")) {
            mainFan += 5;
            breakdown.push("杠开 (Gang Kai) = 财鸟: +5 番");
        } else if (huResult.patterns.includes("qianggang")) {
            mainFan += 5;
            breakdown.push("抢杠 (Qiang Gang): +5 番");
        } else if (huResult.patterns.includes("zimo")) {
            mainFan += 2;
            breakdown.push("自摸 (Zi Mo): +2 番");
        }

        // 飞鸟/财鸟递进计算（杠开已算过财鸟，不重复）
        if (!huResult.patterns.includes("gangkai")) {
            const consecutiveCount = getMaxConsecutiveCaishen(hand, ctx.caishenTile);
            if (consecutiveCount >= 2) {
                const feiniaoFan = 10 * Math.pow(2, consecutiveCount - 2);
                const names = ["", "", "飞鸟", "双飞鸟", "三飞鸟", "四飞鸟"];
                const name = names[consecutiveCount] || `${consecutiveCount}飞鸟`;
                mainFan += feiniaoFan;
                breakdown.push(`${name} ×${consecutiveCount}连续财神: +${feiniaoFan} 番`);
            } else if (consecutiveCount === 1) {
                mainFan += 5;
                breakdown.push("财鸟 (Cai Niao): +5 番");
            }
        }

        // Kong bonuses（单独计算，不受连庄影响）
        const mingGangCount = melds.filter(m => m.type === "gang" && m.fromPlayer !== undefined).length;
        const anGangCount = melds.filter(m => m.type === "gang" && m.fromPlayer === undefined).length;
        if (mingGangCount > 0) {
            kongFan += mingGangCount;
            breakdown.push(`明杠 (Ming Gang) ×${mingGangCount}: +${mingGangCount} 番`);
        }
        if (anGangCount > 0) {
            kongFan += anGangCount * 2;
            breakdown.push(`暗杠 (An Gang) ×${anGangCount}: +${anGangCount * 2} 番`);
        }

        // 连庄加倍
        const dealerStreak = ctx.dealerStreak || 1;
        const lianzhuangMultiplier = Math.pow(2, dealerStreak - 1);
        if (dealerStreak > 1) {
            breakdown.push(`连庄 ×${dealerStreak}: 胡牌分 ×${lianzhuangMultiplier}`);
        }

        // 分开计算: 胡牌分受连庄影响，杠分不受影响
        const cappedMainFan = Math.min(mainFan, 13);
        const cappedKongFan = Math.min(kongFan, 13);
        const mainScore = base * Math.pow(2, cappedMainFan);
        const kongScore = kongFan > 0 ? base * Math.pow(2, cappedKongFan) : 0;
        const total = Math.round(mainScore * lianzhuangMultiplier + kongScore);

        return { base, fan: Math.min(mainFan + kongFan, 13), total, breakdown };
    }
}

/**
 * 检测手牌中最长连续财神数
 * 连续 = 手牌排序后相邻的财神牌
 */
function getMaxConsecutiveCaishen(hand: Tile[], caishenTile?: Tile): number {
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
