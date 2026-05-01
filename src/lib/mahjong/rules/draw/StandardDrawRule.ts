import { DrawRule, Tile } from "../../types";

export class StandardDrawRule implements DrawRule {
    shouldReplaceFlower(tile: Tile): boolean {
        return tile.suit === "flower" || tile.suit === "season";
    }
}
