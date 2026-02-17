import OpenAI from "openai";
import { agents, agentEnvKeys } from "../agents.js";
import * as PromptManager from "./PromptManager.js";
import { getAgentStats } from "./LearningDB.js";
import { computeCoherence, computeNovelty } from "./ChunkScorer.js";
import { synthesizeV2 } from "./SynthesizerV2.js";
import { computeUcbV2, normalizeScoresMinMax } from "./RouterV2.js";

function getApiKeyForAgent(agentId) {
  const envKey = agentEnvKeys[agentId];
  return envKey ? process.env[envKey] : null;
}

async function completeOnce({ agentId, model, apiKey, messages, temperature = 0.4, maxTokens = 900 }) {
  const openrouter = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey });
  const completion = await openrouter.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  });
  return String(completion.choices?.[0]?.message?.content || "").trim();
}

function clamp01(x, d = 0.5) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  return Math.max(0, Math.min(1, n));
}

export async function runCollaboration({
  agentsToUse,
  messagesToSend,
  systemPromptOverride,
  langInstruction,
}) {
  const picked = Array.isArray(agentsToUse) ? agentsToUse.filter(Boolean) : [];
  if (picked.length === 0) throw new Error("No agents provided for collaboration");

  // 1) Independent answers (parallel)
  const answers = await Promise.all(
    picked.map(async (agentId) => {
      const apiKey = getApiKeyForAgent(agentId);
      const model = agents[agentId];
      if (!apiKey || !model || apiKey === "YOUR_SECRET_KEY") {
        return { agentId, answer: "", error: "unavailable" };
      }

      const baseSystem = PromptManager.getSystemPrompt(agentId);
      const override = typeof systemPromptOverride === "string" ? systemPromptOverride.trim() : "";
      const fullSystemPrompt = override
        ? `${baseSystem}\n\n[Chat Override]\n${override}\n\n${langInstruction}`
        : `${baseSystem}\n\n${langInstruction}`;

      const messages = [{ role: "system", content: fullSystemPrompt }, ...messagesToSend];
      const answer = await completeOnce({ agentId, model, apiKey, messages });
      return { agentId, answer };
    })
  );

  const goodAnswers = answers.filter((a) => a.answer && a.answer.length > 0);
  if (goodAnswers.length === 0) {
    return {
      agentsUsed: picked,
      answers,
      critiques: [],
      finalAnswer: "[Error: All agents failed to produce an answer]",
    };
  }

  // 2) Collect agent-level scores: UCB(v2, normalized per request) + factual + coherence + novelty
  const statsRows = getAgentStats();
  const factualByAgent = {};
  for (const r of statsRows) factualByAgent[String(r.agent_name)] = clamp01(r.mean_reward, 0.5);

  const promptText = (() => {
    const lastUser = [...messagesToSend].reverse().find((m) => m.role === "user");
    return lastUser?.content ? String(lastUser.content) : "";
  })();

  const usageCounts = {};
  for (const r of statsRows) usageCounts[String(r.agent_name)] = Math.max(0, Number(r.pulls) || 0);
  const noveltyForRouting = {};
  const rawUcb = await computeUcbV2(statsRows, noveltyForRouting, usageCounts, { T: 0 });
  const ucbScores = normalizeScoresMinMax(rawUcb);

  const allResponses = goodAnswers.map((a) => String(a.answer || ""));
  const enriched = await Promise.all(
    goodAnswers.map(async (a) => {
      const response = String(a.answer || "");
      const others = allResponses.filter((x) => x !== response);
      const coherence = await computeCoherence(promptText, response);
      const novelty = await computeNovelty(response, others);
      return {
        agent_name: a.agentId,
        response,
        ucb_score: Number(ucbScores[a.agentId] ?? 0.0),
        factual_score: clamp01(factualByAgent[a.agentId] ?? 0.5, 0.5),
        coherence_score: clamp01(coherence, 0.5),
        novelty_score: Math.max(0, Number(novelty) || 0),
      };
    })
  );

  // Diversity penalty: penalize agents whose outputs are near-identical.
  // Here we approximate similarity as (1 - novelty_score). Higher similarity => larger penalty.
  const diversityPenaltyWeight = Number(process.env.DIVERSITY_PENALTY_WEIGHT || 0.2);
  const enrichedWithPenalty = enriched.map((e) => {
    const similarity = 1 - Math.max(0, Math.min(1, Number(e.novelty_score) || 0));
    const penalty = diversityPenaltyWeight * similarity;
    return {
      ...e,
      ucb_score: Number(e.ucb_score) - penalty,
    };
  });

  // 3) Synthesizer v2: chunk-level weighted merge + single coherence pass
  const availableSynths = enrichedWithPenalty
    .map((e) => e.agent_name)
    .filter((id) => {
      const key = getApiKeyForAgent(id);
      return Boolean(key) && key !== "YOUR_SECRET_KEY" && Boolean(agents[id]);
    });

  const bestFactual = [...enrichedWithPenalty]
    .filter((e) => availableSynths.includes(e.agent_name))
    .sort((a, b) => (b.factual_score || 0) - (a.factual_score || 0))[0]?.agent_name;

  const synthesizerId =
    bestFactual ||
    (agents.arcee && getApiKeyForAgent("arcee") && getApiKeyForAgent("arcee") !== "YOUR_SECRET_KEY" ? "arcee" : null) ||
    goodAnswers[0].agentId;
  const synthKey = getApiKeyForAgent(synthesizerId);
  const synthModel = agents[synthesizerId];

  const llmCall = async ({ systemPrompt, userPrompt }) => {
    if (!synthKey || !synthModel || synthKey === "YOUR_SECRET_KEY") return userPrompt;
    return completeOnce({
      agentId: synthesizerId,
      model: synthModel,
      apiKey: synthKey,
      messages: [
        { role: "system", content: String(systemPrompt || "") },
        { role: "user", content: String(userPrompt || "") },
      ],
      temperature: 0.2,
      maxTokens: 1100,
    });
  };

  const synth = await synthesizeV2(enrichedWithPenalty, llmCall, { query: promptText, usageCounts });
  const finalAnswer = typeof synth === "string" ? synth : String(synth?.finalAnswer || "");

  return {
    agentsUsed: picked,
    answers,
    synthesizerId,
    finalAnswer,
    v2: {
      agentInputs: enrichedWithPenalty,
      ucbScores,
      synth,
    },
  };
}
