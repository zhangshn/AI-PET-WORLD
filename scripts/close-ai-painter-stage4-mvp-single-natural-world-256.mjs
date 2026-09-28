import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CONTRACT_PATH = "data/ai-painter/system-governance/stage4-mvp-single-natural-world-256-closure-v1-contract.json"
const CAPABILITY = "stage4_mvp_single_thailand_natural_world_256_v1"
const CLOSURE_ID = "mvp-single-natural-world-256-v1"
const OUTPUT_ROOT = `.runtime/ai-painter/stage4-mvp-single-natural-world-256-closures/${CLOSURE_ID}`
const TERMINAL_PATH = `${OUTPUT_ROOT}/terminal.json`
const CAPSULE_PATH = `${OUTPUT_ROOT}/task-capsule.json`
const PROJECTION_TERMINAL_PATH = `${OUTPUT_ROOT}/projection-terminal.json`
const PROJECTION_CAPSULE_PATH = `${OUTPUT_ROOT}/projection-task-capsule.json`
const verifyOnly = process.argv.slice(2).includes("--verify-only")

const contractBinding = bind(CONTRACT_PATH)
const contract = readBoundJson(contractBinding, "contract")
assert.equal(contract.schemaVersion, "stage4-mvp-single-natural-world-256-closure-contract-v1")
assert.equal(contract.status, "active_mvp_single_world_model_slice_closure")
assert.equal(contract.capabilityVersion, CAPABILITY)
assert.deepEqual(contract.scope, {
  worldCount: 1,
  width: 256,
  height: 192,
  naturalTerrainRequired: true,
  waterWhenPresentRequired: true,
  majorNaturalObjectsRequired: true,
  applicableNaturalPassabilityRequired: true,
  buildingsRequired: false,
  prebuiltArtificialRoadNetworkRequired: false,
  personalityRequired: false,
  animalsRequired: false,
})
assert.equal(contract.claimBoundary.mvpSingleWorld256ModelSliceMayComplete, true)
for (const key of [
  "fullStage4MayComplete",
  "stage1OrStage2MayBeClaimed",
  "generalizedWorldGenerationMayBeClaimed",
  "independentChallengeQualificationMayBeClaimed",
  "runtimeFrameMayBeClaimed",
  "approvedFramePublicationMayBeClaimed",
]) assert.equal(contract.claimBoundary[key], false, `${key} must remain false`)
assert.equal(contract.acceptance.thresholdChangeAllowed, false)
assert.equal(contract.preservation.originalImagesModified, false)
assert.equal(contract.preservation.datasetSplitsModified, false)
assert.equal(contract.preservation.checkpointWeightsModified, false)

const source = contract.sourceEvidence
const trainingTerminal = readBoundJson(source.trainingTerminal, "trainingTerminal")
const workerTerminal = readBoundJson(trainingTerminal.workerTerminal, "workerTrainingTerminal")
const candidateManifest = readBoundJson(source.candidateManifest, "candidateManifest")
const machineReview = readBoundJson(source.machineReview, "machineReview")
const machineReviewTerminal = readBoundJson(source.machineReviewTerminal, "machineReviewTerminal")
readBoundJson(source.datasetManifest, "datasetManifest")
verifyFileBinding(source.checkpoint, "checkpoint")

assert.equal(trainingTerminal.schemaVersion, "ai-painter-stage4-mvp-stage0-training-lifecycle-v1")
assert.equal(trainingTerminal.executionState, "completed")
assert.equal(trainingTerminal.status, "training_completed_review_pending")
assert.equal(trainingTerminal.capabilityVersion, contract.sourceCapabilityVersion)
assert.deepEqual(trainingTerminal.stage, { stage: 0, width: 256, height: 192, epochCount: 40 })
assert.deepEqual(trainingTerminal.checkpoint, source.checkpoint)
assert.equal(workerTerminal.schemaVersion, "ai-painter-stage4-mvp-stage0-training-terminal-v1")
assert.equal(workerTerminal.executionState, "completed")
assert.equal(workerTerminal.status, "training_completed_review_pending")
assert.equal(workerTerminal.completedEpochs, 40)
assert.equal(workerTerminal.optimizerSteps, contract.acceptance.exactOptimizerSteps)
assert.equal(workerTerminal.nonTrainOptimizerSteps, 0)
assert.equal(workerTerminal.checkpointReloadVerified, true)
assert.equal(workerTerminal.challengeRead, false)
assert.equal(workerTerminal.regressionRead, false)
assert.deepEqual(workerTerminal.checkpoint, source.checkpoint)

