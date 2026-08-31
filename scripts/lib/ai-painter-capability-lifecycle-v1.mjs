import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { loadAndValidateReleasedCapabilityBinding } from "./ai-painter-autonomous-package-decision-core-v3.mjs";

export const CAPABILITY_LIFECYCLE_CONTRACT_PATH = "data/ai-painter/system-governance/ai-painter-capability-lifecycle-contract-v1.json";
export const CAPABILITY_LIFECYCLE_ROOT = ".runtime/ai-painter/capability-lifecycle";

const TRANSITIONS = Object.freeze({
  change_candidate: ["isolated_implementation", "rejected"],
  isolated_implementation: ["cpu_contract_verified", "rejected"],
  cpu_contract_verified: ["readonly_gpu_qualified", "controlled_smoke_completed", "rejected"],
  readonly_gpu_qualified: ["controlled_smoke_completed", "rejected"],
  controlled_smoke_completed: ["formal_stage_validation_completed", "rejected"],
  formal_stage_validation_completed: ["independent_regression_completed", "rejected"],
  independent_regression_completed: ["machine_release_adjudicated", "rejected"],
  machine_release_adjudicated: ["released", "rejected"],
  released: ["rolled_back"],
});
const TERMINALS = new Set(["rejected", "rolled_back"]);

export function validateCapabilityLifecycleContract(root = process.cwd()) {
  const contract = JSON.parse(fs.readFileSync(resolveExisting(root, CAPABILITY_LIFECYCLE_CONTRACT_PATH), "utf8"));
  assert(contract.schemaVersion === "ai-painter-capability-lifecycle-contract-v1", "capability lifecycle schema mismatch");
  assert(contract.status === "active" && contract.authority === "local_ai_pet_world_program", "capability lifecycle authority mismatch");
  assert(contract.ownerInLifecycle === false && contract.perCapabilityOwnerApprovalRequired === false, "Owner must not enter capability lifecycle");
  return contract;
}

export function createCapabilityCandidate(spec, { root = process.cwd(), recordedAtUtc = new Date().toISOString() } = {}) {
  validateCapabilityLifecycleContract(root);
  validateSpec(spec, root);
  const candidateRoot = resolveInside(root, `${CAPABILITY_LIFECYCLE_ROOT}/${spec.capabilityVersion}`);
  fs.mkdirSync(path.dirname(candidateRoot), { recursive: true });
  assert(!fs.existsSync(candidateRoot), "capability version already exists");
  fs.mkdirSync(candidateRoot, { recursive: false });
  fs.mkdirSync(path.join(candidateRoot, "evidence"), { recursive: false });
  const sqlitePath = path.join(candidateRoot, "lifecycle.sqlite");
  const db = openDb(sqlitePath);
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("INSERT INTO capabilities(capability_version, state, change_class, created_at_utc, updated_at_utc, owner_response_required) VALUES (?, 'change_candidate', ?, ?, ?, 0)").run(spec.capabilityVersion, spec.changeClass, recordedAtUtc, recordedAtUtc);
    db.prepare("INSERT INTO lifecycle_transitions(capability_version, sequence, from_state, to_state, recorded_at_utc, evidence_sha256) VALUES (?, 0, NULL, 'change_candidate', ?, NULL)").run(spec.capabilityVersion, recordedAtUtc);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; } finally { db.close(); }
  const state = stateOf(spec, "change_candidate", 0, recordedAtUtc, null);
  writeAtomic(path.join(candidateRoot, "state.json"), state);
  writeAtomic(path.join(candidateRoot, "candidate.json"), spec);
  appendEvent(candidateRoot, state, recordedAtUtc);
  return { candidateRoot, sqlitePath, state };
}

