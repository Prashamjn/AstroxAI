/**
 * ModelRouter — Fallback chain: try models in order on timeout/error/rate limit.
 * Uses same API key per agent; tries next model in config on failure.
 */

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { agentEnvKeys } from "../agents.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = join(__dirname, "..", "config", "agentModels.json");

let modelChains = {};

export async function loadModelConfig() {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    modelChains = JSON.parse(raw);
  } catch (e) {
    console.warn("[ModelRouter] Could not load agentModels.json:", e.message);
    modelChains = {};
  }
}

function getApiKeyForAgent(agentId) {
  const envKey = agentEnvKeys[agentId];
  return envKey ? process.env[envKey] : null;
}

/**
 * Get ordered list of models for an agent (from config or single fallback from agents.js).
 */
export function getModelsForAgent(agentId, singleModelFallback) {
  const chain = modelChains[agentId];
  if (chain && Array.isArray(chain.models) && chain.models.length > 0) {
    return chain.models;
  }
  return singleModelFallback ? [singleModelFallback] : [];
}

/** Get vision-capable models (used when request includes images). */
export function getVisionModels() {
  const chain = modelChains.vision;
  if (chain && Array.isArray(chain.models) && chain.models.length > 0) {
    return chain.models;
  }
  return ["google/gemini-2.0-flash-exp:free"];
}

/**
 * Resolve which model and key to use for an agent.
 * Prefer the agent's primary model from agents.js; fall back to config if needed.
 */
export function getPrimaryModelAndKey(agentId, singleModelFallback) {
  const apiKey = getApiKeyForAgent(agentId);
  // Prefer the agent's primary model from agents.js
  const primaryModel = singleModelFallback;
  const models = getModelsForAgent(agentId, singleModelFallback);
  // Use primary model if it exists; otherwise use first fallback
  const model = primaryModel || models[0];
  if (!model || !apiKey || apiKey === "YOUR_SECRET_KEY") {
    return { model: null, apiKey: null, status: "unavailable" };
  }
  return { model, apiKey, status: "primary" };
}

/**
 * Log fallback event for monitoring.
 */
function logFallback(agentId, fromModel, toModel, reason) {
  console.warn(
    `[ModelRouter] fallback agent=${agentId} from=${fromModel} to=${toModel} reason=${reason}`
  );
}

/**
 * Try a single completion with the given model and key.
 * Returns { success: boolean, error?: string }.
 */
async function tryCompletion(openrouter, model, messages, stream, signal) {
  try {
    const streamOpt = stream
      ? await openrouter.chat.completions.create({ model, messages, stream: true })
      : await openrouter.chat.completions.create({ model, messages, stream: false });
    return { success: true, stream: stream ? streamOpt : null, completion: stream ? null : streamOpt };
  } catch (err) {
    const msg = err.message || String(err);
    const reason =
      msg.includes("429") || msg.includes("rate")
        ? "rate_limit"
        : msg.includes("timeout") || msg.includes("ETIMEDOUT")
          ? "timeout"
          : "error";
    return { success: false, error: msg, reason };
  }
}

const REQUEST_TIMEOUT_MS = 60000;

/**
 * Run chat completion with fallback chain. Streams to the provided writeResponse callback.
 * writeResponse({ content }) for content delta, writeResponse({ selectedModel, status }) once at start.
 * Options: { useVision: true } to use vision-capable models (when request includes images).
 * Returns { modelUsed, status }.
 */
export async function streamWithFallback(
  agentId,
  singleModelFallback,
  messages,
  apiKey,
  writeResponse,
  signal,
  options = {}
) {
  const useVision = options.useVision === true;
  // For non-vision, prefer the agent's primary model from agents.js; fall back to config chain
  let models;
  if (useVision) {
    models = getVisionModels();
  } else {
    const primaryModel = singleModelFallback;
    const fallbackChain = getModelsForAgent(agentId, singleModelFallback);
    // Prefer primary model; if it's already first in chain, keep order; otherwise prepend it
    if (primaryModel && fallbackChain[0] !== primaryModel) {
      models = [primaryModel, ...fallbackChain.filter(m => m !== primaryModel)];
    } else {
      models = fallbackChain;
    }
  }
  const logAgentId = useVision ? "vision" : agentId;
  const OpenAI = (await import("openai")).default;
  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  let lastError;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isPrimary = i === 0;
    if (signal?.aborted) break;

    const status = isPrimary ? "primary" : "fallback";
    writeResponse({ selectedModel: model, status });

    try {
      const stream = await openrouter.chat.completions.create({
        model,
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) writeResponse({ content: delta });
      }

      return { modelUsed: model, status };
    } catch (err) {
      lastError = err;
      const msg = err.message || String(err);
      const reason =
        msg.includes("429") || msg.includes("rate") ? "rate_limit" : msg.includes("timeout") || msg.includes("ETIMEDOUT") ? "timeout" : "error";
      logFallback(logAgentId, model, models[i + 1] || "none", reason);
    }
  }

  throw lastError || new Error("All models in fallback chain failed");
}
