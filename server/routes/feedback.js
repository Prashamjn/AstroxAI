import { Router } from "express";
import {
  insertResponseFeedback,
  upsertAgentStats,
  updateInteractionV2Feedback,
  getInteractionV2ByResponseId,
  insertAgentRewardLog,
} from "../lib/LearningDB.js";
import { insertChunkTrainingExample } from "../astroxai/db/ChunkTrainingDB.js";

const router = Router();

/**
 * POST /api/feedback
 * Body: { response_id, user_id, feedback: "up" | "down", agent_name?: string, agent_names?: string[] }
 */
router.post("/", async (req, res) => {
  try {
    const { response_id, user_id, feedback, agent_name, agent_names } = req.body || {};
    const responseId = String(response_id || "").trim();
    const userId = user_id ? String(user_id) : null;
    const fb = String(feedback || "").trim().toLowerCase();

    if (!responseId) return res.status(400).json({ ok: false, error: "response_id required" });
    if (fb !== "up" && fb !== "down") {
      return res.status(400).json({ ok: false, error: "feedback must be 'up' or 'down'" });
    }

    const agents = Array.isArray(agent_names)
      ? agent_names.map((a) => String(a)).filter(Boolean)
      : agent_name
        ? [String(agent_name)]
        : [];

    await insertResponseFeedback({ responseId, userId, agentNames: agents, feedback: fb });

    // Link feedback to v2 interaction record (best-effort)
    try {
      await updateInteractionV2Feedback(responseId, fb);
    } catch {}

    // Learning update (swarm-safe): distribute reward by agent contribution to selected chunks
    const raw = fb === "up" ? 1 : 0;

    // Final quality score (0..1): currently derived from thumbs; can be extended with evaluator/coherence.
    const finalQualityScore = raw;

    let contributions = null;
    let selectedChunks = null;
    let chunkScores = null;
    let ucbScores = null;
    let queryText = "";
    try {
      const row = getInteractionV2ByResponseId(responseId);
      queryText = String(row?.query || "");
      ucbScores = row?.ucb_scores_json ? JSON.parse(row.ucb_scores_json) : null;
      chunkScores = row?.chunk_scores_json ? JSON.parse(row.chunk_scores_json) : null;
      const selectedJson = row?.selected_chunks_json;
      selectedChunks = selectedJson ? JSON.parse(selectedJson) : null;
      if (Array.isArray(selectedChunks) && selectedChunks.length > 0) {
        const counts = {};
        for (const ch of selectedChunks) {
          const a = String(ch.agent_name || "");
          if (!a) continue;
          counts[a] = (counts[a] || 0) + 1;
        }
        const total = Object.values(counts).reduce((s, n) => s + n, 0);
        if (total > 0) {
          contributions = {};
          for (const [a, n] of Object.entries(counts)) contributions[a] = n / total;
        }
      }
    } catch {}

    const targets = agents.length > 0 ? agents : Object.keys(contributions || {});
    const fallbackContribution = targets.length > 0 ? 1 / targets.length : 0;

    const ucbWeightFallback = 1;
    for (const a of targets) {
      const c = contributions?.[a] ?? fallbackContribution;
      const ucbW = ucbScores && Object.prototype.hasOwnProperty.call(ucbScores, a) ? Number(ucbScores[a]) : ucbWeightFallback;
      const ucbWeight = Number.isFinite(ucbW) ? ucbW : ucbWeightFallback;

      const agentCredit = finalQualityScore * c * ucbWeight;

      await upsertAgentStats(a, agentCredit);
      try {
        await insertAgentRewardLog({
          responseId,
          userId,
          agentName: a,
          rawFeedback: raw,
          contribution: c,
          reward: agentCredit,
        });
      } catch {}
    }

    // Chunk scorer training data (best-effort)
    try {
      if (Array.isArray(chunkScores) && chunkScores.length > 0) {
        const selectedSet = new Set(
          Array.isArray(selectedChunks)
            ? selectedChunks.map((c) => `${String(c.agent_name)}::${String(c.chunk_id)}`)
            : []
        );
        for (const ch of chunkScores) {
          const key = `${String(ch.agent_name)}::${String(ch.chunk_id)}`;
          const isSelected = selectedSet.has(key) ? 1 : 0;
          await insertChunkTrainingExample({
            responseId,
            query: queryText,
            chunkText: String(ch.text || ""),
            agentName: String(ch.agent_name || ""),
            features: ch.features || {},
            userFeedback: raw,
            finalQualityScore,
            finalChunkSelected: isSelected,
          });
        }
      }
    } catch {}

    return res.json({ ok: true });
  } catch (e) {
    console.error("[feedback] error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;
