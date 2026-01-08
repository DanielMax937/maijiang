import { GameState, Player, Tile, Region, GameRules } from "./types";
import { generateDeck, shuffleDeck } from "./deck";
import { getStrategy } from "./rules";
import { chooseBotDiscard, decideBotAction } from "./botAI";

export function getRules(region: Region): GameRules {
    switch (region) {
        case "riichi":
            return { region, hasFlowers: false, hasSeasons: false, hasRedDora: true, handSize: 13 };
        case "sichuan":
            return { region, hasFlowers: false, hasSeasons: false, hasRedDora: false, handSize: 13 };
        case "chinese":
        default:
            return { region, hasFlowers: true, hasSeasons: true, hasRedDora: false, handSize: 13 };
    }
}

export function initializeGame(region: Region = "chinese"): GameState {
    const strategy = getStrategy(region);
    const rules = strategy.getRules();
    const deck = shuffleDeck(generateDeck(rules));
    const players: Player[] = [];

    // Initialize 4 players
    for (let i = 0; i < 4; i++) {
        players.push({
            id: i,
            name: i === 0 ? "You" : `Bot ${i}`,
            hand: [],
            discards: [],
            melds: [],
            isTurn: i === 0, // Player 0 starts
            score: 25000,
            wind: ["east", "south", "west", "north"][i] as any,
        });
    }

    // Deal tiles (based on handSize)
    // Usually handSize is 13, dealer gets 14th later
    for (let i = 0; i < rules.handSize; i++) {
        players.forEach((player) => {
            const tile = deck.pop();
            if (tile) player.hand.push(tile);
        });
    }

    // Sort hands
    players.forEach((player) => {
        player.hand.sort((a, b) => {
            if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
            if (typeof a.rank === "number" && typeof b.rank === "number") {
                return a.rank - b.rank;
            }
            return String(a.rank).localeCompare(String(b.rank));
        });
    });

    // Dealer (Player 0) draws extra tile
    const firstTile = deck.pop();
    if (firstTile) {
        players[0].hand.push(firstTile);
    }

    return {
        players,
        deck,
        currentTurn: 0,
        winner: null,
        lastDiscard: null,
        isGameOver: false,
        wallCount: deck.length,
        rules,
        actionTimer: 20,
        isWaitingForAction: false,
        pendingActions: {},
        actionDecisions: {},
        logs: ["Game initialized"],
        phase: "DRAW", // Start with Player 0 drawing (or discarding if 14 tiles? P0 starts with 14)
        checkIndex: 0,
    };
}

export function drawTile(gameState: GameState, fromDeadWall: boolean = false): GameState {
    if (gameState.deck.length === 0) {
        return { ...gameState, isGameOver: true }; // Draw game
    }

    const newDeck = [...gameState.deck];
    // For dead wall (kong replacement), draw from the beginning; otherwise from end
    const tile = fromDeadWall ? newDeck.shift() : newDeck.pop();

    if (!tile) return gameState;

    // Check if it's a flower or season tile
    const isFlowerOrSeason = tile.suit === "flower" || tile.suit === "season";

    if (isFlowerOrSeason && gameState.rules.hasFlowers) {
        // Move flower/season to melds as a special revealed tile
        const currentPlayer = gameState.players[gameState.currentTurn];
        const newMelds = [...currentPlayer.melds, {
            type: "gang" as const, // Use gang type to show it's revealed
            tiles: [tile],
        }];

        const newPlayers = gameState.players.map((p, i) => {
            if (i === gameState.currentTurn) {
                return { ...p, melds: newMelds };
            }
            return p;
        });

        const logMsg = `Player ${gameState.currentTurn} drew ${tile.suit} tile and draws replacement`;

        // Recursively draw replacement tile
        return drawTile({
            ...gameState,
            deck: newDeck,
            players: newPlayers,
            wallCount: newDeck.length,
            logs: [...gameState.logs, logMsg],
        }, true); // Draw from dead wall for replacement
    }

    const newPlayers = gameState.players.map((p, i) => {
        if (i === gameState.currentTurn) {
            return { ...p, hand: [...p.hand, tile] };
        }
        return p;
    });

    const logMsg = `Player ${gameState.currentTurn} drew ${tile.suit} ${tile.rank}`;

    return {
        ...gameState,
        deck: newDeck,
        players: newPlayers,
        wallCount: newDeck.length,
        logs: [...gameState.logs, logMsg],
        phase: "DISCARD", // After drawing, move to discard phase
    };
}