export function advanceCapabilityLifecycle({
  root = process.cwd(), capabilityVersion, targetState, evidence, releaseBinding = null,
  recordedAtUtc = new Date().toISOString(),
  _testHooks = null,
}) {
  validateCapabilityLifecycleContract(root);
  const candidateRoot = resolveInside(root, `${CAPABILITY_LIFECYCLE_ROOT}/${capabilityVersion}`);
  const statePath = path.join(candidateRoot, "state.json");
  assert(fs.existsSync(statePath), "capability state is missing");
  const current = JSON.parse(fs.readFileSync(statePath, "utf8"));
  validateLifecycleState(current, capabilityVersion);

  const isExactTargetRetry = current.state === targetState;
  if (!isExactTargetRetry) {
    assert(!TERMINALS.has(current.state), "terminal capability cannot transition");
    assert(TRANSITIONS[current.state]?.includes(targetState), `invalid capability transition ${current.state} -> ${targetState}`);
  } else {
    assert(current.sequence > 0, "initial lifecycle state cannot be replayed as a transition");
  }
  const sequence = isExactTargetRetry ? current.sequence : current.sequence + 1;
  const evidenceBinding = persistOrVerifyEvidence(
    root,
    candidateRoot,
    capabilityVersion,
    sequence,
    targetState,
    evidence,
    recordedAtUtc,
  );
  invokeTestHook(_testHooks, "afterLifecycleEvidencePersisted", {
    capabilityVersion,
    targetState,
    sequence,
    evidenceBinding,
  });

  let verifiedRelease = null;
  if (targetState === "released") {
    assert(releaseBinding?.capabilityReleasePath && releaseBinding?.trustedReleaseRegistryPath, "trusted release binding is required");
    verifiedRelease = loadAndValidateReleasedCapabilityBinding({ projectRoot: root, ...releaseBinding });
    assert(verifiedRelease.release.modelCapabilityVersion === capabilityVersion, "release capability version mismatch");
  }

  const transition = reconcileLifecycleDatabase({
    sqlitePath: path.join(candidateRoot, "lifecycle.sqlite"),
    capabilityVersion,
    current,
    targetState,
    sequence,
    evidenceBinding,
  });
  invokeTestHook(_testHooks, "afterLifecycleSqliteCommitted", {
    capabilityVersion,
    targetState,
    sequence,
    evidenceBinding,
  });

  const releaseIdentity = verifiedRelease?.release.capabilityReleaseIdentity
    ?? current.releaseIdentity
    ?? null;
  const next = {
    ...current,
    state: targetState,
    sequence,
    latestEvidence: { path: evidenceBinding.path, sha256: evidenceBinding.sha256 },
    releaseIdentity,
    ownerResponseRequired: false,
    updatedAtUtc: evidenceBinding.recordedAtUtc,
  };
  reconcileLifecycleState({ statePath, current, next, isExactTargetRetry });
  invokeTestHook(_testHooks, "afterLifecycleStateCommitted", {
    capabilityVersion,
    targetState,
    sequence,
    evidenceBinding,
  });

  reconcileLifecycleEvent(candidateRoot, next, evidenceBinding.recordedAtUtc);
  invokeTestHook(_testHooks, "afterLifecycleEventCommitted", {
    capabilityVersion,
    targetState,
    sequence,
    evidenceBinding,
  });

  if (TERMINALS.has(targetState)) {
    writeExclusiveOrVerify(path.join(candidateRoot, "phase-terminal.json"), next, "capability terminal conflict");
  }
  assert(transition.to_state === targetState, "capability transition reconciliation failed");
  return next;
}

function validateSpec(spec, root) {
  assert(spec?.schemaVersion === "ai-painter-capability-change-candidate-v1", "capability candidate schema mismatch");
  assert(/^[a-z0-9][a-z0-9_-]{7,127}$/.test(spec.capabilityVersion ?? ""), "capabilityVersion is invalid");
  assert(["model_family", "training_paradigm", "review_contract", "program_lineage", "data_release", "runtime_interface", "infrastructure_non_semantic"].includes(spec.changeClass), "changeClass is invalid");
  assert(spec.ownerAuthorizationRequired === false && spec.ownerInLifecycle === false, "capability candidate cannot require Owner");
  assert(Array.isArray(spec.sourceEvidence) && spec.sourceEvidence.length > 0, "candidate source evidence is required");
  for (const binding of spec.sourceEvidence) verifyBinding(root, binding);
}

