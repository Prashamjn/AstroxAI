import initSqlJs from "sql.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "node:url";
import { pruneOldScores } from "./Pruning.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_DIR = join(__dirname, "..", "db");
const DB_PATH = join(DB_DIR, "agent_scores.sqlite");

let SQL;
let db;
let saving = false;
let interactionCounter = 0;

function nowIso() {
  return new Date().toISOString();
}

function ensureSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      agent_name TEXT NOT NULL,
      query TEXT NOT NULL,
      response TEXT NOT NULL,
      relevance REAL,
      accuracy REAL,
      clarity REAL,
      user_pref REAL,
      overall_score REAL,
      query_embedding TEXT,
      response_embedding TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_agent_scores_time ON agent_scores(timestamp);
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agent_stats (
      agent_name TEXT PRIMARY KEY,
      pulls INTEGER NOT NULL DEFAULT 0,
      mean_reward REAL NOT NULL DEFAULT 0
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      chat_id TEXT,
      agent_name TEXT,
      rating INTEGER,
      timestamp TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS response_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_id TEXT NOT NULL,
      user_id TEXT,
      agent_names TEXT,
      feedback TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_response_feedback_resp ON response_feedback(response_id);
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS collab_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_id TEXT,
      user_id TEXT,
      query TEXT,
      agents_json TEXT,
      leader_agent TEXT,
      router_reason TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_collab_runs_time ON collab_runs(timestamp);
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS collab_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      answer TEXT,
      error TEXT,
      FOREIGN KEY(run_id) REFERENCES collab_runs(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS collab_critiques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      reviewer_id TEXT NOT NULL,
      critique TEXT,
      error TEXT,
      FOREIGN KEY(run_id) REFERENCES collab_runs(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS collab_final (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      synthesizer_id TEXT,
      final_answer TEXT,
      FOREIGN KEY(run_id) REFERENCES collab_runs(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS collab_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      voter_id TEXT NOT NULL,
      target_agent_id TEXT NOT NULL,
      accuracy_vote REAL,
      relevance_vote REAL,
      clarity_vote REAL,
      notes TEXT,
      FOREIGN KEY(run_id) REFERENCES collab_runs(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS collab_v2_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      ucb_scores_json TEXT,
      agent_inputs_json TEXT,
      chunk_scores_json TEXT,
      selected_chunks_json TEXT,
      composite_before_coherence TEXT,
      FOREIGN KEY(run_id) REFERENCES collab_runs(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS interaction_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_id TEXT NOT NULL UNIQUE,
      user_id TEXT,
      query TEXT,
      agent_responses_json TEXT,
      ucb_scores_json TEXT,
      coherence_scores_json TEXT,
      novelty_scores_json TEXT,
      chunk_scores_json TEXT,
      selected_chunks_json TEXT,
      final_answer TEXT,
      feedback TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_interaction_v2_time ON interaction_v2(timestamp);
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_interaction_v2_response ON interaction_v2(response_id);
  `);
}

async function loadDbFile() {
  await mkdir(DB_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    return null;
  }
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

export async function initLearningDB() {
  if (db) return db;
  if (!SQL) SQL = await initSqlJs({});
  const fileData = await loadDbFile();
  db = fileData ? new SQL.Database(fileData) : new SQL.Database();
  ensureSchema();
  await saveDbFile();
  return db;
}

function requireDb() {
  if (!db) throw new Error("LearningDB not initialized. Call initLearningDB() at startup.");
  return db;
}

export async function insertAgentScore(row) {
  requireDb();
  interactionCounter += 1;
  const {
    userId = null,
    agentName,
    query,
    response,
    relevance = null,
    accuracy = null,
    clarity = null,
    userPref = null,
    overallScore = null,
    queryEmbedding = null,
    responseEmbedding = null,
    timestamp = nowIso(),
  } = row;

  const stmt = db.prepare(
    `INSERT INTO agent_scores(
      user_id, agent_name, query, response,
      relevance, accuracy, clarity, user_pref, overall_score,
      query_embedding, response_embedding, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
  );
  stmt.run([
    userId,
    agentName,
    query,
    response,
    relevance,
    accuracy,
    clarity,
    userPref,
    overallScore,
    queryEmbedding ? JSON.stringify(queryEmbedding) : null,
    responseEmbedding ? JSON.stringify(responseEmbedding) : null,
    timestamp,
  ]);
  stmt.free();
  await saveDbFile();

  // Prune if too many rows
  await pruneOldScores(db);
}

export async function insertCollabRun({
  responseId = null,
  userId = null,
  query = "",
  agentsUsed = [],
  leaderAgent = null,
  routerReason = null,
  answers = [],
  critiques = [],
  votes = [],
  synthesizerId = null,
  finalAnswer = "",
  v2 = null,
}) {
  requireDb();

  const runStmt = db.prepare(
    "INSERT INTO collab_runs(response_id, user_id, query, agents_json, leader_agent, router_reason, timestamp) VALUES(?, ?, ?, ?, ?, ?, ?);"
  );
  runStmt.run([
    responseId ? String(responseId) : null,
    userId ? String(userId) : null,
    String(query || ""),
    Array.isArray(agentsUsed) ? JSON.stringify(agentsUsed.map(String)) : null,
    leaderAgent ? String(leaderAgent) : null,
    routerReason ? String(routerReason) : null,
    nowIso(),
  ]);
  runStmt.free();

  const idRow = db.exec("SELECT last_insert_rowid() AS id;")?.[0];
  const runId = idRow?.values?.[0]?.[0];

  if (runId) {
    if (Array.isArray(answers)) {
      for (const a of answers) {
        const stmt = db.prepare(
          "INSERT INTO collab_answers(run_id, agent_id, answer, error) VALUES(?, ?, ?, ?);"
        );
        stmt.run([
          runId,
          String(a.agentId || a.agent_id || ""),
          a.answer != null ? String(a.answer) : null,
          a.error != null ? String(a.error) : null,
        ]);
        stmt.free();
      }
    }

    if (Array.isArray(critiques)) {
      for (const c of critiques) {
        const stmt = db.prepare(
          "INSERT INTO collab_critiques(run_id, reviewer_id, critique, error) VALUES(?, ?, ?, ?);"
        );
        stmt.run([
          runId,
          String(c.reviewerId || c.reviewer_id || ""),
          c.critique != null ? String(c.critique) : null,
          c.error != null ? String(c.error) : null,
        ]);
        stmt.free();
      }
    }

    const finStmt = db.prepare(
      "INSERT INTO collab_final(run_id, synthesizer_id, final_answer) VALUES(?, ?, ?);"
    );
    finStmt.run([
      runId,
      synthesizerId ? String(synthesizerId) : null,
      finalAnswer != null ? String(finalAnswer) : null,
    ]);
    finStmt.free();

    if (Array.isArray(votes)) {
      for (const v of votes) {
        const stmt = db.prepare(
          "INSERT INTO collab_votes(run_id, voter_id, target_agent_id, accuracy_vote, relevance_vote, clarity_vote, notes) VALUES(?, ?, ?, ?, ?, ?, ?);"
        );
        stmt.run([
          runId,
          String(v.voterId || v.voter_id || ""),
          String(v.targetAgentId || v.target_agent_id || ""),
          v.accuracyVote ?? v.accuracy_vote ?? null,
          v.relevanceVote ?? v.relevance_vote ?? null,
          v.clarityVote ?? v.clarity_vote ?? null,
          v.notes != null ? String(v.notes) : null,
        ]);
        stmt.free();
      }
    }

    if (v2 && typeof v2 === "object") {
      const ucbJson = v2.ucbScores ? JSON.stringify(v2.ucbScores) : null;
      const agentInputsJson = v2.agentInputs ? JSON.stringify(v2.agentInputs) : null;
      const chunkScoresJson = v2.synth?.chunkScores ? JSON.stringify(v2.synth.chunkScores) : null;
      const selectedChunksJson = v2.synth?.selectedChunks ? JSON.stringify(v2.synth.selectedChunks) : null;
      const compositeBefore =
        v2.synth?.compositeBeforeCoherence != null ? String(v2.synth.compositeBeforeCoherence) : null;

      const mStmt = db.prepare(
        "INSERT INTO collab_v2_metrics(run_id, ucb_scores_json, agent_inputs_json, chunk_scores_json, selected_chunks_json, composite_before_coherence) VALUES(?, ?, ?, ?, ?, ?);"
      );
      mStmt.run([
        runId,
        ucbJson,
        agentInputsJson,
        chunkScoresJson,
        selectedChunksJson,
        compositeBefore,
      ]);
      mStmt.free();
    }
  }

  await saveDbFile();
  return runId || null;
}

export function getRecentCollabRuns(limit = 25) {
  requireDb();
  const stmt = db.prepare(
    "SELECT id, response_id, user_id, query, agents_json, leader_agent, router_reason, timestamp FROM collab_runs ORDER BY id DESC LIMIT ?;"
  );
  stmt.bind([limit]);
  const rows = [];
  while (stmt.step()) {
    const o = stmt.getAsObject();
    rows.push({
      id: o.id,
      responseId: o.response_id,
      userId: o.user_id,
      query: o.query,
      agents: o.agents_json ? JSON.parse(o.agents_json) : null,
      leaderAgent: o.leader_agent,
      routerReason: o.router_reason,
      timestamp: o.timestamp,
    });
  }
  stmt.free();
  return rows;
}

export function getCollabRunDetails(runId) {
  requireDb();
  const rid = Number(runId);
  if (!Number.isFinite(rid)) return null;

  const runStmt = db.prepare(
    "SELECT id, response_id, user_id, query, agents_json, leader_agent, router_reason, timestamp FROM collab_runs WHERE id = ?;"
  );
  runStmt.bind([rid]);
  const run = runStmt.step() ? runStmt.getAsObject() : null;
  runStmt.free();
  if (!run) return null;

  const answers = [];
  const aStmt = db.prepare("SELECT agent_id, answer, error FROM collab_answers WHERE run_id = ?;");
  aStmt.bind([rid]);
  while (aStmt.step()) answers.push(aStmt.getAsObject());
  aStmt.free();

  const critiques = [];
  const cStmt = db.prepare("SELECT reviewer_id, critique, error FROM collab_critiques WHERE run_id = ?;");
  cStmt.bind([rid]);
  while (cStmt.step()) critiques.push(cStmt.getAsObject());
  cStmt.free();

  const fStmt = db.prepare(
    "SELECT synthesizer_id, final_answer FROM collab_final WHERE run_id = ? ORDER BY id DESC LIMIT 1;"
  );
  fStmt.bind([rid]);
  const finalRow = fStmt.step() ? fStmt.getAsObject() : null;
  fStmt.free();

  const votes = [];
  const vStmt = db.prepare(
    "SELECT voter_id, target_agent_id, accuracy_vote, relevance_vote, clarity_vote, notes FROM collab_votes WHERE run_id = ?;"
  );
  vStmt.bind([rid]);
  while (vStmt.step()) votes.push(vStmt.getAsObject());
  vStmt.free();

  return {
    id: run.id,
    responseId: run.response_id,
    userId: run.user_id,
    query: run.query,
    agents: run.agents_json ? JSON.parse(run.agents_json) : null,
    leaderAgent: run.leader_agent,
    routerReason: run.router_reason,
    timestamp: run.timestamp,
    answers,
    critiques,
    final: finalRow,
    votes,
  };
}

export function getCollabStats(limit = 500) {
  requireDb();
  const stmt = db.prepare(
    "SELECT id, router_reason, timestamp FROM collab_runs ORDER BY id DESC LIMIT ?;"
  );
  stmt.bind([limit]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  const byReason = {};
  let total = 0;
  for (const r of rows) {
    total += 1;
    const reason = r.router_reason || "unknown";
    byReason[reason] = (byReason[reason] || 0) + 1;
  }
  return { total, byReason };
}

export function getFeedbackStats(limit = 5000) {
  requireDb();
  const stmt = db.prepare(
    "SELECT feedback, agent_names, timestamp FROM response_feedback ORDER BY id DESC LIMIT ?;"
  );
  stmt.bind([limit]);
  let up = 0;
  let down = 0;
  const byAgent = {};
  while (stmt.step()) {
    const o = stmt.getAsObject();
    const fb = String(o.feedback || "").toLowerCase();
    if (fb === "up") up += 1;
    if (fb === "down") down += 1;

    let agents = [];
    try {
      agents = o.agent_names ? JSON.parse(o.agent_names) : [];
    } catch {
      agents = [];
    }
    if (!Array.isArray(agents)) agents = [];
    for (const a of agents) {
      const id = String(a);
      if (!id) continue;
      if (!byAgent[id]) byAgent[id] = { up: 0, down: 0 };
      if (fb === "up") byAgent[id].up += 1;
      if (fb === "down") byAgent[id].down += 1;
    }
  }
  stmt.free();
  return { up, down, byAgent };
}

export async function upsertAgentStats(agentName, reward) {
  requireDb();
  const r = Math.max(0, Math.min(1, Number(reward)));

  const sel = db.prepare("SELECT pulls, mean_reward FROM agent_stats WHERE agent_name = ?;");
  sel.bind([agentName]);
  const existing = sel.step() ? sel.getAsObject() : null;
  sel.free();

  if (!existing) {
    const ins = db.prepare("INSERT INTO agent_stats(agent_name, pulls, mean_reward) VALUES(?, 1, ?);");
    ins.run([agentName, r]);
    ins.free();
  } else {
    const pulls = Number(existing.pulls) || 0;
    const mean = Number(existing.mean_reward) || 0;
    const nextPulls = pulls + 1;
    const nextMean = mean + (r - mean) / nextPulls;
    const upd = db.prepare("UPDATE agent_stats SET pulls = ?, mean_reward = ? WHERE agent_name = ?;");
    upd.run([nextPulls, nextMean, agentName]);
    upd.free();
  }

  await saveDbFile();
}

export async function insertInteractionV2({
  responseId,
  userId = null,
  query = "",
  agentResponses = [],
  ucbScores = null,
  coherenceScores = null,
  noveltyScores = null,
  chunkScores = null,
  selectedChunks = null,
  finalAnswer = "",
  feedback = null,
  timestamp = nowIso(),
}) {
  requireDb();
  const rid = String(responseId || "").trim();
  if (!rid) throw new Error("responseId required");

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO interaction_v2(
      response_id, user_id, query,
      agent_responses_json,
      ucb_scores_json,
      coherence_scores_json,
      novelty_scores_json,
      chunk_scores_json,
      selected_chunks_json,
      final_answer,
      feedback,
      timestamp
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
  );
  stmt.run([
    rid,
    userId ? String(userId) : null,
    String(query || ""),
    Array.isArray(agentResponses) ? JSON.stringify(agentResponses) : null,
    ucbScores ? JSON.stringify(ucbScores) : null,
    coherenceScores ? JSON.stringify(coherenceScores) : null,
    noveltyScores ? JSON.stringify(noveltyScores) : null,
    chunkScores ? JSON.stringify(chunkScores) : null,
    selectedChunks ? JSON.stringify(selectedChunks) : null,
    finalAnswer != null ? String(finalAnswer) : null,
    feedback ? String(feedback) : null,
    String(timestamp || nowIso()),
  ]);
  stmt.free();
  await saveDbFile();
}

export async function updateInteractionV2Feedback(responseId, feedback) {
  requireDb();
  const rid = String(responseId || "").trim();
  const fb = feedback != null ? String(feedback).trim().toLowerCase() : null;
  if (!rid) throw new Error("responseId required");
  if (fb !== "up" && fb !== "down") throw new Error("feedback must be 'up' or 'down'");

  const stmt = db.prepare("UPDATE interaction_v2 SET feedback = ? WHERE response_id = ?;");
  stmt.run([fb, rid]);
  stmt.free();
  await saveDbFile();
}

export async function insertResponseFeedback({ responseId, userId = null, agentNames = [], feedback }) {
  requireDb();
  const rid = String(responseId || "").trim();
  const fb = String(feedback || "").trim().toLowerCase();
  if (!rid) throw new Error("responseId required");
  if (fb !== "up" && fb !== "down") throw new Error("feedback must be 'up' or 'down'");

  const stmt = db.prepare(
    "INSERT INTO response_feedback(response_id, user_id, agent_names, feedback, timestamp) VALUES(?, ?, ?, ?, ?);"
  );
  stmt.run([
    rid,
    userId ? String(userId) : null,
    Array.isArray(agentNames) ? JSON.stringify(agentNames.map(String)) : null,
    fb,
    nowIso(),
  ]);
  stmt.free();
  await saveDbFile();
}

export function getAgentStats() {
  requireDb();
  const res = [];
  const stmt = db.prepare("SELECT agent_name, pulls, mean_reward FROM agent_stats;");
  while (stmt.step()) res.push(stmt.getAsObject());
  stmt.free();
  return res;
}

export function getRecentInteractions(limit = 2000) {
  requireDb();
  const stmt = db.prepare(
    "SELECT agent_name, query, overall_score, query_embedding FROM agent_scores ORDER BY id DESC LIMIT ?;"
  );
  stmt.bind([limit]);
  const rows = [];
  while (stmt.step()) {
    const o = stmt.getAsObject();
    rows.push({
      agentName: o.agent_name,
      query: o.query,
      overallScore: o.overall_score,
      queryEmbedding: o.query_embedding ? JSON.parse(o.query_embedding) : null,
    });
  }
  stmt.free();
  return rows;
}

export function getSimilarInteractionsByEmbedding(queryEmbedding, topK = 20) {
  // This is a convenience helper for small datasets. We do cosine similarity in JS.
  const rows = getRecentInteractions(5000).filter((r) => Array.isArray(r.queryEmbedding));
  const scored = rows
    .map((r) => ({ ...r, similarity: cosineSimilarity(queryEmbedding, r.queryEmbedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  return scored;
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

export function getInteractionCount() {
  return interactionCounter;
}
