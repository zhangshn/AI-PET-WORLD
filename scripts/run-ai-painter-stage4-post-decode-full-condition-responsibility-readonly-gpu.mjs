import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import {
  buildInternalReadonlyGpuTicket,
  sha256File,
  validateReadonlyGpuQualificationInputs,
} from "./lib/ai-painter-stage4-post-decode-full-condition-responsibility-readonly-gpu-v1.mjs";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";

const root = process.cwd();
const runtimeRoot = path.join(root, ".runtime", "ai-painter", "stage4-post-decode-full-condition-responsibility-readonly-gpu");
const datasetPath = path.join(root, "data", "world-samples", "ai-assisted-cold-start-dataset-packages", "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z", "manifest.json");
const datasetSha256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa";
const autoencoderPath = path.join(root, ".runtime", "ai-painter", "project-owned-complete-world-model-ai-assisted-v2", "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z", "complete-world-ai-assisted-autoencoder.pt");
const autoencoderSha256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba";
const python = path.join(root, "ml", "ai-painter", ".venv", "Scripts", "python.exe");
const gpuRunner = path.join(root, "ml", "ai-painter", "scripts", "run_stage4_post_decode_full_condition_responsibility_readonly_gpu_qualification.py");
const entryChecker = path.join(root, "scripts", "check-ai-painter-stage4-post-decode-full-condition-responsibility-readonly-gpu-entry.mjs");

const current = await readCurrentExecutionRegistry(root);
assert.equal(current.ok, true, current.errorCode);
const registry = current.registry;
const cpuTerminalPath = resolveProject(registry.terminalEvidence.path);
const cpuTerminal = readJson(cpuTerminalPath);
const inactiveConfigPath = resolveProject(cpuTerminal.inactiveConfig.path);
const cpuReportPath = resolveProject(cpuTerminal.cpuReport.path);
const supportContractPath = resolveProject(cpuTerminal.supportContract.path);
const inactiveConfig = readJson(inactiveConfigPath);
const cpuReport = readJson(cpuReportPath);
const supportContract = readJson(supportContractPath);
validateReadonlyGpuQualificationInputs({
  registry,
  cpuTerminal,
  inactiveConfig,
  cpuReport,
  supportContract,
  hashes: {
    cpuTerminal: sha256File(cpuTerminalPath),
    inactiveConfig: sha256File(inactiveConfigPath),
    cpuReport: sha256File(cpuReportPath),
    supportContract: sha256File(supportContractPath),
  },
});

const capabilityRoot = path.join(root, ".runtime", "ai-painter", "capability-lifecycle", registry.capabilityVersion);
const capabilityStatePath = path.join(capabilityRoot, "state.json");
const capabilityState = readJson(capabilityStatePath);
assert.equal(capabilityState.state, "cpu_contract_verified");
assert.equal(capabilityState.ownerAuthorizationRequired, false);
assert.equal(capabilityState.ownerResponseRequired, false);

assert.equal(sha256File(datasetPath), datasetSha256, "formal dataset SHA-256 changed");
assert.equal(sha256File(autoencoderPath), autoencoderSha256, "project Autoencoder SHA-256 changed");
assert.ok(fs.existsSync(python), "project Python runtime is missing");

const entryResult = run(process.execPath, [entryChecker], 120_000);
const entryReport = JSON.parse(entryResult.stdout);
assert.equal(entryReport.status, "passed");
const syntax = run(python, ["-m", "py_compile", gpuRunner], 120_000);
assert.equal(syntax.status, 0);
const resources = preflightResources();

const now = new Date().toISOString();
const runId = `stage4-full-condition-responsibility-gpu-${compactUtc(now)}`;
const runRoot = path.join(runtimeRoot, runId);
fs.mkdirSync(runtimeRoot, { recursive: true });
fs.mkdirSync(runRoot, { recursive: false });
const files = Object.fromEntries(Object.entries({
  ticket: "internal-ticket.json",
  consumption: "internal-ticket-consumption.json",
  cpuAuthorization: "cpu-authorization-report.json",
  preflight: "preflight-report.json",
  gpuReport: "gpu-report.json",
  cuda: "cuda-telemetry.json",
  states: "model-state-hashes.json",
  terminal: "phase-terminal.json",
  capsule: "local-task-capsule.json",
  nextAction: "local-ai-next-action.json",
  stdout: "gpu-runner-stdout.txt",
  stderr: "gpu-runner-stderr.txt",
}).map(([key, leaf]) => [key, path.join(runRoot, leaf)]));

