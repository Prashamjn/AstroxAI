import { embedText } from "./Embeddings.js";
import {
  getAgentStats,
  getSimilarInteractionsByEmbedding,
} from "./LearningDB.js";
import { routableAgentIds } from "../agents.js";

// UCB (Upper Confidence Bound) exploration parameter
const UCB_C = Number(process.env.ROUTER_UCB_C || 0.35);

function safeNum(x, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function clamp01(x) {
  const n = safeNum(x, 0);
  return Math.max(0, Math.min(1, n));
}

export function computeUcbScores(statsRows) {
  // statsRows: [{agent_name, pulls, mean_reward}]
  const stats = {};
  for (const r of statsRows) {
    stats[r.agent_name] = {
      pulls: Math.max(0, safeNum(r.pulls, 0)),
      meanReward: clamp01(r.mean_reward),
    };
  }

  const totalPulls = Object.values(stats).reduce((a, s) => a + (s.pulls || 0), 0);

  const scores = {};
  for (const id of routableAgentIds) {
    const s = stats[id] || { pulls: 0, meanReward: 0.5 };
    const pulls = s.pulls;
    const mean = s.meanReward;
    const bonus = pulls > 0 ? UCB_C * Math.sqrt(Math.log(totalPulls + 1) / pulls) : 0.35;
    scores[id] = mean + bonus;
  }
  return scores;
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

  // 2) Bandit (UCB) over learned rewards
  const statsRows = getAgentStats();
  const ucb = computeUcbScores(statsRows);
  const ranked = Object.entries(ucb).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[0];
  if (top) {
    return { agentId: top, reason: "bandit_ucb", queryEmbedding: qEmb };
  }

  // 3) Fallback to meta-router (LLM router)
  if (typeof metaRouterFallback === "function") {
    const agentId = await metaRouterFallback(query);
    return { agentId, reason: "meta_router_fallback", queryEmbedding: qEmb };
  }

  return { agentId: "arcee", reason: "default", queryEmbedding: qEmb };
}
