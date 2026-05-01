import React from "react";
import { Tile as TileType } from "@/lib/mahjong/types";
import { cn } from "@/lib/utils";

interface CaishenDisplayProps {
    caishenTile: TileType;
    sourceTile?: TileType;
    className?: string;
}

function getTileSvg(tile: TileType): string {
    const { suit, rank } = tile;
    if (suit === "bamboo") return `/tiles/${rank}s.svg`;
    if (suit === "character") return `/tiles/${rank}m.svg`;
    if (suit === "dot") return `/tiles/${rank}p.svg`;
    if (suit === "wind") return `/tiles/${rank}.svg`;
    if (suit === "dragon") return `/tiles/${rank}.svg`;
    return "/tiles/back.svg";
}

export function CaishenDisplay({ caishenTile, sourceTile, className }: CaishenDisplayProps) {
    return (
        <div className={cn(
            "flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-yellow-600/50",
            className
        )}>
            <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-yellow-400 font-bold tracking-wider">财神</span>
                <div className="w-10 h-14 bg-white rounded-md shadow-lg border-2 border-yellow-400 relative overflow-hidden">
                    <img
                        src={getTileSvg(caishenTile)}
                        alt={`${caishenTile.suit} ${caishenTile.rank}`}
                        className="w-full h-full object-contain p-0.5"
                    />
                    {/* Golden shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-transparent pointer-events-none" />
                </div>
            </div>
            {sourceTile && (
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-stone-500">翻牌</span>
                    <div className="w-8 h-11 bg-white/80 rounded shadow border border-stone-400 relative overflow-hidden opacity-60">
                        <img
                            src={getTileSvg(sourceTile)}
                            alt={`${sourceTile.suit} ${sourceTile.rank}`}
                            className="w-full h-full object-contain p-0.5"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
