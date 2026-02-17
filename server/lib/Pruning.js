import { readFile, writeFile } from "fs/promises";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_DIR = join(__dirname, "..", "db");
const AGENT_WEIGHTS_PATH = join(DB_DIR, "agent_weights.json");
const USER_PROFILE_PATH = join(DB_DIR, "user_profile.json");

const MAX_SCORE_ROWS = Number(process.env.MAX_SCORE_ROWS) || 50000;
const PRUNE_BATCH = 5000;

export async function pruneOldScores(db) {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM agent_scores;").step()?.cnt || 0;
  if (count <= MAX_SCORE_ROWS) return;

  const toDelete = count - MAX_SCORE_ROWS + PRUNE_BATCH;
  console.warn(`[Pruning] Deleting ${toDelete} old agent_scores rows (current=${count})`);
  const stmt = db.prepare(
    "DELETE FROM agent_scores WHERE id IN (SELECT id FROM agent_scores ORDER BY timestamp ASC LIMIT ?);"
  );
  stmt.run([toDelete]);
  stmt.free();
}

export function loadAgentWeights() {
  if (!existsSync(AGENT_WEIGHTS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(AGENT_WEIGHTS_PATH, "utf-8"));
  } catch (e) {
    console.warn("[Pruning] Failed to load agent_weights.json:", e.message);
    return {};
  }
}

export async function saveAgentWeights(weights) {
  try {
    await writeFile(AGENT_WEIGHTS_PATH, JSON.stringify(weights, null, 2));
  } catch (e) {
    console.warn("[Pruning] Failed to save agent_weights.json:", e.message);
  }
}

export function loadUserProfile() {
  if (!existsSync(USER_PROFILE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(USER_PROFILE_PATH, "utf-8"));
  } catch (e) {
    console.warn("[Pruning] Failed to load user_profile.json:", e.message);
    return {};
  }
}

export async function saveUserProfile(profile) {
  try {
    await writeFile(USER_PROFILE_PATH, JSON.stringify(profile, null, 2));
  } catch (e) {
    console.warn("[Pruning] Failed to save user_profile.json:", e.message);
  }
}
