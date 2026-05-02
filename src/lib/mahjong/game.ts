import { DebugScenario, GameState, GameActionRecord, LlmAdviceRecord, Player, ReplayEvent, Tile, Region, GameRules, MahjongRuleSet } from "./types";
import { generateDeck, shuffleDeck } from "./deck";
import { createRuleSet } from "./rules";
import { createGameContext } from "./rules/context";
import { buildDebugGamePieces, sortTiles, validateDebugScenario } from "./debug";

function createReplaySnapshot(gameState: GameState): ReplayEvent["snapshot"] {
    return {
        players: gameState.players.map((player) => ({
            ...player,
            hand: [...player.hand],
            discards: [...player.discards],
            melds: player.melds.map((meld) => ({ ...meld, tiles: [...meld.tiles] })),
        })),
        deck: [...gameState.deck],
        currentTurn: gameState.currentTurn,
        winner: gameState.winner,
        lastDiscard: gameState.lastDiscard,
        isGameOver: gameState.isGameOver,
        isWaitingForAction: gameState.isWaitingForAction,
        pendingActions: { ...gameState.pendingActions },
        actionDecisions: { ...gameState.actionDecisions },
        wallCount: gameState.wallCount,
        rules: gameState.rules,
        actionTimer: gameState.actionTimer,
        logs: [...gameState.logs],
        phase: gameState.phase,
        checkIndex: gameState.checkIndex,
        caishenTile: gameState.caishenTile,
        caishenSourceTile: gameState.caishenSourceTile,
        diceValues: gameState.diceValues,
    };
}

function appendReplayEvent(
    gameState: GameState,
    event: Omit<ReplayEvent, "id" | "timestamp" | "snapshot" | "llmAdvice">
): GameState {
    const nextState = { ...gameState };
    const replayEvent: ReplayEvent = {
        ...event,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        snapshot: createReplaySnapshot(nextState),
        llmAdvice: [...nextState.llmAdvice],
    };
    return {
        ...nextState,
        replayEvents: [...nextState.replayEvents, replayEvent],
    };
}

export function recordLlmAdvice(gameState: GameState, advice: Omit<LlmAdviceRecord, "timestamp">): GameState {
    const entry: LlmAdviceRecord = { ...advice, timestamp: Date.now() };
    const nextState = {
        ...gameState,
        llmAdvice: [...gameState.llmAdvice, entry],
        logs: [...gameState.logs, `LLM ${entry.mode} advice for Player ${entry.playerIndex}: ${entry.result}`],
    };
    return appendReplayEvent(nextState, {
        type: "llm",
        playerIndex: entry.playerIndex,
        action: entry.result,
        message: `LLM ${entry.mode} advice for Player ${entry.playerIndex}: ${entry.result}`,
    });
}

export function recordAction(
    gameState: GameState,
    action: Omit<GameActionRecord, "id" | "sequenceNumber" | "timestamp" | "gameStateSnapshot"> & { actionSource?: GameActionRecord["actionSource"] }
): GameState {
    const record: GameActionRecord = {
        ...action,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sequenceNumber: gameState.actionHistory.length,
        timestamp: Date.now(),
        gameStateSnapshot: createReplaySnapshot(gameState),
        actionSource: action.actionSource ?? "rule_based",
    };
    return {
        ...gameState,
        actionHistory: [...gameState.actionHistory, record],
    };
}

// Apply score changes to players
// 嵊州麻将结算:
// - 自摸: 三家各付 score (winnerIndex gains score*3, each loser loses score)
// - 点炮: 放冲者付 score*2, 其他两家各付 score
// - 承包: 如果某玩家对胡牌者吃/碰3次以上，该玩家承包：
//   - 点炮：承包者付3份
//   - 自摸：承包者付5倍
// discarderIndex: who discarded the winning tile (null for self-draw)
export function applyScoreChanges(
    players: Player[],
    winnerIndex: number,
    discarderIndex: number | null,
    score: number,
    liabilityCount?: Record<number, Record<number, number>>
): Player[] {
    const newPlayers = players.map(p => ({ ...p }));

    // Check for liable player: someone who has chi/peng from the winner 3+ times
    let liablePlayerIndex: number | null = null;
    if (liabilityCount) {
        for (let i = 0; i < 4; i++) {
            if (i === winnerIndex) continue;
            const claimsFromWinner = liabilityCount[i]?.[winnerIndex] || 0;
            if (claimsFromWinner >= 3) {
                liablePlayerIndex = i;
                break;
            }
        }
    }

    if (discarderIndex !== null) {
        // Dianpao: discarder pays double, others pay single
        // 承包: liable player pays 3 shares instead of normal
        let totalGain = 0;
        newPlayers.forEach((p, i) => {
            if (i === winnerIndex) return;
            if (liablePlayerIndex !== null && i === liablePlayerIndex) {
                // 承包: pays 3 shares
                const pay = score * 3;
                p.score -= pay;
                totalGain += pay;
            } else if (i === discarderIndex) {
                const pay = score * 2;
                p.score -= pay;
                totalGain += pay;
            } else {
                p.score -= score;
                totalGain += score;
            }
        });
        newPlayers[winnerIndex].score += totalGain;
    } else {
        // Zimo: all 3 losers pay equally (score each)
        // 承包: liable player pays 5 shares instead of 2
        let totalGain = 0;
        newPlayers.forEach((p, i) => {
            if (i === winnerIndex) return;
            if (liablePlayerIndex !== null && i === liablePlayerIndex) {
                // 承包: pays 5 shares
                const pay = score * 5;
                p.score -= pay;
                totalGain += pay;
            } else {
                p.score -= score;
                totalGain += score;
            }
        });
        newPlayers[winnerIndex].score += totalGain;
    }

    return newPlayers;
}

