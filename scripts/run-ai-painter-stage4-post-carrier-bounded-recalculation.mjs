import { runPostCarrierBoundedCandidateRecalculation } from "./lib/ai-painter-stage4-post-carrier-bounded-recalculation-v1.mjs";

const runId = process.argv.includes("--run-id") ? process.argv[process.argv.indexOf("--run-id") + 1] : `stage4-post-carrier-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
const result = runPostCarrierBoundedCandidateRecalculation({ runId });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

