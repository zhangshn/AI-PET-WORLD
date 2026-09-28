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
const CURRENT_TASK = "stage4_v2_readonly_gpu_qualification_failure_adjudicated";
const CURRENT_STATUS = "stage4_v2_readonly_gpu_evidence_integrity_failure_confirmed";
const NEXT_TASK = "plan_stage4_v2_readonly_gpu_qualification";
const NEXT_ACTION = "plan:ai-painter-stage4-v2-readonly-gpu-qualification";
const PLANNER_PATH = "scripts/plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-v2-readonly-gpu-binding-repairs";
const TEST_FILES = [
  "scripts/tests/test-ai-painter-stage4-v2-readonly-gpu-materialization-recovery.mjs",
  "scripts/tests/test-ai-painter-stage4-v2-readonly-gpu-issuer-publication.mjs",
  "scripts/tests/test-ai-painter-stage4-v2-readonly-gpu-qualification-failure-adjudication.mjs",
];

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
assert.equal(current.registry.capabilityVersion, CAPABILITY);
assert.equal(current.registry.taskId, CURRENT_TASK);
assert.equal(current.registry.taskKind, "cpu_readonly_adjudication");
assert.equal(current.registry.executionState, "completed");
assert.equal(current.registry.activity, "evidence_integrity_failure");
assert.equal(current.registry.nextMachineAction, null);
assert.equal(current.registry.activeExecution, null);
assert.equal(current.currentTaskTerminal?.status, CURRENT_STATUS);
assert.equal(current.currentTaskTerminal?.nextBoundaryAction,
  "repair_current_evidence_integrity_chain");
assert.equal(current.currentTaskTerminal?.automaticRetryAllowed, false);

const immutableCurrent = captureImmutableCurrentRegistryEvidence({
  projectRoot: ROOT,
  current,
});
const adjudicationTerminal = readBinding(current.registry.terminalEvidence,
  "evidence-integrity adjudication terminal");
const sourceTerminal = readBinding(adjudicationTerminal.value.sourceTerminal,
  "failed readonly-GPU terminal");
assert.equal(sourceTerminal.value.status,
  "stage4_v2_readonly_gpu_qualification_failed_closed");
assert.equal(sourceTerminal.value.executionState, "failed_closed");
const failureReport = readBinding(sourceTerminal.value.failureReport,
  "readonly-GPU failure report");
assert.equal(failureReport.value.failureCode, "qualification_cuda_or_evidence_failed");
assert.match(String(failureReport.value.error ?? ""),
  /stage4_v2_readonly_gpu_trainerSupport_path_invalid/u);
assert.equal(failureReport.value.ticketConsumed, true);
for (const key of ["optimizerCreated", "backwardExecuted", "weightsModified", "trainingStarted"]) {
  assert.equal(failureReport.value[key], false, `${key} must remain false`);
}

const packageId = sourceTerminal.value.packageId;
const packageRoot = inside(`.runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/${packageId}`);
const packageManifest = readBoundFile(path.join(packageRoot, "package-manifest.json"),
  "failed qualification package manifest");
assert.equal(packageManifest.value.packageId, packageId);
const packagePayload = readBinding(packageManifest.value.packagePayload,
  "failed qualification package payload");
const oldProgramGraph = readBinding(packageManifest.value.programGraphManifest,
  "failed qualification program graph");
const oldPlanner = findEntrypoint(oldProgramGraph.value, "materializer", PLANNER_PATH);
const currentPlanner = bind(PLANNER_PATH);
assert.notEqual(currentPlanner.sha256, oldPlanner.sha256,
  "planner bytes did not change after the trainer-support binding failure");
assert.equal(packagePayload.value.bindings?.trainerSupport?.path,
  packagePayload.value.programLineage?.trainerSupport?.path,
  "failed payload does not contain the diagnosed contract/program path collision");
assert.match(packagePayload.value.bindings.trainerSupport.path,
  /ai_painter_stage4_semantic_transport_v2_trainer_support\.py$/u);
const plannerSource = fs.readFileSync(inside(PLANNER_PATH), "utf8");
assert.match(plannerSource, /trainerSupport: parent\.lossContract/u);