// 飞鸟赔偿计算: 连续打出财神的人，在该圈内若有人胡，需赔偿
export function calculateFeiniaoCompensation(consecutiveCount: number): { fan: number; name: string; amount: number } {
    const base = 8;
    let fan: number;
    let name: string;
    if (consecutiveCount <= 0) return { fan: 0, name: "", amount: 0 };
    if (consecutiveCount === 1) {
        fan = 5;
        name = "财鸟";
    } else {
        fan = 10 * Math.pow(2, consecutiveCount - 2);
        const names = ["", "", "飞鸟", "双飞鸟", "三飞鸟", "四飞鸟"];
        name = names[consecutiveCount] || `${consecutiveCount}飞鸟`;
    }
    const amount = base * Math.pow(2, fan);
    return { fan, name, amount };
}

// Apply feiniao compensation: discarder pays winner extra
export function applyFeiniaoCompensation(
    players: Player[],
    winnerIndex: number,
    discarderIndex: number,
    compensation: number
): Player[] {
    const newPlayers = players.map(p => ({ ...p }));
    newPlayers[discarderIndex].score -= compensation;
    newPlayers[winnerIndex].score += compensation;
    return newPlayers;
}

// Determine the caishen (wildcard) tile by finding the "next" tile
function getNextTile(tile: Tile): { suit: Tile["suit"]; rank: Tile["rank"] } {
    if (tile.suit === "bamboo" || tile.suit === "character" || tile.suit === "dot") {
        const rank = tile.rank as number;
        return { suit: tile.suit, rank: (rank % 9 + 1) as Tile["rank"] };
    }
    if (tile.suit === "wind") {
        const windOrder = ["east", "south", "west", "north"];
        const idx = windOrder.indexOf(tile.rank as string);
        return { suit: "wind", rank: windOrder[(idx + 1) % 4] as Tile["rank"] };
    }
    if (tile.suit === "dragon") {
        const dragonOrder = ["red", "green", "white"];
        const idx = dragonOrder.indexOf(tile.rank as string);
        return { suit: "dragon", rank: dragonOrder[(idx + 1) % 3] as Tile["rank"] };
    }
    return { suit: tile.suit, rank: tile.rank };
}

