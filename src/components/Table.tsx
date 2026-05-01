"use client";

import React, { useEffect, useState, useRef } from "react";
import { DebugScenario, GameState, Region, ReplayEvent } from "@/lib/mahjong/types";
import { initializeGame, drawTile, discardTile, recordLlmAdvice, recordAction, resolvePendingActions, stepGame } from "@/lib/mahjong/game";
import { createRuleSet } from "@/lib/mahjong/rules";
import { createGameContext } from "@/lib/mahjong/rules/context";
import { Hand } from "./Hand";
import { DiscardPile } from "./DiscardPile";
import { TurnIndicator } from "./TurnIndicator";
import { ActionButtons } from "./ActionButtons";
import { MeldDisplay } from "./MeldDisplay";
import { GameOverScreen } from "./GameOverScreen";
import { GameInfo } from "./GameInfo";
import { GameLog } from "./GameLog";
import { GameReview } from "./GameReview";
import { DiceAnimation } from "./DiceAnimation";
import { CaishenReveal } from "./CaishenReveal";
import { CaishenDisplay } from "./CaishenDisplay";
import { cn } from "@/lib/utils";
import { chooseBotDiscard, decideBotAction } from "@/lib/mahjong/botAI";
import { MahjongAction, requestMahjongAI } from "@/lib/mahjong/llmAI";
import { DEBUG_SCENARIOS, formatTile } from "@/lib/mahjong/debug";
import { playSound } from "@/lib/sounds";

interface TableProps {
    region?: Region;
}

interface LLMDebugEntry {
    id: string;
    playerIndex: number;
    mode: "discard" | "action" | "advice";
    result: string;
    analysis: string;
    fallback?: boolean;
}

