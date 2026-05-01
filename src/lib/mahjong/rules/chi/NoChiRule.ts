import { ChiRule, GameContext } from "../../types";

export class NoChiRule implements ChiRule {
    canChi(_ctx: GameContext): boolean {
        return false;
    }
}
