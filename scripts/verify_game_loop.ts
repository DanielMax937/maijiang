
import { initializeGame, stepGame, discardTile } from "../src/lib/mahjong/game";
import { GameState } from "../src/lib/mahjong/types";

// Mock console.log to capture output if needed, or just let it print
console.log("Starting Game Loop Verification...");

// 1. Initialize Game
let gameState = initializeGame("chinese");
console.log(`[INIT] Phase: ${gameState.phase}, Turn: ${gameState.currentTurn}`);

// 2. Simulate Player 3 (Left) Discarding
// We need to force the state to be Player 3's turn or just manually discard for them if it's their turn
// But initializeGame starts with Player 0 (East).
// Let's fast forward or just force a scenario.
// Actually, let's just play from the start (Player 0).

// Player 0 Draws (Auto in stepGame if phase is DRAW)
console.log("\n--- Step 1: Player 0 Draw ---");
gameState = stepGame(gameState);
console.log(`Phase: ${gameState.phase}, Logs: ${gameState.logs[gameState.logs.length - 1]}`);

// Player 0 Discards (Manual action required in DISCARD phase for human)
console.log("\n--- Step 2: Player 0 Discard ---");
if (gameState.phase === "DISCARD" && gameState.currentTurn === 0) {
    const tileToDiscard = gameState.players[0].hand[0];
    // We call discardTile directly as the UI would
    gameState = discardTile(gameState, tileToDiscard.id);
    console.log(`Discarded: ${tileToDiscard.suit} ${tileToDiscard.rank}`);
    console.log(`Phase: ${gameState.phase}, CheckIndex: ${gameState.checkIndex}`);
    console.log(`Logs: ${gameState.logs[gameState.logs.length - 1]}`);
}

// Check Player 1
console.log("\n--- Step 3: Check Player 1 ---");
gameState = stepGame(gameState);
console.log(`Phase: ${gameState.phase}, CheckIndex: ${gameState.checkIndex}`);
console.log(`Logs: ${gameState.logs[gameState.logs.length - 1]}`);

// Check Player 2
console.log("\n--- Step 4: Check Player 2 ---");
gameState = stepGame(gameState);
console.log(`Phase: ${gameState.phase}, CheckIndex: ${gameState.checkIndex}`);
console.log(`Logs: ${gameState.logs[gameState.logs.length - 1]}`);

// Check Player 3
console.log("\n--- Step 5: Check Player 3 ---");
gameState = stepGame(gameState);
console.log(`Phase: ${gameState.phase}, CheckIndex: ${gameState.checkIndex}`);
console.log(`Logs: ${gameState.logs[gameState.logs.length - 1]}`);

// Resolve (Back to Player 0? No, should be Player 1's turn if no actions)
console.log("\n--- Step 6: Resolve / Next Turn ---");
gameState = stepGame(gameState);
console.log(`Phase: ${gameState.phase}, Turn: ${gameState.currentTurn}`);
console.log(`Logs: ${gameState.logs[gameState.logs.length - 1]}`);

// Player 1 Draw
console.log("\n--- Step 7: Player 1 Draw ---");
gameState = stepGame(gameState);
console.log(`Phase: ${gameState.phase}, Logs: ${gameState.logs[gameState.logs.length - 1]}`);

// Player 1 Discard (Bot)
console.log("\n--- Step 8: Player 1 Discard (Bot) ---");
// Bot discard is handled in stepGame during DISCARD phase
gameState = stepGame(gameState);
console.log(`Phase: ${gameState.phase}, Logs: ${gameState.logs[gameState.logs.length - 1]}`);

console.log("\nVerification Complete.");
