# AstroxAI Self-Learning System (Node)

## Overview

AstroxAI now learns from every interaction:
- **Embedding similarity routing** (fast local cosine search)
- **Bandit/UCB online learning** (reward-weighted routing)
- **Automatic evaluation** after each response
- **Self-reflection** every N interactions
- **SQLite persistence** (no external DB required)

---

## How Auto routing works now

1. **Embedding similarity**  
   - Embed the new query  
   - Find similar past queries (cosine similarity)  
   - If strong similarity (default `0.78`) and past performance is good → route to that agent

2. **Bandit/UCB** (if no strong similarity)  
   - Maintain per-agent stats: pulls + mean reward  
   - Use UCB to balance exploitation vs exploration  
   - Router prefers agents with higher historical scores, but still tries others

3. **Fallback to meta-router (LLM)**  
   - If no embeddings/history, uses your existing Arcee router model with rules

---

## Evaluation pipeline (after each response)

- Capture full assistant response
- Run LLM evaluator (`EVALUATOR_MODEL`) → scores: relevance, accuracy, clarity, usefulness
- Compute `overall_score` (weighted: 35% relevance, 35% accuracy, 20% clarity, 10% usefulness)
- Store in SQLite (`agent_scores` table):
  - Scores, embeddings (query + response), user_id, timestamp
- Update bandit stats (`agent_stats` table)
- Optional: run self-reflection every `SELF_REFLECT_INTERVAL` (default 100)

---

## Files

### Core modules
- `server/lib/LearningDB.js` — SQLite persistence, schema, pruning
- `server/lib/AdaptiveRouter.js` — Embedding similarity + UCB bandit routing
- `server/lib/Evaluator.js` — LLM evaluation prompt + scoring
- `server/lib/Embeddings.js` — OpenRouter embeddings wrapper
- `server/lib/SelfReflect.js` — Periodic analysis of agent performance
- `server/lib/Pruning.js` — Prune old rows, load/save JSON weights/profiles

### Integration
- `server/routes/chat.js` — Auto routing + async evaluation + reward update
- `server/index.js` — Initialize LearningDB at startup
- `client/src/components/InputBar.jsx` — Sends `uid` in request

### Storage
- `server/db/agent_scores.sqlite` — SQLite DB (auto-created)
- `server/db/agent_weights.json` — Optional per-agent weight overrides
- `server/db/user_profile.json` — Optional per-user preferences (future)

---

## Environment variables (add to `.env`)

```bash
# Required: at least one OpenRouter key
OPENROUTER_API_KEY_ARCEE=...
# Optional: dedicated keys for embeddings/evaluator
OPENROUTER_API_KEY_EMBEDDINGS=
OPENROUTER_API_KEY_EVALUATOR=

# Router tuning
ROUTER_SIM_THRESHOLD=0.78
ROUTER_UCB_C=0.35
EMBEDDING_MODEL=text-embedding-3-small
EVALUATOR_MODEL=arcee-ai/trinity-large-preview:free

# Self-reflection interval (interactions)
SELF_REFLECT_INTERVAL=100

# DB pruning
MAX_SCORE_ROWS=50000
```

---

## Expected behavior

- **Cold start**: routing uses meta-router + bandit defaults
- **After ~20–50 interactions**: embedding similarity starts contributing
- **After ~100+ interactions**: bandit weights stabilize; self-reflection prints insights
- **SQLite file appears**: `server/db/agent_scores.sqlite`

---

## Monitoring

Server logs will show:
- `[chat] Auto selected agent: solar (reason=embedding_similarity)`
- `[SelfReflect] Agent solar underperforming (mean=0.42, n=23). Consider reducing routing weight.`
- `[SelfReflect] Agent qwen strong (mean=0.86, n=31). Consider increasing routing weight.`

---

## Safety & Performance

- Pruning: automatically deletes oldest rows when `MAX_SCORE_ROWS` exceeded
- Evaluation is async (non-blocking) — does not slow SSE streaming
- Embeddings are cached per interaction; similarity is computed locally (no external vector DB)
- Bandit stats are updated incrementally; no heavy recomputation

---

## Future extensions

- Per-user preference learning (tone, domain)
- True reinforcement learning (policy gradients)
- Federated learning across users
- Dashboard endpoints (`/api/learning/stats`, `/api/learning/leaderboard`)
- Feedback poisoning detection and mitigation

---

## Quick test

1. Ensure `.env` has at least one OpenRouter key
2. Start server: `node index.js`
3. Send a few messages with `agent="auto"`
4. Check logs for routing reason and self-reflection after ~100 messages
5. Inspect `server/db/agent_scores.sqlite` with any SQLite viewer

---

## Status

- ✅ Embedding similarity routing + meta-router fallback
- ✅ Bandit/UCB online learning
- ✅ Automatic evaluation + reward update
- ✅ SQLite persistence + pruning
- ✅ Self-reflection every N interactions
- ✅ Env knobs + documentation
- ✅ Client passes `uid` for future per-user learning
