import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  bindProjectFile,
  projectLogicalPath,
  readJsonObject,
  resolveProjectPath,
  sha256File,
  writeExclusiveJson,
} from "./ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

export const STAGE4_V2_CAPABILITY =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
export const SMOKE_PACKAGE_ROOT =
  ".runtime/ai-painter/autonomous-closed-loop-packages";
export const SMOKE_OUTPUT_ROOT =
  ".runtime/ai-painter/stage4-v2-controlled-smoke-executions";
export const FIXED_SAMPLE_ID =
  "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6";
export const FIXED_SEED = 20263722;
export const FIXED_RESOLUTION = Object.freeze({ width: 256, height: 192 });
export const FIXED_PREVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30]);
export const FIXED_EPOCH_COUNT = 30;
export const SMOKE_PLAN_ACTION = "plan:ai-painter-stage4-v2-controlled-smoke";
export const SMOKE_RUN_ACTION = "run:ai-painter-stage4-v2-controlled-smoke";
export const SMOKE_BACKGROUND_LAUNCH_ACTION =
  "launch:ai-painter-stage4-v2-controlled-smoke-background";
export const SMOKE_RUN_TASK = "execute_stage4_v2_controlled_smoke";

const SHA256 = /^[a-f0-9]{64}$/u;

export function buildDerivedConfigContract({ packageId, runId, datasetPackageId, outputDirectory }) {
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-derived-config-contract-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    modeId: "stage4_semantic_transport_v2_controlled_smoke",
    packageId,
    runId,
    datasetPackageId,
    sampleId: FIXED_SAMPLE_ID,
    sampleSplit: "validation",
    seed: FIXED_SEED,
    resolution: FIXED_RESOLUTION,
    epochCount: FIXED_EPOCH_COUNT,
    previewEpochs: FIXED_PREVIEW_EPOCHS,
    outputDirectory,
    historicalDenoiserCheckpointAllowed: false,
    outputReuseAllowed: false,
    ownerAuthorizationRequired: false,
  });
}

export function buildDerivedTrainerExecution(values) {
  const contract = buildDerivedConfigContract(values);
  return Object.freeze({
    ticketId: `stage4-v2-smoke-trainer-${sha256Of({
      packageId: values.packageId,
      runId: values.runId,
      outputDirectory: values.outputDirectory,
    }).slice(0, 24)}`,
    configContractSha256: sha256Of(contract),
    outputDirectory: values.outputDirectory,
    oneTimeConsumptionInheritedFromParent: true,
    independentAuthorizationAuthority: false,
  });
}

