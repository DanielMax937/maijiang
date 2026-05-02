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
    if (tile.suit === "wind") {
        const windMap: Record<string, string> = { east: "东风", south: "南风", west: "西风", north: "北风" };
        return windMap[tile.rank as string] || `${tile.rank}风`;
    }
    if (tile.suit === "dragon") {
        const dragonMap: Record<string, string> = { red: "红中", green: "发财", white: "白板" };
        return dragonMap[tile.rank as string] || `${tile.rank}`;
    }
    const numMap: Record<number, string> = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九" };
    const suitMap: Record<string, string> = { bamboo: "条", character: "万", dot: "筒" };
    const suitName = suitMap[tile.suit] || tile.suit;
    const rankName = numMap[tile.rank as number] || tile.rank;
    return `${rankName}${suitName}`;
}

// Privacy-aware summary: only show target player's hand, public info for all
function playerSummaryForAI(gameState: GameState, targetPlayerIndex: number): string {
    return gameState.players.map((player) => {
        const isTarget = player.id === targetPlayerIndex;
        const hand = isTarget
            ? player.hand.map(tileName).join(", ")
            : `[${player.hand.length}张]`;
        // Only show last 10 discards to save tokens
        const recentDiscards = player.discards.slice(-10);
        const discards = recentDiscards.map(tileName).join(",") || "无";
        const discardPrefix = player.discards.length > 10 ? `...前${player.discards.length - 10}张省略, ` : "";
        const melds = player.melds
            .map((meld) => `${meld.type}(${meld.tiles.map(tileName).join(",")})`)
            .join(" | ") || "无";
        return `P${player.id} ${player.name}${isTarget ? " (你)" : ""}
- 手牌: ${hand}
- 弃牌: ${discardPrefix}${discards}
- 副露: ${melds}
- 分数: ${player.score}`;
    }).join("\n\n");
}

function getRuleDescription(region: string): string {
    switch (region) {
        case "shengzhou":
            return `嵊州麻将规则:
- 136张牌（无花牌、无季节牌）
- 财神（百搭）机制：翻一张牌，其下一张为财神，可代替任何牌组成顺子、刻子、对子

【胡牌规则 - 极其重要】
- 唯一胡牌牌型：4组面子（顺子或刻子）+ 1对将（雀头），财神可替代任何牌
- 不存在七小对（七对子）胡法
- 不存在碰碰胡（全刻子）特殊加番
- 不存在清一色、混一色等花色加番
- 不存在任何特殊牌型加番，只有基本胡牌型
- 决策时不要追求清一色或特殊牌型，只需尽快凑齐4面子+1对

【番数规则】
- 自摸 +2番，庄家 +1番
- 财鸟（手中1张财神）= 5番，飞鸟（手中连续2+张财神）= 10番起，每多一张翻倍
- 杠开/抢杠 = 5番
- 明杠 +1番，暗杠 +2番
- 连庄翻倍（连庄N次，主番 × 2^(N-1)）
- 底分 base = 8，总分 = base × 2^主番 × 连庄倍数 + base × 2^杠番
- 番数上限 13

【特殊规则】
- 承包：同一人吃碰达3次，该人需额外赔付
- 飞鸟圈：打出财神后进入飞鸟圈，圈内只能胡不能吃碰杠，圈结束时打财神者永久失去点炮资格
- 点炮限制：手中有财神时不能点炮胡`;
        case "hangzhou":
            return `杭州麻将规则:
- 136张牌（无花牌、无季节牌）
- 支持七对子胡牌
- 标准吃碰杠规则`;
        case "chinese":
        default:
            return `国标麻将规则:
- 144张牌（含花牌、季节牌）
- 标准吃碰杠胡规则
- 花牌和季节牌自动补牌`;
    }
}

function discardTimeline(gameState: GameState): string {
    // Compact timeline: only last 20 discards to save tokens
    const allDiscards: string[] = [];
    for (const player of gameState.players) {
        for (let i = 0; i < player.discards.length; i++) {
            allDiscards.push(`P${player.id}:${tileName(player.discards[i])}`);
        }
    }
    const recent = allDiscards.slice(-20);
    if (recent.length === 0) return "无";
    const prefix = allDiscards.length > 20 ? `(最近20张) ` : "";
    return prefix + recent.join(", ");
}