export function Table({ region: initialRegion = "chinese" }: TableProps) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isDevMode, setIsDevMode] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [autoPause, setAutoPause] = useState(false);
    const [isLlmDebug, setIsLlmDebug] = useState(false);
    const [llmDebugEntries, setLlmDebugEntries] = useState<LLMDebugEntry[]>([]);
    const [thinkingPlayer, setThinkingPlayer] = useState<number | null>(null);
    const [isAdvancedDebug, setIsAdvancedDebug] = useState(false);
    const [debugScenarioText, setDebugScenarioText] = useState(JSON.stringify(DEBUG_SCENARIOS[0], null, 2));
    const [debugError, setDebugError] = useState<string | null>(null);
    const [showReplay, setShowReplay] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const [tenpaiTileIds, setTenpaiTileIds] = useState<Set<string>>(new Set());
    const [showGameLog, setShowGameLog] = useState(false);
    const [llmAnalysis, setLlmAnalysis] = useState<string | null>(null);
    const [isLlmLoading, setIsLlmLoading] = useState(false);
    const [llmAnalysisKey, setLlmAnalysisKey] = useState<string>("");
    const [deferredAnalysisMode, setDeferredAnalysisMode] = useState(false);
    const [showReview, setShowReview] = useState(false);

    // Shengzhou game start ceremony states
    const [showDiceAnimation, setShowDiceAnimation] = useState(false);
    const [showCaishenReveal, setShowCaishenReveal] = useState(false);
    const [ceremonyComplete, setCeremonyComplete] = useState(false);

    // Refs to avoid stale closures in async loops
    const isPausedRef = useRef(isPaused);
    const autoPauseRef = useRef(autoPause);
    const llmInFlightRef = useRef(false);
    const adviceInFlightRef = useRef(false);
    const adviceKeyRef = useRef("");

    useEffect(() => {
        isPausedRef.current = isPaused;
        autoPauseRef.current = autoPause;
    }, [isPaused, autoPause]);

    const [region] = useState<Region>(initialRegion);
    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addLlmDebugEntry = (entry: Omit<LLMDebugEntry, "id">) => {
        setLlmDebugEntries((prev) => [
            { ...entry, id: `${Date.now()}-${Math.random()}` },
            ...prev,
        ].slice(0, 12));
    };

    const recordAdviceOnCurrentState = (entry: Omit<LLMDebugEntry, "id">) => {
        setGameState((current) => {
            if (!current) return current;
            return recordLlmAdvice(current, {
                playerIndex: entry.playerIndex,
                mode: entry.mode,
                result: entry.result,
                analysis: entry.analysis,
                fallback: entry.fallback,
            });
        });
    };

    const runBotDiscardWithLLM = async (state: GameState) => {
        const playerIndex = state.currentTurn;
        const fallbackTileId = chooseBotDiscard(state.players[playerIndex].hand);
        llmInFlightRef.current = true;
        setThinkingPlayer(playerIndex);

        // In deferred mode, skip LLM and use rule-based AI
        if (deferredAnalysisMode) {
            addLlmDebugEntry({
                playerIndex,
                mode: "discard",
                result: `deferred discard ${fallbackTileId}`,
                analysis: "延迟分析模式：使用规则 AI",
                fallback: true,
            });
            setGameState((current) => {
                if (!current || current.isGameOver || current.phase !== "DISCARD" || current.currentTurn !== playerIndex) {
                    return current;
                }
                // Record action
                const tile = current.players[playerIndex].hand.find(t => t.id === fallbackTileId);
                const withAction = recordAction(current, {
                    playerIndex,
                    action: "discard",
                    tile,
                    llmAnalysis: "延迟分析模式：使用规则 AI",
                    isLlmFallback: true,
                });
                return discardTile(withAction, fallbackTileId);
            });
            llmInFlightRef.current = false;
            setThinkingPlayer(null);
            return;
        }

        try {
            const response = await requestMahjongAI({
                mode: "discard",
                gameState: state,
                playerIndex,
            });
            const discardTileId = response.discardTileId || fallbackTileId;
            addLlmDebugEntry({
                playerIndex,
                mode: "discard",
                result: `discard ${discardTileId}`,
                analysis: response.analysis,
                fallback: response.fallback,
            });
            recordAdviceOnCurrentState({
                playerIndex,
                mode: "discard",
                result: `discard ${discardTileId}`,
                analysis: response.analysis,
                fallback: response.fallback,
            });

            setGameState((current) => {
                if (!current || current.isGameOver || current.phase !== "DISCARD" || current.currentTurn !== playerIndex) {
                    return current;
                }
                // Record action with LLM analysis
                const tile = current.players[playerIndex].hand.find(t => t.id === discardTileId);
                const withAction = recordAction(current, {
                    playerIndex,
                    action: "discard",
                    tile,
                    llmAnalysis: response.analysis,
                    isLlmFallback: response.fallback,
                });
                return discardTile(withAction, discardTileId);
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown LLM error";
            addLlmDebugEntry({
                playerIndex,
                mode: "discard",
                result: `fallback discard ${fallbackTileId}`,
                analysis: `LLM 决策失败，使用规则 AI。原因：${message}`,
                fallback: true,
            });
            recordAdviceOnCurrentState({
                playerIndex,
                mode: "discard",
                result: `fallback discard ${fallbackTileId}`,
                analysis: `LLM 决策失败，使用规则 AI。原因：${message}`,
                fallback: true,
            });
            setGameState((current) => {
                if (!current || current.isGameOver || current.phase !== "DISCARD" || current.currentTurn !== playerIndex) {
                    return current;
                }
                // Record action with fallback
                const tile = current.players[playerIndex].hand.find(t => t.id === fallbackTileId);
                const withAction = recordAction(current, {
                    playerIndex,
                    action: "discard",
                    tile,
                    llmAnalysis: `LLM 决策失败，使用规则 AI。原因：${message}`,
                    isLlmFallback: true,
                });
                return discardTile(withAction, fallbackTileId);
            });
        } finally {
            llmInFlightRef.current = false;
            setThinkingPlayer(null);
        }
    };

    const runBotActionsWithLLM = async (state: GameState) => {
        const pendingBotPlayers = Object.keys(state.pendingActions)
            .map(Number)
            .filter((playerIndex) => playerIndex !== 0 && !state.actionDecisions[playerIndex]);

        if (pendingBotPlayers.length === 0) return;

        llmInFlightRef.current = true;
        setThinkingPlayer(pendingBotPlayers[0]);

        const decisions = await Promise.all(pendingBotPlayers.map(async (playerIndex) => {
            const pending = state.pendingActions[playerIndex];
            const fallbackAction = decideBotAction(state, playerIndex, pending);

            // In deferred mode, skip LLM and use rule-based AI
            if (deferredAnalysisMode) {
                addLlmDebugEntry({
                    playerIndex,
                    mode: "action",
                    result: `deferred ${fallbackAction}`,
                    analysis: "延迟分析模式：使用规则 AI",
                    fallback: true,
                });
                return [playerIndex, fallbackAction, "延迟分析模式：使用规则 AI", true] as const;
            }

            try {
                const response = await requestMahjongAI({
                    mode: "action",
                    gameState: state,
                    playerIndex,
                    availableActions: { ...pending, pass: true },
                });
                const action = response.action || fallbackAction;
                addLlmDebugEntry({
                    playerIndex,
                    mode: "action",
                    result: action,
                    analysis: response.analysis,
                    fallback: response.fallback,
                });
                recordAdviceOnCurrentState({
                    playerIndex,
                    mode: "action",
                    result: action,
                    analysis: response.analysis,
                    fallback: response.fallback,
                });
                return [playerIndex, action, response.analysis, response.fallback] as const;
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown LLM error";
                const analysis = `LLM 决策失败，使用规则 AI。原因：${message}`;
                addLlmDebugEntry({
                    playerIndex,
                    mode: "action",
                    result: `fallback ${fallbackAction}`,
                    analysis,
                    fallback: true,
                });
                recordAdviceOnCurrentState({
                    playerIndex,
                    mode: "action",
                    result: `fallback ${fallbackAction}`,
                    analysis,
                    fallback: true,
                });
                return [playerIndex, fallbackAction, analysis, true] as const;
            }
        }));

        setGameState((current) => {
            if (!current || current.isGameOver || current.phase !== "RESOLVE") return current;
            const actionDecisions = { ...current.actionDecisions };
            let logs = [...current.logs];
            let stateWithActions = current;

            decisions.forEach(([playerIndex, action, analysis, isFallback]) => {
                if (!current.pendingActions[playerIndex] || actionDecisions[playerIndex]) return;
                actionDecisions[playerIndex] = action;
                logs = [...logs, action !== "pass" ? `Bot ${playerIndex} chooses ${action.toUpperCase()}` : `Bot ${playerIndex} passes`];
                // Record action
                stateWithActions = recordAction(stateWithActions, {
                    playerIndex,
                    action: action as any,
                    llmAnalysis: analysis,
                    isLlmFallback: isFallback,
                });
            });

            return resolvePendingActions({ ...stateWithActions, actionDecisions, logs });
        });

        llmInFlightRef.current = false;
        setThinkingPlayer(null);
    };

    const requestHumanAdvice = async (state: GameState, availableActions: Partial<Record<MahjongAction, boolean>>) => {
        adviceInFlightRef.current = true;
        try {
            const response = await requestMahjongAI({
                mode: "advice",
                gameState: state,
                playerIndex: 0,
                availableActions,
            });
            addLlmDebugEntry({
                playerIndex: 0,
                mode: "advice",
                result: response.action || response.discardTileId || "advice",
                analysis: response.analysis,
                fallback: response.fallback,
            });
            recordAdviceOnCurrentState({
                playerIndex: 0,
                mode: "advice",
                result: response.action || response.discardTileId || "advice",
                analysis: response.analysis,
                fallback: response.fallback,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown LLM error";
            addLlmDebugEntry({
                playerIndex: 0,
                mode: "advice",
                result: "advice failed",
                analysis: `无法获取玩家建议：${message}`,
                fallback: true,
            });
            recordAdviceOnCurrentState({
                playerIndex: 0,
                mode: "advice",
                result: "advice failed",
                analysis: `无法获取玩家建议：${message}`,
                fallback: true,
            });
        } finally {
            adviceInFlightRef.current = false;
        }
    };

    useEffect(() => {
        setMounted(true);
        try {
            const initialGame = initializeGame(region);
            setGameState(initialGame);
            setLlmDebugEntries([]);
            // Trigger Shengzhou ceremony
            if (region === "shengzhou") {
                setShowDiceAnimation(true);
                setCeremonyComplete(false);
            } else {
                setCeremonyComplete(true);
            }
        } catch (err) {
            console.error("Failed to initialize game:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    }, [region]);

    // Keyboard shortcut to toggle dev mode (Ctrl+Shift+D)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                setIsDevMode(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Central Game Loop driven by stepGame
    useEffect(() => {
        if (!gameState || gameState.isGameOver || !mounted) return;
        if (isPaused) return; // Pause Check
        if (isAdvancedDebug) return;
        if (!ceremonyComplete) return; // Wait for Shengzhou ceremony

        // If autoPause is ON, we don't run the interval. User clicks "Next" manually.
        if (autoPause) return;

        const timer = setInterval(() => {
            setGameState(prevState => {
                if (!prevState || prevState.isGameOver) return prevState;
                if (llmInFlightRef.current) return prevState;

                // If it's human's turn to DISCARD, we don't step automatically
                // Unless we implement auto-discard for human later
                if (prevState.phase === "DISCARD" && prevState.currentTurn === 0) {
                    return prevState;
                }

                if (prevState.phase === "DISCARD" && prevState.currentTurn !== 0) {
                    void runBotDiscardWithLLM(prevState);
                    return prevState;
                }

                // If waiting for human input in RESOLVE phase, don't step
                if (prevState.phase === "RESOLVE" && prevState.pendingActions[0] && !prevState.actionDecisions[0]) {
                    return prevState;
                }

                if (prevState.phase === "RESOLVE") {
                    const pendingBots = Object.keys(prevState.pendingActions)
                        .map(Number)
                        .some((playerIndex) => playerIndex !== 0 && !prevState.actionDecisions[playerIndex]);
                    if (pendingBots) {
                        void runBotActionsWithLLM(prevState);
                        return prevState;
                    }
                }

                const newState = stepGame(prevState);

                // Auto-Pause Logic: Pause after specific phases if enabled
                // If state changed, we pause to let user see it
                // But we can't set isPaused inside the setState callback easily without side effects
                // So we might need a different approach or just let the effect run once and then pause
                // For "Step" mode, we want exactly ONE step.
                // So if autoPause is ON, we shouldn't be in this interval at all!

                return newState;
            });
        }, 1000); // 1 second per step for visibility

        return () => clearInterval(timer);
    }, [gameState?.isGameOver, isPaused, autoPause, mounted, isAdvancedDebug, ceremonyComplete]);

    // Play game over sound
    useEffect(() => {
        if (gameState?.isGameOver) {
            playSound("gameOver");
        }
    }, [gameState?.isGameOver]);

    // Compute tenpai tiles for human player
    useEffect(() => {
        if (!gameState || gameState.currentTurn !== 0 || gameState.phase !== "DISCARD") {
            setTenpaiTileIds(new Set());
            return;
        }

        const playerHand = gameState.players[0].hand;
        // Only compute when player has 14 tiles (drawn tile included)
        if (playerHand.length % 3 !== 2) {
            setTenpaiTileIds(new Set());
            return;
        }

        const ruleSet = createRuleSet(gameState.rules.region);
        const tenpaiIds = new Set<string>();

        for (let i = 0; i < playerHand.length; i++) {
            const remainingHand = playerHand.filter((_, idx) => idx !== i);
            const tenpaiTiles = ruleSet.huRule.getTenpaiTiles(remainingHand, gameState.caishenTile);
            if (tenpaiTiles.length > 0) {
                tenpaiIds.add(playerHand[i].id);
            }
        }

        setTenpaiTileIds(tenpaiIds);
    }, [gameState?.currentTurn, gameState?.phase, gameState?.players[0]?.hand]);

    // LLM Analysis for human player
    useEffect(() => {
        if (!gameState || gameState.isGameOver || gameState.currentTurn !== 0) {
            setLlmAnalysis(null);
            setIsLlmLoading(false);
            return;
        }

        // Only call LLM when it's the player's turn to act
        const isDiscardPhase = gameState.phase === "DISCARD";
        const isResolvePhase = gameState.phase === "RESOLVE" && gameState.pendingActions[0];

        if (!isDiscardPhase && !isResolvePhase) {
            setLlmAnalysis(null);
            setIsLlmLoading(false);
            return;
        }

        // Create a key to avoid duplicate requests
        const handKey = gameState.players[0].hand.map(t => t.id).sort().join(",");
        const actionKey = `${gameState.phase}-${gameState.currentTurn}-${handKey}`;
        if (actionKey === llmAnalysisKey) return;

        const fetchAnalysis = async () => {
            setIsLlmLoading(true);
            setLlmAnalysisKey(actionKey);

            try {
                const availableActions = isResolvePhase ? gameState.pendingActions[0] : undefined;
                const response = await requestMahjongAI({
                    mode: "advice",
                    gameState,
                    playerIndex: 0,
                    availableActions,
                });
                setLlmAnalysis(response.analysis);
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                setLlmAnalysis(`分析失败: ${message}`);
            } finally {
                setIsLlmLoading(false);
            }
        };

        void fetchAnalysis();
    }, [gameState?.currentTurn, gameState?.phase, gameState?.players[0]?.hand, gameState?.pendingActions, llmAnalysisKey]);

    const findScriptTileId = (state: GameState, playerIndex: number, requestedTile?: string) => {
        const hand = state.players[playerIndex]?.hand || [];
        if (hand.length === 0) return "";
        if (!requestedTile) return hand[0].id;
        return hand.find((tile) => tile.id === requestedTile || formatTile(tile) === requestedTile)?.id || hand[0].id;
    };

    const runScriptStep = (state: GameState): GameState | null => {
        const script = state.debugScenario?.script || [];
        const stepIndex = state.debugScriptIndex || 0;
        const step = script[stepIndex];
        if (!isAdvancedDebug || !step) return null;
        if (step.phase && state.phase !== step.phase) return null;
        if (state.currentTurn !== step.playerIndex && step.phase !== "RESOLVE") return null;

        if (step.phase === "DISCARD" || (!step.phase && state.phase === "DISCARD")) {
            const tileId = findScriptTileId(state, step.playerIndex, step.tile);
            if (!tileId || state.currentTurn !== step.playerIndex) return null;
            return {
                ...discardTile(state, tileId),
                debugScriptIndex: stepIndex + 1,
            };
        }

        if (step.phase === "RESOLVE" || (!step.phase && state.phase === "RESOLVE")) {
            if (!step.action) return null;
            const newDecisions = { ...state.actionDecisions, [step.playerIndex]: step.action };
            const pendingPlayers = Object.keys(state.pendingActions).map(Number);
            const allDecided = pendingPlayers.every((p) => newDecisions[p] !== undefined);
            const nextState = {
                ...state,
                actionDecisions: newDecisions,
                logs: [...state.logs, `Script: Player ${step.playerIndex} ${step.action}${step.note ? ` (${step.note})` : ""}`],
                debugScriptIndex: stepIndex + 1,
            };
            return allDecided ? resolvePendingActions(nextState) : nextState;
        }

        return null;
    };

    // Handle "Next" Step manually
    const handleNextStep = () => {
        setGameState(prev => {
            if (!prev) return null;
            if (llmInFlightRef.current) return prev;
            const scriptedState = runScriptStep(prev);
            if (scriptedState) return scriptedState;
            if (isAdvancedDebug && prev.phase === "DISCARD" && prev.currentTurn !== 0) {
                setDebugError("Advanced Debug is waiting for a scripted discard for this bot.");
                return prev;
            }
            if (isAdvancedDebug && prev.phase === "RESOLVE") {
                const waitingPlayers = Object.keys(prev.pendingActions)
                    .map(Number)
                    .filter((playerIndex) => !prev.actionDecisions[playerIndex]);
                if (waitingPlayers.some((playerIndex) => playerIndex !== 0)) {
                    setDebugError(`Advanced Debug is waiting for scripted reactions: P${waitingPlayers.join(", P")}.`);
                    return prev;
                }
            }
            if (prev.phase === "DISCARD" && prev.currentTurn !== 0) {
                void runBotDiscardWithLLM(prev);
                return prev;
            }
            if (prev.phase === "RESOLVE") {
                const pendingBots = Object.keys(prev.pendingActions)
                    .map(Number)
                    .some((playerIndex) => playerIndex !== 0 && !prev.actionDecisions[playerIndex]);
                if (pendingBots) {
                    void runBotActionsWithLLM(prev);
                    return prev;
                }
            }
            return stepGame(prev);
        });
    };

    // Auto-Pause Effect: If autoPause is ON, we don't run the interval.
    // The user manually clicks "Next".
    // OR, if the user wants "Auto-Pause (Step)" meaning "Run until interesting event", that's different.
    // The user request said: "play 1 get card xxx, play 1 set card xx to pool, play 2 check...".
    // This implies they want to see EVERY step.
    // So "Auto-Pause" should probably just mean "Manual Stepping Mode".
    // If Auto-Pause is checked, the interval above should be disabled.

    // Timer Logic
    useEffect(() => {
        if (!gameState || gameState.isGameOver || isPaused) return; // Pause timer too

        const timer = setInterval(() => {
            setGameState(prev => {
                if (!prev || prev.isGameOver) return prev;

                // If timer hits 0 and we are waiting for actions, auto-pass undecided players
                if (prev.actionTimer <= 0 && prev.isWaitingForAction) {
                    const newState = { ...prev };
                    const pendingPlayers = Object.keys(newState.pendingActions).map(Number);

                    // Force pass for anyone who hasn't decided
                    pendingPlayers.forEach(pIdx => {
                        if (!newState.actionDecisions[pIdx]) {
                            newState.actionDecisions[pIdx] = "pass";
                        }
                    });

                    // Resolve immediately
                    return resolvePendingActions(newState);
                }

                if (prev.actionTimer <= 0) return prev; // Timer stays at 0 if not waiting (or handle turn timeout)

                // Play timer sound when running low (under 5 seconds)
                if (prev.actionTimer <= 5 && prev.actionTimer > 0 && prev.isWaitingForAction) {
                    playSound("timer");
                }

                return { ...prev, actionTimer: prev.actionTimer - 1 };
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameState?.isGameOver, gameState?.isWaitingForAction, isPaused]);

    const handleTileClick = (tileId: string) => {
        if (!gameState) return;
        if (gameState.isWaitingForAction) return; // Can't discard while waiting
        if (gameState.currentTurn !== 0) return;
        if (isLlmLoading) return; // Wait for LLM analysis

        // Record action
        const tile = gameState.players[0].hand.find(t => t.id === tileId);
        let newState = recordAction(gameState, {
            playerIndex: 0,
            action: "discard",
            tile,
            llmAnalysis: llmAnalysis || undefined,
        });

        // Discard logic
        newState = discardTile(newState, tileId);
        // Reset selfDrawPassed flag when discarding
        setGameState({ ...newState, selfDrawPassed: false });
        setLlmAnalysis(null); // Clear analysis after action
        playSound("tileDiscard");
    };

    // Auto-draw for Player 0
    useEffect(() => {
        if (!gameState || gameState.isGameOver || gameState.isWaitingForAction || isPaused) return;
        if (!ceremonyComplete) return; // Wait for Shengzhou ceremony
        if (gameState.currentTurn === 0 && gameState.players[0].hand.length % 3 === 1) {
            // Needs to draw
            // Add small delay
            const timer = setTimeout(() => {
                if (isPaused) return;
                setGameState(prev => {
                    if (!prev) return null;
                    const newState = drawTile(prev);
                    if (autoPause) setIsPaused(true);
                    return newState;
                });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [gameState?.currentTurn, gameState?.players[0].hand.length, isPaused]);

    // Real Action Availability based on Game Rules
    const getAvailableActions = (playerIndex: number) => {
        if (!gameState) return { chi: false, peng: false, gang: false, hu: false, pass: false };

        // If waiting for action, return pending actions for this player
        if (gameState.isWaitingForAction) {
            // If player already decided, show nothing (or show "Waiting...")
            if (gameState.actionDecisions[playerIndex]) {
                return { chi: false, peng: false, gang: false, hu: false, pass: false };
            }

            const pending = gameState.pendingActions[playerIndex];
            if (pending) {
                return { ...pending, pass: true }; // Add Pass option
            }
            return { chi: false, peng: false, gang: false, hu: false, pass: false };
        }

        // Self-draw actions (Gang/Hu) during own turn
        const ruleSet = createRuleSet(gameState.rules.region);
        const player = gameState.players[playerIndex];
        const hand = player.hand;
        const isMyTurn = gameState.currentTurn === playerIndex;
        const hasFullHand = hand.length % 3 === 2;
        const isSelfDraw = isMyTurn && hasFullHand;

        if (isSelfDraw && !gameState.selfDrawPassed) {
            const ctx = createGameContext(gameState, playerIndex, { isSelfDraw: true });
            const canGang = ruleSet.gangRule.canGang(ctx);
            const huResult = ruleSet.huRule.canHu(ctx);
            return {
                chi: false,
                peng: false,
                gang: canGang,
                hu: huResult.success,
                pass: canGang || huResult.success // Show pass button if any action is available
            };
        }

        return { chi: false, peng: false, gang: false, hu: false, pass: false };
    };

    const handleAction = (action: string, playerIndex: number = 0) => {
        if (!gameState) return;
        if (isLlmLoading) return; // Wait for LLM analysis
        console.log(`Player ${playerIndex} chose ${action}`);

        // Handle self-draw actions (during DISCARD phase, player's own turn)
        if (gameState.phase === "DISCARD" && gameState.currentTurn === playerIndex) {
            if (action === "hu") {
                // Self-draw Hu (Tsumo)
                const ruleSet = createRuleSet(gameState.rules.region);
                const ctx = createGameContext(gameState, playerIndex, { isSelfDraw: true });
                const huResult = ruleSet.huRule.canHu(ctx);
                const scoreResult = ruleSet.scoreRule.calculate(ctx, huResult);
                // Apply score changes inline
                const newPlayers = gameState.players.map(p => ({ ...p }));
                const perPlayer = Math.floor(scoreResult.total / 3);
                newPlayers.forEach((p, i) => {
                    if (i === playerIndex) p.score += scoreResult.total;
                    else p.score -= perPlayer;
                });
                playSound("tileHu");
                setGameState({
                    ...gameState,
                    players: newPlayers,
                    winner: playerIndex,
                    isGameOver: true,
                    scoreResult,
                    logs: [...gameState.logs, `Player ${playerIndex} wins with self-draw Hu! Score: ${scoreResult.total}`],
                });
                return;
            }
            if (action === "gang") {
                // Self-draw Gang (An Gang or Jia Gang)
                const ruleSet = createRuleSet(gameState.rules.region);
                const player = gameState.players[playerIndex];
                const hand = player.hand;
                const ctx = createGameContext(gameState, playerIndex, { isSelfDraw: true });

                // Check for An Gang (4 identical tiles in hand)
                const gangTile = ruleSet.gangRule.getSelfDrawGangTile?.(ctx) || hand.find(t => {
                    const count = hand.filter(h => h.suit === t.suit && h.rank === t.rank).length;
                    return count === 4;
                });

                if (gangTile) {
                    // Perform An Gang
                    playSound("tileGang");
                    const newMeld = {
                        type: "gang" as const,
                        tiles: hand.filter(t => t.suit === gangTile.suit && t.rank === gangTile.rank),
                    };
                    const newHand = hand.filter(t => !(t.suit === gangTile.suit && t.rank === gangTile.rank));
                    const newPlayers = [...gameState.players];
                    newPlayers[playerIndex] = {
                        ...newPlayers[playerIndex],
                        hand: newHand,
                        melds: [...newPlayers[playerIndex].melds, newMeld],
                    };
                    // Draw replacement tile after An Gang
                    const newState = drawTile({
                        ...gameState,
                        players: newPlayers,
                        logs: [...gameState.logs, `Player ${playerIndex} performs An Gang (Concealed Kong)`],
                    }, true);
                    setGameState(newState);
                    return;
                }

                // Check for Jia Gang (add to existing Peng)
                const pengMeld = player.melds.find(m => m.type === "peng");
                if (pengMeld) {
                    const jiaGangTile = hand.find(t => t.suit === pengMeld.tiles[0].suit && t.rank === pengMeld.tiles[0].rank);
                    if (jiaGangTile) {
                        // Perform Jia Gang
                        const newHand = hand.filter(t => t.id !== jiaGangTile.id);
                        const newMelds = player.melds.map(m => {
                            if (m.type === "peng" && m.tiles[0].suit === pengMeld.tiles[0].suit && m.tiles[0].rank === pengMeld.tiles[0].rank) {
                                return { ...m, type: "gang" as const, tiles: [...m.tiles, jiaGangTile] };
                            }
                            return m;
                        });
                        const newPlayers = [...gameState.players];
                        newPlayers[playerIndex] = {
                            ...newPlayers[playerIndex],
                            hand: newHand,
                            melds: newMelds,
                        };
                        const newState = drawTile({
                            ...gameState,
                            players: newPlayers,
                            logs: [...gameState.logs, `Player ${playerIndex} performs Jia Gang (Add Kong)`],
                        }, true);
                        setGameState(newState);
                        return;
                    }
                }
                return;
            }
            if (action === "pass") {
                // Pass on self-draw actions, let player discard normally
                setGameState({
                    ...gameState,
                    selfDrawPassed: true,
                    actionDecisions: {},
                    pendingActions: {},
                });
                return;
            }
        }

        // Handle actions during RESOLVE phase (from other players' discards)
        // Play sound for the action
        if (action === "hu") playSound("tileHu");
        else if (action === "gang") playSound("tileGang");
        else if (action === "peng") playSound("tilePeng");
        else if (action === "chi") playSound("tileChi");

        // 1. Record Decision
        const newDecisions = { ...gameState.actionDecisions, [playerIndex]: action };
        let newState = { ...gameState, actionDecisions: newDecisions };

        // 2. Check if all pending players have decided
        const pendingPlayers = Object.keys(newState.pendingActions).map(Number);
        const allDecided = pendingPlayers.every(p => newDecisions[p] !== undefined);

        if (allDecided) {
            // 3. Resolve Actions
            newState = resolvePendingActions(newState);
        }

        setGameState(newState);
    };

    const applyDebugScenario = (scenario: DebugScenario) => {
        try {
            const newGame = initializeGame(region, scenario);
            setGameState(newGame);
            setLlmDebugEntries([]);
            setDebugError(null);
            setIsAdvancedDebug(true);
            setIsPaused(true);
            setAutoPause(true);
            setReplayIndex(0);
        } catch (err) {
            setDebugError(err instanceof Error ? err.message : "Invalid debug scenario");
        }
    };

    const applyCustomDebugScenario = () => {
        try {
            const parsed = JSON.parse(debugScenarioText) as DebugScenario;
            applyDebugScenario(parsed);
        } catch (err) {
            setDebugError(err instanceof Error ? err.message : "Invalid debug scenario JSON");
        }
    };

    const setupTestHand = () => {
        if (!gameState) return;

        const newState = { ...gameState };
        const players = newState.players.map(p => ({ ...p, hand: [...p.hand] })); // Deep copy hands

        // Force Player 0 to have Pair of 1 Bamboo and Sequence 2-3 Bamboo
        // We just overwrite the first few tiles. IDs don't matter for logic matching.
        if (players[0].hand.length >= 4) {
            players[0].hand[0] = { ...players[0].hand[0], suit: "bamboo", rank: 1 };
            players[0].hand[1] = { ...players[0].hand[1], suit: "bamboo", rank: 1 };
            players[0].hand[2] = { ...players[0].hand[2], suit: "bamboo", rank: 2 };
            players[0].hand[3] = { ...players[0].hand[3], suit: "bamboo", rank: 3 };
        }

        // Force Player 3 (Left of 0) to have 1 Bamboo at index 0 (to discard)
        if (players[3].hand.length >= 1) {
            players[3].hand[0] = { ...players[3].hand[0], suit: "bamboo", rank: 1 };
        }

        newState.players = players;
        setGameState(newState);
        alert("Test Hand Setup: P0 has 1-1-2-3 Bamboo, P3 has 1 Bamboo to discard.");
    };

    const handleNewGame = () => {
        // 庄家继承: 赢家成为下局庄家，连庄累加
        const winner = gameState?.winner ?? null;
        const prevDealer = gameState?.dealerIndex;
        const prevStreak = gameState?.dealerStreak || 1;
        const newDealer = winner !== null && winner !== undefined ? winner : prevDealer;
        const newStreak = (newDealer === prevDealer) ? prevStreak + 1 : 1;
        const newGame = initializeGame(region, undefined, newDealer, newStreak);
        setGameState(newGame);
        setLlmDebugEntries([]);
        setIsPaused(false);
        setIsAdvancedDebug(false);
        setDebugError(null);
        setReplayIndex(0);
        // Trigger Shengzhou ceremony for new game
        if (region === "shengzhou") {
            setShowDiceAnimation(true);
            setShowCaishenReveal(false);
            setCeremonyComplete(false);
        }
    };

    useEffect(() => {
        if (!gameState || !isDevMode || !isLlmDebug || gameState.isGameOver || adviceInFlightRef.current) return;
        const isHumanDiscard = gameState.phase === "DISCARD" && gameState.currentTurn === 0;
        const isHumanAction = gameState.phase === "RESOLVE" && gameState.pendingActions[0] && !gameState.actionDecisions[0];
        if (!isHumanDiscard && !isHumanAction) return;

        const availableActions = getAvailableActions(0);
        const key = [
            gameState.phase,
            gameState.currentTurn,
            gameState.players[0].hand.map((tile) => tile.id).join("|"),
            gameState.logs.length,
            JSON.stringify(availableActions),
        ].join(":");

        if (adviceKeyRef.current === key) return;
        adviceKeyRef.current = key;
        void requestHumanAdvice(gameState, availableActions);
    }, [gameState, isDevMode, isLlmDebug]);

    if (!mounted) return <div className="flex items-center justify-center h-screen bg-[#1e5128] text-white">Loading...</div>;
    if (error) return <div className="flex items-center justify-center h-screen text-red-500">Error: {error}</div>;
    if (!gameState) return <div className="flex items-center justify-center h-screen bg-[#1e5128] text-white">Loading...</div>;

    const player = gameState.players[0];
    const replayEvents = gameState.replayEvents || [];
    const currentReplayEvent = replayEvents[Math.min(replayIndex, Math.max(0, replayEvents.length - 1))];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f2912] relative overflow-hidden">
            {/* Shengzhou Dice Animation */}
            {showDiceAnimation && gameState?.diceValues && (
                <DiceAnimation
                    diceValues={gameState.diceValues}
                    onComplete={() => {
                        setShowDiceAnimation(false);
                        if (gameState?.caishenSourceTile && gameState?.caishenTile) {
                            setShowCaishenReveal(true);
                        } else {
                            setCeremonyComplete(true);
                        }
                    }}
                />
            )}

            {/* Shengzhou Caishen Reveal */}
            {showCaishenReveal && gameState?.caishenSourceTile && gameState?.caishenTile && (
                <CaishenReveal
                    sourceTile={gameState.caishenSourceTile}
                    caishenTile={gameState.caishenTile}
                    onComplete={() => {
                        setShowCaishenReveal(false);
                        setCeremonyComplete(true);
                    }}
                />
            )}

            {/* Persistent Caishen Display for Shengzhou */}
            {gameState?.caishenTile && ceremonyComplete && !gameState.isGameOver && (
                <CaishenDisplay
                    caishenTile={gameState.caishenTile}
                    sourceTile={gameState.caishenSourceTile}
                    className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
                />
            )}

            {/* Game Over Screen */}
            {gameState.isGameOver && !showReview && (
                <GameOverScreen
                    winner={gameState.winner}
                    isDrawGame={gameState.winner === null && gameState.deck.length === 0}
                    scoreResult={gameState.scoreResult}
                    onNewGame={() => { handleNewGame(); playSound("tileClick"); }}
                    onReview={() => setShowReview(true)}
                />
            )}

            {/* Game Review */}
            {showReview && (
                <GameReview
                    actions={gameState.actionHistory}
                    onClose={() => setShowReview(false)}
                    deferredAnalysisMode={deferredAnalysisMode}
                />
            )}

            {/* Game Log */}
            <GameLog
                actions={gameState.actionHistory}
                isVisible={showGameLog}
                showLlmAnalysis={isLlmDebug}
                onClose={() => setShowGameLog(false)}
                onToggleAnalysis={() => setIsLlmDebug(!isLlmDebug)}
            />
            {/* Top Controls */}
            <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
                <button
                    onClick={() => { handleNewGame(); playSound("tileClick"); }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg shadow-lg transition-colors"
                >
                    New Game
                </button>
                <button
                    onClick={() => setShowGameLog(!showGameLog)}
                    className={cn(
                        "px-3 py-1.5 text-sm font-bold rounded-lg shadow-lg transition-colors",
                        showGameLog
                            ? "bg-green-600 text-white"
                            : "bg-stone-700 text-stone-300 hover:bg-stone-600"
                    )}
                >
                    Log
                </button>
                <button
                    onClick={() => setDeferredAnalysisMode(!deferredAnalysisMode)}
                    className={cn(
                        "px-3 py-1.5 text-sm font-bold rounded-lg shadow-lg transition-colors",
                        deferredAnalysisMode
                            ? "bg-purple-600 text-white"
                            : "bg-stone-700 text-stone-300 hover:bg-stone-600"
                    )}
                >
                    {deferredAnalysisMode ? "Deferred: ON" : "Deferred: OFF"}
                </button>
            </div>

            {/* Dev Mode Toggle - Hidden by default, toggle with keyboard shortcut */}
            <div className="fixed top-4 right-4 z-50 bg-black/50 p-2 rounded text-white flex flex-col gap-2 items-end">
                <label className="text-sm font-bold cursor-pointer flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={isDevMode}
                        onChange={(e) => setIsDevMode(e.target.checked)}
                        className="cursor-pointer"
                    />
                    Dev Mode
                </label>
                {isDevMode && (
                    <div className="flex flex-col gap-2 items-end">
                        <button
                            onClick={setupTestHand}
                            className="px-2 py-1 bg-blue-600 text-xs rounded hover:bg-blue-500 w-full"
                        >
                            Setup Test Hand
                        </button>
                        <div className="grid grid-cols-1 gap-1 w-80">
                            <button
                                onClick={() => {
                                    setDebugScenarioText(JSON.stringify(DEBUG_SCENARIOS[0], null, 2));
                                    applyDebugScenario(DEBUG_SCENARIOS[0]);
                                }}
                                className="px-2 py-1 bg-indigo-600 text-xs rounded hover:bg-indigo-500"
                            >
                                Load Peng/Chi Debug
                            </button>
                            <button
                                onClick={() => {
                                    setDebugScenarioText(JSON.stringify(DEBUG_SCENARIOS[1], null, 2));
                                    applyDebugScenario(DEBUG_SCENARIOS[1]);
                                }}
                                className="px-2 py-1 bg-indigo-600 text-xs rounded hover:bg-indigo-500"
                            >
                                Load Hu Debug
                            </button>
                            <textarea
                                value={debugScenarioText}
                                onChange={(event) => setDebugScenarioText(event.target.value)}
                                className="h-28 resize-none rounded bg-black/70 p-2 text-[10px] text-gray-100 border border-gray-600"
                                spellCheck={false}
                            />
                            <button
                                onClick={applyCustomDebugScenario}
                                className="px-2 py-1 bg-purple-700 text-xs rounded hover:bg-purple-600"
                            >
                                Apply Custom Debug
                            </button>
                            {debugError && (
                                <div className="rounded border border-red-500/70 bg-red-950/70 p-2 text-[10px] text-red-100">
                                    {debugError}
                                </div>
                            )}
                            {isAdvancedDebug && (
                                <div className="rounded border border-indigo-500/70 bg-indigo-950/70 p-2 text-[10px] text-indigo-100">
                                    Advanced Debug active. AI execution is paused; use Next, script steps, or manual Player 0 actions.
                                </div>
                            )}
                        </div>
                        <div className="h-px bg-gray-500 w-full my-1" />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsPaused(!isPaused)}
                                className={cn(
                                    "px-2 py-1 text-xs rounded w-16",
                                    isPaused ? "bg-green-600 hover:bg-green-500" : "bg-yellow-600 hover:bg-yellow-500"
                                )}
                            >
                                {isPaused ? "Resume" : "Pause"}
                            </button>
                            <button
                                onClick={handleNextStep}
                                disabled={!isPaused && !autoPause} // Enabled if paused OR if in auto-pause (manual step) mode
                                className="px-2 py-1 bg-gray-600 text-xs rounded hover:bg-gray-500 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                        <label className="text-xs flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoPause}
                                onChange={(e) => setAutoPause(e.target.checked)}
                            />
                            Auto-Pause (Step)
                        </label>
                        <label className="text-xs flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isLlmDebug}
                                onChange={(e) => setIsLlmDebug(e.target.checked)}
                            />
                            LLM Debug
                        </label>
                        {thinkingPlayer !== null && (
                            <div className="text-[10px] text-amber-300">Player {thinkingPlayer} thinking...</div>
                        )}
                        <button
                            onClick={() => {
                                setReplayIndex(Math.max(0, replayEvents.length - 1));
                                setShowReplay(true);
                            }}
                            className="px-2 py-1 bg-emerald-700 text-xs rounded hover:bg-emerald-600 w-full"
                        >
                            Replay ({replayEvents.length})
                        </button>

                        {/* Game Log Panel */}
                        <div className="mt-2 w-64 h-48 bg-black/80 rounded p-2 overflow-y-auto text-[10px] font-mono border border-gray-600">
                            <div className="font-bold text-gray-400 mb-1 sticky top-0 bg-black/80 w-full">Game Logs:</div>
                            <div className="flex flex-col gap-1">
                                {gameState?.logs?.slice().reverse().map((log, i) => (
                                    <div key={i} className="border-b border-gray-800 pb-0.5 last:border-0">
                                        <span className="text-gray-500 mr-1">[{gameState.logs.length - i}]</span>
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {isLlmDebug && (
                            <div className="w-80 max-h-80 bg-black/85 rounded p-2 overflow-y-auto text-[10px] border border-amber-600/60">
                                <div className="font-bold text-amber-300 mb-1 sticky top-0 bg-black/85 w-full">LLM Analysis</div>
                                <div className="flex flex-col gap-2">
                                    {llmDebugEntries.length === 0 ? (
                                        <div className="text-gray-400">No LLM decisions yet.</div>
                                    ) : llmDebugEntries.map((entry) => (
                                        <div key={entry.id} className="border-b border-gray-700 pb-2 last:border-0">
                                            <div className="flex items-center justify-between gap-2 text-gray-300">
                                                <span>P{entry.playerIndex} / {entry.mode}</span>
                                                <span className={entry.fallback ? "text-red-300" : "text-green-300"}>{entry.result}</span>
                                            </div>
                                            <div className="mt-1 whitespace-pre-wrap leading-snug text-gray-100">{entry.analysis}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showReplay && currentReplayEvent && (
                <ReplayPanel
                    event={currentReplayEvent}
                    index={Math.min(replayIndex, replayEvents.length - 1)}
                    total={replayEvents.length}
                    onClose={() => setShowReplay(false)}
                    onPrev={() => setReplayIndex((index) => Math.max(0, index - 1))}
                    onNext={() => setReplayIndex((index) => Math.min(replayEvents.length - 1, index + 1))}
                    onChangeIndex={setReplayIndex}
                />
            )}

            {/* Center Table (Discard Area) - Fixed Size in Middle */}
            <div className="fixed inset-0 m-auto w-[400px] h-[400px] bg-[#1e5128] rounded-xl border-4 border-[#2a6b35] shadow-2xl flex items-center justify-center z-0">
                {/* Game Info (Wall Count + Wind Indicators) */}
                <GameInfo
                    wallCount={gameState.wallCount}
                    currentTurn={gameState.currentTurn}
                    playerWinds={gameState.players.map(p => p.wind)}
                    playerScores={gameState.players.map(p => p.score)}
                />

                {/* Discard Piles & Turn Indicators */}

                {/* Player 2 (Top) */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 rotate-180 flex flex-col items-center gap-2">
                    <DiscardPile tiles={gameState.players[2].discards} />
                    <TurnIndicator isActive={gameState.currentTurn === 2} />
                </div>

                {/* Player 3 (Left) */}
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 rotate-90 flex flex-col items-center gap-2">
                    <DiscardPile tiles={gameState.players[3].discards} />
                    <TurnIndicator isActive={gameState.currentTurn === 3} />
                </div>

                {/* Player 1 (Right) */}
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 -rotate-90 flex flex-col items-center gap-2">
                    <DiscardPile tiles={gameState.players[1].discards} />
                    <TurnIndicator isActive={gameState.currentTurn === 1} />
                </div>

                {/* Player 0 (Bottom/You) */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2">
                    <TurnIndicator isActive={gameState.currentTurn === 0} isHuman={true} />
                    <DiscardPile tiles={gameState.players[0].discards} />
                </div>
            </div>

            {/* --- Players Hands (Positioned at Edges) --- */}

            {/* Top Player (Bot 2) */}
            <div className="fixed top-0 left-0 right-0 h-32 z-10 pointer-events-none">
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 rotate-180 pointer-events-auto flex flex-col items-center gap-1">
                    <Hand tiles={gameState.players[2].hand} isCurrentPlayer={false} faceDown={!isDevMode} caishenTile={gameState.caishenTile} />
                    <div className="rotate-180">
                        <MeldDisplay melds={gameState.players[2].melds} />
                    </div>
                </div>
            </div>

            {/* Left Player (Bot 3) */}
            <div className="fixed left-0 top-0 bottom-0 w-32 z-10 pointer-events-none">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 rotate-90 pointer-events-auto flex flex-col items-center gap-1">
                    <Hand tiles={gameState.players[3].hand} isCurrentPlayer={false} faceDown={!isDevMode} caishenTile={gameState.caishenTile} />
                    <div className="-rotate-90">
                        <MeldDisplay melds={gameState.players[3].melds} />
                    </div>
                </div>
            </div>

            {/* Right Player (Bot 1) */}
            <div className="fixed right-0 top-0 bottom-0 w-32 z-10 pointer-events-none">
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 -rotate-90 pointer-events-auto flex flex-col items-center gap-1">
                    <Hand tiles={gameState.players[1].hand} isCurrentPlayer={false} faceDown={!isDevMode} caishenTile={gameState.caishenTile} />
                    <div className="rotate-90">
                        <MeldDisplay melds={gameState.players[1].melds} />
                    </div>
                </div>
            </div>

            {/* Bottom Player (You) */}
            <div className="fixed bottom-0 left-0 right-0 h-32 z-10 pointer-events-none">
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
                    {/* Action Buttons ONLY for Player 0 */}
                    <div className="absolute -top-24 left-1/2 transform -translate-x-1/2">
                        <ActionButtons
                            availableActions={getAvailableActions(0)}
                            onAction={(action: string) => handleAction(action, 0)}
                            timer={gameState.actionTimer}
                            disabled={isLlmLoading}
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <MeldDisplay melds={player.melds} />
                        <Hand
                            tiles={player.hand}
                            isCurrentPlayer={gameState.currentTurn === 0}
                            onTileClick={handleTileClick}
                            tenpaiTileIds={tenpaiTileIds}
                            disabled={isLlmLoading}
                            caishenTile={gameState.caishenTile}
                        />
                    </div>

                    {/* LLM Analysis Display */}
                    {(isLlmLoading || llmAnalysis) && (
                        <div className={cn(
                            "mt-2 px-4 py-2 rounded-lg max-w-2xl text-sm",
                            isLlmLoading
                                ? "bg-blue-900/60 text-blue-200 border border-blue-700"
                                : "bg-stone-800/80 text-stone-200 border border-stone-600"
                        )}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-amber-400">AI 分析</span>
                                {isLlmLoading && (
                                    <span className="text-xs text-blue-300 animate-pulse">分析中...</span>
                                )}
                            </div>
                            {isLlmLoading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs">正在分析牌局...</span>
                                </div>
                            ) : (
                                <p className="text-xs leading-relaxed">{llmAnalysis}</p>
                            )}
                        </div>
                    )}

                    {/* Loading overlay when LLM is analyzing */}
                    {isLlmLoading && gameState.currentTurn === 0 && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                            <div className="bg-blue-900/80 px-4 py-2 rounded-lg text-blue-200 text-sm font-bold">
                                AI 分析中，请稍候...
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}

function ReplayPanel({
    event,
    index,
    total,
    onClose,
    onPrev,
    onNext,
    onChangeIndex,
}: {
    event: ReplayEvent;
    index: number;
    total: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onChangeIndex: (index: number) => void;
}) {
    const snapshot = event.snapshot;
    const advice = event.llmAdvice || [];

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-lg border border-emerald-700 bg-[#101914] text-white shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-emerald-900 px-4 py-3">
                    <div>
                        <div className="text-lg font-bold">Replay</div>
                        <div className="text-xs text-gray-400">
                            {index + 1} / {total} · {event.type} · {event.message}
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600">
                        Close
                    </button>
                </div>

                <div className="border-b border-emerald-900 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onPrev}
                            disabled={index === 0}
                            className="rounded bg-emerald-700 px-3 py-1 text-sm disabled:opacity-40"
                        >
                            Prev
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={Math.max(0, total - 1)}
                            value={index}
                            onChange={(event) => onChangeIndex(Number(event.target.value))}
                            className="flex-1"
                        />
                        <button
                            onClick={onNext}
                            disabled={index >= total - 1}
                            className="rounded bg-emerald-700 px-3 py-1 text-sm disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>

                <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1.4fr_1fr]">
                    <div className="space-y-3">
                        <div className="rounded border border-gray-700 bg-black/30 p-3 text-sm">
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                <div>Phase: {snapshot.phase}</div>
                                <div>Turn: Player {snapshot.currentTurn}</div>
                                <div>Wall: {snapshot.wallCount}</div>
                                <div>Winner: {snapshot.winner ?? "none"}</div>
                            </div>
                            <div className="mt-2">
                                Last discard: {snapshot.lastDiscard ? formatTile(snapshot.lastDiscard) : "none"}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {snapshot.players.map((player) => (
                                <div key={player.id} className="rounded border border-gray-700 bg-black/30 p-3">
                                    <div className="mb-2 flex items-center justify-between text-sm font-bold">
                                        <span>Player {player.id} · {player.name}</span>
                                        <span className={snapshot.currentTurn === player.id ? "text-yellow-300" : "text-gray-400"}>
                                            {snapshot.currentTurn === player.id ? "turn" : player.wind}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-300">
                                        Hand: {player.hand.map(formatTile).join(" ") || "empty"}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-300">
                                        Discards: {player.discards.map(formatTile).join(" ") || "none"}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-300">
                                        Melds: {player.melds.map((meld) => `${meld.type}(${meld.tiles.map(formatTile).join(" ")})`).join(" · ") || "none"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="rounded border border-amber-700/70 bg-black/30 p-3">
                            <div className="mb-2 text-sm font-bold text-amber-300">LLM Advice Timeline</div>
                            {advice.length === 0 ? (
                                <div className="text-xs text-gray-400">No LLM advice recorded yet.</div>
                            ) : (
                                <div className="space-y-2">
                                    {advice.slice().reverse().map((entry) => (
                                        <div key={`${entry.timestamp}-${entry.playerIndex}-${entry.mode}`} className="border-b border-gray-800 pb-2 last:border-0">
                                            <div className="flex justify-between gap-2 text-xs text-gray-300">
                                                <span>P{entry.playerIndex} / {entry.mode}</span>
                                                <span className={entry.fallback ? "text-red-300" : "text-green-300"}>{entry.result}</span>
                                            </div>
                                            <div className="mt-1 whitespace-pre-wrap text-xs leading-snug text-gray-100">{entry.analysis}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="rounded border border-gray-700 bg-black/30 p-3">
                            <div className="mb-2 text-sm font-bold">Recent Logs</div>
                            <div className="max-h-48 overflow-y-auto text-xs text-gray-300">
                                {snapshot.logs.slice(-12).reverse().map((log, logIndex) => (
                                    <div key={`${logIndex}-${log}`} className="border-b border-gray-800 py-1 last:border-0">
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
