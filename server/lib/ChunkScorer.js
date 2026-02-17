import { embedText } from "./Embeddings.js";

/**
 * Compute coherence: embedding similarity between prompt and response
 */
export async function computeCoherence(prompt, response) {
  try {
    const qEmb = await embedText(prompt);
    const rEmb = await embedText(response);
    if (!Array.isArray(qEmb) || !Array.isArray(rEmb)) return 0.5;
    const dot = qEmb.reduce((s, x, i) => s + x * rEmb[i], 0);
    const normQ = Math.sqrt(qEmb.reduce((s, x) => s + x * x, 0));
    const normR = Math.sqrt(rEmb.reduce((s, x) => s + x * x, 0));
    return normQ && normR ? dot / (normQ * normR) : 0.5;
  } catch {
    return 0.5;
  }
}

/**
 * Compute novelty: embedding distance from other agents' outputs
 */
export async function computeNovelty(response, otherResponses = []) {
  try {
    const rEmb = await embedText(response);
    if (!Array.isArray(rEmb)) return 0;
    let minSim = 1;
    for (const other of otherResponses) {
      const oEmb = await embedText(other);
      if (!Array.isArray(oEmb)) continue;
      const dot = rEmb.reduce((s, x, i) => s + x * oEmb[i], 0);
      const normR = Math.sqrt(rEmb.reduce((s, x) => s + x * x, 0));
      const normO = Math.sqrt(oEmb.reduce((s, x) => s + x * x, 0));
      const sim = normR && normO ? dot / (normR * normO) : 0;
      minSim = Math.min(minSim, sim);
    }
    return 1 - minSim; // distance
  } catch {
    return 0;
  }
}

/**
 * Output diversity penalty: similarity between agents
 */
export async function diversityPenalty(responses) {
  const embs = await Promise.all(responses.map(r => embedText(r)));
  let totalSim = 0;
  let pairs = 0;
  for (let i = 0; i < embs.length; i++) {
    for (let j = i + 1; j < embs.length; j++) {
      const a = embs[i], b = embs[j];
      if (!Array.isArray(a) || !Array.isArray(b)) continue;
      const dot = a.reduce((s, x, k) => s + x * b[k], 0);
      const normA = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
      const normB = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
      const sim = normA && normB ? dot / (normA * normB) : 0;
      totalSim += sim;
      pairs++;
    }
  }
  return pairs > 0 ? totalSim / pairs : 0;
}
