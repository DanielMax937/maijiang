import { RuleStrategy, GameRules, Tile } from "../types";
import { ChineseStrategy } from "./chinese";

export class RiichiStrategy extends ChineseStrategy implements RuleStrategy {
    getRules(): GameRules {
        return {
            region: "riichi",
            hasFlowers: false,
            hasSeasons: false,
            hasRedDora: true,
            handSize: 13,
        };
    }
    // Inherit basic checkWin for now
}