// Draw from dead wall (for Kong replacement)
export function drawFromDeadWall(gameState: GameState): GameState {
    return drawTile(gameState, true);
}

// Helper to check if any player has actions on the discarded tile
function checkActionsOnDiscard(gameState: GameState, discard: Tile, discarderIndex: number): { pendingActions: { [key: number]: any }, logs: string[] } {
    const strategy = getStrategy(gameState.rules.region);
    const pendingActions: { [key: number]: any } = {};
    const newLogs: string[] = [];
    let hasAction = false;

    gameState.players.forEach((player, index) => {
        if (index === discarderIndex) return; // Discarder can't act on own discard

        const hand = player.hand;
        const isNextPlayer = index === (discarderIndex + 1) % 4;

        // Log the check
        newLogs.push(`Player ${index} checking actions for ${discard.suit} ${discard.rank}...`);

        const canChi = isNextPlayer && strategy.canChi(hand, discard);
        const canPeng = strategy.canPeng(hand, discard);
        const canGang = strategy.canGang(hand, discard, false);
        const canHu = strategy.canHu(hand, discard, false);

        if (canChi) newLogs.push(`  - Player ${index} can Chi`);
        if (canPeng) newLogs.push(`  - Player ${index} can Peng`);
        if (canGang) newLogs.push(`  - Player ${index} can Gang`);
        if (canHu) newLogs.push(`  - Player ${index} can Hu`);

        if (canChi || canPeng || canGang || canHu) {
            pendingActions[index] = {
                chi: canChi,
                peng: canPeng,
                gang: canGang,
                hu: canHu
            };
            hasAction = true;
        }
    });

    return { pendingActions: hasAction ? pendingActions : {}, logs: newLogs };
}

export function discardTile(gameState: GameState, tileId: string): GameState {
    const currentPlayerIndex = gameState.currentTurn;
    const currentPlayer = gameState.players[currentPlayerIndex];

    const tileIndex = currentPlayer.hand.findIndex((t) => t.id === tileId);
    if (tileIndex === -1) return gameState;

    const tile = currentPlayer.hand[tileIndex];
    const newHand = [...currentPlayer.hand];
    newHand.splice(tileIndex, 1);

    // Sort hand after discard
    newHand.sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        if (typeof a.rank === "number" && typeof b.rank === "number") {
            return a.rank - b.rank;
        }
        return String(a.rank).localeCompare(String(b.rank));
    });

    const newPlayers = [...gameState.players];
    newPlayers[currentPlayerIndex] = {
        ...currentPlayer,
        hand: newHand,
        discards: [...currentPlayer.discards, tile],
    };

    // Check for actions from other players
    const tempState = {
        ...gameState,
        players: newPlayers,
        lastDiscard: tile,
        logs: [...gameState.logs, `Player ${currentPlayerIndex} discarded ${tile.suit} ${tile.rank}`],
        phase: "CHECK" as const,
        checkIndex: (currentPlayerIndex + 1) % 4, // Start checking from next player
        pendingActions: {}, // Clear previous pending actions
    };

    return tempState;
}

