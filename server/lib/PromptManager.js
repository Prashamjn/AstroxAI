/**
 * PromptManager — Load/save per-agent system prompts.
 * Stores in JSON file; can be swapped for DB later.
 * No hardcoded prompts; defaults from config/defaultPrompts.json.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, "..", "config");
const PROMPTS_FILE = join(CONFIG_DIR, "prompts.json");
const DEFAULTS_FILE = join(CONFIG_DIR, "defaultPrompts.json");

let defaultPrompts = {};
let customPrompts = {};

async function loadDefaults() {
  try {
    const raw = await readFile(DEFAULTS_FILE, "utf-8");
    defaultPrompts = JSON.parse(raw);
  } catch (e) {
    console.warn("[PromptManager] Could not load defaultPrompts.json:", e.message);
  }
}

async function loadCustom() {
  try {
    const raw = await readFile(PROMPTS_FILE, "utf-8");
    customPrompts = JSON.parse(raw);
  } catch (e) {
    if (e.code !== "ENOENT") console.warn("[PromptManager] Could not load prompts.json:", e.message);
    customPrompts = {};
  }
}

/**
 * Initialize: load defaults and custom prompts from disk.
 */
export async function init() {
  await loadDefaults();
  await loadCustom();
}

/**
 * Get the effective system prompt for an agent (custom if set, else default).
 */
export function getSystemPrompt(agentId) {
  const custom = customPrompts[agentId];
  if (custom != null && String(custom).trim()) return String(custom).trim();
  return defaultPrompts[agentId] != null
    ? String(defaultPrompts[agentId]).trim()
    : "You are a helpful AI assistant. Match the user's language (English, Hindi, or Hinglish).";
}

/**
 * Get custom prompt for an agent (may be empty).
 */
export function getCustomPrompt(agentId) {
  return customPrompts[agentId] != null ? String(customPrompts[agentId]) : "";
}

/**
 * Get default prompt for an agent.
 */
export function getDefaultPrompt(agentId) {
  return defaultPrompts[agentId] != null ? String(defaultPrompts[agentId]) : "";
}

/**
 * Set custom system prompt for an agent. Persists to prompts.json.
 */
export async function setSystemPrompt(agentId, systemPrompt) {
  customPrompts[agentId] = systemPrompt == null ? "" : String(systemPrompt);
  await save();
}

/**
 * Reset agent to default prompt (remove custom).
 */
export async function resetToDefault(agentId) {
  delete customPrompts[agentId];
  await save();
}

async function save() {
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(PROMPTS_FILE, JSON.stringify(customPrompts, null, 2), "utf-8");
  } catch (e) {
    console.error("[PromptManager] Failed to save prompts:", e.message);
    throw e;
  }
}

/**
 * List all agent IDs that have defaults (for UI).
 */
export function getAgentIdsWithDefaults() {
  return Object.keys(defaultPrompts);
}
