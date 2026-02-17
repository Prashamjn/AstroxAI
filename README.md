# AstroxAI

Enterprise-grade multi-agent AI chat platform. Per-agent system prompts, real-time streaming, and automatic model fallback. ChatGPT-style UI with dark theme.

## Features

- **Multi-agent:** Auto, Arcee Trinity, Solar Pro, LiquidAI LFM, Qwen Next, NVIDIA Nemotron.
- **System prompt editor:** Per-agent custom system prompts (sidebar → ⚙️). Save/Reset; no server restart. Stored in `server/config/prompts.json`.
- **Streaming:** SSE streaming with typing effect, markdown + code blocks, copy button, stop button.
- **Model fallback:** If the primary model fails (timeout, rate limit, error), the server automatically tries the next model in the chain. See `server/config/agentModels.json`.
- **Status indicator:** 🟢 Model active, 🟡 Using fallback (shown after a response).
- **Language:** Responses follow user language (English, Hindi, Hinglish) automatically.
- **Chat history:** LocalStorage; sidebar search, new chat, delete.
- **Auth (optional):** Firebase Authentication — email/password, Google OAuth, profile onboarding (name, DOB, username ending with `astai`). See **[Firebase setup guide](docs/SETUP_FIREBASE.md)** for free-tier setup and hosting.

## Architecture

```
AstroxAI/
├── server/
│   ├── index.js              # Express, CORS, startup (PromptManager + ModelRouter init)
│   ├── agents.js             # Agent ids, env keys, meta (no API keys)
│   ├── config/
│   │   ├── agentModels.json   # Per-agent fallback model lists
│   │   ├── defaultPrompts.json # Default system prompts per agent
│   │   └── prompts.json      # Custom prompts (edited via UI)
│   ├── lib/
│   │   ├── PromptManager.js  # Load/save system prompts (JSON)
│   │   └── ModelRouter.js    # Fallback chain: try models in order
│   ├── routes/
│   │   ├── chat.js           # POST /api/chat — stream + prompt + fallback
│   │   └── prompts.js        # GET/PUT /api/prompts, POST .../reset
│   └── .env                  # OPENROUTER_API_KEY_* per agent, PORT
├── client/
│   └── src/
│       ├── components/       # Sidebar, ChatArea, InputBar, AgentSelector,
│       │                     # SystemPromptEditor, Toast, MarkdownMessage, etc.
│       ├── pages/            # Home
│       └── store/            # useChatStore (Zustand)
└── README.md
```

- **PromptManager:** Reads default prompts from `config/defaultPrompts.json`, custom from `config/prompts.json`. Injects effective system prompt into every chat request. Updates apply immediately (in-memory + file).
- **ModelRouter:** For each agent, tries models in order from `config/agentModels.json`. On timeout/429/error, logs and tries next. Same API key per agent for all models in the chain.
- **Streaming:** Server-Sent Events; chunks `{ content }`, optional `{ selectedModel, status }`, then `[DONE]`. Frontend shows 🟢/🟡 from `status`.

## Security

- **API keys:** Only in server `.env`; never sent to or editable from the frontend.
- **Prompt injection:** System prompts are server-side only. User messages are not merged into the system prompt; the system prompt is fixed per agent (and language instruction). For production, sanitize/limit length of custom prompts if they are ever user-supplied from an untrusted source.
- **CORS:** Allowed origins are set for the dev client; tighten for production.

## Config examples

**server/config/agentModels.json** (fallback order per agent):

```json
{
  "nemotron": {
    "models": [
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "liquid/lfm-2.5-1.2b-thinking:free",
      "arcee-ai/trinity-large-preview:free"
    ]
  }
}
```

**server/config/defaultPrompts.json** — default system prompt per agent (no hardcoded prompts in route code).

## API

- `GET /api/health` — Health check.
- `GET /api/agents` — Agent list (id, name, description, model).
- `POST /api/chat` — Body: `{ agent, messages }`. Streams SSE: `{ content }`, `{ selectedAgent }`, `{ selectedModel, status }`, `[DONE]`. Uses per-agent system prompt + language + fallback chain.
- `GET /api/prompts` — All agents’ prompts (effective, custom, default).
- `GET /api/prompts/:agentId` — One agent’s prompt.
- `PUT /api/prompts/:agentId` — Body: `{ system_prompt }`. Update custom prompt.
- `POST /api/prompts/:agentId/reset` — Reset to default prompt.

## Setup

1. **Backend:** `cd server && npm install` — set `.env` with `OPENROUTER_API_KEY_*` and `PORT`.
2. **Frontend:** `cd client && npm install && npm run dev`.
3. Open **http://localhost:5173**. Use ⚙️ in the sidebar to edit system prompts.

## Scalability

- **100+ agents:** Move prompts and model config to a DB (e.g. MongoDB/PostgreSQL); replace PromptManager file reads with DB and keep the same API shape. ModelRouter can stay file-based or use DB per-agent model lists.
- **Concurrent streams:** Each request is independent; use a queue or rate limiter if you need to cap concurrent OpenRouter calls per key.

## License

MIT.