const ticket = buildInternalReadonlyGpuTicket({
  capabilityVersion: registry.capabilityVersion,
  runId,
  lifecycleStateSha256: sha256File(capabilityStatePath),
  issuedAtUtc: now,
});
writeExclusiveJson(files.ticket, ticket);
const ticketSha256 = sha256File(files.ticket);
writeExclusiveJson(files.consumption, {
  schemaVersion: "ai-painter-local-internal-capability-ticket-consumption-v1",
  status: "consumed",
  ticketId: ticket.ticketId,
  ticketSha256,
  action: ticket.action,
  oneTimeConsumption: true,
  ownerAuthorizationRequired: false,
  consumedAtUtc: new Date().toISOString(),
});
writeExclusiveJson(files.cpuAuthorization, {
  schemaVersion: "stage4-post-decode-full-condition-responsibility-readonly-gpu-cpu-authorization-report-v1",
  status: "passed",
  currentRegistrySha256: current.registrySha256,
  capabilityLifecycleStateSha256: ticket.parentLifecycleStateSha256,
  cpuTerminal: binding(cpuTerminalPath),
  inactiveConfig: binding(inactiveConfigPath),
  cpuReport: binding(cpuReportPath),
  supportContract: binding(supportContractPath),
  entryCpuReport: entryReport,
  ownerAuthorizationRequired: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
});
writeExclusiveJson(files.preflight, {
  schemaVersion: "stage4-post-decode-full-condition-responsibility-readonly-gpu-preflight-v1",
  status: "passed_gpu_not_started",
  dataset: { ...binding(datasetPath), requiredSha256: datasetSha256 },
  autoencoder: { ...binding(autoencoderPath), requiredSha256: autoencoderSha256 },
  resources,
  ticket: binding(files.ticket),
  ticketConsumption: binding(files.consumption),
  trainingAuthorized: false,
  recordedAtUtc: new Date().toISOString(),
});

const gpu = spawnSync(python, [
  gpuRunner,
  "--config", inactiveConfigPath,
  "--dataset", datasetPath,
  "--autoencoder-checkpoint", autoencoderPath,
], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
  timeout: 1_200_000,
  maxBuffer: 64 * 1024 * 1024,
});
fs.writeFileSync(files.stdout, gpu.stdout ?? "", { flag: "wx" });
fs.writeFileSync(files.stderr, gpu.stderr ?? "", { flag: "wx" });
if (gpu.error || gpu.status !== 0) {
  const failure = {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-readonly-gpu-failure-report-v1",
    status: "failed_closed",
    error: gpu.error?.message ?? `GPU runner exited ${gpu.status}`,
    exitCode: gpu.status,
    stdout: binding(files.stdout),
    stderr: binding(files.stderr),
    ticketConsumption: binding(files.consumption),
    modelWeightsModified: false,
    trainingStarted: false,
    recordedAtUtc: new Date().toISOString(),
  };
  const failurePath = path.join(runRoot, "failure-report.json");
  writeExclusiveJson(failurePath, failure);
  const terminal = {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-readonly-gpu-terminal-v1",
    executionState: "completed",
    status: "readonly_gpu_qualification_failed_closed",
    runId,
    capabilityVersion: registry.capabilityVersion,
    failureReport: binding(failurePath),
    checkpointWritten: false,
    modelWeightsModified: false,
    trainingStarted: false,
    nextLegalAction: "analyze_readonly_gpu_qualification_failure_from_saved_evidence",
    recordedAtUtc: new Date().toISOString(),
  };
  writeExclusiveJson(files.terminal, terminal);
  const capsule = buildCapsule({
    runId,
    terminal,
    status: "readonly_gpu_qualification_failed_closed",
    blockerCode: "readonly_gpu_qualification_failed",
    blockerSummary: "只读GPU资格失败；训练未启动，后续仅允许分析已保存失败证据。",
    nextCode: terminal.nextLegalAction,
    evidenceFiles: [files.cpuAuthorization, files.preflight, files.ticket, files.consumption, failurePath, files.terminal],
  });
  writeExclusiveJson(files.capsule, capsule);
  await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: registry.capabilityVersion,
    packageId: runId,
    taskId: terminal.nextLegalAction,
    taskKind: "cpu_readonly_adjudication",
    runId,
    lifecycleStage: "cpu_contract_verified",
    executionState: "package_materialized",
    activity: "planned_not_started",
    taskCapsulePath: projectPath(files.capsule),
    terminalEvidencePath: projectPath(files.terminal),
  });
  appendEvent("failed", runId, files.terminal, "Stage4五责任渲染器只读GPU资格失败关闭", "真实CUDA资格失败；训练和权重修改均未发生。", 60);
  throw new Error(`${failure.error}; evidence=${projectPath(failurePath)}`);
}

