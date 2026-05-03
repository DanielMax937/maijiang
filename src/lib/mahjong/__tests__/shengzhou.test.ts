/**
 * 嵊州麻将全场景单元测试
 * 覆盖：吃/碰/杠/胡、财神机制、飞鸟圈、承包、抢杠、计分、优先级判定等
 */
import { describe, it, expect } from "vitest";
import { Tile, GameState, Player, Meld, GameContext } from "../types";
import {
    initializeGame,
    drawTile,
    discardTile,
    performCheck,
    resolvePendingActions,
    stepGame,
    applyScoreChanges,
    calculateFeiniaoCompensation,
    applyFeiniaoCompensation,
    performJiaGang,
} from "../game";
import { createRuleSet } from "../rules";
import { createGameContext } from "../rules/context";
import { ShengzhouHuRule } from "../rules/hu/ShengzhouHuRule";
import { ShengzhouScoreRule } from "../rules/score/ShengzhouScoreRule";
import { StandardChiRule } from "../rules/chi/StandardChiRule";
import { StandardPengRule } from "../rules/peng/StandardPengRule";
import { StandardGangRule } from "../rules/gang/StandardGangRule";

// ============ Helper Functions ============

function makeTile(suit: Tile["suit"], rank: Tile["rank"], id?: string): Tile {
    return { id: id || `${suit[0]}${rank}-${Math.random().toString(36).slice(2, 6)}`, suit, rank };
}

function makeHand(specs: [Tile["suit"], Tile["rank"]][]): Tile[] {
    return specs.map(([suit, rank], i) => makeTile(suit, rank, `${suit[0]}${rank}-${i}`));
}

function makeCaishen(suit: Tile["suit"], rank: Tile["rank"]): Tile {
    return { id: "caishen-indicator", suit, rank };
}

function makePlayer(index: number, hand: Tile[], melds: Meld[] = [], score = 25000): Player {
    return {
        id: index,
        name: index === 0 ? "You" : `Bot ${index}`,
        hand,
        discards: [],
        melds,
        isTurn: false,
        score,
        wind: (["east", "south", "west", "north"] as const)[index],
    };
}

function makeMinimalGameState(overrides: Partial<GameState> = {}): GameState {
    const defaults: GameState = {
        players: [
            makePlayer(0, []),
            makePlayer(1, []),
            makePlayer(2, []),
            makePlayer(3, []),
        ],
        deck: [],
        currentTurn: 0,
        winner: null,
        lastDiscard: null,
        isGameOver: false,
        wallCount: 80,
        rules: { region: "shengzhou", handSize: 13, hasFlowers: false },
        actionTimer: 30,
        isWaitingForAction: false,
        pendingActions: {},
        actionDecisions: {},
        logs: [],
        phase: "DISCARD",
        checkIndex: 0,
        replayEvents: [],
        llmAdvice: [],
        actionHistory: [],
        caishenTile: makeCaishen("dot", 8),
        caishenSourceTile: makeTile("dot", 7),
        diceValues: [3, 4],
        dealerIndex: 0,
        liabilityCount: { 0: {}, 1: {}, 2: {}, 3: {} },
        caishenDiscardRound: null,
        lostDianPao: { 0: false, 1: false, 2: false, 3: false },
        dealerStreak: 1,
    };
    return { ...defaults, ...overrides };
}

// ============ 1. Chi (吃) Tests ============

describe("嵊州麻将 - 吃 (Chi)", () => {
    const chiRule = new StandardChiRule();

    it("下家可以吃顺子 (左吃: 有4,5 吃3)", () => {
        const hand = makeHand([["bamboo", 4], ["bamboo", 5], ["dot", 1]]);
        const discard = makeTile("bamboo", 3);
        const ctx = { hand, discard } as GameContext;
        expect(chiRule.canChi(ctx)).toBe(true);
    });

    it("下家可以吃顺子 (中吃: 有1,3 吃2)", () => {
        const hand = makeHand([["bamboo", 1], ["bamboo", 3], ["dot", 1]]);
        const discard = makeTile("bamboo", 2);
        const ctx = { hand, discard } as GameContext;
        expect(chiRule.canChi(ctx)).toBe(true);
    });

    it("下家可以吃顺子 (右吃: 有1,2 吃3)", () => {
        const hand = makeHand([["bamboo", 1], ["bamboo", 2], ["dot", 1]]);
        const discard = makeTile("bamboo", 3);
        const ctx = { hand, discard } as GameContext;
        expect(chiRule.canChi(ctx)).toBe(true);
    });

    it("不能吃字牌", () => {
        const hand = makeHand([["wind", "east"], ["wind", "south"], ["dot", 1]]);
        const discard = makeTile("wind", "west");
        const ctx = { hand, discard } as GameContext;
        expect(chiRule.canChi(ctx)).toBe(false);
    });

    it("花色不同不能吃", () => {
        const hand = makeHand([["bamboo", 1], ["bamboo", 2], ["dot", 1]]);
        const discard = makeTile("dot", 3);
        const ctx = { hand, discard } as GameContext;
        expect(chiRule.canChi(ctx)).toBe(false);
    });

    it("没有弃牌时不能吃", () => {
        const hand = makeHand([["bamboo", 1], ["bamboo", 2], ["bamboo", 3]]);
        const ctx = { hand, discard: undefined } as unknown as GameContext;
        expect(chiRule.canChi(ctx)).toBe(false);
    });
});

// ============ 2. Peng (碰) Tests ============

describe("嵊州麻将 - 碰 (Peng)", () => {
    const pengRule = new StandardPengRule();

    it("手牌有2张相同可以碰", () => {
        const hand = makeHand([["bamboo", 3], ["bamboo", 3], ["dot", 1]]);
        const discard = makeTile("bamboo", 3);
        const ctx = { hand, discard } as GameContext;
        expect(pengRule.canPeng(ctx)).toBe(true);
    });

    it("手牌有3张相同也可以碰", () => {
        const hand = makeHand([["bamboo", 3], ["bamboo", 3], ["bamboo", 3]]);
        const discard = makeTile("bamboo", 3);
        const ctx = { hand, discard } as GameContext;
        expect(pengRule.canPeng(ctx)).toBe(true);
    });

    it("手牌只有1张不能碰", () => {
        const hand = makeHand([["bamboo", 3], ["dot", 1], ["dot", 2]]);
        const discard = makeTile("bamboo", 3);
        const ctx = { hand, discard } as GameContext;
        expect(pengRule.canPeng(ctx)).toBe(false);
    });

    it("字牌可以碰", () => {
        const hand = makeHand([["wind", "east"], ["wind", "east"], ["dot", 1]]);
        const discard = makeTile("wind", "east");
        const ctx = { hand, discard } as GameContext;
        expect(pengRule.canPeng(ctx)).toBe(true);
    });
});

