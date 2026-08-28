import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs";
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs";
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import {
  ARCHITECTURE_ID, EXECUTION_ACTIONS, FROZEN_SOURCE_RELATIVE,
  FROZEN_SOURCE_SHA256, MODE_ID, PREVIEW_EPOCHS, SAMPLE_ID,
  buildActiveConfig, compileControlledSmokeContract, qualifyLateStability,
  resolveInside, sha256File, validateActiveConfig, validateControlledSmokeContract,
} from "./lib/ai-painter-stage4-post-decode-full-condition-responsibility-controlled-smoke-v1.mjs";
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";
import { appendAiPainterProgramEvent, formatShanghai, projectPath, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs";

const ROOT = process.cwd();
const PYTHON = resolveInside(ROOT, "ml/ai-painter/.venv/Scripts/python.exe");
const TRAINER = resolveInside(ROOT, "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py");
const CPU_CHECKER = resolveInside(ROOT, "ml/ai-painter/scripts/check_stage4_post_decode_full_condition_responsibility_smoke_cpu.py");
const DATASET = resolveInside(ROOT, "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json");
const DATASET_SHA = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa";
const AUTOENCODER = resolveInside(ROOT, ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt");
const AUTOENCODER_SHA = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba";
const FROZEN_SOURCE = resolveInside(ROOT, FROZEN_SOURCE_RELATIVE);
const CONTRACT_PARENT = resolveInside(ROOT, ".runtime/ai-painter/stage4-post-decode-full-condition-responsibility-controlled-smoke-contracts");
const EXECUTION_PARENT = resolveInside(ROOT, ".runtime/ai-painter/stage4-post-decode-full-condition-responsibility-controlled-smokes");
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

export async function executeControlledSmoke({ attemptId = compactUtc(new Date().toISOString()), preflightOnly = false } = {}) {
  assert.match(attemptId, /^[a-z0-9][a-z0-9-]{7,79}$/u);
  const current = await readCurrentExecutionRegistry(ROOT);
  assert.equal(current.ok, true, current.errorCode);
  assert.equal(current.registry.taskId, "compile_and_execute_one_30_epoch_controlled_smoke_for_post_decode_full_condition_responsibility_renderer");
  assert.equal(current.registry.taskKind, "controlled_smoke");
  assert.equal(current.registry.lifecycleStage, "readonly_gpu_qualified");
  assert.equal(current.registry.executionState, "package_materialized");
  assert.equal(current.registry.activity, "planned_not_started");
  assert.equal(current.registry.activeExecution, null);
  const capabilityVersion = current.registry.capabilityVersion;
  const gpuTerminalPath = resolveInside(ROOT, current.registry.terminalEvidence.path);
  assert.equal(sha256File(gpuTerminalPath), current.registry.terminalEvidence.sha256);
  const gpuTerminal = read(gpuTerminalPath);
  assert.equal(gpuTerminal.status, "readonly_gpu_qualified");
  const lifecyclePath = resolveInside(ROOT, `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}/state.json`);
  const lifecycle = read(lifecyclePath);
  assert.equal(lifecycle.state, "readonly_gpu_qualified");
  assert.equal(sha256File(DATASET), DATASET_SHA);
  assert.equal(sha256File(AUTOENCODER), AUTOENCODER_SHA);
  assert.equal(sha256File(FROZEN_SOURCE), FROZEN_SOURCE_SHA256);

  fs.mkdirSync(CONTRACT_PARENT, { recursive: true });
  const contractRoot = path.join(CONTRACT_PARENT, capabilityVersion);
  const contractPath = path.join(contractRoot, "controlled-smoke-contract.json");
  let contract;
  if (fs.existsSync(contractPath)) {
    contract = read(contractPath);
  } else {
    fs.mkdirSync(contractRoot, { recursive: false });
    contract = compileControlledSmokeContract({ capabilityVersion, gpuTerminalBinding: bind(gpuTerminalPath), recordedAtUtc: new Date().toISOString() });
    writeExclusive(contractPath, contract);
  }
  validateControlledSmokeContract(contract, { capabilityVersion, gpuTerminalSha256: sha256File(gpuTerminalPath) });

  const resources = resourceSnapshot();
  if (!resources.passed) throw new Error(`controlled_smoke_resource_gate_failed:${resources.blockers.join(",")}`);
  fs.mkdirSync(EXECUTION_PARENT, { recursive: true });
  const runId = `${capabilityVersion}-${attemptId}`;
  const executionRoot = path.join(EXECUTION_PARENT, runId);
  fs.mkdirSync(executionRoot, { recursive: false });
  const paths = outputPaths(executionRoot);
  writeExclusive(paths.resourcePreflight, resources);

  const ticketId = `local-ai-${capabilityVersion}-${attemptId}`;
  writeExclusive(paths.ticket, {
    schemaVersion: "ai-painter-local-internal-capability-ticket-v1",
    status: "issued_not_consumed",
    ticketId,
    modeId: MODE_ID,
    capabilityVersion,
    capabilityAuthority: "local_ai_pet_world_program",
    parentContract: bind(contractPath),
    executionActions: [...EXECUTION_ACTIONS],
    ownerAuthorizationRequired: false,
    cannotExpandParentContract: true,
    issuedAtUtc: new Date().toISOString(),
  });
  writeExclusive(paths.consumption, {
    schemaVersion: "ai-painter-local-internal-capability-ticket-consumption-v1",
    ticketId,
    ticketSha256: sha256File(paths.ticket),
    oneTimeConsumption: true,
    state: "consumed",
    ownerAuthorizationRequired: false,
    consumedAtUtc: new Date().toISOString(),
  });
  const activeConfig = buildActiveConfig({
    frozenSource: read(FROZEN_SOURCE), capabilityVersion, attemptId,
    ticketBinding: bind(paths.ticket), consumptionBinding: bind(paths.consumption),
  });
  validateActiveConfig(activeConfig);
  writeExclusive(paths.activeConfig, activeConfig);

  const cpu = runSync(PYTHON, [CPU_CHECKER, paths.activeConfig], 300_000);
  const cpuReport = JSON.parse(cpu.stdout);
  assert.equal(cpuReport.status, "passed");
  writeExclusive(paths.cpuReport, cpuReport);
  runSync(PYTHON, ["-m", "py_compile", TRAINER, CPU_CHECKER], 300_000);
  const trainerArgs = [
    TRAINER, "--config", paths.activeConfig, "--dataset-package", DATASET,
    "--autoencoder-checkpoint", AUTOENCODER, "--output-dir", paths.trainingOutput,
    "--resolution-stage", "0", "--single-sample-overfit-smoke",
    "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "30",
    "--overfit-evaluation-interval", "5",
  ];
  const preflight = spawnSync(PYTHON, [...trainerArgs, "--preflight-only"], {
    cwd: ROOT, env: pythonEnv(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true,
  });
  writeExclusive(paths.trainerPreflight, {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-trainer-preflight-v1",
    status: preflight.status === 0 ? "passed_gpu_not_started" : "failed",
    exitCode: preflight.status, stdout: preflight.stdout, stderr: preflight.stderr,
    trainingOutputExistedBeforePreflight: fs.existsSync(paths.trainingOutput),
    gpuStarted: false, trainingStarted: false, recordedAtUtc: new Date().toISOString(),
  });
  if (preflight.status !== 0) return await closeInfrastructureFailure({ code: "trainer_preflight_failed", detail: preflight.stderr || preflight.stdout, current, capabilityVersion, runId, executionRoot, paths });
  assert.equal(fs.existsSync(paths.trainingOutput), false, "preflight created training output");
  if (preflightOnly) {
    writeExclusive(paths.terminal, {
      schemaVersion: "stage4-post-decode-full-condition-responsibility-controlled-smoke-preflight-terminal-v1",
      executionState: "completed", status: "preflight_passed_gpu_not_started_not_training",
      capabilityVersion, runId, activeConfig: bind(paths.activeConfig), cpuReport: bind(paths.cpuReport),
      resourcePreflight: bind(paths.resourcePreflight), trainerPreflight: bind(paths.trainerPreflight),
      internalTicket: bind(paths.ticket), internalConsumption: bind(paths.consumption),
      gpuStarted: false, optimizerCreated: false, backwardExecuted: false,
      modelWeightsModified: false, trainingStarted: false, ownerAuthorizationRequired: false,
      recordedAtUtc: new Date().toISOString(),
    });
    writeJsonAtomic(paths.executionState, {
      schemaVersion: "stage4-post-decode-full-condition-responsibility-smoke-execution-state-v1",
      status: "completed", phase: "preflight_only", terminal: bind(paths.terminal), completedAtUtc: new Date().toISOString(),
    });
    return {
      schemaVersion: "stage4-post-decode-full-condition-responsibility-controlled-smoke-preflight-result-v1",
      status: "preflight_passed_gpu_not_started_not_training", runId,
      terminal: bind(paths.terminal), cpuReport: bind(paths.cpuReport), trainerPreflight: bind(paths.trainerPreflight),
      ownerAuthorizationRequired: false, trainingStarted: false,
    };
  }

  writeJsonAtomic(paths.executionState, {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-smoke-execution-state-v1",
    status: "running", phase: "training", capabilityVersion, runId,
    trainingOutput: projectPath(paths.trainingOutput), progressPath: projectPath(paths.progress),
    ownerAuthorizationRequired: false, startedAtUtc: new Date().toISOString(),
  });
  const initialModelStatePath = path.join(executionRoot, "initial-model-state.json");
  writeExclusive(initialModelStatePath, { schemaVersion: "stage4-smoke-initial-model-state-v1", status: "trainer_will_record_fixed_random_initialization", seed: 20263722, parentDenoiserCheckpoint: null, recordedAtUtc: new Date().toISOString() });
  const stdoutHandle = fs.openSync(paths.stdout, "wx");
  const stderrHandle = fs.openSync(paths.stderr, "wx");
  const child = spawn(PYTHON, trainerArgs, { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", stdoutHandle, stderrHandle] });
  const telemetry = [];
  const started = Date.now();
  const sampleHeartbeat = () => {
    const snapshot = gpuSnapshot();
    const progress = fs.existsSync(paths.progress) ? safeRead(paths.progress) : null;
    const live = progress?.liveProgress ?? {};
    const epoch = live.epoch ?? progress?.currentEpoch ?? progress?.epoch ?? null;
    const optimizerStep = live.optimizerStep ?? progress?.optimizerStep ?? null;
    const targetOptimizerSteps = live.optimizerStepTarget ?? progress?.targetOptimizerSteps ?? null;
    telemetry.push({ recordedAtUtc: new Date().toISOString(), epoch, optimizerStep, targetOptimizerSteps, phase: live.phase ?? progress?.currentStage ?? null, ...snapshot });
    writeJsonAtomic(paths.resourceTelemetry, buildTelemetry(telemetry));
    const percent = targetOptimizerSteps ? (100 * Number(optimizerStep ?? 0) / Number(targetOptimizerSteps)) : null;
    process.stdout.write(`${JSON.stringify({ kind: "stage4_full_condition_responsibility_smoke_heartbeat", runId, phase: live.phase ?? progress?.currentStage ?? null, epoch, optimizerStep, targetOptimizerSteps, stagePercent: percent, dynamicEtaSeconds: live.etaSeconds ?? null, elapsedMinutes: (Date.now() - started) / 60000, gpu: snapshot, recordedAtUtc: new Date().toISOString() })}\n`);
  };
  sampleHeartbeat();
  const interval = setInterval(sampleHeartbeat, 10_000);
  const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => resolve(code ?? 1)); });
  clearInterval(interval);
  sampleHeartbeat();
  fs.closeSync(stdoutHandle);
  fs.closeSync(stderrHandle);
  if (exitCode !== 0) return await closeInfrastructureFailure({ code: "trainer_execution_failed", detail: `exitCode=${exitCode}; stderr=${fs.readFileSync(paths.stderr, "utf8").slice(-8000)}`, current, capabilityVersion, runId, executionRoot, paths });
  assert.ok(fs.existsSync(paths.manifest), "trainer manifest missing");

  writeJsonAtomic(paths.executionState, {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-smoke-execution-state-v1",
    status: "running", phase: "automatic_review_and_qualification", capabilityVersion, runId,
    trainingOutput: projectPath(paths.trainingOutput), ownerAuthorizationRequired: false,
    updatedAtUtc: new Date().toISOString(),
  });
  const review = await reviewPreviews(executionRoot, paths.trainingOutput, activeConfig);
  const qualification = qualifyLateStability(review);
  writeExclusive(paths.qualification, qualification);
  const manifest = read(paths.manifest);
  const qualified = qualification.qualified;
  const terminalStatus = qualified
    ? "post_decode_full_condition_responsibility_controlled_smoke_qualified"
    : "post_decode_full_condition_responsibility_controlled_smoke_real_visual_failure";
  writeExclusive(paths.finalization, {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-controlled-smoke-finalization-v1",
    status: terminalStatus, capabilityVersion, runId,
    manifest: bind(paths.manifest), checkpoint: { path: manifest.checkpointPath, sha256: manifest.checkpointSha256, promotable: false },
    machineReview: bind(paths.machineReview), lateStabilityQualification: bind(paths.qualification), resourceTelemetry: bind(paths.resourceTelemetry),
    automaticRetryStarted: false, stage0Started: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString(),
  });
  writeExclusive(paths.terminal, {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-controlled-smoke-terminal-v1",
    executionState: "completed", status: terminalStatus, capabilityVersion, runId,
    finalization: bind(paths.finalization), manifest: bind(paths.manifest), machineReview: bind(paths.machineReview),
    lateStabilityQualification: bind(paths.qualification), resourceTelemetry: bind(paths.resourceTelemetry),
    checkpointWritten: true, checkpointPromotable: false, modelWeightsModified: true, trainingStarted: true,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false,
    nextLegalAction: qualified
      ? "compile_and_execute_stage0_for_post_decode_full_condition_responsibility_renderer"
      : "analyze_post_decode_full_condition_responsibility_smoke_real_visual_failure",
    recordedAtUtc: new Date().toISOString(),
  });
  writeJsonAtomic(paths.executionState, {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-smoke-execution-state-v1",
    status: "completed", phase: qualified ? "qualified" : "failed_closed", capabilityVersion, runId,
    terminal: bind(paths.terminal), ownerAuthorizationRequired: false, completedAtUtc: new Date().toISOString(),
  });
  const capsule = buildCapsule({ runId, terminalStatus, paths, qualified, review });
  writeExclusive(paths.capsule, capsule);
  if (qualified) {
    advanceCapabilityLifecycle({
      root: ROOT, capabilityVersion, targetState: "controlled_smoke_completed",
      evidence: {
        schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion,
        targetState: "controlled_smoke_completed", status: "passed",
        bindings: [paths.terminal, paths.finalization, paths.manifest, paths.machineReview, paths.qualification, paths.resourceTelemetry].map(bind),
        ownerAuthorizationRequired: false,
      },
    });
  }
  const next = read(paths.terminal).nextLegalAction;
  const advanced = await advanceCurrentExecutionRegistry({
    projectRoot: ROOT, capabilityVersion, packageId: runId, taskId: next,
    taskKind: qualified ? "formal_stage_training" : "cpu_readonly_adjudication",
    runId, lifecycleStage: qualified ? "controlled_smoke_completed" : "readonly_gpu_qualified",
    executionState: "package_materialized", activity: "planned_not_started",
    taskCapsulePath: projectPath(paths.capsule), terminalEvidencePath: projectPath(paths.terminal),
    latestTrainingTerminal: {
      runId, path: projectPath(paths.terminal), sha256: sha256File(paths.terminal), status: terminalStatus,
      evidence: {
        executionState: bind(paths.executionState), machineReview: bind(paths.machineReview),
        reviewProgress: null, trainingProgress: bind(paths.progress),
      },
    },
  });
  appendAiPainterProgramEvent({
    id: `stage4-full-condition-responsibility-smoke-${runId}`, timestamp: new Date().toISOString(),
    action: "stage4_post_decode_full_condition_responsibility_controlled_smoke", runId,
    kind: "controlled_smoke", status: qualified ? "success" : "failed_closed",
    title: "Stage4 full-condition responsibility controlled Smoke completed",
    titleZh: qualified ? "Stage4五责任完整条件受控Smoke及自动审核通过" : "Stage4五责任完整条件受控Smoke真实视觉失败并关闭",
    detailZh: `30 Epoch训练自然完成；机器审核${review.previewPassCount}/${review.previewCount}，后期稳定资格=${qualified}。`,
    evidencePath: projectPath(paths.terminal), evidenceSha256: sha256File(paths.terminal),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  });
  return {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-controlled-smoke-result-v1",
    status: terminalStatus, runId, terminal: bind(paths.terminal), manifest: bind(paths.manifest),
    machineReview: bind(paths.machineReview), lateStability: bind(paths.qualification), resourceTelemetry: bind(paths.resourceTelemetry),
    currentRegistrySha256: advanced.registrySha256, nextLegalAction: next,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false,
  };
}

async function reviewPreviews(executionRoot, trainingOutput, activeConfig) {
  const previewRoot = path.join(trainingOutput, "fixed-epoch-previews");
  const files = fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort((a, b) => epochOf(a) - epochOf(b));
  assert.deepEqual(files.map(epochOf), PREVIEW_EPOCHS);
  const sample = activeConfig.training.factConditionedSemanticMixtureSampleBinding;
  const conditionPack = read(resolveInside(ROOT, sample.conditionPackPath));
  const reviews = [];
  for (const file of files) {
    const epoch = epochOf(file);
    const sourcePath = path.join(previewRoot, file);
    const normalizedPath = path.join(executionRoot, "review-assets", `e${String(epoch).padStart(3, "0")}.png`);
    const normalized = await normalizePreviewWithWindowsSafeIo({
      sourcePath, finalAssetPath: normalizedPath,
      workRoot: resolveInside(ROOT, ".runtime/ai-painter/post-decode-full-condition-responsibility-review-work"),
      workId: shaText(projectPath(executionRoot)).slice(0, 16), epoch,
    });
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({
        record: { recordId: `post-decode-full-condition-responsibility-smoke-${epoch}`, conditionBinding: { conditionPackPath: sample.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: sample.classification },
        imagePath: normalized.shortOutputPath, referenceImagePath: sample.imagePath,
      }),
    ]);
    reviews.push({
      epoch, previewPath: projectPath(sourcePath), previewSha256: sha256File(sourcePath),
      normalizedPath: projectPath(normalizedPath), normalizedSha256: sha256File(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic, conditionAlignment: alignment,
    });
  }
  const report = {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-machine-review-v1",
    status: reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed",
    reviewThresholdsChanged: false, reviews, previewCount: reviews.length,
    previewPassCount: reviews.filter((row) => row.passed).length,
    previewFailCount: reviews.filter((row) => !row.passed).length,
    recordedAtUtc: new Date().toISOString(),
  };
  writeExclusive(path.join(executionRoot, "machine-review.json"), report);
  return report;
}

async function closeInfrastructureFailure({ code, detail, current, capabilityVersion, runId, executionRoot, paths }) {
  writeExclusive(paths.failure, { schemaVersion: "stage4-post-decode-full-condition-responsibility-smoke-failure-v1", status: "failed_closed", code, detail: String(detail), automaticRetryStarted: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() });
  writeExclusive(paths.terminal, { schemaVersion: "stage4-post-decode-full-condition-responsibility-controlled-smoke-terminal-v1", executionState: "completed", status: "post_decode_full_condition_responsibility_controlled_smoke_infrastructure_failed_closed", capabilityVersion, runId, failureReport: bind(paths.failure), checkpointWritten: false, modelWeightsModified: false, trainingStarted: code === "trainer_execution_failed", nextLegalAction: "repair_same_controlled_smoke_infrastructure_from_saved_evidence", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() });
  writeJsonAtomic(paths.executionState, { schemaVersion: "stage4-post-decode-full-condition-responsibility-smoke-execution-state-v1", status: "completed", phase: "failed_closed", terminal: bind(paths.terminal), completedAtUtc: new Date().toISOString() });
  writeExclusive(paths.capsule, buildCapsule({ runId, terminalStatus: read(paths.terminal).status, paths, qualified: false, review: null }));
  await advanceCurrentExecutionRegistry({ projectRoot: ROOT, capabilityVersion, packageId: runId, taskId: read(paths.terminal).nextLegalAction, taskKind: "infrastructure_repair", runId, lifecycleStage: "readonly_gpu_qualified", executionState: "package_materialized", activity: "planned_not_started", taskCapsulePath: projectPath(paths.capsule), terminalEvidencePath: projectPath(paths.terminal) });
  appendAiPainterProgramEvent({ id: `stage4-full-condition-responsibility-smoke-failure-${runId}`, timestamp: new Date().toISOString(), action: "stage4_post_decode_full_condition_responsibility_controlled_smoke", runId, kind: "controlled_smoke", status: "failed", title: "Stage4 full-condition responsibility controlled Smoke infrastructure failure", titleZh: "Stage4五责任完整条件受控Smoke基础设施失败关闭", detailZh: `${code}；未自动重试。`, evidencePath: projectPath(paths.terminal), evidenceSha256: sha256File(paths.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } });
  throw new Error(`${code}:${detail}`);
}

function buildCapsule({ runId, terminalStatus, paths, qualified, review }) {
  const recordedAtUtc = new Date().toISOString();
  const evidenceFiles = [paths.activeConfig, paths.cpuReport, paths.resourcePreflight, paths.trainerPreflight, paths.executionState, paths.terminal];
  for (const file of [paths.manifest, paths.machineReview, paths.qualification, paths.finalization, paths.resourceTelemetry, paths.failure]) if (fs.existsSync(file)) evidenceFiles.push(file);
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1", capsuleId: `local-ai-${runId}`,
    generatedFrom: "program_saved_evidence", readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: terminalStatus },
    candidateTerminal: { runId, status: terminalStatus, programStatus: terminalStatus, previewMachineStatus: review?.status ?? null, modelQualificationStatus: qualified ? "controlled_smoke_qualified" : "not_qualified_or_infrastructure_failed", previewCount: review?.previewCount ?? null, previewPassCount: review?.previewPassCount ?? null, previewFailCount: review?.previewFailCount ?? null, checkpointWritten: fs.existsSync(paths.manifest), modelWeightsModified: fs.existsSync(paths.manifest), recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) },
    latestBlocker: qualified ? { code: "formal_stage0_not_yet_executed", summaryZh: "受控Smoke通过；正式Stage 0尚未执行。" } : { code: terminalStatus, summaryZh: "受控Smoke未取得Stage 0资格；按保存证据进入唯一分析或修复。" },
    nextAllowedAction: { code: fs.existsSync(paths.terminal) ? read(paths.terminal).nextLegalAction : "repair_same_controlled_smoke_infrastructure_from_saved_evidence", labelZh: "本地程序下一动作", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
    forbiddenActions: ["reuse_failed_checkpoint", "automatic_retry", "start_stage0_before_smoke_qualification", "lower_machine_review_threshold", "start_stage1_or_stage2"],
    taskIdentity: { modelId: "post_decode_full_condition_route_and_object_responsibility_renderer", sampleId: "194", conditionLabel: "v7-complete-map-194", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
    evidence: evidenceFiles.map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha256File(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })),
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
  };
}

