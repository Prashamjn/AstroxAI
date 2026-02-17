import { Router } from "express";
import { insertResponseFeedback, upsertAgentStats, updateInteractionV2Feedback } from "../lib/LearningDB.js";

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

    // Learning update: treat up as reward=1, down as reward=0
    const reward = fb === "up" ? 1 : 0;
    for (const a of agents) {
      await upsertAgentStats(a, reward);
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[feedback] error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;
