import { GameContext, GameState, Tile } from "../types";

export function createGameContext(
    gameState: GameState,
    playerIndex: number,
    options?: { discard?: Tile; isSelfDraw?: boolean; isGangDraw?: boolean }
): GameContext {
    return {
        hand: gameState.players[playerIndex].hand,
        discard: options?.discard || gameState.lastDiscard || undefined,
        isSelfDraw: options?.isSelfDraw ?? false,
        melds: gameState.players[playerIndex].melds,
        allPlayers: gameState.players,
        rules: gameState.rules,
        phase: gameState.phase,
        currentTurn: gameState.currentTurn,
        playerIndex,
        caishenTile: gameState.caishenTile,
        isGangDraw: options?.isGangDraw ?? false,
    };
}
