import { pgTable, uuid, varchar, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

// 每局游戏元数据
export const games = pgTable("games", {
    id: uuid("id").primaryKey().defaultRandom(),
    region: varchar("region", { length: 20 }).notNull(),           // shengzhou / hangzhou / chinese
    dealerIndex: integer("dealer_index").notNull(),
    dealerStreak: integer("dealer_streak").notNull().default(1),
    caishenTile: jsonb("caishen_tile"),                             // {suit, rank} | null
    caishenSourceTile: jsonb("caishen_source_tile"),
    diceValues: jsonb("dice_values"),                               // [dice1, dice2]
    initialDeck: jsonb("initial_deck"),                             // 完整初始牌序（复现用）
    outcome: varchar("outcome", { length: 10 }).notNull(),          // "win" / "draw"
    winnerIndex: integer("winner_index"),                           // null = 平局
    scoreResult: jsonb("score_result"),                             // {base, fan, total, breakdown}
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
});

// 每位玩家的初始和最终状态
export const gamePlayers = pgTable("game_players", {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    playerIndex: integer("player_index").notNull(),                 // 0-3
    initialHand: jsonb("initial_hand").notNull(),                   // [{id, suit, rank}, ...]
    finalHand: jsonb("final_hand").notNull(),
    finalScore: integer("final_score").notNull(),
    wind: varchar("wind", { length: 10 }).notNull(),                // east/south/west/north
    isWinner: boolean("is_winner").notNull().default(false),
    meldCount: integer("meld_count").notNull().default(0),
    chiCount: integer("chi_count").notNull().default(0),
    pengCount: integer("peng_count").notNull().default(0),
    gangCount: integer("gang_count").notNull().default(0),
});

// 所有状态变化事件（完整回放数据）
export const gameEvents = pgTable("game_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    type: varchar("type", { length: 20 }).notNull(),                // init/draw/discard/check/action/win/llm
    message: text("message"),
    playerIndex: integer("player_index"),
    tile: jsonb("tile"),                                            // {suit, rank}
    action: varchar("action", { length: 20 }),
    snapshot: jsonb("snapshot").notNull(),                          // 完整游戏状态快照
    llmAdvice: jsonb("llm_advice"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 关键玩家决策（训练核心数据）
export const gameActions = pgTable("game_actions", {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    playerIndex: integer("player_index").notNull(),
    action: varchar("action", { length: 20 }).notNull(),            // discard/chi/peng/gang/hu/pass
    tile: jsonb("tile"),
    actionSource: varchar("action_source", { length: 20 }).notNull(), // "human" / "llm" / "rule_based"
    llmAnalysis: text("llm_analysis"),
    isLlmFallback: boolean("is_llm_fallback").notNull().default(false),
    snapshot: jsonb("snapshot").notNull(),                          // 决策时刻完整状态
    deferredAnalysis: jsonb("deferred_analysis"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