export function initializeGame(
    region: Region = "chinese",
    debugScenario?: DebugScenario,
    previousDealerIndex?: number,
    previousDealerStreak?: number
): GameState {
    const ruleSet = createRuleSet(region);
    const rules = ruleSet.config;
    const deck = shuffleDeck(generateDeck(rules));
    const players: Player[] = [];
    const winds: Player["wind"][] = ["east", "south", "west", "north"];

    // Roll dice for dealer determination
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;

    // 庄家确定: 有上局庄家则连庄，否则骰子决定
    let dealerIndex: number;
    let dealerStreak: number;
    if (previousDealerIndex !== undefined) {
        dealerIndex = previousDealerIndex;
        dealerStreak = (previousDealerStreak || 0) + 1;
    } else {
        dealerIndex = region === "shengzhou" ? (dice1 + dice2) % 4 : 0;
        dealerStreak = 1;
    }

    for (let i = 0; i < 4; i++) {
        players.push({
            id: i,
            name: i === 0 ? "You" : `Bot ${i}`,
            hand: [],
            discards: [],
            melds: [],
            isTurn: i === dealerIndex,
            score: 25000,
            wind: winds[(i - dealerIndex + 4) % 4],
        });
    }

    let gameDeck = deck;
    if (debugScenario) {
        validateDebugScenario(region, debugScenario);
        const debugPieces = buildDebugGamePieces(rules, players, debugScenario);
        players.splice(0, players.length, ...debugPieces.players);
        gameDeck = debugPieces.deck;
    } else {
        for (let i = 0; i < rules.handSize; i++) {
            players.forEach((player) => {
                const tile = gameDeck.pop();
                if (tile) player.hand.push(tile);
            });
        }

        players.forEach((player) => {
            player.hand = sortTiles(player.hand);
        });

        // Dealer gets 14th tile
        const firstTile = gameDeck.pop();
        if (firstTile) {
            players[dealerIndex].hand.push(firstTile);
        }
    }

    // Shengzhou: determine caishen (wildcard) tile
    let caishenTile: Tile | undefined;
    let caishenSourceTile: Tile | undefined;
    if (region === "shengzhou" && !debugScenario) {
        // Flip a tile from the wall to determine caishen
        const flippedTile = gameDeck.pop();
        if (flippedTile) {
            caishenSourceTile = flippedTile;
            const nextTileInfo = getNextTile(flippedTile);
            caishenTile = {
                id: `caishen-indicator`,
                suit: nextTileInfo.suit,
                rank: nextTileInfo.rank,
            };
        }
    }

    const startTurn = debugScenario?.currentTurn ?? dealerIndex;
    const initialState: GameState = {
        players,
        deck: gameDeck,
        currentTurn: startTurn,
        winner: null,
        lastDiscard: null,
        isGameOver: false,
        wallCount: gameDeck.length,
        rules,
        actionTimer: 30,
        isWaitingForAction: false,
        pendingActions: {},
        actionDecisions: {},
        logs: ["Game initialized"],
        phase: players[startTurn].hand.length % 3 === 2 ? "DISCARD" : "DRAW",
        checkIndex: 0,
        debugScenario,
        debugScriptIndex: 0,
        replayEvents: [],
        llmAdvice: [],
        actionHistory: [],
        caishenTile,
        caishenSourceTile,
        diceValues: [dice1, dice2] as [number, number],
        dealerIndex,
        liabilityCount: { 0: {}, 1: {}, 2: {}, 3: {} },
        caishenDiscardRound: null,
        lostDianPao: { 0: false, 1: false, 2: false, 3: false },
        dealerStreak,
    };

    return appendReplayEvent(initialState, {
        type: debugScenario ? "debug" : "init",
        message: debugScenario ? `Debug scenario loaded: ${debugScenario.name}` : "Game initialized",
    });
}

export function drawTile(gameState: GameState, fromDeadWall: boolean = false): GameState {
    if (gameState.deck.length === 0) {
        return appendReplayEvent({ ...gameState, isGameOver: true }, {
            type: "resolve",
            message: "Wall exhausted. Draw game.",
        });
    }

    const newDeck = [...gameState.deck];
    const tile = fromDeadWall ? newDeck.shift() : newDeck.pop();

    if (!tile) return gameState;

    const ruleSet = createRuleSet(gameState.rules.region);

    // Check if it's a flower or season tile that should be replaced
    if (ruleSet.drawRule.shouldReplaceFlower(tile) && gameState.rules.hasFlowers) {
        const currentPlayer = gameState.players[gameState.currentTurn];
        const newMelds = [...currentPlayer.melds, {
            type: "gang" as const,
            tiles: [tile],
        }];

        const newPlayers = gameState.players.map((p, i) => {
            if (i === gameState.currentTurn) {
                return { ...p, melds: newMelds };
            }
            return p;
        });

        const logMsg = `Player ${gameState.currentTurn} drew ${tile.suit} tile and draws replacement`;

        return drawTile({
            ...gameState,
            deck: newDeck,
            players: newPlayers,
            wallCount: newDeck.length,
            logs: [...gameState.logs, logMsg],
        }, true);
    }

    const newPlayers = gameState.players.map((p, i) => {
        if (i === gameState.currentTurn) {
            return { ...p, hand: [...p.hand, tile] };
        }
        return p;
    });

    const logMsg = `Player ${gameState.currentTurn} drew ${tile.suit} ${tile.rank}`;

    return appendReplayEvent({
        ...gameState,
        deck: newDeck,
        players: newPlayers,
        wallCount: newDeck.length,
        logs: [...gameState.logs, logMsg],
        phase: "DISCARD",
    }, {
        type: "draw",
        playerIndex: gameState.currentTurn,
        tile,
        message: logMsg,
    });
}

export function drawFromDeadWall(gameState: GameState): GameState {
    return drawTile(gameState, true);
}

