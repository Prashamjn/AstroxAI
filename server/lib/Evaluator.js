import OpenAI from "openai";

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

export function computeOverallScore({ relevance, accuracy, clarity, userPref }) {
  // Weighted: relevance 35%, accuracy 35%, clarity 20%, userPref 10%
  const r = clamp01(relevance);
  const a = clamp01(accuracy);
  const c = clamp01(clarity);
  const u = clamp01(userPref);
  if (r == null || a == null || c == null) return null;
  const up = u == null ? 0.5 : u;
  return 0.35 * r + 0.35 * a + 0.2 * c + 0.1 * up;
}

export function buildEvalPrompt({ query, response }) {
  return [
    {
      role: "system",
      content:
        'You are an AI evaluator. Score the following response on relevance, accuracy, clarity, and usefulness from 0 to 1. Output JSON only.\n\nReturn format (JSON only): {"relevance":0-1,"accuracy":0-1,"clarity":0-1,"usefulness":0-1,"notes":"short"}',
    },
    {
      role: "user",
      content: `USER QUERY:\n${String(query || "").slice(0, 4000)}\n\nASSISTANT RESPONSE:\n${String(response || "").slice(0, 8000)}`,
    },
  ];
}

function getEvaluatorApiKey() {
  return (
    process.env.OPENROUTER_API_KEY_EVALUATOR ||
    process.env.OPENROUTER_API_KEY_ARCEE ||
    process.env.OPENROUTER_API_KEY
  );
}

export async function evaluateResponse({ query, response }) {
  const apiKey = getEvaluatorApiKey();
  const model = process.env.EVALUATOR_MODEL || "arcee-ai/trinity-large-preview:free";
  if (!apiKey) {
    return { relevance: null, accuracy: null, clarity: null, usefulness: null, notes: "no_api_key" };
  }

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const messages = buildEvalPrompt({ query, response });

  try {
    const completion = await openrouter.chat.completions.create({
      model,
      messages,
      max_tokens: 220,
      temperature: 0.0,
    });

    const text = String(completion.choices?.[0]?.message?.content || "").trim();

    // Extract JSON (defensive)
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonText = start >= 0 && end >= 0 ? text.slice(start, end + 1) : "{}";
    const parsed = JSON.parse(jsonText);

    const relevance = clamp01(parsed.relevance);
    const accuracy = clamp01(parsed.accuracy);
    const clarity = clamp01(parsed.clarity);
    const usefulness = clamp01(parsed.usefulness);

    return {
      relevance,
      accuracy,
      clarity,
      usefulness,
      notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 500) : "",
    };
  } catch (e) {
    console.warn("[Evaluator] eval failed:", e.message);
    return { relevance: null, accuracy: null, clarity: null, usefulness: null, notes: "eval_failed" };
  }
}
