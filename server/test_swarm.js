import "dotenv/config";
import { initLearningDB, getRecentCollabRuns } from "./lib/LearningDB.js";
import { runCollaboration } from "./lib/Collaboration.js";

async function main() {
  await initLearningDB();

  const messagesToSend = [
    { role: "user", content: "Explain the difference between JWT and session cookies. Keep it concise." },
  ];

  const result = await runCollaboration({
    agentsToUse: ["arcee", "solar", "qwen"],
    messagesToSend,
    systemPromptOverride: "",
    langInstruction: "Respond only in English.",
  });

  console.log("Agents used:", result.agentsUsed);
  console.log("Final answer length:", (result.finalAnswer || "").length);

  const recent = getRecentCollabRuns(5);
  console.log("Recent collab runs:", recent);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
