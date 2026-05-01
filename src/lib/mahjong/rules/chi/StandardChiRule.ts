import { ChiRule, GameContext, Tile } from "../../types";

export class StandardChiRule implements ChiRule {
    canChi(ctx: GameContext): boolean {
        if (!ctx.discard) return false;
        if (typeof ctx.discard.rank !== "number") return false;

        const { suit, rank } = ctx.discard;
        const hasTile = (r: number) => ctx.hand.some(t => t.suit === suit && t.rank === r);

        // Case 1: (rank-2, rank-1, discard)
        if (hasTile(rank - 2) && hasTile(rank - 1)) return true;
        // Case 2: (rank-1, discard, rank+1)
        if (hasTile(rank - 1) && hasTile(rank + 1)) return true;
        // Case 3: (discard, rank+1, rank+2)
        if (hasTile(rank + 1) && hasTile(rank + 2)) return true;

        return false;
    }
}
