import React from "react";
import { Tile as TileType } from "@/lib/mahjong/types";
import { cn } from "@/lib/utils";

interface TileProps {
    tile: TileType;
    onClick?: () => void;
    className?: string;
    selected?: boolean;
    faceDown?: boolean;
}

export function Tile({ tile, onClick, className, selected, faceDown }: TileProps) {
    // Helper to get the SVG filename for a tile
    const getTileSvg = () => {
        if (faceDown) {
            return "/tiles/back.svg";
        }

        const { suit, rank } = tile;

        // Map suit and rank to SVG filename
        if (suit === "bamboo") return `/tiles/${rank}s.svg`;
        if (suit === "character") return `/tiles/${rank}m.svg`;
        if (suit === "dot") return `/tiles/${rank}p.svg`;
        if (suit === "wind") return `/tiles/${rank}.svg`;
        if (suit === "dragon") return `/tiles/${rank}.svg`;

        return "/tiles/back.svg"; // fallback
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "relative w-12 h-16 bg-white border-2 rounded-md shadow-md cursor-pointer transition-transform select-none",
                faceDown ? "bg-blue-700 border-blue-800" : "hover:-translate-y-2",
                selected && !faceDown ? "-translate-y-4 border-blue-500 ring-2 ring-blue-300" : "border-gray-300",
                className
            )}
        >
            {/* 3D effect bottom border */}
            <div className={cn("absolute bottom-0 left-0 right-0 h-1 rounded-b-sm", faceDown ? "bg-blue-900" : "bg-gray-400")} />

            {/* Tile Face */}
            <div className="absolute inset-0 pb-1 flex items-center justify-center">
                <img
                    src={getTileSvg()}
                    alt={`${tile.suit} ${tile.rank}`}
                    className="w-full h-full object-contain p-1"
                />
            </div>
        </div>
    );
}
