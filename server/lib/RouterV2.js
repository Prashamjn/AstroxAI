import { routableAgentIds } from "../agents.js";
import { loadBanditConfig } from "../astroxai/config/BanditConfig.js";

// Hyperparameters
const ALPHA_DECAY = Number(process.env.ROUTER_ALPHA_DECAY || 0.999);
const EPS = 1e-9;

async function getUcbParams() {
  try {
    const cfg = await loadBanditConfig({ force: false });
    const u = cfg?.ucb || {};
    return {
      c: Number(u.c ?? 1.4),
      alpha: Number(u.alpha ?? 1.0),
      beta: Number(u.beta ?? 0.5),
      diversityBonus: Number(u.diversity_bonus ?? 0.2),
    };
  } catch {
    return { c: 1.4, alpha: 1.0, beta: 0.5, diversityBonus: 0.2 };
  }
}

export function getAlphaForT(T) {
  const t = Math.max(0, Number(T) || 0);
  // Kept for backward-compat (alpha0 now comes from bandit_config.yaml)
  return Math.pow(ALPHA_DECAY, t);
}

export function normalizeScoresMinMax(scores) {
  const entries = Object.entries(scores || {});
  if (entries.length === 0) return {};
  let min = Infinity;
  let max = -Infinity;
  for (const [, v] of entries) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  const denom = max - min;
  const out = {};
  for (const [k, v] of entries) {
    const n = Number(v);
    out[k] = Number.isFinite(n) ? (n - min) / (denom + EPS) : 0;
  }
  return out;
}

export function applyDiversityPenaltyToScores(scores, penaltyByAgent, weight = 0.2) {
  const out = {};
  for (const [agent, v] of Object.entries(scores || {})) {
    const p = penaltyByAgent && Object.prototype.hasOwnProperty.call(penaltyByAgent, agent) ? Number(penaltyByAgent[agent]) : 0;
    out[agent] = Number(v) - weight * (Number.isFinite(p) ? p : 0);
  }
  return out;
}

/**
 * Compute UCB with novelty and diversity
 */
export async function computeUcbV2(statsRows, noveltyScores, usageCounts, { T = 0 } = {}) {
  const { c, alpha, beta, diversityBonus } = await getUcbParams();
  const stats = {};
  for (const r of statsRows) {
    stats[r.agent_name] = {
      pulls: Math.max(0, Number(r.pulls) || 0),
      reward: Number(r.reward_ema ?? r.mean_reward ?? 0.5),
    };
  }
  const totalPulls = Object.values(stats).reduce((a, s) => a + s.pulls, 0);
  const scores = {};
  const alphaT = alpha * getAlphaForT(T);
  for (const id of routableAgentIds) {
    const s = stats[id] || { pulls: 0, meanReward: 0.5 };
    const pulls = s.pulls;
    const mean = Number(s.reward);
    const exploration = pulls > 0 ? c * alphaT * Math.sqrt(Math.log(totalPulls + 1) / pulls) : c * alphaT;
    const novelty = (noveltyScores[id] || 0) * beta;
    const div = diversityBonus * (1 - (usageCounts[id] || 0) / (totalPulls + 1));
    scores[id] = mean + exploration + novelty + div;
  }
  return scores; // raw UCB (not clamped)
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
