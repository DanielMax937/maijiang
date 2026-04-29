import { readFileSync } from "fs";
import { resolve } from "path";
import { NextResponse } from "next/server";
import { GameState, Tile } from "@/lib/mahjong/types";
import { MahjongAction, MahjongAIRequest, MahjongAIResponse } from "@/lib/mahjong/llmAI";

function loadEnvLocal(): void {
    try {
        const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
        for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIndex = trimmed.indexOf("=");
            if (eqIndex === -1) continue;
            process.env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
        }
    } catch {
        // Next.js also loads .env.local; this mirrors the pocker project when present.
    }
}

function tileName(tile: Tile): string {
    const suitMap: Record<string, string> = {
        bamboo: "条",
        character: "万",
        dot: "筒",
        wind: "风",
        dragon: "箭牌",
        flower: "花",
        season: "季",
    };
    return `${tile.id} (${suitMap[tile.suit] || tile.suit} ${tile.rank})`;
}

function playerSummary(gameState: GameState): string {
    return gameState.players.map((player) => {
        const hand = player.hand.map(tileName).join(", ");
        const discards = player.discards.map(tileName).join(" -> ") || "无";
        const melds = player.melds
            .map((meld) => `${meld.type}: ${meld.tiles.map(tileName).join(", ")}`)
            .join(" | ") || "无";
        return `Player ${player.id} ${player.name}
- 手牌: ${hand}
- 已打出: ${discards}
- 副露: ${melds}
- 分数: ${player.score}`;
    }).join("\n\n");
}

function discardTimeline(gameState: GameState): string {
    const fromLogs = gameState.logs
        .filter((log) => /discarded/i.test(log))
        .map((log, index) => `${index + 1}. ${log}`);

    if (fromLogs.length > 0) return fromLogs.join("\n");

    return gameState.players
        .flatMap((player) => player.discards.map((tile, index) => `${index + 1}. Player ${player.id}: ${tileName(tile)}`))
        .join("\n") || "无";
}

function buildPrompt(request: MahjongAIRequest): string {
    const { mode, gameState, playerIndex, availableActions } = request;
    const player = gameState.players[playerIndex];
    const legalActions = availableActions
        ? Object.entries(availableActions)
            .filter(([, enabled]) => enabled)
            .map(([action]) => action)
        : [];

    const legalTileIds = player.hand.map((tile) => tile.id).join(", ");
    const base = `
你是一个麻将 AI 助手。请根据当前完整局面做出判断，并只返回 JSON，不要返回 Markdown。

规则区域: ${gameState.rules.region}
当前阶段: ${gameState.phase}
当前轮到: Player ${gameState.currentTurn}
当前待处理弃牌: ${gameState.lastDiscard ? tileName(gameState.lastDiscard) : "无"}
剩余牌墙: ${gameState.wallCount}

玩家信息:
${playerSummary(gameState)}

所有弃牌顺序:
${discardTimeline(gameState)}
`;

    if (mode === "discard") {
        return `${base}
任务: 为 Player ${playerIndex} 选择现在应该打出的牌。
只能从这些 tile id 中选择: ${legalTileIds}

返回格式:
{
  "discardTileId": "必须是上面列出的 tile id",
  "analysis": "中文说明，包含牌型、危险牌、进张或防守理由",
  "confidence": 0.0到1.0之间的数字
}`;
    }

    if (mode === "action") {
        return `${base}
任务: 为 Player ${playerIndex} 在别人弃牌后选择反应。
只能从这些动作中选择: ${legalActions.join(", ") || "pass"}

返回格式:
{
  "action": "chi|peng|gang|hu|pass 之一，且必须合法",
  "analysis": "中文说明为什么这样选择",
  "confidence": 0.0到1.0之间的数字
}`;
    }

    return `${base}
任务: 你现在是 Player 0（人类玩家）的助手。分析 Player 0 当前牌型、大家已经打出的牌和顺序，并给出下一步建议。
如果当前可操作，合法动作是: ${legalActions.join(", ") || "无特殊动作，可考虑弃牌"}
如果建议弃牌，discardTileId 必须从这些 tile id 中选择: ${legalTileIds}

返回格式:
{
  "action": "chi|peng|gang|hu|pass 中的建议动作，可省略",
  "discardTileId": "建议弃牌 tile id，可省略",
  "analysis": "中文详细分析和建议",
  "confidence": 0.0到1.0之间的数字
}`;
}

function parseJson(content: string): unknown {
    const trimmed = content.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenced ? fenced[1].trim() : trimmed;
    return JSON.parse(jsonText);
}

function validateResponse(request: MahjongAIRequest, raw: unknown): MahjongAIResponse {
    const response = raw as MahjongAIResponse;
    if (!response || typeof response !== "object" || typeof response.analysis !== "string") {
        throw new Error("LLM response missing analysis");
    }

    const player = request.gameState.players[request.playerIndex];
    if ((request.mode === "discard" || response.discardTileId) &&
        !player.hand.some((tile) => tile.id === response.discardTileId)) {
        throw new Error("LLM selected a tile that is not in hand");
    }

    if (request.mode === "action" || response.action) {
        const allowed = new Set<MahjongAction>(
            Object.entries(request.availableActions || {})
                .filter(([, enabled]) => enabled)
                .map(([action]) => action as MahjongAction)
        );
        if (request.mode === "action") allowed.add("pass");
        if (response.action && !allowed.has(response.action)) {
            throw new Error("LLM selected an illegal action");
        }
    }

    return {
        action: response.action,
        discardTileId: response.discardTileId,
        analysis: response.analysis,
        confidence: typeof response.confidence === "number" ? response.confidence : undefined,
    };
}

export async function POST(request: Request) {
    loadEnvLocal();

    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL;
    const model = process.env.OPENAI_MODEL;

    if (!apiKey || !baseUrl || !model) {
        return NextResponse.json({ error: "Missing OPENAI_API_KEY, OPENAI_BASE_URL, or OPENAI_MODEL" }, { status: 500 });
    }

    try {
        const body = await request.json() as MahjongAIRequest;
        const prompt = buildPrompt(body);
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: "system",
                        content: "你是严谨的麻将策略 AI。你必须返回可解析 JSON，并且只能选择用户给出的合法动作或 tile id。",
                    },
                    { role: "user", content: prompt },
                ],
                temperature: 0.4,
                max_tokens: 1200,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LLM provider failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "{}";
        const parsed = parseJson(content);
        return NextResponse.json(validateResponse(body, parsed), { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Mahjong AI error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
