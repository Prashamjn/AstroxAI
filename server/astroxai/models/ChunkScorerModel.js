import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_WEIGHTS_PATH = join(__dirname, "chunk_scorer_weights.json");

let cached = null;
let cachedMtime = null;

function sigmoid(x) {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

export async function loadChunkScorerWeights({ path = DEFAULT_WEIGHTS_PATH, force = false } = {}) {
  if (!force && cached && existsSync(path)) return cached;
  if (!existsSync(path)) {
    cached = null;
    cachedMtime = null;
    return null;
  }
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw);
  cached = parsed;
  cachedMtime = Date.now();
  return parsed;
}

export async function scoreChunkQuality(features, { path = DEFAULT_WEIGHTS_PATH } = {}) {
  const model = await loadChunkScorerWeights({ path, force: false });
  if (!model || !model.weights) return null;

  const w = model.weights;
  const bias = Number(model.bias) || 0;
  let z = bias;
  for (const [k, v] of Object.entries(w)) {
    z += (Number(v) || 0) * (Number(features?.[k]) || 0);
  }
  const p = sigmoid(z);
  // bound to [0, 1]
  return Math.max(0, Math.min(1, p));
}