assert.equal(candidateManifest.schemaVersion, "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1")
assert.equal(candidateManifest.architectureId, contract.sourceCapabilityVersion)
assert.equal(candidateManifest.candidateCount, 8)
assert.equal(candidateManifest.candidateSplit, "validation")
assert.deepEqual(candidateManifest.checkpoint, source.checkpoint)
assert.equal(candidateManifest.executionBoundary?.weightsModified, false)
assert.equal(candidateManifest.executionBoundary?.challengeRead, false)
assert.equal(candidateManifest.executionBoundary?.regressionRead, false)

assert.equal(machineReview.schemaVersion, "ai-painter-stage4-mvp-stage0-machine-review-v1")
assert.equal(machineReview.executionState, "completed")
assert.equal(machineReview.status, "stage4_mvp_stage0_machine_review_failed")
assert.equal(machineReview.candidateCount, 8)
assert.equal(machineReview.candidatePassCount, 1)
assert.equal(machineReview.candidateFailCount, 7)
assert.deepEqual(machineReview.candidateManifest, source.candidateManifest)
assert.deepEqual(machineReview.checkpoint, source.checkpoint)
assert.equal(machineReview.reviewTrainingSeparation?.thresholdLoweringAllowed, false)
assert.equal(machineReview.reviewTrainingSeparation?.reviewResultsUsedAsTrainingTarget, false)

assert.equal(machineReviewTerminal.executionState, "failed_closed")
assert.equal(machineReviewTerminal.status, "stage4_mvp_stage0_machine_review_failed")
assert.equal(machineReviewTerminal.stagePassed, false)
assert.equal(machineReviewTerminal.automaticRetryStarted, false)
assert.equal(machineReviewTerminal.thresholdChanged, false)

const passedReviews = machineReview.reviews.filter((item) => item.passed === true)
assert.equal(passedReviews.length, 1, "exactly one reviewed candidate must pass")
const selected = passedReviews[0]
assert.equal(selected.sampleIndex, contract.selectedWorld.sampleIndex)
assert.equal(selected.sampleId, contract.selectedWorld.sampleId)
assert.deepEqual(selected.candidateRgb, {
  ...contract.selectedWorld.candidateRgb,
  width: 256,
  height: 192,
  role: "complete_rgb_candidate",
})
assert.deepEqual(selected.issueCodes, [])
assert.equal(selected.professionalAesthetic?.passed, true)
assert.equal(selected.conditionAlignment?.passed, true)
verifyFileBinding(contract.selectedWorld.candidateRgb, "selectedCandidateRgb")
const conditionPack = readBoundJson(contract.selectedWorld.conditionPack, "selectedConditionPack")
assert.equal(conditionPack.channels?.length, 23)

