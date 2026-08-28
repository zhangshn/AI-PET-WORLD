import { materializeDirectCleanLatentCpuSupport } from "./lib/ai-painter-stage4-direct-clean-latent-cpu-support-v1.mjs";

const runId = process.argv[2];
const result = await materializeDirectCleanLatentCpuSupport({ runId });
console.log(JSON.stringify(result, null, 2));
