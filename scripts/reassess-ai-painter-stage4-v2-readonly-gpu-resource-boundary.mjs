import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import { runResourcePreflight } from "./run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
import {
  STAGE4_V2_CAPABILITY,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const ROOT = process.cwd();
const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
assert.equal(current.registry.taskId,
  "stage4_v2_readonly_gpu_qualification_failure_adjudicated");
assert.equal(current.registry.executionState, "completed");
assert.equal(current.registry.lifecycleStage, "cpu_contract_verified");
assert.equal(current.registry.activeExecution, null);
const adjudication = readBinding(current.registry.terminalEvidence,
  "resource adjudication terminal");
assert.equal(adjudication.value.classification, "resource_boundary_failure");
assert.equal(adjudication.value.nextBoundaryAction,
  "reassess_readonly_gpu_resource_boundary");
const failedQualification = readBinding(adjudication.value.sourceTerminal,
  "failed qualification terminal");
const packageRoot = `.runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/${failedQualification.value.packageId}`;
const packagePayload = readJsonFile(`${packageRoot}/package-payload.json`);
const parentRegistry = readBinding(packagePayload.value.parentRegistry.binding,
  "qualification parent registry");
const cpuTerminal = readBinding(parentRegistry.value.terminalEvidence,
  "CPU verified terminal");
assert.equal(cpuTerminal.value.status,
  "stage4_v2_cpu_contract_acceptance_passed_inactive");

let preflight;
try {
  preflight = runResourcePreflight({ root: ROOT });
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    status: "resource_boundary_still_blocked",
    registryRevision: current.registry.registryRevision,
    registryMutated: false,
    gpuStarted: false,
    trainingStarted: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2)}\n`);
  process.exitCode = 2;
  process.exit();
}

const digest = sha256Text(`${adjudication.binding.sha256}:${JSON.stringify(preflight)}`);
const runId = `stage4-v2-gpu-resource-reassessment-${digest.slice(0, 24)}`;
const outputDirectory = inside(`.runtime/ai-painter/stage4-v2-readonly-gpu-resource-reassessments/${runId}`);
fs.mkdirSync(outputDirectory, { recursive: true });
assert.deepEqual(fs.readdirSync(outputDirectory), [], "resource reassessment output exists");
const recordedAtUtc = new Date().toISOString();
const report = {
  schemaVersion: "ai-painter-stage4-v2-readonly-gpu-resource-reassessment-v1",
  status: "passed",
  runId,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  sourceAdjudication: adjudication.binding,
  sourceFailedQualification: failedQualification.binding,
  cpuVerifiedTerminal: cpuTerminal.binding,
  resourcePreflight: preflight,
  oldTicketReused: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc,
};
const reportBinding = write("resource-reassessment.json", report);
const terminal = {
  ...cpuTerminal.value,
  runId,
  capabilityVersion: STAGE4_V2_CAPABILITY,
  resourceReassessment: reportBinding,
  priorCpuTerminal: cpuTerminal.binding,
  recordedAtUtc,
};
const terminalBinding = write("phase-terminal.json", terminal);
const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${runId}`,
  generatedFrom: "verified_gpu_resource_reassessment",
  readOnly: true,
  module: { id: "ai-painter-stage4", nameZh: "AI Painter Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: { number: 4, total: 5, status: "gpu_resource_reassessed_ready" },
  taskIdentity: { modelId: STAGE4_V2_CAPABILITY, runId },
  latestTerminal: terminalBinding,
  nextAllowedAction: "plan:ai-painter-stage4-v2-readonly-gpu-qualification",
  forbiddenActions: ["reuse_failed_ticket", "start_training_before_gpu_qualification"],
  evidence: [adjudication.binding, failedQualification.binding,
    cpuTerminal.binding, reportBinding, terminalBinding]
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
  taskGoal: "Issue a fresh readonly-GPU qualification after the resource boundary is independently clear.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: "plan:ai-painter-stage4-v2-readonly-gpu-qualification",
  queuedAtUtc: recordedAtUtc,
  runId,
  lifecycleStage: "cpu_contract_verified",
  executionState: "package_materialized",
  activity: "readonly_gpu_resource_reassessment_passed",
  taskCapsulePath: capsuleBinding.path,
  terminalEvidencePath: terminalBinding.path,
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
});
process.stdout.write(`${JSON.stringify({
  status: report.status,
  report: reportBinding,
  terminal: terminalBinding,
  registryRevision: advanced.registry.registryRevision,
  nextMachineAction: advanced.registry.nextMachineAction,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

function readJsonFile(logicalPath) {
  const binding = bind(logicalPath);
  return { value: JSON.parse(fs.readFileSync(inside(binding.path), "utf8")), binding };
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
