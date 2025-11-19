import { Region, RuleStrategy } from "../types";
import { ChineseStrategy } from "./chinese";
import { RiichiStrategy } from "./riichi";
import { SichuanStrategy } from "./sichuan";
import { BeijingStrategy } from "./beijing";

const strategies: Record<Region, RuleStrategy> = {
    chinese: new ChineseStrategy(),
    riichi: new RiichiStrategy(),
    sichuan: new SichuanStrategy(),
    beijing: new BeijingStrategy(),
};

export function getStrategy(region: Region): RuleStrategy {
    return strategies[region] || strategies.chinese;
}