// Helper to check if any player has actions on the discarded tile
function checkActionsOnDiscard(gameState: GameState, discard: Tile, discarderIndex: number): { pendingActions: GameState["pendingActions"], logs: string[] } {
    const ruleSet = createRuleSet(gameState.rules.region);
    const pendingActions: GameState["pendingActions"] = {};
    const newLogs: string[] = [];
    let hasAction = false;

    gameState.players.forEach((player, index) => {
        if (index === discarderIndex) return;

        const isNextPlayer = index === (discarderIndex + 1) % 4;
        const ctx = createGameContext(gameState, index, { discard });

        newLogs.push(`Player ${index} checking actions for ${discard.suit} ${discard.rank}...`);

        const canChi = isNextPlayer && ruleSet.chiRule.canChi(ctx);
        const canPeng = ruleSet.pengRule.canPeng(ctx);
        const canGang = ruleSet.gangRule.canGang(ctx);
        const huResult = ruleSet.huRule.canHu(ctx);
        const canHu = huResult.success;

        if (canChi) newLogs.push(`  - Player ${index} can Chi`);
        if (canPeng) newLogs.push(`  - Player ${index} can Peng`);
        if (canGang) newLogs.push(`  - Player ${index} can Gang`);
        if (canHu) newLogs.push(`  - Player ${index} can Hu`);

        if (canChi || canPeng || canGang || canHu) {
            pendingActions[index] = {
                chi: canChi,
                peng: canPeng,
                gang: canGang,
                hu: canHu
            };
            hasAction = true;
        }
    });

    return { pendingActions: hasAction ? pendingActions : {}, logs: newLogs };
}

export function discardTile(gameState: GameState, tileId: string): GameState {
    const currentPlayerIndex = gameState.currentTurn;
    const currentPlayer = gameState.players[currentPlayerIndex];

    const tileIndex = currentPlayer.hand.findIndex((t) => t.id === tileId);
    if (tileIndex === -1) return gameState;

    const tile = currentPlayer.hand[tileIndex];
    const newHand = [...currentPlayer.hand];
    newHand.splice(tileIndex, 1);

    newHand.sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        if (typeof a.rank === "number" && typeof b.rank === "number") {
            return a.rank - b.rank;
        }
        return String(a.rank).localeCompare(String(b.rank));
    });

    const newPlayers = [...gameState.players];
    newPlayers[currentPlayerIndex] = {
        ...currentPlayer,
        hand: newHand,
        discards: [...currentPlayer.discards, tile],
    };

    // 财神弃牌检测
    let newCaishenRound = gameState.caishenDiscardRound;
    const newLogs = [...gameState.logs, `Player ${currentPlayerIndex} discarded ${tile.suit} ${tile.rank}`];
    if (gameState.caishenTile &&
        tile.suit === gameState.caishenTile.suit &&
        tile.rank === gameState.caishenTile.rank) {
        if (newCaishenRound && newCaishenRound.discarderIndex === currentPlayerIndex) {
            // 连续打财神
            newCaishenRound = { ...newCaishenRound, consecutiveCount: newCaishenRound.consecutiveCount + 1 };
            newLogs.push(`Player ${currentPlayerIndex} discards caishen AGAIN (${newCaishenRound.consecutiveCount} consecutive) - 飞鸟圈!`);
        } else {
            // 新的财神弃牌圈
            newCaishenRound = { discarderIndex: currentPlayerIndex, consecutiveCount: 1 };
            newLogs.push(`Player ${currentPlayerIndex} discards caishen - 飞鸟圈开始!`);
        }
    }

    const tempState = {
        ...gameState,
        players: newPlayers,
        lastDiscard: tile,
        logs: newLogs,
        phase: "CHECK" as const,
        checkIndex: (currentPlayerIndex + 1) % 4,
        pendingActions: {},
        caishenDiscardRound: newCaishenRound,
    };

    return appendReplayEvent(tempState, {
        type: "discard",
        playerIndex: currentPlayerIndex,
        tile,
        message: `Player ${currentPlayerIndex} discarded ${tile.suit} ${tile.rank}`,
    });
}

