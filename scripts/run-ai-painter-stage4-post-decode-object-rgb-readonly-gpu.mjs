import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import {
  appendAiPainterProgramEvent,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";

const root = process.cwd();
const capabilityVersion = required("--capability-version");
const runId = required("--run-id");
assert.match(capabilityVersion, /^[a-z0-9][a-z0-9-]{7,127}$/u);
assert.match(runId, /^[a-z0-9][a-z0-9-]{7,127}$/u);

const lifecycleRoot = resolveInside(
  `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`,
);
const lifecycle = readJson(path.join(lifecycleRoot, "state.json"));
assert.equal(lifecycle.state, "cpu_contract_verified");
const candidateRoot = resolveInside(
  `.runtime/ai-painter/stage4-post-decode-object-rgb-candidates/${capabilityVersion}`,
);
const configPath = path.join(candidateRoot, "inactive-config.json");
const cpuReportPath = path.join(candidateRoot, "cpu-report.json");
assert.equal(readJson(cpuReportPath).status, "passed");

const datasetPath = resolveInside(
  "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json",
);
const autoencoderPath = resolveInside(
  ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt",
);
assert.equal(
  sha256File(datasetPath),
  "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa",
);
assert.equal(
  sha256File(autoencoderPath),
  "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
);

const syntax = spawnSync(
  resolveInside("ml/ai-painter/.venv/Scripts/python.exe"),
  [
    "-m",
    "py_compile",
    "ml/ai-painter/src/ai_painter/complete_world/model.py",
    "ml/ai-painter/scripts/run_stage4_post_decode_object_rgb_readonly_gpu_qualification.py",
  ],
  { cwd: root, encoding: "utf8", windowsHide: true },
);
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
const gpu = spawnSync(
  "nvidia-smi",
  [
    "--query-gpu=name,memory.total,memory.free,utilization.gpu",
    "--format=csv,noheader,nounits",
  ],
  { cwd: root, encoding: "utf8", windowsHide: true },
);
assert.equal(gpu.status, 0, gpu.stderr || gpu.stdout);
const [gpuName, totalMiB, freeMiB, utilization] = gpu.stdout
  .trim()
  .split(",")
  .map((value) => value.trim());
assert.ok(Number(freeMiB) >= 4096, "GPU free memory is below the formal gate");

const outputRoot = resolveInside(
  `.runtime/ai-painter/stage4-post-decode-object-rgb-readonly-gpu/${runId}`,
);
assert.equal(
  fs.existsSync(outputRoot),
  false,
  "GPU qualification output already exists",
);
fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
fs.mkdirSync(outputRoot, { recursive: false });
const recordedAtUtc = new Date().toISOString();
const ticketPath = path.join(outputRoot, "internal-task-ticket.json");
writeExclusiveJson(ticketPath, {
  schemaVersion: "ai-painter-local-internal-capability-ticket-v1",
  status: "issued_not_consumed",
  ticketId: `local-ai-${capabilityVersion}-${runId}`,
  capabilityVersion,
  action: "readonly_gpu_qualification",
  parentLifecycleStateSha256: sha256File(
    path.join(lifecycleRoot, "state.json"),
  ),
  ownerAuthorizationRequired: false,
  cannotExpandParentContract: true,
  issuedAtUtc: recordedAtUtc,
});
const consumptionPath = path.join(outputRoot, "internal-task-consumption.json");
writeExclusiveJson(consumptionPath, {
  schemaVersion: "ai-painter-local-internal-capability-ticket-consumption-v1",
  ticketId: `local-ai-${capabilityVersion}-${runId}`,
  ticketSha256: sha256File(ticketPath),
  oneTimeConsumption: true,
  state: "consumed",
  consumedAtUtc: new Date().toISOString(),
});
const preflightPath = path.join(outputRoot, "resource-preflight.json");
writeJsonAtomic(preflightPath, {
  schemaVersion: "stage4-post-decode-object-rgb-gpu-preflight-v1",
  status: "passed",
  pythonSyntaxPassed: true,
  gpu: {
    name: gpuName,
    totalMemoryMiB: Number(totalMiB),
    freeMemoryMiB: Number(freeMiB),
    utilizationPercent: Number(utilization),
  },
  checkpointSha256Verified: true,
  datasetSha256Verified: true,
  optimizerCreated: false,
  trainingStarted: false,
  recordedAtUtc,
});

const qualification = spawnSync(
  resolveInside("ml/ai-painter/.venv/Scripts/python.exe"),
  [
    "ml/ai-painter/scripts/run_stage4_post_decode_object_rgb_readonly_gpu_qualification.py",
    "--config",
    configPath,
    "--dataset",
    datasetPath,
    "--autoencoder-checkpoint",
    autoencoderPath,
  ],
  {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
  },
);
const stdoutPath = path.join(outputRoot, "qualification.stdout.log");
const stderrPath = path.join(outputRoot, "qualification.stderr.log");
fs.writeFileSync(stdoutPath, qualification.stdout ?? "", "utf8");
fs.writeFileSync(stderrPath, qualification.stderr ?? "", "utf8");
if (qualification.status !== 0) {
  const failurePath = path.join(outputRoot, "failure-report.json");
  writeJsonAtomic(failurePath, {
    schemaVersion: "stage4-post-decode-object-rgb-readonly-gpu-failure-v1",
    status: "failed_closed",
    capabilityVersion,
    runId,
    exitCode: qualification.status,
    stdout: bind(stdoutPath),
    stderr: bind(stderrPath),
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc: new Date().toISOString(),
  });
  const failureAnalysisPath = path.join(outputRoot, "failure-analysis.json");
  writeJsonAtomic(failureAnalysisPath, {
    schemaVersion:
      "stage4-post-decode-object-rgb-readonly-gpu-failure-analysis-v1",
    status: "qualification_execution_failed_closed",
    capabilityVersion,
    runId,
    classification: "readonly_qualification_execution_or_fixture_failure",
    candidateRejected: false,
    lifecycleStateRetained: lifecycle.state,
    reason:
      "An executable qualification report was not produced; this does not by itself prove a model-family defect.",
    ownerAuthorizationRequired: false,
    trainingStarted: false,
    recordedAtUtc: new Date().toISOString(),
  });
  throw new Error(
    `readonly GPU qualification failed: ${qualification.stderr || qualification.stdout}`,
  );
}

const report = JSON.parse(qualification.stdout);
assert.equal(report.status, "passed");
const reportPath = path.join(outputRoot, "gpu-report.json");
writeJsonAtomic(reportPath, {
  ...report,
  capabilityVersion,
  runId,
  recordedAtUtc: new Date().toISOString(),
});
const telemetryPath = path.join(outputRoot, "cuda-telemetry.json");
writeJsonAtomic(telemetryPath, {
  schemaVersion: "stage4-post-decode-object-rgb-cuda-telemetry-v1",
  status: "passed",
  capabilityVersion,
  runId,
  preflight: readJson(preflightPath).gpu,
  runtime: report.cuda,
  recordedAtUtc: new Date().toISOString(),
});
const state = advanceCapabilityLifecycle({
  root,
  capabilityVersion,
  targetState: "readonly_gpu_qualified",
  evidence: stageEvidence("readonly_gpu_qualified", "passed", [
    bind(reportPath),
    bind(telemetryPath),
    bind(preflightPath),
    bind(cpuReportPath),
  ]),
});
const terminalPath = path.join(outputRoot, "phase-terminal.json");
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-post-decode-object-rgb-readonly-gpu-terminal-v1",
  executionState: "completed",
  status: "readonly_gpu_qualified",
  capabilityVersion,
  runId,
  lifecycleState: state.state,
  gpuReport: bind(reportPath),
  cudaTelemetry: bind(telemetryPath),
  resourcePreflight: bind(preflightPath),
  internalTicket: bind(ticketPath),
  internalConsumption: bind(consumptionPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLocalAction: "compile_and_execute_one_30_epoch_controlled_smoke",
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  optimizerCreated: false,
  backwardExecuted: false,
  checkpointWritten: false,
  trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
});
appendAiPainterProgramEvent({
  id: `stage4-post-decode-object-rgb-gpu-${runId}`,
  timestamp: new Date().toISOString(),
  action: "stage4_post_decode_object_rgb_readonly_gpu_qualified",
  runId,
  kind: "local_autonomous_readonly_gpu_qualification",
  status: "success",
  title: "Stage4 post-decode object RGB GPU qualification passed",
  titleZh: "Stage4解码后四类对象RGB候选只读GPU资格通过",
  detailZh: "真实CUDA 50步最终解码与四类梯度隔离通过；模型状态未改变，未训练。",
  evidencePath: relative(terminalPath),
  evidenceSha256: sha256File(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});
process.stdout.write(
  `${JSON.stringify(
    {
      status: "readonly_gpu_qualified",
      capabilityVersion,
      runId,
      terminal: bind(terminalPath),
      nextLocalAction: "compile_and_execute_one_30_epoch_controlled_smoke",
      ownerAuthorizationRequired: false,
      trainingStarted: false,
    },
    null,
    2,
  )}\n`,
);

function stageEvidence(targetState, status, bindings) {
  return {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion,
    targetState,
    status,
    bindings: bindings.map(({ path: filePath, sha256 }) => ({
      path: filePath,
      sha256,
    })),
  };
}
function required(flag) {
  const index = process.argv.indexOf(flag);
  assert(index >= 0 && process.argv[index + 1], `missing ${flag}`);
  return process.argv[index + 1];
}
function resolveInside(relativePath) {
  assert.equal(
    path.isAbsolute(relativePath),
    false,
    "path must be project-relative",
  );
  const absolute = path.resolve(root, relativePath);
  assert.ok(absolute.startsWith(`${path.resolve(root)}${path.sep}`));
  return absolute;
}
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}
function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}
function bind(filePath) {
  return { path: relative(filePath), sha256: sha256File(filePath) };
}
function writeExclusiveJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  });
}
