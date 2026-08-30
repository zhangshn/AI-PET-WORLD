import assert from "node:assert/strict"

import {
  CAPABILITY_VERSION,
  DECISION,
  NEXT_LEGAL_ACTION,
  SOURCE_RUN_ID,
  adjudicateJointTransportSmokeTrainingCoverage,
  deriveJointTransportTwentyFourEpochFullDataScreenContract,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-smoke-training-coverage-adjudication-v1.mjs"

const SAMPLE_ID =
  "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const sha = (digit) => digit.repeat(64)
const clone = (value) => JSON.parse(JSON.stringify(value))

function fixture() {
  const bindings = Object.fromEntries([
    "terminal", "manifest", "machineReview", "lateStability",
    "trainingManifest", "activeConfig", "fullDataReferenceManifest",
    "formalStage0Manifest",
  ].map((role, index) => [role, { path: `${role}.json`, sha256: sha(String(index + 1)) }]))
  const activeConfig = {
    architectureVersion: "joint-condition-local-transport-denoiser-v1",
    denoiserArchitecture: CAPABILITY_VERSION,
    executionIdentity: { runId: SOURCE_RUN_ID },
    jointConditionLocalTransportContract: {
      architectureId: CAPABILITY_VERSION, capabilityVersion: CAPABILITY_VERSION,
      conditionChannels: 23, latentChannels: 12, timeEmbeddingChannels: 256,
      siteCount: 12, parameterTensorCount: 24, parameterCount: 22464,
      objectiveReviewAlignmentClaimed: false,
    },
    evidenceBindings: {
      approvedDataset: { splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 } },
      formalObjectiveContract: { path: "formal-objective.json", sha256: sha("a") },
    },
    training: {
      stage4JointConditionLocalTransportSmokeContract: {
        sampleId: SAMPLE_ID, sampleSplit: "validation", seed: 20263722,
        epochCount: 30, optimizerStepCount: 30, denoiserCheckpointPath: null,
        denoiserCheckpointReadAllowed: false, historicalCheckpointAllowed: false,
        failedCheckpointAllowed: false, automaticTrainingRetryAllowed: false,
        formalMachineReviewRemainsAuthoritative: true,
      },
      localAiCapabilityTicket: { runId: SOURCE_RUN_ID },
    },
  }
  return {
    bindingsVerified: true,
    bindings,
    terminal: {
      schemaVersion: "ai-painter-autonomous-closed-loop-terminal-v1",
      status: "failed_closed", failureCode: "joint_transport_smoke_real_visual_failure",
      ownerAuthorizationRequired: false, ownerResponseRequired: false,
    },
    manifest: {
      status: "real_visual_failure", runId: SOURCE_RUN_ID,
      capabilityVersion: CAPABILITY_VERSION, stage0Started: false,
      trainingRetryStarted: false, trainingManifest: bindings.trainingManifest,
      machineReviewTimeline: bindings.machineReview,
      lateStabilityQualification: bindings.lateStability,
    },
    machineReview: {
      status: "machine_reviews_failed", runId: SOURCE_RUN_ID,
      completedReviewCount: 5, targetReviewCount: 5,
      previewPassCount: 0, previewFailCount: 5,
      reviewThresholdsChanged: false,
      machineReviewResultsUsedAsTrainingTarget: false,
      failedPreviewPixelsUsedAsTrainingTarget: false,
    },
    lateStability: {
      status: "real_visual_failure", runId: SOURCE_RUN_ID, qualified: false,
      thresholdsChanged: false, trainingRetryAllowed: false,
    },
    activeConfig,
    trainingManifest: {
      status: "stage4_joint_condition_local_transport_controlled_smoke_training_completed_awaiting_automatic_machine_review",
      seed: 20263722, singleSampleOverfitSmoke: { sampleId: SAMPLE_ID },
      trainingTokenAccounting: { runTotals: {
        epochCount: 30, trainingSamplePresentations: 30, optimizerSteps: 30,
      } },
      timestepCoverage: {
        samplingContract: "deterministic_full_schedule_cover_v2",
        diffusionStepCount: 1000, trainingPresentationCount: 30,
        uniqueTrainingTimestepCount: 30, coverageRatio: 0.03,
        minimumTimestep: 635, maximumTimestep: 722,
        inferenceTimestepCount: 50, exactInferenceOverlapCount: 0,
        fullScheduleCovered: false,
      },
    },
    fullDataReferenceManifest: {
      seed: 20263722,
      splitMetrics: { train: { sampleCount: 48 }, validation: { sampleCount: 8 } },
      trainingTokenAccounting: { runTotals: {
        epochCount: 24, trainingSamplePresentations: 1152, optimizerSteps: 1152,
      } },
      timestepCoverage: {
        diffusionStepCount: 1000, trainingPresentationCount: 1152,
        uniqueTrainingTimestepCount: 1000, coverageRatio: 1,
        minimumTimestep: 0, maximumTimestep: 999,
        inferenceTimestepCount: 50, exactInferenceOverlapCount: 50,
        fullScheduleCovered: true,
      },
    },
    formalStage0Manifest: {
      splitMetrics: { train: { sampleCount: 48 }, validation: { sampleCount: 8 } },
      trainingTokenAccounting: { runTotals: { epochCount: 40, optimizerSteps: 5760 } },
      timestepCoverage: {
        diffusionStepCount: 1000, uniqueTrainingTimestepCount: 1000,
        exactInferenceOverlapCount: 50, fullScheduleCovered: true,
      },
    },
    executionBoundary: { checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false },
  }
}

