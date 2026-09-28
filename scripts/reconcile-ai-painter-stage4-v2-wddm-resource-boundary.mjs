import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import {
  captureImmutableCurrentRegistryEvidence,
} from "./lib/ai-painter-immutable-current-registry-evidence-v1.mjs";
import {
  runResourcePreflight,
} from "./run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";

const ROOT = process.cwd();
const CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const CURRENT_TASK = "stage4_v2_readonly_gpu_qualification_failure_adjudicated";
const CURRENT_STATUS = "stage4_v2_readonly_gpu_resource_boundary_failure_confirmed";
const NEXT_TASK = "plan_stage4_v2_readonly_gpu_qualification";
const NEXT_ACTION = "plan:ai-painter-stage4-v2-readonly-gpu-qualification";
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-v2-wddm-resource-boundary-reassessments";
const RUNNER_PATH = "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
const LAUNCHER_PATH = "scripts/launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs";
const PYTHON_RUNNER_PATH = "ml/ai-painter/scripts/run_stage4_semantic_transport_v2_readonly_gpu_qualification.py";
const PROJECT_PYTHON_PATH = "ml/ai-painter/.venv/Scripts/python.exe";
const PYTHON_TEST_MODULE = "ml.ai-painter.tests.test_stage4_semantic_transport_v2_readonly_gpu_qualification";
const TEST_FILES = [
  "scripts/test-ai-painter-stage4-v2-readonly-gpu-node.mjs",
  "scripts/test-ai-painter-stage4-v2-readonly-gpu-background-launch.mjs",
];

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
assert.equal(current.registry.capabilityVersion, CAPABILITY);
assert.equal(current.registry.taskId, CURRENT_TASK);
assert.equal(current.registry.taskKind, "cpu_readonly_adjudication");
assert.equal(current.registry.executionState, "completed");
assert.equal(current.registry.activity, "resource_boundary_failure");
assert.equal(current.registry.nextMachineAction, null);
assert.equal(current.registry.activeExecution, null);
assert.equal(current.currentTaskTerminal?.status, CURRENT_STATUS);
assert.equal(current.currentTaskTerminal?.nextBoundaryAction,
  "reassess_readonly_gpu_resource_boundary");
assert.equal(current.currentTaskTerminal?.automaticRetryAllowed, false);

const immutableCurrent = captureImmutableCurrentRegistryEvidence({
  projectRoot: ROOT,
  current,
});
const adjudicationTerminal = readBinding(current.registry.terminalEvidence,
  "resource-boundary adjudication terminal");
const sourceTerminal = readBinding(adjudicationTerminal.value.sourceTerminal,
  "failed readonly-GPU terminal");
assert.equal(sourceTerminal.value.status,
  "stage4_v2_readonly_gpu_qualification_failed_closed");
assert.equal(sourceTerminal.value.executionState, "failed_closed");
assert.equal(sourceTerminal.value.trainingStarted, false);
assert.equal(sourceTerminal.value.weightsModified, false);
const failureReport = readBinding(sourceTerminal.value.failureReport,
  "readonly-GPU failure report");
assert.equal(failureReport.value.failureCode, "qualification_resource_preflight_failed");
const failureText = String(failureReport.value.error ?? "");
const historicalWddmFalsePositive = /conflicting_gpu_compute_process_detected/u.test(failureText);
const transientResourcePressure = /gpu_utilization_above_idle_limit|gpu_process_sm_utilization_above_idle_limit/u
  .test(failureText);
const cpuMemoryMeasurementDefect = /stage4_v2_readonly_gpu_cpu_memory_measurement_unavailable/u
  .test(failureText);
assert.equal(historicalWddmFalsePositive || transientResourcePressure || cpuMemoryMeasurementDefect, true,
  "source failure is not a recognized readonly-GPU resource boundary");
for (const key of ["optimizerCreated", "backwardExecuted", "weightsModified", "trainingStarted"]) {
  assert.equal(failureReport.value[key], false, `${key} must remain false`);
}

const packageId = sourceTerminal.value.packageId;
const packageRoot = inside(`.runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/${packageId}`);
const packageManifest = readBoundFile(path.join(packageRoot, "package-manifest.json"),
  "failed qualification package manifest");