// New function to check a single player for actions
export function performCheck(gameState: GameState): GameState {
    if (gameState.phase !== "CHECK") return gameState;

    const { checkIndex, lastDiscard, currentTurn } = gameState;
    if (!lastDiscard) return gameState; // Should not happen in CHECK phase

    // If we looped back to the discarder, checking is done
    if (checkIndex === currentTurn) {
        const hasPending = Object.keys(gameState.pendingActions).length > 0;
        if (hasPending) {
            return {
                ...gameState,
                phase: "RESOLVE",
                isWaitingForAction: true,
                actionTimer: 20,
                logs: [...gameState.logs, "Checks complete. Waiting for actions..."],
            };
        } else {
            // No actions found, next turn
            return {
                ...gameState,
                phase: "DRAW",
                currentTurn: (currentTurn + 1) % 4,
                logs: [...gameState.logs, "No actions. Next turn."],
            };
        }
    }

    const player = gameState.players[checkIndex];
    const strategy = getStrategy(gameState.rules.region);
    const newLogs = [...gameState.logs];

    newLogs.push(`Player ${checkIndex} checking actions for ${lastDiscard.suit} ${lastDiscard.rank}...`);

    const isNextPlayer = checkIndex === (currentTurn + 1) % 4;
    const canChi = isNextPlayer && strategy.canChi(player.hand, lastDiscard);
    const canPeng = strategy.canPeng(player.hand, lastDiscard);
    const canGang = strategy.canGang(player.hand, lastDiscard, false);
    const canHu = strategy.canHu(player.hand, lastDiscard, false);

    if (canChi) newLogs.push(`  - Player ${checkIndex} can Chi`);
    if (canPeng) newLogs.push(`  - Player ${checkIndex} can Peng`);
    if (canGang) newLogs.push(`  - Player ${checkIndex} can Gang`);
    if (canHu) newLogs.push(`  - Player ${checkIndex} can Hu`);

    const newPendingActions = { ...gameState.pendingActions };
    if (canChi || canPeng || canGang || canHu) {
        newPendingActions[checkIndex] = {
            chi: canChi,
            peng: canPeng,
            gang: canGang,
            hu: canHu
        };
    }

    return {
        ...gameState,
        checkIndex: (checkIndex + 1) % 4,
        pendingActions: newPendingActions,
        logs: newLogs,
    };
}

// Central State Transition Function
export function stepGame(gameState: GameState): GameState {
    if (gameState.isGameOver) return gameState;

    switch (gameState.phase) {
        case "DRAW":
            return drawTile(gameState);

        case "DISCARD":
            // If it's a bot's turn, perform discard
            if (gameState.currentTurn !== 0) {
                const botHand = gameState.players[gameState.currentTurn].hand;
                if (botHand.length > 0) {
                    // Smart AI: Choose best tile to discard
                    const discardId = chooseBotDiscard(botHand);
                    return discardTile(gameState, discardId);
                }
            }
            // If human turn, we wait for UI interaction (handleTileClick calls discardTile)
            return gameState;

        case "CHECK":
            return performCheck(gameState);

        case "RESOLVE":
            // If bots need to decide, make them pass (for now)
            // This step might need to be called multiple times if we want to simulate "thinking"
            // But for "step" logic, we can just force pass undecided bots
            const pendingPlayers = Object.keys(gameState.pendingActions).map(Number);
            let newState = { ...gameState };
            let changed = false;

            pendingPlayers.forEach(pIdx => {
                if (pIdx !== 0 && !newState.actionDecisions[pIdx]) {
                    // Smart AI: Decide what action to take
                    const pending = newState.pendingActions[pIdx];
                    const action = decideBotAction(newState, pIdx, pending);
                    newState.actionDecisions = { ...newState.actionDecisions, [pIdx]: action };
                    changed = true;
                    if (action !== "pass") {
                        newState.logs = [...newState.logs, `Bot ${pIdx} chooses ${action.toUpperCase()}`];
                    } else {
                        newState.logs = [...newState.logs, `Bot ${pIdx} passes`];
                    }
                }
            });

            if (changed) {
                return resolvePendingActions(newState);
            }

            // If waiting for human, do nothing
            return resolvePendingActions(newState); // Will only resolve if all decided

        default:
            return gameState;
    }
}

