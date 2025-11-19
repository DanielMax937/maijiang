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
        <div className={cn("flex flex-wrap gap-1 w-48 h-32 content-start", className)}>
            {tiles.map((tile) => (
                <div key={tile.id} className="transform scale-75 origin-center">
                    <Tile tile={tile} className="w-8 h-10 text-xs" />
                </div>
            ))}
        </div>
    );
}
