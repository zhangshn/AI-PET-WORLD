import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  bindAbsolute,
  readJsonObject,
  resolveProjectPath,
  writeExclusiveJson,
} from "./ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";

const SHA256 = /^[a-f0-9]{64}$/u;

/**
 * Persist an immutable publication receipt for a capability lifecycle
 * transition. state.json is deliberately treated as a mutable observation;
 * downstream registry dependencies bind the receipt and immutable lifecycle
 * evidence (and, for terminal states, phase-terminal.json) instead.
 */
export function persistStage4V2LifecyclePublication({
  projectRoot = process.cwd(),
  capabilityVersion,
  expectedState,
  expectedEvidenceStatus,
  sourceTerminalBinding,
  lifecycleResult,
  receiptPath,
  requireLifecycleTerminal = false,
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9_-]{7,191}$/u,
    "lifecycle publication capabilityVersion is invalid");
  assert.match(expectedState ?? "", /^[a-z][a-z0-9_]{2,127}$/u,
    "lifecycle publication expectedState is invalid");
  assert.ok(["passed", "failed"].includes(expectedEvidenceStatus),
    "lifecycle publication evidence status is invalid");
  validateBinding(sourceTerminalBinding, "lifecycle publication source terminal");
  const absoluteReceipt = resolveInside(root, receiptPath,
    "lifecycle publication receipt path");

  const lifecycleRoot = resolveProjectPath(root,
    `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`,
    { mustExist: true, kind: "directory" });
  const statePath = resolveInside(lifecycleRoot, "state.json",
    "capability lifecycle state path");
  assert.equal(fs.existsSync(statePath), true,
    "capability lifecycle state is missing");
  const state = readJsonObject(statePath);
  assert.deepEqual(state, lifecycleResult,
    "returned lifecycle result differs from the canonical state file");
  assert.equal(state.capabilityVersion, capabilityVersion,
    "capability lifecycle state identity mismatch");
  assert.equal(state.state, expectedState,
    "capability lifecycle publication state mismatch");
  assert.equal(state.ownerResponseRequired, false,
    "capability lifecycle publication unexpectedly requires Owner");
  validateRelativeEvidencePath(state.latestEvidence?.path);
  assert.match(state.latestEvidence?.sha256 ?? "", SHA256,
    "capability lifecycle latest evidence SHA-256 is invalid");

  const evidencePath = resolveInside(lifecycleRoot, state.latestEvidence.path,
    "capability lifecycle evidence path");
  assert.equal(fs.existsSync(evidencePath), true,
    "capability lifecycle evidence is missing");
  const evidenceBinding = bindAbsolute(root, evidencePath);
  assert.equal(evidenceBinding.sha256, state.latestEvidence.sha256,
    "capability lifecycle evidence SHA-256 differs from state.json");
  const evidence = readJsonObject(evidencePath);
  assert.equal(evidence.schemaVersion, "ai-painter-capability-stage-evidence-v1",
    "capability lifecycle evidence schema mismatch");
  assert.equal(evidence.capabilityVersion, capabilityVersion,
    "capability lifecycle evidence capability mismatch");
  assert.equal(evidence.targetState, expectedState,
    "capability lifecycle evidence target mismatch");
  assert.equal(evidence.status, expectedEvidenceStatus,
    "capability lifecycle evidence result mismatch");
  assert.deepEqual(evidence.bindings, [sourceTerminalBinding],
    "capability lifecycle evidence must bind the exact source terminal only");

  const lifecycleStateObservation = bindAbsolute(root, statePath);
  let lifecycleTerminalBinding = null;
  if (requireLifecycleTerminal) {
    const lifecycleTerminalPath = resolveInside(lifecycleRoot, "phase-terminal.json",
      "capability lifecycle terminal path");
    assert.equal(fs.existsSync(lifecycleTerminalPath), true,
      "terminal capability lifecycle record is missing");
    const lifecycleTerminal = readJsonObject(lifecycleTerminalPath);
    assert.deepEqual(lifecycleTerminal, state,
      "capability lifecycle terminal differs from canonical state");
    lifecycleTerminalBinding = bindAbsolute(root, lifecycleTerminalPath);
  }

  const receipt = {
    schemaVersion: "ai-painter-stage4-v2-lifecycle-publication-receipt-v1",
    status: "canonical_lifecycle_publication_verified",
    capabilityVersion,
    lifecycleState: expectedState,
    lifecycleSequence: state.sequence,
    sourceTerminal: sourceTerminalBinding,
    lifecycleEvidence: evidenceBinding,
    lifecycleStateSnapshot: state,
    observedMutableStateFile: lifecycleStateObservation,
    immutableLifecycleTerminal: lifecycleTerminalBinding,
    ownerAuthorizationRequired: false,
    recordedAtUtc: state.updatedAtUtc,
  };
  writeExclusiveOrVerify(absoluteReceipt, receipt);
  const receiptBinding = bindAbsolute(root, absoluteReceipt);
  invokeHook(_testHooks, "afterLifecyclePublicationReceiptPersisted", {
    receipt: receiptBinding,
    lifecycleEvidence: evidenceBinding,
    immutableLifecycleTerminal: lifecycleTerminalBinding,
  });
  return Object.freeze({
    receipt: Object.freeze(receipt),
    receiptBinding,
    evidenceBinding,
    lifecycleTerminalBinding,
  });
}

function validateBinding(binding, label) {
  assert.ok(binding && typeof binding.path === "string" && binding.path.length > 0,
    `${label} path is invalid`);
  assert.match(binding.sha256 ?? "", SHA256, `${label} SHA-256 is invalid`);
  assert.ok(Number.isInteger(binding.byteSize) && binding.byteSize >= 0,
    `${label} byteSize is invalid`);
}

function validateRelativeEvidencePath(value) {
  assert.ok(typeof value === "string" && value.startsWith("evidence/")
    && !value.includes("\\") && !value.includes("..") && !path.isAbsolute(value),
  "capability lifecycle latest evidence path is unsafe");
}

function resolveInside(root, value, label) {
  assert.ok(typeof value === "string" && value.length > 0, `${label} is missing`);
  const absolute = path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
  const relative = path.relative(root, absolute);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    `${label} escapes its fixed parent`);
  return absolute;
}

function writeExclusiveOrVerify(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) {
    try {
      writeExclusiveJson(target, value);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(readJsonObject(target), value,
    "immutable lifecycle publication receipt conflicts");
}

function invokeHook(hooks, name, value) {
  if (typeof hooks?.[name] === "function") hooks[name](value);
}