// Execute the action (Peng, Gang, Chi)
function performAction(gameState: GameState, playerIndex: number, action: string): GameState {
    const player = gameState.players[playerIndex];
    const discard = gameState.lastDiscard!;
    let newHand = [...player.hand];
    let newMelds = [...player.melds];

    // Remove discard from discarder's pile (it's being claimed)
    // We need to find who discarded it. gameState.lastDiscard is just the tile.
    // But we know the previous turn was the discarder.
    // Actually, we updated `discards` in `discardTile`. We need to pop it back.
    // But `gameState.currentTurn` is still the discarder in the waiting state?
    // In `discardTile`, we returned `tempState` where `currentTurn` was NOT updated yet if waiting.
    // So `gameState.currentTurn` IS the discarder.
    const discarderIndex = gameState.currentTurn;
    const discarder = gameState.players[discarderIndex];
    const newDiscarderDiscards = [...discarder.discards];
    newDiscarderDiscards.pop(); // Remove the claimed tile

    const newPlayers = [...gameState.players];
    newPlayers[discarderIndex] = { ...discarder, discards: newDiscarderDiscards };

    if (action === "peng") {
        // Remove 2 matching tiles
        let removed = 0;
        newHand = newHand.filter(t => {
            if (removed < 2 && t.suit === discard.suit && t.rank === discard.rank) {
                removed++;
                return false;
            }
            return true;
        });
        newMelds.push({ type: "peng", tiles: [discard, discard, discard] }); // Simplified meld structure
    } else if (action === "gang") {
        // Remove 3 matching tiles
        let removed = 0;
        newHand = newHand.filter(t => {
            if (removed < 3 && t.suit === discard.suit && t.rank === discard.rank) {
                removed++;
                return false;
            }
            return true;
        });
        newMelds.push({ type: "gang", tiles: [discard, discard, discard, discard] });
    } else if (action === "chi") {
        // Chi: Take the discard and remove 2 tiles that form a sequence
        if (typeof discard.rank === "number") {
            const rank = discard.rank;
            const suit = discard.suit;

            // Try each possible sequence position
            const sequences: [number, number][] = [
                [rank - 2, rank - 1], // discard is 3rd
                [rank - 1, rank + 1], // discard is 2nd
                [rank + 1, rank + 2], // discard is 1st
            ];

            for (const [r1, r2] of sequences) {
                const idx1 = newHand.findIndex(t => t.suit === suit && t.rank === r1);
                if (idx1 === -1) continue;
                const idx2 = newHand.findIndex((t, i) => i !== idx1 && t.suit === suit && t.rank === r2);
                if (idx2 === -1) continue;

                // Found valid sequence - remove tiles
                const tile1 = newHand[idx1];
                const tile2 = newHand[idx2];
                newHand = newHand.filter((_, i) => i !== idx1 && i !== idx2);

                // Create meld with actual tiles in order
                const meldTiles = [tile1, discard, tile2].sort((a, b) => {
                    if (typeof a.rank === "number" && typeof b.rank === "number") {
                        return a.rank - b.rank;
                    }
                    return 0;
                });
                newMelds.push({ type: "chi", tiles: meldTiles });
                break;
            }
        }
    }

    newPlayers[playerIndex] = {
        ...player,
        hand: newHand,
        melds: newMelds
    };

    return {
        ...gameState,
        players: newPlayers,
        currentTurn: playerIndex, // Turn moves to actor
        isWaitingForAction: false,
        pendingActions: {},
        actionDecisions: {},
        actionTimer: 20,
        lastDiscard: null, // Discard claimed
        logs: [...gameState.logs, `Player ${playerIndex} performed ${action}`],
        phase: "DISCARD", // Actor must now discard
    };
}