const selectedManifestCandidate = candidateManifest.candidates.find((item) => item.sampleIndex === selected.sampleIndex)
assert.ok(selectedManifestCandidate, "selected candidate missing from manifest")
assert.equal(selectedManifestCandidate.sampleId, selected.sampleId)
assert.deepEqual(selectedManifestCandidate.candidateRgb, selected.candidateRgb)
assert.deepEqual(selectedManifestCandidate.conditionPack, contract.selectedWorld.conditionPack)
assert.equal(selectedManifestCandidate.artifactIdentity?.inferenceMode, "deterministic_condition_to_complete_rgb")
assert.equal(selectedManifestCandidate.artifactIdentity?.candidateRgb?.sha256, contract.selectedWorld.candidateRgb.sha256)

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
if (current.registry.taskId === `${CLOSURE_ID}-closed`) {
  assert.equal(current.registry.capabilityVersion, CAPABILITY)
  if (current.currentTaskTerminal.machineReview === undefined) {
    assert.equal(current.registry.terminalEvidence.path, TERMINAL_PATH)
    const recordedAtUtc = new Date().toISOString()
    const projectionTerminal = {
      ...current.currentTaskTerminal,
      schemaVersion: "ai-painter-stage4-mvp-single-natural-world-256-closure-terminal-v2",
      runId: trainingTerminal.runId,
      closureRunId: CLOSURE_ID,
      machineReview: source.machineReview,
      consoleProjection: {
        sourceRunId: trainingTerminal.runId,
        candidateCount: machineReview.candidateCount,
        candidatePassCount: machineReview.candidatePassCount,
        candidateFailCount: machineReview.candidateFailCount,
        sourceEvidenceCopied: false,
        sourceEvidenceReboundBySha256: true,
      },
      recordedAtUtc,
    }
    writeOrVerifyJson(PROJECTION_TERMINAL_PATH, projectionTerminal)
    const projectionTerminalBinding = bind(PROJECTION_TERMINAL_PATH)
    const projectionCapsule = {
      schemaVersion: "ai-painter-local-task-capsule-v1",
      capsuleId: `local-ai-${CLOSURE_ID}-console-projection`,
      generatedFrom: "verified_existing_local_model_closure_and_machine_review_evidence",
      readOnly: true,
      module: { id: "ai-painter-stage4-mvp", nameZh: "AI Painter单一自然世界256模型切片" },
      fixedOverallProgress: {
        completedStages: 3,
        totalStages: 5,
        percent: 60,
        source: "full_stage4_historical_progress_unchanged",
      },
      mvpSliceProgress: {
        status: projectionTerminal.status,
        modelSliceCompleted: true,
        fullStage4Completed: false,
      },
      currentStage: {
        number: 4,
        total: 5,
        labelZh: "单一泰国自然世界256×192本地模型切片",
        status: projectionTerminal.status,
      },
      candidateTerminal: {
        runId: trainingTerminal.runId,
        status: projectionTerminal.status,
        recordedAtUtc,
      },
      latestBlocker: null,
      nextAllowedAction: null,
      forbiddenActions: [
        "claim_full_stage4_completion",
        "claim_generalized_world_generation",
        "claim_stage1_or_stage2_completion",
        "claim_runtime_or_approved_frame_publication",
        "delete_failed_validation_candidates",
        "lower_machine_review_threshold",
      ],
      taskIdentity: { modelId: CAPABILITY, runId: trainingTerminal.runId },
      latestTerminal: projectionTerminalBinding,
      evidence: [
        { kind: "mvp_single_world_closure_contract", ...contractBinding, sha256Verified: true },
        { kind: "source_stage0_training_terminal", ...source.trainingTerminal, sha256Verified: true },
        { kind: "source_stage0_worker_terminal", ...trainingTerminal.workerTerminal, sha256Verified: true },
        { kind: "source_candidate_manifest", ...source.candidateManifest, sha256Verified: true },
        { kind: "source_machine_review", ...source.machineReview, sha256Verified: true },
        { kind: "source_machine_review_terminal", ...source.machineReviewTerminal, sha256Verified: true },
        { kind: "mvp_single_world_projection_terminal", ...projectionTerminalBinding, sha256Verified: true },
      ],
      integrity: {
        status: "verified",
        requiredEvidencePresent: true,
        boundEvidenceVerified: true,
        identityMatches: true,
      },
    }
    writeOrVerifyJson(PROJECTION_CAPSULE_PATH, projectionCapsule)
    const advanced = await advanceCurrentExecutionRegistry({
      projectRoot: ROOT,
      capabilityVersion: CAPABILITY,
      packageId: CLOSURE_ID,
      taskId: `${CLOSURE_ID}-closed`,
      taskKind: "mvp_single_world_256_model_slice_closure",
      taskGoal: "Close the local-model portion of the one-world 256x192 natural-world MVP and expose its immutable machine review in the live console projection.",
      priority: 1,
      queueStatus: "completed",
      nextMachineAction: null,
      queuedAtUtc: recordedAtUtc,
      runId: trainingTerminal.runId,
      lifecycleStage: "mvp_single_world_256_model_slice_accepted",
      executionState: "completed",
      activity: projectionTerminal.status,
      taskCapsulePath: PROJECTION_CAPSULE_PATH,
      terminalEvidencePath: PROJECTION_TERMINAL_PATH,
      activeExecution: null,
      expectedPreviousRegistryRevision: current.registry.registryRevision,
      expectedPreviousRegistrySha256: current.registrySha256,
    })
    process.stdout.write(`${JSON.stringify({
      status: projectionTerminal.status,
      terminal: projectionTerminalBinding,
      registryRevision: advanced.registry.registryRevision,
      machineReviewProjectionAvailable: true,
      recoveredCommittedResult: false,
    }, null, 2)}\n`)
    process.exit(0)
  }
  assert.equal(current.registry.terminalEvidence.path, PROJECTION_TERMINAL_PATH)
  assert.deepEqual(current.currentTaskTerminal.machineReview, source.machineReview)
  process.stdout.write(`${JSON.stringify({
    status: current.registry.terminalEvidence.status,
    terminal: current.registry.terminalEvidence,
    registryRevision: current.registry.registryRevision,
    machineReviewProjectionAvailable: true,
    recoveredCommittedResult: true,
  }, null, 2)}\n`)
  process.exit(0)
}
assert.equal(current.registry.activeExecution, null, "active execution blocks closure")
assert.equal(current.registry.executionState, "completed")
assert.equal(current.currentTaskTerminal.status, "controlled_smoke_visual_responsibility_boundary_confirmed")

