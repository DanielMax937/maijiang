import { GangRule, GameContext, Tile } from "../../types";

export class StandardGangRule implements GangRule {
    canGang(ctx: GameContext): boolean {
        if (ctx.isSelfDraw) {
            // An Gang: need 4 matching tiles in hand
            const countMap = new Map<string, number>();
            ctx.hand.forEach(t => {
                const key = `${t.suit}-${t.rank}`;
                countMap.set(key, (countMap.get(key) || 0) + 1);
            });
            for (const count of countMap.values()) {
                if (count === 4) return true;
            }
            return false;
        } else {
            // Ming Gang: need 3 matching tiles for discard
            if (!ctx.discard) return false;
            const count = ctx.hand.filter(t => t.suit === ctx.discard!.suit && t.rank === ctx.discard!.rank).length;
            return count >= 3;
        }
    }

    getSelfDrawGangTile(ctx: GameContext): Tile | null {
        const countMap = new Map<string, Tile[]>();
        ctx.hand.forEach(t => {
            const key = `${t.suit}-${t.rank}`;
            if (!countMap.has(key)) countMap.set(key, []);
            countMap.get(key)!.push(t);
        });
        for (const tiles of countMap.values()) {
            if (tiles.length === 4) return tiles[0];
        }
        return null;
    }
}