function buildPrompt(request: MahjongAIRequest): string {
    const { mode, gameState, playerIndex, availableActions } = request;
    const player = gameState.players[playerIndex];
    const legalActions = availableActions
        ? Object.entries(availableActions)
            .filter(([, enabled]) => enabled)
            .map(([action]) => action)
        : [];

    const legalTiles = player.hand.map((tile) => tileName(tile)).join(", ");
    const ruleDesc = getRuleDescription(gameState.rules.region);
    const base = `你是麻将AI，只返回JSON。

=== 规则 ===
${ruleDesc}

=== 局面 ===
阶段:${gameState.phase} 轮到:P${gameState.currentTurn} 弃牌:${gameState.lastDiscard ? tileName(gameState.lastDiscard) : "无"} 牌墙:${gameState.wallCount}张
${gameState.caishenTile ? `财神:${tileName(gameState.caishenTile)}` : ""}${gameState.caishenDiscardRound ? `\n⚠️ 飞鸟圈进行中 (P${gameState.caishenDiscardRound.discarderIndex}打出财神，圈内不能吃碰杠，只能胡)` : ""}

=== 玩家 ===
${playerSummaryForAI(gameState, playerIndex)}

=== 弃牌序列 ===
${discardTimeline(gameState)}
`;

    if (mode === "discard") {
        return `${base}
任务: 为P${playerIndex}选择打出的牌。
手牌: ${legalTiles}

返回格式:
{"discardTile":"必须是手牌中的一张(如一条,五万,九筒,东风,红中等)","analysis":"中文分析","confidence":0.0-1.0}`;
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

    if (mode === "analyze") {
        const actualAction = request.actualAction || "unknown";
        const actualTile = request.actualTile || "";
        const analyzeBase = `你是麻将AI，只返回JSON。

=== 规则 ===
${ruleDesc}

=== 局面 ===
阶段:${gameState.phase} 轮到:P${gameState.currentTurn} 弃牌:${gameState.lastDiscard ? tileName(gameState.lastDiscard) : "无"} 牌墙:${gameState.wallCount}张
${gameState.caishenTile ? `财神:${tileName(gameState.caishenTile)}` : ""}

=== 玩家(手牌不可见) ===
${playerSummaryForAI(gameState, -1)}

=== 弃牌序列 ===
${discardTimeline(gameState)}
`;
        return `${analyzeBase}
任务: 分析P${playerIndex}的操作: ${actualAction} ${actualTile}
基于公开信息(弃牌、副露、牌墙剩余)评价。

返回格式:
{"analysis":"分析","recommended":"推荐操作","pros":["优点"],"cons":["缺点"],"score":0-100}`;
    }

    return `${base}
任务: 你是P0(人类玩家)的助手。分析当前牌型和弃牌信息，给出建议。
合法动作: ${legalActions.join(", ") || "无特殊动作，可考虑弃牌"}
手牌: ${legalTiles}

返回格式:
{"action":"建议动作(可省略)","discardTile":"建议弃牌名(如一条,五万,可省略)","analysis":"中文分析","confidence":0.0-1.0}`;
}

function parseJson(content: string): unknown {
    const trimmed = content.trim();
    // Try to extract JSON from markdown fenced code blocks
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
        return JSON.parse(fenced[1].trim());
    }
    // Try to find a JSON object in the response (LLM may include extra text)
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(trimmed);
}

function validateResponse(request: MahjongAIRequest, raw: unknown): MahjongAIResponse {
    const response = raw as Record<string, unknown>;
    if (!response || typeof response !== "object") {
        throw new Error("LLM response is not a valid object");
    }
    // Coerce analysis to string - LLM may return it in unexpected format
    const analysis = typeof response.analysis === "string" ? response.analysis : 
        (response.analysis ? String(response.analysis) : "LLM 未提供分析");

    const player = request.gameState.players[request.playerIndex];
    
    // Match discard tile by name (e.g. "条1") instead of ID
    let discardTileId: string | undefined;
    const discardTile = (response.discardTile as string) || (response.discardTileId as string);
    if ((request.mode === "discard" || discardTile) && discardTile) {
        // Try to find tile in hand by name match
        const matchedTile = player.hand.find((tile) => {
            const name = tileName(tile);
            return name === discardTile || tile.id === discardTile;
        });
        if (!matchedTile) {
            throw new Error(`LLM selected tile "${discardTile}" which is not in hand`);
        }
        discardTileId = matchedTile.id;
    }

    // Only validate action for "action" mode, not "advice" mode
    const action = response.action as MahjongAction | undefined;
    if (request.mode === "action" && action) {
        const allowed = new Set<MahjongAction>(
            Object.entries(request.availableActions || {})
                .filter(([, enabled]) => enabled)
                .map(([a]) => a as MahjongAction)
        );
        allowed.add("pass");
        if (!allowed.has(action)) {
            throw new Error("LLM selected an illegal action");
        }
    }

    return {
        action,
        discardTileId,
        analysis,
        confidence: typeof response.confidence === "number" ? response.confidence : undefined,
        recommended: response.recommended as string | undefined,
        pros: response.pros as string[] | undefined,
        cons: response.cons as string[] | undefined,
        score: typeof response.score === "number" ? response.score : undefined,
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
        
        // Estimate token count (~2 chars per token for Chinese, ~4 for English)
        const estimatedTokens = Math.ceil(prompt.length / 2);
        console.log(`\n[mahjong-ai] ===== mode=${body.mode} player=${body.playerIndex} chars=${prompt.length} est_tokens=${estimatedTokens} =====`);
        console.log(prompt);
        console.log(`[mahjong-ai] ===== END PROMPT =====\n`);
        
        // Guard against exceeding model's 32K input limit
        if (estimatedTokens > 28000) {
            throw new Error(`Prompt too large (${estimatedTokens} estimated tokens). Try reducing game history.`);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 55000); // 55s server-side timeout (client has 60s)
        let response: Response;
        try {
            response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
                            content: `你是麻将策略AI。返回可解析JSON，只选择合法动作或tile id。基于当前规则分析，严禁猜测他人手牌。`,
                        },
                        { role: "user", content: prompt },
                    ],
                    temperature: 0.4,
                    max_tokens: 1200,
                }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[mahjong-ai] LLM error: ${response.status}`, errorText.slice(0, 500));
            throw new Error(`LLM provider failed: ${response.status} ${errorText.slice(0, 200)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "{}";
        const parsed = parseJson(content);
        return NextResponse.json(validateResponse(body, parsed), { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Mahjong AI error";
        console.error(`[mahjong-ai] Error:`, message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
