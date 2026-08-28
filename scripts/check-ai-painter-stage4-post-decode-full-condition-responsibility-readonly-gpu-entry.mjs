import assert from "node:assert/strict";
import {
  ARCHITECTURE_ID,
  buildInternalReadonlyGpuTicket,
  validateReadonlyGpuQualificationInputs,
} from "./lib/ai-painter-stage4-post-decode-full-condition-responsibility-readonly-gpu-v1.mjs";
import { readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const current = await readCurrentExecutionRegistry(root);
assert.equal(current.ok, true, current.errorCode);
const terminalPath = absolute(current.registry.terminalEvidence.path);
const cpuTerminal = readJson(terminalPath);
const inactiveConfigPath = absolute(cpuTerminal.inactiveConfig.path);
const cpuReportPath = absolute(cpuTerminal.cpuReport.path);
const supportContractPath = absolute(cpuTerminal.supportContract.path);
const inactiveConfig = readJson(inactiveConfigPath);
const cpuReport = readJson(cpuReportPath);
const supportContract = readJson(supportContractPath);
const hashes = {
  cpuTerminal: sha(terminalPath),
  inactiveConfig: sha(inactiveConfigPath),
  cpuReport: sha(cpuReportPath),
  supportContract: sha(supportContractPath),
};
const input = {
  registry: current.registry,
  cpuTerminal,
  inactiveConfig,
  cpuReport,
  supportContract,
  hashes,
};
assert.equal(validateReadonlyGpuQualificationInputs(input), true);

const positive = {
  currentRegistryVerified: current.status === "verified",
  exactArchitecture: inactiveConfig.denoiserArchitecture === ARCHITECTURE_ID,
  immutableBindingsVerified: true,
  internalTicketValid: buildInternalReadonlyGpuTicket({
    capabilityVersion: current.registry.capabilityVersion,
    runId: "stage4-full-condition-responsibility-gpu-fixture",
    lifecycleStateSha256: "a".repeat(64),
    issuedAtUtc: new Date().toISOString(),
  }).ownerAuthorizationRequired === false,
};

function rejects(mutator) {
  const candidate = structuredClone(input);
  mutator(candidate);
  try {
    validateReadonlyGpuQualificationInputs(candidate);
    return false;
  } catch {
    return true;
  }
}

const negative = {
  oldTaskRejected: rejects((value) => { value.registry.taskId = "old_task"; }),
  activeExecutionRejected: rejects((value) => { value.registry.activeExecution = {}; }),
  wrongLifecycleRejected: rejects((value) => { value.registry.lifecycleStage = "change_candidate"; }),
  terminalHashMismatchRejected: rejects((value) => { value.hashes.cpuTerminal = "0".repeat(64); }),
  configHashMismatchRejected: rejects((value) => { value.hashes.inactiveConfig = "0".repeat(64); }),
  activeGateRejected: rejects((value) => { value.inactiveConfig.activationGates.gpuNow = true; }),
  responsibilityMissingRejected: rejects((value) => { value.inactiveConfig.postDecodeResponsibilityIdentityOrder.pop(); }),
  freeWidthRejected: rejects((value) => { value.inactiveConfig.postDecodeResponsibilityBranchWidth = 128; }),
  failedCpuReportRejected: rejects((value) => { value.cpuReport.status = "failed"; }),
  supportArchitectureMismatchRejected: rejects((value) => { value.supportContract.architectureId = "old"; }),
};
const passed = Object.values(positive).every(Boolean) && Object.values(negative).every(Boolean);
process.stdout.write(`${JSON.stringify({
  schemaVersion: "stage4-post-decode-full-condition-responsibility-readonly-gpu-entry-cpu-report-v1",
  status: passed ? "passed" : "failed",
  positive,
  negative,
  positivePassed: Object.values(positive).filter(Boolean).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter(Boolean).length,
  negativeTotal: Object.keys(negative).length,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);
if (!passed) process.exitCode = 1;

function absolute(relativePath) {
  const value = path.resolve(root, relativePath);
  assert.ok(value.startsWith(`${path.resolve(root)}${path.sep}`));
  return value;
}
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function sha(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }
