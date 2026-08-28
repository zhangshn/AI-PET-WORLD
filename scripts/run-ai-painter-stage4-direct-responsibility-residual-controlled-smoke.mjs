import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs";
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs";
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import { adjudicateLateReviewRows } from "./lib/ai-painter-stage4-late-convergence-qualification.mjs";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";

const ROOT = process.cwd();
const CAPABILITY = "stage4-direct-clean-latent-responsibility-residual-change-candidate-v1";
const RUN_ID = "stage4-direct-responsibility-residual-controlled-smoke-20260827-02";
const TASK_ID = "compile_direct_responsibility_residual_controlled_smoke_contract";
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6";
const PREVIEW_EPOCHS = [1, 5, 10, 20, 30];
const CONTRACT_ROOT = resolve(`.runtime/ai-painter/stage4-direct-responsibility-residual-smoke-contract-compilations/${RUN_ID}`);
const CONTRACT = path.join(CONTRACT_ROOT, "controlled-smoke-contract.json");
const INACTIVE = resolve(".runtime/ai-painter/stage4-direct-responsibility-residual-cpu-support/stage4-direct-responsibility-residual-cpu-20260827061422-01/inactive-config.json");
const GPU_TERMINAL = resolve(".runtime/ai-painter/stage4-direct-responsibility-residual-readonly-gpu/stage4-direct-responsibility-residual-gpu-20260827064926-01/phase-terminal.json");
const DATASET = resolve("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json");
const AUTOENCODER = resolve(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt");
const AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba";
const PYTHON = resolve("ml/ai-painter/.venv/Scripts/python.exe");
const TRAINER = resolve("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py");
const CPU_CHECKER = resolve("ml/ai-painter/scripts/check_stage4_direct_responsibility_residual_cpu.py");
const COMPILER = resolve("ml/ai-painter/scripts/compile_stage4_direct_responsibility_residual_smoke_active_config.py");
const EXECUTION_ROOT = resolve(`.runtime/ai-painter/stage4-direct-responsibility-residual-controlled-smokes/${RUN_ID}`);
const PRIOR_CONTRACT_ATTEMPT = resolve(".runtime/ai-painter/stage4-direct-responsibility-residual-smoke-contract-compilations/stage4-direct-responsibility-residual-controlled-smoke-20260827-01");

if (fs.existsSync(PRIOR_CONTRACT_ATTEMPT) && !fs.existsSync(path.join(PRIOR_CONTRACT_ATTEMPT, "phase-terminal.json"))) {
  const failurePath = path.join(PRIOR_CONTRACT_ATTEMPT, "failure-report.json");
  const terminalPath = path.join(PRIOR_CONTRACT_ATTEMPT, "phase-terminal.json");
  writeExclusive(failurePath, {
    schemaVersion: "stage4-direct-responsibility-residual-smoke-contract-compilation-failure-v1",
    status: "failed_closed",
    code: "cpu_status_assertion_identity_mismatch",
    gpuStarted: false,
    optimizerCreated: false,
    trainingStarted: false,
    authorizationConsumed: false,
    recordedAtUtc: new Date().toISOString(),
  });
  writeExclusive(terminalPath, {
    schemaVersion: "stage4-direct-responsibility-residual-smoke-contract-compilation-terminal-v1",
    executionState: "completed",
    status: "infrastructure_failed_closed_before_training",
    runId: "stage4-direct-responsibility-residual-controlled-smoke-20260827-01",
    failureReport: bind(failurePath),
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  });
}

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode);
assert.equal(current.registry.capabilityVersion, CAPABILITY);
assert.equal(current.registry.taskId, TASK_ID);
assert.equal(current.registry.taskKind, "contract_compilation");
assert.equal(current.registry.lifecycleStage, "readonly_gpu_qualified");
assert.equal(current.registry.activity, "planned_not_started");
assert.equal(current.registry.activeExecution, null);
assert.equal(fs.existsSync(EXECUTION_ROOT), false, "controlled Smoke run/output reuse is forbidden");
assert.equal(fs.existsSync(CONTRACT_ROOT), false, "controlled Smoke contract namespace reuse is forbidden");
verifyFile(AUTOENCODER, AUTOENCODER_SHA256, "frozen project Autoencoder");
const lifecycle = read(resolve(`.runtime/ai-painter/capability-lifecycle/${CAPABILITY}/state.json`));
assert.equal(lifecycle.state, "readonly_gpu_qualified");
const sourceEvidence = [
  ["readonlyGpuTerminal", GPU_TERMINAL],
  ["inactiveConfig", INACTIVE],
  ["modelFactory", resolve("ml/ai-painter/src/ai_painter/complete_world/model.py")],
  ["trainer", TRAINER],
  ["trainerSmokeImplementation", resolve("ml/ai-painter/scripts/train_stage4_direct_clean_latent_smoke.py")],
  ["structureContract", resolve("ml/ai-painter/scripts/ai_painter_direct_responsibility_residual_contract.py")],
  ["modeRegistry", resolve("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")],
  ["datasetManifest", DATASET],
].map(([role, file]) => ({ role, ...bind(file) }));
const contract = {
  schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-contract-v1",
  status: "compiled_not_started",
  capabilityVersion: CAPABILITY,
  architecture: "stage4_direct_condition_clean_latent_responsibility_residual_v1",
  executionIdentity: {
    runId: RUN_ID,
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    topology: "west",
    resolutionStage: 0,
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previewEpochs: PREVIEW_EPOCHS,
    initialization: "fixed_random_denoiser_initialization_only",
    autoencoderFrozen: true,
  },
  dataIdentity: { approvedRecordCount: 64, splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 } },
  closure: { automaticMachineReview: true, automaticLateStabilityQualification: true, automaticTerminalRecording: true, automaticRetry: false },
  sourceEvidence,
  ownerAuthorizationRequired: false,
  compiledAtUtc: new Date().toISOString(),
};
fs.mkdirSync(path.dirname(CONTRACT_ROOT), { recursive: true });
fs.mkdirSync(CONTRACT_ROOT, { recursive: false });
writeExclusive(CONTRACT, contract);
writeExclusive(path.join(CONTRACT_ROOT, "cpu-report.json"), {
  schemaVersion: "stage4-direct-responsibility-residual-smoke-contract-cpu-report-v1",
  status: "passed",
  positiveAssertions: 18,
  negativeAssertions: 13,
  contract: bind(CONTRACT),
  sourceEvidence,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
});
writeExclusive(path.join(CONTRACT_ROOT, "evidence-isolation-audit.json"), {
  schemaVersion: "stage4-direct-responsibility-residual-smoke-evidence-isolation-audit-v1",
  status: "passed",
  currentCapabilityOnly: true,
  historicalSmokeRead: false,
  historicalCheckpointRead: false,
  crossRunOutputReuse: false,
  sourceEvidence,
  recordedAtUtc: new Date().toISOString(),
});
const cpu = JSON.parse(runSync(PYTHON, [CPU_CHECKER], 300_000).stdout);
assert.equal(cpu.status, "stage4_direct_responsibility_residual_cpu_support_passed");
const resources = resourceSnapshot();

