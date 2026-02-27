import { storage } from "./storage";

async function seed() {
  const scores = await storage.getHighscores();
  if (scores.length === 0) {
    await storage.createHighscore({ playerName: "NeonViper", score: 4200 });
    await storage.createHighscore({ playerName: "GrabzTheGreat", score: 3850 });
    console.log("Seeded database with initial highscores");
  } else {
    console.log("Database already seeded");
  }
}

seed().catch(console.error);