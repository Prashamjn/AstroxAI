import { embedText } from "./Embeddings.js";

/**
 * Split text into semantic chunks (paragraphs/sentences)
 */
function splitIntoChunks(text) {
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  const chunks = [];
  for (const p of paragraphs) {
    const sentences = p.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1) {
      chunks.push(...sentences);
    } else {
      chunks.push(p);
    }
  }
  return chunks.map((c, i) => ({ id: i, text: c.trim() }));
}

/**
 * Compute chunk-level weighted score
 */
function computeChunkScore(agent, noveltyBonus = 0) {
  const { ucb_score, factual_score, coherence_score, novelty_score } = agent;
  const base = ucb_score * factual_score * coherence_score;
  return base + noveltyBonus * novelty_score;
}

/**
 * Merge top-ranked chunks into a composite answer
 */
function mergeTopChunks(chunksWithScores) {
  const sorted = chunksWithScores.sort((a, b) => b.score - a.score);
  const selected = sorted.slice(0, Math.min(12, sorted.length)); // limit length
  return selected.map(c => c.text).join('\n\n');
}

/**
 * Final coherence pass: single LLM call to smooth/unify
 */
async function finalCoherencePass(composite, llmCall) {
  const systemPrompt = `Smooth and unify the merged answer for coherence, style, and logical flow. Do not add new facts.`;
  return llmCall({ systemPrompt, userPrompt: composite });
}

/**
 * Synthesizer v2: chunk-level weighted merge + coherence pass
 */
export async function synthesizeV2(agentOutputs, llmCall) {
  // Step 1: collect agent outputs + scores
  const enriched = agentOutputs.map(o => ({
    ...o,
    ucb_score: o.ucb_score ?? 0.5,
    factual_score: o.factual_score ?? 0.5,
    coherence_score: o.coherence_score ?? 0.5,
    novelty_score: o.novelty_score ?? 0,
  }));

  // Step 2: chunk-level merge
  const allChunks = [];
  for (const agent of enriched) {
    const chunks = splitIntoChunks(agent.response);
    const noveltyBonus = 0.2; // configurable
    for (const chunk of chunks) {
      allChunks.push({
        ...chunk,
        agent_name: agent.agent_name,
        score: computeChunkScore(agent, noveltyBonus),
      });
    }
  }
  const sorted = [...allChunks].sort((a, b) => b.score - a.score);
  const selectedChunks = sorted.slice(0, Math.min(12, sorted.length));
  const composite = selectedChunks.map((c) => c.text).join("\n\n");

  // Step 3: final coherence pass
  const finalAnswer = await finalCoherencePass(composite, llmCall);

  return {
    finalAnswer,
    compositeBeforeCoherence: composite,
    chunkScores: allChunks.map((c) => ({
      agent_name: c.agent_name,
      chunk_id: c.id,
      text: c.text,
      score: c.score,
    })),
    selectedChunks: selectedChunks.map((c) => ({
      agent_name: c.agent_name,
      chunk_id: c.id,
      text: c.text,
      score: c.score,
    })),
  };
}