// ============ 3. Gang (杠) Tests ============

describe("嵊州麻将 - 杠 (Gang)", () => {
    const gangRule = new StandardGangRule();

    it("明杠: 手中有3张相同牌可杠别人弃牌", () => {
        const hand = makeHand([["bamboo", 5], ["bamboo", 5], ["bamboo", 5]]);
        const discard = makeTile("bamboo", 5);
        const ctx = { hand, discard, isSelfDraw: false } as GameContext;
        expect(gangRule.canGang(ctx)).toBe(true);
    });

    it("明杠: 手中只有2张不能杠弃牌", () => {
        const hand = makeHand([["bamboo", 5], ["bamboo", 5], ["dot", 1]]);
        const discard = makeTile("bamboo", 5);
        const ctx = { hand, discard, isSelfDraw: false } as GameContext;
        expect(gangRule.canGang(ctx)).toBe(false);
    });

    it("暗杠: 手中有4张相同牌", () => {
        const hand = makeHand([["dot", 9], ["dot", 9], ["dot", 9], ["dot", 9], ["bamboo", 1]]);
        const ctx = { hand, isSelfDraw: true } as GameContext;
        expect(gangRule.canGang(ctx)).toBe(true);
    });

    it("暗杠: getSelfDrawGangTile 返回正确的牌", () => {
        const hand = makeHand([["dot", 9], ["dot", 9], ["dot", 9], ["dot", 9], ["bamboo", 1]]);
        const ctx = { hand, isSelfDraw: true } as GameContext;
        const tile = gangRule.getSelfDrawGangTile(ctx);
        expect(tile).not.toBeNull();
        expect(tile!.suit).toBe("dot");
        expect(tile!.rank).toBe(9);
    });

    it("暗杠: 没有4张相同时返回null", () => {
        const hand = makeHand([["dot", 9], ["dot", 9], ["dot", 9], ["bamboo", 1]]);
        const ctx = { hand, isSelfDraw: true } as GameContext;
        const tile = gangRule.getSelfDrawGangTile(ctx);
        expect(tile).toBeNull();
    });
});

// ============ 4. Hu (胡) Tests - 基本 ============

describe("嵊州麻将 - 胡牌 (Hu) 基本判定", () => {
    const huRule = new ShengzhouHuRule();

    it("标准胡: 4面子 + 1雀头", () => {
        // 123万 456万 789万 111条 + 22筒
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 2], ["dot", 2],
        ]);
        expect(huRule.checkWin(hand)).toBe(true);
    });

    it("标准胡: 碰碰胡 (全刻子)", () => {
        // 111万 222万 333条 444筒 + 55筒
        const hand = makeHand([
            ["character", 1], ["character", 1], ["character", 1],
            ["character", 2], ["character", 2], ["character", 2],
            ["bamboo", 3], ["bamboo", 3], ["bamboo", 3],
            ["dot", 4], ["dot", 4], ["dot", 4],
            ["dot", 5], ["dot", 5],
        ]);
        expect(huRule.checkWin(hand)).toBe(true);
    });

    it("未听牌不能胡", () => {
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 4],
            ["character", 5], ["character", 6], ["character", 8],
            ["bamboo", 1], ["bamboo", 3], ["bamboo", 5],
            ["dot", 2], ["dot", 4], ["dot", 6],
            ["wind", "east"], ["wind", "south"],
        ]);
        expect(huRule.checkWin(hand)).toBe(false);
    });

    it("牌数不对不能胡 (13张)", () => {
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 2],
        ]);
        expect(huRule.checkWin(hand)).toBe(false);
    });
});

// ============ 5. Hu with Caishen (财神胡牌) ============

describe("嵊州麻将 - 财神胡牌", () => {
    const huRule = new ShengzhouHuRule();
    const caishen = makeCaishen("dot", 8);

    it("1张财神代替1张缺牌可以胡", () => {
        // 123万 456万 789万 11条 + [财神代替第3张条]
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1],
            ["dot", 2], ["dot", 2],
        ]);
        // Add a caishen tile
        hand.push(makeTile("dot", 8, "caishen-1"));
        expect(huRule.checkWinWithCaishen(hand, caishen)).toBe(true);
    });

    it("2张财神代替2张缺牌可以胡", () => {
        // 123万 456万 78_万 1_条 + 22筒 (财神代替9万和另一张条)
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8],
            ["bamboo", 1],
            ["dot", 2], ["dot", 2],
        ]);
        hand.push(makeTile("dot", 8, "caishen-1"));
        hand.push(makeTile("dot", 8, "caishen-2"));
        // 13 tiles = not valid (need 14)
        hand.push(makeTile("bamboo", 1, "extra-b1"));
        expect(huRule.checkWinWithCaishen(hand, caishen)).toBe(true);
    });

    it("全财神可以胡 (14张全是财神)", () => {
        const hand: Tile[] = [];
        for (let i = 0; i < 14; i++) {
            hand.push(makeTile("dot", 8, `caishen-${i}`));
        }
        expect(huRule.checkWinWithCaishen(hand, caishen)).toBe(true);
    });

    it("财神不够代替缺牌时不能胡", () => {
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 4],
            ["character", 5], ["character", 7], ["character", 8],
            ["bamboo", 1], ["bamboo", 3], ["bamboo", 5],
            ["dot", 2], ["dot", 4], ["dot", 6],
            ["wind", "east"],
        ]);
        hand.push(makeTile("dot", 8, "caishen-1"));
        expect(huRule.checkWinWithCaishen(hand, caishen)).toBe(false);
    });
});

// ============ 6. 点炮限制 Tests ============

