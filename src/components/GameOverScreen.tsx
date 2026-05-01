import React from "react";
import { cn } from "@/lib/utils";
import { ScoreResult } from "@/lib/mahjong/types";

interface GameOverScreenProps {
    winner: number | null;
    isDrawGame: boolean;
    scoreResult?: ScoreResult;
    onNewGame: () => void;
    onReview: () => void;
    className?: string;
}

export function GameOverScreen({ winner, isDrawGame, scoreResult, onNewGame, onReview, className }: GameOverScreenProps) {
    const isHumanWinner = winner === 0;

    return (
        <div className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm",
            className
        )}>
            <div className="bg-gradient-to-b from-stone-800 to-stone-900 rounded-2xl p-8 shadow-2xl border border-stone-700 max-w-md w-full mx-4 text-center">
                {/* Trophy/Icon */}
                <div className="text-7xl mb-4">
                    {isDrawGame ? "🤝" : isHumanWinner ? "🏆" : "😔"}
                </div>

                {/* Title */}
                <h1 className={cn(
                    "text-4xl font-bold mb-2",
                    isDrawGame ? "text-yellow-400" : isHumanWinner ? "text-amber-400" : "text-gray-400"
                )}>
                    {isDrawGame ? "Draw Game!" : isHumanWinner ? "You Win!" : "Game Over"}
                </h1>

                {/* Subtitle */}
                <p className="text-stone-400 text-lg mb-6">
                    {isDrawGame
                        ? "No more tiles remaining"
                        : isHumanWinner
                            ? "Congratulations! You achieved Hu!"
                            : `Bot ${winner} wins with Hu!`}
                </p>

                {/* Score Display */}
                {scoreResult && !isDrawGame && (
                    <div className="bg-black/30 rounded-lg p-4 mb-4">
                        <div className="text-amber-400 text-2xl font-bold mb-2">
                            {scoreResult.total} points
                        </div>
                        <div className="text-stone-400 text-sm mb-2">
                            Base: {scoreResult.base} × 2<sup>{scoreResult.fan}</sup> fan
                        </div>
                        {scoreResult.breakdown.length > 0 && (
                            <div className="text-left text-xs text-stone-500 space-y-1">
                                {scoreResult.breakdown.map((item, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <span className="text-amber-500">•</span>
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Stats */}
                <div className="bg-black/30 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-stone-500">Winner</span>
                            <p className="text-white font-bold">
                                {isDrawGame ? "None" : winner === 0 ? "You" : `Bot ${winner}`}
                            </p>
                        </div>
                        <div>
                            <span className="text-stone-500">Result</span>
                            <p className="text-white font-bold">
                                {isDrawGame ? "Draw" : "Hu"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onReview}
                        className="w-full py-3 px-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                    >
                        Review Game
                    </button>
                    <button
                        onClick={onNewGame}
                        className="w-full py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                    >
                        New Game
                    </button>
                </div>
            </div>
        </div>
    );
}
