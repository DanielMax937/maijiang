import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { GameActionRecord, Tile } from "@/lib/mahjong/types";

function tileDisplayName(tile: Tile): string {
    const suitNames: Record<string, string> = { bamboo: "条", character: "万", dot: "筒" };
    const windNames: Record<string, string> = { east: "东风", south: "南风", west: "西风", north: "北风" };
    const dragonNames: Record<string, string> = { red: "红中", green: "发财", white: "白板" };
    if (tile.suit === "wind") return windNames[tile.rank as string] || `${tile.rank}`;
    if (tile.suit === "dragon") return dragonNames[tile.rank as string] || `${tile.rank}`;
    const sn = suitNames[tile.suit];
    if (sn && typeof tile.rank === "number") {
        const numNames = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
        return `${numNames[tile.rank]}${sn}`;
    }
    return `${tile.suit} ${tile.rank}`;
}

const actionNames: Record<string, string> = {
    discard: "打出", chi: "吃", peng: "碰", gang: "杠", hu: "胡", pass: "过",
};

interface GameLogProps {
    actions: GameActionRecord[];
    isVisible: boolean;
    showLlmAnalysis: boolean;
    onClose: () => void;
    onToggleAnalysis: () => void;
}

export function GameLog({ actions, isVisible, showLlmAnalysis, onClose, onToggleAnalysis }: GameLogProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only drag from the header bar
        if ((e.target as HTMLElement).closest("button")) return;
        e.preventDefault();
        dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y };
        const handleMouseMove = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            setPosition({
                x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
                y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
            });
        };
        const handleMouseUp = () => {
            dragRef.current = null;
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }, [position]);

    if (!isVisible) return null;

    const playerNames = ["You", "Bot 1", "Bot 2", "Bot 3"];

    return (
        <div
            className="fixed bottom-4 right-4 z-50 w-80"
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        >
            {/* Header - draggable */}
            <div
                className="flex items-center justify-between bg-stone-800 px-3 py-2 rounded-t-lg border border-stone-600 cursor-move select-none"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2">
                    <span className="text-stone-300 text-sm font-bold">📋 Game Log</span>
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
                            暂无操作记录
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
                                                    {actionNames[action.action] || action.action}
                                                    {action.tile && ` ${tileDisplayName(action.tile)}`}
                                                </span>
                                            </div>
                                            {/* LLM Analysis */}
                                            {showLlmAnalysis && action.llmAnalysis && (
                                                <div className="mt-1 bg-stone-800/80 rounded p-1.5">
                                                    <div className="flex items-center gap-1 mb-0.5">
                                                        <span className="text-purple-400 text-[10px] font-bold">LLM</span>
                                                        {action.isLlmFallback && (
                                                            <span className="text-yellow-500 text-[10px]">(规则AI)</span>
                                                        )}
                                                    </div>
                                                    <p className="text-stone-400 text-[11px] leading-relaxed">
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
