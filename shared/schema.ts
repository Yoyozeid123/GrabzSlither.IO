import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const highscores = pgTable("highscores", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScoreSchema = createInsertSchema(highscores).pick({
  playerName: true,
  score: true,
});

export type Highscore = typeof highscores.$inferSelect;
export type InsertScore = z.infer<typeof insertScoreSchema>;
