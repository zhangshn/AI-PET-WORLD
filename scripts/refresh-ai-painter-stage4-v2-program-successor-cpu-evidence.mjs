import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import {
  STAGE4_V2_ARCHITECTURE,
  STAGE4_V2_CAPABILITY,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const ROOT = process.cwd();
const PROGRAM_PATHS = Object.freeze([
  "scripts/lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs",
  "scripts/plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
  "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
  "scripts/lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs",
  "scripts/lib/ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs",
  "scripts/lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs",
  "scripts/plan-ai-painter-stage4-v2-controlled-smoke.mjs",
  "ml/ai-painter/scripts/run_stage4_semantic_transport_v2_controlled_smoke.py",
  "ml/ai-painter/scripts/stage4_semantic_transport_v2_controlled_smoke_training.py",
]);

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
assert.equal(current.registry.taskId, "plan_stage4_v2_readonly_gpu_qualification");
assert.equal(current.registry.nextMachineAction,
  "plan:ai-painter-stage4-v2-readonly-gpu-qualification");
assert.equal(current.registry.activeExecution, null);
const priorTerminal = readBinding(current.registry.terminalEvidence, "prior CPU terminal");
assert.equal(priorTerminal.value.status,
  "stage4_v2_cpu_contract_acceptance_passed_inactive");
const predecessorFailure = readBinding(priorTerminal.value.predecessorFailure,
  "predecessor failure");
const successorContract = readBinding(priorTerminal.value.successorContract,
  "architecture contract");
assert.equal(successorContract.value.architectureId, STAGE4_V2_ARCHITECTURE);
const programBindings = PROGRAM_PATHS.map(bind);
const digest = sha256Text([
  priorTerminal.binding.sha256,
  ...programBindings.map((item) => `${item.path}:${item.sha256}`),
].join("\n"));
const runId = `stage4-v2-program-successor-refresh-${digest.slice(0, 24)}`;
const outputDirectory = inside(`.runtime/ai-painter/stage4-v2-program-successor-refreshes/${runId}`);
fs.mkdirSync(outputDirectory, { recursive: true });
assert.deepEqual(fs.readdirSync(outputDirectory), [], "refresh output already exists");
const recordedAtUtc = new Date().toISOString();
const checks = [
  ...PROGRAM_PATHS.filter((item) => item.endsWith(".mjs")).map((logicalPath) => run({
    id: `syntax_${path.basename(logicalPath).replaceAll(/[^a-zA-Z0-9]+/gu, "_")}`,
    command: process.execPath,
    args: ["--check", logicalPath],
  })),
  run({
    id: "split_policy_node",
    command: process.execPath,
    args: ["--test", "scripts/tests/test-ai-painter-stage4-smoke-split-policy.mjs"],
  }),
  run({
    id: "split_policy_python",
    command: python(),
    args: ["ml/ai-painter/tests/test_stage4_smoke_split_policy.py"],
  }),
];
assert.equal(checks.every((item) => item.exitCode === 0), true,
  checks.filter((item) => item.exitCode !== 0)
    .map((item) => `${item.id}: ${item.stderr || item.stdout}`).join("\n"));
const report = {
  schemaVersion: "ai-painter-stage4-v2-program-successor-cpu-refresh-v1",
  status: "passed",
  runId,
  architectureId: STAGE4_V2_ARCHITECTURE,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  priorCpuTerminal: priorTerminal.binding,
  predecessorFailure: predecessorFailure.binding,
  successorContract: successorContract.binding,
  programBindings,
  checks,
  dataVersionChanged: false,
  modelArchitectureChanged: false,
  thresholdChanged: false,
  splitChanged: false,
  gpuStarted: false,
  trainingStarted: false,
  completedAtUtc: recordedAtUtc,
};
const reportBinding = write("cpu-verification-refresh.json", report);
const terminal = {
  ...priorTerminal.value,
  runId,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  cpuAcceptanceReport: reportBinding,
  priorCpuTerminal: priorTerminal.binding,
  recordedAtUtc,
};
const terminalBinding = write("phase-terminal.json", terminal);
advanceCapabilityLifecycle({
  root: ROOT,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  targetState: "cpu_contract_verified",
  evidence: {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    targetState: "cpu_contract_verified",
    status: "passed",
    bindings: [reportBinding, terminalBinding, successorContract.binding],
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  },
  recordedAtUtc,
  allowSameStateEvidenceRefresh: true,
});
const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${runId}`,
  generatedFrom: "cpu_verified_program_lineage_refresh",
  readOnly: true,
  module: { id: "ai-painter-stage4", nameZh: "AI Painter Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: { number: 4, total: 5, status: "cpu_contract_verified" },
  taskIdentity: { modelId: STAGE4_V2_CAPABILITY, runId },
  latestTerminal: terminalBinding,
  nextAllowedAction: "plan:ai-painter-stage4-v2-readonly-gpu-qualification",
  evidence: [priorTerminal.binding, predecessorFailure.binding,
    successorContract.binding, reportBinding, terminalBinding]
    .map((item) => ({ ...item, sha256Verified: true })),
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
  },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
};
const capsuleBinding = write("task-capsule.json", capsule);
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  packageId: runId,
  taskId: "plan_stage4_v2_readonly_gpu_qualification",
  taskKind: "cpu_readonly_gpu_qualification_planning",
  taskGoal: "Materialize a fresh readonly-GPU qualification for the fully bound corrected Stage4 V2 program lineage.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: "plan:ai-painter-stage4-v2-readonly-gpu-qualification",
  queuedAtUtc: recordedAtUtc,
  runId,
  lifecycleStage: "cpu_contract_verified",
  executionState: "package_materialized",
  activity: "stage4_v2_program_successor_cpu_evidence_refreshed",
  taskCapsulePath: capsuleBinding.path,
  terminalEvidencePath: terminalBinding.path,
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
});
process.stdout.write(`${JSON.stringify({
  status: terminal.status,
  runId,
  report: reportBinding,
  terminal: terminalBinding,
  registryRevision: advanced.registry.registryRevision,
  nextMachineAction: advanced.registry.nextMachineAction,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

function run({ id, command, args }) {
  const result = spawnSync(command, args, {
    cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CUDA_VISIBLE_DEVICES: "-1", AI_PAINTER_CPU_ONLY: "1" },
  });
  return { id, command: [command, ...args], exitCode: result.status,
    stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}
function python() {
  const value = inside(process.platform === "win32"
    ? "ml/ai-painter/.venv/Scripts/python.exe" : "ml/ai-painter/.venv/bin/python");
  assert.equal(fs.existsSync(value), true, "Python environment missing");
  return value;
}
function readBinding(declared, role) {
  assert.match(declared?.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA invalid`);
  const actual = bind(declared.path);
  assert.equal(actual.sha256, declared.sha256, `${role} SHA mismatch`);
  return { value: JSON.parse(fs.readFileSync(inside(actual.path), "utf8")), binding: actual };
}
function bind(logicalPath) {
  const absolute = inside(logicalPath);
  return { path: projectPath(absolute),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex"),
    byteSize: fs.statSync(absolute).size };
}
function write(name, value) {
  const absolute = path.join(outputDirectory, name);
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return bind(projectPath(absolute));
}
function inside(value) {
  const absolute = path.resolve(ROOT, value);
  assert.ok(absolute === ROOT || absolute.startsWith(`${ROOT}${path.sep}`), "path escapes project");
  return absolute;
}
function projectPath(value) { return path.relative(ROOT, inside(value)).replaceAll("\\", "/"); }
function sha256Text(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
