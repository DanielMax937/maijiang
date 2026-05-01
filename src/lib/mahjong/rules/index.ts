import { Region, MahjongRuleSet, GameRules } from "../types";
import { StandardChiRule } from "./chi/StandardChiRule";
import { NoChiRule } from "./chi/NoChiRule";
import { StandardPengRule } from "./peng/StandardPengRule";
import { StandardGangRule } from "./gang/StandardGangRule";
import { StandardHuRule } from "./hu/StandardHuRule";
import { HangzhouHuRule } from "./hu/HangzhouHuRule";
import { ShengzhouHuRule } from "./hu/ShengzhouHuRule";
import { ChineseScoreRule } from "./score/ChineseScoreRule";
import { HangzhouScoreRule } from "./score/HangzhouScoreRule";
import { ShengzhouScoreRule } from "./score/ShengzhouScoreRule";
import { StandardDrawRule } from "./draw/StandardDrawRule";

// Factory function to create rule set based on region
export function createRuleSet(region: Region): MahjongRuleSet {
    switch (region) {
        case "hangzhou":
            return createHangzhouRuleSet();
        case "shengzhou":
            return createShengzhouRuleSet();
        case "chinese":
        default:
            return createChineseRuleSet();
    }
}

function createChineseRuleSet(): MahjongRuleSet {
    return {
        config: {
            region: "chinese",
            hasFlowers: true,
            hasSeasons: true,
            hasRedDora: false,
            handSize: 13,
        },
        chiRule: new StandardChiRule(),
        pengRule: new StandardPengRule(),
        gangRule: new StandardGangRule(),
        huRule: new StandardHuRule(),
        scoreRule: new ChineseScoreRule(),
        drawRule: new StandardDrawRule(),
    };
}

function createHangzhouRuleSet(): MahjongRuleSet {
    return {
        config: {
            region: "hangzhou",
            hasFlowers: false,
            hasSeasons: false,
            hasRedDora: false,
            handSize: 13,
        },
        chiRule: new StandardChiRule(),
        pengRule: new StandardPengRule(),
        gangRule: new StandardGangRule(),
        huRule: new HangzhouHuRule(),
        scoreRule: new HangzhouScoreRule(),
        drawRule: new StandardDrawRule(),
    };
}

function createShengzhouRuleSet(): MahjongRuleSet {
    return {
        config: {
            region: "shengzhou",
            hasFlowers: false,
            hasSeasons: false,
            hasRedDora: false,
            handSize: 13,
        },
        chiRule: new StandardChiRule(),
        pengRule: new StandardPengRule(),
        gangRule: new StandardGangRule(),
        huRule: new ShengzhouHuRule(),
        scoreRule: new ShengzhouScoreRule(),
        drawRule: new StandardDrawRule(),
    };
}
