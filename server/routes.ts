import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.highscores.list.path, async (req, res) => {
    try {
      const scores = await storage.getHighscores();
      res.json(scores);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch highscores" });
    }
  });

  app.post(api.highscores.create.path, async (req, res) => {
    try {
      const input = api.highscores.create.input.parse(req.body);
      const score = await storage.createHighscore(input);
      res.status(201).json(score);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Failed to create highscore" });
    }
  });

  return httpServer;
}