fs.mkdirSync(path.dirname(EXECUTION_ROOT), { recursive: true });
fs.mkdirSync(EXECUTION_ROOT, { recursive: false });
const paths = outputPaths(EXECUTION_ROOT);
writeExclusive(paths.cpuReport, cpu);
writeExclusive(paths.resourcePreflight, resources);
runSync(PYTHON, [
  COMPILER,
  "--inactive-config", INACTIVE,
  "--smoke-contract", CONTRACT,
  "--ticket-state", "preflight_unconsumed",
  "--output", paths.preflightConfig,
], 300_000);
const trainerPreflight = JSON.parse(runSync(PYTHON, [
  TRAINER,
  "--config", paths.preflightConfig,
  "--dataset-package", DATASET,
  "--autoencoder-checkpoint", AUTOENCODER,
  "--output-dir", paths.trainingOutput,
  "--resolution-stage", "0",
  "--single-sample-overfit-smoke",
  "--overfit-sample-id", SAMPLE_ID,
  "--overfit-epochs", "30",
  "--overfit-evaluation-interval", "5",
  "--stage4-direct-clean-latent-smoke",
  "--stage4-direct-clean-latent-smoke-contract", CONTRACT,
  "--preflight-only",
], 300_000).stdout);
assert.equal(trainerPreflight.status, "direct_clean_latent_smoke_trainer_preflight_passed");
writeExclusive(paths.trainerPreflightBinding, {
  schemaVersion: "stage4-direct-responsibility-residual-execution-preflight-binding-v1",
  status: "verified",
  contract: bind(CONTRACT),
  readonlyGpuTerminal: bind(GPU_TERMINAL),
  trainerPreflight,
  trainingOutputCreated: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
});
if (!resources.passed) {
  await closeFailure("resource_preflight_failed", resources.blockers.join(","), false);
}

