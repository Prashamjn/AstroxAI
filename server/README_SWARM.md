# AstroxAI Swarm Collaboration + Feedback Learning

## What this adds

- Auto router can enter **Swarm mode** (top-3 agents) when confidence is low.
- Swarm pipeline (v2):
  - Parallel agent answers
  - Lightweight scoring (UCB + factual + coherence + novelty)
  - **Synthesizer v2**: weighted *chunk-level merge* (not “pick best full answer”)
  - **Single** final coherence pass (one LLM call) that smooths style/flow and **does not add new facts**
- Thumbs up/down feedback per assistant response, stored in SQLite and used to update agent stats.

## Key runtime behavior

- Normal `agent=auto` uses a single agent when routing is confident.
- If confidence is low (top UCB scores close), `auto` triggers Swarm.

## Exploration vs exploitation (why UCB exists)

The router is solving a bandit problem:

- **Exploitation**: prefer agents with higher historical rewards.
- **Exploration**: occasionally try less-used agents to avoid premature convergence.

UCB-style routing mixes both by adding an exploration bonus that is larger when an agent has fewer samples.

On top of that, AstroxAI includes a simple diversity mechanism:

- **Forced exploration**: every N interactions, inject the lowest-used agent into the swarm set.

This helps prevent the system from always selecting the same “safe” agent.

## Engineering notes (bandit + synthesis details)

### UCB is not clamped

UCB values are **not** clamped to `[0, 1]`. Exploration bonuses can push UCB above `1.0`, which is expected.

### Per-request UCB normalization

Raw UCB scores are normalized per request using min-max scaling:

`ucb_norm_i = (ucb_i - min_ucb) / (max_ucb - min_ucb + eps)`

This preserves exploration while keeping the swarm confidence and ranking comparable across requests.

### Alpha decay

Exploration strength decays over time:

- `alpha(T) = alpha0 * (alpha_decay ^ T)`

Where `T` is the interaction count.

Environment variables:

- `ROUTER_ALPHA` (default `1.0`)
- `ROUTER_ALPHA_DECAY` (default `0.999`)

### Reward recency (EMA)

Agent reward tracking uses an exponential moving average (EMA) so older mistakes fade out:

`reward_ema = (1 - gamma) * reward_ema + gamma * new_reward`

- `REWARD_EMA_GAMMA` default is `0.2` (range clamped to `[0.01, 0.5]`).

The router uses `reward_ema` when present; otherwise it falls back to `mean_reward`.

### Synthesizer v2: per-chunk relevance

Chunk selection uses **per-chunk relevance**, not just agent-level scores.

- `chunk_relevance = cosine(embed(chunk), embed(query))`
- `chunk_score = ucb_agent * factual_agent * coherence_agent * chunk_relevance + novelty_bonus`

This ensures the synthesizer can pick the best segments across agents rather than copying one full response.

### Swarm feedback attribution (no bandit poisoning)

Feedback is attributed proportionally to each agent based on how many selected chunks came from that agent:

- `contribution_i = selected_chunks_i / total_selected_chunks`
- `agent_reward_i = raw_feedback * contribution_i`

Per-agent rewards are logged in `agent_reward_log`.

## Environment variables

- `COLLAB_ENABLE_VOTING=1`
  - Enables agent-to-agent voting. Default off.

## Router/Synthesizer hyperparameters

Config file:

- `server/config/diversity.json`

Runtime overrides (env vars):

- `ROUTER_ALPHA`
  - Exploration strength in UCB v2.
- `ROUTER_BETA`
  - Novelty weight in UCB v2 (only effective when embeddings are available).
- `ROUTER_DIVERSITY_WEIGHT`
  - Diversity bonus weight in UCB v2.

## API endpoints

- `POST /api/chat` (SSE streaming)
  - Emits `responseId` and (if swarm) `collabAgents` via SSE.

- `POST /api/feedback`
  - Body:
    - `response_id`
    - `user_id`
    - `feedback`: `up | down`
    - `agent_name` and optional `agent_names` (swarm)

- Debug:
  - `GET /api/collab/recent?limit=25`
  - `GET /api/collab/run/:id`
  - `GET /api/collab/stats?limit=500`

## SQLite tables

- `agent_scores`, `agent_stats`
- `response_feedback`
- `collab_runs`, `collab_answers`, `collab_critiques`, `collab_final`, `collab_votes`

New (v2):

- `collab_v2_metrics`
  - Stores UCB scores, per-agent inputs, chunk scoring, and composite-before-coherence for each collab run.
- `interaction_v2`
  - Canonical per-response record keyed by `response_id`:
    - `query`
    - `agent_responses_json`
    - `ucb_scores_json`
    - `coherence_scores_json`
    - `novelty_scores_json`
    - `chunk_scores_json`
    - `selected_chunks_json`
    - `final_answer`
    - `feedback`

## How to test quickly

1. Start server and client.
2. Select `Auto`.
3. Ask a few questions until swarm triggers (watch server logs).
4. After response finishes, click 👍/👎.
5. Inspect collab runs:
   - `http://localhost:3001/api/collab/recent?limit=10`

Tip:

- Type `/swarm` at the start of your prompt in the client to force swarm mode.

