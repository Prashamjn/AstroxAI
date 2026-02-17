import initSqlJs from "sql.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_DIR = __dirname;
const DB_PATH = join(DB_DIR, "chunk_training.sqlite");

let SQL;
let db;
let saving = false;

function nowIso() {
  return new Date().toISOString();
}

function ensureSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS chunk_training_examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      response_id TEXT,
      query TEXT,
      chunk_text TEXT,
      agent_name TEXT,
      features_json TEXT NOT NULL,
      user_feedback INTEGER,
      final_quality_score REAL,
      final_chunk_selected INTEGER
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_chunk_train_time ON chunk_training_examples(timestamp);`);
}

async function loadDbFile() {
  await mkdir(DB_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) return null;
  const file = await readFile(DB_PATH);
  return new Uint8Array(file);
}

async function saveDbFile() {
  if (!db || saving) return;
  saving = true;
  try {
    const data = db.export();
    await writeFile(DB_PATH, Buffer.from(data));
  } finally {
    saving = false;
  }
}

export async function initChunkTrainingDB() {
  if (db) return db;
  if (!SQL) SQL = await initSqlJs({});
  const fileData = await loadDbFile();
  db = fileData ? new SQL.Database(fileData) : new SQL.Database();
  ensureSchema();
  await saveDbFile();
  return db;
}

function requireDb() {
  if (!db) throw new Error("ChunkTrainingDB not initialized. Call initChunkTrainingDB() at startup.");
  return db;
}

export async function insertChunkTrainingExample({
  responseId = null,
  query = "",
  chunkText = "",
  agentName = "",
  features = {},
  userFeedback = null,
  finalQualityScore = null,
  finalChunkSelected = 0,
  timestamp = nowIso(),
} = {}) {
  requireDb();
  const stmt = db.prepare(
    "INSERT INTO chunk_training_examples(timestamp, response_id, query, chunk_text, agent_name, features_json, user_feedback, final_quality_score, final_chunk_selected) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?);"
  );
  stmt.run([
    String(timestamp || nowIso()),
    responseId ? String(responseId) : null,
    String(query || ""),
    String(chunkText || ""),
    String(agentName || ""),
    JSON.stringify(features || {}),
    userFeedback == null ? null : Number(userFeedback),
    finalQualityScore == null ? null : Number(finalQualityScore),
    Number(finalChunkSelected) ? 1 : 0,
  ]);
  stmt.free();
  await saveDbFile();
}

export function getChunkTrainingCount() {
  requireDb();
  const stmt = db.prepare("SELECT COUNT(1) AS n FROM chunk_training_examples;");
  const row = stmt.step() ? stmt.getAsObject() : { n: 0 };
  stmt.free();
  return Number(row?.n) || 0;
}

export function getChunkTrainingDbPath() {
  return DB_PATH;
}
