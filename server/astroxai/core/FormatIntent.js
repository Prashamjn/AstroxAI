import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const KEYWORDS_PATH = join(__dirname, "..", "config", "format_keywords.json");

const PRIORITY = ["code", "table", "chart", "steps", "list", "paragraph"];

let cachedKeywords = null;

async function loadKeywords() {
  if (cachedKeywords) return cachedKeywords;
  if (!existsSync(KEYWORDS_PATH)) {
    cachedKeywords = {};
    return cachedKeywords;
  }
  const raw = await readFile(KEYWORDS_PATH, "utf-8");
  cachedKeywords = JSON.parse(raw);
  return cachedKeywords;
}

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

export async function detectFormatIntent(text) {
  const s = normalize(text);
  const kws = await loadKeywords();

  const hits = {};
  for (const [fmt, words] of Object.entries(kws || {})) {
    for (const w of words || []) {
      const ww = normalize(w);
      if (!ww) continue;
      if (s.includes(ww)) {
        if (!hits[fmt]) hits[fmt] = [];
        hits[fmt].push(ww);
      }
    }
  }

  for (const fmt of PRIORITY) {
    const m = hits[fmt];
    if (Array.isArray(m) && m.length > 0) {
      const conf = 0.7 + Math.min(0.25, 0.05 * m.length);
      return { format: fmt, confidence: conf, matchedKeywords: m };
    }
  }

  if (s.includes("```") || s.includes("code")) return { format: "code", confidence: 0.6, matchedKeywords: ["```"] };
  if (s.includes("table") && s.includes("|")) return { format: "table", confidence: 0.55, matchedKeywords: ["|"] };

  return { format: "paragraph", confidence: 0.3, matchedKeywords: [] };
}

export function buildFormatConstraint(format) {
  const fmt = String(format || "paragraph").toLowerCase();
  if (fmt === "code") return "User requested format: CODE. You MUST output only code in a single fenced code block. Do not include explanations.";
  if (fmt === "table") return "User requested format: TABLE. You MUST output a Markdown table. Do not use paragraphs.";
  if (fmt === "chart") return "User requested format: CHART. You MUST output a JSON dataset (labels + series) followed by a concise explanation. Do not output tables unless asked.";
  if (fmt === "steps") return "User requested format: STEPS. You MUST output numbered steps. Do not use tables.";
  if (fmt === "list") return "User requested format: LIST. You MUST output bullet points only. Do not use tables.";
  if (fmt === "diagram") return "User requested format: DIAGRAM. You MUST output a Mermaid diagram fenced block. Do not add paragraphs outside the diagram.";
  return "";
}

export function clearFormatKeywordsCache() {
  cachedKeywords = null;
}