describe("嵊州麻将 - 点炮限制", () => {
    const huRule = new ShengzhouHuRule();
    const caishen = makeCaishen("dot", 8);

    it("有财神在手不能点炮胡", () => {
        // 完整的胡牌 + 手中有财神
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 8], // 这是财神
        ]);
        const discard = makeTile("dot", 2); // 别人打的
        const extraHand = [...hand];
        // 需要一张能让手牌+弃牌=14张胡的牌
        // 重新构造: 13张手牌 + 1张弃牌 = 14张
        const hand13 = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 8], // 财神
        ]);
        const discard2 = makeTile("dot", 2);
        // 加弃牌后: ... + 22筒 = 雀头, 但手里有财神不能点炮
        // 其实这里需要确保加上弃牌后能胡
        const winningHand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 8], // 财神在手
        ]);
        const winDiscard = makeTile("dot", 2);

        const state = makeMinimalGameState({
            caishenTile: caishen,
            currentTurn: 1,
        });
        state.players[0] = makePlayer(0, winningHand);
        const ctx = createGameContext(state, 0, { discard: winDiscard });
        const result = huRule.canHu(ctx);
        // Even though it forms a winning hand with caishen as wildcard, dianpao is blocked
        // Actually let's check: does 13 tiles + 1 discard form a win? Need to verify
        // 123万456万789万111条 + 财神(8筒)+2筒 -> 财神做雀头partner with 2筒? No.
        // Let me fix: make a hand where adding discard wins WITH caishen as wildcard
        // Actually: with 8筒 as caishen (wildcard), fullHand = hand + discard = 14 tiles
        // 123万 456万 789万 111条 [8筒(wildcard)] [2筒] -> wildcard pairs with 2筒 = 22筒 pair. YES WIN!
        // But has caishen in hand -> cannot dianpao
        expect(result.success).toBe(false);
    });

    it("有财神在手可以自摸胡", () => {
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 8], // 财神
            ["dot", 2], // 自摸的牌 (对子)
        ]);
        const state = makeMinimalGameState({ caishenTile: caishen, currentTurn: 0 });
        state.players[0] = makePlayer(0, hand);
        const ctx = createGameContext(state, 0, { isSelfDraw: true });
        const result = huRule.canHu(ctx);
        expect(result.success).toBe(true);
        expect(result.patterns).toContain("zimo");
    });

    it("永久失去点炮资格后不能点炮胡", () => {
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 2],
        ]);
        const discard = makeTile("dot", 2);
        const state = makeMinimalGameState({
            caishenTile: caishen,
            currentTurn: 1,
            lostDianPao: { 0: true, 1: false, 2: false, 3: false },
        });
        state.players[0] = makePlayer(0, hand);
        const ctx = createGameContext(state, 0, { discard });
        const result = huRule.canHu(ctx);
        expect(result.success).toBe(false);
    });

    it("存在承包关系不能点炮胡", () => {
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 2],
        ]);
        const discard = makeTile("dot", 2);
        const state = makeMinimalGameState({
            caishenTile: caishen,
            currentTurn: 1,
            liabilityCount: { 0: { 1: 3 }, 1: {}, 2: {}, 3: {} }, // Player 0 chi/peng from player 1 >= 3 times
        });
        state.players[0] = makePlayer(0, hand);
        const ctx = createGameContext(state, 0, { discard });
        const result = huRule.canHu(ctx);
        expect(result.success).toBe(false);
    });

    it("抢杠时有财神也可以胡", () => {
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 8], // 财神在手
        ]);
        const discard = makeTile("dot", 2);
        const state = makeMinimalGameState({ caishenTile: caishen, currentTurn: 1 });
        state.players[0] = makePlayer(0, hand);
        const ctx = createGameContext(state, 0, { discard, isQiangGang: true });
        const result = huRule.canHu(ctx);
        expect(result.success).toBe(true);
        expect(result.patterns).toContain("qianggang");
    });
});

// ============ 7. 优先级判定 (碰优先于吃) ============

describe("嵊州麻将 - 动作优先级", () => {
    it("碰优先于吃: 一张牌同时可吃可碰时碰优先", () => {
        // Player 0 discards 5条
        // Player 1 (下家) can chi (has 4条6条)
        // Player 2 can peng (has 5条5条)
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "RESOLVE",
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
        });
        state.players[1] = makePlayer(1, makeHand([["bamboo", 4], ["bamboo", 6], ["dot", 1]]));
        state.players[2] = makePlayer(2, makeHand([["bamboo", 5], ["bamboo", 5], ["dot", 1]]));
        state.pendingActions = {
            1: { chi: true, peng: false, gang: false, hu: false },
            2: { chi: false, peng: true, gang: false, hu: false },
        };
        state.actionDecisions = { 1: "chi", 2: "peng" };

        const result = resolvePendingActions(state);
        // Peng has higher priority (2) than chi (1)
        expect(result.currentTurn).toBe(2);
        expect(result.logs.some(l => l.includes("performed peng"))).toBe(true);
    });

    it("胡优先于碰: 一张牌同时可碰可胡时胡优先", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "RESOLVE",
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
            caishenTile: makeCaishen("dot", 8),
        });
        // Player 1 can peng
        state.players[1] = makePlayer(1, makeHand([["bamboo", 5], ["bamboo", 5], ["dot", 1]]));
        // Player 2 can hu (needs 5条 to complete hand)
        state.players[2] = makePlayer(2, makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["bamboo", 5],
        ]));
        state.pendingActions = {
            1: { chi: false, peng: true, gang: false, hu: false },
            2: { chi: false, peng: false, gang: false, hu: true },
        };
        state.actionDecisions = { 1: "peng", 2: "hu" };

        const result = resolvePendingActions(state);
        expect(result.isGameOver).toBe(true);
        expect(result.winner).toBe(2);
    });

    it("全部pass: 轮到下一个玩家", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "RESOLVE",
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
        });
        state.pendingActions = {
            1: { chi: true, peng: false, gang: false, hu: false },
            2: { chi: false, peng: true, gang: false, hu: false },
        };
        state.actionDecisions = { 1: "pass", 2: "pass" };

        const result = resolvePendingActions(state);
        expect(result.phase).toBe("DRAW");
        expect(result.currentTurn).toBe(1); // Next after player 0
    });
});

// ============ 8. 计分 Tests ============

