import assert from "node:assert/strict"
import {
  buildFullBackboneSpatialAffineControlledSmokeContract,
  REQUIRED_SOURCE_EVIDENCE_ROLES,
  validateFullBackboneSpatialAffineControlledSmokeContract,
} from "./lib/ai-painter-stage4-full-backbone-spatial-affine-smoke-contract-v1.mjs"

const HASH = "a".repeat(64)
const evidence = REQUIRED_SOURCE_EVIDENCE_ROLES.map((role) => ({
  role,
  path: `.runtime/ai-painter/evidence/${role}.json`,
  sha256: HASH,
}))

const create = () => buildFullBackboneSpatialAffineControlledSmokeContract({
  compilationRunId: "stage4-full-backbone-spatial-affine-smoke-contract-20260829-051500000-a1b2c3d4",
  reservedSmokeRunId: "stage4-full-backbone-spatial-affine-controlled-smoke-20260829-051500001-a1b2c3d4",
  sourceEvidence: structuredClone(evidence),
})

const contract = create()
validateFullBackboneSpatialAffineControlledSmokeContract(contract)
const positiveChecks = {
  identity: contract.architectureId === "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
  sample194: contract.executionIdentity.sampleId.includes("slot-194"),
  validationSplit: contract.executionIdentity.sampleSplit === "validation",
  fixedSeed: contract.executionIdentity.seed === 20263722,
  westTopology: contract.executionIdentity.topology === "west",
  stage0Resolution: contract.executionIdentity.resolution.width === 256 && contract.executionIdentity.resolution.height === 192,
  latentResolution: contract.executionIdentity.latentResolution.width === 64 && contract.executionIdentity.latentResolution.height === 48,
  epochs: contract.executionIdentity.epochCount === 30,
  previewNodes: JSON.stringify(contract.executionIdentity.previewEpochs) === JSON.stringify([1, 5, 10, 20, 30]),
  fixedInitialization: contract.executionIdentity.initialization === "fixed_random_denoiser_initialization_without_checkpoint",
  frozenData: JSON.stringify(contract.frozenBoundaries.splitCounts) === JSON.stringify({ train: 48, validation: 8, challenge: 4, regression: 4 }),
  channelCount: contract.modelBoundary.conditionChannelOrder.length === 23,
  fullBackboneBlocks: contract.modelBoundary.fullBackboneSpatialAffine.blockIds.length === 6,
  projectionCount: contract.modelBoundary.fullBackboneSpatialAffine.projectionCount === 12,
  parameterTensorCount: contract.modelBoundary.fullBackboneSpatialAffine.parameterTensorCount === 24,
  parameterCount: contract.modelBoundary.fullBackboneSpatialAffine.parameterCount === 745472,
  existingObjective: contract.modelBoundary.existingDiffusionObjectivePreserved,
  frozenAutoencoder: contract.executionIdentity.autoencoderFrozen,
  closedLoopReview: contract.closedLoop.includes("automatic_machine_review"),
  closedLoopTerminal: contract.closedLoop.includes("terminal_recording"),
  localInternalTicket: contract.internalCapability.ownerAuthorizationRequired === false,
  noHistoricalInput: contract.evidenceIsolation.historicalCheckpointAccepted === false,
  trainingOutputOwnedByTrainer: contract.outputOwnership.trainerCreatesTrainingOutputExactlyOnce,
  preflightDoesNotCreateTrainingOutput: contract.outputOwnership.preflightMustNotCreateTrainingOutput,
  noTrainingRetry: contract.prohibited.includes("automatic_training_retry"),
  noStage0InsidePackage: contract.nextActionMapping.stage0AutomaticStartInsideSmokePackage === false,
}
assert.equal(Object.values(positiveChecks).every(Boolean), true)

