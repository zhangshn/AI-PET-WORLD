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

const ROOT = process.cwd();
const CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const TASK_ID = "plan_stage4_v2_readonly_gpu_qualification";
const NEXT_ACTION = "plan:ai-painter-stage4-v2-readonly-gpu-qualification";
const INTENT_ROOT = ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-materializations";
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-v2-readonly-gpu-materialization-repairs";
const PLANNER_PATH = "scripts/plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
const TEST_FILES = [
  "scripts/tests/test-ai-painter-program-event-store-atomicity.mjs",
  "scripts/tests/test-ai-painter-stage4-v2-readonly-gpu-materialization-recovery.mjs",
  "scripts/tests/test-ai-painter-stage4-v2-readonly-gpu-issuer-publication.mjs",
  "scripts/tests/test-ai-painter-stage4-v2-readonly-gpu-qualification-failure-adjudication.mjs",
];

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
assert.equal(current.registry.capabilityVersion, CAPABILITY);
assert.equal(current.registry.taskId, TASK_ID);
assert.equal(current.registry.taskKind, "cpu_readonly_gpu_qualification_planning");
assert.equal(current.registry.nextMachineAction, NEXT_ACTION);
assert.equal(current.registry.executionState, "package_materialized");
assert.equal(current.registry.activeExecution, null);
assert.equal(current.currentTaskTerminal?.status,
  "stage4_v2_cpu_contract_acceptance_passed_inactive");

const immutableCurrent = captureImmutableCurrentRegistryEvidence({
  projectRoot: ROOT,
  current,
});
const intentDirectory = inside(`${INTENT_ROOT}/${current.registrySha256}`);
const intentPath = path.join(intentDirectory, "materialization-intent.json");
const intentHashPath = path.join(intentDirectory, "materialization-intent.sha256.json");
const intent = readJson(intentPath);
const intentHash = readJson(intentHashPath);
assert.equal(intentHash.intentFile, "materialization-intent.json");
assert.equal(intentHash.sha256, sha256File(intentPath));
assert.equal(intent.parentRegistry?.registryRevision, current.registry.registryRevision);
assert.equal(intent.parentRegistry?.registrySha256, current.registrySha256);
assert.equal(intent.parentRegistry?.taskId, TASK_ID);

const packageDirectory = inside(intent.packageDirectory);
const failureTerminal = readBoundFile(
  path.join(packageDirectory, "materialization-failure-terminal.json"),
  "materialization failure terminal",
);
assert.equal(failureTerminal.value.executionState, "failed_closed");
assert.equal(failureTerminal.value.status,
  "stage4_v2_readonly_gpu_qualification_materialization_failed_closed");
assert.equal(failureTerminal.value.packageId, intent.packageId);
assert.equal(failureTerminal.value.runId, intent.runId);
assert.equal(failureTerminal.value.automaticRetryAllowed, false);
assert.equal(failureTerminal.value.gpuStarted, false);
assert.equal(failureTerminal.value.trainingStarted, false);

const failureReport = readBinding(failureTerminal.value.failureReport,
  "materialization failure report");
assert.equal(failureReport.value.errorCode,
  "Cannot read properties of undefined (reading 'id')");
assert.equal(failureReport.value.ticket?.disposition, "closed_unconsumed");
assert.equal(failureReport.value.gpuStarted, false);
assert.equal(failureReport.value.optimizerCreated, false);
assert.equal(failureReport.value.backwardExecuted, false);
assert.equal(failureReport.value.weightsModified, false);
assert.equal(failureReport.value.trainingStarted, false);
const ticketClosure = readBinding(failureTerminal.value.ticketClosure,
  "closed qualification ticket");
assert.equal(ticketClosure.value.status, "closed_unconsumed");

const packageManifest = readBoundFile(
  path.join(packageDirectory, "package-manifest.json"),
  "failed package manifest",
);
const oldProgramGraph = readBinding(packageManifest.value.programGraphManifest,
  "failed package program graph");
const oldMaterializer = oldProgramGraph.value.entrypoints?.find(
  (entry) => entry.role === "materializer" && entry.path === PLANNER_PATH,
);
assert.ok(oldMaterializer, "failed package does not bind the materializer");
const currentPlanner = bind(PLANNER_PATH);
assert.notEqual(currentPlanner.sha256, oldMaterializer.sha256,
  "planner bytes did not change after the recorded implementation failure");
const plannerSource = fs.readFileSync(inside(PLANNER_PATH), "utf8");
assert.match(plannerSource, /verifyAiPainterProgramEventCommitted/u);
assert.match(plannerSource, /writtenProgramEvent\?\.event/u);

