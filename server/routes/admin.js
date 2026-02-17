import { Router } from "express";
import { loadBanditConfig, updateBanditConfig, reloadBanditConfig } from "../astroxai/config/BanditConfig.js";
import { getChunkTrainingCount, getChunkTrainingDbPath } from "../astroxai/db/ChunkTrainingDB.js";
import { loadChunkScorerWeights } from "../astroxai/models/ChunkScorerModel.js";
import { spawn } from "node:child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "node:url";
import { getAgentRewardLogByResponseId, getRecentAgentRewardLog } from "../lib/LearningDB.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WEIGHTS_PATH = join(__dirname, "..", "astroxai", "models", "chunk_scorer_weights.json");
const TRAIN_SCRIPT = join(__dirname, "..", "astroxai", "models", "chunk_scorer.py");

router.get("/bandit-config", async (_req, res) => {
  try {
    const cfg = await loadBanditConfig({ force: false });
    return res.json({ ok: true, config: cfg });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.get("/reward-log/recent", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(1000, Number(req.query?.limit) || 200));
    const rows = getRecentAgentRewardLog(limit);
    return res.json({ ok: true, rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.get("/reward-log/:responseId", async (req, res) => {
  try {
    const responseId = String(req.params?.responseId || "").trim();
    const rows = getAgentRewardLogByResponseId(responseId);
    return res.json({ ok: true, responseId, rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.post("/bandit-config", async (req, res) => {
  try {
    const next = req.body || {};
    const updated = await updateBanditConfig(next);
    await reloadBanditConfig();
    return res.json({ ok: true, config: updated });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e?.message || "bad_request") });
  }
});

router.get("/chunk-training/stats", async (_req, res) => {
  try {
    return res.json({
      ok: true,
      dbPath: getChunkTrainingDbPath(),
      examples: getChunkTrainingCount(),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.get("/chunk-scorer/status", async (_req, res) => {
  try {
    const weights = await loadChunkScorerWeights({ path: WEIGHTS_PATH, force: false });
    return res.json({
      ok: true,
      weightsPath: WEIGHTS_PATH,
      loaded: Boolean(weights),
      train_examples: weights?.train_examples ?? null,
      features: weights?.features ?? null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.post("/chunk-scorer/retrain", async (_req, res) => {
  try {
    const dbPath = getChunkTrainingDbPath();
    const args = [TRAIN_SCRIPT, dbPath, WEIGHTS_PATH];
    const child = spawn("python", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => (stderr += String(d)));

    child.on("close", async (code) => {
      if (code !== 0) {
        return res.status(500).json({ ok: false, error: "retrain_failed", code, stderr: stderr.slice(0, 2000) });
      }
      await loadChunkScorerWeights({ path: WEIGHTS_PATH, force: true });
      return res.json({ ok: true, code, stdout: stdout.slice(0, 2000) });
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || "internal_error") });
  }
});

export default router;
