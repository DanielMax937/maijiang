import React from "react";
import { Meld, Tile as TileType } from "@/lib/mahjong/types";
import { Tile } from "./Tile";
import { cn } from "@/lib/utils";

interface MeldDisplayProps {
    melds: Meld[];
    className?: string;
}

export function MeldDisplay({ melds, className }: MeldDisplayProps) {
    if (melds.length === 0) return null;

    return (
        <div className={cn("flex flex-row gap-2", className)}>
            {melds.map((meld, meldIndex) => (
                <div
                    key={meldIndex}
                    className="flex flex-row gap-0.5 bg-black/30 p-1 rounded"
                >
                    {meld.tiles.map((tile, tileIndex) => (
                        <div key={`${meld.type}-${meldIndex}-${tileIndex}`} className="w-8 h-10">
                            <Tile
                                tile={tile}
                                className="w-full h-full text-xs"
                            />
                        </div>
                    ))}
                    {/* Meld type indicator */}
                    <span className="text-[8px] text-white/60 self-end ml-0.5 font-bold uppercase">
                        {meld.type}
                    </span>
                </div>
            ))}
        </div>
    );
}