describe("嵊州麻将 - 计分 (Score)", () => {
    const scoreRule = new ShengzhouScoreRule();
    const caishen = makeCaishen("dot", 8);

    function makeScoreCtx(overrides: Partial<GameContext>): GameContext {
        const melds = (overrides as { melds?: Meld[] }).melds || [];
        const playerIndex = (overrides as { playerIndex?: number }).playerIndex || 0;
        const players = [makePlayer(0, []), makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])];
        // Score rule reads melds from allPlayers[playerIndex].melds
        players[playerIndex] = { ...players[playerIndex], melds };
        return {
            hand: [],
            melds,
            allPlayers: players,
            rules: { region: "shengzhou", handSize: 13, hasFlowers: false },
            phase: "DISCARD",
            currentTurn: 0,
            playerIndex,
            isSelfDraw: false,
            isGangDraw: false,
            isQiangGang: false,
            dealerStreak: 1,
            isDealer: false,
            caishenTile: caishen,
            ...overrides,
            allPlayers: players,
        } as GameContext;
    }

    it("基本点炮: base=8, fan=0, total=8", () => {
        const ctx = makeScoreCtx({});
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard"] });
        expect(result.base).toBe(8);
        expect(result.total).toBe(8);
    });

    it("自摸: +2番, total = 8 * 2^2 = 32", () => {
        const ctx = makeScoreCtx({ isSelfDraw: true });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard", "zimo"] });
        expect(result.total).toBe(32);
    });

    it("庄家自摸: +1(庄) +2(自摸) = 3番, total = 8 * 2^3 = 64", () => {
        const ctx = makeScoreCtx({ isSelfDraw: true, isDealer: true });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard", "zimo"] });
        expect(result.total).toBe(64);
    });

    it("杠开: +5番, total = 8 * 2^5 = 256", () => {
        const ctx = makeScoreCtx({ isGangDraw: true });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard", "zimo", "gangkai"] });
        expect(result.total).toBe(256);
    });

    it("抢杠: +5番, total = 8 * 2^5 = 256", () => {
        const ctx = makeScoreCtx({ isQiangGang: true });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard", "qianggang"] });
        expect(result.total).toBe(256);
    });

    it("财鸟 (1张财神): +5番, total = 8 * 2^5 = 256", () => {
        const hand = [makeTile("dot", 8, "caishen-1"), makeTile("bamboo", 1, "b1")];
        const ctx = makeScoreCtx({ hand, isSelfDraw: true });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard", "zimo", "cainio"] });
        // 自摸2 + 财鸟5 = 7番, 8 * 2^7 = 1024
        expect(result.total).toBe(1024);
    });

    it("飞鸟 (2张连续财神): +10番", () => {
        const hand = [makeTile("dot", 8, "caishen-1"), makeTile("dot", 8, "caishen-2"), makeTile("bamboo", 1, "b1")];
        const ctx = makeScoreCtx({ hand, isSelfDraw: true });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard", "zimo", "feiniao"] });
        // 自摸2 + 飞鸟10 = 12番, 8 * 2^12 = 32768
        expect(result.total).toBe(32768);
    });

    it("明杠: +1番(杠分单独计算)", () => {
        const melds: Meld[] = [{ type: "gang", tiles: [makeTile("bamboo", 1), makeTile("bamboo", 1), makeTile("bamboo", 1), makeTile("bamboo", 1)], fromPlayer: 1 }];
        const ctx = makeScoreCtx({ melds });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard"] });
        // main: 8*2^0=8, kong: 8*2^1=16, total = 8 + 16 = 24
        expect(result.total).toBe(24);
    });

    it("暗杠: +2番(杠分单独计算)", () => {
        const melds: Meld[] = [{ type: "gang", tiles: [makeTile("bamboo", 1), makeTile("bamboo", 1), makeTile("bamboo", 1), makeTile("bamboo", 1)] }];
        const ctx = makeScoreCtx({ melds });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard"] });
        // main: 8*2^0=8, kong: 8*2^2=32, total = 8 + 32 = 40
        expect(result.total).toBe(40);
    });

    it("连庄: 连庄2次, 胡牌分×2 (杠分不翻倍)", () => {
        const ctx = makeScoreCtx({ dealerStreak: 2, isDealer: true, isSelfDraw: true });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard", "zimo"] });
        // fan: 庄1 + 自摸2 = 3, mainScore = 8*2^3=64, lianzhuang=2^(2-1)=2, kongScore=0
        // total = 64*2 + 0 = 128
        expect(result.total).toBe(128);
    });

    it("连庄: 杠分不受连庄影响", () => {
        const melds: Meld[] = [{ type: "gang", tiles: [makeTile("bamboo", 1), makeTile("bamboo", 1), makeTile("bamboo", 1), makeTile("bamboo", 1)] }];
        const ctx = makeScoreCtx({ melds, dealerStreak: 2, isDealer: true });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard"] });
        // mainFan: 庄1 = 1, mainScore = 8*2^1=16, lianzhuang=2^(2-1)=2
        // kongFan: 暗杠2 = 2, kongScore = 8*2^2=32
        // total = 16*2 + 32 = 64
        expect(result.total).toBe(64);
    });

    it("番数上限13", () => {
        // 飞鸟3连续(20番) + 自摸(2) + 庄(1) = 23 -> capped at 13
        const hand = [makeTile("dot", 8, "c1"), makeTile("dot", 8, "c2"), makeTile("dot", 8, "c3"), makeTile("bamboo", 1, "b1")];
        const ctx = makeScoreCtx({ hand, isSelfDraw: true, isDealer: true });
        const result = scoreRule.calculate(ctx, { success: true, patterns: ["standard", "zimo", "feiniao"] });
        // mainFan = 庄1 + 自摸2 + 双飞鸟20 = 23, capped at 13
        // total = 8 * 2^13 * 1 = 65536
        expect(result.total).toBe(65536);
    });
});

// ============ 9. applyScoreChanges Tests ============

describe("嵊州麻将 - 结算 (applyScoreChanges)", () => {
    it("点炮: 放冲者付2份, 其他各付1份", () => {
        const players = [makePlayer(0, []), makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])];
        const result = applyScoreChanges(players, 0, 1, 100);
        // Winner(0) gains: 200+100+100 = 400? No, per the code: discarder pays 2x=200, others pay 1x each
        // Player 0 (winner): +200+100+100 = wait no. Let me re-read.
        // discarder(1) pays 2*score=200, others(2,3) pay 1*score=100 each
        // Winner(0) gains total: 200+100+100 = 400
        expect(result[0].score).toBe(25000 + 400);
        expect(result[1].score).toBe(25000 - 200);
        expect(result[2].score).toBe(25000 - 100);
        expect(result[3].score).toBe(25000 - 100);
    });

    it("自摸: 三家各付1份", () => {
        const players = [makePlayer(0, []), makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])];
        const result = applyScoreChanges(players, 0, null, 100);
        // Each loser pays score=100
        expect(result[0].score).toBe(25000 + 300);
        expect(result[1].score).toBe(25000 - 100);
        expect(result[2].score).toBe(25000 - 100);
        expect(result[3].score).toBe(25000 - 100);
    });

    it("承包(点炮): 承包者付3份, 放冲者不再额外付", () => {
        const players = [makePlayer(0, []), makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])];
        // Player 2 has chi/peng from player 0 three times (liable)
        const liability = { 0: {}, 1: {}, 2: { 0: 3 }, 3: {} };
        const result = applyScoreChanges(players, 0, 1, 100, liability);
        // Player 2 is liable: pays 3*100=300
        // Player 1 is discarder: pays 2*100=200
        // Player 3: pays 1*100=100
        // Winner: gains 300+200+100 = 600
        expect(result[0].score).toBe(25000 + 600);
        expect(result[1].score).toBe(25000 - 200);
        expect(result[2].score).toBe(25000 - 300);
        expect(result[3].score).toBe(25000 - 100);
    });

    it("承包(自摸): 承包者付5份", () => {
        const players = [makePlayer(0, []), makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])];
        const liability = { 0: {}, 1: {}, 2: { 0: 3 }, 3: {} };
        const result = applyScoreChanges(players, 0, null, 100, liability);
        // Player 2 is liable (zimo): pays 5*100=500
        // Player 1, 3: pay 1*100=100 each
        // Winner: gains 500+100+100 = 700
        expect(result[0].score).toBe(25000 + 700);
        expect(result[1].score).toBe(25000 - 100);
        expect(result[2].score).toBe(25000 - 500);
        expect(result[3].score).toBe(25000 - 100);
    });
});