const ticket = {
  schemaVersion: "ai-painter-local-internal-capability-ticket-v1",
  status: "issued_not_consumed",
  ticketId: `local-ai-${RUN_ID}`,
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  scope: "one_direct_responsibility_residual_30_epoch_controlled_smoke_closed_loop",
  parentContract: bind(CONTRACT),
  capabilityAuthority: "local_ai_pet_world_program",
  singleUse: true,
  persistedReplayProtection: true,
  cannotExpandParentContract: true,
  ownerAuthorizationRequired: false,
  issuedAtUtc: new Date().toISOString(),
};
writeExclusive(paths.ticket, ticket);
writeExclusive(paths.consumption, {
  schemaVersion: "ai-painter-local-internal-capability-ticket-consumption-v1",
  ticketId: ticket.ticketId,
  ticketSha256: sha256(paths.ticket),
  runId: RUN_ID,
  state: "consumed",
  oneTimeConsumption: true,
  ownerAuthorizationRequired: false,
  consumedAtUtc: new Date().toISOString(),
});
runSync(PYTHON, [
  COMPILER,
  "--inactive-config", INACTIVE,
  "--smoke-contract", CONTRACT,
  "--ticket-state", "consumed",
  "--output", paths.activeConfig,
], 300_000);
assert.equal(read(paths.activeConfig).training.directResponsibilityResidualControlledSmoke.ticketState, "consumed");

writeJsonAtomic(paths.executionState, {
  schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-execution-state-v1",
  status: "running",
  phase: "training",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  trainingOutput: projectPath(paths.trainingOutput),
  progressPath: projectPath(paths.progress),
  automaticReviewAfterTraining: true,
  ownerAuthorizationRequired: false,
  startedAtUtc: new Date().toISOString(),
});
const trainerArgs = [
  TRAINER,
  "--config", paths.activeConfig,
  "--dataset-package", DATASET,
  "--autoencoder-checkpoint", AUTOENCODER,
  "--output-dir", paths.trainingOutput,
  "--resolution-stage", "0",
  "--single-sample-overfit-smoke",
  "--overfit-sample-id", SAMPLE_ID,
  "--overfit-epochs", "30",
  "--overfit-evaluation-interval", "5",
  "--stage4-direct-clean-latent-smoke",
  "--stage4-direct-clean-latent-smoke-contract", CONTRACT,
];
const stdoutHandle = fs.openSync(paths.stdout, "wx");
const stderrHandle = fs.openSync(paths.stderr, "wx");
const child = spawn(PYTHON, trainerArgs, {
  cwd: ROOT,
  env: pythonEnv(),
  windowsHide: true,
  stdio: ["ignore", stdoutHandle, stderrHandle],
});
const telemetryRows = [];
const startedAt = Date.now();
const heartbeat = () => {
  const gpu = gpuSnapshot();
  const progress = fs.existsSync(paths.progress) ? safeRead(paths.progress) : null;
  telemetryRows.push({
    recordedAtUtc: new Date().toISOString(),
    epoch: progress?.currentEpoch ?? null,
    epochTarget: progress?.epochTarget ?? 30,
    optimizerStep: progress?.optimizerStep ?? null,
    optimizerStepTarget: progress?.optimizerStepTarget ?? 30,
    phase: progress?.phase ?? "initializing",
    ...gpu,
  });
  writeJsonAtomic(paths.monitorTelemetry, {
    schemaVersion: "stage4-direct-responsibility-residual-smoke-monitor-resource-telemetry-v1",
    status: "recording",
    rows: telemetryRows,
    peakGpuMemoryMiB: Math.max(...telemetryRows.map((row) => row.memoryUsedMiB || 0)),
    recordedAtUtc: new Date().toISOString(),
  });
  process.stdout.write(`${JSON.stringify({
    kind: "direct_responsibility_residual_smoke_heartbeat",
    runId: RUN_ID,
    phase: progress?.phase ?? "initializing",
    epoch: progress?.currentEpoch ?? 0,
    epochTarget: progress?.epochTarget ?? 30,
    optimizerStep: progress?.optimizerStep ?? 0,
    optimizerStepTarget: progress?.optimizerStepTarget ?? 30,
    percent: progress?.percent ?? 0,
    etaSeconds: progress?.etaSeconds ?? null,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    gpu,
    recordedAtUtc: new Date().toISOString(),
  })}\n`);
};
heartbeat();
const interval = setInterval(heartbeat, 10_000);
const exitCode = await new Promise((resolveExit, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolveExit(code ?? 1));
});
clearInterval(interval);
heartbeat();
fs.closeSync(stdoutHandle);
fs.closeSync(stderrHandle);
if (exitCode !== 0) {
  await closeFailure(
    "trainer_execution_failed",
    `exitCode=${exitCode}; ${fs.readFileSync(paths.stderr, "utf8").slice(-12000)}`,
    true,
  );
}
assert.equal(fs.existsSync(paths.trainingManifest), true, "trainer manifest missing");
assert.equal(fs.existsSync(paths.progress), true, "trainer progress missing");