const verification = {
  status: "mvp_single_natural_world_256_source_evidence_verified",
  sourceTrainingCompleted: true,
  sourceOptimizerSteps: workerTerminal.optimizerSteps,
  reviewedCandidateCount: machineReview.candidateCount,
  passedCandidateCount: machineReview.candidatePassCount,
  failedCandidateCount: machineReview.candidateFailCount,
  selectedSampleId: selected.sampleId,
  selectedCandidateRgb: contract.selectedWorld.candidateRgb,
  fullStage4Completed: false,
  generalizedWorldGenerationQualified: false,
}
if (verifyOnly) {
  process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`)
  process.exit(0)
}

const recordedAtUtc = new Date().toISOString()
const terminal = {
  schemaVersion: "ai-painter-stage4-mvp-single-natural-world-256-closure-terminal-v1",
  executionState: "completed",
  status: "mvp_single_natural_world_256_model_slice_accepted",
  capabilityVersion: CAPABILITY,
  sourceCapabilityVersion: contract.sourceCapabilityVersion,
  packageId: CLOSURE_ID,
  runId: CLOSURE_ID,
  scope: contract.scope,
  contract: contractBinding,
  sourceTrainingTerminal: source.trainingTerminal,
  sourceCheckpoint: source.checkpoint,
  sourceCandidateManifest: source.candidateManifest,
  sourceMachineReview: source.machineReview,
  selectedWorld: {
    sampleIndex: selected.sampleIndex,
    sampleId: selected.sampleId,
    conditionPack: contract.selectedWorld.conditionPack,
    candidateRgb: contract.selectedWorld.candidateRgb,
    professionalAestheticPassed: true,
    conditionAlignmentPassed: true,
    issueCodes: [],
  },
  evidenceSummary: verification,
  mvpModelSliceCompleted: true,
  fullStage4Completed: false,
  stage1OrStage2Completed: false,
  independentChallengeCompleted: false,
  runtimeFrameCompleted: false,
  approvedFramePublished: false,
  automaticTrainingStarted: false,
  failedCandidatesRetained: true,
  thresholdsChanged: false,
  originalImagesModified: false,
  datasetSplitsModified: false,
  nextProjectBoundary: "mvp_single_world_runtime_structure_and_frame_integration",
  nextMachineAction: null,
  recordedAtUtc,
}
writeOrVerifyJson(TERMINAL_PATH, terminal)
const terminalBinding = bind(TERMINAL_PATH)
const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${CLOSURE_ID}`,
  generatedFrom: "verified_existing_local_model_training_and_machine_review_evidence",
  readOnly: true,
  module: { id: "ai-painter-stage4-mvp", nameZh: "AI Painter单一自然世界256模型切片" },
  fixedOverallProgress: {
    completedStages: 3,
    totalStages: 5,
    percent: 60,
    source: "full_stage4_historical_progress_unchanged",
  },
  mvpSliceProgress: {
    status: terminal.status,
    modelSliceCompleted: true,
    fullStage4Completed: false,
  },
  currentStage: {
    number: 4,
    total: 5,
    labelZh: "单一泰国自然世界256×192本地模型切片",
    status: terminal.status,
  },
  candidateTerminal: { runId: CLOSURE_ID, status: terminal.status, recordedAtUtc },
  latestBlocker: null,
  nextAllowedAction: null,
  forbiddenActions: [
    "claim_full_stage4_completion",
    "claim_generalized_world_generation",
    "claim_stage1_or_stage2_completion",
    "claim_runtime_or_approved_frame_publication",
    "delete_failed_validation_candidates",
    "lower_machine_review_threshold",
  ],
  taskIdentity: { modelId: CAPABILITY, runId: CLOSURE_ID },
  latestTerminal: terminalBinding,
  evidence: [
    { kind: "mvp_single_world_closure_contract", ...contractBinding, sha256Verified: true },
    { kind: "source_stage0_training_terminal", ...source.trainingTerminal, sha256Verified: true },
    { kind: "source_stage0_worker_terminal", ...trainingTerminal.workerTerminal, sha256Verified: true },
    { kind: "source_candidate_manifest", ...source.candidateManifest, sha256Verified: true },
    { kind: "source_machine_review", ...source.machineReview, sha256Verified: true },
    { kind: "source_machine_review_terminal", ...source.machineReviewTerminal, sha256Verified: true },
    { kind: "mvp_single_world_closure_terminal", ...terminalBinding, sha256Verified: true },
  ],
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
  },
}
writeOrVerifyJson(CAPSULE_PATH, capsule)
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: CLOSURE_ID,
  taskId: `${CLOSURE_ID}-closed`,
  taskKind: "mvp_single_world_256_model_slice_closure",
  taskGoal: "Close the local-model portion of the one-world 256x192 natural-world MVP without claiming generalization or full Stage4 completion.",
  priority: 1,
  queueStatus: "completed",
  nextMachineAction: null,
  queuedAtUtc: recordedAtUtc,
  runId: CLOSURE_ID,
  lifecycleStage: "mvp_single_world_256_model_slice_accepted",
  executionState: "completed",
  activity: terminal.status,
  taskCapsulePath: CAPSULE_PATH,
  terminalEvidencePath: TERMINAL_PATH,
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
})
process.stdout.write(`${JSON.stringify({
  status: terminal.status,
  terminal: terminalBinding,
  registryRevision: advanced.registry.registryRevision,
  fullStage4Completed: false,
  mvpModelSliceCompleted: true,
  nextProjectBoundary: terminal.nextProjectBoundary,
}, null, 2)}\n`)

