import { NextResponse } from "next/server";
import { saveGame, SaveGameData } from "@/lib/db";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as SaveGameData;
        await saveGame(body);
        return NextResponse.json({ success: true, gameId: body.gameId });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to save game:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET() {
    try {
        const rows = await db
            .select({
                id: games.id,
                region: games.region,
                outcome: games.outcome,
                winnerIndex: games.winnerIndex,
                createdAt: games.createdAt,
                completedAt: games.completedAt,
            })
            .from(games)
            .orderBy(desc(games.createdAt))
            .limit(50);

        return NextResponse.json(rows);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
