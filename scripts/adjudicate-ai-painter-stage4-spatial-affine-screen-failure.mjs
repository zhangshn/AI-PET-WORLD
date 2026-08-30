import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_RUN_ID = "spatial-affine-screen-20260828164219346-ad821831"
const CAPABILITY = "stage4_multiscale_spatial_affine_conditioned_decoder_v1"
const ARCHITECTURE_VERSION = "multiscale-spatial-affine-conditioned-decoder-v1"
const SOURCE_ROOT = resolve(`.runtime/ai-painter/stage4-spatial-affine-full-data-screens/${SOURCE_RUN_ID}`)
const EXECUTION_ROOT = resolve(`.runtime/ai-painter/stage4-spatial-affine-full-data-screen-executions/${SOURCE_RUN_ID}`)
const GPU_QUALIFICATION_TERMINAL = resolve(
  ".runtime/ai-painter/stage4-spatial-affine-readonly-gpu-qualifications/spatial-affine-readonly-gpu-20260828-220359931-aa11eff0/phase-terminal.json",
)
const RUN_ID = `spatial-affine-screen-causal-adjudication-${compactUtc()}-01`
const OUTPUT_ROOT = resolve(`.runtime/ai-painter/stage4-spatial-affine-screen-causal-adjudications/${RUN_ID}`)
const PROBLEM_REPORT = path.join(OUTPUT_ROOT, "problem-report.json")
const CAUSAL_ANALYSIS = path.join(OUTPUT_ROOT, "causal-analysis.json")
const DECISION = path.join(OUTPUT_ROOT, "unique-decision.json")
const ROUTE_EXIT = path.join(OUTPUT_ROOT, "candidate-route-exit.json")
const TERMINAL = path.join(OUTPUT_ROOT, "phase-terminal.json")
const CAPSULE = path.join(OUTPUT_ROOT, "local-task-capsule.json")

const sourceTerminalPath = path.join(SOURCE_ROOT, "phase-terminal.json")
const manifestPath = path.join(SOURCE_ROOT, "manifest.json")
const reviewPath = path.join(SOURCE_ROOT, "machine-review.json")
const lateQualificationPath = path.join(SOURCE_ROOT, "late-stability-qualification.json")
const executionStatePath = path.join(EXECUTION_ROOT, "execution-state.json")
const reviewProgressPath = path.join(SOURCE_ROOT, "review-progress.json")
const trainingProgressPath = path.join(SOURCE_ROOT, "progress.json")

assert.equal(fs.existsSync(OUTPUT_ROOT), false, "causal adjudication output reuse is forbidden")
for (const file of [
  sourceTerminalPath,
  manifestPath,
  reviewPath,
  lateQualificationPath,
  executionStatePath,
  reviewProgressPath,
  trainingProgressPath,
  GPU_QUALIFICATION_TERMINAL,
]) {
  assert.equal(fs.existsSync(file), true, `required evidence missing: ${projectPath(file)}`)
}

const sourceTerminal = readJson(sourceTerminalPath)
const manifest = readJson(manifestPath)
const review = readJson(reviewPath)
const lateQualification = readJson(lateQualificationPath)
const executionState = readJson(executionStatePath)
const gpuQualification = readJson(GPU_QUALIFICATION_TERMINAL)

assert.equal(sourceTerminal.executionState, "completed")
assert.equal(sourceTerminal.status, "stage4_spatial_affine_full_data_screen_real_visual_failure")
assert.equal(sourceTerminal.runId, SOURCE_RUN_ID)
verifyBinding(sourceTerminal.manifest, manifestPath, "manifest")
verifyBinding(sourceTerminal.machineReview, reviewPath, "machine review")
verifyBinding(sourceTerminal.lateStabilityQualification, lateQualificationPath, "late qualification")
assert.equal(executionState.executionState, "completed")
assert.equal(executionState.activeRole, "completed")
assert.equal(executionState.runId, SOURCE_RUN_ID)

assert.equal(manifest.architectureVersion, ARCHITECTURE_VERSION)
assert.equal(manifest.actualLoadedConditionalSampleCount, 64)
assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
assert.equal(manifest.denoiserTrained, true)
assert.equal(manifest.modelStateHashEvidence.weightsChanged, true)
assert.equal(manifest.durationSeconds, 2114.803)
assert.equal(manifest.sourceIndexSha256, "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251")
assert.equal(manifest.autoencoderCheckpointSha256, "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba")