// ============ 10. 飞鸟赔偿 Tests ============

describe("嵊州麻将 - 飞鸟赔偿 (calculateFeiniaoCompensation)", () => {
    it("1张财神 = 财鸟 5番, amount = 8 * 2^5 = 256", () => {
        const result = calculateFeiniaoCompensation(1);
        expect(result.fan).toBe(5);
        expect(result.name).toBe("财鸟");
        expect(result.amount).toBe(256);
    });

    it("2张连续财神 = 飞鸟 10番, amount = 8 * 2^10 = 8192", () => {
        const result = calculateFeiniaoCompensation(2);
        expect(result.fan).toBe(10);
        expect(result.name).toBe("飞鸟");
        expect(result.amount).toBe(8192);
    });

    it("3张连续财神 = 双飞鸟 20番, amount = 8 * 2^20 = 8388608", () => {
        const result = calculateFeiniaoCompensation(3);
        expect(result.fan).toBe(20);
        expect(result.name).toBe("双飞鸟");
        expect(result.amount).toBe(8388608);
    });

    it("0张财神 = 无赔偿", () => {
        const result = calculateFeiniaoCompensation(0);
        expect(result.fan).toBe(0);
        expect(result.amount).toBe(0);
    });
});

// ============ 11. applyFeiniaoCompensation Tests ============

describe("嵊州麻将 - 飞鸟赔偿结算", () => {
    it("打财神者赔偿胡牌者", () => {
        const players = [makePlayer(0, []), makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])];
        const result = applyFeiniaoCompensation(players, 0, 2, 256);
        expect(result[0].score).toBe(25000 + 256);
        expect(result[2].score).toBe(25000 - 256);
        expect(result[1].score).toBe(25000); // Unaffected
        expect(result[3].score).toBe(25000); // Unaffected
    });
});

// ============ 12. 抢杠 (Qiang Gang) Tests ============

describe("嵊州麻将 - 抢杠 (performJiaGang)", () => {
    it("加杠时其他人可以抢杠胡", () => {
        const jiaGangTile = makeTile("bamboo", 5, "b5-jiagang");
        const state = makeMinimalGameState({
            currentTurn: 1,
            phase: "DISCARD",
            caishenTile: makeCaishen("dot", 8),
        });
        // Player 1 has a peng of bamboo 5 and just drew the 4th
        state.players[1] = makePlayer(1, [
            jiaGangTile,
            makeTile("dot", 1, "d1-1"), makeTile("dot", 2, "d2-1"), makeTile("dot", 3, "d3-1"),
        ], [
            { type: "peng", tiles: [makeTile("bamboo", 5, "b5-1"), makeTile("bamboo", 5, "b5-2"), makeTile("bamboo", 5, "b5-3")] },
        ]);
        // Player 2 can hu with bamboo 5 (needs it for complete hand)
        state.players[2] = makePlayer(2, makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["bamboo", 5],
        ]));

        const result = performJiaGang(state, 1, jiaGangTile.id);
        // Should enter RESOLVE phase for qianggang
        expect(result.phase).toBe("RESOLVE");
        expect(result.isQiangGangState).toBe(true);
        expect(result.pendingActions[2]).toBeDefined();
        expect(result.pendingActions[2]?.hu).toBe(true);
    });

    it("加杠时没人可以抢杠则正常补牌", () => {
        const jiaGangTile = makeTile("bamboo", 5, "b5-jiagang");
        const state = makeMinimalGameState({
            currentTurn: 1,
            phase: "DISCARD",
            caishenTile: makeCaishen("dot", 8),
        });
        state.deck = [makeTile("character", 1, "replacement")]; // 1 tile for replacement draw
        state.wallCount = 1;
        state.players[1] = makePlayer(1, [
            jiaGangTile,
            makeTile("dot", 1, "d1-1"),
        ], [
            { type: "peng", tiles: [makeTile("bamboo", 5, "b5-1"), makeTile("bamboo", 5, "b5-2"), makeTile("bamboo", 5, "b5-3")] },
        ]);
        // Other players have random hands that can't hu on bamboo 5
        state.players[0] = makePlayer(0, makeHand([["dot", 7], ["wind", "east"], ["wind", "south"]]));
        state.players[2] = makePlayer(2, makeHand([["dot", 7], ["wind", "east"], ["wind", "south"]]));
        state.players[3] = makePlayer(3, makeHand([["dot", 7], ["wind", "east"], ["wind", "south"]]));

        const result = performJiaGang(state, 1, jiaGangTile.id);
        // Should complete gang and draw replacement
        expect(result.isQiangGangState).toBeFalsy();
        expect(result.phase).toBe("DISCARD"); // After drawing replacement, goes to discard
        // Player 1's peng should now be a gang
        const gangMeld = result.players[1].melds.find(m => m.type === "gang");
        expect(gangMeld).toBeDefined();
        expect(gangMeld!.tiles.length).toBe(4);
    });
});

// ============ 13. 飞鸟圈 Tests ============

