import React from "react";
import { Region } from "@/lib/mahjong/types";
import { cn } from "@/lib/utils";

interface OnboardingProps {
    onSelectRegion: (region: Region) => void;
}

export function Onboarding({ onSelectRegion }: OnboardingProps) {
    const regions: { id: Region; name: string; desc: string; icon: string }[] = [
        {
            id: "shengzhou",
            name: "嵊州麻将",
            desc: "136张牌，财神（百搭）机制，推倒胡，可点炮，财鸟/飞鸟加番。",
            icon: "🎲",
        },
        {
            id: "hangzhou",
            name: "Hangzhou Mahjong",
            desc: "Standard 136 tiles. No flowers/seasons. Seven Pairs supported.",
            icon: "🏯",
        },
        {
            id: "chinese",
            name: "Chinese Classical",
            desc: "Standard rules with Flowers and Seasons.",
            icon: "🀄",
        },
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 text-white p-8">
            <h1 className="text-5xl font-bold mb-4 text-amber-500">Mahjong World</h1>
            <p className="text-xl text-stone-400 mb-12">Select your region to begin</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
                {regions.map((r) => (
                    <button
                        key={r.id}
                        onClick={() => onSelectRegion(r.id)}
                        className={cn(
                            "flex flex-col items-center p-8 rounded-xl border-2 border-stone-700 bg-stone-800 transition-all",
                            "hover:border-amber-500 hover:bg-stone-750 hover:-translate-y-1 hover:shadow-xl"
                        )}
                    >
                        <span className="text-6xl mb-4">{r.icon}</span>
                        <h2 className="text-2xl font-bold mb-2">{r.name}</h2>
                        <p className="text-stone-400 text-center">{r.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}