assert.equal(packageManifest.value.packageId, packageId);
assert.equal(packageManifest.value.runId, sourceTerminal.value.runId);
const packagePayload = readBinding(packageManifest.value.packagePayload,
  "failed qualification package payload");
const oldProgramGraph = readBinding(packageManifest.value.programGraphManifest,
  "failed qualification program graph");
const oldRunner = findEntrypoint(oldProgramGraph.value, "nodeRunner", RUNNER_PATH);
const oldLauncher = findEntrypoint(oldProgramGraph.value, "backgroundLauncher", LAUNCHER_PATH);
const oldPythonRunner = findEntrypoint(oldProgramGraph.value, "pythonRunner", PYTHON_RUNNER_PATH);
const currentRunner = bind(RUNNER_PATH);
const currentLauncher = bind(LAUNCHER_PATH);
const currentPythonRunner = bind(PYTHON_RUNNER_PATH);
if (historicalWddmFalsePositive) {
  assert.notEqual(currentRunner.sha256, oldRunner.sha256,
    "readonly-GPU runner bytes did not change after the classified WDDM defect");
  assert.notEqual(currentLauncher.sha256, oldLauncher.sha256,
    "readonly-GPU launcher bytes did not change after the failed handoff");
  assert.equal(currentPythonRunner.sha256, oldPythonRunner.sha256,
    "WDDM repair cannot silently change the Python qualification runner");
} else if (cpuMemoryMeasurementDefect) {
  assert.equal(currentRunner.sha256, oldRunner.sha256,
    "CPU-memory telemetry repair cannot silently change the Node runner");
  assert.equal(currentLauncher.sha256, oldLauncher.sha256,
    "CPU-memory telemetry repair cannot silently change the launcher");
  assert.notEqual(currentPythonRunner.sha256, oldPythonRunner.sha256,
    "Python qualification runner bytes did not change after the CPU-memory telemetry failure");
} else {
  assert.equal(currentRunner.sha256, oldRunner.sha256,
    "transient resource reassessment cannot silently change the runner");
  assert.equal(currentLauncher.sha256, oldLauncher.sha256,
    "transient resource reassessment cannot silently change the launcher");
  assert.equal(currentPythonRunner.sha256, oldPythonRunner.sha256,
    "transient resource reassessment cannot silently change the Python runner");
}
const runnerSource = fs.readFileSync(inside(RUNNER_PATH), "utf8");
assert.match(runnerSource, /const dedicatedCompute = hasCompute && !hasGraphics/u);
assert.match(runnerSource, /if \(dedicatedCompute \|\| riskIdentity\)/u);

const parentRegistry = readBinding(packagePayload.value.parentRegistry?.binding,
  "package parent registry snapshot");
assert.equal(parentRegistry.value.registryRevision,
  packagePayload.value.parentRegistry.registryRevision);
assert.equal(parentRegistry.value.taskId, NEXT_TASK);
assert.equal(parentRegistry.value.taskKind, "cpu_readonly_gpu_qualification_planning");
assert.equal(parentRegistry.value.nextMachineAction, NEXT_ACTION);
const cpuTerminal = readBinding(parentRegistry.value.terminalEvidence,
  "original V2 CPU acceptance terminal");
assert.equal(cpuTerminal.value.status,
  "stage4_v2_cpu_contract_acceptance_passed_inactive");
assert.equal(cpuTerminal.value.nextActionEligible,
  "readonly_gpu_qualification_planning");

// This is deliberately one current, frozen resource check. A failure leaves the
// current registry untouched and cannot be converted into a qualification pass.
const resource = runResourcePreflight({ root: ROOT });
assert.equal(resource.status, "passed");
assert.deepEqual(resource.blockers, []);

const testRuns = TEST_FILES.map((testFile) => runCommand({
  path: testFile,
  command: process.execPath,
  args: [testFile],
}));
if (cpuMemoryMeasurementDefect) {
  testRuns.push(runCommand({
    path: `python-module:${PYTHON_TEST_MODULE}`,
    command: inside(PROJECT_PYTHON_PATH),
    args: ["-B", "-m", "unittest", PYTHON_TEST_MODULE],
  }));
}
assert.equal(testRuns.every((test) => test.exitCode === 0), true,
  testRuns.map((test) => `${test.path}: ${test.stderr || test.stdout}`).join("\n"));