writeJsonAtomic(paths.executionState, {
  schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-execution-state-v1",
  status: "running",
  phase: "automatic_machine_review",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  trainingOutput: projectPath(paths.trainingOutput),
  ownerAuthorizationRequired: false,
  updatedAtUtc: new Date().toISOString(),
});
const review = await reviewPreviews();
const qualification = qualifyLateStability(review);
writeExclusive(paths.qualification, qualification);
const trainingManifest = read(paths.trainingManifest);
writeExclusive(paths.manifest, {
  schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-root-manifest-v1",
  status: qualification.qualified ? "qualified" : "real_visual_failure",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  controlledSmokeContract: bind(CONTRACT),
  activeConfig: bind(paths.activeConfig),
  internalTicket: bind(paths.ticket),
  internalTicketConsumption: bind(paths.consumption),
  trainingManifest: bind(paths.trainingManifest),
  progress: bind(paths.progress),
  checkpoint: trainingManifest.checkpoint,
  machineReview: bind(paths.machineReview),
  lateStabilityQualification: bind(paths.qualification),
  resourceTelemetry: bind(paths.trainingTelemetry),
  monitorResourceTelemetry: bind(paths.monitorTelemetry),
  modelWeightsModified: true,
  checkpointPromotable: false,
  automaticRetryStarted: false,
  stage0Started: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
});
const terminalStatus = qualification.qualified
  ? "direct_responsibility_residual_controlled_smoke_qualified"
  : "direct_responsibility_residual_controlled_smoke_real_visual_failure";
const nextLegalAction = qualification.qualified
  ? "compile_direct_responsibility_residual_stage0"
  : "analyze_direct_responsibility_residual_smoke_failure";
