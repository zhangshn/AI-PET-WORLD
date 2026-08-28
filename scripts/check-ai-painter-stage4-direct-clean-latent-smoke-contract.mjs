import assert from "node:assert/strict";
import {
  buildDirectCleanLatentControlledSmokeContract,
  validateDirectCleanLatentControlledSmokeContract,
} from "./lib/ai-painter-stage4-direct-clean-latent-smoke-contract-v1.mjs";

const HASH = "a".repeat(64);
const evidence = [
  "readonly-gpu-terminal",
  "readonly-gpu-report",
  "cuda-telemetry",
  "qualified-inactive-config",
  "cpu-support-terminal",
  "source-index",
  "frozen-autoencoder",
  "machine-review-program",
].map((role) => ({ role, path: `.runtime/evidence/${role}.json`, sha256: HASH }));

const create = () => buildDirectCleanLatentControlledSmokeContract({
  compilationRunId: "stage4-direct-clean-latent-smoke-contract-20260827-01",
  reservedSmokeRunId: "stage4-direct-clean-latent-controlled-smoke-20260827-01",
  sourceEvidence: structuredClone(evidence),
});
const positive = {};
const contract = create();
validateDirectCleanLatentControlledSmokeContract(contract);
positive.identity = contract.architecture.endsWith("clean_latent_generator_v1");
positive.sample194 = contract.executionIdentity.sampleId.includes("slot-194");
positive.validationSplit = contract.executionIdentity.sampleSplit === "validation";
positive.seed = contract.executionIdentity.seed === 20263722;
positive.topology = contract.executionIdentity.topology === "west";
positive.resolution = contract.executionIdentity.resolution.width === 256 && contract.executionIdentity.resolution.height === 192;
positive.epochs = contract.executionIdentity.epochCount === 30;
positive.previewNodes = JSON.stringify(contract.executionIdentity.previewEpochs) === JSON.stringify([1, 5, 10, 20, 30]);
positive.fixedInitialization = contract.executionIdentity.initialization === "fixed_random_denoiser_initialization_only";
positive.frozenData = JSON.stringify(contract.frozenBoundaries.splitCounts) === JSON.stringify({ train: 48, validation: 8, challenge: 4, regression: 4 });
positive.frozenAutoencoder = contract.executionIdentity.autoencoderFrozen;
positive.noDiffusionPath = contract.modelBoundary.diffusionRolloutAllowed === false;
positive.closedLoopReview = contract.closedLoop.includes("automatic_machine_review");
positive.closedLoopTerminal = contract.closedLoop.includes("terminal_recording");
positive.localInternalTicket = contract.internalCapability.ownerAuthorizationRequired === false;
positive.noHistoricalInput = contract.evidenceIsolation.historicalCheckpointAccepted === false;
positive.noAutomaticRetry = contract.prohibited.includes("automatic_retry");
positive.noAutomaticStage0 = contract.nextActionMapping.stage0AutomaticStart === false;
assert.equal(Object.values(positive).every(Boolean), true);

const negative = {};
negative.rejectSampleChange = rejects((v) => { v.executionIdentity.sampleId = "other"; });
negative.rejectSplitChange = rejects((v) => { v.executionIdentity.sampleSplit = "train"; });
negative.rejectSeedChange = rejects((v) => { v.executionIdentity.seed += 1; });
negative.rejectEpochChange = rejects((v) => { v.executionIdentity.epochCount = 29; });
negative.rejectPreviewChange = rejects((v) => { v.executionIdentity.previewEpochs = [1, 10, 30]; });
negative.rejectDiffusion = rejects((v) => { v.modelBoundary.diffusionRolloutAllowed = true; });
negative.rejectLossChange = rejects((v) => { v.frozenBoundaries.lossValuesAndWeightsUnchanged = false; });
negative.rejectReviewTarget = rejects((v) => { v.frozenBoundaries.machineReviewResultsUsedAsTrainingTarget = true; });
negative.rejectHistoricalCheckpoint = rejects((v) => { v.evidenceIsolation.historicalCheckpointAccepted = true; });
negative.rejectMissingEvidence = rejects((v) => { v.sourceEvidence.pop(); });
negative.rejectDuplicateRole = rejects((v) => { v.sourceEvidence[1].role = v.sourceEvidence[0].role; });
negative.rejectAbsolutePath = rejects((v) => { v.sourceEvidence[0].path = "C:\\external\\evidence.json"; });
negative.rejectHashForgery = rejects((v) => { v.sourceEvidence[0].sha256 = "not-a-hash"; });
negative.rejectOutputReuse = rejects((v) => { v.futureEvidenceNamespace.outputDirectory = ".runtime/ai-painter/old-smoke"; });
negative.rejectAutomaticRetry = rejects((v) => { v.prohibited = v.prohibited.filter((item) => item !== "automatic_retry"); });
negative.rejectAutomaticStage0 = rejects((v) => { v.nextActionMapping.stage0AutomaticStart = true; });
assert.equal(Object.values(negative).every(Boolean), true);

process.stdout.write(`${JSON.stringify({
  status: "stage4_direct_clean_latent_smoke_contract_cpu_passed",
  positiveChecks: positive,
  negativeChecks: negative,
  contractExecutionIdentity: contract.executionIdentity,
  trainingStarted: false,
  gpuStarted: false,
}, null, 2)}\n`);

function rejects(mutator) {
  const value = create();
  mutator(value);
  try {
    validateDirectCleanLatentControlledSmokeContract(value);
    return false;
  } catch {
    return true;
  }
}
