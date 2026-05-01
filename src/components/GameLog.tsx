import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { GameActionRecord } from "@/lib/mahjong/types";

interface GameLogProps {
    actions: GameActionRecord[];
    isVisible: boolean;
    showLlmAnalysis: boolean;
    onClose: () => void;
    onToggleAnalysis: () => void;
}

export function GameLog({ actions, isVisible, showLlmAnalysis, onClose, onToggleAnalysis }: GameLogProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (!isVisible) return null;

    const playerNames = ["You", "Bot 1", "Bot 2", "Bot 3"];

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80">
            {/* Header */}
            <div className="flex items-center justify-between bg-stone-800 px-3 py-2 rounded-t-lg border border-stone-600">
                <div className="flex items-center gap-2">
                    <span className="text-stone-300 text-sm font-bold">Game Log</span>
                    <span className="text-stone-500 text-xs">({actions.length})</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onToggleAnalysis}
                        className={cn(
                            "px-2 py-0.5 text-xs rounded transition-colors",
                            showLlmAnalysis
                                ? "bg-purple-600 text-white"
                                : "bg-stone-600 text-stone-400"
                        )}
                    >
                        LLM
                    </button>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="text-stone-400 hover:text-stone-200 px-1"
                    >
                        {isCollapsed ? "▼" : "▲"}
                    </button>
                    <button
                        onClick={onClose}
                        className="text-stone-400 hover:text-stone-200 px-1"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Log Content */}
            {!isCollapsed && (
                <div className="bg-stone-900/95 border border-t-0 border-stone-600 rounded-b-lg max-h-80 overflow-y-auto">
                    {actions.length === 0 ? (
                        <div className="p-4 text-stone-500 text-sm text-center">
                            No actions recorded yet
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {[...actions].reverse().map((action, i) => (
                                <div
                                    key={action.id}
                                    className="border-b border-stone-800 pb-1 last:border-0"
                                >
                                    <div className="flex items-start gap-2">
                                        <span className="text-stone-500 text-xs shrink-0 w-6 text-right">
                                            {actions.length - i}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className={cn(
                                                    "text-xs font-bold",
                                                    action.playerIndex === 0 ? "text-amber-400" : "text-blue-400"
                                                )}>
                                                    {playerNames[action.playerIndex]}
                                                </span>
                                                <span className="text-stone-400 text-xs">
                                                    {action.action}
                                                    {action.tile && ` ${action.tile.suit} ${action.tile.rank}`}
                                                </span>
                                            </div>
                                            {/* LLM Analysis */}
                                            {showLlmAnalysis && action.llmAnalysis && (
                                                <div className="mt-1 bg-stone-800/80 rounded p-1.5">
                                                    <div className="flex items-center gap-1 mb-0.5">
                                                        <span className="text-purple-400 text-[10px] font-bold">LLM</span>
                                                        {action.isLlmFallback && (
                                                            <span className="text-yellow-500 text-[10px]">(fallback)</span>
                                                        )}
                                                    </div>
                                                    <p className="text-stone-400 text-[11px] leading-relaxed line-clamp-3">
                                                        {action.llmAnalysis}
                                                    </p>
                                                </div>
                                            )}
                                            {/* Deferred Analysis */}
                                            {action.deferredAnalysis && (
                                                <div className="mt-1 bg-indigo-900/30 rounded p-1.5">
                                                    <div className="text-indigo-400 text-[10px] font-bold mb-0.5">
                                                        延迟分析
                                                    </div>
                                                    <p className="text-stone-400 text-[11px] line-clamp-2">
                                                        {action.deferredAnalysis.recommended}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
