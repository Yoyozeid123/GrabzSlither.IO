import { db } from "./db";
import { highscores, type InsertScore, type Highscore } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getHighscores(): Promise<Highscore[]>;
  createHighscore(score: InsertScore): Promise<Highscore>;
}

export class DatabaseStorage implements IStorage {
  async getHighscores(): Promise<Highscore[]> {
    return await db.select().from(highscores).orderBy(desc(highscores.score)).limit(100);
  }

  async createHighscore(score: InsertScore): Promise<Highscore> {
    const [highscore] = await db.insert(highscores).values(score).returning();
    return highscore;
  }
}

export const storage = new DatabaseStorage();