function persistOrVerifyEvidence(root, candidateRoot, capabilityVersion, sequence, targetState, evidence, recordedAtUtc) {
  assert(evidence?.schemaVersion === "ai-painter-capability-stage-evidence-v1", "stage evidence schema mismatch");
  assert(evidence.capabilityVersion === capabilityVersion && evidence.targetState === targetState, "stage evidence identity mismatch");
  assert(evidence.status === "passed" || targetState === "rejected" || targetState === "rolled_back", "non-terminal stage evidence must pass");
  assert(Array.isArray(evidence.bindings) && evidence.bindings.length > 0, "stage evidence bindings are required");
  for (const binding of evidence.bindings) verifyBinding(root, binding);
  const relative = `evidence/${String(sequence).padStart(3, "0")}-${targetState}.json`;
  const absolute = path.join(candidateRoot, ...relative.split("/"));
  const base = {
    ...evidence,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
  };
  if (!fs.existsSync(absolute)) {
    try {
      writeExclusive(absolute, { ...base, recordedAtUtc });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  const persisted = readJsonFile(absolute, "capability lifecycle evidence");
  assert(typeof persisted.recordedAtUtc === "string" && persisted.recordedAtUtc.length > 0,
    "capability lifecycle evidence timestamp is missing");
  assert(
    isDeepStrictEqual(persisted, { ...base, recordedAtUtc: persisted.recordedAtUtc }),
    "capability lifecycle evidence conflict",
  );
  return {
    path: relative,
    sha256: sha256File(absolute),
    recordedAtUtc: persisted.recordedAtUtc,
  };
}

function reconcileLifecycleDatabase({
  sqlitePath,
  capabilityVersion,
  current,
  targetState,
  sequence,
  evidenceBinding,
}) {
  const db = openDb(sqlitePath);
  let transactionOpen = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const capability = db.prepare(
      "SELECT state, updated_at_utc, owner_response_required FROM capabilities WHERE capability_version = ?",
    ).get(capabilityVersion);
    assert(capability, "capability persistent record is missing");
    assert(capability.owner_response_required === 0, "capability persistent Owner flag conflict");
    const transitionAtSequence = db.prepare(
      "SELECT from_state, to_state, recorded_at_utc, evidence_sha256 FROM lifecycle_transitions WHERE capability_version = ? AND sequence = ?",
    ).get(capabilityVersion, sequence);
    const maximum = db.prepare(
      "SELECT MAX(sequence) AS max_sequence FROM lifecycle_transitions WHERE capability_version = ?",
    ).get(capabilityVersion)?.max_sequence;

    if (capability.state === current.state && current.state !== targetState) {
      assert(maximum === current.sequence, "capability transition sequence conflict before commit");
      assert(!transitionAtSequence, "capability transition row exists before state commit");
      const update = db.prepare(
        "UPDATE capabilities SET state = ?, updated_at_utc = ?, owner_response_required = 0 WHERE capability_version = ? AND state = ?",
      ).run(targetState, evidenceBinding.recordedAtUtc, capabilityVersion, current.state);
      assert(update.changes === 1, "capability persistent state update conflict");
      db.prepare(
        "INSERT INTO lifecycle_transitions(capability_version, sequence, from_state, to_state, recorded_at_utc, evidence_sha256) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        capabilityVersion,
        sequence,
        current.state,
        targetState,
        evidenceBinding.recordedAtUtc,
        evidenceBinding.sha256,
      );
    } else if (capability.state === targetState) {
      assert(maximum === sequence, "capability transition sequence conflict after commit");
      verifyTransitionRow({
        transition: transitionAtSequence,
        expectedFromState: current.state === targetState ? null : current.state,
        targetState,
        evidenceBinding,
      });
      assert(capability.updated_at_utc === evidenceBinding.recordedAtUtc,
        "capability persistent timestamp conflict");
    } else {
      throw new Error(`capability persistent state conflict: ${capability.state} != ${current.state}/${targetState}`);
    }

    const committed = db.prepare(
      "SELECT from_state, to_state, recorded_at_utc, evidence_sha256 FROM lifecycle_transitions WHERE capability_version = ? AND sequence = ?",
    ).get(capabilityVersion, sequence);
    verifyTransitionRow({
      transition: committed,
      expectedFromState: current.state === targetState ? null : current.state,
      targetState,
      evidenceBinding,
    });
    db.exec("COMMIT");
    transactionOpen = false;
    return committed;
  } catch (error) {
    if (transactionOpen) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

function verifyTransitionRow({ transition, expectedFromState, targetState, evidenceBinding }) {
  assert(transition, "capability transition record is missing");
  assert(transition.to_state === targetState, "capability transition target conflict");
  assert(TRANSITIONS[transition.from_state]?.includes(targetState), "capability transition source conflict");
  if (expectedFromState !== null) {
    assert(transition.from_state === expectedFromState, "capability transition source conflict");
  }
  assert(transition.recorded_at_utc === evidenceBinding.recordedAtUtc,
    "capability transition timestamp conflict");
  assert(transition.evidence_sha256 === evidenceBinding.sha256,
    "capability transition evidence conflict");
}

function reconcileLifecycleState({ statePath, current, next, isExactTargetRetry }) {
  const persisted = readJsonFile(statePath, "capability lifecycle state");
  if (persisted.state === next.state && persisted.sequence === next.sequence) {
    assert(isDeepStrictEqual(persisted, next), "capability lifecycle state conflict after commit");
    return;
  }
  assert(!isExactTargetRetry, "capability lifecycle target retry state regressed");
  assert(isDeepStrictEqual(persisted, current), "capability lifecycle state changed during commit");
  writeAtomic(statePath, next);
  const committed = readJsonFile(statePath, "capability lifecycle state");
  assert(isDeepStrictEqual(committed, next), "capability lifecycle state commit mismatch");
}

function reconcileLifecycleEvent(root, state, recordedAtUtc) {
  const eventPath = path.join(root, "event-ledger.jsonl");
  const expected = {
    schemaVersion: "ai-painter-capability-lifecycle-event-v1",
    capabilityVersion: state.capabilityVersion,
    sequence: state.sequence,
    state: state.state,
    evidenceSha256: state.latestEvidence?.sha256 ?? null,
    ownerResponseRequired: false,
    recordedAtUtc,
  };
  const source = fs.existsSync(eventPath) ? fs.readFileSync(eventPath, "utf8") : "";
  const entries = parseEventLedger(source);
  const matching = entries.filter((entry) =>
    entry?.capabilityVersion === state.capabilityVersion && entry?.sequence === state.sequence);
  assert(matching.length <= 1, "duplicate capability lifecycle event detected");
  if (matching.length === 1) {
    assert(isDeepStrictEqual(matching[0], expected), "capability lifecycle event conflict");
    return;
  }
  const nextEntries = [...entries, expected];
  writeTextAtomic(eventPath, `${nextEntries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  const committed = parseEventLedger(fs.readFileSync(eventPath, "utf8"))
    .filter((entry) => entry?.capabilityVersion === state.capabilityVersion && entry?.sequence === state.sequence);
  assert(committed.length === 1 && isDeepStrictEqual(committed[0], expected),
    "capability lifecycle event commit mismatch");
}

function parseEventLedger(source) {
  return source.split(/\r?\n/u).filter((line) => line.trim().length > 0).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error("capability lifecycle event ledger contains invalid JSON");
    }
  });
}

function validateLifecycleState(state, capabilityVersion) {
  assert(state?.schemaVersion === "ai-painter-capability-lifecycle-state-v1",
    "capability lifecycle state schema mismatch");
  assert(state.capabilityVersion === capabilityVersion, "capability lifecycle state identity mismatch");
  assert(Number.isInteger(state.sequence) && state.sequence >= 0, "capability lifecycle state sequence is invalid");
  assert(state.ownerAuthorizationRequired === false && state.ownerResponseRequired === false,
    "capability lifecycle state contains an Owner gate");
}

function invokeTestHook(testHooks, name, context) {
  if (typeof testHooks?.[name] === "function") testHooks[name](context);
}

function verifyBinding(root, binding) {
  const absolute = resolveExisting(root, binding?.path);
  assert(/^[a-f0-9]{64}$/.test(binding.sha256 ?? ""), "evidence SHA-256 is invalid");
  assert(sha256File(absolute) === binding.sha256, `evidence SHA-256 mismatch: ${binding.path}`);
}

function openDb(sqlitePath) {
  const db = new DatabaseSync(sqlitePath);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS capabilities(capability_version TEXT PRIMARY KEY, state TEXT NOT NULL, change_class TEXT NOT NULL, created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL, owner_response_required INTEGER NOT NULL CHECK(owner_response_required = 0));
    CREATE TABLE IF NOT EXISTS lifecycle_transitions(capability_version TEXT NOT NULL, sequence INTEGER NOT NULL, from_state TEXT, to_state TEXT NOT NULL, recorded_at_utc TEXT NOT NULL, evidence_sha256 TEXT, PRIMARY KEY(capability_version, sequence));`);
  return db;
}
function stateOf(spec, state, sequence, updatedAtUtc, latestEvidence) { return { schemaVersion: "ai-painter-capability-lifecycle-state-v1", capabilityVersion: spec.capabilityVersion, changeClass: spec.changeClass, state, sequence, latestEvidence, releaseIdentity: null, ownerAuthorizationRequired: false, ownerResponseRequired: false, updatedAtUtc }; }
function appendEvent(root, state, recordedAtUtc) { fs.appendFileSync(path.join(root, "event-ledger.jsonl"), `${JSON.stringify({ schemaVersion: "ai-painter-capability-lifecycle-event-v1", capabilityVersion: state.capabilityVersion, sequence: state.sequence, state: state.state, evidenceSha256: state.latestEvidence?.sha256 ?? null, ownerResponseRequired: false, recordedAtUtc })}\n`); }
function resolveExisting(root, relativePath) { const absolute = resolveInside(root, relativePath); assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `file is missing: ${relativePath}`); return absolute; }
function resolveInside(root, relativePath) { assert(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath), "path must be project-relative"); const projectRoot = path.resolve(root); const absolute = path.resolve(projectRoot, relativePath); assert(absolute.startsWith(`${projectRoot}${path.sep}`), "path escapes project root"); return absolute; }
function readJsonFile(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${label} is unreadable: ${error.message}`);
  }
}
function writeAtomic(file, value) { writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`); }
function writeTextAtomic(file, text) {
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`;
  let descriptor = null;
  try {
    descriptor = fs.openSync(temporary, "wx");
    fs.writeFileSync(descriptor, text, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, file);
    syncDirectoryBestEffort(path.dirname(file));
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function writeExclusive(file, value) {
  const descriptor = fs.openSync(file, "wx");
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  syncDirectoryBestEffort(path.dirname(file));
}
function writeExclusiveOrVerify(file, value, conflictMessage) {
  if (!fs.existsSync(file)) {
    try {
      writeExclusive(file, value);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  assert(isDeepStrictEqual(readJsonFile(file, "capability lifecycle terminal"), value), conflictMessage);
}
function syncDirectoryBestEffort(directory) {
  let descriptor = null;
  try {
    descriptor = fs.openSync(directory, "r");
    fs.fsyncSync(descriptor);
  } catch {
    // Windows can reject directory handles; file fsync plus atomic rename remains the supported fallback.
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function assert(condition, message) { if (!condition) throw new Error(message); }