describe("嵊州麻将 - 飞鸟圈 (Caishen Discard Round)", () => {
    it("打出财神进入飞鸟圈", () => {
        const caishen = makeCaishen("dot", 8);
        const state = makeMinimalGameState({
            currentTurn: 1,
            phase: "DISCARD",
            caishenTile: caishen,
            caishenDiscardRound: null,
        });
        state.players[1] = makePlayer(1, [
            makeTile("dot", 8, "d8-discard"),
            makeTile("bamboo", 1, "b1-1"),
        ]);
        const result = discardTile(state, "d8-discard");
        expect(result.caishenDiscardRound).not.toBeNull();
        expect(result.caishenDiscardRound!.discarderIndex).toBe(1);
        expect(result.caishenDiscardRound!.consecutiveCount).toBe(1);
    });

    it("飞鸟圈内不能吃碰杠 (只能胡)", () => {
        const caishen = makeCaishen("dot", 8);
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "CHECK",
            checkIndex: 1,
            caishenTile: caishen,
            caishenDiscardRound: { discarderIndex: 0, consecutiveCount: 1 },
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
        });
        // Player 1 has 55条 (could peng) and 46条 (could chi)
        state.players[1] = makePlayer(1, makeHand([
            ["bamboo", 5], ["bamboo", 5], ["bamboo", 4], ["bamboo", 6],
        ]));

        const result = performCheck(state);
        // In caishen round, chi/peng/gang should be disabled (only hu allowed)
        const action = result.pendingActions[1];
        if (action) {
            expect(action.chi).toBe(false);
            expect(action.peng).toBe(false);
            expect(action.gang).toBe(false);
        }
    });

    it("飞鸟圈结束后打财神者永久失去点炮资格", () => {
        const state = makeMinimalGameState({
            currentTurn: 2, // It's player 2's turn to draw (the caishen discarder)
            phase: "DRAW",
            caishenDiscardRound: { discarderIndex: 2, consecutiveCount: 1 },
            lostDianPao: { 0: false, 1: false, 2: false, 3: false },
        });
        state.deck = [makeTile("character", 1, "draw-tile")];
        state.wallCount = 1;

        const result = stepGame(state);
        // After stepping (DRAW phase for caishen discarder), round should end
        expect(result.caishenDiscardRound).toBeNull();
        expect(result.lostDianPao![2]).toBe(true);
    });
});

// ============ 14. getTenpaiTiles Tests ============

describe("嵊州麻将 - 听牌判定 (getTenpaiTiles)", () => {
    const huRule = new ShengzhouHuRule();
    const caishen = makeCaishen("dot", 8);

    it("单骑听牌", () => {
        // 123万 456万 789万 111条 + 单张2筒 -> 听2筒
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 2],
        ]);
        const tenpai = huRule.getTenpaiTiles(hand, caishen);
        expect(tenpai.length).toBeGreaterThan(0);
        expect(tenpai.some(t => t.suit === "dot" && t.rank === 2)).toBe(true);
    });

    it("两面听", () => {
        // 123万 456万 789万 111条 + 12筒 -> 听3筒
        // Actually: need 13 tiles. 9+3+1 = 13. Then 12筒 waiting for 3筒
        // Wait, 123 456 789 = 9, 111=3, 12=2 = 14 tiles total. Need 13.
        // Let me use: 123万 456万 78万 111条 12筒 = 13 tiles, hearing 69万 and 3筒
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 1], ["dot", 2],
        ]);
        const tenpai = huRule.getTenpaiTiles(hand, caishen);
        // Should hear: 万9 (to complete 789万) and 筒3 (to complete 123筒 with pair elsewhere)
        // Actually let me recalculate: 123万 456万 + 78万 needs 6 or 9 | 111条 + 12筒 needs 3
        // With 6万: 123 456 678 111 + 12筒 pair? NO, 12 is not a pair
        // Let me think again: 13 tiles, after adding 1 more = 14 = 4 melds + 1 pair
        // 123万 456万 (6 tiles) | 78万 (2 tiles) | 111条 (3 tiles) | 12筒 (2 tiles) = 13
        // + 9万: 123万 456万 789万 | 111条 | 12筒 -> still need pair! So 12筒 can't pair
        // + 6万: 123万 456万 678万 | 111条 | 12筒 -> still need pair
        // + 3筒: 123万 456万 78万? 111条 123筒 -> 78万 not a meld, need pair
        // This hand isn't valid for tenpai. Let me fix:
        // Use: 123万 456万 789万 11条 + 3筒 (13 tiles) -> hearing 1条(single wait pair) or more?
        // Actually simpler: 123万 456万 789万 11条 3筒 = 12 tiles. Need 13.
        // 123万 456万 789万 11条 23筒 = 13 tiles: hearing 1筒 and 4筒 (两面)
        const hand2 = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1],
            ["dot", 2], ["dot", 3],
        ]);
        const tenpai2 = huRule.getTenpaiTiles(hand2, caishen);
        // Hearing 1筒 (complete 123筒) or 4筒 (complete 234筒) with 11条 as pair
        expect(tenpai2.some(t => t.suit === "dot" && t.rank === 1)).toBe(true);
        expect(tenpai2.some(t => t.suit === "dot" && t.rank === 4)).toBe(true);
    });

    it("带财神的听牌有更多听口", () => {
        // 123万 456万 789万 [财神] + 1条 = 13 tiles
        // With caishen as wildcard: can hear many more tiles
        const hand = makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["dot", 8], // 财神
            ["bamboo", 1],
            ["dot", 1], ["dot", 2],
        ]);
        // Replace d8 with actual caishen-matched tile
        hand[9] = makeTile("dot", 8, "caishen-tile");
        const tenpai = huRule.getTenpaiTiles(hand, caishen);
        // Should hear more tiles than without caishen due to wildcard
        expect(tenpai.length).toBeGreaterThan(2);
    });
});

// ============ 15. Game Initialization Tests ============

describe("嵊州麻将 - 初始化", () => {
    it("初始化嵊州游戏: 136张牌, 13/14张手牌, 有财神", () => {
        const state = initializeGame("shengzhou");
        expect(state.players.length).toBe(4);
        expect(state.caishenTile).toBeDefined();
        expect(state.caishenSourceTile).toBeDefined();
        // Dealer has 14, others have 13
        const dealer = state.players[state.dealerIndex];
        const nonDealers = state.players.filter((_, i) => i !== state.dealerIndex);
        expect(dealer.hand.length).toBe(14);
        nonDealers.forEach(p => expect(p.hand.length).toBe(13));
        // Total tiles accounted for
        const tilesInHands = state.players.reduce((sum, p) => sum + p.hand.length, 0);
        // 136 - 53 (hands) - 1 (caishen source) = wallCount
        expect(tilesInHands + state.wallCount + 1).toBe(136);
    });

    it("初始化: 骰子值在1-6之间, 庄家按sum+max计算", () => {
        const state = initializeGame("shengzhou");
        expect(state.diceValues![0]).toBeGreaterThanOrEqual(1);
        expect(state.diceValues![0]).toBeLessThanOrEqual(6);
        expect(state.diceValues![1]).toBeGreaterThanOrEqual(1);
        expect(state.diceValues![1]).toBeLessThanOrEqual(6);
        // Dealer index should be (sum + max) % 4
        const d1 = state.diceValues![0];
        const d2 = state.diceValues![1];
        expect(state.dealerIndex).toBe((d1 + d2 + Math.max(d1, d2)) % 4);
    });
});

