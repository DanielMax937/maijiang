import React from "react";
import { Tile as TileType } from "@/lib/mahjong/types";
import { cn } from "@/lib/utils";

interface TileProps {
    tile: TileType;
    onClick?: () => void;
    className?: string;
    selected?: boolean;
    faceDown?: boolean;
    isTenpai?: boolean;
    isCaishen?: boolean;
}

export function Tile({ tile, onClick, className, selected, faceDown, isTenpai, isCaishen }: TileProps) {
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
                isTenpai && !faceDown && !selected && "border-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]",
                isCaishen && !faceDown && "border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)] bg-yellow-50",
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

            {/* Tenpai indicator badge */}
            {isTenpai && !faceDown && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border border-green-600 shadow-sm" />
            )}

            {/* Caishen (wildcard) indicator */}
            {isCaishen && !faceDown && (
                <div className="absolute -top-1.5 -left-1.5 text-[10px] leading-none bg-yellow-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold shadow-sm border border-yellow-600">
                    财
                </div>
            )}
        </div>
    );
}
