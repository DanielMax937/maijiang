import React from "react";
import { cn } from "@/lib/utils";

interface GameInfoProps {
    wallCount: number;
    currentTurn: number;
    playerWinds: ("east" | "south" | "west" | "north")[];
    playerScores?: number[];
    className?: string;
}

const windLabel: Record<string, string> = {
    east: "東",
    south: "南",
    west: "西",
    north: "北",
};

export function GameInfo({ wallCount, currentTurn, playerWinds, playerScores, className }: GameInfoProps) {
    return (
        <div className={cn(
            "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10",
            "flex flex-col items-center gap-2",
            className
        )}>
            {/* Wall Count */}
            <div className="bg-black/60 rounded-lg px-4 py-2 text-center backdrop-blur-sm border border-stone-600">
                <div className="text-stone-400 text-xs uppercase tracking-wider">Tiles Left</div>
                <div className={cn(
                    "text-3xl font-bold",
                    wallCount <= 14 ? "text-red-400 animate-pulse" : "text-white"
                )}>
                    {wallCount}
                </div>
            </div>

            {/* Wind Indicator Circle */}
            <div className="relative w-28 h-28">
                {/* Center - Round Wind */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-amber-600/30 rounded-full border-2 border-amber-500 flex items-center justify-center text-amber-400 text-xs font-bold">
                        {windLabel[playerWinds[0]]}
                    </div>
                </div>

                {/* Player 0 (Bottom) - You */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 flex flex-col items-center gap-0.5">
                    <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                        currentTurn === 0 ? "bg-yellow-500 text-black font-bold ring-2 ring-yellow-300" : "bg-stone-700 text-stone-400"
                    )}>
                        {windLabel[playerWinds[0]]}
                    </div>
                    {playerScores && (
                        <span className="text-amber-400 text-[10px] font-bold">{playerScores[0]}</span>
                    )}
                </div>

                {/* Player 1 (Right) */}
                <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 flex items-center gap-0.5">
                    <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                        currentTurn === 1 ? "bg-yellow-500 text-black font-bold ring-2 ring-yellow-300" : "bg-stone-700 text-stone-400"
                    )}>
                        {windLabel[playerWinds[1]]}
                    </div>
                    {playerScores && (
                        <span className="text-stone-400 text-[10px]">{playerScores[1]}</span>
                    )}
                </div>

                {/* Player 2 (Top) */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 flex flex-col items-center gap-0.5">
                    {playerScores && (
                        <span className="text-stone-400 text-[10px]">{playerScores[2]}</span>
                    )}
                    <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                        currentTurn === 2 ? "bg-yellow-500 text-black font-bold ring-2 ring-yellow-300" : "bg-stone-700 text-stone-400"
                    )}>
                        {windLabel[playerWinds[2]]}
                    </div>
                </div>

                {/* Player 3 (Left) */}
                <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 flex items-center gap-0.5">
                    {playerScores && (
                        <span className="text-stone-400 text-[10px]">{playerScores[3]}</span>
                    )}
                    <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                        currentTurn === 3 ? "bg-yellow-500 text-black font-bold ring-2 ring-yellow-300" : "bg-stone-700 text-stone-400"
                    )}>
                        {windLabel[playerWinds[3]]}
                    </div>
                </div>
            </div>
        </div>
    );
}
