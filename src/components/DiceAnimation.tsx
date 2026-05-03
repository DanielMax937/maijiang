import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DiceAnimationProps {
    diceValues: [number, number];
    onComplete: () => void;
}

const diceFaces: Record<number, string> = {
    1: "⚀",
    2: "⚁",
    3: "⚂",
    4: "⚃",
    5: "⚄",
    6: "⚅",
};

export function DiceAnimation({ diceValues, onComplete }: DiceAnimationProps) {
    const [rolling, setRolling] = useState(true);
    const [currentFaces, setCurrentFaces] = useState<[number, number]>([1, 1]);
    const [showResult, setShowResult] = useState(false);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    useEffect(() => {
        let frame = 0;
        const totalFrames = 12;
        const interval = setInterval(() => {
            frame++;
            setCurrentFaces([
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1,
            ]);
            if (frame >= totalFrames) {
                clearInterval(interval);
                setCurrentFaces(diceValues);
                setRolling(false);
                setShowResult(true);
                setTimeout(() => onCompleteRef.current(), 1000);
            }
        }, 60);

        return () => clearInterval(interval);
    }, [diceValues]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6">
                <h2 className="text-2xl font-bold text-amber-400 tracking-wider">
                    掷骰子定庄
                </h2>
                <div className="flex items-center gap-8">
                    {[0, 1].map((i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-24 h-24 bg-white rounded-2xl shadow-2xl flex items-center justify-center transition-transform",
                                rolling && "animate-bounce",
                                !rolling && "scale-110"
                            )}
                        >
                            <span className={cn(
                                "text-6xl select-none transition-all duration-200",
                                rolling ? "text-gray-400" : "text-red-600"
                            )}>
                                {diceFaces[currentFaces[i]]}
                            </span>
                        </div>
                    ))}
                </div>
                {showResult && (
                    <div className="flex flex-col items-center gap-2 animate-fade-in">
                        <div className="text-3xl font-bold text-white">
                            {diceValues[0]} + {diceValues[1]} + max({diceValues[0]},{diceValues[1]}) = {diceValues[0] + diceValues[1] + Math.max(diceValues[0], diceValues[1])}
                        </div>
                        <div className="text-lg text-amber-300">
                            {((diceValues[0] + diceValues[1] + Math.max(diceValues[0], diceValues[1])) % 4) === 0
                                ? "你是庄家！"
                                : `Bot ${(diceValues[0] + diceValues[1] + Math.max(diceValues[0], diceValues[1])) % 4} 是庄家`}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
