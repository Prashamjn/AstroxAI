import { getAgentStats } from "./LearningDB.js";
import { forceExploration } from "./RouterV2.js";

/**
 * Prompt mutation drift: slightly mutate agent system prompts every 100 chats
 */
export async function promptMutationDrift(chatCount) {
  if (chatCount % 100 !== 0) return;
  // Placeholder: load agent prompts, apply small mutations (e.g., add/modify style hints)
  // Could use a small LLM call to rephrase prompts while keeping core intent
  console.log("[Diversity] Prompt mutation drift triggered");
}

/**
 * Forced exploration: every N queries, force selection of lowest-used agent
 */
export function shouldForceExploration(queryCount, interval = 25) {
  return queryCount % interval === 0;
}

/**
 * Output diversity penalty: if agents produce near-identical embeddings, penalize
 */
export function applyDiversityPenalty(ucbScores, similarityPenalty, weight = 0.2) {
  const adjusted = {};
  for (const [agent, score] of Object.entries(ucbScores)) {
    adjusted[agent] = score - weight * similarityPenalty;
  }
  return adjusted;
}
