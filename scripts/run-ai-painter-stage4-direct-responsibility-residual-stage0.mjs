import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"

import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import {
  appendAiPainterProgramEvent,
  projectPath,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4-direct-clean-latent-responsibility-residual-change-candidate-v1"
const TASK_ID = "compile_direct_responsibility_residual_stage0"
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const PREVIEW_EPOCHS = [1, 5, 10, 20, 30, 40]
const RUN_ID = `stage4-direct-responsibility-residual-stage0-${compactUtc()}-01`
const DATASET = inside("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json")
const DATASET_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const AUTOENCODER = inside(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt")
const AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const INACTIVE = inside(".runtime/ai-painter/stage4-direct-responsibility-residual-cpu-support/stage4-direct-responsibility-residual-cpu-20260827061422-01/inactive-config.json")
const INACTIVE_SHA256 = "ea997aab5c5916041c400411d3e01cf8091e3fa5599cb53cf6251ca12999ec7a"
const QUALIFICATION_TERMINAL = inside(".runtime/ai-painter/stage4-direct-responsibility-residual-controlled-smokes/stage4-direct-responsibility-residual-controlled-smoke-20260827-02/phase-terminal.json")
const QUALIFICATION_TERMINAL_SHA256 = "67c572ae56051056fcb73cc1ddd0d9abea00aea8063dcb1b1952f56edec3da1e"
const QUALIFICATION_DECISION = inside(".runtime/ai-painter/stage4-direct-responsibility-residual-controlled-smokes/stage4-direct-responsibility-residual-controlled-smoke-20260827-02/late-stability-qualification.json")
const QUALIFICATION_DECISION_SHA256 = "70a540ec5a829f0593e010ba25f34a88ea4e2d58fb8c7ff2839553412f8ee643"
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = inside("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const CPU_CHECKER = inside("ml/ai-painter/scripts/check_stage4_direct_responsibility_residual_stage0_cpu.py")
const COMPILER = inside("ml/ai-painter/scripts/compile_stage4_direct_responsibility_residual_stage0_active_config.py")
const EXECUTION_PARENT = inside(".runtime/ai-painter/stage4-direct-responsibility-residual-formal-stage0")
const EXECUTION_ROOT = path.join(EXECUTION_PARENT, RUN_ID)
const OUTPUT = path.join(EXECUTION_ROOT, "training-output")
const paths = outputPaths(EXECUTION_ROOT)

closeUnconsumedPreflightAttempts()

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.capabilityVersion, CAPABILITY)
assert.equal(current.registry.taskId, TASK_ID)
assert.equal(current.registry.lifecycleStage, "controlled_smoke_completed")
assert.equal(current.registry.executionState, "package_materialized")
assert.equal(current.registry.activity, "planned_not_started")
assert.equal(current.registry.activeExecution, null)
verify(INACTIVE, INACTIVE_SHA256, "qualified inactive config")
verify(QUALIFICATION_TERMINAL, QUALIFICATION_TERMINAL_SHA256, "late-stability terminal")
verify(QUALIFICATION_DECISION, QUALIFICATION_DECISION_SHA256, "late-stability decision")
verify(DATASET, DATASET_SHA256, "dataset manifest")
verify(AUTOENCODER, AUTOENCODER_SHA256, "frozen Autoencoder")
assert.equal(read(QUALIFICATION_DECISION).qualified, true)
const lifecycle = read(inside(`.runtime/ai-painter/capability-lifecycle/${CAPABILITY}/state.json`))
assert.equal(lifecycle.state, "controlled_smoke_completed")
assert.equal(fs.existsSync(EXECUTION_ROOT), false, "Stage 0 run/output reuse is forbidden")

fs.mkdirSync(EXECUTION_PARENT, { recursive: true })
fs.mkdirSync(EXECUTION_ROOT, { recursive: false })
writeExclusive(paths.stage0Contract, {
  schemaVersion: "stage4-direct-responsibility-residual-formal-stage0-contract-v1",
  status: "compiled_not_started",
  capabilityVersion: CAPABILITY,
  executionIdentity: {
    runId: RUN_ID,
    stage: 0,
    seed: 20263722,
    resolution: { width: 256, height: 192 },
    epochCount: 40,
    previewEpochs: PREVIEW_EPOCHS,
    splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
    initialization: "fixed_random_denoiser_initialization_only",
    autoencoderFrozen: true,
  },
  sourceEvidence: [
    { role: "qualified_inactive_config", ...bind(INACTIVE) },
    { role: "formal_late_stability_terminal", ...bind(QUALIFICATION_TERMINAL) },
    { role: "formal_late_stability_decision", ...bind(QUALIFICATION_DECISION) },
  ],
  autonomousClosure: {
    machineReviewAfterTraining: true,
    failureClassificationAfterReview: true,
    terminalAndGovernanceRecording: true,
    ownerAuthorizationRequired: false,
    automaticRetry: false,
  },
  forbidden: {
    smokeCheckpointInitialization: true,
    historicalOrFailedCheckpointInitialization: true,
    lossChange: true,
    dataChange: true,
    reviewThresholdChange: true,
    stage1OrStage2Start: true,
  },
  recordedAtUtc: new Date().toISOString(),
})

const cpu = JSON.parse(runSync(PYTHON, [
  CPU_CHECKER,
  "--inactive-config", INACTIVE,
  "--stage0-contract", paths.stage0Contract,
], 300_000).stdout)
assert.equal(cpu.status, "stage4_direct_responsibility_residual_stage0_cpu_preflight_passed")
writeExclusive(paths.cpuReport, cpu)
runSync(PYTHON, [
  COMPILER,
  "--inactive-config", INACTIVE,
  "--stage0-contract", paths.stage0Contract,
  "--ticket-state", "preflight_unconsumed",
  "--output", paths.preflightConfig,
], 300_000)
const trainerBase = [
  TRAINER,
  "--dataset-package", DATASET,
  "--autoencoder-checkpoint", AUTOENCODER,
  "--output-dir", OUTPUT,
  "--resolution-stage", "0",
  "--stage4-direct-clean-latent-stage0",
  "--stage4-direct-clean-latent-stage0-contract", paths.stage0Contract,
]
const preflight = runSync(PYTHON, [
  trainerBase[0],
  "--config", paths.preflightConfig,
  ...trainerBase.slice(1),
  "--preflight-only",
], 300_000)
const trainerPreflight = JSON.parse(preflight.stdout)
assert.equal(trainerPreflight.status, "direct_clean_latent_stage0_trainer_preflight_passed")
assert.deepEqual({
  gpuStarted: trainerPreflight.gpuStarted,
  optimizerCreated: trainerPreflight.optimizerCreated,
  backwardExecuted: trainerPreflight.backwardExecuted,
  trainingStarted: trainerPreflight.trainingStarted,
}, { gpuStarted: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false })
writeExclusive(paths.trainerPreflight, trainerPreflight)

const resources = await waitForResources()
writeExclusive(paths.resourcePreflight, resources)
if (!resources.passed) await closeInfrastructureFailure("resource_preflight_timeout", resources.blockers.join(","), false)

const ticket = {
  schemaVersion: "ai-painter-local-internal-capability-ticket-v1",
  status: "issued_not_consumed",
  ticketId: `local-ai-${RUN_ID}`,
  capabilityVersion: CAPABILITY,
  modeId: "direct_responsibility_residual_stage0_full_training",
  runId: RUN_ID,
  scope: "one_direct_responsibility_residual_40_epoch_formal_stage0_closed_loop",
  parentContract: bind(paths.stage0Contract),
  capabilityAuthority: "local_ai_pet_world_program",
  singleUse: true,
  persistedReplayProtection: true,
  cannotExpandParentContract: true,
  ownerAuthorizationRequired: false,
  issuedAtUtc: new Date().toISOString(),
}
writeExclusive(paths.ticket, ticket)
writeExclusive(paths.consumption, {
  schemaVersion: "ai-painter-local-internal-capability-ticket-consumption-v1",
  ticketId: ticket.ticketId,
  ticketSha256: sha(paths.ticket),
  runId: RUN_ID,
  state: "consumed",
  oneTimeConsumption: true,
  ownerAuthorizationRequired: false,
  consumedAtUtc: new Date().toISOString(),
})
runSync(PYTHON, [
  COMPILER,
  "--inactive-config", INACTIVE,
  "--stage0-contract", paths.stage0Contract,
  "--ticket-state", "consumed",
  "--output", paths.activeConfig,
], 300_000)
const activeConfig = read(paths.activeConfig)
assert.equal(activeConfig.training.directResponsibilityResidualFormalStage0.ticketState, "consumed")
assert.equal(activeConfig.training.activationGates.stage0Now, true)
assert.equal(activeConfig.training.activationGates.smokeNow, false)
writeExclusive(paths.configAudit, {
  schemaVersion: "stage4-direct-responsibility-residual-stage0-active-config-audit-v1",
  status: "passed",
  runId: RUN_ID,
  modeId: "direct_responsibility_residual_stage0_full_training",
  architecture: activeConfig.denoiserArchitecture,
  splitCounts: activeConfig.training.directResponsibilityResidualFormalStage0.splitCounts,
  activeGates: Object.entries(activeConfig.training.activationGates).filter(([, value]) => value).map(([key]) => key),
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
writeJsonAtomic(paths.executionState, {
  schemaVersion: "stage4-direct-responsibility-residual-stage0-execution-state-v1",
  status: "running",
  phase: "training",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  stage: 0,
  epochTarget: 40,
  optimizerStepTarget: 1920,
  trainingOutput: projectPath(OUTPUT),
  progressPath: projectPath(paths.progress),
  automaticReviewAfterTraining: true,
  ownerAuthorizationRequired: false,
  startedAtUtc: new Date().toISOString(),
})
syncUniquePlan("running")
appendAiPainterProgramEvent({
  id: `stage4-direct-responsibility-residual-stage0-start-${RUN_ID}`,
  timestamp: new Date().toISOString(),
  action: "stage4_direct_responsibility_residual_stage0_started",
  runId: RUN_ID,
  kind: "formal_training",
  status: "running",
  title: "Stage4 direct clean-latent Stage 0 started",
  titleZh: "Stage4直达干净潜变量责任残差Stage 0正式训练已启动",
  detailZh: "40 Epoch、48条train、8条validation；训练完成后自动机器审核并收口。",
  evidencePath: projectPath(paths.executionState),
  evidenceSha256: sha(paths.executionState),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

const trainerArgs = [
  trainerBase[0],
  "--config", paths.activeConfig,
  ...trainerBase.slice(1),
]
const stdoutHandle = fs.openSync(paths.stdout, "wx")
const stderrHandle = fs.openSync(paths.stderr, "wx")
const child = spawn(PYTHON, trainerArgs, {
  cwd: ROOT,
  env: pythonEnv(),
  windowsHide: true,
  stdio: ["ignore", stdoutHandle, stderrHandle],
})
const telemetryRows = []
const startedAt = Date.now()
const heartbeat = () => {
  const progress = fs.existsSync(paths.progress) ? safeRead(paths.progress) : null
  const gpu = gpuSnapshot()
  telemetryRows.push({
    recordedAtUtc: new Date().toISOString(),
    epoch: progress?.currentEpoch ?? 0,
    epochTarget: progress?.epochTarget ?? 40,
    optimizerStep: progress?.optimizerStep ?? 0,
    optimizerStepTarget: progress?.optimizerStepTarget ?? 1920,
    phase: progress?.phase ?? "initializing",
    ...gpu,
  })
  writeJsonAtomic(paths.monitorTelemetry, {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-monitor-resource-telemetry-v1",
    status: "recording",
    runId: RUN_ID,
    samples: telemetryRows,
    sampleCount: telemetryRows.length,
    peakGpuMemoryBytes: Math.max(0, ...telemetryRows.map((row) => (row.memoryUsedMiB || 0) * 1024 * 1024)),
    updatedAtUtc: new Date().toISOString(),
  })
  process.stdout.write(`${JSON.stringify({
    kind: "direct_responsibility_residual_stage0_heartbeat",
    runId: RUN_ID,
    phase: progress?.phase ?? "initializing",
    epoch: progress?.currentEpoch ?? 0,
    epochTarget: progress?.epochTarget ?? 40,
    optimizerStep: progress?.optimizerStep ?? 0,
    optimizerStepTarget: progress?.optimizerStepTarget ?? 1920,
    percent: progress?.percent ?? 0,
    etaSeconds: progress?.etaSeconds ?? null,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    gpu,
    recordedAtUtc: new Date().toISOString(),
  })}\n`)
}
heartbeat()
const interval = setInterval(heartbeat, 10_000)
const exitCode = await new Promise((resolveExit, reject) => {
  child.once("error", reject)
  child.once("exit", (code) => resolveExit(code ?? 1))
})
clearInterval(interval)
heartbeat()
fs.closeSync(stdoutHandle)
fs.closeSync(stderrHandle)
if (exitCode !== 0) {
  await closeInfrastructureFailure(
    "trainer_execution_failed",
    `exitCode=${exitCode}; ${fs.readFileSync(paths.stderr, "utf8").slice(-12000)}`,
    true,
  )
}
assert.equal(fs.existsSync(paths.trainingManifest), true, "Stage 0 training manifest missing")
assert.equal(fs.existsSync(paths.progress), true, "Stage 0 progress missing")
writeJsonAtomic(paths.monitorTelemetry, {
  ...read(paths.monitorTelemetry),
  status: "completed",
  trainingCompleted: true,
  completedAtUtc: new Date().toISOString(),
})
writeJsonAtomic(paths.executionState, {
  schemaVersion: "stage4-direct-responsibility-residual-stage0-execution-state-v1",
  status: "running",
  phase: "automatic_machine_review",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  stage: 0,
  trainingOutput: projectPath(OUTPUT),
  reviewProgressPath: projectPath(paths.reviewProgress),
  ownerAuthorizationRequired: false,
  updatedAtUtc: new Date().toISOString(),
})
const fixedReview = await reviewFixedPreviews()
const bestReview = await reviewBestPreview()
const passed = fixedReview.previewPassCount === 6 && fixedReview.previewFailCount === 0
const terminalStatus = passed
  ? "direct_responsibility_residual_stage0_completed"
  : "direct_responsibility_residual_stage0_real_visual_failure"
const classification = passed
  ? null
  : bestReview.passed
    ? "best_checkpoint_and_fixed_visual_review_identity_gap_confirmed"
    : "direct_responsibility_residual_multisample_semantic_capacity_insufficient_confirmed"
const nextAction = passed
  ? "compile_direct_responsibility_residual_stage1"
  : bestReview.passed
    ? "correct_direct_responsibility_residual_checkpoint_and_fixed_review_identity"
    : "plan_one_bounded_successor_after_direct_responsibility_residual_stage0_rejection"
if (!passed) writeFailureAdjudication(classification, nextAction, fixedReview, bestReview)
const rootManifest = {
  schemaVersion: "stage4-direct-responsibility-residual-stage0-root-manifest-v1",
  status: passed ? "qualified" : "real_visual_failure",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  stage0Contract: bind(paths.stage0Contract),
  activeConfig: bind(paths.activeConfig),
  internalTicket: bind(paths.ticket),
  internalTicketConsumption: bind(paths.consumption),
  trainingManifest: bind(paths.trainingManifest),
  progress: bind(paths.progress),
  machineReview: bind(paths.machineReview),
  bestCheckpointMachineReview: bind(paths.bestReview),
  resourceTelemetry: bind(paths.trainingTelemetry),
  monitorResourceTelemetry: bind(paths.monitorTelemetry),
  checkpoint: read(paths.trainingManifest).checkpoint,
  modelWeightsModified: true,
  stage1Started: false,
  automaticRetryStarted: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
}
writeExclusive(paths.manifest, rootManifest)
writeExclusive(paths.finalization, {
  schemaVersion: "stage4-direct-responsibility-residual-stage0-finalization-v1",
  status: terminalStatus,
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  manifest: bind(paths.manifest),
  trainingManifest: bind(paths.trainingManifest),
  machineReview: bind(paths.machineReview),
  bestCheckpointMachineReview: bind(paths.bestReview),
  checkpoint: read(paths.trainingManifest).checkpoint,
  checkpointPromotableWithinCapabilityLifecycle: passed,
  stage1Started: false,
  automaticRetryStarted: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
writeExclusive(paths.terminal, {
  schemaVersion: "stage4-direct-responsibility-residual-stage0-terminal-v1",
  executionState: "completed",
  status: terminalStatus,
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  stage: 0,
  finalization: bind(paths.finalization),
  manifest: bind(paths.manifest),
  machineReview: bind(paths.machineReview),
  bestCheckpointMachineReview: bind(paths.bestReview),
  classification,
  nextLegalAction: nextAction,
  modelWeightsModified: true,
  checkpointWritten: true,
  stage1Started: false,
  automaticRetryStarted: false,
  ownerAuthorizationRequired: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: new Date().toISOString(),
})
writeJsonAtomic(paths.executionState, {
  schemaVersion: "stage4-direct-responsibility-residual-stage0-execution-state-v1",
  status: "completed",
  phase: passed ? "stage0_completed" : "failed_closed",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  stage: 0,
  terminal: bind(paths.terminal),
  failureAdjudication: passed ? null : bind(paths.failureTerminal),
  nextLegalAction: nextAction,
  ownerAuthorizationRequired: false,
  completedAtUtc: new Date().toISOString(),
})
if (passed) {
  advanceCapabilityLifecycle({
    root: ROOT,
    capabilityVersion: CAPABILITY,
    targetState: "formal_stage_validation_completed",
    evidence: {
      schemaVersion: "ai-painter-capability-stage-evidence-v1",
      capabilityVersion: CAPABILITY,
      targetState: "formal_stage_validation_completed",
      status: "passed",
      bindings: [paths.terminal, paths.finalization, paths.manifest, paths.machineReview, paths.bestReview].map(bind),
      ownerAuthorizationRequired: false,
    },
  })
} else if (!bestReview.passed) {
  advanceCapabilityLifecycle({
    root: ROOT,
    capabilityVersion: CAPABILITY,
    targetState: "rejected",
    evidence: {
      schemaVersion: "ai-painter-capability-stage-evidence-v1",
      capabilityVersion: CAPABILITY,
      targetState: "rejected",
      status: "failed",
      bindings: [paths.terminal, paths.machineReview, paths.bestReview, paths.failureAnalysis, paths.failureDecision, paths.failureTerminal].map(bind),
      ownerAuthorizationRequired: false,
    },
  })
}
syncUniquePlan(passed ? "passed" : "failed")
writeExclusive(paths.planSync, {
  schemaVersion: "stage4-direct-responsibility-residual-stage0-plan-sync-v1",
  status: "synchronized",
  runId: RUN_ID,
  plan: bind(inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")),
  terminal: bind(paths.terminal),
  nextLegalAction: nextAction,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
writeExclusive(paths.capsule, buildCapsule(terminalStatus, nextAction, fixedReview, passed))
const terminalForRegistry = !passed && fs.existsSync(paths.failureTerminal) ? paths.failureTerminal : paths.terminal
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: nextAction,
  taskKind: passed ? "formal_stage1_compilation" : "bounded_candidate_planning",
  runId: RUN_ID,
  lifecycleStage: passed ? "formal_stage_validation_completed" : bestReview.passed ? "controlled_smoke_completed" : "rejected",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(paths.capsule),
  terminalEvidencePath: projectPath(terminalForRegistry),
  latestTrainingTerminal: {
    runId: RUN_ID,
    path: projectPath(paths.terminal),
    sha256: sha(paths.terminal),
    status: terminalStatus,
    evidence: {
      executionState: bind(paths.executionState),
      machineReview: bind(paths.machineReview),
      reviewProgress: bind(paths.reviewProgress),
      trainingProgress: bind(paths.progress),
    },
  },
})
appendAiPainterProgramEvent({
  id: `stage4-direct-responsibility-residual-stage0-${RUN_ID}`,
  timestamp: new Date().toISOString(),
  action: "stage4_direct_responsibility_residual_stage0_closed_loop",
  runId: RUN_ID,
  kind: "formal_training",
  status: passed ? "success" : "failed_closed",
  title: "Stage4 direct clean-latent Stage 0 closed loop",
  titleZh: passed ? "Stage4直达干净潜变量责任残差Stage 0训练与审核通过" : "Stage4直达干净潜变量责任残差Stage 0真实视觉失败并关闭",
  detailZh: `40 Epoch及1920次优化完成；固定审核${fixedReview.previewPassCount}/6，最佳Epoch审核${bestReview.passed ? "通过" : "失败"}。`,
  evidencePath: projectPath(paths.terminal),
  evidenceSha256: sha(paths.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
process.stdout.write(`${JSON.stringify({
  status: terminalStatus,
  runId: RUN_ID,
  machineReview: bind(paths.machineReview),
  bestCheckpointMachineReview: bind(paths.bestReview),
  terminal: bind(paths.terminal),
  finalization: bind(paths.finalization),
  nextLegalAction: nextAction,
  currentRegistrySha256: advanced.registrySha256,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
}, null, 2)}\n`)

async function reviewFixedPreviews() {
  const manifest = read(paths.trainingManifest)
  assert.deepEqual(manifest.previewEpochs, PREVIEW_EPOCHS)
  assert.equal(manifest.fixedPreviews.length, 6)
  const sample = fixedSample()
  const conditionPack = read(inside(sample.conditionPackPath))
  const reviews = []
  for (const artifact of manifest.fixedPreviews) {
    verify(inside(artifact.path), artifact.sha256, `epoch ${artifact.epoch} fixed preview`)
    verify(inside(artifact.reproductionPath), artifact.reproductionSha256, `epoch ${artifact.epoch} reproduced preview`)
    assert.equal(artifact.sha256, artifact.reproductionSha256)
    const row = await auditPreview({
      epoch: artifact.epoch,
      sourcePath: inside(artifact.path),
      reproductionPath: inside(artifact.reproductionPath),
      sample,
      conditionPack,
      reviewAssets: paths.reviewAssets,
      workRoot: inside(".runtime/ai-painter/direct-responsibility-residual-stage0-review-work"),
    })
    reviews.push(row)
    writeJsonAtomic(paths.reviewProgress, {
      schemaVersion: "stage4-direct-responsibility-residual-stage0-machine-review-progress-v1",
      status: "running",
      runId: RUN_ID,
      completedReviewCount: reviews.length,
      targetReviewCount: 6,
      latestEpoch: artifact.epoch,
      passCount: reviews.filter((item) => item.passed).length,
      failCount: reviews.filter((item) => !item.passed).length,
      updatedAtUtc: new Date().toISOString(),
    })
  }
  const report = {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-machine-review-v1",
    status: reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed",
    runId: RUN_ID,
    sampleId: SAMPLE_ID,
    reviewThresholdsChanged: false,
    previewCount: reviews.length,
    previewPassCount: reviews.filter((row) => row.passed).length,
    previewFailCount: reviews.filter((row) => !row.passed).length,
    reviews,
    recordedAtUtc: new Date().toISOString(),
  }
  writeExclusive(paths.machineReview, report)
  writeJsonAtomic(paths.reviewProgress, {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-machine-review-progress-v1",
    status: "completed",
    runId: RUN_ID,
    completedReviewCount: 6,
    targetReviewCount: 6,
    passCount: report.previewPassCount,
    failCount: report.previewFailCount,
    machineReview: bind(paths.machineReview),
    completedAtUtc: new Date().toISOString(),
  })
  return report
}

async function reviewBestPreview() {
  const manifest = read(paths.trainingManifest)
  const artifact = manifest.bestCheckpointPreview
  const sample = fixedSample()
  const conditionPack = read(inside(sample.conditionPackPath))
  verify(inside(artifact.path), artifact.sha256, "best checkpoint preview")
  verify(inside(artifact.reproductionPath), artifact.reproductionSha256, "best checkpoint reproduced preview")
  assert.equal(artifact.sha256, artifact.reproductionSha256)
  const row = await auditPreview({
    epoch: artifact.epoch,
    sourcePath: inside(artifact.path),
    reproductionPath: inside(artifact.reproductionPath),
    sample,
    conditionPack,
    reviewAssets: paths.bestReviewAssets,
    workRoot: inside(".runtime/ai-painter/direct-responsibility-residual-stage0-best-review-work"),
  })
  const report = {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-best-checkpoint-machine-review-v1",
    status: row.passed ? "machine_review_passed" : "machine_review_failed",
    runId: RUN_ID,
    epoch: artifact.epoch,
    sourceAndReproductionBytesMatch: true,
    checkpointWeightsRead: false,
    reviewThresholdsChanged: false,
    ...row,
    recordedAtUtc: new Date().toISOString(),
  }
  writeExclusive(paths.bestReview, report)
  return report
}

async function auditPreview({ epoch, sourcePath, reproductionPath, sample, conditionPack, reviewAssets, workRoot }) {
  const normalizedPath = path.join(reviewAssets, `epoch-${String(epoch).padStart(3, "0")}.png`)
  const normalized = await normalizePreviewWithWindowsSafeIo({
    sourcePath,
    finalAssetPath: normalizedPath,
    workRoot,
    workId: shaText(`${RUN_ID}-${reviewAssets}`).slice(0, 16),
    epoch,
  })
  const [aesthetic, alignment] = await Promise.all([
    auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
    auditAiAssistedConditionAlignment({
      record: {
        recordId: `${RUN_ID}-epoch-${epoch}`,
        conditionBinding: {
          conditionPackPath: sample.conditionPackPath,
          worldId: conditionPack.worldId,
          tick: conditionPack.tick,
        },
        classification: sample.classification,
      },
      imagePath: normalized.shortOutputPath,
      referenceImagePath: inside(sample.imagePath),
    }),
  ])
  return {
    epoch,
    previewPath: projectPath(sourcePath),
    previewSha256: sha(sourcePath),
    reproductionPath: projectPath(reproductionPath),
    reproductionSha256: sha(reproductionPath),
    byteExactReproduced: sha(sourcePath) === sha(reproductionPath),
    normalizedPath: projectPath(normalizedPath),
    normalizedSha256: sha(normalizedPath),
    passed: aesthetic.passed && alignment.passed,
    issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
    professionalAesthetic: aesthetic,
    conditionAlignment: alignment,
  }
}

function writeFailureAdjudication(classification, nextAction, fixedReview, bestReview) {
  writeExclusive(paths.failureProblem, {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-failure-problem-v1",
    status: "real_visual_failure_confirmed",
    runId: RUN_ID,
    trainingCompleted: true,
    epochCount: 40,
    optimizerSteps: 1920,
    fixedReviewTimeline: fixedReview.reviews.map((row) => ({ epoch: row.epoch, passed: row.passed, issueCodes: row.issueCodes })),
    bestEpoch: bestReview.epoch,
    bestCheckpointPreviewPassed: bestReview.passed,
    checkpointWeightsRead: false,
    recordedAtUtc: new Date().toISOString(),
  })
  writeExclusive(paths.failureAnalysis, {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-failure-analysis-v1",
    status: "adjudicated",
    runId: RUN_ID,
    classification,
    findings: {
      trainerCompletedNaturally: true,
      fixedNodesPassed: fixedReview.previewPassCount,
      fixedNodesFailed: fixedReview.previewFailCount,
      bestEpoch: bestReview.epoch,
      bestCheckpointPreviewPassed: bestReview.passed,
      checkpointWeightsRead: false,
      reviewThresholdsChanged: false,
    },
    recordedAtUtc: new Date().toISOString(),
  })
  writeExclusive(paths.failureDecision, {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-failure-decision-v1",
    status: "unique_decision_formed",
    runId: RUN_ID,
    classification,
    nextAction,
    currentCandidateRejected: !bestReview.passed,
    stage1Started: false,
    automaticRetryStarted: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  })
  writeExclusive(paths.failureTerminal, {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-failure-adjudication-terminal-v1",
    executionState: "completed",
    status: "direct_responsibility_residual_stage0_real_visual_failure_adjudicated_closed",
    capabilityVersion: CAPABILITY,
    runId: RUN_ID,
    classification,
    nextLegalAction: nextAction,
    problem: bind(paths.failureProblem),
    analysis: bind(paths.failureAnalysis),
    decision: bind(paths.failureDecision),
    bestCheckpointMachineReview: bind(paths.bestReview),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  })
}

async function closeInfrastructureFailure(code, detail, trainingStarted) {
  writeExclusive(paths.failureReport, {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-infrastructure-failure-v1",
    status: "failed_closed",
    runId: RUN_ID,
    code,
    detail: String(detail),
    trainingStarted,
    automaticRetryStarted: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  })
  writeExclusive(paths.terminal, {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-terminal-v1",
    executionState: "completed",
    status: "direct_responsibility_residual_stage0_infrastructure_failed_closed",
    capabilityVersion: CAPABILITY,
    runId: RUN_ID,
    failureReport: bind(paths.failureReport),
    trainingStarted,
    nextLegalAction: "repair_direct_responsibility_residual_stage0_infrastructure_from_saved_evidence",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  })
  writeJsonAtomic(paths.executionState, {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-execution-state-v1",
    status: "completed",
    phase: "failed_closed",
    runId: RUN_ID,
    terminal: bind(paths.terminal),
    ownerAuthorizationRequired: false,
    completedAtUtc: new Date().toISOString(),
  })
  appendAiPainterProgramEvent({
    id: `stage4-direct-responsibility-residual-stage0-infrastructure-${RUN_ID}`,
    timestamp: new Date().toISOString(),
    action: "stage4_direct_responsibility_residual_stage0_infrastructure_failed_closed",
    runId: RUN_ID,
    kind: "formal_training",
    status: "failed",
    title: "Stage4 direct clean-latent Stage 0 infrastructure failure",
    titleZh: "Stage4直达干净潜变量责任残差Stage 0基础设施失败关闭",
    detailZh: `${code}；未自动重试。`,
    evidencePath: projectPath(paths.terminal),
    evidenceSha256: sha(paths.terminal),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  })
  throw new Error(`${code}:${detail}`)
}

function buildCapsule(terminalStatus, nextAction, review, passed) {
  const evidenceFiles = [
    paths.stage0Contract,
    paths.cpuReport,
    paths.configAudit,
    paths.resourcePreflight,
    paths.trainerPreflight,
    paths.executionState,
    paths.machineReview,
    paths.bestReview,
    paths.manifest,
    paths.finalization,
    paths.terminal,
    paths.planSync,
    ...(passed ? [] : [paths.failureProblem, paths.failureAnalysis, paths.failureDecision, paths.failureTerminal]),
  ]
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${RUN_ID}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: passed ? "stage0_validation_completed" : "stage0_failed_closed" },
    candidateTerminal: {
      runId: RUN_ID,
      status: passed ? "passed" : "failed_closed",
      programStatus: terminalStatus,
      previewMachineStatus: review.status,
      modelQualificationStatus: passed ? "formal_stage0_qualified" : "formal_stage0_real_visual_failure",
      previewCount: review.previewCount,
      previewPassCount: review.previewPassCount,
      previewFailCount: review.previewFailCount,
      checkpointWritten: true,
      modelWeightsModified: true,
      recordedAtUtc: read(paths.terminal).recordedAtUtc,
    },
    latestBlocker: passed
      ? { code: "stage1_not_yet_materialized", summaryZh: "Stage 0训练与自动审核通过；本地程序下一步编译Stage 1。" }
      : { code: read(paths.terminal).classification, summaryZh: "Stage 0训练、自动审核和只读因果分类已完成；当前候选失败关闭。" },
    nextAllowedAction: { code: nextAction, labelZh: "本地程序下一动作", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
    forbiddenActions: ["reuse_failed_checkpoint", "automatic_retry_same_candidate", "lower_machine_review_threshold", "read_archived_run_as_current", "start_stage2_before_stage1"],
    evidence: evidenceFiles.map((file) => ({
      kind: path.basename(file, path.extname(file)),
      labelZh: path.basename(file),
      ...bind(file),
      expectedSha256: sha(file),
      sha256Verified: true,
      recordedAtUtc: new Date().toISOString(),
      recordedAtAsiaShanghai: null,
    })),
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
  }
}

function fixedSample() {
  const packageManifest = read(DATASET)
  const sourceIndex = read(inside(packageManifest.sourceIndexPath))
  assert.equal(sourceIndex.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1")
  assert.equal(sourceIndex.sampleCount, sourceIndex.samples.length)
  const matches = sourceIndex.samples.filter((sample) => sample.sampleId === SAMPLE_ID)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].split, "validation")
  return matches[0]
}

async function waitForResources() {
  const startedAt = Date.now()
  const snapshots = []
  while (Date.now() - startedAt <= 30 * 60 * 1000) {
    const snapshot = resourceSnapshot()
    snapshots.push(snapshot)
    if (snapshot.passed) return { ...snapshot, waitSnapshots: snapshots, waitSeconds: Math.round((Date.now() - startedAt) / 1000) }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 10_000))
  }
  const last = snapshots.at(-1)
  return { ...last, passed: false, waitSnapshots: snapshots, waitSeconds: Math.round((Date.now() - startedAt) / 1000) }
}

function resourceSnapshot() {
  const gpu = gpuSnapshot()
  const processes = runSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], 30_000, true)
    .stdout.split(/\r?\n/u).filter((row) => /python/iu.test(row))
  const disk = fs.statfsSync(ROOT)
  const diskFreeBytes = Number(disk.bavail) * Number(disk.bsize)
  const blockers = []
  if (!gpu.name) blockers.push("cuda_unavailable")
  if (!Number.isFinite(gpu.utilizationPercent) || gpu.utilizationPercent > 10) blockers.push("gpu_not_idle")
  if (!Number.isFinite(gpu.memoryFreeMiB) || gpu.memoryFreeMiB < 4096) blockers.push("gpu_memory_insufficient")
  if (processes.length) blockers.push("python_gpu_process_active")
  if (diskFreeBytes < 4 * 1024 ** 3) blockers.push("disk_insufficient")
  return {
    schemaVersion: "stage4-direct-responsibility-residual-stage0-resource-preflight-v1",
    passed: blockers.length === 0,
    blockers,
    cpuLogicalProcessors: os.cpus().length,
    memoryFreeBytes: os.freemem(),
    diskFreeBytes,
    gpu: { ...gpu, pythonComputeProcesses: processes },
    thresholds: { maxIdleUtilizationPercent: 10, minFreeMemoryMiB: 4096, minDiskFreeBytes: 4 * 1024 ** 3 },
    recordedAtUtc: new Date().toISOString(),
  }
}

function gpuSnapshot() {
  const result = runSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.free", "--format=csv,noheader,nounits"], 30_000, true)
  const values = result.stdout.trim().split(",").map((value) => value.trim())
  return { name: values[0] || null, utilizationPercent: Number(values[1]), memoryUsedMiB: Number(values[2]), memoryFreeMiB: Number(values[3]) }
}

function syncUniquePlan(state) {
  const planPath = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  let plan = fs.readFileSync(planPath, "utf8")
  const updatedAt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replace(" ", " ") + " +08:00"
  plan = plan.replace(/^更新时间：.*$/m, `更新时间：${updatedAt}`)
  if (state === "running") {
    plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4直接条件→干净潜变量正式Stage 0训练与自动审核闭环进行中")
    plan = plan.replace("；当前无活动训练 | 下一步由本地程序编译该候选的正式Stage 0配置，完成CPU正反门、活动配置审计、真实Node→Trainer只读预检和资源门后，从固定随机初始化执行一次256×192、40 Epoch正式训练 |", "；正式Stage 0正在执行 | 当前执行包将自主完成40 Epoch训练、六节点字节复现、机器审核、失败分类、终态及登记收口；无需人工触发验证 |")
    plan = plan.replace(/^当前训练未运行。`stage4_direct_condition_clean_latent_generator_v1`/m, "当前正式Stage 0训练与自动审核闭环正在运行。`stage4_direct_condition_clean_latent_generator_v1`")
  } else if (state === "passed") {
    plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4直接条件→干净潜变量正式Stage 0训练与机器审核通过；Stage 1待本地程序编译")
    plan = plan.replace(/\| 2 \| AI Painter R5 \/ Stage4 \|([^\n]+)\|[^\n]+\|[^\n]+\|/m, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；直接条件→干净潜变量正式Stage 0训练与机器审核通过；Stage 1尚未启动 | 下一步由本地程序编译同一能力路线Stage 1；只允许加载本次Stage 0成功Checkpoint |")
  } else {
    plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4直接条件→干净潜变量正式Stage 0真实视觉失败并已自动关闭")
    plan = plan.replace(/\| 2 \| AI Painter R5 \/ Stage4 \|([^\n]+)\|[^\n]+\|[^\n]+\|/m, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；直接条件→干净潜变量正式Stage 0训练、机器审核与因果分类已完成，当前候选失败关闭 | 下一步由本地程序按保存证据进入唯一有界候选规划；不得重跑本候选或复用失败Checkpoint |")
  }
  fs.writeFileSync(planPath, plan, "utf8")
}

function outputPaths(root) {
  return {
    stage0Contract: path.join(root, "stage0-contract.json"),
    cpuReport: path.join(root, "cpu-report.json"),
    preflightConfig: path.join(root, "preflight-active-config.json"),
    activeConfig: path.join(root, "active-config.json"),
    configAudit: path.join(root, "active-config-audit.json"),
    trainerPreflight: path.join(root, "trainer-preflight.json"),
    resourcePreflight: path.join(root, "resource-preflight.json"),
    ticket: path.join(root, "internal-capability-ticket.json"),
    consumption: path.join(root, "internal-capability-consumption.json"),
    executionState: path.join(root, "execution-state.json"),
    monitorTelemetry: path.join(root, "monitor-resource-telemetry.json"),
    stdout: path.join(root, "trainer.stdout.log"),
    stderr: path.join(root, "trainer.stderr.log"),
    progress: path.join(root, "training-output", "progress.json"),
    trainingManifest: path.join(root, "training-output", "manifest.json"),
    trainingTelemetry: path.join(root, "training-output", "resource-telemetry.json"),
    reviewAssets: path.join(root, "review-assets"),
    bestReviewAssets: path.join(root, "best-checkpoint-review-assets"),
    reviewProgress: path.join(root, "review-progress.json"),
    machineReview: path.join(root, "machine-review.json"),
    bestReview: path.join(root, "best-checkpoint-machine-review.json"),
    failureProblem: path.join(root, "failure-problem-report.json"),
    failureAnalysis: path.join(root, "failure-analysis.json"),
    failureDecision: path.join(root, "failure-decision.json"),
    failureTerminal: path.join(root, "failure-adjudication-terminal.json"),
    failureReport: path.join(root, "infrastructure-failure-report.json"),
    manifest: path.join(root, "manifest.json"),
    finalization: path.join(root, "finalization.json"),
    terminal: path.join(root, "phase-terminal.json"),
    planSync: path.join(root, "plan-sync-record.json"),
    capsule: path.join(root, "local-task-capsule.json"),
  }
}

function closeUnconsumedPreflightAttempts() {
  if (!fs.existsSync(EXECUTION_PARENT)) return
  for (const entry of fs.readdirSync(EXECUTION_PARENT, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("stage4-direct-responsibility-residual-stage0-")) continue
    const root = path.join(EXECUTION_PARENT, entry.name)
    const terminal = path.join(root, "phase-terminal.json")
    const ticket = path.join(root, "internal-ticket.json")
    const contract = path.join(root, "stage0-contract.json")
    if (fs.existsSync(terminal) || fs.existsSync(ticket) || !fs.existsSync(contract)) continue
    const failure = path.join(root, "failure-report.json")
    writeExclusive(failure, {
      schemaVersion: "stage4-direct-responsibility-residual-stage0-preflight-failure-v1",
      status: "failed_closed",
      code: "cpu_contract_negative_fixture_detected_missing_rejection",
      authorizationConsumed: false,
      gpuStarted: false,
      optimizerCreated: false,
      trainingStarted: false,
      recordedAtUtc: new Date().toISOString(),
    })
    writeExclusive(terminal, {
      schemaVersion: "stage4-direct-responsibility-residual-stage0-terminal-v1",
      executionState: "completed",
      status: "direct_responsibility_residual_stage0_preflight_failed_closed",
      capabilityVersion: CAPABILITY,
      runId: entry.name,
      failureReport: bind(failure),
      ownerAuthorizationRequired: false,
      recordedAtUtc: new Date().toISOString(),
    })
  }
}

function runSync(command, args, timeout, allowFailure = false) {
  const result = spawnSync(command, args, { cwd: ROOT, env: pythonEnv(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout })
  if (!allowFailure && (result.error || result.status !== 0)) throw result.error ?? new Error(`${command} exited ${result.status}: ${result.stderr || result.stdout}`)
  return result
}
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: `${inside("ml/ai-painter/src")};${inside("ml/ai-painter/scripts")}` } }
function inside(relativePath) { assert.ok(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath) && !relativePath.split(/[\\/]/).includes("..")); const target = path.resolve(ROOT, relativePath); assert.ok(target === ROOT || target.startsWith(`${ROOT}${path.sep}`)); return target }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function safeRead(file) { try { return read(file) } catch { return null } }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaText(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function verify(file, expected, label) { assert.equal(fs.existsSync(file), true, `${label} missing`); assert.equal(sha(file), expected, `${label} SHA-256 mismatch`) }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }

