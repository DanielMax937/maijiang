import { Tile, Suit, Rank, GameRules } from "./types";

export function generateDeck(rules?: GameRules): Tile[] {
    const deck: Tile[] = [];
    let idCounter = 0;

    const addTiles = (suit: Suit, ranks: Rank[], count: number = 4) => {
        ranks.forEach((rank) => {
            for (let i = 0; i < count; i++) {
                deck.push({
                    id: `${suit}-${rank}-${i}-${idCounter++}`,
                    suit,
                    rank,
                });
            }
        });
    };

    // Numbered suits (1-9)
    const numberRanks: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    addTiles("bamboo", numberRanks);
    addTiles("character", numberRanks);
    addTiles("dot", numberRanks);

    // Winds
    addTiles("wind", ["east", "south", "west", "north"]);

    // Dragons
    addTiles("dragon", ["red", "green", "white"]);

    // Flowers and Seasons
    if (rules?.hasFlowers) {
        addTiles("flower", [1, 2, 3, 4], 1);
    }
    if (rules?.hasSeasons) {
        addTiles("season", [1, 2, 3, 4], 1);
    }

    return deck;
}

export function shuffleDeck(deck: Tile[]): Tile[] {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}
