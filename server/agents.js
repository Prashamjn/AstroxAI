/**
 * Agent model mappings for OpenRouter.
 * API keys are NEVER stored here — use per-agent keys in .env:
 * OPENROUTER_API_KEY_ARCEE, _SOLAR, _LIQUID, _QWEN, _NEMOTRON
 */

export const agents = {
  arcee: "arcee-ai/trinity-large-preview:free",
  solar: "upstage/solar-pro-3:free",
  liquid: "liquid/lfm-2.5-1.2b-thinking:free",
  qwen: "qwen/qwen3-next-80b-a3b-instruct:free",
  nemotron: "nvidia/nemotron-3-nano-30b-a3b:free",
};

/** Env variable names for each agent's OpenRouter API key */
export const agentEnvKeys = {
  arcee: "OPENROUTER_API_KEY_ARCEE",
  solar: "OPENROUTER_API_KEY_SOLAR",
  liquid: "OPENROUTER_API_KEY_LIQUID",
  qwen: "OPENROUTER_API_KEY_QWEN",
  nemotron: "OPENROUTER_API_KEY_NEMOTRON",
};

/** Human-readable labels and descriptions for UI */
export const agentMeta = {
  auto: {
    name: "Auto",
    description: "System picks the best agent for your question",
  },
  arcee: {
    name: "Arcee AI Trinity",
    description: "Balanced, good general reasoning",
  },
  solar: {
    name: "Solar Pro",
    description: "Fast and efficient, good for coding",
  },
  liquid: {
    name: "LiquidAI LFM Thinking",
    description: "Deep reasoning, chain-of-thought style",
  },
  qwen: {
    name: "Qwen Next",
    description: "Very strong multilingual and logic",
  },
  nemotron: {
    name: "NVIDIA Nemotron",
    description: "NVIDIA optimized, good for factual tasks",
  },
};

/** Agent IDs that can be selected by the Auto router (must have a model in agents) */
export const routableAgentIds = ["arcee", "solar", "liquid", "qwen", "nemotron"];
