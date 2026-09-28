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
const CURRENT_TASK = "materialize_stage4_v2_controlled_smoke_contract";
const CURRENT_ACTION = "plan:ai-painter-stage4-v2-controlled-smoke";
const NEXT_TASK = "plan_stage4_v2_readonly_gpu_qualification";
const NEXT_ACTION = "plan:ai-painter-stage4-v2-readonly-gpu-qualification";
const PLANNER_PATH = "scripts/plan-ai-painter-stage4-v2-controlled-smoke.mjs";
const ALLOWED_CHANGED_PROGRAM_PATHS = Object.freeze([
  "scripts/lib/ai-painter-capability-lifecycle-v1.mjs",
  "scripts/lib/ai-painter-stage4-v2-qualification-lifecycle-v1.mjs",
  PLANNER_PATH,
  "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
]);
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-v2-qualified-successor-change-reconciliations";

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
assert.equal(current.registry.capabilityVersion, CAPABILITY);
assert.equal(current.registry.taskId, CURRENT_TASK);
assert.equal(current.registry.taskKind, "controlled_smoke_planning");
assert.equal(current.registry.nextMachineAction, CURRENT_ACTION);
assert.equal(current.registry.executionState, "package_materialized");
assert.equal(current.registry.activeExecution, null);
assert.equal(current.currentTaskTerminal?.status,
  "stage4_v2_readonly_gpu_qualification_passed");
assert.equal(current.currentTaskTerminal?.trainingStarted, false);

const immutableCurrent = captureImmutableCurrentRegistryEvidence({
  projectRoot: ROOT,
  current,
});
const qualificationTerminal = readBinding(current.registry.terminalEvidence,
  "qualified readonly-GPU terminal");
const finalization = readBinding(qualificationTerminal.value.finalization,
  "readonly-GPU finalization");
const qualificationResult = readBinding(qualificationTerminal.value.qualificationResult,
  "readonly-GPU qualification result");
assert.equal(qualificationResult.value.status,
  "stage4_v2_readonly_gpu_qualification_passed");
assert.equal(qualificationResult.value.artifactClass, "production_qualification");
assert.equal(qualificationResult.value.automaticSmokeStarted, false);

const packageId = qualificationTerminal.value.packageId;
const packageRoot = inside(`.runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/${packageId}`);
const packageManifest = readBoundFile(path.join(packageRoot, "package-manifest.json"),
  "qualified package manifest");
const packagePayload = readBinding(packageManifest.value.packagePayload,
  "qualified package payload");
const qualifiedGraph = readBinding(packageManifest.value.programGraphManifest,
  "qualified program graph");
const qualifiedPlanner = findFile(qualifiedGraph.value, PLANNER_PATH);
const currentPlanner = bind(PLANNER_PATH);
assert.notEqual(currentPlanner.sha256, qualifiedPlanner.sha256,
  "controlled-Smoke planner did not change after the qualified program graph was frozen");
const plannerSource = fs.readFileSync(inside(PLANNER_PATH), "utf8");
assert.match(plannerSource, /bindingDigestIdentity\(result\.activeConfig\)/u);
assert.match(plannerSource, /export function bindingDigestIdentity/u);
const changedProgramFiles = qualifiedGraph.value.files
  .map((qualified) => ({
    qualified: pickBinding(qualified),
    current: bind(qualified.path),
  }))
  .filter(({ qualified, current: currentFile }) => qualified.sha256 !== currentFile.sha256);
const changedPaths = changedProgramFiles
  .map(({ current: currentFile }) => currentFile.path)
  .sort();
assert.ok(changedPaths.length > 0,
  "qualified program graph has no bounded successor change to reconcile");
assert.ok(changedPaths.includes(PLANNER_PATH),
  "controlled-Smoke planner did not change after qualification");
assert.equal(changedPaths.every((logicalPath) => (
  ALLOWED_CHANGED_PROGRAM_PATHS.includes(logicalPath)
)), true, "qualified program graph changed outside the bounded publication/lifecycle repair");
const lifecycleSource = fs.readFileSync(
  inside("scripts/lib/ai-painter-capability-lifecycle-v1.mjs"), "utf8");
const qualificationLifecycleSource = fs.readFileSync(
  inside("scripts/lib/ai-painter-stage4-v2-qualification-lifecycle-v1.mjs"), "utf8");
const qualificationRunnerSource = fs.readFileSync(
  inside("scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs"), "utf8");
assert.match(lifecycleSource, /allowSameStateEvidenceRefresh/u);
assert.match(qualificationLifecycleSource, /same_state_requalification/u);
assert.match(qualificationRunnerSource, /heartbeatFrozen/u);

const parentRegistry = readBinding(packagePayload.value.parentRegistry?.binding,
  "qualification parent registry snapshot");
const cpuTerminal = readBinding(parentRegistry.value.terminalEvidence,
  "original V2 CPU acceptance terminal");
assert.equal(cpuTerminal.value.status,
  "stage4_v2_cpu_contract_acceptance_passed_inactive");