const negativeChecks = {
  rejectSampleChange: rejects((value) => { value.executionIdentity.sampleId = "other" }),
  rejectSplitChange: rejects((value) => { value.executionIdentity.sampleSplit = "train" }),
  rejectSeedChange: rejects((value) => { value.executionIdentity.seed += 1 }),
  rejectTopologyChange: rejects((value) => { value.executionIdentity.topology = "east" }),
  rejectEpochChange: rejects((value) => { value.executionIdentity.epochCount = 29 }),
  rejectPreviewChange: rejects((value) => { value.executionIdentity.previewEpochs = [1, 10, 30] }),
  rejectResolutionChange: rejects((value) => { value.executionIdentity.resolution.width = 512 }),
  rejectInitializationChange: rejects((value) => { value.executionIdentity.initialization = "historical_checkpoint" }),
  rejectChannelCount: rejects((value) => { value.modelBoundary.conditionChannels = 22 }),
  rejectChannelOrder: rejects((value) => { [value.modelBoundary.conditionChannelOrder[0], value.modelBoundary.conditionChannelOrder[1]] = [value.modelBoundary.conditionChannelOrder[1], value.modelBoundary.conditionChannelOrder[0]] }),
  rejectWidthChange: rejects((value) => { value.modelBoundary.widths[1] = 192 }),
  rejectTimeEmbeddingChange: rejects((value) => { value.modelBoundary.timeEmbeddingChannels = 128 }),
  rejectBlockOmission: rejects((value) => { value.modelBoundary.fullBackboneSpatialAffine.blockIds.pop() }),
  rejectProjectionCount: rejects((value) => { value.modelBoundary.fullBackboneSpatialAffine.projectionCount = 10 }),
  rejectParameterTensorCount: rejects((value) => { value.modelBoundary.fullBackboneSpatialAffine.parameterTensorCount = 20 }),
  rejectParameterCount: rejects((value) => { value.modelBoundary.fullBackboneSpatialAffine.parameterCount += 1 }),
  rejectLossChange: rejects((value) => { value.frozenBoundaries.lossValuesAndWeightsUnchanged = false }),
  rejectReviewTarget: rejects((value) => { value.frozenBoundaries.machineReviewResultsUsedAsTrainingTarget = true }),
  rejectHistoricalCheckpoint: rejects((value) => { value.evidenceIsolation.historicalCheckpointAccepted = true }),
  rejectCrossCapabilityArtifact: rejects((value) => { value.evidenceIsolation.crossCapabilityArtifactAccepted = true }),
  rejectMissingEvidence: rejects((value) => { value.sourceEvidence.pop() }),
  rejectDuplicateRole: rejects((value) => { value.sourceEvidence[1].role = value.sourceEvidence[0].role }),
  rejectAbsolutePath: rejects((value) => { value.sourceEvidence[0].path = "C:\\external\\evidence.json" }),
  rejectPathEscape: rejects((value) => { value.sourceEvidence[0].path = "../evidence.json" }),
  rejectHashForgery: rejects((value) => { value.sourceEvidence[0].sha256 = "not-a-hash" }),
  rejectOutputReuse: rejects((value) => { value.futureEvidenceNamespace.outputDirectory = ".runtime/ai-painter/old-smoke" }),
  rejectPreflightTrainingOutputCreation: rejects((value) => { value.outputOwnership.preflightMustNotCreateTrainingOutput = false }),
  rejectTrainerOwnershipChange: rejects((value) => { value.outputOwnership.trainerCreatesTrainingOutputExactlyOnce = false }),
  rejectAutomaticTrainingRetry: rejects((value) => { value.prohibited = value.prohibited.filter((item) => item !== "automatic_training_retry") }),
  rejectStage0InsidePackage: rejects((value) => { value.nextActionMapping.stage0AutomaticStartInsideSmokePackage = true }),
  rejectOwnerWait: rejects((value) => { value.internalCapability.ownerAuthorizationRequired = true }),
  rejectSecondTrainingRun: rejects((value) => { value.recoveryBoundary.automaticSecondTrainingRunAllowed = true }),
}
assert.equal(Object.values(negativeChecks).every(Boolean), true)

process.stdout.write(`${JSON.stringify({
  status: "stage4_full_backbone_spatial_affine_smoke_contract_cpu_passed",
  positiveChecks,
  negativeChecks,
  positiveCount: Object.keys(positiveChecks).length,
  negativeCount: Object.keys(negativeChecks).length,
  trainingStarted: false,
  gpuStarted: false,
}, null, 2)}\n`)

function rejects(mutator) {
  const value = create()
  mutator(value)
  try {
    validateFullBackboneSpatialAffineControlledSmokeContract(value)
    return false
  } catch {
    return true
  }
}
