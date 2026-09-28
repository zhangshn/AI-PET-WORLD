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
  advanceCapabilityLifecycle,
  createCapabilityCandidate,
} from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import {
  STAGE4_V2_ARCHITECTURE,
  STAGE4_V2_CAPABILITY,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const ROOT = process.cwd();
const NEXT_TASK = "plan_stage4_v2_readonly_gpu_qualification";
const NEXT_ACTION = "plan:ai-painter-stage4-v2-readonly-gpu-qualification";
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-v2-rejected-program-successors";
const PROGRAM_PATHS = Object.freeze([
  "scripts/lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs",
  "scripts/plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
  "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
  "scripts/lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs",
  "scripts/lib/ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs",
  "scripts/lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs",
  "scripts/lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs",
  "scripts/plan-ai-painter-stage4-v2-controlled-smoke.mjs",
  "ml/ai-painter/scripts/run_stage4_semantic_transport_v2_controlled_smoke.py",
  "ml/ai-painter/scripts/stage4_semantic_transport_v2_controlled_smoke_training.py",
]);

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
const predecessorCapability = current.registry.capabilityVersion;
assert.notEqual(predecessorCapability, STAGE4_V2_CAPABILITY,
  "current registry already uses the successor capability");
assert.equal(current.registry.lifecycleStage, "rejected",
  "predecessor capability is not rejected");
assert.equal(current.registry.executionState, "completed",
  "predecessor failure adjudication is not complete");
assert.equal(current.registry.activeExecution, null,
  "an execution is still active");

const predecessorFailure = readBinding(current.registry.terminalEvidence,
  "predecessor failure terminal");
assert.equal(predecessorFailure.value.schemaVersion,
  "ai-painter-stage4-v2-controlled-smoke-failure-boundary-terminal-v1");
assert.equal(predecessorFailure.value.status,
  "controlled_smoke_program_boundary_confirmed");
assert.equal(predecessorFailure.value.sourceClosedLoopFailureKind, "program");
assert.ok([
  "stage4_smoke_non_train_optimizer_source",
  "stage4_v2_smoke_training_failed",
  "stage4_v2_smoke_machine_review_execution_failed",
].includes(predecessorFailure.value.sourceClosedLoopFailureCode),
"predecessor failure is not an accepted Stage4 program boundary");

const predecessorExecution = readBinding(predecessorFailure.value.sourceTerminal,
  "predecessor execution terminal");
const predecessorClosedLoop = readBinding(
  predecessorExecution.value.autonomousClosedLoopTerminal,
  "predecessor closed-loop terminal",
);
if ([
  "stage4_v2_smoke_training_failed",
  "stage4_v2_smoke_machine_review_execution_failed",
].includes(predecessorFailure.value.sourceClosedLoopFailureCode)) {
  const detail = predecessorClosedLoop.value.finalResult?.detail ?? "";
  const acceptedKnownDefect =
    /local AI capability ticket v2 immutable identity is invalid/u.test(detail)
    || (
      detail.includes("stage4_semantic_transport_v2_controlled_smoke_training.py")
      && detail.includes("_logical")
      && detail.includes("is not in the subpath of")
      && detail.includes("ai-pet-world")
    )
    || detail.includes("checkpoint Token-accounting identity differs from Manifest")
    || (
      predecessorFailure.value.sourceClosedLoopFailureCode
        === "stage4_v2_smoke_machine_review_execution_failed"
      && detail.includes("validateReviewExecutionBinding")
      && detail.includes("ai-assisted-condition-alignment.mjs")
      && detail.includes("byteSize")
      && detail.includes("role")
    )
    || (
      predecessorFailure.value.sourceClosedLoopFailureCode
        === "stage4_v2_smoke_machine_review_execution_failed"
      && predecessorCapability
        === "stage4_v2_machine_review_binding_and_canvas_fixed_program_v5"
      && detail.includes("validateReviewExecutionBinding")
      && detail.includes("ai-painter-stage4-v2-machine-review-execution-v1.mjs:405")
      && detail.includes("Expected values to be strictly equal")
    );
  assert.equal(acceptedKnownDefect, true,
    "generic Smoke failure is not an accepted deterministic program defect");
}
const predecessorPayload = readBinding(predecessorExecution.value.packagePayload,
  "predecessor Smoke payload");
const predecessorQualification = readBinding(
  predecessorPayload.value.readonlyGpuQualificationTerminal,
  "predecessor qualification terminal",
);
const predecessorQualificationPayload = readJsonFile(
  `.runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/${predecessorQualification.value.packageId}/package-payload.json`,
  "predecessor qualification payload",
);
const predecessorParentRegistry = readBinding(
  predecessorQualificationPayload.value.parentRegistry.binding,
  "predecessor qualification parent registry",
);
const predecessorCpuTerminal = readBinding(
  predecessorParentRegistry.value.terminalEvidence,
  "predecessor CPU acceptance terminal",
);
assert.equal(predecessorCpuTerminal.value.schemaVersion,
  "stage4-v2-cpu-contract-acceptance-terminal-v1");
assert.equal(predecessorCpuTerminal.value.status,
  "stage4_v2_cpu_contract_acceptance_passed_inactive");
const successorContract = readBinding(predecessorCpuTerminal.value.successorContract,
  "Stage4 V2 architecture contract");
assert.equal(successorContract.value.architectureId, STAGE4_V2_ARCHITECTURE);

const programBindings = PROGRAM_PATHS.map((logicalPath) => bind(logicalPath));
const identityHash = sha256Text([
  predecessorFailure.binding.sha256,
  predecessorClosedLoop.binding.sha256,
  predecessorCpuTerminal.binding.sha256,
  successorContract.binding.sha256,
  ...programBindings.map((item) => `${item.path}:${item.sha256}`),
].join("\n"));
const runId = `stage4-v2-program-successor-${identityHash.slice(0, 24)}`;
const outputDirectory = inside(`${OUTPUT_ROOT}/${runId}`);
fs.mkdirSync(inside(OUTPUT_ROOT), { recursive: true });
if (fs.existsSync(outputDirectory)) {
  assert.equal(fs.statSync(outputDirectory).isDirectory(), true,
    "program successor output path is not a directory");
} else {
  fs.mkdirSync(outputDirectory, { recursive: false });
}
const reportPath = path.join(outputDirectory, "cpu-verification-report.json");
const existingReport = fs.existsSync(reportPath)
  ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
  : null;
const recordedAtUtc = existingReport?.completedAtUtc ?? new Date().toISOString();

const checks = existingReport?.checks ?? [
  ...PROGRAM_PATHS.filter((item) => item.endsWith(".mjs")).map((logicalPath) => runCommand({
    id: `syntax_${path.basename(logicalPath).replaceAll(/[^a-zA-Z0-9]+/gu, "_")}`,
    command: process.execPath,
    args: ["--check", logicalPath],
  })),
  runCommand({
    id: "smoke_split_policy_node",
    command: process.execPath,
    args: ["--test", "scripts/tests/test-ai-painter-stage4-smoke-split-policy.mjs"],
  }),
  runCommand({
    id: "smoke_split_policy_python",
    command: pythonExecutable(),
    args: ["ml/ai-painter/tests/test_stage4_smoke_split_policy.py"],
  }),
];
assert.equal(checks.every((item) => item.exitCode === 0), true,
  checks.filter((item) => item.exitCode !== 0)
    .map((item) => `${item.id}: ${item.stderr || item.stdout}`).join("\n"));

const report = {
  schemaVersion: "ai-painter-stage4-v2-program-successor-cpu-report-v1",
  status: "passed",
  runId,
  architectureId: STAGE4_V2_ARCHITECTURE,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  changeClass: "program_lineage",
  predecessorCapabilityVersion: predecessorCapability,
  predecessorFailure: predecessorFailure.binding,
  predecessorClosedLoop: predecessorClosedLoop.binding,
  predecessorCpuAcceptance: predecessorCpuTerminal.binding,
  successorContract: successorContract.binding,
  programBindings,
  checks,
  dataVersionChanged: false,
  modelArchitectureChanged: false,
  thresholdChanged: false,
  splitChanged: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  weightsModified: false,
  trainingStarted: false,
  completedAtUtc: recordedAtUtc,
};
writeOrVerifyJson(reportPath, report);
const reportBinding = bind(projectPath(reportPath));

const terminal = {
  schemaVersion: "stage4-v2-cpu-contract-acceptance-terminal-v1",
  runId,
  architectureId: STAGE4_V2_ARCHITECTURE,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  executionClass: "cpu_readonly",
  executionState: "completed",
  status: "stage4_v2_cpu_contract_acceptance_passed_inactive",
  failureCode: null,
  cpuAcceptanceReport: reportBinding,
  sourceAdjudication: predecessorCpuTerminal.value.sourceAdjudication,
  successorContract: successorContract.binding,
  predecessorFailure: predecessorFailure.binding,
  predecessorClosedLoop: predecessorClosedLoop.binding,
  activationState: "inactive",
  nextActionEligible: "readonly_gpu_qualification_planning",
  ownerAuthorizationRequired: false,
  safety: {
    gpuAllowed: false,
    optimizerAllowed: false,
    backwardAllowed: false,
    checkpointWeightsReadAllowed: false,
    weightMutationAllowed: false,
    trainingAllowed: false,
    checkpointFileHashVerificationAllowed: true,
    checkpointWeightsRead: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    trainingStarted: false,
  },
  recordedAtUtc,
};
const terminalPath = path.join(outputDirectory, "phase-terminal.json");
writeOrVerifyJson(terminalPath, terminal);
const terminalBinding = bind(projectPath(terminalPath));

const candidateSpec = {
  schemaVersion: "ai-painter-capability-change-candidate-v1",
  capabilityVersion: STAGE4_V2_CAPABILITY,
  changeClass: "program_lineage",
  architectureId: STAGE4_V2_ARCHITECTURE,
  predecessorCapabilityVersion: predecessorCapability,
  ownerAuthorizationRequired: false,
  ownerInLifecycle: false,
  sourceEvidence: [
    predecessorFailure.binding,
    predecessorClosedLoop.binding,
    predecessorCpuTerminal.binding,
    successorContract.binding,
    reportBinding,
    ...programBindings,
  ],
};
const lifecycleRoot = inside(`.runtime/ai-painter/capability-lifecycle/${STAGE4_V2_CAPABILITY}`);
if (!fs.existsSync(lifecycleRoot)) {
  createCapabilityCandidate(candidateSpec, { root: ROOT, recordedAtUtc });
}
let lifecycleState = JSON.parse(fs.readFileSync(path.join(lifecycleRoot, "state.json"), "utf8"));
assert.equal(lifecycleState.capabilityVersion, STAGE4_V2_CAPABILITY);
if (lifecycleState.state === "change_candidate") {
  advanceCapabilityLifecycle({
    root: ROOT,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    targetState: "isolated_implementation",
    evidence: stageEvidence("isolated_implementation", [
      predecessorFailure.binding,
      predecessorClosedLoop.binding,
      successorContract.binding,
      ...programBindings,
    ]),
    recordedAtUtc,
  });
  lifecycleState = JSON.parse(fs.readFileSync(path.join(lifecycleRoot, "state.json"), "utf8"));
}
if (lifecycleState.state === "isolated_implementation") {
  advanceCapabilityLifecycle({
    root: ROOT,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    targetState: "cpu_contract_verified",
    evidence: stageEvidence("cpu_contract_verified", [
      reportBinding,
      terminalBinding,
      predecessorCpuTerminal.binding,
      successorContract.binding,
    ]),
    recordedAtUtc,
  });
  lifecycleState = JSON.parse(fs.readFileSync(path.join(lifecycleRoot, "state.json"), "utf8"));
}
assert.equal(lifecycleState.state, "cpu_contract_verified",
  "program successor lifecycle is not CPU verified");

const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${runId}`,
  generatedFrom: "verified_rejected_program_successor",
  readOnly: true,
  module: { id: "ai-painter-stage4", nameZh: "AI Painter Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: {
    number: 4,
    total: 5,
    labelZh: "V2只读GPU资格",
    status: "cpu_contract_verified",
  },
  taskIdentity: { modelId: STAGE4_V2_CAPABILITY, runId },
  latestTerminal: terminalBinding,
  latestBlocker: null,
  nextAllowedAction: NEXT_ACTION,
  forbiddenActions: [
    "reuse_rejected_capability_identity",
    "reuse_predecessor_gpu_qualification",
    "start_training_before_fresh_gpu_qualification",
  ],
  evidence: [
    predecessorFailure.binding,
    predecessorClosedLoop.binding,
    predecessorCpuTerminal.binding,
    successorContract.binding,
    reportBinding,
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
const capsulePath = path.join(outputDirectory, "task-capsule-recovered.json");
writeOrVerifyJson(capsulePath, capsule);
const capsuleBinding = bind(projectPath(capsulePath));

const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  packageId: runId,
  taskId: NEXT_TASK,
  taskKind: "cpu_readonly_gpu_qualification_planning",
  taskGoal: "Freshly qualify the corrected train/validation-isolated Stage4 V2 program lineage before controlled training.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: NEXT_ACTION,
  queuedAtUtc: recordedAtUtc,
  runId,
  lifecycleStage: "cpu_contract_verified",
  executionState: "package_materialized",
  activity: "stage4_v2_program_successor_cpu_verified",
  taskCapsulePath: capsuleBinding.path,
  terminalEvidencePath: terminalBinding.path,
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
});

process.stdout.write(`${JSON.stringify({
  status: terminal.status,
  architectureId: STAGE4_V2_ARCHITECTURE,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  predecessorPreserved: true,
  cpuVerification: reportBinding,
  terminal: terminalBinding,
  registryRevision: advanced.registry.registryRevision,
  nextMachineAction: advanced.registry.nextMachineAction,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

function stageEvidence(targetState, bindings) {
  return {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    targetState,
    status: "passed",
    bindings,
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  };
}

function runCommand({ id, command, args }) {
  const startedAtUtc = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CUDA_VISIBLE_DEVICES: "-1", AI_PAINTER_CPU_ONLY: "1" },
  });
  return {
    id,
    command: [command, ...args],
    exitCode: result.status,
    signal: result.signal ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    startedAtUtc,
    completedAtUtc: new Date().toISOString(),
  };
}

function pythonExecutable() {
  const candidate = process.platform === "win32"
    ? inside("ml/ai-painter/.venv/Scripts/python.exe")
    : inside("ml/ai-painter/.venv/bin/python");
  assert.equal(fs.existsSync(candidate), true, "AI Painter Python environment is missing");
  return candidate;
}

function readJsonFile(logicalPath, role) {
  const binding = bind(logicalPath);
  return { value: JSON.parse(fs.readFileSync(inside(logicalPath), "utf8")), binding, role };
}

function readBinding(declared, role) {
  assert.match(declared?.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`);
  const actual = bind(declared.path);
  assert.equal(actual.sha256, declared.sha256, `${role} SHA-256 mismatch`);
  return { value: JSON.parse(fs.readFileSync(inside(actual.path), "utf8")), binding: actual };
}

function bind(logicalPath) {
  const absolute = inside(logicalPath);
  assert.equal(fs.statSync(absolute).isFile(), true, `not a file: ${logicalPath}`);
  return {
    path: projectPath(absolute),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex"),
    byteSize: fs.statSync(absolute).size,
  };
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

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJsonExclusive(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

function writeOrVerifyJson(target, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(target)) {
    assert.equal(fs.readFileSync(target, "utf8"), bytes,
      `immutable program successor evidence differs: ${target}`);
    return;
  }
  fs.writeFileSync(target, bytes, { encoding: "utf8", flag: "wx" });
}
