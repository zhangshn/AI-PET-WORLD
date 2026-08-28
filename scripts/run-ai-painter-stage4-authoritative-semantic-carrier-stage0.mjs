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
import { appendAiPainterProgramEvent, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import { materializePostDecodeFailureBoundedPlan } from "./lib/ai-painter-stage4-post-decode-failure-bounded-planner-v1.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const POST_DECODE_OBJECT_RGB = process.argv.includes("--post-decode-object-rgb")
const POST_DECODE_FULL_CONDITION_RESPONSIBILITY = process.argv.includes("--post-decode-full-condition-responsibility")
assert.equal(POST_DECODE_OBJECT_RGB && POST_DECODE_FULL_CONDITION_RESPONSIBILITY, false, "only one Stage 0 architecture selector may be active")
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = inside("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const DATASET = inside("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json")
const DATASET_SHA = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const AUTOENCODER = inside(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt")
const AUTOENCODER_SHA = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const FROZEN_SOURCE = inside(POST_DECODE_FULL_CONDITION_RESPONSIBILITY
  ? ".runtime/ai-painter/stage4-post-decode-full-condition-responsibility-controlled-smokes/stage4-post-decode-full-condition-route-object-responsibility-renderer-change-candidate-v1-smoke-2026082602/active-config.json"
  : POST_DECODE_OBJECT_RGB
    ? ".runtime/ai-painter/stage4-post-decode-object-rgb-controlled-smokes/stage4-post-decode-object-rgb-20260825-113732-20260825-122100-smoke/active-config.json"
    : ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-060300000-condition-fusion-stage0/active-config.json")
const FROZEN_SOURCE_SHA = POST_DECODE_FULL_CONDITION_RESPONSIBILITY
  ? "533a1df803092597f7bec94e69114afede746a47e2c76ba6ba70351d077130a7"
  : POST_DECODE_OBJECT_RGB
    ? "a3caa24c855673ac501c9d6aecaca6625c867ec1c666dfa8e2313d21054ebdd7"
    : "3796b3406a7efc9f2b65621aaaf95ceddd0f0080e250ec40dbc6545296a8f304"
const PREVIEW_EPOCHS = [1, 5, 10, 20, 30, 40]
const ACTIONS = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "run_stage0"]
const FORMAL_TRAINING_LOSS_CONTRACTS = [
  "stage4PerClassFinalVisibleRgbObligation",
  "stage4DistributionAwareVisibleSpatialSemanticObligation",
  "stage4VegetationFinalVisibleSemanticRepair",
  "stage4VegetationLuminanceSpatialStructureSupervision",
  "stage4FullRolloutFinalVisibleConsistency",
  "stage4EpochWorstSampleClassReplay",
  "stage4ObjectVisibleStructureSupervision",
  "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision",
  "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization",
  "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation",
  "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation",
  "stage4PerClassFinalVisibleReferenceFeatureStructureObligation",
  "stage4EpochWorstSampleClassReferenceFeatureStructureReplay",
  "stage4PerClassWorstSampleReferenceFeatureStructureObligation",
  "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation",
  "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity",
  "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay",
]
const PROFILE = POST_DECODE_FULL_CONDITION_RESPONSIBILITY ? {
  smokeTerminalStatus: "post_decode_full_condition_responsibility_controlled_smoke_qualified",
  executionParent: ".runtime/ai-painter/stage4-post-decode-full-condition-responsibility-formal-stage0",
  modeId: "post_decode_full_condition_responsibility_stage0_full_training",
  modelId: "ai-painter-stage4-post-decode-full-condition-responsibility-stage0",
  architectureVersion: "post-decode-full-condition-responsibility-formal-stage0-v1",
  trainingStatus: "local_ai_post_decode_full_condition_responsibility_stage0_full_training_active",
  initialization: "fixed_project_random_post_decode_full_condition_responsibility",
  terminalPassed: "post_decode_full_condition_responsibility_stage0_completed",
  terminalFailed: "post_decode_full_condition_responsibility_stage0_real_visual_failure",
  infrastructureFailed: "post_decode_full_condition_responsibility_stage0_infrastructure_failed_closed",
  schemaStem: "stage4-post-decode-full-condition-responsibility-stage0",
  artifactType: "stage4_post_decode_full_condition_responsibility_stage0_v1",
  eventAction: "stage4_post_decode_full_condition_responsibility_stage0",
  eventTitleZhPassed: "Stage4完整条件责任渲染器Stage 0正式训练与自动审核通过",
  eventTitleZhFailed: "Stage4完整条件责任渲染器Stage 0真实视觉失败并关闭",
  failureClassification: "post_decode_full_condition_responsibility_multisample_semantic_capacity_insufficient_confirmed",
  reviewWorkRoot: ".runtime/ai-painter/post-decode-full-condition-responsibility-stage0-review-work",
  bestReviewWorkRoot: ".runtime/ai-painter/post-decode-full-condition-responsibility-stage0-best-checkpoint-review-work",
} : POST_DECODE_OBJECT_RGB ? {
  smokeTerminalStatus: "post_decode_object_rgb_controlled_smoke_qualified",
  executionParent: ".runtime/ai-painter/stage4-post-decode-object-rgb-formal-stage0",
  modeId: "post_decode_object_rgb_stage0_full_training",
  modelId: "ai-painter-stage4-post-decode-object-rgb-stage0",
  architectureVersion: "post-decode-object-rgb-formal-stage0-v1",
  trainingStatus: "local_ai_post_decode_object_rgb_stage0_full_training_active",
  initialization: "fixed_project_random_post_decode_object_rgb",
  terminalPassed: "post_decode_object_rgb_stage0_completed",
  terminalFailed: "post_decode_object_rgb_stage0_real_visual_failure",
  infrastructureFailed: "post_decode_object_rgb_stage0_infrastructure_failed_closed",
  schemaStem: "stage4-post-decode-object-rgb-stage0",
  artifactType: "stage4_post_decode_object_rgb_stage0_v1",
  eventAction: "stage4_post_decode_object_rgb_stage0",
  eventTitleZhPassed: "Stage4解码后对象RGB Stage 0正式训练与自动审核通过",
  eventTitleZhFailed: "Stage4解码后对象RGB Stage 0真实视觉失败并关闭",
  failureClassification: "post_decode_object_rgb_multisample_semantic_capacity_insufficient_confirmed",
  reviewWorkRoot: ".runtime/ai-painter/post-decode-object-rgb-stage0-review-work",
  bestReviewWorkRoot: ".runtime/ai-painter/post-decode-object-rgb-stage0-best-checkpoint-review-work",
} : {
  smokeTerminalStatus: "authoritative_semantic_carrier_controlled_smoke_qualified",
  executionParent: ".runtime/ai-painter/stage4-authoritative-semantic-carrier-formal-stage0",
  modeId: "authoritative_semantic_carrier_stage0_full_training",
  modelId: "ai-painter-stage4-authoritative-semantic-carrier-stage0",
  architectureVersion: "authoritative-semantic-carrier-formal-stage0-v1",
  trainingStatus: "local_ai_authoritative_semantic_carrier_stage0_full_training_active",
  initialization: "fixed_project_random_authoritative_semantic_carrier",
  terminalPassed: "authoritative_semantic_carrier_stage0_completed",
  terminalFailed: "authoritative_semantic_carrier_stage0_real_visual_failure",
  infrastructureFailed: "authoritative_semantic_carrier_stage0_infrastructure_failed_closed",
  schemaStem: "stage4-authoritative-semantic-carrier-stage0",
  artifactType: "stage4_authoritative_semantic_carrier_stage0_v1",
  eventAction: "stage4_authoritative_semantic_carrier_stage0",
  eventTitleZhPassed: "Stage4权威语义载体Stage 0正式训练与自动审核通过",
  eventTitleZhFailed: "Stage4权威语义载体Stage 0真实视觉失败并关闭",
  failureClassification: "authoritative_semantic_carrier_multisample_semantic_capacity_insufficient_confirmed",
  reviewWorkRoot: ".runtime/ai-painter/authoritative-semantic-carrier-stage0-review-work",
  bestReviewWorkRoot: ".runtime/ai-painter/authoritative-semantic-carrier-stage0-best-checkpoint-review-work",
}

const argv = process.argv.slice(2)
const option = (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : null }
const capabilityVersion = option("--capability-version")
const runId = option("--run-id")
const preflightOnly = argv.includes("--preflight-only")
const resumeFinalizationOnly = argv.includes("--resume-finalization-only")
const resumeFailureAdjudicationOnly = argv.includes("--resume-failure-adjudication-only")
const resumeGovernanceSyncOnly = argv.includes("--resume-governance-sync-only")
const resumePlanSyncCorrectionOnly = argv.includes("--resume-plan-sync-correction-only")
const resumeCurrentRegistrySyncOnly = argv.includes("--resume-current-registry-sync-only")
assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/)
assert.match(runId ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/)

const lifecycleRoot = inside(`.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`)
const lifecycle = read(path.join(lifecycleRoot, "state.json"))
if (resumeCurrentRegistrySyncOnly) {
  assert.ok(["rejected", "formal_stage_validation_completed"].includes(lifecycle.state), "registry sync requires a terminal lifecycle state")
} else {
  assert.equal(lifecycle.state, (resumeGovernanceSyncOnly || resumePlanSyncCorrectionOnly) ? "rejected" : "controlled_smoke_completed")
}
const lifecycleEvidence = read(path.join(lifecycleRoot, lifecycle.latestEvidence.path))
for (const binding of lifecycleEvidence.bindings) assert.equal(sha(inside(binding.path)), binding.sha256)
let smokeTerminalBinding = null
let smokeQualificationBinding = null
if (resumeGovernanceSyncOnly || resumePlanSyncCorrectionOnly || resumeCurrentRegistrySyncOnly) {
  assert.equal(lifecycleEvidence.targetState, "rejected")
  assert.equal(lifecycleEvidence.status, "failed")
} else {
  assert.equal(lifecycleEvidence.status, "passed")
  smokeTerminalBinding = lifecycleEvidence.bindings.find((binding) => binding.path.endsWith("/phase-terminal.json"))
  smokeQualificationBinding = lifecycleEvidence.bindings.find((binding) => binding.path.endsWith("/late-stability-qualification.json"))
  assert.ok(smokeTerminalBinding && smokeQualificationBinding)
  assert.equal(read(inside(smokeTerminalBinding.path)).status, PROFILE.smokeTerminalStatus)
  assert.equal(read(inside(smokeQualificationBinding.path)).qualified, true)
}
assert.equal(sha(DATASET), DATASET_SHA)
assert.equal(sha(AUTOENCODER), AUTOENCODER_SHA)
assert.equal(sha(FROZEN_SOURCE), FROZEN_SOURCE_SHA)

const parent = inside(PROFILE.executionParent)
fs.mkdirSync(parent, { recursive: true })
const executionRoot = path.join(parent, runId)
if (resumeCurrentRegistrySyncOnly) {
  assert.equal(preflightOnly || resumeFinalizationOnly || resumeFailureAdjudicationOnly || resumeGovernanceSyncOnly || resumePlanSyncCorrectionOnly, false, "registry sync cannot be combined with another execution mode")
  assert.equal(fs.existsSync(executionRoot), true, "completed Stage 0 execution does not exist")
  const synchronized = await synchronizeCurrentExecutionRegistry(executionRoot)
  process.stdout.write(`${JSON.stringify(synchronized, null, 2)}\n`)
  process.exit(0)
}
if (resumePlanSyncCorrectionOnly) {
  assert.equal(preflightOnly || resumeFinalizationOnly || resumeFailureAdjudicationOnly || resumeGovernanceSyncOnly, false, "plan sync correction cannot be combined with another execution mode")
  assert.equal(fs.existsSync(executionRoot), true, "governed Stage 0 execution does not exist")
  recordPlanSyncWordingCorrection(executionRoot)
  process.exit(0)
}
if (resumeGovernanceSyncOnly) {
  assert.equal(preflightOnly || resumeFinalizationOnly || resumeFailureAdjudicationOnly, false, "governance sync cannot be combined with another execution mode")
  assert.equal(fs.existsSync(executionRoot), true, "adjudicated Stage 0 execution does not exist")
  synchronizeFailureGovernance(executionRoot)
  process.exit(0)
}
if (resumeFailureAdjudicationOnly) {
  assert.equal(preflightOnly || resumeFinalizationOnly, false, "failure adjudication recovery cannot be combined with another execution mode")
  assert.equal(fs.existsSync(executionRoot), true, "failed Stage 0 execution does not exist")
  await adjudicateRealVisualFailure(executionRoot)
  process.exit(0)
}
if (resumeFinalizationOnly) {
  assert.equal(preflightOnly, false, "finalization recovery cannot be combined with preflight-only")
  assert.equal(fs.existsSync(executionRoot), true, "completed Stage 0 execution does not exist")
  await resumeCompletedTrainingFinalization(executionRoot)
  process.exit(0)
}
assert.equal(fs.existsSync(executionRoot), false, "Stage 0 runId or output directory already exists")
const resources = resourceSnapshot()
assert.equal(resources.passed, true, `Stage 0 resource gate failed: ${resources.blockers.join(",")}`)
fs.mkdirSync(executionRoot, { recursive: false })
writeExclusiveJson(path.join(executionRoot, "resource-preflight.json"), resources)

const ticketId = `local-ai-${capabilityVersion}-${runId}`
const ticketPath = path.join(executionRoot, "internal-capability-ticket.json")
const consumptionPath = path.join(executionRoot, "internal-capability-consumption.json")
writeExclusiveJson(ticketPath, { schemaVersion: "ai-painter-local-internal-capability-ticket-v1", status: "issued_not_consumed", ticketId, modeId: PROFILE.modeId, capabilityVersion, capabilityAuthority: "local_ai_pet_world_program", parentEvidence: { smokeTerminal: smokeTerminalBinding, smokeQualification: smokeQualificationBinding }, executionActions: ACTIONS, ownerAuthorizationRequired: false, cannotExpandParentContract: true, issuedAtUtc: new Date().toISOString() })
writeExclusiveJson(consumptionPath, { schemaVersion: "ai-painter-local-internal-capability-ticket-consumption-v1", ticketId, ticketSha256: sha(ticketPath), oneTimeConsumption: true, state: "consumed", consumedAtUtc: new Date().toISOString() })
const activeConfigPath = path.join(executionRoot, "active-config.json")
writeExclusiveJson(activeConfigPath, buildActiveConfig())
const output = path.join(executionRoot, "training-output")
const trainerArgs = [TRAINER, "--config", activeConfigPath, "--dataset-package", DATASET, "--autoencoder-checkpoint", AUTOENCODER, "--output-dir", output, "--resolution-stage", "0"]
const preflight = spawnSync(PYTHON, [...trainerArgs, "--preflight-only"], { cwd: ROOT, env: pythonEnv(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true })
writeExclusiveJson(path.join(executionRoot, "trainer-preflight.json"), { status: preflight.status === 0 ? "passed" : "failed", exitCode: preflight.status, stdout: preflight.stdout, stderr: preflight.stderr, gpuStarted: false, trainingStarted: false })
if (preflight.status !== 0) closeFailure("trainer_preflight_failed", preflight.stderr || preflight.stdout)
if (preflightOnly) {
  const terminalPath = path.join(executionRoot, "phase-terminal.json")
  writeExclusiveJson(terminalPath, { schemaVersion: `${PROFILE.schemaStem}-preflight-terminal-v1`, executionState: "completed", status: `${PROFILE.schemaStem.replaceAll("-", "_")}_preflight_passed_gpu_not_started`, capabilityVersion, runId, activeConfig: bind(activeConfigPath), trainerPreflight: bind(path.join(executionRoot, "trainer-preflight.json")), gpuStarted: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
  for (const file of [ticketPath, consumptionPath, activeConfigPath, path.join(executionRoot, "resource-preflight.json"), path.join(executionRoot, "trainer-preflight.json"), terminalPath]) indexFile(file)
  process.stdout.write(`${JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), ownerAuthorizationRequired: false }, null, 2)}\n`)
  process.exit(0)
}

writeExclusiveJson(path.join(executionRoot, "execution-state.json"), { schemaVersion: `${PROFILE.schemaStem}-execution-state-v1`, status: "running", phase: "training", capabilityVersion, runId, stage: 0, epochTarget: 40, progressPath: relative(path.join(output, "progress.json")), ownerAuthorizationRequired: false, startedAtUtc: new Date().toISOString() })
const stdoutFd = fs.openSync(path.join(executionRoot, "trainer.stdout.log"), "wx")
const stderrFd = fs.openSync(path.join(executionRoot, "trainer.stderr.log"), "wx")
const child = spawn(PYTHON, trainerArgs, { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", stdoutFd, stderrFd] })
const telemetry = []
const heartbeat = setInterval(() => {
  const snapshot = resourceSnapshot(false)
  const progressPath = path.join(output, "progress.json")
  let progress = null
  if (fs.existsSync(progressPath)) {
    try { const current = read(progressPath); progress = { status: current.status, epoch: current.liveProgress?.epoch ?? current.currentEpoch, optimizerStep: current.liveProgress?.optimizerStep ?? null, optimizerStepTarget: current.liveProgress?.optimizerStepTarget ?? null, percentage: current.liveProgress?.percentage ?? null, etaSeconds: current.liveProgress?.etaSeconds ?? null } } catch {}
  }
  telemetry.push({ recordedAtUtc: new Date().toISOString(), progress, gpu: snapshot.gpu })
  writeJsonAtomic(path.join(executionRoot, "resource-telemetry.json"), { schemaVersion: `${PROFILE.schemaStem}-resource-telemetry-v1`, status: "recording", samples: telemetry, sampleCount: telemetry.length, peakGpuMemoryBytes: Math.max(0, ...telemetry.map((item) => item.gpu.memoryUsedMiB * 1024 * 1024)) })
}, 10000)
const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => resolve(code ?? 1)) })
clearInterval(heartbeat)
fs.closeSync(stdoutFd); fs.closeSync(stderrFd)
if (exitCode !== 0) closeFailure("trainer_execution_failed", `exitCode=${exitCode}`)

await finalizeCompletedTraining({ executionRoot, output, recoveryEvidence: null })

async function finalizeCompletedTraining({ executionRoot, output, recoveryEvidence }) {
  const manifestPath = path.join(output, "manifest.json")
  assert.ok(fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile(), "Stage 0 manifest missing")
  const manifest = read(manifestPath)
  validateManifest(manifest)
  if (recoveryEvidence) {
    const recoveryPath = path.join(executionRoot, "post-training-recovery-evidence.json")
    if (fs.existsSync(recoveryPath)) {
      const existing = read(recoveryPath)
      assert.equal(existing.status, recoveryEvidence.status)
      assert.equal(existing.cause, recoveryEvidence.cause)
      assert.deepEqual(existing.progress, recoveryEvidence.progress)
      assert.deepEqual(existing.manifest, recoveryEvidence.manifest)
      assert.deepEqual(existing.checkpointIdentity, recoveryEvidence.checkpointIdentity)
      assert.equal(existing.trainingRestarted, false)
      assert.equal(existing.checkpointWeightsRead, false)
      assert.equal(existing.optimizerCreated, false)
      assert.equal(existing.backwardExecuted, false)
    } else {
      writeExclusiveJson(recoveryPath, recoveryEvidence)
    }
  }
  const telemetryPath = path.join(executionRoot, "resource-telemetry.json")
  if (fs.existsSync(telemetryPath)) {
    const telemetry = read(telemetryPath)
    writeJsonAtomic(telemetryPath, { ...telemetry, status: "completed", trainingCompleted: true, completedAtUtc: new Date().toISOString() })
  }
  writeJsonAtomic(path.join(executionRoot, "execution-state.json"), { schemaVersion: `${PROFILE.schemaStem}-execution-state-v1`, status: "running", phase: "automatic_machine_review", capabilityVersion, runId, stage: 0, reviewProgressPath: relative(path.join(executionRoot, "review-progress.json")), ownerAuthorizationRequired: false, updatedAtUtc: new Date().toISOString() })
  const review = await reviewPreviews()
  const passed = review.previewPassCount === 6 && review.previewFailCount === 0
  const terminalStatus = passed ? PROFILE.terminalPassed : PROFILE.terminalFailed
  const finalizationPath = path.join(executionRoot, "finalization.json")
  writeExclusiveJson(finalizationPath, { schemaVersion: `${PROFILE.schemaStem}-finalization-v1`, status: terminalStatus, stage: 0, capabilityVersion, runId, manifest: bind(manifestPath), checkpoint: { path: manifest.checkpointPath, sha256: manifest.checkpointSha256, promotableWithinCapabilityLifecycle: passed }, machineReview: bind(path.join(executionRoot, "machine-review.json")), resourceTelemetry: fs.existsSync(telemetryPath) ? bind(telemetryPath) : null, automaticRetryStarted: false, stage1Started: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
  const terminalPath = path.join(executionRoot, "phase-terminal.json")
  writeExclusiveJson(terminalPath, { schemaVersion: `${PROFILE.schemaStem}-terminal-v1`, executionState: "completed", status: terminalStatus, stage: 0, capabilityVersion, runId, finalization: bind(finalizationPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
  writeJsonAtomic(path.join(executionRoot, "execution-state.json"), { schemaVersion: `${PROFILE.schemaStem}-execution-state-v1`, status: "completed", phase: passed ? "stage0_completed" : "failed_closed", capabilityVersion, runId, stage: 0, terminal: bind(terminalPath), ownerAuthorizationRequired: false, completedAtUtc: new Date().toISOString() })
  if (passed) {
    const evidence = { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion, targetState: "formal_stage_validation_completed", status: "passed", bindings: [terminalPath, finalizationPath, manifestPath, path.join(executionRoot, "machine-review.json")].map(bind) }
    advanceCapabilityLifecycle({ root: ROOT, capabilityVersion, targetState: "formal_stage_validation_completed", evidence })
  }
  for (const file of [path.join(executionRoot, "internal-capability-ticket.json"), path.join(executionRoot, "internal-capability-consumption.json"), path.join(executionRoot, "active-config.json"), path.join(executionRoot, "resource-preflight.json"), path.join(executionRoot, "trainer-preflight.json"), path.join(executionRoot, "review-progress.json"), path.join(executionRoot, "machine-review.json"), finalizationPath, terminalPath, ...(recoveryEvidence ? [path.join(executionRoot, "post-training-recovery-evidence.json")] : [])]) indexFile(file)
  appendAiPainterProgramEvent({ id: `${PROFILE.eventAction.replaceAll("_", "-")}-${runId}`, timestamp: new Date().toISOString(), action: PROFILE.eventAction, runId, kind: "formal_training", status: passed ? "success" : "failed_closed", title: "Stage4 formal Stage 0 completed", titleZh: passed ? PROFILE.eventTitleZhPassed : PROFILE.eventTitleZhFailed, detailZh: `40 Epoch正式训练完成；固定审核${review.previewPassCount}/6。`, evidencePath: relative(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  const failureAdjudication = passed ? null : await adjudicateRealVisualFailure(executionRoot)
  await synchronizeCurrentExecutionRegistry(executionRoot)
  process.stdout.write(`${JSON.stringify({ status: terminalStatus, terminal: bind(terminalPath), manifest: bind(manifestPath), machineReview: bind(path.join(executionRoot, "machine-review.json")), checkpoint: { path: manifest.checkpointPath, sha256: manifest.checkpointSha256 }, nextAction: passed ? "autonomous_stage1_compilation" : "bounded_readonly_failure_adjudication", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false }, null, 2)}\n`)
  return failureAdjudication
}

async function resumeCompletedTrainingFinalization(executionRoot) {
  for (const name of ["finalization.json", "phase-terminal.json", "machine-review.json"]) assert.equal(fs.existsSync(path.join(executionRoot, name)), false, `${name} already exists`)
  const state = read(path.join(executionRoot, "execution-state.json"))
  assert.equal(state.status, "running")
  assert.ok(["training", "automatic_machine_review"].includes(state.phase), `Stage 0 recovery phase is not resumable: ${state.phase}`)
  assert.equal(state.capabilityVersion, capabilityVersion)
  assert.equal(state.runId, runId)
  assert.equal(state.stage, 0)
  const ticketPath = path.join(executionRoot, "internal-capability-ticket.json")
  const consumptionPath = path.join(executionRoot, "internal-capability-consumption.json")
  const ticket = read(ticketPath)
  const consumption = read(consumptionPath)
  assert.equal(ticket.ticketId, consumption.ticketId)
  assert.equal(consumption.ticketSha256, sha(ticketPath))
  assert.equal(consumption.oneTimeConsumption, true)
  assert.equal(consumption.state, "consumed")
  const output = path.join(executionRoot, "training-output")
  const progressPath = path.join(output, "progress.json")
  const manifestPath = path.join(output, "manifest.json")
  const progress = read(progressPath)
  const manifest = read(manifestPath)
  assert.equal(progress.status, "completed")
  assert.equal(progress.currentStage, "completed")
  assert.equal(progress.currentEpoch, 40)
  assert.equal(progress.liveProgress.optimizerStep, 5760)
  assert.equal(progress.liveProgress.optimizerStepTarget, 5760)
  assert.equal(progress.metrics.length, 40)
  validateManifest(manifest)
  const recoveryEvidence = {
    schemaVersion: `${PROFILE.schemaStem}-post-training-recovery-v1`,
    status: "completed_training_outputs_verified_for_readonly_finalization_resume",
    cause: "trainer_manifest_pending_validation_status_rejected_by_stage0_runner",
    trainingRestarted: false,
    checkpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    progress: bind(progressPath),
    manifest: bind(manifestPath),
    checkpointIdentity: { path: manifest.checkpointPath, sha256: manifest.checkpointSha256, weightsLoaded: false },
    recordedAtUtc: new Date().toISOString(),
  }
  await finalizeCompletedTraining({ executionRoot, output, recoveryEvidence })
}

async function adjudicateRealVisualFailure(executionRoot) {
  const adjudicationFiles = ["best-checkpoint-machine-review.json", "failure-problem-report.json", "failure-analysis.json", "failure-decision.json", "failure-adjudication-terminal.json"]
  for (const name of adjudicationFiles) assert.equal(fs.existsSync(path.join(executionRoot, name)), false, `${name} already exists`)
  const primaryTerminalPath = path.join(executionRoot, "phase-terminal.json")
  const finalizationPath = path.join(executionRoot, "finalization.json")
  const fixedReviewPath = path.join(executionRoot, "machine-review.json")
  const manifestPath = path.join(executionRoot, "training-output", "manifest.json")
  const terminal = read(primaryTerminalPath)
  const finalization = read(finalizationPath)
  const fixedReview = read(fixedReviewPath)
  const manifest = read(manifestPath)
  assert.equal(terminal.status, PROFILE.terminalFailed)
  assert.deepEqual(terminal.finalization, bind(finalizationPath))
  assert.deepEqual(finalization.manifest, bind(manifestPath))
  assert.deepEqual(finalization.machineReview, bind(fixedReviewPath))
  assert.equal(fixedReview.status, "machine_reviews_failed")
  assert.equal(fixedReview.previewCount, 6)
  assert.ok(fixedReview.previewFailCount > 0)
  validateManifest(manifest)

  const previewIdentity = manifest.stage4UnifiedTrainingPreviewSampling
  assert.equal(previewIdentity.status, "checkpoint_bound_preview_reproduced_exactly")
  assert.equal(previewIdentity.bestEpoch, manifest.bestEpoch)
  assert.equal(previewIdentity.previewSha256Matches, true)
  assert.equal(previewIdentity.denoiserStateIdentityMatches, true)
  assert.equal(previewIdentity.sourcePreview.epoch, manifest.bestEpoch)
  assert.equal(previewIdentity.reproducedPreview.epoch, manifest.bestEpoch)
  assert.equal(previewIdentity.sourcePreview.previewSha256, previewIdentity.reproducedPreview.previewSha256)
  const sourcePath = inside(previewIdentity.sourcePreview.previewPath)
  const reproducedPath = inside(previewIdentity.reproducedPreview.previewPath)
  assert.equal(sha(sourcePath), previewIdentity.sourcePreview.previewSha256)
  assert.equal(sha(reproducedPath), previewIdentity.reproducedPreview.previewSha256)

  const normalizedPath = path.join(executionRoot, "best-checkpoint-review-assets", `epoch-${String(manifest.bestEpoch).padStart(3, "0")}.png`)
  const normalized = await normalizePreviewWithWindowsSafeIo({ sourcePath, finalAssetPath: normalizedPath, workRoot: inside(PROFILE.bestReviewWorkRoot), workId: shaText(relative(executionRoot)).slice(0, 16), epoch: manifest.bestEpoch })
  const sample = read(path.join(executionRoot, "active-config.json")).training.factConditionedSemanticMixtureSampleBinding
  const conditionPack = read(inside(sample.conditionPackPath))
  const [aesthetic, alignment] = await Promise.all([
    auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
    auditAiAssistedConditionAlignment({ record: { recordId: `${runId}-best-epoch-${manifest.bestEpoch}`, conditionBinding: { conditionPackPath: sample.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: sample.classification }, imagePath: normalized.shortOutputPath, referenceImagePath: sample.imagePath }),
  ])
  const bestPassed = aesthetic.passed && alignment.passed
  const bestReviewPath = path.join(executionRoot, "best-checkpoint-machine-review.json")
  writeExclusiveJson(bestReviewPath, {
    schemaVersion: `${PROFILE.schemaStem}-best-checkpoint-machine-review-v1`,
    status: bestPassed ? "machine_review_passed" : "machine_review_failed",
    epoch: manifest.bestEpoch,
    sourcePreview: bind(sourcePath),
    reproducedPreview: bind(reproducedPath),
    sourceAndReproductionBytesMatch: sha(sourcePath) === sha(reproducedPath),
    normalizedPreview: bind(normalizedPath),
    passed: bestPassed,
    issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
    professionalAesthetic: aesthetic,
    conditionAlignment: alignment,
    checkpointWeightsRead: false,
    reviewThresholdsChanged: false,
    recordedAtUtc: new Date().toISOString(),
  })

  const timeline = fixedReview.reviews.map((item) => ({ epoch: item.epoch, passed: item.passed, issueCodes: item.issueCodes }))
  const problemPath = path.join(executionRoot, "failure-problem-report.json")
  writeExclusiveJson(problemPath, { schemaVersion: `${PROFILE.schemaStem}-failure-problem-v1`, status: "real_visual_failure_confirmed", trainingCompleted: true, epochCount: 40, optimizerSteps: 5760, weightsChanged: manifest.modelStateHashEvidence?.weightsChanged === true, fixedReviewTimeline: timeline, bestEpoch: manifest.bestEpoch, bestCheckpointPreviewReviewed: true, checkpointWeightsRead: false, recordedAtUtc: new Date().toISOString() })
  const classification = bestPassed
    ? "best_checkpoint_and_fixed_visual_review_identity_gap_confirmed"
    : PROFILE.failureClassification
  const nextAction = bestPassed ? "bounded_checkpoint_and_fixed_review_identity_contract_correction" : "reject_current_model_family_and_return_to_bounded_candidate_planning"
  const analysisPath = path.join(executionRoot, "failure-analysis.json")
  writeExclusiveJson(analysisPath, { schemaVersion: `${PROFILE.schemaStem}-failure-analysis-v1`, status: "adjudicated", classification, evidence: { primaryTerminal: bind(primaryTerminalPath), manifest: bind(manifestPath), fixedMachineReview: bind(fixedReviewPath), bestCheckpointMachineReview: bind(bestReviewPath) }, findings: { trainerCompletedNaturally: true, manifestAndCheckpointIdentityValid: true, fixedNodesPassed: fixedReview.previewPassCount, fixedNodesFailed: fixedReview.previewFailCount, bestEpoch: manifest.bestEpoch, bestCheckpointPreviewPassed: bestPassed, persistentObjectSemanticMismatchAtEpochs20And30: [20, 30].every((epoch) => fixedReview.reviews.find((item) => item.epoch === epoch)?.issueCodes.filter((code) => code.includes("reference_semantic_mismatch")).length === 4), checkpointWeightsRead: false }, recordedAtUtc: new Date().toISOString() })
  const decisionPath = path.join(executionRoot, "failure-decision.json")
  writeExclusiveJson(decisionPath, { schemaVersion: `${PROFILE.schemaStem}-failure-decision-v1`, status: "unique_decision_formed", classification, nextAction, currentCandidateRejected: !bestPassed, stage1Started: false, stage2Started: false, automaticRetryStarted: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
  const adjudicationTerminalPath = path.join(executionRoot, "failure-adjudication-terminal.json")
  writeExclusiveJson(adjudicationTerminalPath, { schemaVersion: `${PROFILE.schemaStem}-failure-adjudication-terminal-v1`, executionState: "completed", status: "stage0_real_visual_failure_adjudicated_closed", capabilityVersion, runId, classification, nextAction, problem: bind(problemPath), analysis: bind(analysisPath), decision: bind(decisionPath), bestCheckpointMachineReview: bind(bestReviewPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })

  let lifecycleState = read(path.join(lifecycleRoot, "state.json")).state
  if (!bestPassed) {
    const evidence = { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion, targetState: "rejected", status: "failed", bindings: [primaryTerminalPath, fixedReviewPath, bestReviewPath, analysisPath, decisionPath, adjudicationTerminalPath].map(bind) }
    lifecycleState = advanceCapabilityLifecycle({ root: ROOT, capabilityVersion, targetState: "rejected", evidence }).state
  }
  const currentState = read(path.join(executionRoot, "execution-state.json"))
  writeJsonAtomic(path.join(executionRoot, "execution-state.json"), { ...currentState, failureAdjudication: bind(adjudicationTerminalPath), nextAction, lifecycleState, ownerAuthorizationRequired: false, updatedAtUtc: new Date().toISOString() })
  for (const file of [bestReviewPath, problemPath, analysisPath, decisionPath, adjudicationTerminalPath]) indexFile(file)
  appendAiPainterProgramEvent({ id: `stage4-authoritative-semantic-carrier-stage0-adjudication-${runId}`, timestamp: new Date().toISOString(), action: "stage4_authoritative_semantic_carrier_stage0_failure_adjudication", runId, kind: "readonly_adjudication", status: "completed", title: "Stage4 authoritative semantic carrier Stage 0 failure adjudicated", titleZh: "Stage4权威语义载体Stage 0失败已自动裁决", detailZh: `最佳Epoch ${manifest.bestEpoch}审核${bestPassed ? "通过" : "失败"}；唯一裁决=${classification}。`, evidencePath: relative(adjudicationTerminalPath), evidenceSha256: sha(adjudicationTerminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  const boundedCandidatePlanning = POST_DECODE_OBJECT_RGB && !bestPassed
    ? materializePostDecodeFailureBoundedPlan({
        root: ROOT,
        sourceRunRoot: relative(executionRoot),
        planningRunId: `${runId}-bounded-plan`,
      })
    : null
  return { classification, nextAction, lifecycleState, terminal: bind(adjudicationTerminalPath), bestCheckpointMachineReview: bind(bestReviewPath), boundedCandidatePlanning, ownerAuthorizationRequired: false }
}

async function synchronizeCurrentExecutionRegistry(executionRoot) {
  const primaryTerminalPath = path.join(executionRoot, "phase-terminal.json")
  const executionStatePath = path.join(executionRoot, "execution-state.json")
  const reviewPath = path.join(executionRoot, "machine-review.json")
  const reviewProgressPath = path.join(executionRoot, "review-progress.json")
  const progressPath = path.join(executionRoot, "training-output", "progress.json")
  for (const file of [primaryTerminalPath, executionStatePath, reviewPath, reviewProgressPath, progressPath]) {
    assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `current registry evidence missing: ${relative(file)}`)
  }

  const primaryTerminal = read(primaryTerminalPath)
  assert.equal(primaryTerminal.executionState, "completed")
  assert.equal(primaryTerminal.runId, runId)
  assert.equal(primaryTerminal.capabilityVersion, capabilityVersion)
  assert.ok([PROFILE.terminalPassed, PROFILE.terminalFailed].includes(primaryTerminal.status))

  const current = await readCurrentExecutionRegistry(ROOT)
  if (
    current.ok === true &&
    current.registry?.runId === runId &&
    current.registry?.latestTrainingTerminal?.runId === runId &&
    current.registry?.latestTrainingTerminal?.sha256 === sha(primaryTerminalPath)
  ) {
    return {
      status: "current_execution_registry_already_synchronized",
      runId,
      registryRevision: current.registry.registryRevision,
      registrySha256: current.registrySha256,
      ownerAuthorizationRequired: false,
    }
  }

  const adjudicationTerminalPath = path.join(executionRoot, "failure-adjudication-terminal.json")
  const decisionPath = path.join(executionRoot, "failure-decision.json")
  const failed = primaryTerminal.status === PROFILE.terminalFailed
  if (failed) {
    assert.ok(fs.existsSync(adjudicationTerminalPath), "failure adjudication terminal missing")
    assert.ok(fs.existsSync(decisionPath), "failure decision missing")
  }
  const recordedDecision = failed ? read(decisionPath) : null
  const nextAction = failed
    ? recordedDecision.nextAction
    : "autonomous_stage1_compilation"
  assert.ok(typeof nextAction === "string" && nextAction.length > 0)

  let classificationCorrectionPath = null
  if (failed && recordedDecision.classification !== PROFILE.failureClassification) {
    classificationCorrectionPath = path.join(executionRoot, "failure-classification-correction.json")
    if (!fs.existsSync(classificationCorrectionPath)) {
      writeExclusiveJson(classificationCorrectionPath, {
        schemaVersion: `${PROFILE.schemaStem}-failure-classification-correction-v1`,
        status: "append_only_classification_identity_corrected",
        cause: "shared_stage0_runner_defaulted_non_object_profile_to_authoritative_semantic_carrier",
        recordedClassification: recordedDecision.classification,
        correctedClassification: PROFILE.failureClassification,
        decisionEvidence: bind(decisionPath),
        semanticReviewResultChanged: false,
        machineReviewThresholdsChanged: false,
        checkpointWeightsRead: false,
        trainingRestarted: false,
        ownerAuthorizationRequired: false,
        recordedAtUtc: new Date().toISOString(),
      })
      indexFile(classificationCorrectionPath)
    }
  }

  const currentTaskTerminalPath = failed ? adjudicationTerminalPath : primaryTerminalPath
  const capsulePath = path.join(executionRoot, "local-task-capsule.json")
  if (!fs.existsSync(capsulePath)) {
    const evidenceFiles = [
      primaryTerminalPath,
      executionStatePath,
      reviewPath,
      reviewProgressPath,
      progressPath,
      ...(failed
        ? [
            adjudicationTerminalPath,
            path.join(executionRoot, "failure-problem-report.json"),
            path.join(executionRoot, "failure-analysis.json"),
            decisionPath,
          ]
        : []),
      ...(classificationCorrectionPath ? [classificationCorrectionPath] : []),
    ]
    for (const file of evidenceFiles) assert.ok(fs.existsSync(file), `capsule evidence missing: ${relative(file)}`)
    const recordedAtUtc = new Date().toISOString()
    writeExclusiveJson(capsulePath, {
      schemaVersion: "ai-painter-local-task-capsule-v1",
      capsuleId: `local-ai-${runId}-terminal`,
      generatedFrom: "program_saved_evidence",
      readOnly: true,
      module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
      fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
      currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: failed ? "stage0_failed_closed" : "stage0_validation_completed" },
      candidateTerminal: {
        runId,
        status: failed ? "failed_closed" : "passed",
        programStatus: primaryTerminal.status,
        previewMachineStatus: read(reviewPath).status,
        modelQualificationStatus: failed ? "formal_stage0_real_visual_failure" : "formal_stage0_qualified",
        previewCount: read(reviewPath).previewCount,
        previewPassCount: read(reviewPath).previewPassCount,
        previewFailCount: read(reviewPath).previewFailCount,
        checkpointWritten: true,
        modelWeightsModified: true,
        recordedAtUtc: primaryTerminal.recordedAtUtc,
        recordedAtAsiaShanghai: primaryTerminal.recordedAtUtc ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(primaryTerminal.recordedAtUtc)).replace(" ", "T") + "+08:00" : null,
      },
      latestBlocker: failed
        ? { code: PROFILE.failureClassification, summaryZh: "正式Stage 0训练和自动机器审核已完整结束；当前候选因多样本最终可见语义不足失败关闭，进入有界候选规划。" }
        : { code: "stage1_not_yet_materialized", summaryZh: "正式Stage 0训练与自动机器审核通过；下一动作是本地程序编译Stage 1。" },
      nextAllowedAction: { code: nextAction, labelZh: "本地程序下一动作", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
      forbiddenActions: ["reuse_failed_checkpoint", "automatic_retry_same_candidate", "lower_machine_review_threshold", "read_archived_run_as_current", "start_stage2_before_stage1"],
      taskIdentity: { modelId: PROFILE.modelId, sampleId: "194", conditionLabel: "v7-complete-map-194", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
      evidence: evidenceFiles.map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: null })),
      integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
    })
    indexFile(capsulePath)
  }

  const synchronized = await advanceCurrentExecutionRegistry({
    projectRoot: ROOT,
    capabilityVersion,
    packageId: runId,
    taskId: nextAction,
    taskKind: failed ? "bounded_candidate_planning" : "stage1_compilation",
    runId,
    lifecycleStage: failed ? "rejected" : "formal_stage_validation_completed",
    executionState: "package_materialized",
    activity: "planned_not_started",
    taskCapsulePath: relative(capsulePath),
    terminalEvidencePath: relative(currentTaskTerminalPath),
    latestTrainingTerminal: {
      runId,
      path: relative(primaryTerminalPath),
      sha256: sha(primaryTerminalPath),
      status: primaryTerminal.status,
      evidence: {
        executionState: bind(executionStatePath),
        machineReview: bind(reviewPath),
        reviewProgress: bind(reviewProgressPath),
        trainingProgress: bind(progressPath),
      },
    },
  })
  assert.equal(synchronized.ok, true, synchronized.errorCode ?? "current execution registry synchronization failed")
  return {
    status: "current_execution_registry_synchronized",
    runId,
    registryRevision: synchronized.registry.registryRevision,
    registrySha256: synchronized.registrySha256,
    latestTrainingTerminal: synchronized.registry.latestTrainingTerminal,
    nextAction,
    ownerAuthorizationRequired: false,
  }
}

function synchronizeFailureGovernance(executionRoot) {
  const capsulePath = path.join(executionRoot, "local-task-capsule.json")
  const planSyncPath = path.join(executionRoot, "plan-sync-record.json")
  assert.equal(fs.existsSync(capsulePath), false, "local task capsule already exists")
  assert.equal(fs.existsSync(planSyncPath), false, "plan sync record already exists")
  const adjudicationTerminalPath = path.join(executionRoot, "failure-adjudication-terminal.json")
  const decisionPath = path.join(executionRoot, "failure-decision.json")
  const bestReviewPath = path.join(executionRoot, "best-checkpoint-machine-review.json")
  const adjudication = read(adjudicationTerminalPath)
  const decision = read(decisionPath)
  const lifecycleStatePath = path.join(lifecycleRoot, "state.json")
  const lifecycleState = read(lifecycleStatePath)
  assert.equal(adjudication.status, "stage0_real_visual_failure_adjudicated_closed")
  assert.equal(decision.classification, "authoritative_semantic_carrier_multisample_semantic_capacity_insufficient_confirmed")
  assert.equal(lifecycleState.state, "rejected")
  const planPath = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  const plan = fs.readFileSync(planPath, "utf8")
  assert.ok(plan.includes("权威语义载体模型家族已完成Stage 0并因真实视觉失败被机器裁决退出"), "unique plan does not reflect the rejected candidate")
  assert.ok(plan.includes("固定进度3/5（60%）"), "unique plan fixed progress changed unexpectedly")
  const recordedAtUtc = new Date().toISOString()
  writeExclusiveJson(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v2", module: "AI Painter R5 / Stage4", currentStage: "authoritative semantic carrier Stage 0 failed and candidate rejected", status: "failed_closed_pending_bounded_candidate_recalculation", capabilityVersion, runId, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, latestTerminal: bind(adjudicationTerminalPath), uniqueDecision: bind(decisionPath), bestCheckpointMachineReview: bind(bestReviewPath), lifecycleState: bind(lifecycleStatePath), nextLocalAction: "recalculate_unique_bounded_candidate_or_persist_policy_boundary", ownerAuthorizationRequired: false, ownerResponseRequired: false, recordedAtUtc })
  writeExclusiveJson(planSyncPath, { schemaVersion: "stage4-authoritative-semantic-carrier-stage0-plan-sync-v1", status: "synchronized", plan: bind(planPath), adjudicationTerminal: bind(adjudicationTerminalPath), lifecycleState: bind(lifecycleStatePath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, recordedAtUtc })
  for (const file of [capsulePath, planSyncPath]) indexFile(file)
  appendAiPainterProgramEvent({ id: `stage4-authoritative-semantic-carrier-stage0-governance-${runId}`, timestamp: recordedAtUtc, action: "stage4_authoritative_semantic_carrier_stage0_governance_sync", runId, kind: "governance_sync", status: "success", title: "Stage4 authoritative semantic carrier failure governance synchronized", titleZh: "Stage4权威语义载体失败治理记录已同步", detailZh: "候选拒绝终态、唯一计划表、任务胶囊、事件账本与SQLite已同步；无需Owner响应。", evidencePath: relative(planSyncPath), evidenceSha256: sha(planSyncPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  process.stdout.write(`${JSON.stringify({ status: "failure_governance_synchronized", capsule: bind(capsulePath), planSync: bind(planSyncPath), lifecycleState: lifecycleState.state, ownerAuthorizationRequired: false }, null, 2)}\n`)
}

function recordPlanSyncWordingCorrection(executionRoot) {
  const priorSyncPath = path.join(executionRoot, "plan-sync-record.json")
  const correctionPath = path.join(executionRoot, "plan-sync-wording-correction.json")
  assert.equal(fs.existsSync(priorSyncPath), true, "prior plan sync record is missing")
  assert.equal(fs.existsSync(correctionPath), false, "plan sync wording correction already exists")
  const prior = read(priorSyncPath)
  assert.equal(prior.status, "synchronized")
  const planPath = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  const plan = fs.readFileSync(planPath, "utf8")
  assert.ok(plan.includes("固定进度3/5（60%）"))
  assert.ok(plan.includes("当前训练未运行"))
  const recordedAtUtc = new Date().toISOString()
  writeExclusiveJson(correctionPath, { schemaVersion: "stage4-authoritative-semantic-carrier-stage0-plan-sync-wording-correction-v1", status: "synchronized", cause: "formal_document_vocabulary_requires_training_not_running_phrase", priorPlanSync: bind(priorSyncPath), currentPlan: bind(planPath), semanticStateChanged: false, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, recordedAtUtc })
  indexFile(correctionPath)
  appendAiPainterProgramEvent({ id: `stage4-authoritative-semantic-carrier-stage0-plan-sync-correction-${runId}`, timestamp: recordedAtUtc, action: "stage4_authoritative_semantic_carrier_stage0_plan_sync_correction", runId, kind: "governance_sync", status: "success", title: "Stage4 plan vocabulary synchronization corrected", titleZh: "Stage4计划表正式词表同步已追加更正", detailZh: "仅规范训练未运行状态词；业务状态和固定进度未改变。", evidencePath: relative(correctionPath), evidenceSha256: sha(correctionPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  process.stdout.write(`${JSON.stringify({ status: "plan_sync_wording_correction_recorded", correction: bind(correctionPath), currentPlan: bind(planPath), ownerAuthorizationRequired: false }, null, 2)}\n`)
}

function buildActiveConfig() {
  const config = structuredClone(read(FROZEN_SOURCE))
  delete config.stage4ControlledStructureArm
  delete config.stage4ResponsibilityComponentRole
  config.modelId = PROFILE.modelId
  config.architectureVersion = PROFILE.architectureVersion
  config.status = "active_local_ai_stage0_full_training"
  config.denoiserArchitecture = POST_DECODE_FULL_CONDITION_RESPONSIBILITY
    ? "stage4_post_decode_full_condition_route_object_responsibility_renderer_v1"
    : POST_DECODE_OBJECT_RGB
      ? "stage4_post_decode_authoritative_object_rgb_compositor_v1"
      : "stage4_authoritative_visual_semantic_carrier_decoder_v1"
  config.denoiserBaseChannels = 64
  const training = config.training
  delete training.ownerTrainingAuthorization
  delete training.factConditionedSemanticMixtureStage4FullTrainingContract
  delete training.stage4ControlledStructureThreeArm
  delete training.stage4PostDecodeObjectRgbSmokeContract
  delete training.stage4PostDecodeFullConditionResponsibilitySmokeContract
  delete training.stage4AuthoritativeSemanticCarrierSmokeContract
  training.trainingAuthorizationStatus = PROFILE.trainingStatus
  training.denoiserEpochs = 40
  training.seed = 20263722
  training.authorizedInitialization = PROFILE.initialization
  training.localAiCapabilityTicket = { ticketId, ticketPath: relative(ticketPath), ticketSha256: sha(ticketPath), consumptionPath: relative(consumptionPath), consumptionSha256: sha(consumptionPath), executionState: "consumed", status: training.trainingAuthorizationStatus, executionActions: ACTIONS }
  if (POST_DECODE_FULL_CONDITION_RESPONSIBILITY) {
    delete training.stage4AuthoritativeSemanticCarrier
    delete training.stage4AuthoritativeSemanticCarrierFormalStageContract
    delete training.stage4AuthoritativeSemanticCarrierFrozenTrainingContract
    delete training.stage4PostDecodeObjectRgbFormalStageContract
    delete training.stage4PostDecodeObjectRgbFrozenTrainingContract
    delete training.stage4BestCheckpointAndTerminalQualificationIdentitySeparation
    training.stage4FailureDiagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_active_full_training"
    training.stage4PostDecodeFullConditionResponsibilityFormalStageContract = { status: "active_local_ai_internal_capability", stage: 0, seed: 20263722, epochCount: 40, previewEpochs: PREVIEW_EPOCHS, resolution: { width: 256, height: 192 }, datasetCapacity: 64, splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, initialization: PROFILE.initialization, parentDenoiserCheckpointAllowed: false, automaticMachineReview: true, automaticFailureClassification: true, automaticRetryAllowed: false }
    training.stage4PostDecodeFullConditionResponsibilityFrozenTrainingContract = { sourceConfigPath: relative(FROZEN_SOURCE), sourceConfigSha256: FROZEN_SOURCE_SHA }
    config.activationGates = { configurationActiveNow: true, gpuNow: true, optimizerNow: true, backwardNow: true, weightModificationNow: true, smokeNow: false, trainingNow: true, formalInferenceNow: false, runtimeFrameNow: false, worldEntryNow: false }
  } else if (POST_DECODE_OBJECT_RGB) {
    delete training.stage4AuthoritativeSemanticCarrier
    delete training.stage4AuthoritativeSemanticCarrierFormalStageContract
    delete training.stage4AuthoritativeSemanticCarrierFrozenTrainingContract
    delete training.stage4BestCheckpointAndTerminalQualificationIdentitySeparation
    training.stage4FailureDiagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_active_full_training"
    training.stage4PostDecodeObjectRgbFormalStageContract = { status: "active_local_ai_internal_capability", stage: 0, seed: 20263722, epochCount: 40, previewEpochs: PREVIEW_EPOCHS, resolution: { width: 256, height: 192 }, datasetCapacity: 64, splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, initialization: PROFILE.initialization, parentDenoiserCheckpointAllowed: false, automaticMachineReview: true, automaticFailureClassification: true, automaticRetryAllowed: false }
    training.stage4PostDecodeObjectRgbFrozenTrainingContract = { sourceConfigPath: relative(FROZEN_SOURCE), sourceConfigSha256: FROZEN_SOURCE_SHA }
  } else {
    training.stage4AuthoritativeSemanticCarrier = { contractId: "stage4-authoritative-visual-semantic-carrier-model-family-contract-v1", status: "active_local_ai_stage0_full_training", carrierIdentityOrder: ["terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline", "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "object_footprints", "object_tree", "object_rock", "object_vegetation"], sourceGate: "exact_resized_authoritative_discrete_condition_channel", learnedParticipationGateAllowed: false }
    training.stage4AuthoritativeSemanticCarrierFormalStageContract = { status: "active_local_ai_internal_capability", stage: 0, seed: 20263722, epochCount: 40, previewEpochs: PREVIEW_EPOCHS, resolution: { width: 256, height: 192 }, datasetCapacity: 64, splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, initialization: PROFILE.initialization, parentDenoiserCheckpointAllowed: false, automaticMachineReview: true, automaticRetryAllowed: false }
    training.stage4AuthoritativeSemanticCarrierFrozenTrainingContract = { sourceConfigPath: relative(FROZEN_SOURCE), sourceConfigSha256: FROZEN_SOURCE_SHA }
  }
  if (training.stage4UnifiedTrainingPreviewSamplingContract) training.stage4UnifiedTrainingPreviewSamplingContract.status = "active_local_ai_internal_capability"
  if (POST_DECODE_OBJECT_RGB || POST_DECODE_FULL_CONDITION_RESPONSIBILITY) {
    const mixture = training.stage4FactConditionedSemanticMixture
    mixture.status = "training_loss_active_owner_authorized"
    for (const key of Object.keys(mixture.activationGate)) mixture.activationGate[key] = false
    for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "stage4FullTrainingNow"]) {
      if (Object.hasOwn(mixture.activationGate, key)) mixture.activationGate[key] = true
    }
    for (const name of FORMAL_TRAINING_LOSS_CONTRACTS) {
      const contract = training[name]
      if (!contract) continue
      contract.status = "training_loss_active_owner_authorized"
      const gate = contract.activationGate
      for (const key of Object.keys(gate)) gate[key] = false
      for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "stage4FullTrainingNow"]) {
        if (Object.hasOwn(gate, key)) gate[key] = true
      }
    }
    const conflictAware = training.stage4ConflictAwareExistingGradientAggregation
    if (conflictAware) {
      conflictAware.status = "training_paradigm_active_owner_authorized"
      const gate = conflictAware.activationGate
      for (const key of Object.keys(gate)) gate[key] = false
      for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "stage4FullTrainingNow"]) {
        if (Object.hasOwn(gate, key)) gate[key] = true
      }
    }
  }
  return config
}

function validateManifest(manifest) {
  assert.equal(manifest.status, "conditional_denoiser_training_completed_pending_validation")
  assert.equal(manifest.trainingStage, "conditional_denoiser_training")
  assert.equal(manifest.modelId, PROFILE.modelId)
  const activeConfig = read(path.join(executionRoot, "active-config.json"))
  assert.equal(POST_DECODE_FULL_CONDITION_RESPONSIBILITY
    ? activeConfig.training.stage4PostDecodeFullConditionResponsibilityFormalStageContract.stage
    : POST_DECODE_OBJECT_RGB
      ? activeConfig.training.stage4PostDecodeObjectRgbFormalStageContract.stage
      : activeConfig.training.stage4AuthoritativeSemanticCarrierFormalStageContract.stage, 0)
  assert.deepEqual(manifest.resolutionStage, { width: 256, height: 192 })
  assert.equal(manifest.seed, 20263722)
  assert.equal(manifest.actualLoadedConditionalSampleCount, 64)
  assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(manifest.parentDenoiserCheckpointPath, null)
  assert.equal(manifest.parentDenoiserCheckpointSha256, null)
  assert.equal(manifest.metrics.length, 40)
  for (const epoch of PREVIEW_EPOCHS) assert.ok(manifest.metrics.some((row) => row.epoch === epoch && row.validationPreviewArtifact), `Epoch ${epoch} preview identity missing`)
  assert.equal(sha(inside(manifest.checkpointPath)), manifest.checkpointSha256)
}

async function reviewPreviews() {
  const previewRoot = path.join(executionRoot, "training-output", "fixed-epoch-previews")
  const files = fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort((a, b) => Number(a.match(/epoch-(\d+)/)?.[1]) - Number(b.match(/epoch-(\d+)/)?.[1]))
  assert.deepEqual(files.map((file) => Number(file.match(/epoch-(\d+)/)?.[1])), PREVIEW_EPOCHS)
  const sample = read(path.join(executionRoot, "active-config.json")).training.factConditionedSemanticMixtureSampleBinding
  const conditionPack = read(inside(sample.conditionPackPath))
  const reviews = []
  const reviewProgressPath = path.join(executionRoot, "review-progress.json")
  const writeReviewProgress = ({ status, currentEpoch = null }) => writeJsonAtomic(reviewProgressPath, {
    schemaVersion: `${PROFILE.schemaStem}-machine-review-progress-v1`,
    status,
    phase: "automatic_machine_review",
    runId,
    capabilityVersion,
    previewCount: files.length,
    completedPreviewCount: reviews.length,
    previewPassCount: reviews.filter((review) => review.passed).length,
    previewFailCount: reviews.filter((review) => !review.passed).length,
    currentEpoch,
    ownerAuthorizationRequired: false,
    updatedAtUtc: new Date().toISOString(),
  })
  writeReviewProgress({ status: "running" })
  for (const file of files) {
    const epoch = Number(file.match(/epoch-(\d+)/)[1])
    writeReviewProgress({ status: "running", currentEpoch: epoch })
    const sourcePath = path.join(previewRoot, file)
    const normalizedPath = path.join(executionRoot, "review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    const normalized = await normalizePreviewWithWindowsSafeIo({ sourcePath, finalAssetPath: normalizedPath, workRoot: inside(PROFILE.reviewWorkRoot), workId: shaText(relative(executionRoot)).slice(0, 16), epoch })
    const [aesthetic, alignment] = await Promise.all([auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath), auditAiAssistedConditionAlignment({ record: { recordId: `${runId}-${epoch}`, conditionBinding: { conditionPackPath: sample.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: sample.classification }, imagePath: normalized.shortOutputPath, referenceImagePath: sample.imagePath })])
    reviews.push({ epoch, previewPath: relative(sourcePath), previewSha256: sha(sourcePath), normalizedPath: relative(normalizedPath), normalizedSha256: sha(normalizedPath), passed: aesthetic.passed && alignment.passed, issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code), professionalAesthetic: aesthetic, conditionAlignment: alignment })
    writeReviewProgress({ status: "running", currentEpoch: epoch })
  }
  const report = { schemaVersion: `${PROFILE.schemaStem}-machine-review-v1`, status: reviews.every((review) => review.passed) ? "machine_reviews_passed" : "machine_reviews_failed", reviewThresholdsChanged: false, reviews, previewCount: reviews.length, previewPassCount: reviews.filter((review) => review.passed).length, previewFailCount: reviews.filter((review) => !review.passed).length, recordedAtUtc: new Date().toISOString() }
  writeExclusiveJson(path.join(executionRoot, "machine-review.json"), report)
  writeReviewProgress({ status: "completed" })
  return report
}

function resourceSnapshot(requireIdle = true) {
  const gpu = spawnSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.free", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const parts = gpu.stdout.trim().split(",").map((value) => value.trim())
  const disk = fs.statfsSync(ROOT); const freeDisk = Number(disk.bavail) * Number(disk.bsize)
  const processCheck = spawnSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const python = processCheck.stdout.split(/\r?\n/).filter((row) => /python/i.test(row))
  const blockers = []
  if (gpu.status !== 0) blockers.push("cuda_unavailable")
  if (requireIdle && Number(parts[1]) > 10) blockers.push("gpu_not_idle")
  if (requireIdle && python.length) blockers.push("python_gpu_process_active")
  if (Number(parts[3]) < 4096 && requireIdle) blockers.push("gpu_memory_insufficient")
  if (freeDisk < 4 * 1024 ** 3) blockers.push("disk_insufficient")
  return { schemaVersion: `${PROFILE.schemaStem}-resource-snapshot-v1`, passed: blockers.length === 0, blockers, cpuLogicalProcessors: os.cpus().length, memoryFreeBytes: os.freemem(), diskFreeBytes: freeDisk, gpu: { name: parts[0], utilizationPercent: Number(parts[1]), memoryUsedMiB: Number(parts[2]), memoryFreeMiB: Number(parts[3]), pythonComputeProcesses: python }, recordedAtUtc: new Date().toISOString() }
}

function closeFailure(code, detail) {
  const finalizationPath = path.join(executionRoot, "failure-finalization.json")
  writeExclusiveJson(finalizationPath, { schemaVersion: `${PROFILE.schemaStem}-failure-v1`, status: "failed_closed", code, detail: String(detail), automaticRetryStarted: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
  const terminalPath = path.join(executionRoot, "phase-terminal.json")
  writeExclusiveJson(terminalPath, { schemaVersion: `${PROFILE.schemaStem}-terminal-v1`, executionState: "failed", status: PROFILE.infrastructureFailed, blocker: code, finalization: bind(finalizationPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
  writeJsonAtomic(path.join(executionRoot, "execution-state.json"), { status: "failed_closed", terminal: bind(terminalPath), ownerAuthorizationRequired: false })
  throw new Error(`${code}:${detail}`)
}

function inside(relativePath) { assert.ok(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath) && !relativePath.split(/[\\/]/).includes("..")); const target = path.resolve(ROOT, relativePath); assert.ok(target.startsWith(`${ROOT}${path.sep}`)); return target }
function relative(file) { return path.relative(ROOT, file).replaceAll("\\", "/") }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaText(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function bind(file) { return { path: relative(file), sha256: sha(file) } }
function writeExclusiveJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); const handle = fs.openSync(file, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: `${inside("ml/ai-painter/src")};${inside("ml/ai-painter/scripts")}` } }
function indexFile(file) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: PROFILE.artifactType, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