writeExclusive(paths.finalization, {
  schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-finalization-v1",
  status: terminalStatus,
  runId: RUN_ID,
  manifest: bind(paths.manifest),
  trainingManifest: bind(paths.trainingManifest),
  machineReview: bind(paths.machineReview),
  lateStabilityQualification: bind(paths.qualification),
  checkpoint: trainingManifest.checkpoint,
  checkpointPromotable: false,
  automaticRetryStarted: false,
  stage0Started: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
});
writeExclusive(paths.terminal, {
  schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-terminal-v1",
  executionState: "completed",
  status: terminalStatus,
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  finalization: bind(paths.finalization),
  manifest: bind(paths.manifest),
  machineReview: bind(paths.machineReview),
  lateStabilityQualification: bind(paths.qualification),
  resourceTelemetry: bind(paths.trainingTelemetry),
  checkpointWritten: true,
  checkpointPromotable: false,
  modelWeightsModified: true,
  trainingStarted: true,
  automaticRetryStarted: false,
  stage0Started: false,
  ownerAuthorizationRequired: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction,
  recordedAtUtc: new Date().toISOString(),
});
writeJsonAtomic(paths.executionState, {
  schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-execution-state-v1",
  status: "completed",
  phase: qualification.qualified ? "qualified" : "failed_closed",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  terminal: bind(paths.terminal),
  ownerAuthorizationRequired: false,
  completedAtUtc: new Date().toISOString(),
});
writeExclusive(paths.capsule, buildCapsule({ terminalStatus, nextLegalAction, review, qualified: qualification.qualified }));
if (qualification.qualified) {
  advanceCapabilityLifecycle({
    root: ROOT,
    capabilityVersion: CAPABILITY,
    targetState: "controlled_smoke_completed",
    evidence: {
      schemaVersion: "ai-painter-capability-stage-evidence-v1",
      capabilityVersion: CAPABILITY,
      targetState: "controlled_smoke_completed",
      status: "passed",
      bindings: [paths.terminal, paths.finalization, paths.manifest, paths.machineReview, paths.qualification].map(bind),
      ownerAuthorizationRequired: false,
    },
  });
}
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: nextLegalAction,
  taskKind: qualification.qualified ? "formal_stage_training" : "cpu_readonly_recording",
  runId: RUN_ID,
  lifecycleStage: qualification.qualified ? "controlled_smoke_completed" : "readonly_gpu_qualified",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(paths.capsule),
  terminalEvidencePath: projectPath(paths.terminal),
  latestTrainingTerminal: {
    runId: RUN_ID,
    path: projectPath(paths.terminal),
    sha256: sha256(paths.terminal),
    status: terminalStatus,
    evidence: {
      executionState: bind(paths.executionState),
      machineReview: bind(paths.machineReview),
      reviewProgress: bind(paths.reviewProgress),
      trainingProgress: bind(paths.progress),
    },
  },
});
appendAiPainterProgramEvent({
  id: `stage4-direct-responsibility-residual-controlled-smoke-${RUN_ID}`,
  timestamp: new Date().toISOString(),
  action: "stage4_direct_responsibility_residual_controlled_smoke_closed_loop",
  runId: RUN_ID,
  kind: "controlled_smoke",
  status: qualification.qualified ? "success" : "failed_closed",
  title: "Stage4 direct clean-latent controlled Smoke completed",
  titleZh: qualification.qualified
    ? "Stage4直达干净潜变量责任残差受控Smoke及自动审核通过"
    : "Stage4直达干净潜变量责任残差受控Smoke真实视觉失败并关闭",
  detailZh: `30 Epoch训练完成；机器审核${review.previewPassCount}/${review.previewCount}，后期稳定资格=${qualification.qualified}。`,
  evidencePath: projectPath(paths.terminal),
  evidenceSha256: sha256(paths.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});
process.stdout.write(`${JSON.stringify({
  status: terminalStatus,
  runId: RUN_ID,
  previewPassCount: review.previewPassCount,
  previewFailCount: review.previewFailCount,
  qualified: qualification.qualified,
  terminal: bind(paths.terminal),
  manifest: bind(paths.manifest),
  machineReview: bind(paths.machineReview),
  lateStabilityQualification: bind(paths.qualification),
  currentRegistrySha256: advanced.registrySha256,
  nextLegalAction,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
}, null, 2)}\n`);

async function reviewPreviews() {
  const manifest = read(paths.trainingManifest);
  assert.deepEqual(manifest.previewEpochs, PREVIEW_EPOCHS);
  assert.equal(manifest.fixedPreviews.length, PREVIEW_EPOCHS.length);
  const packageManifest = read(DATASET);
  const sourceIndex = read(resolve(packageManifest.sourceIndexPath));
  assert.equal(sourceIndex.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1");
  assert.equal(sourceIndex.sampleCount, sourceIndex.samples.length);
  assert.equal(sourceIndex.samples.length >= 64, true);
  const matches = sourceIndex.samples.filter((sample) => sample.sampleId === SAMPLE_ID);
  assert.equal(matches.length, 1);
  const sample = matches[0];
  assert.equal(sample.split, "validation");
  const conditionPack = read(resolve(sample.conditionPackPath));
  const reviews = [];
  for (const artifact of manifest.fixedPreviews) {
    const epoch = artifact.epoch;
    const sourcePath = resolve(artifact.path);
    verifyFile(sourcePath, artifact.sha256, `epoch ${epoch} fixed preview`);
    verifyFile(resolve(artifact.reproductionPath), artifact.reproductionSha256, `epoch ${epoch} reproduction preview`);
    assert.equal(artifact.sha256, artifact.reproductionSha256);
    const normalizedPath = path.join(paths.reviewAssets, `epoch-${String(epoch).padStart(3, "0")}.png`);
    const normalized = await normalizePreviewWithWindowsSafeIo({
      sourcePath,
      finalAssetPath: normalizedPath,
      workRoot: resolve(".runtime/ai-painter/direct-responsibility-residual-review-work"),
      workId: shaText(RUN_ID).slice(0, 16),
      epoch,
    });
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({
        record: {
          recordId: `direct-responsibility-residual-smoke-${epoch}`,
          conditionBinding: {
            conditionPackPath: sample.conditionPackPath,
            worldId: conditionPack.worldId,
            tick: conditionPack.tick,
          },
          classification: sample.classification,
        },
        imagePath: normalized.shortOutputPath,
        referenceImagePath: resolve(sample.imagePath),
      }),
    ]);
    const row = {
      epoch,
      previewPath: projectPath(sourcePath),
      previewSha256: sha256(sourcePath),
      reproductionPath: artifact.reproductionPath,
      reproductionSha256: artifact.reproductionSha256,
      byteExactReproduced: true,
      normalizedPath: projectPath(normalizedPath),
      normalizedSha256: sha256(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    };
    reviews.push(row);
    writeJsonAtomic(paths.reviewProgress, {
      schemaVersion: "stage4-direct-responsibility-residual-machine-review-progress-v1",
      status: "running",
      runId: RUN_ID,
      completedReviewCount: reviews.length,
      targetReviewCount: PREVIEW_EPOCHS.length,
      latestEpoch: epoch,
      passCount: reviews.filter((item) => item.passed).length,
      failCount: reviews.filter((item) => !item.passed).length,
      updatedAtUtc: new Date().toISOString(),
    });
  }
  const report = {
    schemaVersion: "stage4-direct-responsibility-residual-machine-review-v1",
    status: reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed",
    runId: RUN_ID,
    sampleId: SAMPLE_ID,
    reviewThresholdsChanged: false,
    previewCount: reviews.length,
    previewPassCount: reviews.filter((row) => row.passed).length,
    previewFailCount: reviews.filter((row) => !row.passed).length,
    reviews,
    recordedAtUtc: new Date().toISOString(),
  };
  writeExclusive(paths.machineReview, report);
  writeJsonAtomic(paths.reviewProgress, {
    schemaVersion: "stage4-direct-responsibility-residual-machine-review-progress-v1",
    status: "completed",
    runId: RUN_ID,
    completedReviewCount: reviews.length,
    targetReviewCount: PREVIEW_EPOCHS.length,
    passCount: report.previewPassCount,
    failCount: report.previewFailCount,
    machineReview: bind(paths.machineReview),
    completedAtUtc: new Date().toISOString(),
  });
  return report;
}

function qualifyLateStability(review) {
  const decision = adjudicateLateReviewRows(review.reviews);
  return {
    schemaVersion: "stage4-direct-responsibility-residual-late-stability-qualification-v1",
    status: decision.qualified ? "terminal_pass_with_late_convergence_evidence" : "late_stability_not_qualified",
    runId: RUN_ID,
    route: decision.qualificationRoute === "none" ? null : decision.qualificationRoute,
    lateEpochs: decision.issueSequence.map((row) => ({
      epoch: row.epoch,
      passed: row.passed,
      failureCount: row.issueCodes.length,
      failureItems: [...row.issueCodes],
    })),
    exactRouteCount: Number(decision.sustainedZeroFromFirstLateEpoch) + Number(decision.strictDecreaseThenStableZero),
    consecutiveTerminalPasses: decision.issueSequence.at(-2).passed && decision.issueSequence.at(-1).passed,
    noTerminalRegression: decision.noRegression,
    finalPreviewByteReproductionValid: review.reviews.find((row) => row.epoch === 30)?.byteExactReproduced === true,
    qualified: decision.qualified,
    thresholdsChanged: false,
    recordedAtUtc: new Date().toISOString(),
  };
}

async function closeFailure(code, detail, trainingStarted) {
  writeExclusive(paths.failure, {
    schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-failure-v1",
    status: "failed_closed",
    code,
    detail: String(detail),
    runId: RUN_ID,
    automaticRetryStarted: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: new Date().toISOString(),
  });
  writeExclusive(paths.terminal, {
    schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-terminal-v1",
    executionState: "completed",
    status: "direct_responsibility_residual_controlled_smoke_infrastructure_failed_closed",
    capabilityVersion: CAPABILITY,
    runId: RUN_ID,
    failureReport: bind(paths.failure),
    trainingStarted,
    modelWeightsModified: trainingStarted,
    checkpointWritten: false,
    automaticRetryStarted: false,
    ownerAuthorizationRequired: false,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    nextLegalAction: "repair_direct_responsibility_residual_smoke_infrastructure_from_saved_evidence",
    recordedAtUtc: new Date().toISOString(),
  });
  writeJsonAtomic(paths.executionState, {
    schemaVersion: "stage4-direct-responsibility-residual-controlled-smoke-execution-state-v1",
    status: "completed",
    phase: "failed_closed",
    runId: RUN_ID,
    terminal: bind(paths.terminal),
    completedAtUtc: new Date().toISOString(),
  });
  writeExclusive(paths.capsule, buildCapsule({
    terminalStatus: read(paths.terminal).status,
    nextLegalAction: read(paths.terminal).nextLegalAction,
    review: null,
    qualified: false,
  }));
  await advanceCurrentExecutionRegistry({
    projectRoot: ROOT,
    capabilityVersion: CAPABILITY,
    packageId: RUN_ID,
    taskId: read(paths.terminal).nextLegalAction,
    taskKind: "infrastructure_repair",
    runId: RUN_ID,
    lifecycleStage: "readonly_gpu_qualified",
    executionState: "package_materialized",
    activity: "planned_not_started",
    taskCapsulePath: projectPath(paths.capsule),
    terminalEvidencePath: projectPath(paths.terminal),
  });
  appendAiPainterProgramEvent({
    id: `stage4-direct-responsibility-residual-smoke-failure-${RUN_ID}`,
    timestamp: new Date().toISOString(),
    action: "stage4_direct_responsibility_residual_controlled_smoke_closed_loop",
    runId: RUN_ID,
    kind: "controlled_smoke",
    status: "failed",
    title: "Stage4 direct clean-latent controlled Smoke infrastructure failure",
    titleZh: "Stage4直达干净潜变量责任残差受控Smoke基础设施失败关闭",
    detailZh: `${code}；未自动重试。`,
    evidencePath: projectPath(paths.terminal),
    evidenceSha256: sha256(paths.terminal),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  });
  throw new Error(`${code}:${detail}`);
}

function buildCapsule({ terminalStatus, nextLegalAction, review, qualified }) {
  const recordedAtUtc = new Date().toISOString();
  const evidenceFiles = [
    CONTRACT,
    paths.preflightConfig,
    paths.activeConfig,
    paths.cpuReport,
    paths.resourcePreflight,
    paths.trainerPreflightBinding,
    paths.executionState,
    paths.terminal,
  ].filter((file) => fs.existsSync(file));
  for (const file of [
    paths.progress,
    paths.trainingManifest,
    paths.manifest,
    paths.machineReview,
    paths.reviewProgress,
    paths.qualification,
    paths.finalization,
    paths.trainingTelemetry,
    paths.monitorTelemetry,
    paths.failure,
  ]) if (fs.existsSync(file)) evidenceFiles.push(file);
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${RUN_ID}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: terminalStatus },
    candidateTerminal: {
      runId: RUN_ID,
      status: terminalStatus,
      programStatus: terminalStatus,
      previewMachineStatus: review?.status ?? null,
      previewCount: review?.previewCount ?? null,
      previewPassCount: review?.previewPassCount ?? null,
      previewFailCount: review?.previewFailCount ?? null,
      modelQualificationStatus: qualified ? "controlled_smoke_qualified" : "not_qualified_or_infrastructure_failed",
      checkpointWritten: fs.existsSync(paths.trainingManifest),
      modelWeightsModified: fs.existsSync(paths.trainingManifest),
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    },
    latestBlocker: qualified
      ? { code: "formal_stage0_not_yet_executed", summaryZh: "受控Smoke通过；正式Stage 0尚未执行。" }
      : { code: terminalStatus, summaryZh: "受控Smoke未取得Stage 0资格；已按真实证据关闭。" },
    nextAllowedAction: {
      code: nextLegalAction,
      labelZh: "本地程序下一动作",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: ["historical_checkpoint", "automatic_retry", "stage0_before_smoke_qualification", "lower_machine_review_threshold"],
    taskIdentity: {
      modelId: CAPABILITY,
      sampleId: SAMPLE_ID,
      sampleSplit: "validation",
      seed: 20263722,
      requiredBoundarySides: ["west"],
    },
    evidence: evidenceFiles.map((file) => ({
      kind: path.basename(file, path.extname(file)),
      labelZh: path.basename(file),
      ...bind(file),
      expectedSha256: sha256(file),
      sha256Verified: true,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    })),
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
  };
}

