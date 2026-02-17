/**
 * AstroxAI backend — Express server with OpenRouter proxy.
 * Features: per-agent system prompts, model fallback chain, streaming.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import chatRoutes from "./routes/chat.js";
import promptRoutes from "./routes/prompts.js";
import feedbackRoutes from "./routes/feedback.js";
import collabRoutes from "./routes/collab.js";
import statsRoutes from "./routes/stats.js";
import adminRoutes from "./routes/admin.js";
import { agents, agentMeta } from "./agents.js";
import * as PromptManager from "./lib/PromptManager.js";
import * as ModelRouter from "./lib/ModelRouter.js";
import { initLearningDB } from "./lib/LearningDB.js";
import { initChunkTrainingDB } from "./astroxai/db/ChunkTrainingDB.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    exposedHeaders: ["X-Selected-Agent", "X-Selected-Model", "X-Model-Status", "X-Response-Id"],
  })
);
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_, res) => {
  res.json({ ok: true, service: "astroxai-server" });
});

app.get("/api/agents", (_, res) => {
  const list = {};
  for (const id of Object.keys(agentMeta)) {
    list[id] = { model: agents[id] ?? null, ...agentMeta[id] };
  }
  res.json({ agents: list });
});

app.use("/api/chat", chatRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/collab", collabRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/admin", adminRoutes);

async function start() {
  await initLearningDB();
  await initChunkTrainingDB();
  await PromptManager.init();
  await ModelRouter.loadModelConfig();
  app.listen(PORT, () => {
    console.log(`AstroxAI server running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