export function validateStage4V2SmokePackagePayload(payload, { projectRoot, verifyEvidence = true } = {}) {
  assert.equal(payload?.schemaVersion, "ai-painter-stage4-v2-controlled-smoke-package-payload-v1");
  assert.equal(payload.status, "materialized_not_executed");
  assert.equal(payload.architectureId, STAGE4_V2_CAPABILITY);
  assert.equal(payload.capabilityVersion, STAGE4_V2_CAPABILITY);
  requireId(payload.packageId, "packageId");
  requireId(payload.runId, "runId");
  requireRuntimePath(payload.outputDirectory, "outputDirectory");
  assert.equal(payload.executionClass, "controlled_smoke");
  assert.equal(payload.authorityClass, "local_ai_pre_release_capability_lifecycle");
  assert.equal(payload.ownerAuthorizationRequired, false);
  assert.equal(payload.fixedInputs?.seed, FIXED_SEED);
  assert.equal(payload.fixedInputs?.sampleId, FIXED_SAMPLE_ID);
  assert.equal(payload.fixedInputs?.sampleSplit, "validation");
  assert.deepEqual(payload.fixedInputs?.resolution, FIXED_RESOLUTION);
  assert.equal(payload.fixedInputs?.epochCount, FIXED_EPOCH_COUNT);
  assert.deepEqual(payload.fixedInputs?.previewEpochs, FIXED_PREVIEW_EPOCHS);
  assert.equal(payload.fixedInputs?.batchSize, 1);
  assert.equal(payload.fixedInputs?.conditionChannels, 23);
  assert.equal(payload.executionBoundary?.trainingAllowed, true);
  assert.equal(payload.executionBoundary?.optimizerAllowed, true);
  assert.equal(payload.executionBoundary?.backwardAllowed, true);
  assert.equal(payload.executionBoundary?.weightMutationAllowed, true);
  assert.equal(payload.executionBoundary?.checkpointWriteAllowed, true);
  assert.equal(payload.executionBoundary?.stage0Allowed, false);
  assert.equal(payload.failurePolicy?.automaticRetryAllowed, false);
  assert.equal(payload.failurePolicy?.historicalDenoiserCheckpointAllowed, false);
  assert.equal(payload.failurePolicy?.outputReuseAllowed, false);
  assert.equal(payload.reviewExecutionBindingId,
    `stage4-v2-smoke-review-${sha256Of({ packageId: payload.packageId, runId: payload.runId }).slice(0, 24)}`);
  const expectedDerived = buildDerivedTrainerExecution({
    packageId: payload.packageId,
    runId: payload.runId,
    datasetPackageId: payload.datasetPackageId,
    outputDirectory: payload.outputDirectory,
  });
  assert.deepEqual(payload.derivedTrainerExecution, expectedDerived);
  validateBinding(payload.readonlyGpuQualificationTerminal, "readonlyGpuQualificationTerminal");
  validateBinding(payload.datasetRelease, "datasetRelease");
  validateBinding(payload.autoencoderCheckpoint, "autoencoderCheckpoint");
  validateBinding(payload.machineReviewInputs?.thresholdContract, "thresholdContract");
  validateBinding(payload.machineReviewInputs?.conditionPack, "conditionPack");
  validateBinding(payload.machineReviewInputs?.referenceRgb, "referenceRgb");
  assert.equal(payload.machineReviewInputs.conditionPack.channelCount, 23);
  assert.deepEqual(payload.machineReviewInputs.objectMasks.map((item) => item.role), [
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
  ]);
  for (const binding of payload.machineReviewInputs.objectMasks) validateBinding(binding, binding.role);
  validateBinding(payload.machineReviewInputs.styleFingerprint, "styleFingerprint");
  for (const [role, binding] of Object.entries(payload.machineReviewInputs.reviewPrograms ?? {})) validateBinding(binding, role);
  assert.ok(Array.isArray(payload.inputEvidence) && payload.inputEvidence.length > 0);
  assert.ok(payload.programLineage && Object.keys(payload.programLineage).length > 0);
  if (verifyEvidence) {
    const root = path.resolve(projectRoot);
    for (const binding of payload.inputEvidence) bindProjectFile(root, binding.path, binding.sha256);
    for (const binding of Object.values(payload.programLineage)) bindProjectFile(root, binding.path, binding.sha256);
    bindProjectFile(root, payload.readonlyGpuQualificationTerminal.path, payload.readonlyGpuQualificationTerminal.sha256);
    bindProjectFile(root, payload.datasetRelease.path, payload.datasetRelease.sha256);
    bindProjectFile(root, payload.autoencoderCheckpoint.path, payload.autoencoderCheckpoint.sha256);
    for (const value of Object.values(payload.machineReviewInputs)) {
      for (const binding of Array.isArray(value) ? value : value && value.path ? [value] : Object.values(value ?? {})) {
        if (binding?.path) bindProjectFile(root, binding.path, binding.sha256);
      }
    }
  }
  return true;
}

export function smokePackageDirectory(packageId) {
  requireId(packageId, "packageId");
  return `${SMOKE_PACKAGE_ROOT}/${packageId}`;
}

export function readSmokePayload(projectRoot, packageId) {
  const relative = `${smokePackageDirectory(packageId)}/package-payload.json`;
  const absolute = resolveProjectPath(projectRoot, relative, { mustExist: true, kind: "file" });
  const value = readJsonObject(absolute);
  validateStage4V2SmokePackagePayload(value, { projectRoot, verifyEvidence: true });
  return Object.freeze({ value, binding: bindAbsolute(projectRoot, absolute) });
}

export function bindAbsolute(projectRoot, absolutePath) {
  return Object.freeze({
    path: projectLogicalPath(projectRoot, absolutePath),
    sha256: sha256File(absolutePath),
    byteSize: fs.statSync(absolutePath).size,
  });
}

export function readBoundJson(projectRoot, binding) {
  validateBinding(binding, "binding");
  bindProjectFile(projectRoot, binding.path, binding.sha256);
  return readJsonObject(resolveProjectPath(projectRoot, binding.path));
}

export function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, filePath);
}

export { projectLogicalPath, readJsonObject, resolveProjectPath, sha256File, writeExclusiveJson };

function validateBinding(value, label) {
  assert.ok(value && typeof value.path === "string" && SHA256.test(value.sha256 ?? ""), `${label} binding invalid`);
}
function requireId(value, label) { assert.match(value ?? "", /^[A-Za-z0-9][A-Za-z0-9._-]{7,191}$/u, `${label} invalid`); }
function requireRuntimePath(value, label) { assert.ok(typeof value === "string" && value.startsWith(".runtime/ai-painter/") && !value.includes("..") && !value.includes("\\"), `${label} invalid`); }
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])); return value; }
function sha256Of(value) { return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }
