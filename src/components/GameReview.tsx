import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { GameActionRecord, GameState, Tile } from "@/lib/mahjong/types";
import { Tile as TileComponent } from "./Tile";
import { requestMahjongAI } from "@/lib/mahjong/llmAI";

interface GameReviewProps {
    actions: GameActionRecord[];
    onClose: () => void;
    deferredAnalysisMode: boolean;
}

export function GameReview({ actions, onClose, deferredAnalysisMode }: GameReviewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [autoPlaySpeed, setAutoPlaySpeed] = useState(2000);
    const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null);
    const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });

    const totalActions = actions.length;
    const currentAction = actions[currentIndex];

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

            switch (e.key) {
                case "ArrowLeft":
                    e.preventDefault();
                    setCurrentIndex(prev => Math.max(0, prev - 1));
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    setCurrentIndex(prev => Math.min(totalActions - 1, prev + 1));
                    break;
                case " ":
                    e.preventDefault();
                    setIsAutoPlaying(prev => !prev);
                    break;
                case "Escape":
                    onClose();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [totalActions, onClose]);

    // Auto-play
    useEffect(() => {
        if (!isAutoPlaying) return;
        if (currentIndex >= totalActions - 1) {
            setIsAutoPlaying(false);
            return;
        }

        const timer = setTimeout(() => {
            setCurrentIndex(prev => Math.min(totalActions - 1, prev + 1));
        }, autoPlaySpeed);

        return () => clearTimeout(timer);
    }, [isAutoPlaying, currentIndex, totalActions, autoPlaySpeed]);

    // Deferred analysis
    const runDeferredAnalysis = useCallback(async () => {
        if (!deferredAnalysisMode) return;

        setAnalysisProgress({ current: 0, total: actions.length });

        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            if (action.deferredAnalysis) continue; // Already analyzed

            setAnalyzingIndex(i);
            setAnalysisProgress({ current: i + 1, total: actions.length });

            try {
                const response = await requestMahjongAI({
                    mode: "analyze",
                    gameState: action.gameStateSnapshot as any,
                    playerIndex: action.playerIndex,
                    actualAction: action.action,
                    actualTile: action.tile ? `${action.tile.suit} ${action.tile.rank}` : undefined,
                });

                // Update the action with deferred analysis
                action.deferredAnalysis = {
                    recommended: response.recommended || response.analysis,
                    actual: `${action.action}${action.tile ? ` ${action.tile.suit} ${action.tile.rank}` : ""}`,
                    pros: response.pros || [],
                    cons: response.cons || [],
                    score: response.score,
                };
            } catch (err) {
                action.deferredAnalysis = {
                    recommended: "分析失败",
                    actual: `${action.action}${action.tile ? ` ${action.tile.suit} ${action.tile.rank}` : ""}`,
                    pros: [],
                    cons: [],
                };
            }
        }

        setAnalyzingIndex(null);
    }, [actions, deferredAnalysisMode]);

    const playerNames = ["You", "Bot 1", "Bot 2", "Bot 3"];

    const renderTile = (tile: Tile, index: number) => (
        <TileComponent
            key={`${tile.id}-${index}`}
            tile={tile}
            className="w-8 h-11"
        />
    );

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-stone-800 border-b border-stone-700">
                <div className="flex items-center gap-4">
                    <h2 className="text-amber-400 font-bold text-lg">Game Review</h2>
                    <span className="text-stone-400 text-sm">
                        Step {currentIndex + 1} / {totalActions}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {deferredAnalysisMode && (
                        <button
                            onClick={runDeferredAnalysis}
                            disabled={analyzingIndex !== null}
                            className={cn(
                                "px-3 py-1 text-sm rounded font-bold transition-colors",
                                analyzingIndex !== null
                                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                    : "bg-purple-600 text-white hover:bg-purple-500"
                            )}
                        >
                            {analyzingIndex !== null
                                ? `分析中 ${analysisProgress.current}/${analysisProgress.total}`
                                : "Run Deferred Analysis"}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-3 py-1 bg-stone-600 text-white text-sm rounded hover:bg-stone-500"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Game Board */}
                <div className="flex-1 flex items-center justify-center p-8">
                    {currentAction && (
                        <div className="bg-[#1e5128] rounded-xl p-8 max-w-3xl w-full">
                            {/* Action Info */}
                            <div className="text-center mb-6">
                                <div className="text-amber-400 font-bold text-xl mb-2">
                                    {playerNames[currentAction.playerIndex]} - {currentAction.action.toUpperCase()}
                                    {currentAction.tile && ` (${currentAction.tile.suit} ${currentAction.tile.rank})`}
                                </div>
                            </div>

                            {/* Players */}
                            <div className="grid grid-cols-2 gap-6">
                                {currentAction.gameStateSnapshot.players.map((player, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "bg-black/30 rounded-lg p-4",
                                            idx === currentAction.playerIndex && "ring-2 ring-amber-500"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={cn(
                                                "font-bold",
                                                idx === 0 ? "text-amber-400" : "text-blue-400"
                                            )}>
                                                {playerNames[idx]}
                                            </span>
                                            <span className="text-stone-400 text-sm">
                                                {player.score} pts
                                            </span>
                                        </div>

                                        {/* Hand */}
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {player.hand.map((tile, ti) => renderTile(tile, ti))}
                                        </div>

                                        {/* Melds */}
                                        {player.melds.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {player.melds.map((meld, mi) => (
                                                    <div key={mi} className="flex gap-0.5">
                                                        {meld.tiles.map((tile, ti) => renderTile(tile, ti))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Discards */}
                                        {player.discards.length > 0 && (
                                            <div className="mt-2">
                                                <span className="text-stone-500 text-xs">Discards:</span>
                                                <div className="flex flex-wrap gap-0.5 mt-1">
                                                    {player.discards.map((tile, di) => (
                                                        <div key={di} className="w-5 h-7">
                                                            <TileComponent tile={tile} className="w-5 h-7" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Analysis Panel */}
                <div className="w-96 bg-stone-800 border-l border-stone-700 overflow-y-auto p-4">
                    <h3 className="text-amber-400 font-bold mb-4">LLM Analysis</h3>

                    {currentAction?.llmAnalysis ? (
                        <div className="bg-stone-900 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-purple-400 text-sm font-bold">实时分析</span>
                                {currentAction.isLlmFallback && (
                                    <span className="text-yellow-500 text-xs">(fallback)</span>
                                )}
                            </div>
                            <p className="text-stone-300 text-sm leading-relaxed">
                                {currentAction.llmAnalysis}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-stone-900 rounded-lg p-4 mb-4 text-stone-500 text-sm">
                            No LLM analysis available
                        </div>
                    )}

                    {currentAction?.deferredAnalysis && (
                        <div className="bg-indigo-900/30 rounded-lg p-4 mb-4">
                            <span className="text-indigo-400 text-sm font-bold mb-2 block">延迟分析</span>
                            <p className="text-stone-300 text-sm leading-relaxed">
                                {currentAction.deferredAnalysis.recommended}
                            </p>
                            {currentAction.deferredAnalysis.score !== undefined && (
                                <div className="mt-2 text-stone-400 text-xs">
                                    Quality Score: {currentAction.deferredAnalysis.score}/100
                                </div>
                            )}
                        </div>
                    )}

                    {/* All Actions List */}
                    <h3 className="text-amber-400 font-bold mb-2 mt-6">All Actions</h3>
                    <div className="space-y-1">
                        {actions.map((action, i) => (
                            <button
                                key={action.id}
                                onClick={() => setCurrentIndex(i)}
                                className={cn(
                                    "w-full text-left px-3 py-1.5 rounded text-xs transition-colors",
                                    i === currentIndex
                                        ? "bg-amber-600 text-white"
                                        : "bg-stone-700 text-stone-300 hover:bg-stone-600"
                                )}
                            >
                                <span className="font-bold">{playerNames[action.playerIndex]}</span>
                                {" "}
                                <span>{action.action}</span>
                                {action.tile && (
                                    <span className="text-stone-400">
                                        {" "}{action.tile.suit} {action.tile.rank}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 px-6 py-3 bg-stone-800 border-t border-stone-700">
                <button
                    onClick={() => setCurrentIndex(0)}
                    disabled={currentIndex === 0}
                    className="px-3 py-1 bg-stone-600 text-white text-sm rounded hover:bg-stone-500 disabled:opacity-50"
                >
                    ⏮
                </button>
                <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="px-3 py-1 bg-stone-600 text-white text-sm rounded hover:bg-stone-500 disabled:opacity-50"
                >
                    ◀
                </button>
                <button
                    onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                    className={cn(
                        "px-4 py-1 text-sm rounded font-bold",
                        isAutoPlaying
                            ? "bg-red-600 text-white hover:bg-red-500"
                            : "bg-green-600 text-white hover:bg-green-500"
                    )}
                >
                    {isAutoPlaying ? "⏸ Pause" : "▶ Play"}
                </button>
                <button
                    onClick={() => setCurrentIndex(prev => Math.min(totalActions - 1, prev + 1))}
                    disabled={currentIndex >= totalActions - 1}
                    className="px-3 py-1 bg-stone-600 text-white text-sm rounded hover:bg-stone-500 disabled:opacity-50"
                >
                    ▶
                </button>
                <button
                    onClick={() => setCurrentIndex(totalActions - 1)}
                    disabled={currentIndex >= totalActions - 1}
                    className="px-3 py-1 bg-stone-600 text-white text-sm rounded hover:bg-stone-500 disabled:opacity-50"
                >
                    ⏭
                </button>

                {/* Speed Selector */}
                <select
                    value={autoPlaySpeed}
                    onChange={(e) => setAutoPlaySpeed(Number(e.target.value))}
                    className="bg-stone-700 text-white text-sm px-2 py-1 rounded border border-stone-600"
                >
                    <option value={500}>0.5s</option>
                    <option value={1000}>1s</option>
                    <option value={1500}>1.5s</option>
                    <option value={2000}>2s</option>
                    <option value={3000}>3s</option>
                </select>

                {/* Slider */}
                <input
                    type="range"
                    min={0}
                    max={totalActions - 1}
                    value={currentIndex}
                    onChange={(e) => setCurrentIndex(Number(e.target.value))}
                    className="flex-1 max-w-md"
                />
            </div>
        </div>
    );
}