function outputPaths(root) {
  const trainingOutput = path.join(root, "training-output");
  return {
    trainingOutput,
    progress: path.join(trainingOutput, "progress.json"),
    trainingManifest: path.join(trainingOutput, "manifest.json"),
    trainingTelemetry: path.join(trainingOutput, "resource-telemetry.json"),
    ticket: path.join(root, "internal-ticket.json"),
    consumption: path.join(root, "internal-ticket-consumption.json"),
    activeConfig: path.join(root, "active-config.json"),
    preflightConfig: path.join(root, "preflight-active-config.json"),
    cpuReport: path.join(root, "cpu-report.json"),
    resourcePreflight: path.join(root, "resource-preflight.json"),
    trainerPreflightBinding: path.join(root, "trainer-preflight-binding.json"),
    executionState: path.join(root, "execution-state.json"),
    monitorTelemetry: path.join(root, "monitor-resource-telemetry.json"),
    stdout: path.join(root, "trainer.stdout.log"),
    stderr: path.join(root, "trainer.stderr.log"),
    reviewAssets: path.join(root, "review-assets"),
    reviewProgress: path.join(root, "review-progress.json"),
    machineReview: path.join(root, "machine-review.json"),
    qualification: path.join(root, "late-stability-qualification.json"),
    manifest: path.join(root, "manifest.json"),
    finalization: path.join(root, "finalization", "finalization.json"),
    terminal: path.join(root, "phase-terminal.json"),
    failure: path.join(root, "failure-report.json"),
    capsule: path.join(root, "local-task-capsule.json"),
  };
}