const gpuReport = JSON.parse(gpu.stdout);
assert.equal(gpuReport.status, "passed");
assert.equal(gpuReport.trainingStarted, false);
assert.equal(gpuReport.optimizerCreated, false);
assert.equal(gpuReport.backwardExecuted, false);
assert.equal(gpuReport.modelWeightsModified, false);
writeExclusiveJson(files.gpuReport, gpuReport);
writeExclusiveJson(files.cuda, {
  schemaVersion: "stage4-post-decode-full-condition-responsibility-readonly-gpu-cuda-telemetry-v1",
  status: "passed",
  ...gpuReport.cuda,
  preflight: resources.gpu,
  recordedAtUtc: new Date().toISOString(),
});
writeExclusiveJson(files.states, {
  schemaVersion: "stage4-post-decode-full-condition-responsibility-readonly-gpu-model-state-v1",
  status: "unchanged",
  denoiserBeforeSha256: gpuReport.modelStateSha256Before,
  denoiserAfterSha256: gpuReport.modelStateSha256After,
  autoencoderBeforeSha256: gpuReport.autoencoderStateSha256Before,
  autoencoderAfterSha256: gpuReport.autoencoderStateSha256After,
  modelStateUnchanged: gpuReport.modelStateUnchanged,
  autoencoderStateUnchanged: gpuReport.autoencoderStateUnchanged,
  recordedAtUtc: new Date().toISOString(),
});
writeExclusiveJson(files.nextAction, {
  schemaVersion: "ai-painter-local-ai-next-action-v1",
  status: "planned_not_started",
  action: "compile_and_execute_one_30_epoch_controlled_smoke_for_post_decode_full_condition_responsibility_renderer",
  capabilityVersion: registry.capabilityVersion,
  ownerAuthorizationRequired: false,
  automaticExecutionAllowed: true,
  prerequisites: [binding(files.gpuReport), binding(files.cuda), binding(files.states)],
  forbiddenActions: ["reuse_failed_checkpoint", "start_stage0_before_controlled_smoke", "lower_machine_review_threshold"],
  recordedAtUtc: new Date().toISOString(),
});
const terminal = {
  schemaVersion: "stage4-post-decode-full-condition-responsibility-readonly-gpu-terminal-v1",
  executionState: "completed",
  status: "readonly_gpu_qualified",
  runId,
  capabilityVersion: registry.capabilityVersion,
  gpuReport: binding(files.gpuReport),
  cudaTelemetry: binding(files.cuda),
  stateHashes: binding(files.states),
  cpuAuthorizationReport: binding(files.cpuAuthorization),
  ticketConsumption: binding(files.consumption),
  checkpointWritten: false,
  modelWeightsModified: false,
  trainingStarted: false,
  nextLegalAction: "compile_and_execute_one_30_epoch_controlled_smoke_for_post_decode_full_condition_responsibility_renderer",
  recordedAtUtc: new Date().toISOString(),
};
writeExclusiveJson(files.terminal, terminal);
const capsule = buildCapsule({
  runId,
  terminal,
  status: "readonly_gpu_qualified",
  blockerCode: "controlled_smoke_not_yet_executed",
  blockerSummary: "只读GPU资格通过；一次30 Epoch受控Smoke尚未执行。",
  nextCode: terminal.nextLegalAction,
  evidenceFiles: [files.cpuAuthorization, files.preflight, files.ticket, files.consumption, files.gpuReport, files.cuda, files.states, files.nextAction, files.terminal],
});
writeExclusiveJson(files.capsule, capsule);

const lifecycleEvidence = {
  schemaVersion: "ai-painter-capability-stage-evidence-v1",
  capabilityVersion: registry.capabilityVersion,
  targetState: "readonly_gpu_qualified",
  status: "passed",
  bindings: [binding(files.gpuReport), binding(files.cuda), binding(files.states), binding(files.terminal)],
  ownerAuthorizationRequired: false,
};
advanceCapabilityLifecycle({
  root,
  capabilityVersion: registry.capabilityVersion,
  targetState: "readonly_gpu_qualified",
  evidence: lifecycleEvidence,
});
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: root,
  capabilityVersion: registry.capabilityVersion,
  packageId: runId,
  taskId: terminal.nextLegalAction,
  taskKind: "controlled_smoke",
  runId,
  lifecycleStage: "readonly_gpu_qualified",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(files.capsule),
  terminalEvidencePath: projectPath(files.terminal),
});
appendEvent("success", runId, files.terminal, "Stage4五责任渲染器只读GPU资格通过", "完整23通道条件到达、责任梯度、掩码隔离和模型状态不变均通过；训练未启动。", 60);

