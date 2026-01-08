import React from "react";
import { cn } from "@/lib/utils";

interface TurnIndicatorProps {
    isActive: boolean;
    className?: string;
    orientation?: "horizontal" | "vertical";
}

export function TurnIndicator({ isActive, className, orientation = "horizontal" }: TurnIndicatorProps) {
    if (!isActive) return null;

    return (
        <div
            className={cn(
                "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-pulse rounded-full",
                orientation === "horizontal" ? "h-1 w-32" : "w-1 h-32",
                className
            )}
        />
    );
}