export function resolvePendingActions(gameState: GameState): GameState {
    const { pendingActions, actionDecisions } = gameState;
    const pendingPlayers = Object.keys(pendingActions).map(Number);

    // Check if all have decided
    const allDecided = pendingPlayers.every(p => actionDecisions[p] !== undefined);
    if (!allDecided) return gameState; // Still waiting

    // Priority: Hu > Gang/Peng > Chi
    // Filter for those who took an action (not pass)
    const actors = pendingPlayers.filter(p => actionDecisions[p] !== "pass");

    if (actors.length === 0) {
        // All passed
        const nextTurn = (gameState.currentTurn + 1) % 4;
        return {
            ...gameState,
            currentTurn: nextTurn,
            isWaitingForAction: false,
            pendingActions: {},
            actionDecisions: {},
            actionTimer: 20,
            logs: [...gameState.logs, "All players passed"],
            phase: "DRAW", // Next player draws
        };
    }

    // Sort actors by priority
    actors.sort((a, b) => {
        const actionA = actionDecisions[a];
        const actionB = actionDecisions[b];

        const priority = { "hu": 3, "gang": 2, "peng": 2, "chi": 1 };
        const pA = priority[actionA as keyof typeof priority] || 0;
        const pB = priority[actionB as keyof typeof priority] || 0;

        if (pA !== pB) return pB - pA; // Higher priority first

        // If same priority (e.g. both Hu), standard rules: closest to discarder (turn order)
        // Discarder is currentTurn.
        // Distance = (Actor - Discarder + 4) % 4
        const distA = (a - gameState.currentTurn + 4) % 4;
        const distB = (b - gameState.currentTurn + 4) % 4;
        return distA - distB;
    });

    const winnerIndex = actors[0];
    const winningAction = actionDecisions[winnerIndex];

    if (winningAction === "hu") {
        return {
            ...gameState,
            winner: winnerIndex,
            isGameOver: true,
            isWaitingForAction: false,
            pendingActions: {},
            actionDecisions: {},
            logs: [...gameState.logs, `Player ${winnerIndex} wins with Hu!`],
        };
    }

    // Perform Action (Peng/Gang/Chi)
    return performAction(gameState, winnerIndex, winningAction);
}

export function checkWin(hand: Tile[], region: Region = "chinese"): boolean {
    const strategy = getStrategy(region);
    return strategy.checkWin(hand);
}

// Jia Gang (Add Kong): Promote an existing Peng to a Kong when drawing the 4th tile
export function canJiaGang(player: Player): Tile | null {
    // Check if any tile in hand matches an existing Peng meld
    for (const meld of player.melds) {
        if (meld.type === "peng" && meld.tiles.length > 0) {
            const pengTile = meld.tiles[0];
            const matchingTile = player.hand.find(
                t => t.suit === pengTile.suit && t.rank === pengTile.rank
            );
            if (matchingTile) {
                return matchingTile;
            }
        }
    }
    return null;
}

export function performJiaGang(gameState: GameState, playerIndex: number, tileId: string): GameState {
    const player = gameState.players[playerIndex];
    const tile = player.hand.find(t => t.id === tileId);

    if (!tile) return gameState;

    // Find the matching Peng meld
    const meldIndex = player.melds.findIndex(
        m => m.type === "peng" && m.tiles[0]?.suit === tile.suit && m.tiles[0]?.rank === tile.rank
    );

    if (meldIndex === -1) return gameState;

    // Remove tile from hand
    const newHand = player.hand.filter(t => t.id !== tileId);

    // Upgrade Peng to Gang
    const newMelds = [...player.melds];
    newMelds[meldIndex] = {
        type: "gang",
        tiles: [...newMelds[meldIndex].tiles, tile]
    };

    const newPlayers = [...gameState.players];
    newPlayers[playerIndex] = {
        ...player,
        hand: newHand,
        melds: newMelds
    };

    // After Jia Gang, player draws from dead wall and continues
    return drawTile({
        ...gameState,
        players: newPlayers,
        logs: [...gameState.logs, `Player ${playerIndex} performs Jia Gang (Add Kong)`],
    }, true);
}

