import { getAgentStats, getRecentInteractions } from "./LearningDB.js";
import { evaluateResponse, computeOverallScore } from "./Evaluator.js";
import { fileURLToPath } from "node:url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REFLECTION_INTERVAL = Number(process.env.SELF_REFLECT_INTERVAL) || 100;
const MIN_SAMPLES = 10;

export async function runSelfReflection() {
  console.log("[SelfReflect] Starting periodic analysis...");
  const stats = getAgentStats();
  const recent = getRecentInteractions(500);
  const byAgent = {};
  for (const r of recent) {
    if (!byAgent[r.agentName]) byAgent[r.agentName] = [];
    byAgent[r.agentName].push(r);
  }

  const insights = [];
  for (const [agent, rows] of Object.entries(byAgent)) {
    if (rows.length < MIN_SAMPLES) continue;
    const scores = rows.map((r) => r.overallScore).filter((s) => s != null);
    if (scores.length === 0) continue;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const worst = Math.min(...scores);
    const best = Math.max(...scores);
    insights.push({ agent, samples: scores.length, mean, worst, best });
  }

  const worst = insights
    .filter((i) => i.mean < 0.55)
    .sort((a, b) => a.mean - b.mean)[0];

  if (worst) {
    console.warn(
      `[SelfReflect] Agent ${worst.agent} underperforming (mean=${worst.mean.toFixed(
        2
      )}, n=${worst.samples}). Consider reducing routing weight.`
    );
  }

  const top = insights
    .filter((i) => i.mean > 0.8)
    .sort((a, b) => b.mean - a.mean)[0];

  if (top) {
    console.log(
      `[SelfReflect] Agent ${top.agent} strong (mean=${top.mean.toFixed(
        2
      )}, n=${top.samples}). Consider increasing routing weight.`
    );
  }

  // Optional: generate improvement prompts for worst agent
  if (worst && worst.samples >= 20) {
    const worstRows = byAgent[worst.agent]
      .filter((r) => r.overallScore != null && r.overallScore < 0.5)
      .slice(0, 3);
    if (worstRows.length > 0) {
      const prompt = `Improve ${worst.agent} responses based on these failures:\n${worstRows
        .map((r) => `Q: ${r.query}\nA: ${r.response.slice(0, 300)}`)
        .join("\n\n")}`;
      console.log(`[SelfReflect] Improvement prompt for ${worst.agent}:\n${prompt}`);
    }
  }

  console.log("[SelfReflect] Done.");
}

export function shouldRunReflection(interactionCount) {
  return interactionCount % REFLECTION_INTERVAL === 0;
}
