# How to Test AstroxAI Features

## 1. System Prompt Editor & Customize Each Agent’s Behaviour

**What it does:** Each agent has a **system prompt** that sets its personality, role, and rules. You can edit it per agent and changes apply immediately (no server restart).

**How to open:**
1. Run the app (backend + frontend).
2. In the **left sidebar**, click the **gear icon** next to the AstroxAI logo.
3. The **System Prompt Editor** modal opens.

**How to use:**
1. **Select agent** – Use the dropdown (Arcee AI Trinity, Solar Pro, LiquidAI LFM, Qwen Next, NVIDIA Nemotron).
2. **Edit prompt** – The big text area shows that agent’s **custom** prompt. If empty, the agent uses the default from `server/config/defaultPrompts.json`. Type your own instructions (e.g. “You are a strict code reviewer. Always suggest improvements.”).
3. **Save** – Click **Save**. You should see a toast: **“Prompt updated successfully”**.
4. **Reset** – Click **Reset to default** to clear your custom prompt and use the default again.
5. **Test behaviour** – Send a message with that agent selected. The reply should follow your custom prompt (e.g. code-review style, tone, language rules).

**Where it’s stored:** Custom prompts are saved in `server/config/prompts.json`. Defaults are in `server/config/defaultPrompts.json`.

---

## 2. Streaming Response (Real-Time)

**What it does:** The AI reply appears **word-by-word** (streaming), like ChatGPT, instead of waiting for the full answer.

**How to check:**
1. Select any agent (or Auto).
2. Send a message (e.g. “Write a short poem about coding”).
3. You should see:
   - **Typing dots** (…) or a **blinking cursor** while the model is thinking.
   - Text **appearing gradually** in the assistant bubble.
   - **Markdown** and **code blocks** rendering as the stream continues.
4. **Stop button** – While the reply is streaming, a **red stop** button appears next to the send button. Click it to **cancel** the request mid-stream.

**Technical:** The server uses **Server-Sent Events (SSE)** and streams tokens from OpenRouter; the frontend appends each chunk to the message in real time.

---

## 3. Fallback Chain (Auto-Switch on Failure)

**What it does:** If the **first** model for an agent fails (timeout, rate limit 429, or API error), the server **automatically tries the next** model in that agent’s list. You don’t have to do anything; the reply still comes from a backup model.

**How to check:**

**Option A – Normal case (no failure):**
1. Send a message with any agent.
2. After the reply, look next to the agent selector: you may see **“Model active”** with a green indicator. That means the **primary** (first) model answered.

**Option B – Simulate failure (advanced):**
1. Edit `server/config/agentModels.json`.
2. For one agent (e.g. `nemotron`), put a **wrong or invalid model id** as the **first** entry (e.g. `"invalid-model-name"`), and keep the real model as the second:
   ```json
   "nemotron": {
     "models": [
       "invalid-model-name",
       "nvidia/nemotron-3-nano-30b-a3b:free",
       "liquid/lfm-2.5-1.2b-thinking:free"
     ]
   }
   ```
3. Restart the server, then send a message with **Nemotron** selected.
4. The first model will fail; the server will try the next and (if it works) you still get a reply.
5. In the **server terminal** you should see a log like:  
   `[ModelRouter] fallback agent=nemotron from=invalid-model-name to=nvidia/... reason=error`
6. In the **UI** you may see **“Fallback”** with a yellow indicator, meaning a backup model was used.
7. Restore `agentModels.json` when done testing.

**Config location:** `server/config/agentModels.json` — each agent has a `models` array; order = try first, then second, then third, etc.

---

## 4. Quick Checklist

| Feature              | Where to look / What to do |
|----------------------|----------------------------|
| System prompt editor | Sidebar → gear icon → edit prompt → Save → test chat |
| Custom agent behaviour | Same; change prompt per agent and send messages |
| Streaming            | Send any message; watch text appear gradually + stop button |
| Fallback chain       | See “Model active” / “Fallback” after reply; or force failure in `agentModels.json` and check server logs |

---

## 5. Image Analysis (Upload & Ask Agents)

**Yes — you can upload images and ask any agent to analyze them.**

- **How to use:** Click the **image icon** next to the input, choose an image (JPEG, PNG, WebP). A thumbnail appears above the input. Type a question (e.g. “What’s in this image?” or “Describe this”) or leave it blank and send. The agent receives the image(s) plus your text and can describe, analyze, or answer questions about the image.
- **Technical:** The app sends images as base64 data URLs in the request body (`imageUrls`). The backend builds a **multimodal** message (text + `image_url` parts) for the last user message and forwards it to OpenRouter. Whether the reply succeeds depends on whether the **model** for that agent supports **vision** on OpenRouter.
- **If you get an error:** Some models are text-only and will return an error when given an image. Try another agent (e.g. Qwen, Nemotron, or Solar) or check OpenRouter’s model list for “vision” support. The fallback chain will try the next model for that agent if the first one fails.
