import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { games, gamePlayers, gameEvents, gameActions } from "./schema";
import { GameState, GameActionRecord, ReplayEvent } from "../mahjong/types";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

export interface SaveGameData {
    gameId: string;
    region: string;
    gameState: GameState;
    actionHistory: GameActionRecord[];
    replayEvents: ReplayEvent[];
}

export async function saveGame(data: SaveGameData) {
    const { gameId, region, gameState: finalState, actionHistory, replayEvents } = data;

    await db.transaction(async (tx) => {
        // 1. Insert game record
        await tx.insert(games).values({
            id: gameId,
            region,
            dealerIndex: finalState.dealerIndex ?? 0,
            dealerStreak: finalState.dealerStreak ?? 1,
            caishenTile: finalState.caishenTile ?? null,
            caishenSourceTile: finalState.caishenSourceTile ?? null,
            diceValues: finalState.diceValues ?? null,
            initialDeck: null, // TODO: capture initial deck before dealing
            outcome: finalState.winner !== null ? "win" : "draw",
            winnerIndex: finalState.winner,
            scoreResult: finalState.scoreResult ?? null,
            completedAt: new Date(),
        });

        // 2. Insert player records
        for (const player of finalState.players) {
            const meldStats = { chi: 0, peng: 0, gang: 0 };
            for (const meld of player.melds) {
                if (meld.type === "chi") meldStats.chi++;
                else if (meld.type === "peng") meldStats.peng++;
                else if (meld.type === "gang") meldStats.gang++;
            }

            await tx.insert(gamePlayers).values({
                gameId,
                playerIndex: player.id,
                initialHand: [], // TODO: capture at game start
                finalHand: player.hand,
                finalScore: player.score,
                wind: player.wind,
                isWinner: finalState.winner === player.id,
                meldCount: player.melds.length,
                chiCount: meldStats.chi,
                pengCount: meldStats.peng,
                gangCount: meldStats.gang,
            });
        }

        // 3. Insert events (batch)
        if (replayEvents.length > 0) {
            const eventRows = replayEvents.map((event, idx) => ({
                gameId,
                sequence: idx,
                type: event.type,
                message: event.message,
                playerIndex: event.playerIndex ?? null,
                tile: event.tile ?? null,
                action: typeof event.action === "string" ? event.action : (event.action as any)?.action ?? null,
                snapshot: event.snapshot,
                llmAdvice: event.llmAdvice ?? null,
            }));
            // Batch insert in chunks to avoid parameter limit
            const chunkSize = 100;
            for (let i = 0; i < eventRows.length; i += chunkSize) {
                await tx.insert(gameEvents).values(eventRows.slice(i, i + chunkSize));
            }
        }

        // 4. Insert actions (batch)
        if (actionHistory.length > 0) {
            const actionRows = actionHistory.map((act) => ({
                gameId,
                sequence: act.sequenceNumber,
                playerIndex: act.playerIndex,
                action: act.action,
                tile: act.tile ?? null,
                actionSource: act.actionSource ?? "unknown",
                llmAnalysis: act.llmAnalysis ?? null,
                isLlmFallback: act.isLlmFallback ?? false,
                snapshot: act.gameStateSnapshot,
                deferredAnalysis: act.deferredAnalysis ?? null,
            }));
            const chunkSize = 100;
            for (let i = 0; i < actionRows.length; i += chunkSize) {
                await tx.insert(gameActions).values(actionRows.slice(i, i + chunkSize));
            }
        }
    });
}

export { db };
