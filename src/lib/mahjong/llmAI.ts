import { GameState } from "./types";

export type MahjongAIMode = "discard" | "action" | "advice" | "analyze";
export type MahjongAction = "chi" | "peng" | "gang" | "hu" | "pass";

export interface MahjongAIRequest {
    mode: MahjongAIMode;
    gameState: GameState;
    playerIndex: number;
    availableActions?: Partial<Record<MahjongAction, boolean>>;
    actualAction?: string; // For analyze mode: what was actually done
    actualTile?: string;   // For analyze mode: tile that was discarded
}

export interface MahjongAIResponse {
    action?: MahjongAction;
    discardTileId?: string;
    analysis: string;
    confidence?: number;
    fallback?: boolean;
    // For analyze mode
    recommended?: string;
    pros?: string[];
    cons?: string[];
    score?: number;
}

export async function requestMahjongAI(request: MahjongAIRequest): Promise<MahjongAIResponse> {
    const controller = new AbortController();
    // All LLM calls allow up to 60s — AI analysis may take longer with complex game states
    const timeoutMs = 60000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch("/api/mahjong-ai", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
            signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const message = payload?.error || `Mahjong AI request failed with ${response.status}`;
            throw new Error(message);
        }

        return payload as MahjongAIResponse;
    } finally {
        clearTimeout(timeout);
    }
}
