import assert from "node:assert/strict";
import path from "node:path";

import {
  bindAbsolute,
  readBoundJson,
  resolveProjectPath,
  SMOKE_BACKGROUND_LAUNCH_ACTION,
  SMOKE_RUN_TASK,
  STAGE4_V2_CAPABILITY,
} from "./ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  validateImmutableCurrentRegistryEvidence,
} from "./ai-painter-immutable-current-registry-evidence-v1.mjs";

export const STAGE4_V2_CONTROLLED_SMOKE_RUNNER_PATH =
  "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs";

const INTENT_SCHEMA =
  "ai-painter-stage4-v2-controlled-smoke-background-launch-intent-v1";
const INTENT_KEYS = Object.freeze([
  "schemaVersion",
  "status",
  "launchAction",
  "packageId",
  "runId",
  "capabilityVersion",
  "runner",
  "packageManifest",
  "packagePayload",
  "currentRegistryTransaction",
  "currentRegistrySnapshot",
  "detachedFromCodexRequired",
  "ownerAuthorizationRequired",
  "recordedAtUtc",
].sort());

/**
 * Verify the immutable launch decision consumed by the detached Smoke child.
 * The mutable current.json file is only an optional creation-time observation;
 * durable validation is anchored to the committed transaction and its staged
 * snapshot so the binding remains valid after later registry revisions.
 */
export function validateStage4V2ControlledSmokeBackgroundLaunchIntent({
  projectRoot,
  launchIntentBinding,
  packageManifestBinding,
  expectedCurrent = null,
} = {}) {
  const root = path.resolve(projectRoot);
  assert.ok(packageManifestBinding?.path && packageManifestBinding?.sha256,
    "Smoke launch intent package manifest binding is missing");
  const expectedIntentPath = `${path.posix.dirname(packageManifestBinding.path)}/background-launch-intent.json`;
  assert.equal(launchIntentBinding?.path, expectedIntentPath,
    "Smoke launch intent is outside the bound package namespace");
  const intent = readBoundJson(root, launchIntentBinding);
  assert.deepEqual(Object.keys(intent).sort(), INTENT_KEYS,
    "Smoke launch intent fields differ from the frozen schema");
  assert.equal(intent.schemaVersion, INTENT_SCHEMA);
  assert.equal(intent.status, "ready_for_wmi_background_launch");
  assert.equal(intent.launchAction, SMOKE_BACKGROUND_LAUNCH_ACTION);
  assert.equal(intent.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.deepEqual(intent.packageManifest, packageManifestBinding,
    "Smoke launch intent binds another package manifest");
  const manifest = readBoundJson(root, packageManifestBinding);
  assert.deepEqual(intent.packagePayload, manifest.packagePayload,
    "Smoke launch intent binds another package payload");
  const payload = readBoundJson(root, manifest.packagePayload);
  assert.equal(intent.packageId, payload.packageId);
  assert.equal(intent.runId, payload.runId);
  const runner = bindAbsolute(root, resolveProjectPath(
    root,
    STAGE4_V2_CONTROLLED_SMOKE_RUNNER_PATH,
    { mustExist: true, kind: "file" },
  ));
  assert.deepEqual(intent.runner, runner,
    "Smoke launch intent runner identity changed");
  assert.equal(intent.detachedFromCodexRequired, true);
  assert.equal(intent.ownerAuthorizationRequired, false);
  assert.ok(typeof intent.recordedAtUtc === "string"
    && Number.isFinite(Date.parse(intent.recordedAtUtc)),
  "Smoke launch intent timestamp is invalid");

  const immutable = validateImmutableCurrentRegistryEvidence({
    projectRoot: root,
    transaction: intent.currentRegistryTransaction,
    snapshot: intent.currentRegistrySnapshot,
    expectedRegistry: expectedCurrent?.registry ?? null,
    expectedCurrentSha256: expectedCurrent?.registrySha256 ?? null,
  });
  const registry = immutable.snapshotValue;
  assert.equal(registry.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(registry.packageId, payload.packageId);
  assert.equal(registry.runId, payload.runId);
  assert.equal(registry.taskId, SMOKE_RUN_TASK);
  assert.equal(registry.nextMachineAction, SMOKE_BACKGROUND_LAUNCH_ACTION);
  assert.equal(registry.executionState, "package_materialized");
  assert.equal(registry.activeExecution, null);
  assert.equal(intent.recordedAtUtc, registry.queuedAtUtc,
    "Smoke launch intent timestamp differs from its registry snapshot");
  const materializationTerminal = readBoundJson(root, registry.terminalEvidence);
  assert.equal(materializationTerminal.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-materialization-terminal-v1");
  assert.deepEqual(materializationTerminal.packageManifest, packageManifestBinding,
    "Smoke launch registry snapshot binds another package manifest");
  return Object.freeze({
    intent: Object.freeze(intent),
    manifest: Object.freeze(manifest),
    payload: Object.freeze(payload),
    immutableRegistry: immutable,
  });
}
