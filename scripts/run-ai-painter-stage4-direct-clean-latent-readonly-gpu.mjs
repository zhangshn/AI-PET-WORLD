import { runDirectCleanLatentReadonlyGpuQualification } from "./lib/ai-painter-stage4-direct-clean-latent-readonly-gpu-v1.mjs";

const runId = process.argv[2];
if (!runId) throw new Error("usage: node scripts/run-ai-painter-stage4-direct-clean-latent-readonly-gpu.mjs <runId>");
const result = await runDirectCleanLatentReadonlyGpuQualification({ runId });
console.log(JSON.stringify(result, null, 2));