// Check a single player for actions
export function performCheck(gameState: GameState): GameState {
    if (gameState.phase !== "CHECK") return gameState;

    const { checkIndex, lastDiscard, currentTurn } = gameState;
    if (!lastDiscard) return gameState;

    // If we looped back to the discarder, checking is done
    if (checkIndex === currentTurn) {
        const hasPending = Object.keys(gameState.pendingActions).length > 0;
        if (hasPending) {
            return appendReplayEvent({
                ...gameState,
                phase: "RESOLVE",
                isWaitingForAction: true,
                actionTimer: 30,
                logs: [...gameState.logs, "Checks complete. Waiting for actions..."],
            }, {
                type: "check",
                message: "Checks complete. Waiting for actions.",
            });
        } else {
            return appendReplayEvent({
                ...gameState,
                phase: "DRAW",
                currentTurn: (currentTurn + 1) % 4,
                logs: [...gameState.logs, "No actions. Next turn."],
            }, {
                type: "resolve",
                message: "No actions. Next turn.",
            });
        }
    }

    const player = gameState.players[checkIndex];
    const ruleSet = createRuleSet(gameState.rules.region);
    const ctx = createGameContext(gameState, checkIndex, { discard: lastDiscard });
    const newLogs = [...gameState.logs];

    newLogs.push(`Player ${checkIndex} checking actions for ${lastDiscard.suit} ${lastDiscard.rank}...`);

    const isNextPlayer = checkIndex === (currentTurn + 1) % 4;
    // 财神弃牌圈: 不能吃碰杠，只能胡
    const inCaishenRound = !!gameState.caishenDiscardRound;
    const canChi = !inCaishenRound && isNextPlayer && ruleSet.chiRule.canChi(ctx);
    const canPeng = !inCaishenRound && ruleSet.pengRule.canPeng(ctx);
    const canGang = !inCaishenRound && ruleSet.gangRule.canGang(ctx);
    const huResult = ruleSet.huRule.canHu(ctx);
    const canHu = huResult.success;

    if (inCaishenRound) {
        // Log blocked actions during 飞鸟圈 for debugging
        const wouldChi = isNextPlayer && ruleSet.chiRule.canChi(ctx);
        const wouldPeng = ruleSet.pengRule.canPeng(ctx);
        const wouldGang = ruleSet.gangRule.canGang(ctx);
        if (wouldChi || wouldPeng || wouldGang) {
            newLogs.push(`  - 飞鸟圈中: Player ${checkIndex} 的吃/碰/杠被禁止 (只能胡)`);
        }
    }

    if (canChi) newLogs.push(`  - Player ${checkIndex} can Chi`);
    if (canPeng) newLogs.push(`  - Player ${checkIndex} can Peng`);
    if (canGang) newLogs.push(`  - Player ${checkIndex} can Gang`);
    if (canHu) newLogs.push(`  - Player ${checkIndex} can Hu`);

    const newPendingActions = { ...gameState.pendingActions };
    if (canChi || canPeng || canGang || canHu) {
        newPendingActions[checkIndex] = {
            chi: canChi,
            peng: canPeng,
            gang: canGang,
            hu: canHu
        };
    }

    return appendReplayEvent({
        ...gameState,
        checkIndex: (checkIndex + 1) % 4,
        pendingActions: newPendingActions,
        logs: newLogs,
    }, {
        type: "check",
        playerIndex: checkIndex,
        tile: lastDiscard,
        message: `Player ${checkIndex} checked actions for ${lastDiscard.suit} ${lastDiscard.rank}`,
    });
}

// Central State Transition Function
export function stepGame(gameState: GameState): GameState {
    if (gameState.isGameOver) return gameState;

    switch (gameState.phase) {
        case "DRAW": {
            // 财神弃牌圈结束检测: 当打财神的人轮到摸牌时，圈结束
            let state = gameState;
            if (state.caishenDiscardRound && state.currentTurn === state.caishenDiscardRound.discarderIndex) {
                const newLostDianPao = { ...state.lostDianPao };
                newLostDianPao[state.caishenDiscardRound.discarderIndex] = true;
                state = {
                    ...state,
                    caishenDiscardRound: null,
                    lostDianPao: newLostDianPao,
                    logs: [...state.logs, `飞鸟圈结束: Player ${state.caishenDiscardRound.discarderIndex} 摸牌，永久失去点炮资格`],
                };
            }
            return drawTile(state);
        }

        case "DISCARD":
            // For bots: only check instant self-draw actions (hu/gang), then wait for LLM
            if (gameState.currentTurn !== 0) {
                const botHand = gameState.players[gameState.currentTurn].hand;
                if (botHand.length > 0) {
                    const ruleSet = createRuleSet(gameState.rules.region);
                    const currentTurn = gameState.currentTurn;
                    const ctx = createGameContext(gameState, currentTurn, { isSelfDraw: true });

                    // Check self-draw Hu (Tsumo) - instant, no LLM needed
                    const huResult = ruleSet.huRule.canHu(ctx);
                    if (huResult.success) {
                        const scoreResult = ruleSet.scoreRule.calculate(ctx, huResult);
                        const newPlayers = applyScoreChanges(gameState.players, currentTurn, null, scoreResult.total, gameState.liabilityCount);
                        const newLogs = [...gameState.logs];
                        let finalPlayers = newPlayers;
                        if (gameState.liabilityCount) {
                            for (let i = 0; i < 4; i++) {
                                if (i === currentTurn) continue;
                                const claims = gameState.liabilityCount[i]?.[currentTurn] || 0;
                                if (claims >= 3) {
                                    newLogs.push(`承包: Player ${i} has chi/peng from Player ${currentTurn} ${claims} times - liable!`);
                                }
                            }
                        }
                        // 飞鸟赔偿
                        if (gameState.caishenDiscardRound) {
                            const { discarderIndex, consecutiveCount } = gameState.caishenDiscardRound;
                            if (discarderIndex !== currentTurn) {
                                const comp = calculateFeiniaoCompensation(consecutiveCount);
                                finalPlayers = applyFeiniaoCompensation(finalPlayers, currentTurn, discarderIndex, comp.amount);
                                newLogs.push(`飞鸟赔偿: Player ${discarderIndex} 连续打出${consecutiveCount}个财神(${comp.name} ${comp.fan}番)，赔偿 Player ${currentTurn} ${comp.amount}分`);
                            }
                        }
                        newLogs.push(`Bot ${currentTurn} wins with self-draw Hu! Score: ${scoreResult.total}`);
                        return appendReplayEvent({
                            ...gameState,
                            players: finalPlayers,
                            winner: currentTurn,
                            isGameOver: true,
                            scoreResult,
                            logs: newLogs,
                        }, {
                            type: "win",
                            playerIndex: currentTurn,
                            action: "hu",
                            message: `Bot ${currentTurn} wins with self-draw Hu! Score: ${scoreResult.total}`,
                        });
                    }

                    // Check self-draw Gang (An Gang) - instant, no LLM needed
                    const gangTile = ruleSet.gangRule.getSelfDrawGangTile?.(ctx);
                    if (gangTile) {
                        const newMeld = {
                            type: "gang" as const,
                            tiles: botHand.filter(t => t.suit === gangTile.suit && t.rank === gangTile.rank),
                        };
                        const newHand = botHand.filter(t => !(t.suit === gangTile.suit && t.rank === gangTile.rank));
                        const newPlayers = [...gameState.players];
                        newPlayers[currentTurn] = {
                            ...newPlayers[currentTurn],
                            hand: newHand,
                            melds: [...newPlayers[currentTurn].melds, newMeld],
                        };
                        return drawTile({
                            ...gameState,
                            players: newPlayers,
                            logs: [...gameState.logs, `Bot ${currentTurn} performs An Gang (Concealed Kong)`],
                        }, true);
                    }

                    // No instant actions - wait for LLM to decide discard
                    return gameState;
                }
            }
            // If human turn, we wait for UI interaction (handleTileClick calls discardTile)
            return gameState;

        case "CHECK":
            return performCheck(gameState);

        case "RESOLVE":
            // Don't auto-decide for bots - wait for LLM in Table.tsx
            // Only resolve if all players have decided
            return resolvePendingActions(gameState);

        default:
            return gameState;
    }
}

