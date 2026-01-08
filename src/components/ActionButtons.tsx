import React from "react";
import { cn } from "@/lib/utils";

interface ActionButtonsProps {
    availableActions: {
        chi: boolean;
        peng: boolean;
        gang: boolean;
        hu: boolean;
        pass?: boolean;
    };
    onAction: (action: "chi" | "peng" | "gang" | "hu" | "pass") => void;
    timer: number;
    className?: string;
}

export function ActionButtons({ availableActions, onAction, timer, className }: ActionButtonsProps) {
    // Only show if there are any available actions
    const hasAnyAction = availableActions.chi || availableActions.peng || availableActions.gang || availableActions.hu || availableActions.pass;

    if (!hasAnyAction) return null;

    return (
        <div className={cn("flex flex-col items-center gap-1", className)}>
            <div className="flex items-center gap-2 bg-black/60 p-2 rounded backdrop-blur-sm">
                <button
                    onClick={() => onAction("chi")}
                    disabled={!availableActions.chi}
                    className={cn(
                        "px-3 py-1 text-xs rounded font-bold transition-colors",
                        availableActions.chi
                            ? "bg-blue-600 text-white hover:bg-blue-500"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                >
                    Chi
                </button>
                <button
                    onClick={() => onAction("peng")}
                    disabled={!availableActions.peng}
                    className={cn(
                        "px-3 py-1 text-xs rounded font-bold transition-colors",
                        availableActions.peng
                            ? "bg-blue-600 text-white hover:bg-blue-500"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                >
                    Peng
                </button>
                <button
                    onClick={() => onAction("gang")}
                    disabled={!availableActions.gang}
                    className={cn(
                        "px-3 py-1 text-xs rounded font-bold transition-colors",
                        availableActions.gang
                            ? "bg-blue-600 text-white hover:bg-blue-500"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                >
                    Gang
                </button>
                <button
                    onClick={() => onAction("hu")}
                    disabled={!availableActions.hu}
                    className={cn(
                        "px-3 py-1 text-xs rounded font-bold transition-colors",
                        availableActions.hu
                            ? "bg-red-600 text-white hover:bg-red-500"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                >
                    Hu
                </button>

                {/* Pass Button */}
                {availableActions.pass && (
                    <button
                        onClick={() => onAction("pass")}
                        className="px-3 py-1 text-xs rounded font-bold transition-colors bg-stone-600 text-white hover:bg-stone-500"
                    >
                        Pass
                    </button>
                )}

                {/* Timer Display */}
                <div className={cn(
                    "text-xs font-mono font-bold px-2 py-1 rounded ml-2 text-white",
                    timer <= 5 ? "bg-red-500 animate-pulse" : "bg-gray-700"
                )}>
                    {timer}s
                </div>
            </div>
        </div>
    );
}