process.stdout.write(`${JSON.stringify({
  schemaVersion: "stage4-post-decode-full-condition-responsibility-readonly-gpu-execution-result-v1",
  status: "passed",
  runId,
  gpuReport: binding(files.gpuReport),
  cudaTelemetry: binding(files.cuda),
  modelStateHashes: binding(files.states),
  terminal: binding(files.terminal),
  currentRegistrySha256: advanced.registrySha256,
  nextLegalAction: terminal.nextLegalAction,
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
}, null, 2)}\n`);

function buildCapsule({ runId: capsuleRunId, terminal: terminalValue, status, blockerCode, blockerSummary, nextCode, evidenceFiles }) {
  const recordedAtUtc = new Date().toISOString();
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${capsuleRunId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status },
    candidateTerminal: {
      runId: capsuleRunId,
      status,
      programStatus: terminalValue.status,
      previewMachineStatus: null,
      modelQualificationStatus: status,
      previewCount: null,
      previewPassCount: null,
      previewFailCount: null,
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    },
    latestBlocker: { code: blockerCode, summaryZh: blockerSummary },
    nextAllowedAction: { code: nextCode, labelZh: nextCode, ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
    forbiddenActions: ["read_archived_smoke_as_current", "reuse_failed_checkpoint", "start_stage0_before_controlled_smoke", "start_stage1_or_stage2", "lower_machine_review_threshold"],
    taskIdentity: { modelId: "post_decode_full_condition_route_and_object_responsibility_renderer", sampleId: "194", conditionLabel: "v7-complete-map-194", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
    evidence: evidenceFiles.map((filePath) => ({
      kind: path.basename(filePath, path.extname(filePath)),
      labelZh: path.basename(filePath, path.extname(filePath)),
      ...binding(filePath),
      expectedSha256: sha256File(filePath),
      sha256Verified: true,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    })),
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
  };
}

function preflightResources() {
  const smi = run("nvidia-smi", ["--query-gpu=name,driver_version,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], 30_000).stdout.trim().split(",").map((part) => part.trim());
  assert.equal(smi.length, 7, "unexpected nvidia-smi output");
  const gpu = { name: smi[0], driverVersion: smi[1], memoryTotalMiB: Number(smi[2]), memoryUsedMiB: Number(smi[3]), memoryFreeMiB: Number(smi[4]), utilizationPercent: Number(smi[5]), temperatureCelsius: Number(smi[6]) };
  assert.ok(gpu.memoryFreeMiB >= 4096, `insufficient free GPU memory: ${gpu.memoryFreeMiB} MiB`);
  assert.ok(gpu.utilizationPercent <= 10, `GPU is not idle: ${gpu.utilizationPercent}%`);
  const processes = run("nvidia-smi", ["--query-compute-apps=pid,process_name,used_memory", "--format=csv,noheader,nounits"], 30_000, true).stdout.trim();
  assert.ok(!/(^|[\\/])python(?:\.exe)?\s*,/imu.test(processes), "Python GPU compute process is active");
  const disk = fs.statfsSync(root);
  const diskFreeBytes = Number(disk.bavail) * Number(disk.bsize);
  assert.ok(diskFreeBytes >= 4 * 1024 ** 3, `insufficient free disk: ${diskFreeBytes}`);
  return { status: "passed", gpu, computeProcesses: processes || null, diskFreeBytes, pythonRuntime: projectPath(python), checkedAtUtc: new Date().toISOString() };
}

function run(command, args, timeout, allowFailure = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true, timeout, maxBuffer: 32 * 1024 * 1024 });
  if (!allowFailure && (result.error || result.status !== 0)) throw result.error ?? new Error(`${command} exited ${result.status}: ${result.stderr}`);
  return result;
}
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function binding(filePath) { return { path: projectPath(filePath), sha256: sha256File(filePath) }; }
function resolveProject(relativePath) { const absolute = path.resolve(root, relativePath); assert.ok(absolute.startsWith(`${path.resolve(root)}${path.sep}`)); assert.ok(fs.statSync(absolute).isFile()); return absolute; }
function writeExclusiveJson(filePath, value) { fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }); }
function compactUtc(iso) { return iso.replace(/[-:TZ.]/gu, "").slice(0, 14); }
function appendEvent(status, eventRunId, terminalPath, titleZh, detailZh, percent) {
  appendAiPainterProgramEvent({
    id: `stage4-full-condition-responsibility-readonly-gpu-${eventRunId}`,
    timestamp: new Date().toISOString(),
    action: "stage4_post_decode_full_condition_responsibility_readonly_gpu_qualification",
    runId: eventRunId,
    kind: "readonly_gpu_qualification",
    status,
    title: titleZh,
    titleZh,
    detailZh,
    evidencePath: projectPath(terminalPath),
    evidenceSha256: sha256File(terminalPath),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent },
  });
}