// Execute the action (Peng, Gang, Chi)
function performAction(gameState: GameState, playerIndex: number, action: string): GameState {
    const player = gameState.players[playerIndex];
    const discard = gameState.lastDiscard!;
    let newHand = [...player.hand];
    const newMelds = [...player.melds];

    const discarderIndex = gameState.currentTurn;
    const discarder = gameState.players[discarderIndex];
    const newDiscarderDiscards = [...discarder.discards];
    newDiscarderDiscards.pop();

    const newPlayers = [...gameState.players];
    newPlayers[discarderIndex] = { ...discarder, discards: newDiscarderDiscards };

    if (action === "peng") {
        let removed = 0;
        newHand = newHand.filter(t => {
            if (removed < 2 && t.suit === discard.suit && t.rank === discard.rank) {
                removed++;
                return false;
            }
            return true;
        });
        newMelds.push({ type: "peng", tiles: [discard, discard, discard] });
    } else if (action === "gang") {
        let removed = 0;
        newHand = newHand.filter(t => {
            if (removed < 3 && t.suit === discard.suit && t.rank === discard.rank) {
                removed++;
                return false;
            }
            return true;
        });
        newMelds.push({ type: "gang", tiles: [discard, discard, discard, discard] });
    } else if (action === "chi") {
        if (typeof discard.rank === "number") {
            const rank = discard.rank;
            const suit = discard.suit;

            const sequences: [number, number][] = [
                [rank - 2, rank - 1],
                [rank - 1, rank + 1],
                [rank + 1, rank + 2],
            ];

            for (const [r1, r2] of sequences) {
                const idx1 = newHand.findIndex(t => t.suit === suit && t.rank === r1);
                if (idx1 === -1) continue;
                const idx2 = newHand.findIndex((t, i) => i !== idx1 && t.suit === suit && t.rank === r2);
                if (idx2 === -1) continue;

                const tile1 = newHand[idx1];
                const tile2 = newHand[idx2];
                newHand = newHand.filter((_, i) => i !== idx1 && i !== idx2);

                const meldTiles = [tile1, discard, tile2].sort((a, b) => {
                    if (typeof a.rank === "number" && typeof b.rank === "number") {
                        return a.rank - b.rank;
                    }
                    return 0;
                });
                newMelds.push({ type: "chi", tiles: meldTiles });
                break;
            }
        }
    }

    newPlayers[playerIndex] = {
        ...player,
        hand: newHand,
        melds: newMelds
    };

    // 承包 (Liability) tracking: count chi/peng claims between players
    const newLiability = { ...gameState.liabilityCount };
    if (action === "chi" || action === "peng") {
        const claimer = playerIndex;
        const discarder = discarderIndex;
        if (!newLiability[claimer]) newLiability[claimer] = {};
        newLiability[claimer] = {
            ...newLiability[claimer],
            [discarder]: (newLiability[claimer]?.[discarder] || 0) + 1,
        };
    }

    return appendReplayEvent({
        ...gameState,
        players: newPlayers,
        currentTurn: playerIndex,
        isWaitingForAction: false,
        pendingActions: {},
        actionDecisions: {},
        actionTimer: 30,
        lastDiscard: null,
        liabilityCount: newLiability,
        logs: [...gameState.logs, `Player ${playerIndex} performed ${action}`],
        phase: "DISCARD",
    }, {
        type: "action",
        playerIndex,
        tile: discard,
        action,
        message: `Player ${playerIndex} performed ${action}`,
    });
}