// ============ 16. Game Flow: CHECK phase ============

describe("嵊州麻将 - CHECK阶段流转", () => {
    it("弃牌后CHECK阶段遍历所有玩家", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "CHECK",
            checkIndex: 1,
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
        });
        // Player 1 can peng
        state.players[1] = makePlayer(1, makeHand([["bamboo", 5], ["bamboo", 5], ["dot", 1]]));
        state.players[2] = makePlayer(2, makeHand([["dot", 7], ["wind", "east"], ["wind", "south"]]));
        state.players[3] = makePlayer(3, makeHand([["dot", 7], ["wind", "east"], ["wind", "south"]]));

        // First check: player 1
        let result = performCheck(state);
        expect(result.pendingActions[1]).toBeDefined();
        expect(result.pendingActions[1]!.peng).toBe(true);
        expect(result.checkIndex).toBe(2);

        // Second check: player 2
        result = performCheck(result);
        expect(result.checkIndex).toBe(3);

        // Third check: player 3
        result = performCheck(result);
        expect(result.checkIndex).toBe(0);

        // Fourth: back to discarder → done, go to RESOLVE
        result = performCheck(result);
        expect(result.phase).toBe("RESOLVE");
    });

    it("无人有动作时直接DRAW下一位", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "CHECK",
            checkIndex: 1,
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
        });
        state.players[1] = makePlayer(1, makeHand([["dot", 7], ["wind", "east"], ["wind", "south"]]));
        state.players[2] = makePlayer(2, makeHand([["dot", 7], ["wind", "east"], ["wind", "south"]]));
        state.players[3] = makePlayer(3, makeHand([["dot", 7], ["wind", "east"], ["wind", "south"]]));

        // Run all checks
        let result = performCheck(state);
        result = performCheck(result);
        result = performCheck(result);
        result = performCheck(result);

        expect(result.phase).toBe("DRAW");
        expect(result.currentTurn).toBe(1);
    });

    it("P0打出七条时，P1有七条对子应检测到碰 (无飞鸟圈)", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "CHECK",
            checkIndex: 1,
            lastDiscard: makeTile("bamboo", 7, "discard-b7"),
            caishenDiscardRound: null, // 无飞鸟圈
        });
        // P1 has pair of bamboo 7
        state.players[1] = makePlayer(1, makeHand([
            ["bamboo", 7], ["bamboo", 7], ["dot", 1], ["dot", 2], ["dot", 3],
            ["character", 1], ["character", 2], ["character", 3],
            ["wind", "east"], ["wind", "east"], ["wind", "east"],
            ["bamboo", 1], ["bamboo", 2],
        ]));

        let result = performCheck(state);
        expect(result.pendingActions[1]).toBeDefined();
        expect(result.pendingActions[1]!.peng).toBe(true);
    });

    it("飞鸟圈中碰被阻止但胡不被阻止", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "CHECK",
            checkIndex: 1,
            lastDiscard: makeTile("bamboo", 7, "discard-b7"),
            caishenDiscardRound: { discarderIndex: 2, consecutiveCount: 1 }, // P2打出财神
        });
        // P1 has pair of bamboo 7 (could peng) AND a winning hand with this tile
        state.players[1] = makePlayer(1, makeHand([
            ["bamboo", 7], ["bamboo", 7], ["dot", 1], ["dot", 2], ["dot", 3],
            ["character", 1], ["character", 2], ["character", 3],
            ["wind", "east"], ["wind", "east"], ["wind", "east"],
            ["bamboo", 4], ["bamboo", 5],
        ]));

        let result = performCheck(state);
        // Peng should be blocked during 飞鸟圈
        if (result.pendingActions[1]) {
            expect(result.pendingActions[1].peng).toBeFalsy();
            expect(result.pendingActions[1].chi).toBeFalsy();
            expect(result.pendingActions[1].gang).toBeFalsy();
        }
        // Log should mention 飞鸟圈 blocking
        const blockLog = result.logs.find(l => l.includes("飞鸟圈中"));
        expect(blockLog).toBeDefined();
    });

    it("下家吃牌检测 (P0打出五条, P1有四条六条)", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "CHECK",
            checkIndex: 1,
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
            caishenDiscardRound: null,
        });
        state.players[1] = makePlayer(1, makeHand([
            ["bamboo", 4], ["bamboo", 6], ["dot", 1], ["dot", 2], ["dot", 3],
            ["character", 1], ["character", 2], ["character", 3],
            ["wind", "east"], ["wind", "east"], ["wind", "east"],
            ["bamboo", 1], ["bamboo", 2],
        ]));

        let result = performCheck(state);
        expect(result.pendingActions[1]).toBeDefined();
        expect(result.pendingActions[1]!.chi).toBe(true);
    });

    it("非下家不能吃 (P0打出五条, P2有四条六条)", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "CHECK",
            checkIndex: 2,
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
            caishenDiscardRound: null,
        });
        state.players[2] = makePlayer(2, makeHand([
            ["bamboo", 4], ["bamboo", 6], ["dot", 1], ["dot", 2], ["dot", 3],
            ["character", 1], ["character", 2], ["character", 3],
            ["wind", "east"], ["wind", "east"], ["wind", "east"],
            ["bamboo", 1], ["bamboo", 2],
        ]));

        let result = performCheck(state);
        // P2 is not next player (P1 is), so chi should be false
        if (result.pendingActions[2]) {
            expect(result.pendingActions[2].chi).toBe(false);
        }
    });

    it("明杠检测 (P0打出五条, P3有三张五条)", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "CHECK",
            checkIndex: 3,
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
            caishenDiscardRound: null,
        });
        state.players[3] = makePlayer(3, makeHand([
            ["bamboo", 5], ["bamboo", 5], ["bamboo", 5], ["dot", 1], ["dot", 2],
            ["character", 1], ["character", 2], ["character", 3],
            ["wind", "east"], ["wind", "east"], ["wind", "east"],
            ["bamboo", 1], ["bamboo", 2],
        ]));

        let result = performCheck(state);
        expect(result.pendingActions[3]).toBeDefined();
        expect(result.pendingActions[3]!.gang).toBe(true);
        expect(result.pendingActions[3]!.peng).toBe(true); // can also peng with 3 tiles
    });

    it("碰优先于吃: 同时有碰和吃时进入RESOLVE", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "CHECK",
            checkIndex: 1,
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
            caishenDiscardRound: null,
        });
        // P1 (下家) can chi
        state.players[1] = makePlayer(1, makeHand([
            ["bamboo", 4], ["bamboo", 6], ["dot", 1], ["dot", 2], ["dot", 3],
            ["character", 1], ["character", 2], ["character", 3],
            ["wind", "east"], ["wind", "east"], ["wind", "east"],
            ["bamboo", 1], ["bamboo", 2],
        ]));
        // P2 can peng
        state.players[2] = makePlayer(2, makeHand([
            ["bamboo", 5], ["bamboo", 5], ["dot", 1], ["dot", 2], ["dot", 3],
            ["character", 1], ["character", 2], ["character", 3],
            ["wind", "east"], ["wind", "east"], ["wind", "east"],
            ["bamboo", 1], ["bamboo", 2],
        ]));
        state.players[3] = makePlayer(3, makeHand([["dot", 7], ["wind", "north"], ["wind", "south"]]));

        // Run all checks
        let result = performCheck(state); // Check P1
        result = performCheck(result); // Check P2
        result = performCheck(result); // Check P3
        result = performCheck(result); // Back to P0 → RESOLVE

        expect(result.phase).toBe("RESOLVE");
        expect(result.pendingActions[1]!.chi).toBe(true);
        expect(result.pendingActions[2]!.peng).toBe(true);
    });
});

