/**
 * System prompt CRUD — GET/PUT per-agent custom prompts.
 * No restart required; PromptManager reads from disk on each request (or in-memory cache).
 */

import { Router } from "express";
import * as PromptManager from "../lib/PromptManager.js";

const router = Router();

/** GET /api/prompts — list all agents with their current (effective) system prompt and custom/default flag */
router.get("/", async (req, res) => {
  try {
    const agentIds = PromptManager.getAgentIdsWithDefaults();
    const list = {};
    for (const id of agentIds) {
      list[id] = {
        agent_id: id,
        system_prompt: PromptManager.getSystemPrompt(id),
        custom_prompt: PromptManager.getCustomPrompt(id),
        default_prompt: PromptManager.getDefaultPrompt(id),
        is_custom: !!PromptManager.getCustomPrompt(id)?.trim(),
      };
    }
    res.json({ prompts: list });
  } catch (e) {
    console.error("[prompts] GET /", e);
    res.status(500).json({ error: e.message || "Failed to load prompts" });
  }
});

/** GET /api/prompts/:agentId — get prompt for one agent */
router.get("/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const system_prompt = PromptManager.getSystemPrompt(agentId);
    const custom_prompt = PromptManager.getCustomPrompt(agentId);
    const default_prompt = PromptManager.getDefaultPrompt(agentId);
    res.json({
      agent_id: agentId,
      system_prompt,
      custom_prompt,
      default_prompt,
      is_custom: !!custom_prompt?.trim(),
    });
  } catch (e) {
    console.error("[prompts] GET /:agentId", e);
    res.status(500).json({ error: e.message || "Failed to load prompt" });
  }
});

/** PUT /api/prompts/:agentId — set custom system prompt (body: { system_prompt: string }) */
router.put("/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { system_prompt } = req.body ?? {};
    await PromptManager.setSystemPrompt(agentId, system_prompt ?? "");
    res.json({
      ok: true,
      agent_id: agentId,
      message: "Prompt updated successfully",
    });
  } catch (e) {
    console.error("[prompts] PUT /:agentId", e);
    res.status(500).json({ error: e.message || "Failed to save prompt" });
  }
});

/** POST /api/prompts/:agentId/reset — reset to default prompt */
router.post("/:agentId/reset", async (req, res) => {
  try {
    const { agentId } = req.params;
    await PromptManager.resetToDefault(agentId);
    res.json({
      ok: true,
      agent_id: agentId,
      system_prompt: PromptManager.getSystemPrompt(agentId),
      message: "Reset to default successfully",
    });
  } catch (e) {
    console.error("[prompts] POST /:agentId/reset", e);
    res.status(500).json({ error: e.message || "Failed to reset prompt" });
  }
});

export default router;
