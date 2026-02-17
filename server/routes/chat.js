/**
 * Chat API — streaming with per-agent system prompts and model fallback chain.
 * POST /api/chat streams SSE; injects PromptManager system prompt; uses ModelRouter for fallback.
 */

import { Router } from "express";
import OpenAI from "openai";
import { agents, agentEnvKeys, routableAgentIds } from "../agents.js";
import * as PromptManager from "../lib/PromptManager.js";
import * as ModelRouter from "../lib/ModelRouter.js";
import { selectAgentEmbeddingPlusBandit } from "../lib/AdaptiveRouter.js";
import { embedText } from "../lib/Embeddings.js";
import { evaluateResponse, computeOverallScore } from "../lib/Evaluator.js";
import { computeUcbV2, selectTopKAgents, forceExploration, normalizeScoresMinMax } from "../lib/RouterV2.js";
import { shouldForceExploration } from "../lib/DiversityEngine.js";
import { detectFormatIntent, buildFormatConstraint } from "../astroxai/core/FormatIntent.js";
import {
  insertAgentScore,
  insertCollabRun,
  insertInteractionV2,
  upsertAgentStats,
  getInteractionCount,
  getAgentStats,
} from "../lib/LearningDB.js";
import { shouldRunReflection, runSelfReflection } from "../lib/SelfReflect.js";
import { runCollaboration } from "../lib/Collaboration.js";

const router = Router();
const ROUTER_AGENT = "arcee";

function getApiKeyForAgent(agentId) {
  const envKey = agentEnvKeys[agentId];
  return envKey ? process.env[envKey] : null;
}

async function selectAgentAutoUpgraded(userText) {
  const result = await selectAgentEmbeddingPlusBandit({
    userText,
    metaRouterFallback: selectAgentForPrompt,
  });
  if (typeof result === "string") return { agentId: result, reason: "unknown", queryEmbedding: null };
  return result;
}

function shouldUseSwarm({ reason, ucbScores }) {
  // High confidence: embedding match
  if (reason === "embedding_similarity") return false;

  const ranked = Object.entries(ucbScores || {}).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1];
  const second = ranked[1]?.[1];
  if (typeof top !== "number" || typeof second !== "number") return true;

  // Low confidence when top/second are too close
  const margin = top - second;
  return margin < 0.05;
}

async function selectAgentForPrompt(userMessage) {
  const apiKey = getApiKeyForAgent(ROUTER_AGENT);
  const model = agents[ROUTER_AGENT];
  if (!apiKey || !model) return "arcee";

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const systemPrompt = `You are a router. Given the user's message, reply with exactly ONE word: arcee, solar, liquid, qwen, or nemotron.
Rules: use solar for code/programming; liquid for reasoning; qwen for multilingual/logic; nemotron for factual; arcee for general. Reply only the word.`;

  try {
    const completion = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage.slice(0, 2000) },
      ],
      max_tokens: 20,
      temperature: 0.1,
    });
    const text = (completion.choices?.[0]?.message?.content || "").trim().toLowerCase();
    const match = routableAgentIds.find((id) => text.includes(id));
    return match || "arcee";
  } catch (err) {
    console.warn("[chat] Auto router failed, using arcee:", err.message);
    return "arcee";
  }
}

const LANGUAGE_SYSTEM_MESSAGES = {
  english: "Respond only in English.",
  hindi: "Respond only in Hindi (हिंदी).",
  hinglish: "Respond only in Hinglish (mix of Hindi and English).",
};

function countDevanagari(str) {
  let n = 0;
  for (const c of str) {
    const code = c.codePointAt(0) || 0;
    if (code >= 0x0900 && code <= 0x097f) n++;
  }
  return n;
}

function detectLanguage(userText) {
  const s = String(userText || "").trim();
  if (!s) return "english";
  const devanagari = countDevanagari(s);
  const letters = (s.match(/[a-zA-Z]/g) || []).length;
  const totalLetters = (s.match(/[\w\u0900-\u097f]/g) || []).length;
  if (totalLetters === 0) return "english";
  const devanagariRatio = devanagari / totalLetters;
  const hasLatin = letters > 0;
  const hasDevanagari = devanagari > 0;
  if (hasDevanagari && hasLatin) return "hinglish";
  if (devanagariRatio >= 0.5) return "hindi";
  return "english";
}

/**
 * POST /api/chat — stream chat with system prompt + fallback chain.
 * Body: { agent, messages, imageUrls?: string[] } — imageUrls are data URIs (base64) for the last user message (vision).
 */
