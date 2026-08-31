import assert from "node:assert/strict";

import {
  bindProjectFile,
  readJsonObject,
  resolveProjectPath,
} from "./ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

export const CURRENT_EXECUTION_REGISTRY_PATH =
  ".runtime/ai-painter/current-execution-registry/current.json";
export const CURRENT_EXECUTION_REGISTRY_TRANSACTION_ROOT =
  ".runtime/ai-painter/current-execution-registry/transactions";

/**
 * Capture the current registry as an observation while returning only its
 * committed transaction and transaction-local staged snapshot as durable
 * evidence. `current.json` is mutable by design and must never be embedded in
 * a ticket or a cross-revision terminal as long-lived evidence.
 */
export function captureImmutableCurrentRegistryEvidence({
  projectRoot,
  current,
} = {}) {
  assert.equal(current?.ok, true,
    current?.errorCode ?? "current execution registry is not verified");
  assert.match(current.registrySha256 ?? "", /^[a-f0-9]{64}$/u,
    "observed current-registry SHA-256 is invalid");
  assert.ok(typeof current.registry?.transactionId === "string"
    && current.registry.transactionId.length > 0,
  "observed current-registry transaction identity is missing");
  // Re-read the mutable pointer only to close the observation race.  Do not
  // expose this binding to callers: durable evidence must use the committed
  // transaction and its transaction-local snapshot below.
  bindProjectFile(
    projectRoot,
    CURRENT_EXECUTION_REGISTRY_PATH,
    current.registrySha256,
  );
  const transactionPath =
    `${CURRENT_EXECUTION_REGISTRY_TRANSACTION_ROOT}/${current.registry.transactionId}/transaction.json`;
  const transaction = bindProjectFile(projectRoot, transactionPath);
  const transactionValue = readJsonObject(resolveProjectPath(projectRoot,
    transaction.path, { mustExist: true, kind: "file" }));
  assert.ok(transactionValue.currentStaged?.path,
    "current-registry transaction staged snapshot is missing");
  const snapshot = bindProjectFile(
    projectRoot,
    transactionValue.currentStaged.path,
    transactionValue.currentStaged.sha256,
  );
  const validated = validateImmutableCurrentRegistryEvidence({
    projectRoot,
    transaction,
    snapshot,
    expectedRegistry: current.registry,
    expectedCurrentSha256: current.registrySha256,
  });
  return Object.freeze({
    transaction,
    snapshot,
    transactionValue: validated.transactionValue,
    snapshotValue: validated.snapshotValue,
  });
}

/**
 * Revalidate a previously captured committed registry transaction without
 * consulting mutable `current.json`. This is safe across later registry
 * revisions and is the only supported validator for durable cross-phase
 * registry evidence.
 */
export function validateImmutableCurrentRegistryEvidence({
  projectRoot,
  transaction,
  snapshot,
  expectedRegistry = null,
  expectedCurrentSha256 = null,
} = {}) {
  assert.ok(transaction?.path && transaction?.sha256,
    "immutable current-registry transaction binding is missing");
  assert.ok(snapshot?.path && snapshot?.sha256,
    "immutable current-registry snapshot binding is missing");
  const reboundTransaction = bindProjectFile(
    projectRoot, transaction.path, transaction.sha256);
  const transactionValue = readJsonObject(resolveProjectPath(projectRoot,
    reboundTransaction.path, { mustExist: true, kind: "file" }));
  assert.equal(transactionValue.schemaVersion,
    "ai-painter-current-execution-registry-transaction-v1",
    "current-registry transaction schema mismatch");
  assert.equal(transactionValue.status, "committed",
    "current-registry transaction is not committed");
  assert.ok(typeof transactionValue.transactionId === "string"
    && transactionValue.transactionId.length > 0,
  "current-registry transaction identity is missing");
  const expectedTransactionPath =
    `${CURRENT_EXECUTION_REGISTRY_TRANSACTION_ROOT}/${transactionValue.transactionId}/transaction.json`;
  const expectedSnapshotPath =
    `${CURRENT_EXECUTION_REGISTRY_TRANSACTION_ROOT}/${transactionValue.transactionId}/current.staged.json`;
  assert.equal(reboundTransaction.path, expectedTransactionPath,
    "current-registry transaction path mismatch");
  assert.equal(snapshot.path, expectedSnapshotPath,
    "current-registry snapshot path mismatch");
  assert.equal(transactionValue.currentStaged?.path, snapshot.path,
    "current-registry transaction staged path mismatch");
  assert.equal(transactionValue.currentStaged?.sha256, snapshot.sha256,
    "current-registry transaction staged SHA-256 mismatch");
  assert.match(transactionValue.currentSha256 ?? "", /^[a-f0-9]{64}$/u,
    "current-registry transaction current SHA-256 is invalid");
  assert.equal(transactionValue.currentSha256, snapshot.sha256,
    "current-registry transaction does not bind snapshot SHA-256");
  if (expectedCurrentSha256 !== null) {
    assert.equal(transactionValue.currentSha256, expectedCurrentSha256,
      "current-registry transaction SHA-256 differs from observation");
  }
  const reboundSnapshot = bindProjectFile(
    projectRoot, snapshot.path, snapshot.sha256);
  const snapshotValue = readJsonObject(resolveProjectPath(projectRoot,
    reboundSnapshot.path, { mustExist: true, kind: "file" }));
  assert.equal(snapshotValue.schemaVersion,
    "ai-painter-current-execution-registry-v1",
    "current-registry snapshot schema mismatch");
  assert.equal(snapshotValue.transactionId, transactionValue.transactionId,
    "current-registry snapshot transaction identity mismatch");
  assert.equal(snapshotValue.registryRevision, transactionValue.registryRevision,
    "current-registry snapshot revision mismatch");
  if (Object.hasOwn(transactionValue, "eventSequence")) {
    assert.equal(snapshotValue.eventSequence, transactionValue.eventSequence,
      "current-registry snapshot event sequence mismatch");
  }
  if (expectedRegistry !== null) {
    assert.deepEqual(snapshotValue, expectedRegistry,
      "current-registry staged snapshot content mismatch");
  }
  return Object.freeze({
    transaction: reboundTransaction,
    snapshot: reboundSnapshot,
    transactionValue: Object.freeze(transactionValue),
    snapshotValue: Object.freeze(snapshotValue),
  });
}