const parentRegistry = readBinding(packagePayload.value.parentRegistry?.binding,
  "package parent registry snapshot");
assert.equal(parentRegistry.value.taskId, NEXT_TASK);
assert.equal(parentRegistry.value.taskKind, "cpu_readonly_gpu_qualification_planning");
assert.equal(parentRegistry.value.nextMachineAction, NEXT_ACTION);
const cpuTerminal = readBinding(parentRegistry.value.terminalEvidence,
  "original V2 CPU acceptance terminal");
assert.equal(cpuTerminal.value.status,
  "stage4_v2_cpu_contract_acceptance_passed_inactive");

const startedAtUtc = new Date().toISOString();
const test = spawnSync(process.execPath, ["--test", ...TEST_FILES], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
const validation = {
  schemaVersion: "ai-painter-stage4-v2-readonly-gpu-binding-repair-validation-v1",
  status: test.status === 0 ? "passed" : "failed",
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
assert.equal(test.status, 0, test.stderr || test.stdout || "binding repair validation failed");

const repairId = `stage4-v2-readonly-gpu-binding-repair-${sha256Text([
  sourceTerminal.binding.sha256,
  oldPlanner.sha256,
  currentPlanner.sha256,
].join(":" )).slice(0, 24)}`;
const outputRoot = inside(`${OUTPUT_ROOT}/${repairId}`);
fs.mkdirSync(outputRoot, { recursive: true });
const validationPath = path.join(outputRoot, "validation.json");
writeOrVerifyJson(validationPath, validation);
const validationBinding = bind(projectPath(validationPath));
const recordedAtUtc = validation.completedAtUtc;

const terminal = {
  schemaVersion: "ai-painter-stage4-v2-readonly-gpu-binding-repair-terminal-v1",
  executionState: "completed",
  status: "trainer_support_contract_program_binding_collision_repaired_fresh_plan_allowed",
  repairId,
  capabilityVersion: CAPABILITY,
  adjudicationTerminal: adjudicationTerminal.binding,
  sourceFailureTerminal: sourceTerminal.binding,
  sourceFailureReport: failureReport.binding,
  failedPackageManifest: packageManifest.binding,
  failedPackagePayload: packagePayload.binding,
  failedProgramGraph: oldProgramGraph.binding,
  previousPlanner: pickBinding(oldPlanner),
  repairedPlanner: currentPlanner,
  originalCpuAcceptanceTerminal: cpuTerminal.binding,
  validation: validationBinding,
  decision: {
    classification: "trainer_support_contract_program_binding_collision",
    failedPackageReuseAllowed: false,
    consumedTicketReuseAllowed: false,
    failedRunRetryAllowed: false,
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
const terminalPath = path.join(outputRoot, "phase-terminal.json");
writeOrVerifyJson(terminalPath, terminal);
const terminalBinding = bind(projectPath(terminalPath));

const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${repairId}`,
  generatedFrom: "verified_evidence_integrity_repair",
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
    status: "fresh_qualification_planning_ready_after_binding_repair",
  },
  taskIdentity: { modelId: CAPABILITY, runId: repairId },
  latestTerminal: terminalBinding,
  latestBlocker: null,
  nextAllowedAction: NEXT_ACTION,
  forbiddenActions: [
    "reuse_failed_qualification_package",
    "reuse_consumed_qualification_ticket",
    "retry_failed_qualification_run",
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
  packageId: repairId,
  taskId: NEXT_TASK,
  taskKind: "cpu_readonly_gpu_qualification_planning",
  taskGoal: "Materialize a fresh bounded Stage4 V2 readonly-GPU qualification package after repairing and regression-testing the trainer-support governance-contract versus program-lineage binding collision.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: NEXT_ACTION,
  queuedAtUtc: recordedAtUtc,
  runId: repairId,
  lifecycleStage: "cpu_contract_accepted",
  executionState: "package_materialized",
  activity: "readonly_gpu_qualification_replanning_ready_after_binding_repair",
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
      `immutable binding-repair evidence differs: ${target}`);
    return;
  }
  fs.writeFileSync(target, bytes, { encoding: "utf8", flag: "wx" });
}
