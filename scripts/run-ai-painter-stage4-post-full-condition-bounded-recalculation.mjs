import { runPostFullConditionBoundedCandidateRecalculation } from "./lib/ai-painter-stage4-post-full-condition-bounded-recalculation-v1.mjs";

const runId = process.argv[2];
const result = await runPostFullConditionBoundedCandidateRecalculation({ runId });
console.log(JSON.stringify(result, null, 2));
