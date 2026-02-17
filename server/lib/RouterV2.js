import { getAgentStats } from "./LearningDB.js";
import { routableAgentIds } from "../agents.js";

// Hyperparameters
const ALPHA = Number(process.env.ROUTER_ALPHA || 0.35);
const BETA = Number(process.env.ROUTER_BETA || 0.15);
const DIVERSITY_BONUS_WEIGHT = Number(process.env.ROUTER_DIVERSITY_WEIGHT || 0.1);

/**
 * Compute UCB with novelty and diversity
 */
export function computeUcbV2(statsRows, noveltyScores, usageCounts) {
  const stats = {};
  for (const r of statsRows) {
    stats[r.agent_name] = {
      pulls: Math.max(0, Number(r.pulls) || 0),
      meanReward: Math.max(0, Math.min(1, Number(r.mean_reward) || 0)),
    };
  }
  const totalPulls = Object.values(stats).reduce((a, s) => a + s.pulls, 0);
  const scores = {};
  for (const id of routableAgentIds) {
    const s = stats[id] || { pulls: 0, meanReward: 0.5 };
    const pulls = s.pulls;
    const mean = s.meanReward;
    const exploration = pulls > 0 ? ALPHA * Math.sqrt(Math.log(totalPulls + 1) / pulls) : ALPHA;
    const novelty = (noveltyScores[id] || 0) * BETA;
    const diversityBonus = DIVERSITY_BONUS_WEIGHT * (1 - (usageCounts[id] || 0) / (totalPulls + 1));
    scores[id] = mean + exploration + novelty + diversityBonus;
  }
  return scores;
}

/**
 * Select top K agents via UCB + novelty
 */
export function selectTopKAgents(ucbScores, k = 3) {
  const ranked = Object.entries(ucbScores).sort((a, b) => b[1] - a[1]);
  return ranked.slice(0, k).map(([name]) => name);
}

/**
 * Forced exploration: pick lowest-used agent
 */
export function forceExploration(usageCounts) {
  const sorted = Object.entries(usageCounts).sort((a, b) => a[1] - b[1]);
  return sorted[0]?.[0] || null;
}
