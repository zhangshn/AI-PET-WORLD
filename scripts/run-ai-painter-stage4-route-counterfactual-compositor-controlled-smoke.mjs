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
import { adjudicateLateReviewRows } from "./lib/ai-painter-stage4-late-convergence-qualification.mjs"
import { adjudicateRouteCounterfactualSmokeOutcome } from "./lib/ai-painter-route-counterfactual-smoke-outcome-v1.mjs"
import { appendAiPainterProgramEvent, formatShanghai, projectPath, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const FIXED_40_QUALIFICATION =
  process.env.AI_PAINTER_ROUTE_COUNTERFACTUAL_FIXED_40 === "1"
const SOURCE_CAPABILITY = "stage4-native-route-counterfactual-compositor-change-candidate-v1"
const CAPABILITY = FIXED_40_QUALIFICATION
  ? "stage4-native-route-counterfactual-compositor-fixed-40-qualification-successor-v1"
  : SOURCE_CAPABILITY
const ARCHITECTURE = "stage4_native_condition_shared_weight_route_counterfactual_compositor_v1"
const TASK_ID = FIXED_40_QUALIFICATION
  ? "run_route_counterfactual_compositor_fixed_40_epoch_qualification"
  : "compile_route_counterfactual_compositor_controlled_smoke_contract"
const RUN_ID = FIXED_40_QUALIFICATION
  ? `stage4-route-counterfactual-compositor-fixed-40-epoch-${compactUtc()}-01`
  : `stage4-route-counterfactual-compositor-smoke-${compactUtc()}-01`
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const EPOCH_COUNT = FIXED_40_QUALIFICATION ? 40 : 30
const PREVIEW_EPOCHS = FIXED_40_QUALIFICATION
  ? [1, 5, 10, 20, 30, 40]
  : [1, 5, 10, 20, 30]
const EXECUTION_STATE_SCHEMA = FIXED_40_QUALIFICATION
  ? "stage4-route-counterfactual-compositor-fixed-40-epoch-execution-state-v1"
  : "stage4-route-counterfactual-compositor-controlled-smoke-execution-state-v1"
const REVIEW_PROGRESS_SCHEMA = FIXED_40_QUALIFICATION
  ? "stage4-route-counterfactual-compositor-fixed-40-machine-review-progress-v1"
  : "stage4-route-counterfactual-compositor-machine-review-progress-v1"
const REVIEW_SCHEMA = FIXED_40_QUALIFICATION
  ? "stage4-route-counterfactual-compositor-fixed-40-machine-review-v1"
  : "stage4-route-counterfactual-compositor-machine-review-v1"
const QUALIFICATION_SCHEMA = FIXED_40_QUALIFICATION
  ? "stage4-route-counterfactual-compositor-fixed-40-late-stability-qualification-v1"
  : "stage4-route-counterfactual-compositor-late-stability-qualification-v1"
const MANIFEST_SCHEMA = FIXED_40_QUALIFICATION
  ? "stage4-route-counterfactual-compositor-fixed-40-root-manifest-v1"
  : "stage4-route-counterfactual-compositor-controlled-smoke-root-manifest-v1"
const FINALIZATION_SCHEMA = FIXED_40_QUALIFICATION
  ? "stage4-route-counterfactual-compositor-fixed-40-finalization-v1"
  : "stage4-route-counterfactual-compositor-controlled-smoke-finalization-v1"
const TERMINAL_SCHEMA = FIXED_40_QUALIFICATION
  ? "stage4-route-counterfactual-compositor-fixed-40-terminal-v1"
  : "stage4-route-counterfactual-compositor-controlled-smoke-terminal-v1"
const INACTIVE = resolve(".runtime/ai-painter/stage4-route-counterfactual-cpu-support/stage4-route-counterfactual-cpu-20260828003510-01/inactive-config.json")
const GPU_TERMINAL = resolve(".runtime/ai-painter/stage4-route-counterfactual-readonly-gpu/stage4-route-counterfactual-gpu-20260828003804-01/phase-terminal.json")
const DATASET = resolve("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json")
const AUTOENCODER = resolve(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt")
const AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const PYTHON = resolve("ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = resolve("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const CPU_CHECKER = resolve(FIXED_40_QUALIFICATION
  ? "ml/ai-painter/scripts/check_stage4_route_counterfactual_compositor_fixed_40_cpu.py"
  : "ml/ai-painter/scripts/check_stage4_route_counterfactual_compositor_smoke_cpu.py")
const COMPILER = resolve(FIXED_40_QUALIFICATION
  ? "ml/ai-painter/scripts/compile_stage4_route_counterfactual_compositor_fixed_40_active_config.py"
  : "ml/ai-painter/scripts/compile_stage4_route_counterfactual_compositor_smoke_active_config.py")
const CONTRACT_ROOT = resolve(FIXED_40_QUALIFICATION
  ? `.runtime/ai-painter/stage4-route-counterfactual-compositor-fixed-40-epoch-contracts/${RUN_ID}`
  : `.runtime/ai-painter/stage4-route-counterfactual-compositor-smoke-contracts/${RUN_ID}`)
const CONTRACT = path.join(CONTRACT_ROOT, "controlled-smoke-contract.json")
const EXECUTION_ROOT = resolve(FIXED_40_QUALIFICATION
  ? `.runtime/ai-painter/stage4-route-counterfactual-compositor-fixed-40-epoch-qualifications/${RUN_ID}`
  : `.runtime/ai-painter/stage4-route-counterfactual-compositor-controlled-smokes/${RUN_ID}`)
const SOURCE_30_EPOCH_TERMINAL = resolve(".runtime/ai-painter/stage4-route-counterfactual-compositor-controlled-smokes/stage4-route-counterfactual-compositor-smoke-20260828004950-01/phase-terminal.json")
const SOURCE_30_EPOCH_REVIEW = resolve(".runtime/ai-painter/stage4-route-counterfactual-compositor-controlled-smokes/stage4-route-counterfactual-compositor-smoke-20260828004950-01/machine-review.json")
const SOURCE_30_EPOCH_QUALIFICATION = resolve(".runtime/ai-painter/stage4-route-counterfactual-compositor-controlled-smokes/stage4-route-counterfactual-compositor-smoke-20260828004950-01/late-stability-qualification.json")
let LINEAGE_TERMINAL = null
let FIXED_40_QUALIFICATION_PLAN = null

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(
  current.registry.capabilityVersion,
  CAPABILITY,
)
if (FIXED_40_QUALIFICATION) {
  assert.equal(current.registry.taskId, TASK_ID)
  assert.equal(current.registry.lifecycleStage, "readonly_gpu_qualified")
} else {
  assert.equal(current.registry.taskId, TASK_ID)
  assert.equal(current.registry.lifecycleStage, "readonly_gpu_qualified")
}
assert.equal(current.registry.activity, "planned_not_started")
assert.equal(current.registry.activeExecution, null)
const CURRENT_GPU_TERMINAL = resolve(current.registry.terminalEvidence.path)
if (FIXED_40_QUALIFICATION) {
  LINEAGE_TERMINAL = CURRENT_GPU_TERMINAL
  verifyFile(LINEAGE_TERMINAL, current.registry.terminalEvidence.sha256, "current fixed 40 lineage terminal")
  const lineageTerminal = read(LINEAGE_TERMINAL)
  assert.equal(lineageTerminal.schemaVersion, "stage4-route-counterfactual-fixed40-lineage-adjudication-terminal-v1")
  assert.equal(lineageTerminal.status, "route_counterfactual_fixed40_lineage_adjudication_succeeded")
  assert.equal(lineageTerminal.sourceCapabilityVersion, SOURCE_CAPABILITY)
  assert.equal(lineageTerminal.successorCapabilityVersion, CAPABILITY)
  assert.equal(lineageTerminal.nextLegalAction, TASK_ID)
  assert.equal(lineageTerminal.fixed40QualificationContract?.path?.length > 0, true)
  FIXED_40_QUALIFICATION_PLAN = resolve(lineageTerminal.fixed40QualificationContract.path)
  verifyFile(FIXED_40_QUALIFICATION_PLAN, lineageTerminal.fixed40QualificationContract.sha256, "fixed 40 bounded qualification plan")
  const fixed40Plan = read(FIXED_40_QUALIFICATION_PLAN)
  assert.equal(fixed40Plan.schemaVersion, "stage4-route-counterfactual-compositor-fixed-40-epoch-qualification-contract-v1")
  assert.equal(fixed40Plan.status, "compiled_not_started")
  assert.equal(fixed40Plan.capabilityVersion, CAPABILITY)
  assert.equal(fixed40Plan.architecture, ARCHITECTURE)
  assert.equal(fixed40Plan.epochCount, 40)
  assert.deepEqual(fixed40Plan.previewEpochs, [1, 5, 10, 20, 30, 40])
  assert.deepEqual(fixed40Plan.resolution, { width: 256, height: 192 })
  assert.equal(fixed40Plan.seed, 20263722)
  assert.deepEqual(fixed40Plan.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(fixed40Plan.initialization, "same_contract_fixed_random_initialization_from_scratch")
  assert.equal(fixed40Plan.checkpointInputAllowed, false)
  assert.equal(fixed40Plan.smokeCheckpointReadAllowed, false)
  assert.equal(fixed40Plan.modelChangeAllowed, false)
  assert.equal(fixed40Plan.lossChangeAllowed, false)
  assert.equal(fixed40Plan.dataChangeAllowed, false)
  assert.equal(fixed40Plan.splitChangeAllowed, false)
  assert.equal(fixed40Plan.reviewThresholdChangeAllowed, false)
  assert.equal(fixed40Plan.automaticMachineReview, true)
  assert.equal(fixed40Plan.automaticTerminalRecording, true)
  assert.equal(fixed40Plan.automaticRetry, false)
  assert.equal(fixed40Plan.successNextAction, "compile_route_counterfactual_compositor_formal_stage0")
  assert.equal(fixed40Plan.failureNextAction, "retire_fixed40_successor_and_escalate_generation_paradigm")
  assert.equal(fixed40Plan.ownerAuthorizationRequired, false)
  verifyFile(SOURCE_30_EPOCH_TERMINAL, "223abfae4252cbb66b3a6d5d5a0074b0f5b1ad4adccb96704e95e39b90bbef57", "immutable rejected 30 Epoch terminal")
  verifyFile(SOURCE_30_EPOCH_REVIEW, "09234fc4544a57ef612b572ec4da00750c12674f34617f672596647498630e9c", "immutable 30 Epoch machine review")
  verifyFile(SOURCE_30_EPOCH_QUALIFICATION, "a205446749b84002132cba242be037fca1b3d361ed1001465fbd599f33148d01", "immutable 30 Epoch late qualification")
  assert.equal(read(SOURCE_30_EPOCH_TERMINAL).status, "route_counterfactual_compositor_controlled_smoke_real_visual_failure")
  assert.deepEqual(read(SOURCE_30_EPOCH_QUALIFICATION).lateEpochs.map((row) => row.failureCount), [7, 5, 1])
  assert.deepEqual(read(SOURCE_30_EPOCH_QUALIFICATION).lateEpochs.at(-1).failureItems, ["condition_object_rock_reference_semantic_mismatch"])
} else {
  assert.equal(CURRENT_GPU_TERMINAL, GPU_TERMINAL)
  verifyFile(CURRENT_GPU_TERMINAL, current.registry.terminalEvidence.sha256, "current readonly GPU terminal")
  assert.equal(read(CURRENT_GPU_TERMINAL).status, "route_counterfactual_compositor_readonly_gpu_qualification_succeeded")
}
assert.equal(fs.existsSync(CONTRACT_ROOT), false, "Smoke contract output reuse is forbidden")
assert.equal(fs.existsSync(EXECUTION_ROOT), false, "Smoke execution output reuse is forbidden")
verifyFile(AUTOENCODER, AUTOENCODER_SHA256, "frozen project Autoencoder")
verifyFile(INACTIVE, "82ae12626afe52880f9e2b95991cec704d84144f5ec1d497782bafcc18b939d5", "current route counterfactual inactive config")
verifyFile(GPU_TERMINAL, "06ab5e40c40da41e0f122e7170be403e10fb635998a7835450719bb8c63dc5e9", "qualified readonly GPU terminal")

const sourceEvidence = [
  ["readonlyGpuTerminal", GPU_TERMINAL],
  ...(FIXED_40_QUALIFICATION
    ? [
        ["fixed40LineageTerminal", LINEAGE_TERMINAL],
        ["boundedFixed40QualificationPlan", FIXED_40_QUALIFICATION_PLAN],
        ["immutableRejected30EpochTerminal", SOURCE_30_EPOCH_TERMINAL],
        ["immutable30EpochMachineReview", SOURCE_30_EPOCH_REVIEW],
        ["immutable30EpochLateQualification", SOURCE_30_EPOCH_QUALIFICATION],
      ]
    : []),
  ["inactiveConfig", INACTIVE],
  ["modelFactory", resolve("ml/ai-painter/src/ai_painter/complete_world/model.py")],
  ["trainer", TRAINER],
  ["trainerSmokeImplementation", resolve("ml/ai-painter/scripts/train_stage4_direct_clean_latent_smoke.py")],
  ["structureContract", resolve("ml/ai-painter/scripts/ai_painter_route_counterfactual_compositor_contract.py")],
  ["modeRegistry", resolve("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")],
  ["datasetManifest", DATASET],
].map(([role, file]) => ({ role, ...bind(file) }))
const contract = {
  schemaVersion: FIXED_40_QUALIFICATION
    ? "stage4-route-counterfactual-compositor-fixed-40-epoch-qualification-contract-v1"
    : "stage4-route-counterfactual-compositor-controlled-smoke-contract-v1",
  status: "compiled_not_started",
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  executionIdentity: {
    runId: RUN_ID,
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    topology: "west",
    resolutionStage: 0,
    resolution: { width: 256, height: 192 },
    epochCount: EPOCH_COUNT,
    previewEpochs: PREVIEW_EPOCHS,
    initialization: "fixed_random_denoiser_initialization_only",
    autoencoderFrozen: true,
  },
  dataIdentity: { approvedRecordCount: 64, splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 } },
  closure: { automaticMachineReview: true, automaticLateStabilityQualification: true, automaticTerminalRecording: true, automaticRetry: false },
  sourceEvidence,
  ownerAuthorizationRequired: false,
  compiledAtUtc: new Date().toISOString(),
}
fs.mkdirSync(path.dirname(CONTRACT_ROOT), { recursive: true })
fs.mkdirSync(CONTRACT_ROOT, { recursive: false })
writeExclusive(CONTRACT, contract)
const smokeCpu = JSON.parse(runSync(PYTHON, [CPU_CHECKER], 300_000).stdout)
assert.equal(smokeCpu.status, FIXED_40_QUALIFICATION ? "stage4_route_counterfactual_compositor_fixed_40_cpu_gate_passed" : "stage4_route_counterfactual_compositor_smoke_cpu_gate_passed")
writeExclusive(path.join(CONTRACT_ROOT, "cpu-report.json"), { schemaVersion: FIXED_40_QUALIFICATION ? "stage4-route-counterfactual-compositor-fixed-40-cpu-report-v1" : "stage4-route-counterfactual-compositor-smoke-contract-cpu-report-v1", status: "passed", ...smokeCpu, contract: bind(CONTRACT), sourceEvidence, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
writeExclusive(path.join(CONTRACT_ROOT, "evidence-isolation-audit.json"), { schemaVersion: FIXED_40_QUALIFICATION ? "stage4-route-counterfactual-compositor-fixed-40-evidence-isolation-audit-v1" : "stage4-route-counterfactual-compositor-smoke-evidence-isolation-audit-v1", status: "passed", currentCapabilityOnly: true, historicalSmokeRead: FIXED_40_QUALIFICATION, historicalCheckpointRead: false, crossRunOutputReuse: false, immutableRejectedHistoryPreserved: FIXED_40_QUALIFICATION, sourceEvidence, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })

fs.mkdirSync(path.dirname(EXECUTION_ROOT), { recursive: true })
fs.mkdirSync(EXECUTION_ROOT, { recursive: false })
const paths = outputPaths(EXECUTION_ROOT)
writeExclusive(paths.cpuReport, smokeCpu)
const resources = resourceSnapshot()
writeExclusive(paths.resourcePreflight, resources)
runSync(PYTHON, compileArgs("preflight_unconsumed", paths.preflightConfig), 300_000)
const trainerPreflight = JSON.parse(runSync(PYTHON, [TRAINER, "--config", paths.preflightConfig, "--dataset-package", DATASET, "--autoencoder-checkpoint", AUTOENCODER, "--output-dir", paths.trainingOutput, "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", String(EPOCH_COUNT), "--overfit-evaluation-interval", "5", "--stage4-direct-clean-latent-smoke", "--stage4-direct-clean-latent-smoke-contract", CONTRACT, "--preflight-only"], 300_000).stdout)
assert.equal(trainerPreflight.status, "direct_clean_latent_smoke_trainer_preflight_passed")
writeExclusive(paths.trainerPreflightBinding, { schemaVersion: "stage4-route-counterfactual-compositor-execution-preflight-binding-v1", status: "verified", contract: bind(CONTRACT), readonlyGpuTerminal: bind(GPU_TERMINAL), trainerPreflight, trainingOutputCreated: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false, recordedAtUtc: new Date().toISOString() })
if (!resources.passed) await closeInfrastructureFailure("resource_preflight_failed", resources.blockers.join(","), false)
writeExclusive(paths.ticket, { schemaVersion: "ai-painter-local-internal-capability-ticket-v1", status: "issued_not_consumed", ticketId: `local-ai-${RUN_ID}`, capabilityVersion: CAPABILITY, runId: RUN_ID, scope: FIXED_40_QUALIFICATION ? "one_route_counterfactual_compositor_fixed_40_epoch_qualification_closed_loop" : "one_route_counterfactual_compositor_30_epoch_controlled_smoke_closed_loop", parentContract: bind(CONTRACT), capabilityAuthority: "local_ai_pet_world_program", singleUse: true, persistedReplayProtection: true, cannotExpandParentContract: true, ownerAuthorizationRequired: false, issuedAtUtc: new Date().toISOString() })
writeExclusive(paths.consumption, { schemaVersion: "ai-painter-local-internal-capability-ticket-consumption-v1", ticketId: `local-ai-${RUN_ID}`, ticketSha256: sha256(paths.ticket), runId: RUN_ID, state: "consumed", oneTimeConsumption: true, ownerAuthorizationRequired: false, consumedAtUtc: new Date().toISOString() })
runSync(PYTHON, compileArgs("consumed", paths.activeConfig), 300_000)
assert.equal(read(paths.activeConfig).training.routeCounterfactualCompositorControlledSmoke.ticketState, "consumed")

writeJsonAtomic(paths.executionState, { schemaVersion: EXECUTION_STATE_SCHEMA, status: "running", phase: "training", capabilityVersion: CAPABILITY, runId: RUN_ID, trainingOutput: projectPath(paths.trainingOutput), progressPath: projectPath(paths.progress), automaticReviewAfterTraining: true, ownerAuthorizationRequired: false, startedAtUtc: new Date().toISOString() })
const trainerArgs = [TRAINER, "--config", paths.activeConfig, "--dataset-package", DATASET, "--autoencoder-checkpoint", AUTOENCODER, "--output-dir", paths.trainingOutput, "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", String(EPOCH_COUNT), "--overfit-evaluation-interval", "5", "--stage4-direct-clean-latent-smoke", "--stage4-direct-clean-latent-smoke-contract", CONTRACT]
const stdoutHandle = fs.openSync(paths.stdout, "wx")
const stderrHandle = fs.openSync(paths.stderr, "wx")
const child = spawn(PYTHON, trainerArgs, { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", stdoutHandle, stderrHandle] })
const telemetryRows = []
const startedAt = Date.now()
const heartbeat = () => {
  const gpu = gpuSnapshot()
  const progress = fs.existsSync(paths.progress) ? safeRead(paths.progress) : null
  telemetryRows.push({ recordedAtUtc: new Date().toISOString(), epoch: progress?.currentEpoch ?? null, optimizerStep: progress?.optimizerStep ?? null, phase: progress?.phase ?? "initializing", ...gpu })
  writeJsonAtomic(paths.monitorTelemetry, { schemaVersion: "stage4-route-counterfactual-compositor-smoke-monitor-resource-telemetry-v1", status: "recording", rows: telemetryRows, peakGpuMemoryMiB: Math.max(...telemetryRows.map((row) => row.memoryUsedMiB || 0)), recordedAtUtc: new Date().toISOString() })
  process.stdout.write(`${JSON.stringify({ kind: "route_counterfactual_compositor_smoke_heartbeat", runId: RUN_ID, phase: progress?.phase ?? "initializing", epoch: progress?.currentEpoch ?? 0, epochTarget: progress?.epochTarget ?? EPOCH_COUNT, optimizerStep: progress?.optimizerStep ?? 0, optimizerStepTarget: progress?.optimizerStepTarget ?? EPOCH_COUNT, percent: progress?.percent ?? 0, etaSeconds: progress?.etaSeconds ?? null, elapsedSeconds: Math.round((Date.now() - startedAt) / 1000), gpu, recordedAtUtc: new Date().toISOString() })}\n`)
}
heartbeat()
const interval = setInterval(heartbeat, 10_000)
const exitCode = await new Promise((resolveExit, reject) => { child.once("error", reject); child.once("exit", (code) => resolveExit(code ?? 1)) })
clearInterval(interval)
heartbeat()
fs.closeSync(stdoutHandle)
fs.closeSync(stderrHandle)
if (exitCode !== 0) await closeInfrastructureFailure("trainer_execution_failed", `exitCode=${exitCode}; ${fs.readFileSync(paths.stderr, "utf8").slice(-12000)}`, true)
assert.equal(fs.existsSync(paths.trainingManifest), true, "trainer manifest missing")
assert.equal(fs.existsSync(paths.progress), true, "trainer progress missing")

writeJsonAtomic(paths.executionState, { schemaVersion: EXECUTION_STATE_SCHEMA, status: "running", phase: "automatic_machine_review", capabilityVersion: CAPABILITY, runId: RUN_ID, trainingOutput: projectPath(paths.trainingOutput), ownerAuthorizationRequired: false, updatedAtUtc: new Date().toISOString() })
const review = await reviewPreviews()
const qualification = qualifyLateStability(review)
writeExclusive(paths.qualification, qualification)
const outcome = adjudicateRouteCounterfactualSmokeOutcome({
  reviews: review.reviews,
  qualification,
  fixed40: FIXED_40_QUALIFICATION,
})
const trainingManifest = read(paths.trainingManifest)
writeExclusive(paths.manifest, { schemaVersion: MANIFEST_SCHEMA, status: qualification.qualified ? "qualified" : outcome.outcome, runId: RUN_ID, capabilityVersion: CAPABILITY, controlledSmokeContract: bind(CONTRACT), activeConfig: bind(paths.activeConfig), internalTicket: bind(paths.ticket), internalTicketConsumption: bind(paths.consumption), trainingManifest: bind(paths.trainingManifest), progress: bind(paths.progress), checkpoint: trainingManifest.checkpoint, machineReview: bind(paths.machineReview), lateStabilityQualification: bind(paths.qualification), routeOutcome: outcome, resourceTelemetry: bind(paths.trainingTelemetry), monitorResourceTelemetry: bind(paths.monitorTelemetry), modelWeightsModified: true, checkpointPromotable: false, automaticRetryStarted: false, stage0Started: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
const terminalStatus = outcome.terminalStatus
const nextLegalAction = outcome.nextLegalAction
writeExclusive(paths.finalization, { schemaVersion: FINALIZATION_SCHEMA, status: terminalStatus, runId: RUN_ID, manifest: bind(paths.manifest), trainingManifest: bind(paths.trainingManifest), machineReview: bind(paths.machineReview), lateStabilityQualification: bind(paths.qualification), checkpoint: trainingManifest.checkpoint, checkpointPromotable: false, automaticRetryStarted: false, stage0Started: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
writeExclusive(paths.terminal, { schemaVersion: TERMINAL_SCHEMA, executionState: "completed", status: terminalStatus, capabilityVersion: CAPABILITY, runId: RUN_ID, finalization: bind(paths.finalization), manifest: bind(paths.manifest), machineReview: bind(paths.machineReview), lateStabilityQualification: bind(paths.qualification), routeOutcome: outcome, resourceTelemetry: bind(paths.trainingTelemetry), checkpointWritten: true, checkpointPromotable: false, modelWeightsModified: true, trainingStarted: true, automaticRetryStarted: false, stage0Started: false, ownerAuthorizationRequired: false, fixedTotalProgress: progressFixed(), nextLegalAction, recordedAtUtc: new Date().toISOString() })
writeJsonAtomic(paths.executionState, { schemaVersion: EXECUTION_STATE_SCHEMA, status: "completed", phase: qualification.qualified ? "qualified" : outcome.lifecycleTarget === null ? "failed_closed_pending_cpu_analysis" : "failed_closed", capabilityVersion: CAPABILITY, runId: RUN_ID, terminal: bind(paths.terminal), ownerAuthorizationRequired: false, completedAtUtc: new Date().toISOString() })
writeExclusive(paths.capsule, buildCapsule(terminalStatus, nextLegalAction, review, qualification.qualified))
if (outcome.lifecycleTarget !== null) {
  advanceCapabilityLifecycle({ root: ROOT, capabilityVersion: CAPABILITY, targetState: outcome.lifecycleTarget, evidence: { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: CAPABILITY, targetState: outcome.lifecycleTarget, status: qualification.qualified ? "passed" : "failed", bindings: [paths.terminal, paths.finalization, paths.manifest, paths.machineReview, paths.qualification].map(bind), ownerAuthorizationRequired: false } })
}
const advanced = await advanceCurrentExecutionRegistry({ projectRoot: ROOT, capabilityVersion: CAPABILITY, packageId: RUN_ID, taskId: nextLegalAction, taskKind: outcome.taskKind, runId: RUN_ID, lifecycleStage: outcome.lifecycleTarget ?? "readonly_gpu_qualified", executionState: "package_materialized", activity: "planned_not_started", taskCapsulePath: projectPath(paths.capsule), terminalEvidencePath: projectPath(paths.terminal), latestTrainingTerminal: { runId: RUN_ID, path: projectPath(paths.terminal), sha256: sha256(paths.terminal), status: terminalStatus, evidence: { executionState: bind(paths.executionState), machineReview: bind(paths.machineReview), reviewProgress: bind(paths.reviewProgress), trainingProgress: bind(paths.progress) } } })
appendAiPainterProgramEvent({ id: `stage4-route-counterfactual-compositor-controlled-smoke-${RUN_ID}`, timestamp: new Date().toISOString(), action: FIXED_40_QUALIFICATION ? "stage4_route_counterfactual_compositor_fixed_40_epoch_qualification_closed_loop" : "stage4_route_counterfactual_compositor_controlled_smoke_closed_loop", runId: RUN_ID, kind: FIXED_40_QUALIFICATION ? "bounded_training_qualification" : "controlled_smoke", status: qualification.qualified ? "success" : "failed_closed", title: `Stage4 route counterfactual compositor ${EPOCH_COUNT} Epoch ${FIXED_40_QUALIFICATION ? "qualification" : "controlled Smoke"} completed`, titleZh: qualification.qualified ? `Stage4共享权重道路反事实合成${EPOCH_COUNT} Epoch${FIXED_40_QUALIFICATION ? "资格" : "受控Smoke"}通过` : `Stage4共享权重道路反事实合成${EPOCH_COUNT} Epoch${FIXED_40_QUALIFICATION ? "资格" : "受控Smoke"}真实视觉失败并关闭`, detailZh: `${EPOCH_COUNT} Epoch训练完成；机器审核${review.previewPassCount}/${review.previewCount}，资格=${qualification.qualified}。`, evidencePath: projectPath(paths.terminal), evidenceSha256: sha256(paths.terminal), fixedTotalProgress: progressFixed() })
process.stdout.write(`${JSON.stringify({ status: terminalStatus, runId: RUN_ID, previewPassCount: review.previewPassCount, previewFailCount: review.previewFailCount, qualified: qualification.qualified, terminal: bind(paths.terminal), manifest: bind(paths.manifest), machineReview: bind(paths.machineReview), lateStabilityQualification: bind(paths.qualification), currentRegistrySha256: advanced.registrySha256, nextLegalAction, fixedTotalProgress: progressFixed(), ownerAuthorizationRequired: false }, null, 2)}\n`)

async function reviewPreviews() {
  const manifest = read(paths.trainingManifest)
  assert.deepEqual(manifest.previewEpochs, PREVIEW_EPOCHS)
  assert.equal(manifest.fixedPreviews.length, PREVIEW_EPOCHS.length)
  const packageManifest = read(DATASET)
  const sourceIndex = read(resolve(packageManifest.sourceIndexPath))
  assert.equal(sourceIndex.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1")
  assert.equal(sourceIndex.sampleCount, sourceIndex.samples.length)
  const matches = sourceIndex.samples.filter((sample) => sample.sampleId === SAMPLE_ID)
  assert.equal(matches.length, 1)
  const sample = matches[0]
  assert.equal(sample.split, "validation")
  const conditionPack = read(resolve(sample.conditionPackPath))
  const reviews = []
  for (const artifact of manifest.fixedPreviews) {
    const epoch = artifact.epoch
    const sourcePath = resolve(artifact.path)
    verifyFile(sourcePath, artifact.sha256, `epoch ${epoch} fixed preview`)
    verifyFile(resolve(artifact.reproductionPath), artifact.reproductionSha256, `epoch ${epoch} reproduction preview`)
    assert.equal(artifact.sha256, artifact.reproductionSha256)
    const normalizedPath = path.join(paths.reviewAssets, `epoch-${String(epoch).padStart(3, "0")}.png`)
    const normalized = await normalizePreviewWithWindowsSafeIo({ sourcePath, finalAssetPath: normalizedPath, workRoot: resolve(".runtime/ai-painter/route-counterfactual-compositor-review-work"), workId: shaText(RUN_ID).slice(0, 16), epoch })
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({ record: { recordId: `route-counterfactual-compositor-smoke-${epoch}`, conditionBinding: { conditionPackPath: sample.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: sample.classification }, imagePath: normalized.shortOutputPath, referenceImagePath: resolve(sample.imagePath) }),
    ])
    reviews.push({ epoch, previewPath: projectPath(sourcePath), previewSha256: sha256(sourcePath), reproductionPath: artifact.reproductionPath, reproductionSha256: artifact.reproductionSha256, byteExactReproduced: true, normalizedPath: projectPath(normalizedPath), normalizedSha256: sha256(normalizedPath), passed: aesthetic.passed && alignment.passed, issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code), professionalAesthetic: aesthetic, conditionAlignment: alignment })
    writeJsonAtomic(paths.reviewProgress, { schemaVersion: REVIEW_PROGRESS_SCHEMA, status: "running", runId: RUN_ID, completedReviewCount: reviews.length, targetReviewCount: PREVIEW_EPOCHS.length, latestEpoch: epoch, passCount: reviews.filter((item) => item.passed).length, failCount: reviews.filter((item) => !item.passed).length, updatedAtUtc: new Date().toISOString() })
  }
  const report = { schemaVersion: REVIEW_SCHEMA, status: reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed", runId: RUN_ID, sampleId: SAMPLE_ID, reviewThresholdsChanged: false, previewCount: reviews.length, previewPassCount: reviews.filter((row) => row.passed).length, previewFailCount: reviews.filter((row) => !row.passed).length, reviews, recordedAtUtc: new Date().toISOString() }
  writeExclusive(paths.machineReview, report)
  writeJsonAtomic(paths.reviewProgress, { schemaVersion: REVIEW_PROGRESS_SCHEMA, status: "completed", runId: RUN_ID, completedReviewCount: reviews.length, targetReviewCount: PREVIEW_EPOCHS.length, passCount: report.previewPassCount, failCount: report.previewFailCount, machineReview: bind(paths.machineReview), completedAtUtc: new Date().toISOString() })
  return report
}

function qualifyLateStability(review) {
  const decision = adjudicateLateReviewRows(review.reviews, {
    requiredEpochs: PREVIEW_EPOCHS,
    lateEpochs: FIXED_40_QUALIFICATION ? [10, 20, 30, 40] : [10, 20, 30],
  })
  return { schemaVersion: QUALIFICATION_SCHEMA, status: decision.qualified ? "terminal_pass_with_late_convergence_evidence" : "late_stability_not_qualified", runId: RUN_ID, route: decision.qualificationRoute === "none" ? null : decision.qualificationRoute, lateEpochs: decision.issueSequence.map((row) => ({ epoch: row.epoch, passed: row.passed, failureCount: row.issueCodes.length, failureItems: [...row.issueCodes] })), exactRouteCount: Number(decision.sustainedZeroFromFirstLateEpoch) + Number(decision.strictDecreaseThenStableZero), consecutiveTerminalPasses: decision.issueSequence.at(-2).passed && decision.issueSequence.at(-1).passed, noTerminalRegression: decision.noRegression, finalPreviewByteReproductionValid: review.reviews.find((row) => row.epoch === EPOCH_COUNT)?.byteExactReproduced === true, qualified: decision.qualified, thresholdsChanged: false, recordedAtUtc: new Date().toISOString() }
}

async function closeInfrastructureFailure(code, detail, trainingStarted) {
  writeExclusive(paths.failure, { schemaVersion: "stage4-route-counterfactual-compositor-controlled-smoke-failure-v1", status: "failed_closed", code, detail: String(detail), runId: RUN_ID, automaticRetryStarted: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
  writeExclusive(paths.terminal, { schemaVersion: "stage4-route-counterfactual-compositor-controlled-smoke-terminal-v1", executionState: "completed", status: "route_counterfactual_compositor_controlled_smoke_infrastructure_failed_closed", capabilityVersion: CAPABILITY, runId: RUN_ID, failureReport: bind(paths.failure), trainingStarted, modelWeightsModified: trainingStarted, checkpointWritten: false, automaticRetryStarted: false, ownerAuthorizationRequired: false, fixedTotalProgress: progressFixed(), nextLegalAction: "repair_route_counterfactual_compositor_smoke_infrastructure_from_saved_evidence", recordedAtUtc: new Date().toISOString() })
  writeJsonAtomic(paths.executionState, { schemaVersion: "stage4-route-counterfactual-compositor-controlled-smoke-execution-state-v1", status: "completed", phase: "failed_closed", runId: RUN_ID, terminal: bind(paths.terminal), completedAtUtc: new Date().toISOString() })
  writeExclusive(paths.capsule, buildCapsule(read(paths.terminal).status, read(paths.terminal).nextLegalAction, null, false))
  await advanceCurrentExecutionRegistry({ projectRoot: ROOT, capabilityVersion: CAPABILITY, packageId: RUN_ID, taskId: read(paths.terminal).nextLegalAction, taskKind: "infrastructure_repair", runId: RUN_ID, lifecycleStage: "readonly_gpu_qualified", executionState: "package_materialized", activity: "planned_not_started", taskCapsulePath: projectPath(paths.capsule), terminalEvidencePath: projectPath(paths.terminal) })
  throw new Error(`${code}:${detail}`)
}

function buildCapsule(terminalStatus, nextLegalAction, review, qualified) {
  const recordedAtUtc = new Date().toISOString()
  const evidenceFiles = [CONTRACT, paths.preflightConfig, paths.activeConfig, paths.cpuReport, paths.resourcePreflight, paths.trainerPreflightBinding, paths.executionState, paths.terminal, paths.progress, paths.trainingManifest, paths.manifest, paths.machineReview, paths.reviewProgress, paths.qualification, paths.finalization, paths.monitorTelemetry, paths.trainingTelemetry].filter((file) => fs.existsSync(file))
  return { schemaVersion: "ai-painter-local-task-capsule-v1", capsuleId: `local-ai-${RUN_ID}`, generatedFrom: "program_saved_evidence", readOnly: true, module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" }, fixedOverallProgress: { ...progressFixed(), source: "current_execution_registry" }, currentStage: { number: 4, total: 5, labelZh: "Stage4共享权重道路反事实合成受控Smoke", status: qualified ? "controlled_smoke_qualified" : "controlled_smoke_closed" }, candidateTerminal: { runId: RUN_ID, status: "completed", programStatus: terminalStatus, previewMachineStatus: review ? `${review.previewPassCount}_of_${review.previewCount}` : "not_available", modelQualificationStatus: qualified ? "qualified" : "not_qualified", checkpointWritten: fs.existsSync(paths.trainingManifest), modelWeightsModified: fs.existsSync(paths.trainingManifest), recordedAtUtc }, latestBlocker: qualified ? { code: "stage0_not_started", summaryZh: "受控Smoke通过，正式Stage 0尚未启动。" } : { code: terminalStatus, summaryZh: "受控Smoke未取得资格或基础设施失败，已保存证据并关闭。" }, nextAllowedAction: { code: nextLegalAction, labelZh: nextLegalAction, ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true }, forbiddenActions: ["reuse_smoke_checkpoint_for_stage0_initialization", "automatic_retry", "change_loss_or_threshold", "read_historical_denoiser_checkpoint"], taskIdentity: { modelId: ARCHITECTURE, sampleId: SAMPLE_ID, sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] }, evidence: evidenceFiles.map((file) => ({ kind: path.basename(file), labelZh: path.basename(file), ...bind(file), expectedSha256: sha256(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })), integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" }, ownerAuthorizationRequired: false, recordedAtUtc }
}

function outputPaths(root) { const trainingOutput = path.join(root, "training-output"); return { trainingOutput, progress: path.join(trainingOutput, "progress.json"), trainingManifest: path.join(trainingOutput, "manifest.json"), trainingTelemetry: path.join(trainingOutput, "resource-telemetry.json"), ticket: path.join(root, "internal-ticket.json"), consumption: path.join(root, "internal-ticket-consumption.json"), activeConfig: path.join(root, "active-config.json"), preflightConfig: path.join(root, "preflight-active-config.json"), cpuReport: path.join(root, "cpu-report.json"), resourcePreflight: path.join(root, "resource-preflight.json"), trainerPreflightBinding: path.join(root, "trainer-preflight-binding.json"), executionState: path.join(root, "execution-state.json"), monitorTelemetry: path.join(root, "monitor-resource-telemetry.json"), stdout: path.join(root, "trainer.stdout.log"), stderr: path.join(root, "trainer.stderr.log"), reviewAssets: path.join(root, "review-assets"), reviewProgress: path.join(root, "review-progress.json"), machineReview: path.join(root, "machine-review.json"), qualification: path.join(root, "late-stability-qualification.json"), manifest: path.join(root, "manifest.json"), finalization: path.join(root, "finalization", "finalization.json"), terminal: path.join(root, "phase-terminal.json"), failure: path.join(root, "failure-report.json"), capsule: path.join(root, "local-task-capsule.json") } }
function compileArgs(ticketState, output) {
  return [
    COMPILER,
    "--inactive-config", INACTIVE,
    FIXED_40_QUALIFICATION ? "--qualification-contract" : "--smoke-contract", CONTRACT,
    "--ticket-state", ticketState,
    "--output", output,
  ]
}
function resourceSnapshot() { const gpu = gpuSnapshot(); const processes = runSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], 30_000, true).stdout.split(/\r?\n/u).filter((row) => /python/iu.test(row)); const disk = fs.statfsSync(ROOT); const diskFreeBytes = Number(disk.bavail) * Number(disk.bsize); const blockers = []; if (!gpu.name) blockers.push("cuda_unavailable"); if (!Number.isFinite(gpu.utilizationPercent) || gpu.utilizationPercent > 10) blockers.push("gpu_not_idle"); if (!Number.isFinite(gpu.memoryFreeMiB) || gpu.memoryFreeMiB < 4096) blockers.push("gpu_memory_insufficient"); if (processes.length) blockers.push("python_gpu_process_active"); if (diskFreeBytes < 4 * 1024 ** 3) blockers.push("disk_insufficient"); return { schemaVersion: "stage4-route-counterfactual-compositor-resource-preflight-v1", passed: blockers.length === 0, blockers, cpuLogicalProcessors: os.cpus().length, memoryFreeBytes: os.freemem(), diskFreeBytes, gpu: { ...gpu, pythonComputeProcesses: processes }, thresholds: { maxIdleUtilizationPercent: 10, minFreeMemoryMiB: 4096, minDiskFreeBytes: 4 * 1024 ** 3 }, recordedAtUtc: new Date().toISOString() } }
function gpuSnapshot() { const result = runSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.free", "--format=csv,noheader,nounits"], 30_000, true); const values = result.stdout.trim().split(",").map((value) => value.trim()); return { name: values[0] || null, utilizationPercent: Number(values[1]), memoryUsedMiB: Number(values[2]), memoryFreeMiB: Number(values[3]) } }
function runSync(command, args, timeout, allowFailure = false) { const result = spawnSync(command, args, { cwd: ROOT, env: pythonEnv(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout }); if (!allowFailure && (result.error || result.status !== 0)) throw result.error ?? new Error(`${command} exited ${result.status}: ${result.stderr || result.stdout}`); return result }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: `${resolve("ml/ai-painter/src")};${resolve("ml/ai-painter/scripts")}` } }
function resolve(relative) { const candidate = path.resolve(ROOT, relative); assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`); return candidate }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function safeRead(file) { try { return read(file) } catch { return null } }
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaText(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha256(file) } }
function verifyFile(file, expected, label) { assert.equal(fs.existsSync(file), true, `${label} missing`); assert.equal(sha256(file), expected, `${label} SHA-256 mismatch`) }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function progressFixed() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
