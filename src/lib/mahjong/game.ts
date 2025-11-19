import { GameState, Player, Tile, Region, GameRules } from "./types";
import { generateDeck, shuffleDeck } from "./deck";
import { getStrategy } from "./rules";

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
    };
}

export function drawTile(gameState: GameState): GameState {
    if (gameState.deck.length === 0) {
        return { ...gameState, isGameOver: true }; // Draw game
    }

    const newDeck = [...gameState.deck];
    const tile = newDeck.pop();

    if (!tile) return gameState;

    const newPlayers = gameState.players.map((p, i) => {
        if (i === gameState.currentTurn) {
            return { ...p, hand: [...p.hand, tile] };
        }
        return p;
    });

    return {
        ...gameState,
        deck: newDeck,
        players: newPlayers,
        wallCount: newDeck.length,
    };
}

export function discardTile(gameState: GameState, tileId: string): GameState {
    const currentPlayerIndex = gameState.currentTurn;
    const currentPlayer = gameState.players[currentPlayerIndex];

    const tileIndex = currentPlayer.hand.findIndex((t) => t.id === tileId);
    if (tileIndex === -1) return gameState;

    const tile = currentPlayer.hand[tileIndex];
    const newHand = [...currentPlayer.hand];
    newHand.splice(tileIndex, 1);

    // Sort hand after discard (optional, but keeps it tidy)
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

    // Simple turn passing for now (no Pong/Kong checks yet)
    const nextTurn = (gameState.currentTurn + 1) % 4;

    return {
        ...gameState,
        players: newPlayers,
        lastDiscard: tile,
        currentTurn: nextTurn,
    };
}

export function checkWin(hand: Tile[], region: Region = "chinese"): boolean {
    const strategy = getStrategy(region);
    return strategy.checkWin(hand);
}
