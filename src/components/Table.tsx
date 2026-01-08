"use client";

import React, { useEffect, useState, useRef } from "react";
import { GameState, Player, Tile as MahjongTileType, Region, RuleStrategy } from "@/lib/mahjong/types";
import { initializeGame, drawTile, discardTile, getRules, resolvePendingActions, stepGame } from "@/lib/mahjong/game";
import { Hand } from "./Hand";
import { Tile } from "./Tile";
import { DiscardPile } from "./DiscardPile";
import { TurnIndicator } from "./TurnIndicator";
import { ActionButtons } from "./ActionButtons";
import { MeldDisplay } from "./MeldDisplay";
import { GameOverScreen } from "./GameOverScreen";
import { GameInfo } from "./GameInfo";
import { cn } from "@/lib/utils";
import { getStrategy } from "@/lib/mahjong/rules";

export function Table() {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isDevMode, setIsDevMode] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [autoPause, setAutoPause] = useState(false);

    // Refs to avoid stale closures in async loops
    const isPausedRef = useRef(isPaused);
    const autoPauseRef = useRef(autoPause);

    useEffect(() => {
        isPausedRef.current = isPaused;
        autoPauseRef.current = autoPause;
    }, [isPaused, autoPause]);

    const [region, setRegion] = useState<Region>("chinese");
    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        try {
            const initialGame = initializeGame(region);
            setGameState(initialGame);
        } catch (err) {
            console.error("Failed to initialize game:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    }, [region]);

    // Central Game Loop driven by stepGame
    useEffect(() => {
        if (!gameState || gameState.isGameOver || !mounted) return;
        if (isPaused) return; // Pause Check

        // If autoPause is ON, we don't run the interval. User clicks "Next" manually.
        if (autoPause) return;

        const timer = setInterval(() => {
            setGameState(prevState => {
                if (!prevState || prevState.isGameOver) return prevState;

                // If it's human's turn to DISCARD, we don't step automatically
                // Unless we implement auto-discard for human later
                if (prevState.phase === "DISCARD" && prevState.currentTurn === 0) {
                    return prevState;
                }

                // If waiting for human input in RESOLVE phase, don't step
                if (prevState.phase === "RESOLVE" && prevState.pendingActions[0] && !prevState.actionDecisions[0]) {
                    return prevState;
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
    }, [gameState?.isGameOver, isPaused, autoPause, mounted]);

    // Handle "Next" Step manually
    const handleNextStep = () => {
        setGameState(prev => {
            if (!prev) return null;
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
                    let newState = { ...prev };
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
                return { ...prev, actionTimer: prev.actionTimer - 1 };
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameState?.isGameOver, gameState?.isWaitingForAction, isPaused]);

    const handleTileClick = (tileId: string) => {
        if (!gameState) return;
        if (gameState.isWaitingForAction) return; // Can't discard while waiting
        if (gameState.currentTurn !== 0) return;

        // Discard logic
        const newState = discardTile(gameState, tileId);
        setGameState(newState);
    };

    // Auto-draw for Player 0
    useEffect(() => {
        if (!gameState || gameState.isGameOver || gameState.isWaitingForAction || isPaused) return;
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


    if (!mounted) return <div className="flex items-center justify-center h-screen bg-[#1e5128] text-white">Loading...</div>;
    if (error) return <div className="flex items-center justify-center h-screen text-red-500">Error: {error}</div>;
    if (!gameState) return <div className="flex items-center justify-center h-screen bg-[#1e5128] text-white">Loading...</div>;

    const player = gameState.players[0];

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
        const strategy = getStrategy(gameState.rules.region);
        const player = gameState.players[playerIndex];
        const hand = player.hand;
        const isMyTurn = gameState.currentTurn === playerIndex;
        const hasFullHand = hand.length % 3 === 2;
        const isSelfDraw = isMyTurn && hasFullHand;

        if (isSelfDraw) {
            return {
                chi: false,
                peng: false,
                gang: strategy.canGang(hand, null, true),
                hu: strategy.canHu(hand, null, true),
                pass: false
            };
        }

        return { chi: false, peng: false, gang: false, hu: false, pass: false };
    };

    const handleAction = (action: string, playerIndex: number = 0) => {
        if (!gameState) return;
        console.log(`Player ${playerIndex} chose ${action}`);

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
        const newGame = initializeGame(region);
        setGameState(newGame);
        setIsPaused(false);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f2912] relative overflow-hidden">
            {/* Game Over Screen */}
            {gameState.isGameOver && (
                <GameOverScreen
                    winner={gameState.winner}
                    isDrawGame={gameState.winner === null && gameState.deck.length === 0}
                    onNewGame={handleNewGame}
                />
            )}
            {/* Dev Mode Toggle */}
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
                    </div>
                )}
            </div>

            {/* Center Table (Discard Area) - Fixed Size in Middle */}
            <div className="fixed inset-0 m-auto w-[400px] h-[400px] bg-[#1e5128] rounded-xl border-4 border-[#2a6b35] shadow-2xl flex items-center justify-center z-0">
                {/* Game Info (Wall Count + Wind Indicators) */}
                <GameInfo
                    wallCount={gameState.wallCount}
                    currentTurn={gameState.currentTurn}
                    playerWinds={gameState.players.map(p => p.wind)}
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
                    <TurnIndicator isActive={gameState.currentTurn === 0} />
                    <DiscardPile tiles={gameState.players[0].discards} />
                </div>
            </div>

            {/* --- Players Hands (Positioned at Edges) --- */}

            {/* Top Player (Bot 2) */}
            <div className="fixed top-0 left-0 right-0 h-32 z-10 pointer-events-none">
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 rotate-180 pointer-events-auto flex flex-col items-center gap-1">
                    <Hand tiles={gameState.players[2].hand} isCurrentPlayer={false} faceDown={!isDevMode} />
                    <div className="rotate-180">
                        <MeldDisplay melds={gameState.players[2].melds} />
                    </div>
                </div>
            </div>

            {/* Left Player (Bot 3) */}
            <div className="fixed left-0 top-0 bottom-0 w-32 z-10 pointer-events-none">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 rotate-90 pointer-events-auto flex flex-col items-center gap-1">
                    <Hand tiles={gameState.players[3].hand} isCurrentPlayer={false} faceDown={!isDevMode} />
                    <div className="-rotate-90">
                        <MeldDisplay melds={gameState.players[3].melds} />
                    </div>
                </div>
            </div>

            {/* Right Player (Bot 1) */}
            <div className="fixed right-0 top-0 bottom-0 w-32 z-10 pointer-events-none">
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 -rotate-90 pointer-events-auto flex flex-col items-center gap-1">
                    <Hand tiles={gameState.players[1].hand} isCurrentPlayer={false} faceDown={!isDevMode} />
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
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <MeldDisplay melds={player.melds} />
                        <Hand
                            tiles={player.hand}
                            isCurrentPlayer={gameState.currentTurn === 0}
                            onTileClick={handleTileClick}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
}