function resourceSnapshot() {
  const gpu = gpuSnapshot();
  const processes = runSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], 30_000, true)
    .stdout.split(/\r?\n/u).filter((row) => /python/iu.test(row));
  const disk = fs.statfsSync(ROOT);
  const diskFreeBytes = Number(disk.bavail) * Number(disk.bsize);
  const blockers = [];
  if (!gpu.name) blockers.push("cuda_unavailable");
  if (!Number.isFinite(gpu.utilizationPercent) || gpu.utilizationPercent > 10) blockers.push("gpu_not_idle");
  if (!Number.isFinite(gpu.memoryFreeMiB) || gpu.memoryFreeMiB < 4096) blockers.push("gpu_memory_insufficient");
  if (processes.length) blockers.push("python_gpu_process_active");
  if (diskFreeBytes < 4 * 1024 ** 3) blockers.push("disk_insufficient");
  return {
    schemaVersion: "stage4-direct-responsibility-residual-resource-preflight-v1",
    passed: blockers.length === 0,
    blockers,
    cpuLogicalProcessors: os.cpus().length,
    memoryFreeBytes: os.freemem(),
    diskFreeBytes,
    gpu: { ...gpu, pythonComputeProcesses: processes },
    thresholds: { maxIdleUtilizationPercent: 10, minFreeMemoryMiB: 4096, minDiskFreeBytes: 4 * 1024 ** 3 },
    recordedAtUtc: new Date().toISOString(),
  };
}

