import { GameState } from "./types";

export type MahjongAIMode = "discard" | "action" | "advice";
export type MahjongAction = "chi" | "peng" | "gang" | "hu" | "pass";

export interface MahjongAIRequest {
    mode: MahjongAIMode;
    gameState: GameState;
    playerIndex: number;
    availableActions?: Partial<Record<MahjongAction, boolean>>;
}

export interface MahjongAIResponse {
    action?: MahjongAction;
    discardTileId?: string;
    analysis: string;
    confidence?: number;
    fallback?: boolean;
}

export async function requestMahjongAI(request: MahjongAIRequest): Promise<MahjongAIResponse> {
    const response = await fetch("/api/mahjong-ai", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = payload?.error || `Mahjong AI request failed with ${response.status}`;
        throw new Error(message);
    }

    return payload as MahjongAIResponse;
}
