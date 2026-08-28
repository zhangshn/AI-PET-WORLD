import assert from "node:assert/strict";
import { compileDirectCleanLatentSmokeContract } from "./lib/ai-painter-stage4-direct-clean-latent-smoke-compilation-v1.mjs";

const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const compilationRunId = option("--compilation-run-id");
const reservedSmokeRunId = option("--reserved-smoke-run-id");
assert.match(compilationRunId ?? "", /^stage4-direct-clean-latent-smoke-contract-[a-z0-9-]+$/);
assert.match(reservedSmokeRunId ?? "", /^stage4-direct-clean-latent-controlled-smoke-[a-z0-9-]+$/);
const result = await compileDirectCleanLatentSmokeContract({ compilationRunId, reservedSmokeRunId });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