router.post("/", async (req, res) => {
  let { agent, messages, imageUrls, systemPromptOverride, uid, forceSwarm } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUserMsg?.content ? String(lastUserMsg.content) : "";
  const forceSwarmByPrefix = /^\s*\/swarm\b/i.test(userText);
  const lang = detectLanguage(userText);
  const langInstruction = LANGUAGE_SYSTEM_MESSAGES[lang] || LANGUAGE_SYSTEM_MESSAGES.english;

  const fmtIntent = await detectFormatIntent(userText);
  const formatConstraint = buildFormatConstraint(fmtIntent?.format);

  // Build messages for API; if imageUrls provided, turn last user message into multimodal content (text + images)
  const messagesToSend = messages.map((m) => ({ role: m.role, content: m.content }));
  if (Array.isArray(imageUrls) && imageUrls.length > 0 && messagesToSend.length > 0) {
    const last = messagesToSend[messagesToSend.length - 1];
    if (last.role === "user") {
      const textPart = (userText || "").trim() || "What do you see in this image? Describe or analyze it.";
      last.content = [
        { type: "text", text: textPart },
        ...imageUrls.slice(0, 4).map((url) => ({ type: "image_url", image_url: { url: String(url) } })),
      ];
    }
  }

  let agentId = agent;
  let autoRoute = null;
  let collabAgents = null;
  if (agentId === "auto") {
    const promptForRouter = userText || (imageUrls?.length ? "The user sent an image to analyze." : "");
    autoRoute = await selectAgentAutoUpgraded(promptForRouter);

    // Decide whether to use swarm/collaboration for low confidence
    const statsRows = getAgentStats();
    const interactionCount = getInteractionCount();
    const usageCounts = {};
    for (const r of statsRows) usageCounts[String(r.agent_name)] = Number(r.pulls) || 0;
    const noveltyScores = {};
    const rawUcb = await computeUcbV2(statsRows, noveltyScores, usageCounts, { T: interactionCount });
    const ucbNorm = normalizeScoresMinMax(rawUcb);

    const useSwarm =
      Boolean(forceSwarm) ||
      forceSwarmByPrefix ||
      shouldUseSwarm({ reason: autoRoute.reason, ucbScores: ucbNorm });

    if (useSwarm) {
      // RouterV2: select top-K using normalized UCB scores.
      collabAgents = selectTopKAgents(ucbNorm, 3);

      // Forced exploration: every N interactions, ensure lowest-used agent is included.
      if (shouldForceExploration(interactionCount, 25)) {
        const forced = forceExploration(usageCounts);
        if (forced && !collabAgents.includes(forced)) {
          collabAgents = [...collabAgents.slice(0, 2), forced];
        }
      }

      agentId = collabAgents[0] || autoRoute.agentId;
      console.log(
        `[chat] Auto swarm enabled: leader=${agentId} agents=${collabAgents.join(",")} (reason=${autoRoute.reason}) force=${Boolean(forceSwarm) || forceSwarmByPrefix}`
      );
    } else {
      agentId = autoRoute.agentId;
      console.log(`[chat] Auto selected agent: ${agentId} (reason=${autoRoute.reason})`);
    }
  }

  if (!Object.prototype.hasOwnProperty.call(agents, agentId)) {
    agentId = "arcee";
  }

  const apiKey = getApiKeyForAgent(agentId);
  if (!apiKey || apiKey === "YOUR_SECRET_KEY") {
    return res.status(503).json({
      error: `No API key configured for agent "${agentId}". Set the key in .env`,
    });
  }

  const agentSystemPrompt = PromptManager.getSystemPrompt(agentId);
  const override = typeof systemPromptOverride === "string" ? systemPromptOverride.trim() : "";
  const fullSystemPrompt = override
    ? `${agentSystemPrompt}\n\n[Chat Override]\n${override}\n\n${langInstruction}${formatConstraint ? `\n\n${formatConstraint}` : ""}`
    : `${agentSystemPrompt}\n\n${langInstruction}${formatConstraint ? `\n\n${formatConstraint}` : ""}`;
  const messagesWithPrompt = [
    { role: "system", content: fullSystemPrompt },
    ...messagesToSend.map((m) => ({ role: m.role, content: m.content })),
  ];

  const singleModelFallback = agents[agentId];

  const responseId = `resp_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("X-Response-Id", responseId);
  if (agent === "auto") {
    res.setHeader("X-Selected-Agent", agentId);
  }
  res.flushHeaders();

  const writeResponse = (payload) => {
    const line = `data: ${JSON.stringify(payload)}\n\n`;
    res.write(line);
    if (typeof res.flush === "function") res.flush();
  };

  if (agent === "auto") {
    writeResponse({ selectedAgent: agentId });
  }

  // Always send responseId so client can attach feedback
  writeResponse({ responseId });

  if (fmtIntent?.format) {
    writeResponse({ formatIntent: fmtIntent });
  }

  if (Array.isArray(collabAgents) && collabAgents.length > 0) {
    writeResponse({ collabAgents });
  }

  const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0;

  let streamedText = "";

  try {
    if (Array.isArray(collabAgents) && collabAgents.length > 0) {
      const collab = await runCollaboration({
        agentsToUse: collabAgents,
        messagesToSend: messagesToSend,
        systemPromptOverride: `${override}${formatConstraint ? `\n\n${formatConstraint}` : ""}`.trim(),
        langInstruction,
      });

      // Store v2 interaction record keyed by response_id (best-effort)
      try {
        const queryText = userText || (imageUrls?.length ? "The user sent an image to analyze." : "");
        const agentResponses = Array.isArray(collab.answers)
          ? collab.answers.map((a) => ({ agent_name: a.agentId, response: a.answer, error: a.error || null }))
          : [];
        const coherenceScores = {};
        const noveltyScores = {};
        if (Array.isArray(collab.v2?.agentInputs)) {
          for (const ai of collab.v2.agentInputs) {
            coherenceScores[String(ai.agent_name)] = ai.coherence_score;
            noveltyScores[String(ai.agent_name)] = ai.novelty_score;
          }
        }

        await insertInteractionV2({
          responseId,
          userId: typeof uid === "string" ? uid : null,
          query: queryText,
          agentResponses,
          ucbScores: collab.v2?.ucbScores || null,
          coherenceScores,
          noveltyScores,
          chunkScores: collab.v2?.synth?.chunkScores || null,
          selectedChunks: collab.v2?.synth?.selectedChunks || null,
          finalAnswer: collab.finalAnswer || "",
        });
      } catch (e) {
        console.warn("[chat] interaction_v2 insert failed:", e.message);
      }

      // Persist the full swarm run (answers, critiques, final)
      try {
        await insertCollabRun({
          responseId,
          userId: typeof uid === "string" ? uid : null,
          query: userText || (imageUrls?.length ? "The user sent an image to analyze." : ""),
          agentsUsed: collabAgents,
          leaderAgent: agentId,
          routerReason: autoRoute?.reason || null,
          answers: collab.answers,
          critiques: collab.critiques,
          votes: collab.votes,
          synthesizerId: collab.synthesizerId || null,
          finalAnswer: collab.finalAnswer,
          v2: collab.v2 || null,
        });
      } catch (e) {
        console.warn("[chat] Collab persistence failed:", e.message);
      }

      streamedText = collab.finalAnswer || "";
      // Stream as chunks (keeps client behavior consistent)
      const chunkSize = 240;
      for (let i = 0; i < streamedText.length; i += chunkSize) {
        const part = streamedText.slice(i, i + chunkSize);
        res.write(`data: ${JSON.stringify({ content: part })}\n\n`);
        if (typeof res.flush === "function") res.flush();
      }
    } else {
      await ModelRouter.streamWithFallback(
        agentId,
        singleModelFallback,
        messagesWithPrompt,
        apiKey,
        (payload) => {
          if (payload.content !== undefined) {
            streamedText += payload.content;
            res.write(`data: ${JSON.stringify({ content: payload.content })}\n\n`);
            if (typeof res.flush === "function") res.flush();
          } else if (payload.selectedModel !== undefined) {
            writeResponse({ selectedModel: payload.selectedModel, status: payload.status });
          }
        },
        undefined,
        hasImages ? { useVision: true } : undefined
      );
    }

    // Async evaluation + learning update (do not block response end)
    (async () => {
      try {
        const queryText = userText || (imageUrls?.length ? "The user sent an image to analyze." : "");
        const evalResult = await evaluateResponse({ query: queryText, response: streamedText });
        const overall = computeOverallScore({
          relevance: evalResult.relevance,
          accuracy: evalResult.accuracy,
          clarity: evalResult.clarity,
          userPref: evalResult.usefulness,
        });

        const queryEmbedding = autoRoute?.queryEmbedding || (queryText ? await embedText(queryText) : null);
        const responseEmbedding = streamedText ? await embedText(streamedText.slice(0, 4000)) : null;

        await insertAgentScore({
          userId: typeof uid === "string" ? uid : null,
          agentName: agentId,
          query: queryText,
          response: `[response_id:${responseId}]\n${streamedText}`,
          relevance: evalResult.relevance,
          accuracy: evalResult.accuracy,
          clarity: evalResult.clarity,
          userPref: evalResult.usefulness,
          overallScore: overall,
          queryEmbedding,
          responseEmbedding,
        });

        if (overall !== null) {
          await upsertAgentStats(agentId, overall);
        }

        // Periodic self-reflection
        if (shouldRunReflection(getInteractionCount())) {
          await runSelfReflection();
        }
      } catch (e) {
        console.warn("[chat] Post-eval failed:", e.message);
      }
    })();

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[chat] OpenRouter error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "OpenRouter request failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message || "Stream failed" })}\n\n`);
      res.end();
    }
  }
});

export default router;
