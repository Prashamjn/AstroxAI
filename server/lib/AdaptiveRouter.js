import { embedText } from "./Embeddings.js";
import {
  getAgentStats,
  getSimilarInteractionsByEmbedding,
} from "./LearningDB.js";
import { routableAgentIds } from "../agents.js";
import { computeUcbV2, normalizeScoresMinMax } from "./RouterV2.js";

function safeNum(x, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function clamp01(x) {
  const n = safeNum(x, 0);
  return Math.max(0, Math.min(1, n));
}

function aggregateSimilarityVotes(similarRows) {
  // similarRows: [{agentName, overallScore, similarity}]
  const votes = {};
  for (const r of similarRows) {
    const a = r.agentName;
    if (!routableAgentIds.includes(a)) continue;
    const sim = clamp01(r.similarity);
    const reward = clamp01(r.overallScore ?? 0.5);
    const w = sim * (0.25 + 0.75 * reward);
    votes[a] = (votes[a] || 0) + w;
  }
  return votes;
}

export async function selectAgentEmbeddingPlusBandit({
  userText,
  metaRouterFallback,
  similarityThreshold = Number(process.env.ROUTER_SIM_THRESHOLD || 0.78),
}) {
  const query = String(userText || "").trim();
  if (!query) return metaRouterFallback ? metaRouterFallback("") : "arcee";

  // 1) Try embedding similarity
  const qEmb = await embedText(query);
  let similarityVotes = {};
  if (Array.isArray(qEmb)) {
    const similar = getSimilarInteractionsByEmbedding(qEmb, 25);
    const strong = similar.filter((r) => clamp01(r.similarity) >= similarityThreshold);
    similarityVotes = aggregateSimilarityVotes(strong);

    const bestFromSim = Object.entries(similarityVotes).sort((a, b) => b[1] - a[1])[0];
    if (bestFromSim && bestFromSim[1] > 0) {
      return {
        agentId: bestFromSim[0],
        reason: "embedding_similarity",
        queryEmbedding: qEmb,
      };
    }
  }

  // 2) Bandit (UCB v2) over learned rewards
  const statsRows = getAgentStats();
  const usageCounts = {};
  for (const r of statsRows) usageCounts[String(r.agent_name)] = Math.max(0, Number(r.pulls) || 0);
  const noveltyScores = {};
  const raw = await computeUcbV2(statsRows, noveltyScores, usageCounts, { T: 0 });
  const norm = normalizeScoresMinMax(raw);
  const ranked = Object.entries(norm).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[0];
  if (top) return { agentId: top, reason: "bandit_ucb_v2", queryEmbedding: qEmb };

  // 3) Fallback to meta-router (LLM router)
  if (typeof metaRouterFallback === "function") {
    const agentId = await metaRouterFallback(query);
    return { agentId, reason: "meta_router_fallback", queryEmbedding: qEmb };
  }

  return { agentId: "arcee", reason: "default", queryEmbedding: qEmb };
}
