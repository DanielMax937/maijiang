import { PengRule, GameContext } from "../../types";

export class StandardPengRule implements PengRule {
    canPeng(ctx: GameContext): boolean {
        if (!ctx.discard) return false;
        const count = ctx.hand.filter(t => t.suit === ctx.discard!.suit && t.rank === ctx.discard!.rank).length;
        return count >= 2;
    }
}
