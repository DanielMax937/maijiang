import React from "react";
import { cn } from "@/lib/utils";

interface TurnIndicatorProps {
    isActive: boolean;
    isHuman?: boolean;
    className?: string;
    orientation?: "horizontal" | "vertical";
}

export function TurnIndicator({ isActive, isHuman = false, className, orientation = "horizontal" }: TurnIndicatorProps) {
    if (!isActive) return null;

    return (
        <div className={cn("flex flex-col items-center gap-1", className)}>
            <div
                className={cn(
                    "shadow-[0_0_12px_rgba(250,204,21,0.9)] animate-pulse rounded-full",
                    isHuman ? "bg-amber-400" : "bg-yellow-400",
                    orientation === "horizontal" ? "h-1.5 w-36" : "w-1.5 h-36",
                )}
            />
            {isHuman && (
                <span className="text-amber-400 text-xs font-bold animate-pulse whitespace-nowrap">
                    Your Turn
                </span>
            )}
        </div>
    );
}
