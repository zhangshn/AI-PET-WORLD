import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
  STAGE4_V2_CAPABILITY,
  bindProjectFile,
  readJsonObject,
  resolveProjectPath,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const LIFECYCLE_ROOT =
  `.runtime/ai-painter/capability-lifecycle/${STAGE4_V2_CAPABILITY}`;
const STATE_PATH = `${LIFECYCLE_ROOT}/state.json`;
const DATABASE_PATH = `${LIFECYCLE_ROOT}/lifecycle.sqlite`;
const EVENT_PATH = `${LIFECYCLE_ROOT}/event-ledger.jsonl`;

/**
 * Register a later successful qualification for a capability that is already
 * in readonly_gpu_qualified. This is a same-state re-attestation, not a retry
 * of the old immutable evidence and not a GPU replay.
 */
export function reconcileStage4V2ReadonlyGpuRequalification({
  projectRoot = process.cwd(),
  qualificationTerminalBinding,
} = {}) {
  const root = path.resolve(projectRoot);
  const terminalBinding = bindProjectFile(
    root,
    qualificationTerminalBinding?.path,
    qualificationTerminalBinding?.sha256,
  );
  if (Object.hasOwn(qualificationTerminalBinding ?? {}, "byteSize")) {
    assert.equal(terminalBinding.byteSize, qualificationTerminalBinding.byteSize,
      "qualification terminal byte size mismatch");
  }
  const terminal = readJsonObject(resolveProjectPath(root, terminalBinding.path, {
    mustExist: true,
    kind: "file",
  }));
  assert.equal(terminal.schemaVersion,
    "ai-painter-stage4-v2-readonly-gpu-terminal-v1");
  assert.equal(terminal.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(terminal.executionState, "completed");
  assert.equal(terminal.status, "stage4_v2_readonly_gpu_qualification_passed");
  assert.equal(terminal.ownerAuthorizationRequired, false);
  assert.equal(terminal.trainingStarted, false);
  assert.equal(terminal.weightsModified, false);

  const stateAbsolute = resolveProjectPath(root, STATE_PATH, {
    mustExist: true,
    kind: "file",
  });
  const before = readJsonObject(stateAbsolute);
  assert.equal(before.schemaVersion, "ai-painter-capability-lifecycle-state-v1");
  assert.equal(before.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(before.state, "readonly_gpu_qualified",
    "requalification requires an existing readonly-GPU-qualified lifecycle");
  assert.ok(Number.isInteger(before.sequence) && before.sequence > 0,
    "existing lifecycle sequence is invalid");
  assert.equal(before.ownerAuthorizationRequired, false);
  assert.equal(before.ownerResponseRequired, false);

  const existingEvidenceAbsolute = resolveProjectPath(
    root,
    `${LIFECYCLE_ROOT}/${before.latestEvidence.path}`,
    { mustExist: true, kind: "file" },
  );
  const existingEvidenceBinding = bindProjectFile(
    root,
    projectRelative(root, existingEvidenceAbsolute),
    before.latestEvidence.sha256,
  );
  const existingEvidence = readJsonObject(existingEvidenceAbsolute);
  assert.equal(existingEvidence.targetState, "readonly_gpu_qualified");
  assert.equal(existingEvidence.status, "passed");
  assert.equal(existingEvidence.bindings?.some((binding) => (
    binding.path === terminalBinding.path && binding.sha256 === terminalBinding.sha256
  )), false, "qualification terminal is already the canonical lifecycle evidence");

  const sequence = before.sequence + 1;
  const recordedAtUtc = terminal.recordedAtUtc;
  assert.equal(typeof recordedAtUtc, "string");
  assert.ok(Date.parse(recordedAtUtc) > Date.parse(before.updatedAtUtc),
    "requalification terminal does not postdate existing lifecycle evidence");
  const evidenceRelative = `evidence/${String(sequence).padStart(3, "0")}-readonly_gpu_qualified.json`;
  const evidenceAbsolute = resolveProjectPath(root, `${LIFECYCLE_ROOT}/${evidenceRelative}`);
  const evidence = {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    targetState: "readonly_gpu_qualified",
    status: "passed",
    evidenceKind: "same_state_requalification",
    bindings: [terminalBinding],
    supersedesEvidence: existingEvidenceBinding,
    gpuReplayPerformed: false,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  };
  writeExclusiveOrVerify(evidenceAbsolute, evidence,
    "readonly-GPU requalification evidence conflict");
  const evidenceBinding = bindProjectFile(root, projectRelative(root, evidenceAbsolute));

  reconcileDatabase({
    databasePath: resolveProjectPath(root, DATABASE_PATH, { mustExist: true, kind: "file" }),
    before,
    sequence,
    evidenceBinding,
    recordedAtUtc,
  });

  const after = {
    ...before,
    sequence,
    latestEvidence: {
      path: evidenceRelative,
      sha256: evidenceBinding.sha256,
    },
    updatedAtUtc: recordedAtUtc,
  };
  reconcileState(stateAbsolute, before, after);
  reconcileEvent(resolveProjectPath(root, EVENT_PATH), after, recordedAtUtc);

  const repairRoot = resolveProjectPath(
    root,
    `.runtime/ai-painter/stage4-v2-readonly-gpu-requalifications/${terminal.runId}`,
  );
  fs.mkdirSync(repairRoot, { recursive: true });
  const terminalPath = path.join(repairRoot, "phase-terminal.json");
  const result = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-requalification-terminal-v1",
    status: "same_state_requalification_committed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    qualificationTerminal: terminalBinding,
    previousLifecycleEvidence: existingEvidenceBinding,
    lifecycleEvidence: evidenceBinding,
    lifecycleSequence: sequence,
    lifecycleState: "readonly_gpu_qualified",
    gpuReplayPerformed: false,
    trainingStarted: false,
    weightsModified: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  };
  writeExclusiveOrVerify(terminalPath, result,
    "readonly-GPU requalification terminal conflict");
  return Object.freeze({
    ...result,
    terminal: bindProjectFile(root, projectRelative(root, terminalPath)),
  });
}

function reconcileDatabase({ databasePath, before, sequence, evidenceBinding, recordedAtUtc }) {
  const database = new DatabaseSync(databasePath);
  let transactionOpen = false;
  try {
    database.exec("PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; BEGIN IMMEDIATE");
    transactionOpen = true;
    const capability = database.prepare(
      "SELECT state, updated_at_utc, owner_response_required FROM capabilities WHERE capability_version = ?",
    ).get(STAGE4_V2_CAPABILITY);
    assert.equal(capability?.state, "readonly_gpu_qualified");
    assert.equal(capability.owner_response_required, 0);
    const maximum = database.prepare(
      "SELECT MAX(sequence) AS value FROM lifecycle_transitions WHERE capability_version = ?",
    ).get(STAGE4_V2_CAPABILITY)?.value;
    const existing = database.prepare(
      "SELECT from_state, to_state, recorded_at_utc, evidence_sha256 FROM lifecycle_transitions WHERE capability_version = ? AND sequence = ?",
    ).get(STAGE4_V2_CAPABILITY, sequence);
    if (maximum === before.sequence) {
      assert.equal(existing, undefined, "requalification sequence already exists");
      database.prepare(
        "UPDATE capabilities SET updated_at_utc = ?, owner_response_required = 0 WHERE capability_version = ? AND state = 'readonly_gpu_qualified'",
      ).run(recordedAtUtc, STAGE4_V2_CAPABILITY);
      database.prepare(
        "INSERT INTO lifecycle_transitions(capability_version, sequence, from_state, to_state, recorded_at_utc, evidence_sha256) VALUES (?, ?, 'readonly_gpu_qualified', 'readonly_gpu_qualified', ?, ?)",
      ).run(STAGE4_V2_CAPABILITY, sequence, recordedAtUtc, evidenceBinding.sha256);
    } else {
      assert.equal(maximum, sequence, "requalification lifecycle sequence conflict");
      verifyDatabaseRow(existing, evidenceBinding, recordedAtUtc);
      assert.equal(capability.updated_at_utc, recordedAtUtc,
        "requalification lifecycle database timestamp conflict");
    }
    verifyDatabaseRow(database.prepare(
      "SELECT from_state, to_state, recorded_at_utc, evidence_sha256 FROM lifecycle_transitions WHERE capability_version = ? AND sequence = ?",
    ).get(STAGE4_V2_CAPABILITY, sequence), evidenceBinding, recordedAtUtc);
    database.exec("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

function verifyDatabaseRow(row, evidenceBinding, recordedAtUtc) {
  assert.ok(row, "requalification lifecycle transition is missing");
  assert.equal(row.from_state, "readonly_gpu_qualified");
  assert.equal(row.to_state, "readonly_gpu_qualified");
  assert.equal(row.recorded_at_utc, recordedAtUtc);
  assert.equal(row.evidence_sha256, evidenceBinding.sha256);
}

function reconcileState(statePath, before, after) {
  const current = readJsonObject(statePath);
  if (current.sequence === after.sequence) {
    assert.deepEqual(current, after, "requalification lifecycle state conflict");
    return;
  }
  assert.deepEqual(current, before, "lifecycle state changed during requalification");
  writeJsonAtomic(statePath, after);
  assert.deepEqual(readJsonObject(statePath), after,
    "requalification lifecycle state read-back mismatch");
}

function reconcileEvent(eventPath, state, recordedAtUtc) {
  const expected = {
    schemaVersion: "ai-painter-capability-lifecycle-event-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    sequence: state.sequence,
    state: state.state,
    evidenceSha256: state.latestEvidence.sha256,
    ownerResponseRequired: false,
    recordedAtUtc,
  };
  const entries = fs.readFileSync(eventPath, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
  const matches = entries.filter((entry) => entry.capabilityVersion === STAGE4_V2_CAPABILITY
    && entry.sequence === state.sequence);
  assert.ok(matches.length <= 1, "duplicate requalification lifecycle event");
  if (matches.length === 1) {
    assert.deepEqual(matches[0], expected, "requalification lifecycle event conflict");
    return;
  }
  writeTextAtomic(eventPath,
    `${[...entries, expected].map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

function writeExclusiveOrVerify(filePath, value, conflictMessage) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    const descriptor = fs.openSync(filePath, "wx");
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  }
  assert.deepEqual(readJsonObject(filePath), value, conflictMessage);
}

function writeJsonAtomic(filePath, value) {
  writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTextAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  const descriptor = fs.openSync(temporary, "wx");
  try {
    fs.writeFileSync(descriptor, value, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporary, filePath);
}

function projectRelative(root, absolutePath) {
  const relative = path.relative(root, absolutePath);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    "path escapes project root");
  return relative.replaceAll("\\", "/");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const terminalPath = process.argv[2];
  const terminalSha256 = process.argv[3];
  assert.ok(terminalPath && terminalSha256,
    "usage: node reconcile-ai-painter-stage4-v2-readonly-gpu-requalification.mjs <terminal-path> <terminal-sha256>");
  const result = reconcileStage4V2ReadonlyGpuRequalification({
    projectRoot: process.cwd(),
    qualificationTerminalBinding: { path: terminalPath, sha256: terminalSha256 },
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
