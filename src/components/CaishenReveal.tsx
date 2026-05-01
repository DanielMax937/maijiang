import React, { useEffect, useState } from "react";
import { Tile as TileType } from "@/lib/mahjong/types";
import { cn } from "@/lib/utils";

interface CaishenRevealProps {
    sourceTile: TileType;
    caishenTile: TileType;
    onComplete: () => void;
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

export function CaishenReveal({ sourceTile, caishenTile, onComplete }: CaishenRevealProps) {
    const [phase, setPhase] = useState<"flip" | "reveal" | "show">("flip");

    useEffect(() => {
        const t1 = setTimeout(() => setPhase("reveal"), 1000);
        const t2 = setTimeout(() => setPhase("show"), 2000);
        const t3 = setTimeout(onComplete, 3500);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6">
                <h2 className="text-2xl font-bold text-amber-400 tracking-wider">
                    翻财神
                </h2>

                <div className="flex items-center gap-12">
                    {/* Flipped source tile */}
                    <div className="flex flex-col items-center gap-3">
                        <span className="text-sm text-stone-400">翻出的牌</span>
                        <div
                            className={cn(
                                "w-20 h-28 rounded-lg shadow-2xl transition-all duration-700 relative",
                                phase === "flip" && "rotate-y-180 bg-blue-700 border-2 border-blue-800",
                                phase !== "flip" && "bg-white border-2 border-amber-400"
                            )}
                            style={{
                                perspective: "1000px",
                                transformStyle: "preserve-3d",
                            }}
                        >
                            {phase === "flip" ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <img src="/tiles/back.svg" alt="back" className="w-full h-full object-contain p-2" />
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center animate-scale-in">
                                    <img
                                        src={getTileSvg(sourceTile)}
                                        alt={`${sourceTile.suit} ${sourceTile.rank}`}
                                        className="w-full h-full object-contain p-2"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Arrow */}
                    {phase !== "flip" && (
                        <div className="text-4xl text-amber-400 animate-pulse">→</div>
                    )}

                    {/* Caishen tile (the +1 tile) */}
                    {phase === "show" && (
                        <div className="flex flex-col items-center gap-3 animate-scale-in">
                            <span className="text-sm text-amber-300 font-bold">财神牌</span>
                            <div className="w-20 h-28 bg-white rounded-lg shadow-2xl border-2 border-yellow-400 relative ring-4 ring-yellow-400/50">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <img
                                        src={getTileSvg(caishenTile)}
                                        alt={`${caishenTile.suit} ${caishenTile.rank}`}
                                        className="w-full h-full object-contain p-2"
                                    />
                                </div>
                                {/* Glow effect */}
                                <div className="absolute -inset-2 rounded-xl bg-yellow-400/20 animate-pulse -z-10" />
                            </div>
                            <span className="text-xs text-yellow-300">百搭牌 × 4</span>
                        </div>
                    )}
                </div>

                {phase === "show" && (
                    <p className="text-stone-400 text-sm mt-4 animate-fade-in">
                        财神可代替任何牌组成顺子、刻子、对子
                    </p>
                )}
            </div>
        </div>
    );
}
