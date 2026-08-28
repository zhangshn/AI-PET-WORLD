import {
  materializeDirectCleanLatentArchitectureDerivation,
  recordDirectCleanLatentMaterializationFailure,
} from "./lib/ai-painter-stage4-direct-clean-latent-architecture-derivation-v1.mjs";

const runId = process.argv[2];
try {
  const result = await materializeDirectCleanLatentArchitectureDerivation({ runId });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const errorCode = error instanceof Error ? error.message : "unknown_materialization_failure";
  let recorded = null;
  try {
    recorded = recordDirectCleanLatentMaterializationFailure({ runId, errorCode });
  } catch {
    // A failure before the output namespace exists cannot be recorded there.
  }
  console.error(JSON.stringify({ status: "failed_closed", errorCode, recorded }, null, 2));
  process.exitCode = 1;
}