const checks = [
  runCommand({
    id: "planner_syntax",
    command: process.execPath,
    args: ["--check", PLANNER_PATH],
  }),
  runCommand({
    id: "optional_byte_size_binding_identity",
    command: process.execPath,
    args: [
      "--input-type=module",
      "-e",
      `import assert from 'node:assert/strict'; import { bindingDigestIdentity as b } from './${PLANNER_PATH}'; assert.deepEqual(b({path:'x',sha256:'${"a".repeat(64)}'}), b({path:'x',sha256:'${"a".repeat(64)}',byteSize:7}));`,
    ],
  }),
  runCommand({
    id: "lifecycle_requalification_regression",
    command: process.execPath,
    args: ["--test", "scripts/tests/test-ai-painter-stage4-lifecycle-state-semantics.mjs"],
  }),
];
assert.equal(checks.every((check) => check.exitCode === 0), true,
  checks.map((check) => `${check.id}: ${check.stderr || check.stdout}`).join("\n"));

const reconciliationId = `stage4-v2-qualified-successor-change-${sha256Text([
  qualificationTerminal.binding.sha256,
  ...changedProgramFiles.flatMap(({ qualified, current: currentFile }) => [
    qualified.sha256,
    currentFile.sha256,
  ]),
].join(":" )).slice(0, 24)}`;
const outputRoot = inside(`${OUTPUT_ROOT}/${reconciliationId}`);
fs.mkdirSync(outputRoot, { recursive: true });
const recordedAtUtc = new Date().toISOString();
const validation = {
  schemaVersion: "ai-painter-stage4-v2-qualified-successor-change-validation-v1",
  status: "passed",
  reconciliationId,
  checks,
  qualifiedPlanner: pickBinding(qualifiedPlanner),
  currentPlanner,
  changedProgramFiles,
  gpuStarted: false,
  trainingStarted: false,
  completedAtUtc: recordedAtUtc,
};
const validationPath = path.join(outputRoot, "validation.json");
writeOrVerifyJson(validationPath, validation);
const validationBinding = bind(projectPath(validationPath));

const terminal = {
  schemaVersion: "ai-painter-stage4-v2-qualified-successor-change-terminal-v1",
  executionState: "completed",
  status: "qualified_successor_changed_requalification_required",
  reconciliationId,
  capabilityVersion: CAPABILITY,
  qualificationTerminal: qualificationTerminal.binding,
  qualificationFinalization: finalization.binding,
  qualificationResult: qualificationResult.binding,
  qualifiedPackageManifest: packageManifest.binding,
  qualifiedPackagePayload: packagePayload.binding,
  qualifiedProgramGraph: qualifiedGraph.binding,
  qualifiedPlanner: pickBinding(qualifiedPlanner),
  currentPlanner,
  changedProgramFiles,
  originalCpuAcceptanceTerminal: cpuTerminal.binding,
  validation: validationBinding,
  decision: {
    oldQualificationRemainsHistoricalEvidence: true,
    oldQualificationAuthorizesCurrentSuccessor: false,
    freshReadonlyGpuQualificationRequired: true,
    dataVersionChanged: false,
    modelVersionChanged: false,
    thresholdChanged: false,
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
  capsuleId: `local-ai-${reconciliationId}`,
  generatedFrom: "verified_qualified_program_graph_change",
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
    status: "requalification_ready_after_successor_change",
  },
  taskIdentity: { modelId: CAPABILITY, runId: reconciliationId },
  latestTerminal: terminalBinding,
  latestBlocker: null,
  nextAllowedAction: NEXT_ACTION,
  forbiddenActions: [
    "use_old_qualification_to_authorize_modified_successor",
    "reuse_consumed_qualification_ticket",
    "start_controlled_smoke_before_requalification",
  ],
  evidence: [
    immutableCurrent.transaction,
    immutableCurrent.snapshot,
    qualificationTerminal.binding,
    finalization.binding,
    qualificationResult.binding,
    packageManifest.binding,
    packagePayload.binding,
    qualifiedGraph.binding,
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
  packageId: reconciliationId,
  taskId: NEXT_TASK,
  taskKind: "cpu_readonly_gpu_qualification_planning",
  taskGoal: "Requalify the unchanged Stage4 V2 model and data against the corrected controlled-Smoke planner program graph before any training is allowed.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: NEXT_ACTION,
  queuedAtUtc: recordedAtUtc,
  runId: reconciliationId,
  lifecycleStage: "cpu_contract_accepted",
  executionState: "package_materialized",
  activity: "readonly_gpu_requalification_ready_after_qualified_successor_change",
  taskCapsulePath: capsuleBinding.path,
  terminalEvidencePath: cpuTerminal.binding.path,
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
});

process.stdout.write(`${JSON.stringify({
  status: terminal.status,
  reconciliation: terminalBinding,
  validation: validationBinding,
  registryRevision: advanced.registry.registryRevision,
  nextMachineAction: advanced.registry.nextMachineAction,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

function runCommand({ id, command, args }) {
  const startedAtUtc = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    id,
    command: [command, ...args],
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    startedAtUtc,
    completedAtUtc: new Date().toISOString(),
  };
}

function findFile(graph, logicalPath) {
  const file = graph.files?.find((item) => item.path === logicalPath);
  assert.ok(file, `qualified program graph is missing ${logicalPath}`);
  assert.match(file.sha256 ?? "", /^[a-f0-9]{64}$/u, "qualified file SHA-256 invalid");
  return file;
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
      `immutable successor-change evidence differs: ${target}`);
    return;
  }
  fs.writeFileSync(target, bytes, { encoding: "utf8", flag: "wx" });
}
