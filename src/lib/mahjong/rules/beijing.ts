import { RuleStrategy, GameRules, Tile } from "../types";
import { ChineseStrategy } from "./chinese";

export class BeijingStrategy extends ChineseStrategy implements RuleStrategy {
    getRules(): GameRules {
        return {
            region: "beijing",
            hasFlowers: false, // Beijing usually plays without flowers
            hasSeasons: false,
            hasRedDora: false,
            handSize: 13,
        };
    }

    // Beijing Mahjong win check is similar to standard (4 melds + 1 pair)
    // But often has specific constraints like "Must have a Pung/Kong" or specific fan requirements.
    // For this basic implementation, we'll inherit the standard checkWin from ChineseStrategy
    // but we could override it if we needed to enforce "Men Qing" or other specifics.

    checkWin(hand: Tile[]): boolean {
        // Use standard check for now
        return super.checkWin(hand);
    }
}
