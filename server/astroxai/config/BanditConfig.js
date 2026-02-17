import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(__dirname, "bandit_config.yaml");

const DEFAULT_CONFIG = {
  ucb: {
    c: 1.4,
    alpha: 1.0,
    beta: 0.5,
    diversity_bonus: 0.2,
  },
};

let cached = null;
let cachedRaw = null;

function toNum(x, d) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function parseBanditYaml(text) {
  // Minimal YAML parser for the known schema.
  // Expected format:
  // ucb:
  //   c: 1.4
  //   alpha: 1.0
  //   beta: 0.5
  //   diversity_bonus: 0.2
  const out = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, "  "));

  let inUcb = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, "");
    if (!line.trim()) continue;

    if (/^\s*ucb\s*:\s*$/.test(line)) {
      inUcb = true;
      continue;
    }

    if (inUcb) {
      const m = line.match(/^\s{2}([a-zA-Z0-9_]+)\s*:\s*(.+?)\s*$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2];
      if (key === "c") out.ucb.c = toNum(val, out.ucb.c);
      if (key === "alpha") out.ucb.alpha = toNum(val, out.ucb.alpha);
      if (key === "beta") out.ucb.beta = toNum(val, out.ucb.beta);
      if (key === "diversity_bonus") out.ucb.diversity_bonus = toNum(val, out.ucb.diversity_bonus);
    }
  }

  return out;
}

function toBanditYaml(config) {
  const c = config?.ucb?.c ?? DEFAULT_CONFIG.ucb.c;
  const alpha = config?.ucb?.alpha ?? DEFAULT_CONFIG.ucb.alpha;
  const beta = config?.ucb?.beta ?? DEFAULT_CONFIG.ucb.beta;
  const diversityBonus = config?.ucb?.diversity_bonus ?? DEFAULT_CONFIG.ucb.diversity_bonus;
  return `ucb:\n  c: ${c}\n  alpha: ${alpha}\n  beta: ${beta}\n  diversity_bonus: ${diversityBonus}\n`;
}

export async function loadBanditConfig({ force = false } = {}) {
  if (!force && cached) return cached;

  if (!existsSync(CONFIG_PATH)) {
    await mkdir(dirname(CONFIG_PATH), { recursive: true });
    const yaml = toBanditYaml(DEFAULT_CONFIG);
    await writeFile(CONFIG_PATH, yaml, "utf-8");
    cached = DEFAULT_CONFIG;
    cachedRaw = yaml;
    return cached;
  }

  const raw = await readFile(CONFIG_PATH, "utf-8");
  if (!force && cached && cachedRaw === raw) return cached;

  const parsed = parseBanditYaml(raw);
  cached = parsed;
  cachedRaw = raw;
  return parsed;
}

export async function updateBanditConfig(next) {
  const current = await loadBanditConfig({ force: false });
  const merged = {
    ...current,
    ucb: {
      ...current.ucb,
      ...(next?.ucb || {}),
    },
  };

  // Basic validation (avoid NaN/Infinity)
  for (const k of ["c", "alpha", "beta", "diversity_bonus"]) {
    const n = Number(merged.ucb[k]);
    if (!Number.isFinite(n)) throw new Error(`Invalid ucb.${k}`);
    merged.ucb[k] = n;
  }

  const yaml = toBanditYaml(merged);
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, yaml, "utf-8");
  cached = merged;
  cachedRaw = yaml;
  return merged;
}

export async function reloadBanditConfig() {
  return loadBanditConfig({ force: true });
}

export function getCachedBanditConfig() {
  return cached;
}
