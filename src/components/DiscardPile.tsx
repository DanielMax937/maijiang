import React from "react";
import { Tile as TileType } from "@/lib/mahjong/types";
import { Tile } from "./Tile";
import { cn } from "@/lib/utils";

interface DiscardPileProps {
    tiles: TileType[];
    className?: string;
    orientation?: "bottom" | "right" | "top" | "left";
}

export function DiscardPile({ tiles, className, orientation = "bottom" }: DiscardPileProps) {
    // Grid layout depends on orientation
    // Standard is 6 tiles per row

    return (
        <div className={cn("grid grid-cols-6 gap-1 w-64", className)}>
            {tiles.map((tile) => (
                <div key={tile.id} className="relative w-8 h-10">
                    <Tile tile={tile} className="w-full h-full text-xs" />
                </div>
            ))}
        </div>
    );
}
