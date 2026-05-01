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
    disabled?: boolean;
    className?: string;
}

export function ActionButtons({ availableActions, onAction, timer, disabled = false, className }: ActionButtonsProps) {
    // Only show if there are any available actions
    const hasAnyAction = availableActions.chi || availableActions.peng || availableActions.gang || availableActions.hu || availableActions.pass;

    if (!hasAnyAction) return null;

    return (
        <div className={cn("flex flex-col items-center gap-1", className)}>
            <div className={cn(
                "flex items-center gap-2 p-2 rounded backdrop-blur-sm transition-opacity",
                disabled ? "bg-black/40 opacity-50" : "bg-black/60"
            )}>
                <button
                    onClick={() => onAction("chi")}
                    disabled={!availableActions.chi || disabled}
                    className={cn(
                        "px-3 py-1 text-xs rounded font-bold transition-colors",
                        availableActions.chi && !disabled
                            ? "bg-blue-600 text-white hover:bg-blue-500"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                >
                    Chi
                </button>
                <button
                    onClick={() => onAction("peng")}
                    disabled={!availableActions.peng || disabled}
                    className={cn(
                        "px-3 py-1 text-xs rounded font-bold transition-colors",
                        availableActions.peng && !disabled
                            ? "bg-blue-600 text-white hover:bg-blue-500"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                >
                    Peng
                </button>
                <button
                    onClick={() => onAction("gang")}
                    disabled={!availableActions.gang || disabled}
                    className={cn(
                        "px-3 py-1 text-xs rounded font-bold transition-colors",
                        availableActions.gang && !disabled
                            ? "bg-blue-600 text-white hover:bg-blue-500"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                >
                    Gang
                </button>
                <button
                    onClick={() => onAction("hu")}
                    disabled={!availableActions.hu || disabled}
                    className={cn(
                        "px-3 py-1 text-xs rounded font-bold transition-colors",
                        availableActions.hu && !disabled
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
                        disabled={disabled}
                        className={cn(
                            "px-3 py-1 text-xs rounded font-bold transition-colors",
                            disabled
                                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                : "bg-stone-600 text-white hover:bg-stone-500"
                        )}
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
