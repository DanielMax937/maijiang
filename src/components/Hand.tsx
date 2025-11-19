import React from "react";
import { Tile as TileType } from "@/lib/mahjong/types";
import { Tile } from "./Tile";
import { cn } from "@/lib/utils";

interface HandProps {
    tiles: TileType[];
    isCurrentPlayer: boolean;
    onTileClick?: (tileId: string) => void;
    faceDown?: boolean;
    className?: string;
}

export function Hand({ tiles, isCurrentPlayer, onTileClick, faceDown, className }: HandProps) {
    const [selectedTileId, setSelectedTileId] = React.useState<string | null>(null);

    return (
        <div className={cn("flex flex-row gap-1 justify-center", className)}>
            {tiles.map((tile, index) => (
                <Tile
                    key={`${tile.id}-${index}`}
                    tile={tile}
                    faceDown={faceDown}
                    selected={selectedTileId === tile.id}
                    onClick={() => {
                        if (isCurrentPlayer && onTileClick) {
                            setSelectedTileId(tile.id);
                            onTileClick(tile.id);
                        }
                    }}
                    className={isCurrentPlayer ? "hover:z-10" : ""}
                />
            ))}
        </div>
    );
}