const positives = []
const negatives = []
const exact = fixture()
const decision = adjudicateJointTransportSmokeTrainingCoverage(exact)
assert.equal(decision.status, "uniquely_adjudicated")
assert.equal(decision.decision, DECISION)
assert.equal(decision.candidateRejected, false)
assert.equal(decision.sameThirtyStepSmokeRerunAllowed, false)
assert.equal(decision.nextLegalAction, NEXT_LEGAL_ACTION)
positives.push("exact_immutable_coverage_evidence_yields_only_legal_decision")

const contract = deriveJointTransportTwentyFourEpochFullDataScreenContract(exact)
assert.equal(contract.status, "cpu_compiled_inactive_not_authorized_for_gpu_or_training")
assert.equal(contract.fixedExecutionIdentity.optimizerStepCount, 1152)
assert.equal(contract.fixedExecutionIdentity.requiredUniqueTrainingTimestepCount, 1000)
assert.equal(contract.fixedExecutionIdentity.requiredExactInferenceOverlapCount, 50)
assert.equal(contract.retryBoundary.sameThirtyStepSmokeRerunAllowed, false)
assert.equal(Object.values(contract.activationGates).every((value) => value === false), true)
positives.push("inactive_full_data_contract_is_frozen_and_not_activated")

const cases = [
  ["binding_count_change_fails", (x) => { delete x.bindings.terminal }],
  ["unverified_binding_fails", (x) => { x.bindingsVerified = false }],
  ["terminal_failure_identity_change_fails", (x) => { x.terminal.failureCode = "other" }],
  ["review_threshold_change_fails", (x) => { x.machineReview.reviewThresholdsChanged = true }],
  ["review_as_training_target_fails", (x) => { x.machineReview.machineReviewResultsUsedAsTrainingTarget = true }],
  ["retry_claim_fails", (x) => { x.lateStability.trainingRetryAllowed = true }],
  ["model_identity_change_fails", (x) => { x.activeConfig.denoiserArchitecture = "old" }],
  ["transport_site_change_fails", (x) => { x.activeConfig.jointConditionLocalTransportContract.siteCount = 11 }],
  ["smoke_step_change_fails", (x) => { x.trainingManifest.trainingTokenAccounting.runTotals.optimizerSteps = 31 }],
  ["smoke_coverage_change_fails", (x) => { x.trainingManifest.timestepCoverage.uniqueTrainingTimestepCount = 31 }],
  ["smoke_range_change_fails", (x) => { x.trainingManifest.timestepCoverage.minimumTimestep = 0 }],
  ["smoke_overlap_change_fails", (x) => { x.trainingManifest.timestepCoverage.exactInferenceOverlapCount = 1 }],
  ["full_data_steps_change_fails", (x) => { x.fullDataReferenceManifest.trainingTokenAccounting.runTotals.optimizerSteps = 1151 }],
  ["full_data_schedule_change_fails", (x) => { x.fullDataReferenceManifest.timestepCoverage.uniqueTrainingTimestepCount = 999 }],
  ["formal_stage0_steps_change_fails", (x) => { x.formalStage0Manifest.trainingTokenAccounting.runTotals.optimizerSteps = 5759 }],
  ["manifest_cross_binding_change_fails", (x) => { x.manifest.trainingManifest.sha256 = sha("f") }],
  ["checkpoint_read_fails", (x) => { x.executionBoundary.checkpointWeightsRead = true }],
  ["gpu_started_fails", (x) => { x.executionBoundary.gpuStarted = true }],
]
for (const [name, mutate] of cases) {
  const input = clone(exact)
  mutate(input)
  const result = adjudicateJointTransportSmokeTrainingCoverage(input)
  assert.equal(result.status, "failed_closed_evidence_mismatch", name)
  assert.equal(result.decision, "pause_evidence_mismatch", name)
  assert.equal(result.candidateRejected, false, name)
  assert.equal(
    deriveJointTransportTwentyFourEpochFullDataScreenContract(input).status,
    "ineligible_evidence_mismatch",
    name,
  )
  negatives.push(name)
}

process.stdout.write(`${JSON.stringify({
  schemaVersion:
    "stage4-joint-condition-local-transport-smoke-training-coverage-cpu-checker-v1",
  status: "passed",
  decision: DECISION,
  nextLegalAction: NEXT_LEGAL_ACTION,
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
  executionBoundary: {
    checkpointWeightsRead: false, gpuStarted: false, optimizerCreated: false,
    backwardExecuted: false, modelWeightsModified: false, trainingStarted: false,
  },
}, null, 2)}\n`)