const reassessmentId = `stage4-v2-wddm-resource-reassessment-${sha256Text([
  adjudicationTerminal.binding.sha256,
  sourceTerminal.binding.sha256,
  currentRunner.sha256,
  currentLauncher.sha256,
  currentPythonRunner.sha256,
].join(":" )).slice(0, 24)}`;
const outputRoot = inside(`${OUTPUT_ROOT}/${reassessmentId}`);
fs.mkdirSync(outputRoot, { recursive: true });
const recordedAtUtc = resource.recordedAtUtc;

const validation = {
  schemaVersion: "ai-painter-stage4-v2-wddm-resource-reassessment-validation-v1",
  status: "passed",
  reassessmentId,
  tests: testRuns,
  runner: currentRunner,
  launcher: currentLauncher,
  pythonRunner: currentPythonRunner,
  gpuStarted: false,
  trainingStarted: false,
  completedAtUtc: recordedAtUtc,
};
const validationPath = path.join(outputRoot, "validation.json");
writeOrVerifyJson(validationPath, validation);
const validationBinding = bind(projectPath(validationPath));

const resourcePath = path.join(outputRoot, "resource-preflight.json");
writeOrVerifyJson(resourcePath, resource);
const resourceBinding = bind(projectPath(resourcePath));

const terminal = {
  schemaVersion: "ai-painter-stage4-v2-wddm-resource-boundary-reassessment-terminal-v1",
  executionState: "completed",
  status: historicalWddmFalsePositive
    ? "wddm_false_positive_fixed_current_frozen_resource_preflight_passed"
    : cpuMemoryMeasurementDefect
      ? "windows_cpu_memory_telemetry_fixed_current_frozen_resource_preflight_passed"
      : "transient_resource_pressure_cleared_current_frozen_resource_preflight_passed",
  reassessmentId,
  capabilityVersion: CAPABILITY,
  adjudicationTerminal: adjudicationTerminal.binding,
  sourceFailureTerminal: sourceTerminal.binding,
  sourceFailureReport: failureReport.binding,
  failedPackageManifest: packageManifest.binding,
  failedProgramGraph: oldProgramGraph.binding,
  previousRunner: pickBinding(oldRunner),
  previousLauncher: pickBinding(oldLauncher),
  previousPythonRunner: pickBinding(oldPythonRunner),
  repairedRunner: currentRunner,
  repairedLauncher: currentLauncher,
  repairedPythonRunner: currentPythonRunner,
  validation: validationBinding,
  resourcePreflight: resourceBinding,
  originalCpuAcceptanceTerminal: cpuTerminal.binding,
  decision: {
    classification: historicalWddmFalsePositive
      ? "windows_wddm_c_plus_g_false_positive_implementation_defect"
      : cpuMemoryMeasurementDefect
        ? "windows_cpu_memory_telemetry_ffi_signature_defect"
        : "transient_gpu_resource_pressure_cleared",
    failedPackageReuseAllowed: false,
    failedTicketReuseAllowed: false,
    failedRunRetryAllowed: false,
    freshPlanningRevisionAllowed: true,
    thresholdChanged: false,
    modelVersionChanged: false,
    dataVersionChanged: false,
  },
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  weightsModified: false,
  trainingStarted: false,
  recordedAtUtc,
};
const terminalPath = path.join(outputRoot, "phase-terminal.json");
writeOrVerifyJson(terminalPath, terminal);
const terminalBinding = bind(projectPath(terminalPath));

