import OpenAI from "openai";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

export function getEmbeddingApiKey() {
  // Prefer a dedicated key, fall back to the Arcee key if set.
  return (
    process.env.OPENROUTER_API_KEY_EMBEDDINGS ||
    process.env.OPENROUTER_API_KEY_ARCEE ||
    process.env.OPENROUTER_API_KEY
  );
}

export async function embedText(text) {
  const apiKey = getEmbeddingApiKey();
  if (!apiKey) return null;

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const input = String(text || "").slice(0, 4000);

  try {
    const res = await openrouter.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
    });
    const vec = res.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length === 0) return null;
    return vec;
  } catch (e) {
    console.warn("[Embeddings] embedding failed:", e.message);
    return null;
  }
}