export function resolvePendingActions(gameState: GameState): GameState {
    const { pendingActions, actionDecisions } = gameState;
    const pendingPlayers = Object.keys(pendingActions).map(Number);

    const allDecided = pendingPlayers.every(p => actionDecisions[p] !== undefined);
    if (!allDecided) return gameState;

    const actors = pendingPlayers.filter(p => actionDecisions[p] !== "pass");

    if (actors.length === 0) {
        if (gameState.isQiangGangState) {
            // All passed on qianggang - complete the kong and draw replacement
            const kongDeclarer = gameState.currentTurn;
            const player = gameState.players[kongDeclarer];
            const tile = gameState.lastDiscard!;

            // Find the peng meld to promote
            const meldIndex = player.melds.findIndex(
                m => m.type === "peng" && m.tiles[0]?.suit === tile.suit && m.tiles[0]?.rank === tile.rank
            );

            if (meldIndex !== -1) {
                const newHand = player.hand.filter(t => t.id !== tile.id);
                const newMelds = [...player.melds];
                newMelds[meldIndex] = {
                    type: "gang",
                    tiles: [...newMelds[meldIndex].tiles, tile]
                };
                const newPlayers = [...gameState.players];
                newPlayers[kongDeclarer] = { ...player, hand: newHand, melds: newMelds };

                return drawTile({
                    ...gameState,
                    players: newPlayers,
                    isWaitingForAction: false,
                    pendingActions: {},
                    actionDecisions: {},
                    isQiangGangState: false,
                    lastDiscard: null,
                    logs: [...gameState.logs, `All passed on 抢杠. Player ${kongDeclarer} completes Jia Gang.`],
                }, true);
            }
        }

        // Normal pass - advance to next player
        const nextTurn = (gameState.currentTurn + 1) % 4;
        return appendReplayEvent({
            ...gameState,
            currentTurn: nextTurn,
            isWaitingForAction: false,
            pendingActions: {},
            actionDecisions: {},
            isQiangGangState: false,
            actionTimer: 30,
            logs: [...gameState.logs, "All players passed"],
            phase: "DRAW",
        }, {
            type: "resolve",
            message: "All players passed",
        });
    }

    actors.sort((a, b) => {
        const actionA = actionDecisions[a];
        const actionB = actionDecisions[b];

        const priority = { "hu": 3, "gang": 2, "peng": 2, "chi": 1 };
        const pA = priority[actionA as keyof typeof priority] || 0;
        const pB = priority[actionB as keyof typeof priority] || 0;

        if (pA !== pB) return pB - pA;

        const distA = (a - gameState.currentTurn + 4) % 4;
        const distB = (b - gameState.currentTurn + 4) % 4;
        return distA - distB;
    });

    const winnerIndex = actors[0];
    const winningAction = actionDecisions[winnerIndex];

    if (winningAction === "hu") {
        const ruleSet = createRuleSet(gameState.rules.region);
        const isQiangGang = gameState.isQiangGangState === true;
        const ctx = createGameContext(gameState, winnerIndex, {
            discard: gameState.lastDiscard || undefined,
            isQiangGang,
        });
        const huResult = ruleSet.huRule.canHu(ctx);
        const scoreResult = ruleSet.scoreRule.calculate(ctx, huResult);
        const newPlayers = applyScoreChanges(gameState.players, winnerIndex, gameState.currentTurn, scoreResult.total, gameState.liabilityCount);

        // Log liability info if applicable
        const newLogs = [...gameState.logs];
        let finalPlayers = newPlayers;
        if (gameState.liabilityCount) {
            for (let i = 0; i < 4; i++) {
                if (i === winnerIndex) continue;
                const claims = gameState.liabilityCount[i]?.[winnerIndex] || 0;
                if (claims >= 3) {
                    newLogs.push(`承包: Player ${i} has chi/peng from Player ${winnerIndex} ${claims} times - liable!`);
                }
            }
        }

        // 飞鸟赔偿: 财神弃牌圈内有人胡，打财神者赔偿
        if (gameState.caishenDiscardRound) {
            const { discarderIndex, consecutiveCount } = gameState.caishenDiscardRound;
            if (discarderIndex !== winnerIndex) {
                const comp = calculateFeiniaoCompensation(consecutiveCount);
                finalPlayers = applyFeiniaoCompensation(finalPlayers, winnerIndex, discarderIndex, comp.amount);
                newLogs.push(`飞鸟赔偿: Player ${discarderIndex} 连续打出${consecutiveCount}个财神(${comp.name} ${comp.fan}番)，赔偿 Player ${winnerIndex} ${comp.amount}分`);
            }
        }

        newLogs.push(`Player ${winnerIndex} wins with Hu! Score: ${scoreResult.total}`);

        return appendReplayEvent({
            ...gameState,
            players: finalPlayers,
            winner: winnerIndex,
            isGameOver: true,
            scoreResult,
            isWaitingForAction: false,
            pendingActions: {},
            actionDecisions: {},
            logs: newLogs,
        }, {
            type: "win",
            playerIndex: winnerIndex,
            action: "hu",
            message: `Player ${winnerIndex} wins with Hu! Score: ${scoreResult.total}`,
        });
    }

    return performAction(gameState, winnerIndex, winningAction);
}