const repairId = `stage4-v2-readonly-gpu-materialization-repair-${sha256Text(
  `${failureTerminal.binding.sha256}:${oldMaterializer.sha256}:${currentPlanner.sha256}`,
).slice(0, 24)}`;
const repairRoot = inside(`${OUTPUT_ROOT}/${repairId}`);
fs.mkdirSync(repairRoot, { recursive: true });
const validationPath = path.join(repairRoot, "validation.json");
let validation;
if (fs.existsSync(validationPath)) {
  validation = readJson(validationPath);
  assert.equal(validation.planner.sha256, currentPlanner.sha256);
  assert.equal(validation.exitCode, 0);
} else {
  const startedAtUtc = new Date().toISOString();
  const test = spawnSync(process.execPath, ["--test", ...TEST_FILES], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  validation = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-repair-validation-v1",
    status: test.status === 0 ? "passed" : "failed",
    repairId,
    planner: currentPlanner,
    command: [process.execPath, "--test", ...TEST_FILES],
    exitCode: test.status,
    stdout: test.stdout,
    stderr: test.stderr,
    gpuStarted: false,
    trainingStarted: false,
    startedAtUtc,
    completedAtUtc: new Date().toISOString(),
  };
  writeExclusiveJson(validationPath, validation);
  assert.equal(test.status, 0, test.stderr || test.stdout || "repair validation failed");
}
const validationBinding = bind(projectPath(validationPath));
const recordedAtUtc = validation.completedAtUtc;
const terminal = {
  schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-repair-terminal-v1",
  executionState: "completed",
  status: "materialization_implementation_failure_adjudicated_fresh_plan_allowed",
  repairId,
  capabilityVersion: CAPABILITY,
  failedIntent: bind(projectPath(intentPath)),
  failedPackageManifest: packageManifest.binding,
  failureTerminal: failureTerminal.binding,
  failureReport: failureReport.binding,
  closedTicket: ticketClosure.binding,
  previousProgramGraph: oldProgramGraph.binding,
  previousPlanner: {
    path: oldMaterializer.path,
    sha256: oldMaterializer.sha256,
    byteSize: oldMaterializer.byteSize,
  },
  repairedPlanner: currentPlanner,
  validation: validationBinding,
  decision: {
    classification: "pre_gpu_materialization_implementation_defect",
    failedPackageReuseAllowed: false,
    closedTicketReuseAllowed: false,
    outputReuseAllowed: false,
    freshPlanningRevisionAllowed: true,
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
const terminalPath = path.join(repairRoot, "terminal.json");
writeOrVerifyJson(terminalPath, terminal);
const terminalBinding = bind(projectPath(terminalPath));
const cpuTerminal = readBinding(current.registry.terminalEvidence,
  "V2 CPU acceptance terminal");
const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${repairId}`,
  generatedFrom: "program_saved_evidence",
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
    status: "fresh_materialization_planning_ready",
  },
  taskIdentity: { modelId: CAPABILITY, runId: repairId },
  latestTerminal: terminalBinding,
  latestBlocker: null,
  nextAllowedAction: NEXT_ACTION,
  forbiddenActions: [
    "reuse_failed_materialization_package",
    "reuse_closed_qualification_ticket",
    "reuse_failed_output_directory",
    "start_training_before_readonly_gpu_qualification",
  ],
  evidence: [
    immutableCurrent.transaction,
    immutableCurrent.snapshot,
    cpuTerminal.binding,
    failureTerminal.binding,
    failureReport.binding,
    ticketClosure.binding,
    oldProgramGraph.binding,
    validationBinding,
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
const capsulePath = path.join(repairRoot, "task-capsule.json");
writeOrVerifyJson(capsulePath, capsule);
const capsuleBinding = bind(projectPath(capsulePath));

const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: repairId,
  taskId: TASK_ID,
  taskKind: "cpu_readonly_gpu_qualification_planning",
  taskGoal: "Materialize a fresh bounded Stage4 V2 readonly-GPU qualification package after the prior pre-GPU materialization implementation defect was fixed and independently regression-tested.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: NEXT_ACTION,
  queuedAtUtc: recordedAtUtc,
  runId: repairId,
  lifecycleStage: "cpu_contract_accepted",
  executionState: "package_materialized",
  activity: "readonly_gpu_qualification_replanning_ready_after_materialization_repair",
  taskCapsulePath: capsuleBinding.path,
  terminalEvidencePath: cpuTerminal.binding.path,
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
});

process.stdout.write(`${JSON.stringify({
  status: terminal.status,
  repair: terminalBinding,
  validation: validationBinding,
  registryRevision: advanced.registry.registryRevision,
  nextMachineAction: advanced.registry.nextMachineAction,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

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

function writeExclusiveJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

function writeOrVerifyJson(target, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(target)) {
    assert.equal(fs.readFileSync(target, "utf8"), bytes,
      `immutable repair evidence differs: ${target}`);
    return;
  }
  fs.writeFileSync(target, bytes, { encoding: "utf8", flag: "wx" });
}
