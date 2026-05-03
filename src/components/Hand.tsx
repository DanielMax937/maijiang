import React from "react";
import { Tile as TileType } from "@/lib/mahjong/types";
import { Tile } from "./Tile";
import { cn } from "@/lib/utils";

interface HandProps {
    tiles: TileType[];
    isCurrentPlayer: boolean;
    onTileClick?: (tileId: string) => void;
    faceDown?: boolean;
    tenpaiTileIds?: Set<string>;
    disabled?: boolean;
    className?: string;
    caishenTile?: TileType;
    selectedTileId?: string | null;
}

export function Hand({ tiles, isCurrentPlayer, onTileClick, faceDown, tenpaiTileIds, disabled = false, className, caishenTile, selectedTileId }: HandProps) {

    const isCaishen = (tile: TileType) => {
        if (!caishenTile) return false;
        return tile.suit === caishenTile.suit && tile.rank === caishenTile.rank;
    };

    return (
        <div className={cn("flex flex-row gap-1 justify-center", disabled && "opacity-50 pointer-events-none", className)}>
            {tiles.map((tile, index) => (
                <Tile
                    key={`${tile.id}-${index}`}
                    tile={tile}
                    faceDown={faceDown}
                    selected={selectedTileId === tile.id}
                    isTenpai={tenpaiTileIds?.has(tile.id)}
                    isCaishen={isCaishen(tile)}
                    onClick={() => {
                        if (isCurrentPlayer && onTileClick && !disabled) {
                            onTileClick(tile.id);
                        }
                    }}
                    className={isCurrentPlayer && !disabled ? "hover:z-10" : ""}
                />
            ))}
        </div>
    );
}
