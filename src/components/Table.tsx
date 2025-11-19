"use client";

import React, { useEffect, useState } from "react";
import { GameState } from "@/lib/mahjong/types";
import { initializeGame, drawTile, discardTile, checkWin } from "@/lib/mahjong/game";
import { Hand } from "./Hand";
import { Tile } from "./Tile";
import { DiscardPile } from "./DiscardPile";
import { Region } from "@/lib/mahjong/types";

interface TableProps {
    region: Region;
}

export function Table({ region }: TableProps) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDevMode, setIsDevMode] = useState(false);

    useEffect(() => {
        const initialGame = initializeGame(region);
        setGameState(initialGame);
        setLoading(false);
    }, [region]);

    const handleTileClick = (tileId: string) => {
        if (!gameState) return;

        // Only allow player (index 0) to move
        if (gameState.currentTurn !== 0) return;

        // Discard logic
        const newState = discardTile(gameState, tileId);
        setGameState(newState);

        // Simulate bot turns (very basic for now)
        setTimeout(() => {
            handleBotTurns(newState);
        }, 1000);
    };

    const handleBotTurns = async (currentState: GameState) => {
        let tempState = { ...currentState };

        // Loop through bots: Player 1 -> Player 2 -> Player 3
        // Note: This is a simplified sequential execution. In a real game, we might want delays between each.
        for (let i = 1; i <= 3; i++) {
            // 1. Update turn to current bot
            tempState = { ...tempState, currentTurn: i };
            setGameState({ ...tempState });

            // Artificial delay for visual effect
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 2. Bot Draws
            tempState = drawTile(tempState);
            setGameState({ ...tempState });

            // Artificial delay
            await new Promise(resolve => setTimeout(resolve, 500));

            // 3. Bot Discards (Random tile for now)
            // Simple AI: Discard the first tile
            const botHand = tempState.players[i].hand;
            if (botHand.length > 0) {
                const tileToDiscard = botHand[0];
                tempState = discardTile(tempState, tileToDiscard.id);
                setGameState({ ...tempState });
            }
        }

        // Pass turn back to Player 0
        tempState = { ...tempState, currentTurn: 0 };

        // Player 0 Draws
        await new Promise(resolve => setTimeout(resolve, 1000));
        tempState = drawTile(tempState);
        setGameState(tempState);
    };

    const handleDraw = () => {
        if (!gameState) return;
        if (gameState.currentTurn !== 0) return;

        // Check if player already has 14 tiles (waiting for discard)
        if (gameState.players[0].hand.length % 3 === 2) {
            alert("You must discard a tile first!");
            return;
        }

        const newState = drawTile(gameState);
        setGameState(newState);
    };

    if (loading || !gameState) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    const player = gameState.players[0];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#1e5128] relative">
            {/* Dev Mode Toggle */}
            <div className="absolute top-4 right-4 z-50 bg-black/50 p-2 rounded text-white flex items-center gap-2">
                <label className="text-sm font-bold cursor-pointer flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={isDevMode}
                        onChange={(e) => setIsDevMode(e.target.checked)}
                        className="cursor-pointer"
                    />
                    Dev Mode
                </label>
            </div>

            {/* Top Player (Bot 2) */}
            <div className="flex flex-col items-center mb-8">
                <Hand tiles={gameState.players[2].hand} isCurrentPlayer={false} faceDown={!isDevMode} />
            </div>

            <div className="flex w-full justify-between flex-1 items-center px-12 relative">
                {/* Left Player (Bot 3) */}
                <div className="transform rotate-90 origin-center -ml-20">
                    <Hand tiles={gameState.players[3].hand} isCurrentPlayer={false} faceDown={!isDevMode} />
                </div>

                {/* Center Table Area */}
                <div className="relative flex items-center justify-center bg-green-700 rounded-xl shadow-inner w-[500px] h-[500px] mx-auto">
                    <div className="absolute top-4 text-white/50 text-sm">
                        Tiles Remaining: {gameState.wallCount}
                    </div>

                    {/* Center Info */}
                    <div className="absolute z-10 flex flex-col items-center justify-center bg-green-800/80 p-4 rounded-lg backdrop-blur-sm gap-2">
                        <div className="text-white font-bold">
                            Turn: {gameState.players[gameState.currentTurn].name}
                        </div>
                        <button
                            onClick={handleDraw}
                            disabled={gameState.currentTurn !== 0 || player.hand.length % 3 === 2}
                            className="px-4 py-1 bg-yellow-500 hover:bg-yellow-400 text-white text-sm font-bold rounded shadow disabled:opacity-50 disabled:cursor-not-allowed w-full"
                        >
                            Draw
                        </button>
                        <button
                            onClick={() => {
                                if (checkWin(player.hand, region)) {
                                    alert("Hu! You Win!");
                                    setGameState({ ...gameState, winner: 0, isGameOver: true });
                                } else {
                                    alert("Not a winning hand yet.");
                                }
                            }}
                            disabled={gameState.currentTurn !== 0 || player.hand.length % 3 !== 2}
                            className="px-4 py-1 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded shadow disabled:opacity-50 disabled:cursor-not-allowed w-full"
                        >
                            Hu
                        </button>
                    </div>

                    {/* Dev Mode Action Buttons */}
                    {isDevMode && (
                        <div className="absolute bottom-24 z-20 flex gap-2 bg-black/60 p-2 rounded backdrop-blur-sm">
                            <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500" onClick={() => alert("Chi (Simulated)")}>Chi</button>
                            <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500" onClick={() => alert("Peng (Simulated)")}>Peng</button>
                            <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500" onClick={() => alert("Gang (Simulated)")}>Gang</button>
                            <button className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500" onClick={() => alert("Hu (Simulated)")}>Hu</button>
                        </div>
                    )}

                    {/* Discard Piles */}
                    {/* Player 2 (Top) Discards */}
                    <div className="absolute top-16 transform rotate-180">
                        <DiscardPile tiles={gameState.players[2].discards} />
                    </div>

                    {/* Player 3 (Left) Discards */}
                    <div className="absolute left-16 transform rotate-90">
                        <DiscardPile tiles={gameState.players[3].discards} />
                    </div>

                    {/* Player 1 (Right) Discards */}
                    <div className="absolute right-16 transform -rotate-90">
                        <DiscardPile tiles={gameState.players[1].discards} />
                    </div>

                    {/* Player 0 (Bottom/You) Discards */}
                    <div className="absolute bottom-16">
                        <DiscardPile tiles={gameState.players[0].discards} />
                    </div>
                </div>

                {/* Right Player (Bot 1) */}
                <div className="transform -rotate-90 origin-center -mr-20">
                    <Hand tiles={gameState.players[1].hand} isCurrentPlayer={false} faceDown={!isDevMode} />
                </div>
            </div>

            {/* Bottom Player (You) */}
            <div className="mb-8">
                <Hand
                    tiles={player.hand}
                    isCurrentPlayer={gameState.currentTurn === 0}
                    onTileClick={handleTileClick}
                />
            </div>
        </div>
    );
}