export function checkWin(hand: Tile[], region: Region = "chinese"): boolean {
    const ruleSet = createRuleSet(region);
    return ruleSet.huRule.checkWin(hand);
}

// Jia Gang (Add Kong): Promote an existing Peng to a Kong when drawing the 4th tile
export function canJiaGang(player: Player): Tile | null {
    for (const meld of player.melds) {
        if (meld.type === "peng" && meld.tiles.length > 0) {
            const pengTile = meld.tiles[0];
            const matchingTile = player.hand.find(
                t => t.suit === pengTile.suit && t.rank === pengTile.rank
            );
            if (matchingTile) {
                return matchingTile;
            }
        }
    }
    return null;
}

export function performJiaGang(gameState: GameState, playerIndex: number, tileId: string): GameState {
    const player = gameState.players[playerIndex];
    const tile = player.hand.find(t => t.id === tileId);

    if (!tile) return gameState;

    const meldIndex = player.melds.findIndex(
        m => m.type === "peng" && m.tiles[0]?.suit === tile.suit && m.tiles[0]?.rank === tile.rank
    );

    if (meldIndex === -1) return gameState;

    // 抢杠 (Robbing the Kong): Check if any other player can hu off this tile
    // before completing the kong
    const ruleSet = createRuleSet(gameState.rules.region);
    const newPendingActions: GameState["pendingActions"] = {};
    let hasQiangGang = false;

    gameState.players.forEach((p, i) => {
        if (i === playerIndex) return; // Skip the kong declarer
        const ctx = createGameContext(gameState, i, {
            discard: tile,
            isSelfDraw: false,
            isQiangGang: true,
        });
        const huResult = ruleSet.huRule.canHu(ctx);
        if (huResult.success) {
            newPendingActions[i] = { chi: false, peng: false, gang: false, hu: true };
            hasQiangGang = true;
        }
    });

    if (hasQiangGang) {
        // Someone can rob the kong - enter RESOLVE phase to let them decide
        return appendReplayEvent({
            ...gameState,
            lastDiscard: tile,
            isWaitingForAction: true,
            pendingActions: newPendingActions,
            actionDecisions: {},
            actionTimer: 30,
            phase: "RESOLVE",
            isQiangGangState: true,
            currentTurn: playerIndex, // The kong declarer is the "discarder" for scoring
            logs: [...gameState.logs, `Player ${playerIndex} declares Jia Gang - checking for 抢杠 (Robbing Kong)`],
        }, {
            type: "action",
            playerIndex,
            tile,
            action: "jia_gang",
            message: `Player ${playerIndex} declares Jia Gang - checking for 抢杠`,
        });
    }

    // No one can rob the kong - proceed normally
    const newHand = player.hand.filter(t => t.id !== tileId);

    const newMelds = [...player.melds];
    newMelds[meldIndex] = {
        type: "gang",
        tiles: [...newMelds[meldIndex].tiles, tile]
    };

    const newPlayers = [...gameState.players];
    newPlayers[playerIndex] = {
        ...player,
        hand: newHand,
        melds: newMelds
    };

    return drawTile({
        ...gameState,
        players: newPlayers,
        logs: [...gameState.logs, `Player ${playerIndex} performs Jia Gang (Add Kong)`],
    }, true);
}