assert.equal(review.reviewThresholdsChanged, false)
assert.deepEqual(review.requiredPreviewEpochs, [5, 10, 15, 20, 24])
assert.equal(review.previewCount, 5)
assert.equal(review.previewPassCount, 0)
assert.equal(review.previewFailCount, 5)
const issueTimeline = review.reviews.map((row) => ({
  epoch: row.epoch,
  passed: row.passed,
  failureCount: row.issueCodes.length,
  issueCodes: [...row.issueCodes],
  professionalAestheticPassed: row.professionalAesthetic?.passed === true,
  fixedPreviewByteReproduced: row.fixedPreviewReproducedExactly === true,
}))
assert.deepEqual(issueTimeline.map((row) => row.epoch), [5, 10, 15, 20, 24])
assert.deepEqual(issueTimeline.map((row) => row.failureCount), [8, 7, 6, 7, 6])
assert.ok(issueTimeline.every((row) => row.passed === false))
assert.ok(issueTimeline.every((row) => row.professionalAestheticPassed === true))
assert.ok(issueTimeline.every((row) => row.fixedPreviewByteReproduced === true))
for (const row of issueTimeline) {
  for (const objectClass of ["footprints", "tree", "rock", "vegetation"]) {
    assert.ok(
      row.issueCodes.includes(`condition_object_${objectClass}_reference_semantic_mismatch`),
      `missing persistent object failure: epoch ${row.epoch} ${objectClass}`,
    )
  }
}

assert.equal(lateQualification.status, "screen_late_stability_not_qualified")
assert.equal(lateQualification.qualified, false)
assert.deepEqual(lateQualification.qualificationEpochs, [15, 20, 24])
assert.deepEqual(lateQualification.failureCounts, [6, 7, 6])
assert.equal(lateQualification.noRegression, false)
assert.equal(lateQualification.finalConditionsPass, false)
assert.equal(lateQualification.fixedPreviewByteReproduction, true)
assert.equal(lateQualification.weightsChanged, true)
assert.equal(lateQualification.machineReviewThresholdsChanged, false)
assert.equal(lateQualification.screenCheckpointPromotable, false)
assert.equal(lateQualification.screenCheckpointStage0InitializationEligible, false)

assert.equal(gpuQualification.executionState, "completed")
assert.equal(gpuQualification.status, "stage4_spatial_affine_readonly_gpu_qualification_passed")

const recordedAtUtc = new Date().toISOString()
const recordedAtAsiaShanghai = formatShanghai(recordedAtUtc)
const uniqueDecision =
  "spatial_affine_execution_and_identity_wiring_valid_but_bounded_multisample_semantic_capacity_insufficient"
const nextLegalAction =
  "project_level_model_family_discrimination_required_no_unique_candidate"

fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true })
fs.mkdirSync(OUTPUT_ROOT, { recursive: false })