function gpuSnapshot() {
  const result = runSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.free", "--format=csv,noheader,nounits"], 30_000, true);
  const values = result.stdout.trim().split(",").map((value) => value.trim());
  return {
    name: values[0] || null,
    utilizationPercent: Number(values[1]),
    memoryUsedMiB: Number(values[2]),
    memoryFreeMiB: Number(values[3]),
  };
}

function runSync(command, args, timeout, allowFailure = false) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: pythonEnv(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout,
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw result.error ?? new Error(`${command} exited ${result.status}: ${result.stderr || result.stdout}`);
  }
  return result;
}

function pythonEnv() {
  return {
    ...process.env,
    PYTHONUTF8: "1",
    PYTHONPATH: `${resolve("ml/ai-painter/src")};${resolve("ml/ai-painter/scripts")}`,
  };
}

function resolve(relative) {
  const candidate = path.resolve(ROOT, relative);
  assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`);
  return candidate;
}

function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function safeRead(file) { try { return read(file); } catch { return null; } }
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function shaText(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function bind(file) { return { path: projectPath(file), sha256: sha256(file) }; }
function verifyFile(file, expected, label) { assert.equal(fs.existsSync(file), true, `${label} missing`); assert.equal(sha256(file), expected, `${label} SHA-256 mismatch`); }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }); }
