import { Router } from "express";
import { getCollabRunDetails, getCollabStats, getRecentCollabRuns } from "../lib/LearningDB.js";

const router = Router();

// Debug endpoint: recent swarm/collab runs
router.get("/recent", (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));
  try {
    const rows = getRecentCollabRuns(limit);
    res.json({ ok: true, runs: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "internal_error" });
  }
});

router.get("/run/:id", (req, res) => {
  try {
    const details = getCollabRunDetails(req.params.id);
    if (!details) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, run: details });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "internal_error" });
  }
});

router.get("/stats", (req, res) => {
  const limit = Math.max(1, Math.min(5000, Number(req.query.limit || 500)));
  try {
    const stats = getCollabStats(limit);
    return res.json({ ok: true, stats });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "internal_error" });
  }
});

export default router;