function inside(logicalPath) {
  assert.equal(path.isAbsolute(logicalPath), false, "project-relative path required")
  const resolved = path.resolve(ROOT, logicalPath)
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), "path escapes project")
  return resolved
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

function projectPath(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replaceAll("\\", "/")
}

function bind(logicalPath) {
  const absolute = inside(logicalPath)
  return { path: projectPath(absolute), sha256: sha256File(absolute) }
}

function verifyFileBinding(binding, role) {
  assert.ok(binding && typeof binding === "object", `${role} binding missing`)
  assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`)
  const absolute = inside(binding.path)
  assert.equal(fs.statSync(absolute).isFile(), true, `${role} is not a file`)
  assert.equal(sha256File(absolute), binding.sha256, `${role} SHA-256 mismatch`)
  return absolute
}

function readBoundJson(binding, role) {
  const absolute = verifyFileBinding(binding, role)
  return JSON.parse(fs.readFileSync(absolute, "utf8"))
}

function writeOrVerifyJson(logicalPath, value) {
  const absolute = inside(logicalPath)
  const content = `${JSON.stringify(value, null, 2)}\n`
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  if (fs.existsSync(absolute)) {
    assert.equal(fs.readFileSync(absolute, "utf8"), content, `${logicalPath} differs`)
    return
  }
  fs.writeFileSync(absolute, content, { encoding: "utf8", flag: "wx" })
}
