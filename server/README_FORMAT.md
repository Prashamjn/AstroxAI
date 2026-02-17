# Structured Output Enforcement (Format Intent)

AstroxAI detects formatting intent from the user prompt and enforces that format consistently across:

- single-agent responses
- swarm/multi-agent responses
- synthesizer merge + final coherence pass

## Format intent detection

Runtime implementation:

- `server/astroxai/core/FormatIntent.js`
- Keywords: `server/astroxai/config/format_keywords.json`

Python deliverable (reference implementation):

- `server/astroxai/core/format_intent.py`

### Priority (conflict resolution)

If multiple formats match, the system resolves conflicts with:

`CODE > TABLE > CHART > STEPS > LIST > PARAGRAPH`

## Prompt injection (format constraint)

On every `/api/chat` request:

1. Detect `formatIntent` from the last user message.
2. Convert it to a strict instruction string via `buildFormatConstraint()`.
3. Append the constraint into the **system prompt** so all agents follow the same structure.

This is done for:

- single-agent responses (system prompt built in `server/routes/chat.js`)
- swarm responses (the same constraint is appended into `systemPromptOverride` that gets passed to `runCollaboration()`)

## Synthesizer structure lock

The synthesizer uses structure-aware chunking so it does not break:

- fenced code blocks (```...```)
- Markdown tables

Implementation:

- `server/lib/SynthesizerV2.js`
  - code blocks and tables are treated as **atomic chunks**
  - the final coherence pass prompt instructs the model to preserve Markdown structure exactly

## Testing

A minimal test script is provided:

- `server/astroxai/tests/format_intent.test.js`

Run:

```bash
node server/astroxai/tests/format_intent.test.js
```

Test cases:

- Differentiate flora and fauna in table
- Explain photosynthesis in steps
- Show population growth chart
- Give Python code example
- List advantages and disadvantages