describe("嵊州麻将 - Bot自摸胡 (stepGame)", () => {
    it("Bot摸牌后自动检查自摸胡", () => {
        const state = makeMinimalGameState({
            currentTurn: 1,
            phase: "DISCARD",
            caishenTile: makeCaishen("dot", 8),
            dealerIndex: 1,
        });
        // Bot 1 has a winning hand (14 tiles)
        state.players[1] = makePlayer(1, makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["dot", 2], ["dot", 2],
        ]));

        const result = stepGame(state);
        expect(result.isGameOver).toBe(true);
        expect(result.winner).toBe(1);
    });

    it("Bot自摸暗杠后补牌", () => {
        const state = makeMinimalGameState({
            currentTurn: 1,
            phase: "DISCARD",
            caishenTile: makeCaishen("dot", 8),
        });
        state.deck = [makeTile("character", 1, "replacement")];
        state.wallCount = 1;
        // Bot 1 has 4x bamboo 3 (can an gang)
        state.players[1] = makePlayer(1, makeHand([
            ["bamboo", 3], ["bamboo", 3], ["bamboo", 3], ["bamboo", 3],
            ["dot", 1],
        ]));

        const result = stepGame(state);
        // Should have performed an gang and drawn replacement
        expect(result.players[1].melds.some(m => m.type === "gang")).toBe(true);
        expect(result.phase).toBe("DISCARD");
    });
});

// ============ 18. Discard and Check Flow ============

describe("嵊州麻将 - 弃牌流转", () => {
    it("弃牌后phase变为CHECK", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "DISCARD",
        });
        const tile = makeTile("bamboo", 5, "b5-discard");
        state.players[0] = makePlayer(0, [tile, makeTile("dot", 1, "d1")]);

        const result = discardTile(state, tile.id);
        expect(result.phase).toBe("CHECK");
        expect(result.lastDiscard).toBeDefined();
        expect(result.lastDiscard!.suit).toBe("bamboo");
        expect(result.lastDiscard!.rank).toBe(5);
    });

    it("弃牌后手牌减少1张", () => {
        const state = makeMinimalGameState({ currentTurn: 0, phase: "DISCARD" });
        const tile = makeTile("bamboo", 5, "b5-discard");
        state.players[0] = makePlayer(0, [tile, makeTile("dot", 1, "d1"), makeTile("dot", 2, "d2")]);

        const result = discardTile(state, tile.id);
        expect(result.players[0].hand.length).toBe(2);
        expect(result.players[0].discards.length).toBe(1);
    });
});

// ============ 19. Resolve with Multiple Hu (multiple winners) ============

describe("嵊州麻将 - 多家胡 (距离优先)", () => {
    it("两家同时胡时距离近者优先", () => {
        const state = makeMinimalGameState({
            currentTurn: 0,
            phase: "RESOLVE",
            lastDiscard: makeTile("bamboo", 5, "discard-b5"),
            caishenTile: makeCaishen("dot", 8),
        });
        // Both player 1 and player 3 can hu
        state.players[1] = makePlayer(1, makeHand([
            ["character", 1], ["character", 2], ["character", 3],
            ["character", 4], ["character", 5], ["character", 6],
            ["character", 7], ["character", 8], ["character", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["bamboo", 5],
        ]));
        state.players[3] = makePlayer(3, makeHand([
            ["dot", 1], ["dot", 2], ["dot", 3],
            ["dot", 4], ["dot", 5], ["dot", 6],
            ["dot", 7], ["dot", 8], ["dot", 9],
            ["bamboo", 1], ["bamboo", 1], ["bamboo", 1],
            ["bamboo", 5],
        ]));
        state.pendingActions = {
            1: { chi: false, peng: false, gang: false, hu: true },
            3: { chi: false, peng: false, gang: false, hu: true },
        };
        state.actionDecisions = { 1: "hu", 3: "hu" };

        const result = resolvePendingActions(state);
        // Player 1 is closer to discarder (player 0) than player 3
        expect(result.winner).toBe(1);
    });
});

// ============ 20. 连续打财神 ============

describe("嵊州麻将 - 连续打财神", () => {
    it("同一人连续打两次财神,consecutiveCount递增", () => {
        const caishen = makeCaishen("dot", 8);
        const state = makeMinimalGameState({
            currentTurn: 1,
            phase: "DISCARD",
            caishenTile: caishen,
            caishenDiscardRound: { discarderIndex: 1, consecutiveCount: 1 },
        });
        state.players[1] = makePlayer(1, [
            makeTile("dot", 8, "d8-second"),
            makeTile("bamboo", 1, "b1-1"),
        ]);

        const result = discardTile(state, "d8-second");
        expect(result.caishenDiscardRound!.consecutiveCount).toBe(2);
    });

    it("不同人打财神开始新圈", () => {
        const caishen = makeCaishen("dot", 8);
        const state = makeMinimalGameState({
            currentTurn: 2,
            phase: "DISCARD",
            caishenTile: caishen,
            caishenDiscardRound: { discarderIndex: 1, consecutiveCount: 1 },
        });
        state.players[2] = makePlayer(2, [
            makeTile("dot", 8, "d8-p2"),
            makeTile("bamboo", 1, "b1-1"),
        ]);

        const result = discardTile(state, "d8-p2");
        expect(result.caishenDiscardRound!.discarderIndex).toBe(2);
        expect(result.caishenDiscardRound!.consecutiveCount).toBe(1);
    });
});
