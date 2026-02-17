import assert from "node:assert";
import { detectFormatIntent } from "../core/FormatIntent.js";

const cases = [
  ["Differentiate flora and fauna in table", "table"],
  ["Explain photosynthesis in steps", "steps"],
  ["Show population growth chart", "chart"],
  ["Give Python code example", "code"],
  ["List advantages and disadvantages", "list"],
];

for (const [q, expected] of cases) {
  const r = await detectFormatIntent(q);
  assert.equal(r.format, expected, `${q} => ${r.format} (expected ${expected})`);
}

console.log("format_intent tests passed");
