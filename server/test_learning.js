import { initLearningDB, insertAgentScore, upsertAgentStats, getAgentStats, getSimilarInteractionsByEmbedding } from "./lib/LearningDB.js";
import { embedText } from "./lib/Embeddings.js";
import { evaluateResponse, computeOverallScore } from "./lib/Evaluator.js";
import { selectAgentEmbeddingPlusBandit } from "./lib/AdaptiveRouter.js";
import { runSelfReflection } from "./lib/SelfReflect.js";

async function runDemo() {
  await initLearningDB();
  console.log("[Demo] DB initialized.");

  // Simulate a few interactions
  const interactions = [
    { agent: "solar", query: "How do I reverse a linked list in Python?", response: "Here's a clean implementation..." },
    { agent: "qwen", query: "Explique la révolution française en français", response: "La Révolution française..." },
    { agent: "liquid", query: "Why is the sky blue? Explain step by step.", response: "The sky appears blue due to..." },
    { agent: "arcee", query: "What's the capital of Mongolia?", response: "The capital of Mongolia is Ulaanbaatar." },
  ];

  for (const { agent, query, response } of interactions) {
    const evalResult = await evaluateResponse({ query, response });
    const overall = computeOverallScore(evalResult);
    const qEmb = await embedText(query);
    const rEmb = await embedText(response);

    await insertAgentScore({
      userId: "demo_user",
      agentName: agent,
      query,
      response,
      relevance: evalResult.relevance,
      accuracy: evalResult.accuracy,
      clarity: evalResult.clarity,
      userPref: evalResult.usefulness,
      overallScore: overall,
      queryEmbedding: qEmb,
      responseEmbedding: rEmb,
    });

    await upsertAgentStats(agent, overall);
    console.log(`[Demo] Stored interaction for ${agent}, overall=${overall?.toFixed(3)}`);
  }

  console.log("\n[Demo] Agent stats:");
  console.table(getAgentStats());

  console.log("\n[Demo] Routing a new query via embedding+bandit...");
  const newQuery = "Write a Python function to sort a list of numbers.";
  const route = await selectAgentEmbeddingPlusBandit({
    userText: newQuery,
    metaRouterFallback: async () => "arcee",
  });
  console.log(`[Demo] Routed to: ${route.agentId} (reason=${route.reason})`);

  console.log("\n[Demo] Running self-reflection...");
  await runSelfReflection();

  console.log("\n[Demo] Demo complete.");
}

runDemo().catch((e) => {
  console.error("[Demo] Error:", e);
  process.exit(1);
});
