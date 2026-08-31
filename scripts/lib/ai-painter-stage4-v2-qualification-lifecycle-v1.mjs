import assert from "node:assert/strict";

import {
  advanceCapabilityLifecycle,
  CAPABILITY_LIFECYCLE_ROOT,
} from "./ai-painter-capability-lifecycle-v1.mjs";
import {
  STAGE4_V2_CAPABILITY,
  bindProjectFile,
  readJsonObject,
  resolveProjectPath,
} from "./ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

export const STAGE4_V2_LIFECYCLE_STATE_PATH =
  `${CAPABILITY_LIFECYCLE_ROOT}/${STAGE4_V2_CAPABILITY}/state.json`;

export function reconcileStage4V2ReadonlyGpuQualifiedLifecycle({
  projectRoot = process.cwd(),
  qualificationTerminalBinding,
  recordedAtUtc = new Date().toISOString(),
  lifecycleAdvancer = advanceCapabilityLifecycle,
} = {}) {
  assertQualificationTerminalBinding(projectRoot, qualificationTerminalBinding);
  const statePath = resolveProjectPath(projectRoot, STAGE4_V2_LIFECYCLE_STATE_PATH, {
    mustExist: true,
    kind: "file",
  });
  const before = readJsonObject(statePath);
  if (before.state === "cpu_contract_verified") {
    lifecycleAdvancer({
      root: projectRoot,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      targetState: "readonly_gpu_qualified",
      evidence: {
        schemaVersion: "ai-painter-capability-stage-evidence-v1",
        capabilityVersion: STAGE4_V2_CAPABILITY,
        targetState: "readonly_gpu_qualified",
        status: "passed",
        bindings: [qualificationTerminalBinding],
      },
      recordedAtUtc,
    });
  } else {
    assert.equal(
      before.state,
      "readonly_gpu_qualified",
      `Stage4 V2 lifecycle conflict before qualification publication: ${before.state}`,
    );
  }
  return verifyStage4V2ReadonlyGpuQualifiedLifecycle({
    projectRoot,
    qualificationTerminalBinding,
  });
}

export function verifyStage4V2ReadonlyGpuQualifiedLifecycle({
  projectRoot = process.cwd(),
  qualificationTerminalBinding,
} = {}) {
  assertQualificationTerminalBinding(projectRoot, qualificationTerminalBinding);
  const statePath = resolveProjectPath(projectRoot, STAGE4_V2_LIFECYCLE_STATE_PATH, {
    mustExist: true,
    kind: "file",
  });
  const state = readJsonObject(statePath);
  assert.equal(state.schemaVersion, "ai-painter-capability-lifecycle-state-v1");
  assert.equal(state.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(state.state, "readonly_gpu_qualified",
    "canonical Stage4 V2 lifecycle is not readonly-GPU qualified");
  assert.ok(Number.isInteger(state.sequence) && state.sequence > 0,
    "canonical Stage4 V2 lifecycle sequence is invalid");
  assert.equal(state.ownerAuthorizationRequired, false);
  assert.equal(state.ownerResponseRequired, false);
  assert.ok(state.latestEvidence && typeof state.latestEvidence.path === "string",
    "canonical Stage4 V2 lifecycle evidence is missing");
  assert.equal(
    state.latestEvidence.path,
    `evidence/${String(state.sequence).padStart(3, "0")}-readonly_gpu_qualified.json`,
    "canonical Stage4 V2 lifecycle evidence path is not the deterministic transition path",
  );
  assert.match(state.latestEvidence.sha256 ?? "", /^[a-f0-9]{64}$/u,
    "canonical Stage4 V2 lifecycle evidence SHA-256 is invalid");
  const evidencePath = `${CAPABILITY_LIFECYCLE_ROOT}/${STAGE4_V2_CAPABILITY}/${state.latestEvidence.path}`;
  const evidenceBinding = bindProjectFile(projectRoot, evidencePath, state.latestEvidence.sha256);
  const evidence = readJsonObject(resolveProjectPath(projectRoot, evidenceBinding.path, {
    mustExist: true,
    kind: "file",
  }));
  assert.equal(evidence.schemaVersion, "ai-painter-capability-stage-evidence-v1");
  assert.equal(evidence.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(evidence.targetState, "readonly_gpu_qualified");
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.ownerAuthorizationRequired, false);
  assert.equal(evidence.ownerResponseRequired, false);
  const matches = (evidence.bindings ?? []).filter((binding) => (
    binding?.path === qualificationTerminalBinding.path
      && binding?.sha256 === qualificationTerminalBinding.sha256
  ));
  assert.equal(matches.length, 1,
    "canonical readonly-GPU lifecycle evidence does not uniquely bind this qualification terminal");
  return Object.freeze({
    state,
    stateBinding: bindProjectFile(projectRoot, STAGE4_V2_LIFECYCLE_STATE_PATH),
    evidence,
    evidenceBinding,
  });
}

function assertQualificationTerminalBinding(projectRoot, binding) {
  assert.ok(binding && typeof binding === "object", "qualification terminal binding is missing");
  const rebound = bindProjectFile(projectRoot, binding.path, binding.sha256);
  const terminal = readJsonObject(resolveProjectPath(projectRoot, rebound.path, {
    mustExist: true,
    kind: "file",
  }));
  assert.equal(terminal.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-terminal-v1");
  assert.equal(terminal.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(terminal.executionState, "completed");
  assert.equal(terminal.status, "stage4_v2_readonly_gpu_qualification_passed");
  assert.equal(terminal.ownerAuthorizationRequired, false);
}
