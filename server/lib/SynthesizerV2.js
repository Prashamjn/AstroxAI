import { embedText } from "./Embeddings.js";
import { scoreChunkQuality } from "../astroxai/models/ChunkScorerModel.js";

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return null;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : null;
}

/**
 * Split text into semantic chunks (paragraphs/sentences)
 */
function splitIntoChunks(text) {
  const src = String(text || "");

  // Extract fenced code blocks as atomic chunks.
  const blocks = [];
  let remaining = src;
  let idx = 0;
  while (true) {
    const start = remaining.indexOf("```");
    if (start === -1) break;
    const end = remaining.indexOf("```", start + 3);
    if (end === -1) break;
    const before = remaining.slice(0, start);
    const block = remaining.slice(start, end + 3);
    blocks.push({ type: "text", text: before });
    blocks.push({ type: "code", text: block });
    remaining = remaining.slice(end + 3);
    idx++;
    if (idx > 50) break;
  }
  blocks.push({ type: "text", text: remaining });

  const chunks = [];
  for (const b of blocks) {
    if (b.type === "code") {
      if (String(b.text).trim()) chunks.push(String(b.text).trim());
      continue;
    }
    const paragraphs = String(b.text)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const p of paragraphs) {
      // Treat markdown tables (consecutive lines containing pipes) as atomic chunks.
      const lines = p.split(/\r?\n/);
      const isTable =
        lines.length >= 2 &&
        lines.every((ln) => ln.includes("|")) &&
        lines.some((ln) => /\|\s*[-:]+\s*\|/.test(ln));
      if (isTable) {
        chunks.push(p);
        continue;
      }

      const sentences = p.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length > 1) chunks.push(...sentences);
      else chunks.push(p);
    }
  }

  return chunks.map((c, i) => ({ id: i, text: String(c).trim() }));
}

/**
 * Compute chunk-level weighted score
 */
function computeChunkScore(agent, chunkRelevance, noveltyBonus = 0) {
  const { ucb_score, factual_score, coherence_score, novelty_score } = agent;
  const rel = typeof chunkRelevance === "number" && Number.isFinite(chunkRelevance) ? chunkRelevance : 0.5;
  const base = ucb_score * factual_score * coherence_score * rel;
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
  const systemPrompt = `Smooth and unify the merged answer for coherence, style, and logical flow. Do not add new facts. Preserve Markdown structure exactly: do NOT convert tables to paragraphs, do NOT break code fences, and do NOT change Mermaid/code block formatting.`;
  return llmCall({ systemPrompt, userPrompt: composite });
}

/**
 * Synthesizer v2: chunk-level weighted merge + coherence pass
 */
export async function synthesizeV2(agentOutputs, llmCall, { query = "", usageCounts = null } = {}) {
  // Step 1: collect agent outputs + scores
  const enriched = agentOutputs.map(o => ({
    ...o,
    ucb_score: o.ucb_score ?? 0.5,
    factual_score: o.factual_score ?? 0.5,
    coherence_score: o.coherence_score ?? 0.5,
    novelty_score: o.novelty_score ?? 0,
  }));

  const queryEmb = query ? await embedText(String(query).slice(0, 4000)) : null;

  // Step 2: chunk-level merge
  const allChunks = [];
  const usageTotal = usageCounts
    ? Object.values(usageCounts).reduce((s, n) => s + (Number(n) || 0), 0)
    : 0;
  for (const agent of enriched) {
    const chunks = splitIntoChunks(agent.response);
    const noveltyBonus = 0.2; // configurable
    for (const chunk of chunks) {
      const chunkEmb = await embedText(String(chunk.text).slice(0, 2000));
      const rel = cosineSimilarity(queryEmb, chunkEmb);

      const chunkRelevance = typeof rel === "number" && Number.isFinite(rel) ? rel : 0.5;
      const features = {
        ucb_agent: Number(agent.ucb_score) || 0,
        factual_agent: Number(agent.factual_score) || 0,
        coherence_agent: Number(agent.coherence_score) || 0,
        chunk_relevance: Number(chunkRelevance) || 0,
        novelty_score: Number(agent.novelty_score) || 0,
        agent_usage_frequency:
          usageCounts && Object.prototype.hasOwnProperty.call(usageCounts, agent.agent_name)
            ? (Number(usageCounts[agent.agent_name]) || 0) / (usageTotal + 1)
            : 0,
      };

      const learned = await scoreChunkQuality(features);
      const heuristicScore = computeChunkScore(agent, chunkRelevance, noveltyBonus);
      const blendedScore = typeof learned === "number" && Number.isFinite(learned)
        ? 0.6 * heuristicScore + 0.4 * learned
        : heuristicScore;

      allChunks.push({
        ...chunk,
        agent_name: agent.agent_name,
        chunk_relevance: chunkRelevance,
        learned_score: typeof learned === "number" && Number.isFinite(learned) ? learned : null,
        features,
        score: blendedScore,
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
      chunk_relevance: c.chunk_relevance,
      learned_score: c.learned_score,
      features: c.features,
      score: c.score,
    })),
    selectedChunks: selectedChunks.map((c) => ({
      agent_name: c.agent_name,
      chunk_id: c.id,
      text: c.text,
      chunk_relevance: c.chunk_relevance,
      learned_score: c.learned_score,
      features: c.features,
      score: c.score,
    })),
  };
}
