import { Router } from "express";
import { getAgentStats, getCollabStats, getFeedbackStats } from "../lib/LearningDB.js";

const router = Router();

router.get("/", (req, res) => {
  try {
    const agentStats = getAgentStats();
    const collabStats = getCollabStats(2000);
    const feedbackStats = getFeedbackStats(5000);
    res.json({ ok: true, agentStats, collabStats, feedbackStats });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "internal_error" });
  }
});

export default router;