const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${reassessmentId}`,
  generatedFrom: "verified_resource_boundary_reassessment",
  readOnly: true,
  module: { id: "ai-painter-stage4", nameZh: "AI Painter Stage4" },
  fixedOverallProgress: {
    completedStages: 3,
    totalStages: 5,
    percent: 60,
    source: "current_execution_registry",
  },
  currentStage: {
    number: 4,
    total: 5,
    labelZh: "V2只读GPU资格",
    status: "fresh_qualification_planning_ready_after_wddm_reassessment",
  },
  taskIdentity: { modelId: CAPABILITY, runId: reassessmentId },
  latestTerminal: terminalBinding,
  latestBlocker: null,
  nextAllowedAction: NEXT_ACTION,
  forbiddenActions: [
    "reuse_failed_qualification_package",
    "reuse_failed_qualification_ticket",
    "retry_failed_qualification_run",
    "lower_resource_thresholds",
    "start_training_before_readonly_gpu_qualification",
  ],
  evidence: [
    immutableCurrent.transaction,
    immutableCurrent.snapshot,
    adjudicationTerminal.binding,
    sourceTerminal.binding,
    failureReport.binding,
    packageManifest.binding,
    packagePayload.binding,
    oldProgramGraph.binding,
    cpuTerminal.binding,
    validationBinding,
    resourceBinding,
    terminalBinding,
  ].map((item) => ({ ...item, sha256Verified: true })),
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
  },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
};
const capsulePath = path.join(outputRoot, "task-capsule.json");
writeOrVerifyJson(capsulePath, capsule);
const capsuleBinding = bind(projectPath(capsulePath));

const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: reassessmentId,
  taskId: NEXT_TASK,
  taskKind: "cpu_readonly_gpu_qualification_planning",
  taskGoal: "Materialize a fresh bounded Stage4 V2 readonly-GPU qualification package after the prior resource failure was classified and the unchanged current resource limits passed.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: NEXT_ACTION,
  queuedAtUtc: recordedAtUtc,
  runId: reassessmentId,
  lifecycleStage: "cpu_contract_accepted",
  executionState: "package_materialized",
  activity: "readonly_gpu_qualification_replanning_ready_after_wddm_resource_reassessment",
  taskCapsulePath: capsuleBinding.path,
  terminalEvidencePath: cpuTerminal.binding.path,
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
});

process.stdout.write(`${JSON.stringify({
  status: terminal.status,
  reassessment: terminalBinding,
  validation: validationBinding,
  resourcePreflight: resourceBinding,
  registryRevision: advanced.registry.registryRevision,
  nextMachineAction: advanced.registry.nextMachineAction,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

function runCommand({ path: testPath, command, args }) {
  const startedAtUtc = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    path: testPath,
    command: [command, ...args],
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    startedAtUtc,
    completedAtUtc: new Date().toISOString(),
  };
}

function findEntrypoint(graph, role, entryPath) {
  const entry = graph.entrypoints?.find((item) => item.role === role && item.path === entryPath);
  assert.ok(entry, `program graph is missing ${role}`);
  assert.match(entry.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`);
  return entry;
}

function pickBinding(binding) {
  return {
    path: binding.path,
    sha256: binding.sha256,
    ...(Number.isSafeInteger(binding.byteSize) ? { byteSize: binding.byteSize } : {}),
  };
}

function readBinding(binding, role) {
  assert.match(binding?.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`);
  const absolute = inside(binding.path);
  assert.equal(fs.statSync(absolute).isFile(), true, `${role} is not a file`);
  assert.equal(sha256File(absolute), binding.sha256, `${role} SHA-256 mismatch`);
  return { value: readJson(absolute), binding: bind(projectPath(absolute)) };
}

function readBoundFile(absolute, role) {
  assert.equal(fs.statSync(absolute).isFile(), true, `${role} is not a file`);
  return { value: readJson(absolute), binding: bind(projectPath(absolute)) };
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(value, "utf8"));
}

function inside(value) {
  const absolute = path.resolve(ROOT, value);
  assert.ok(absolute === ROOT || absolute.startsWith(`${ROOT}${path.sep}`),
    `path escapes project: ${value}`);
  return absolute;
}

function projectPath(value) {
  return path.relative(ROOT, inside(value)).replaceAll("\\", "/");
}

function bind(value) {
  const absolute = inside(value);
  return {
    path: projectPath(absolute),
    sha256: sha256File(absolute),
    byteSize: fs.statSync(absolute).size,
  };
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeOrVerifyJson(target, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(target)) {
    assert.equal(fs.readFileSync(target, "utf8"), bytes,
      `immutable reassessment evidence differs: ${target}`);
    return;
  }
  fs.writeFileSync(target, bytes, { encoding: "utf8", flag: "wx" });
}
