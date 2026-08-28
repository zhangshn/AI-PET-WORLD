import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

export const READONLY_GPU_TASK_ID =
  "execute_readonly_gpu_qualification_for_post_decode_full_condition_responsibility_renderer";
export const ARCHITECTURE_ID =
  "stage4_post_decode_full_condition_route_object_responsibility_renderer_v1";
export const CPU_TERMINAL_STATUS =
  "cpu_contract_verified_waiting_local_readonly_gpu_qualification";
export const RESPONSIBILITY_ORDER = Object.freeze([
  "terrain_path_ground",
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
]);

export function validateReadonlyGpuQualificationInputs({
  registry,
  cpuTerminal,
  inactiveConfig,
  cpuReport,
  supportContract,
  hashes,
}) {
  assert.equal(registry.taskId, READONLY_GPU_TASK_ID, "current task mismatch");
  assert.equal(registry.taskKind, "readonly_gpu_qualification");
  assert.equal(registry.lifecycleStage, "cpu_contract_verified");
  assert.equal(registry.executionState, "package_materialized");
  assert.equal(registry.activity, "planned_not_started");
  assert.equal(registry.activeExecution, null);
  assert.equal(cpuTerminal.executionState, "completed");
  assert.equal(cpuTerminal.status, CPU_TERMINAL_STATUS);
  assert.equal(cpuTerminal.capabilityVersion, registry.capabilityVersion);
  assert.equal(registry.terminalEvidence.sha256, hashes.cpuTerminal);
  assert.equal(cpuTerminal.inactiveConfig.sha256, hashes.inactiveConfig);
  assert.equal(cpuTerminal.cpuReport.sha256, hashes.cpuReport);
  assert.equal(cpuTerminal.supportContract.sha256, hashes.supportContract);
  assert.equal(inactiveConfig.status, "cpu_supported_inactive");
  assert.equal(inactiveConfig.denoiserArchitecture, ARCHITECTURE_ID);
  assert.deepEqual(
    inactiveConfig.postDecodeResponsibilityIdentityOrder,
    RESPONSIBILITY_ORDER,
  );
  assert.equal(inactiveConfig.postDecodeResponsibilityInputChannels, 26);
  assert.equal(inactiveConfig.postDecodeResponsibilityBranchWidth, 64);
  assert.equal(inactiveConfig.postDecodeResponsibilityOutputChannels, 3);
  assert.equal(
    inactiveConfig.postDecodeResponsibilityMerge,
    "authoritative_mask_normalized_full_condition_responsibility_rgb_v1",
  );
  assert.ok(
    Object.values(inactiveConfig.activationGates).every((value) => value === false),
    "inactive activation gate changed",
  );
  assert.equal(cpuReport.status, "passed");
  assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal);
  assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal);
  assert.equal(cpuReport.gpuStarted, false);
  assert.equal(cpuReport.trainingStarted, false);
  assert.equal(supportContract.status, "cpu_supported_inactive");
  assert.equal(supportContract.architectureId, ARCHITECTURE_ID);
  assert.deepEqual(supportContract.responsibilityOrder, RESPONSIBILITY_ORDER);
  assert.equal(supportContract.activationState, "inactive");
  return true;
}

export function buildInternalReadonlyGpuTicket({
  capabilityVersion,
  runId,
  lifecycleStateSha256,
  issuedAtUtc,
}) {
  assert.match(capabilityVersion, /^[a-z0-9][a-z0-9-]{7,127}$/u);
  assert.match(runId, /^[a-z0-9][a-z0-9-]{7,127}$/u);
  assert.match(lifecycleStateSha256, /^[a-f0-9]{64}$/u);
  return {
    schemaVersion: "ai-painter-local-internal-capability-ticket-v1",
    status: "issued_not_consumed",
    ticketId: `local-ai-${capabilityVersion}-${runId}`,
    capabilityVersion,
    action: "readonly_gpu_qualification",
    parentLifecycleState: "cpu_contract_verified",
    parentLifecycleStateSha256: lifecycleStateSha256,
    oneTimeOnly: true,
    cannotExpandParentContract: true,
    ownerAuthorizationRequired: false,
    issuedAtUtc,
  };
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