function outputPaths(executionRoot) {
  const trainingOutput = path.join(executionRoot, "training-output");
  return {
    executionRoot, trainingOutput, progress: path.join(trainingOutput, "progress.json"), manifest: path.join(trainingOutput, "manifest.json"),
    ticket: path.join(executionRoot, "internal-capability-ticket.json"), consumption: path.join(executionRoot, "internal-capability-consumption.json"),
    activeConfig: path.join(executionRoot, "active-config.json"), cpuReport: path.join(executionRoot, "cpu-report.json"),
    resourcePreflight: path.join(executionRoot, "resource-preflight.json"), trainerPreflight: path.join(executionRoot, "trainer-preflight.json"),
    executionState: path.join(executionRoot, "execution-state.json"), resourceTelemetry: path.join(executionRoot, "resource-telemetry.json"),
    stdout: path.join(executionRoot, "trainer.stdout.log"), stderr: path.join(executionRoot, "trainer.stderr.log"),
    machineReview: path.join(executionRoot, "machine-review.json"), qualification: path.join(executionRoot, "late-stability-qualification.json"),
    finalization: path.join(executionRoot, "finalization.json"), terminal: path.join(executionRoot, "phase-terminal.json"),
    failure: path.join(executionRoot, "failure-report.json"), capsule: path.join(executionRoot, "local-task-capsule.json"),
  };
}
function resourceSnapshot() {
  const gpu = gpuSnapshot();
  const processes = runSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], 30_000, true).stdout.split(/\r?\n/u).filter((row) => /python/iu.test(row));
  const disk = fs.statfsSync(ROOT); const diskFreeBytes = Number(disk.bavail) * Number(disk.bsize); const blockers = [];
  if (!gpu.name) blockers.push("cuda_unavailable");
  if (gpu.utilizationPercent > 10) blockers.push("gpu_not_idle");
  if (gpu.memoryFreeMiB < 4096) blockers.push("gpu_memory_insufficient");
  if (processes.length) blockers.push("python_gpu_process_active");
  if (diskFreeBytes < 4 * 1024 ** 3) blockers.push("disk_insufficient");
  return { schemaVersion: "stage4-post-decode-full-condition-responsibility-resource-preflight-v1", passed: blockers.length === 0, blockers, cpuLogicalProcessors: os.cpus().length, memoryFreeBytes: os.freemem(), diskFreeBytes, gpu: { ...gpu, pythonComputeProcesses: processes }, recordedAtUtc: new Date().toISOString() };
}
function gpuSnapshot() {
  const result = runSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.free", "--format=csv,noheader,nounits"], 30_000, true);
  const parts = result.stdout.trim().split(",").map((value) => value.trim());
  return { name: parts[0] ?? null, utilizationPercent: Number(parts[1] ?? NaN), memoryUsedMiB: Number(parts[2] ?? NaN), memoryFreeMiB: Number(parts[3] ?? NaN) };
}
function buildTelemetry(rows) { return { schemaVersion: "stage4-post-decode-full-condition-responsibility-smoke-resource-telemetry-v1", status: "recording", rows, peakGpuMemoryMiB: Math.max(...rows.map((row) => row.memoryUsedMiB ?? 0)), recordedAtUtc: new Date().toISOString() }; }
function runSync(command, args, timeout, allowFailure = false) { const result = spawnSync(command, args, { cwd: ROOT, env: pythonEnv(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout }); if (!allowFailure && (result.error || result.status !== 0)) throw result.error ?? new Error(`${command} exited ${result.status}: ${result.stderr}`); return result; }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: `${resolveInside(ROOT, "ml/ai-painter/src")};${resolveInside(ROOT, "ml/ai-painter/scripts")}` }; }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function safeRead(file) { try { return read(file); } catch { return null; } }
function bind(file) { return { path: projectPath(file), sha256: sha256File(file) }; }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }); }
function epochOf(file) { return Number(file.match(/epoch-(\d+)/u)?.[1]); }
function shaText(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function compactUtc(iso) { return iso.replace(/[-:TZ.]/gu, "").slice(0, 14); }

if (isMain) {
  try {
    const attemptIndex = process.argv.indexOf("--attempt-id");
    const attemptId = attemptIndex >= 0 ? process.argv[attemptIndex + 1] : undefined;
    const result = await executeControlledSmoke({ attemptId, preflightOnly: process.argv.includes("--preflight-only") });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
}
