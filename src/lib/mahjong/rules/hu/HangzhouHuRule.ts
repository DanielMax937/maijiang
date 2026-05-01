import { HuRule, GameContext, HuResult, Tile } from "../../types";
import { StandardHuRule } from "./StandardHuRule";

export class HangzhouHuRule implements HuRule {
    private standardHu = new StandardHuRule();

    canHu(ctx: GameContext): HuResult {
        const fullHand = ctx.discard ? [...ctx.hand, ctx.discard] : ctx.hand;
        const success = this.checkWin(fullHand);
        if (!success) return { success: false, patterns: [] };

        const patterns: string[] = ["standard"];
        if (this.checkSevenPairs(fullHand)) patterns.push("qiduizi");

        return { success: true, patterns };
    }

    checkWin(hand: Tile[]): boolean {
        if (this.standardHu.checkWin(hand)) return true;
        if (hand.length === 14 && this.checkSevenPairs(hand)) return true;
        return false;
    }

    private checkSevenPairs(hand: Tile[]): boolean {
        if (hand.length !== 14) return false;
        const countMap = new Map<string, number>();
        hand.forEach(t => {
            const key = `${t.suit}-${t.rank}`;
            countMap.set(key, (countMap.get(key) || 0) + 1);
        });
        const counts = [...countMap.values()];
        if (counts.length !== 7) return false;
        return counts.every(c => c === 2);
    }

    getTenpaiTiles(hand: Tile[]): Tile[] {
        return this.standardHu.getTenpaiTiles(hand);
    }
}