writeExclusive(PROBLEM_REPORT, {
  schemaVersion: "stage4-spatial-affine-screen-problem-report-v1",
  status: "succeeded",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  sourceRunId: SOURCE_RUN_ID,
  sourceTerminal: bind(sourceTerminalPath),
  facts: {
    fullDataCount: 64,
    splitCounts: manifest.actualLoadedSplitCounts,
    completedEpochs: 24,
    completedOptimizerSteps: 1152,
    trainingDurationSeconds: manifest.durationSeconds,
    requiredReviewEpochs: review.requiredPreviewEpochs,
    failureCounts: issueTimeline.map((row) => row.failureCount),
    lateFailureCounts: lateQualification.failureCounts,
    previewPassCount: review.previewPassCount,
    previewFailCount: review.previewFailCount,
    weightsChanged: manifest.modelStateHashEvidence.weightsChanged,
    fixedPreviewByteReproduction: lateQualification.fixedPreviewByteReproduction,
    thresholdsChanged: review.reviewThresholdsChanged,
  },
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

writeExclusive(CAUSAL_ANALYSIS, {
  schemaVersion: "stage4-spatial-affine-screen-causal-analysis-v1",
  status: "succeeded",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  evidence: {
    sourceTerminal: bind(sourceTerminalPath),
    manifest: bind(manifestPath),
    machineReview: bind(reviewPath),
    lateStabilityQualification: bind(lateQualificationPath),
    readonlyGpuQualification: bind(GPU_QUALIFICATION_TERMINAL),
  },
  findings: {
    executionWiringDefectConfirmed: false,
    dataOrReviewIdentityDefectConfirmed: false,
    checkpointOrTerminalIdentityDefectConfirmed: false,
    boundedMultisampleSemanticCapacityInsufficientConfirmed: true,
    trainingWasEffectiveButInsufficient: true,
    persistentFailureBoundary: [
      "object_footprints_reference_semantic_structure",
      "object_tree_reference_semantic_structure",
      "object_rock_reference_semantic_structure",
      "object_vegetation_reference_semantic_structure",
    ],
    evidenceExplanation: [
      "Readonly GPU qualification proved all eight affine tensors had finite nonzero gradients and all 23 condition channels reached the output path.",
      "The formal 64-record 48/8/4/4 screen changed model weights and improved water semantics, so the candidate executed and learned.",
      "All five immutable previews reproduced byte-for-byte and reused the frozen review contract, excluding a review or terminal identity false failure.",
      "All four object reference-semantic failures persisted at every review node and the late failure sequence 6->7->6 did not converge.",
    ],
    nextArchitectureUniquelyDerivable: false,
    nonUniqueStructuralAxesStillOpen: [
      "whole_backbone_spatial_affine_modulation",
      "final_output_condition_modulation",
      "per_class_isolated_semantic_representation",
    ],
  },
  uniqueDecision,
  nextLegalAction,
  forbidden: [
    "repeat_same_candidate_training",
    "reuse_screen_or_failed_checkpoint",
    "lower_machine_review_thresholds",
    "use_failed_preview_pixels_or_review_results_as_training_targets",
    "choose_a_new_architecture_axis_without_unique_formal_evidence",
  ],
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

writeExclusive(DECISION, {
  schemaVersion: "stage4-spatial-affine-screen-unique-decision-v1",
  status: "succeeded",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  decision: uniqueDecision,
  candidateLifecycleDisposition: "rejected_failed_closed",
  stage0Qualified: false,
  stage0Started: false,
  currentFixedProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction,
  automaticTrainingContinuationAllowed: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

writeExclusive(ROUTE_EXIT, {
  schemaVersion: "stage4-spatial-affine-candidate-route-exit-v1",
  status: "candidate_rejected_failed_closed",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  sourceDecision: bind(DECISION),
  reason: "bounded_full_data_screen_proved_real_visual_semantic_failure_without_a_wiring_or_identity_defect",
  prohibitedReuse: {
    rerunSameCandidate: true,
    checkpointInitialization: true,
    checkpointPromotion: true,
    renamedEquivalentCandidate: true,
  },
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

writeExclusive(TERMINAL, {
  schemaVersion: "stage4-spatial-affine-screen-causal-adjudication-terminal-v1",
  executionState: "completed",
  status: "stage4_spatial_affine_screen_causal_adjudication_succeeded_candidate_rejected",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  problemReport: bind(PROBLEM_REPORT),
  causalAnalysis: bind(CAUSAL_ANALYSIS),
  uniqueDecision: bind(DECISION),
  candidateRouteExit: bind(ROUTE_EXIT),
  nextLegalAction,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

writeExclusive(CAPSULE, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  currentStage: { number: 4, total: 5, labelZh: "空间仿射候选全量筛选因果收口", status: "completed" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  uniqueDecision,
  latestBlocker: "no_unique_evidence_derived_successor_architecture",
  nextAllowedAction: {
    code: nextLegalAction,
    ownerAuthorizationRequired: false,
    automaticTrainingAllowed: false,
  },
  evidence: [PROBLEM_REPORT, CAUSAL_ANALYSIS, DECISION, ROUTE_EXIT, TERMINAL].map((file) => ({
    ...bind(file),
    sha256Verified: true,
  })),
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
    migrationRegistryStatus: "current_execution_registry_pending_atomic_advance",
  },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

const previous = await readCurrentExecutionRegistry(ROOT)
assert.equal(previous.ok, true, previous.errorCode)
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: nextLegalAction,
  taskKind: "project_level_model_family_discrimination",
  runId: RUN_ID,
  lifecycleStage: "change_candidate_rejected",
  executionState: "completed",
  activity: "failed_closed",
  taskCapsulePath: projectPath(CAPSULE),
  terminalEvidencePath: projectPath(TERMINAL),
  latestTrainingTerminal: {
    runId: SOURCE_RUN_ID,
    path: projectPath(sourceTerminalPath),
    sha256: sha256(sourceTerminalPath),
    status: sourceTerminal.status,
    evidence: {
      executionState: bind(executionStatePath),
      machineReview: bind(reviewPath),
      reviewProgress: bind(reviewProgressPath),
      trainingProgress: bind(trainingProgressPath),
    },
  },
  expectedPreviousRegistryRevision: previous.registry.registryRevision,
  expectedPreviousRegistrySha256: previous.registrySha256,
})
assert.equal(advanced.ok, true, advanced.errorCode)

appendAiPainterProgramEvent({
  id: `stage4-spatial-affine-screen-causal-adjudication-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_spatial_affine_screen_failure_causally_adjudicated",
  runId: RUN_ID,
  kind: "cpu_readonly_analysis",
  status: "success",
  title: "Spatial-affine Stage4 screen failure causally adjudicated",
  titleZh: "空间仿射Stage4全量筛选失败已完成因果裁决",
  detailZh: "执行、数据、复现和审核身份有效；全量24 Epoch晚期失败数6→7→6，四类对象语义持续失败。候选已拒绝，Stage 0未启动，当前没有可由证据唯一派生的新结构。",
  evidencePath: projectPath(TERMINAL),
  evidenceSha256: sha256(TERMINAL),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

process.stdout.write(`${JSON.stringify({
  status: "stage4_spatial_affine_screen_causal_adjudication_succeeded_candidate_rejected",
  runId: RUN_ID,
  sourceRunId: SOURCE_RUN_ID,
  uniqueDecision,
  nextLegalAction,
  terminal: bind(TERMINAL),
  currentRegistryRevision: advanced.registry.registryRevision,
  currentRegistrySha256: advanced.registrySha256,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
}, null, 2)}\n`)

function resolve(relative) {
  const candidate = path.resolve(ROOT, relative)
  assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`)
  return candidate
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function bind(file) {
  return { path: projectPath(file), sha256: sha256(file) }
}

function verifyBinding(binding, file, label) {
  assert.equal(binding?.path, projectPath(file), `${label} path mismatch`)
  assert.equal(binding?.sha256, sha256(file), `${label} SHA-256 mismatch`)
}

function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

function compactUtc() {
  return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)
}
