import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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
}) {
  validateCapabilityLifecycleContract(root);
  const candidateRoot = resolveInside(root, `${CAPABILITY_LIFECYCLE_ROOT}/${capabilityVersion}`);
  const statePath = path.join(candidateRoot, "state.json");
  assert(fs.existsSync(statePath), "capability state is missing");
  const current = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert(!TERMINALS.has(current.state), "terminal capability cannot transition");
  assert(TRANSITIONS[current.state]?.includes(targetState), `invalid capability transition ${current.state} -> ${targetState}`);
  const evidenceBinding = persistEvidence(root, candidateRoot, capabilityVersion, current.sequence + 1, targetState, evidence, recordedAtUtc);
  let verifiedRelease = null;
  if (targetState === "released") {
    assert(releaseBinding?.capabilityReleasePath && releaseBinding?.trustedReleaseRegistryPath, "trusted release binding is required");
    verifiedRelease = loadAndValidateReleasedCapabilityBinding({ projectRoot: root, ...releaseBinding });
    assert(verifiedRelease.release.modelCapabilityVersion === capabilityVersion, "release capability version mismatch");
  }
  const db = openDb(path.join(candidateRoot, "lifecycle.sqlite"));
  const sequence = current.sequence + 1;
  try {
    db.exec("BEGIN IMMEDIATE");
    const persisted = db.prepare("SELECT state FROM capabilities WHERE capability_version = ?").get(capabilityVersion);
    assert(persisted?.state === current.state, "capability persistent state conflict");
    db.prepare("UPDATE capabilities SET state = ?, updated_at_utc = ?, owner_response_required = 0 WHERE capability_version = ?").run(targetState, recordedAtUtc, capabilityVersion);
    db.prepare("INSERT INTO lifecycle_transitions(capability_version, sequence, from_state, to_state, recorded_at_utc, evidence_sha256) VALUES (?, ?, ?, ?, ?, ?)").run(capabilityVersion, sequence, current.state, targetState, recordedAtUtc, evidenceBinding.sha256);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; } finally { db.close(); }
  const next = { ...current, state: targetState, sequence, latestEvidence: evidenceBinding, releaseIdentity: verifiedRelease?.release.capabilityReleaseIdentity ?? current.releaseIdentity ?? null, ownerResponseRequired: false, updatedAtUtc: recordedAtUtc };
  writeAtomic(statePath, next);
  appendEvent(candidateRoot, next, recordedAtUtc);
  if (TERMINALS.has(targetState)) writeExclusive(path.join(candidateRoot, "phase-terminal.json"), next);
  return next;
}

function validateSpec(spec, root) {
  assert(spec?.schemaVersion === "ai-painter-capability-change-candidate-v1", "capability candidate schema mismatch");
  assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(spec.capabilityVersion ?? ""), "capabilityVersion is invalid");
  assert(["model_family", "training_paradigm", "review_contract", "program_lineage", "data_release", "runtime_interface", "infrastructure_non_semantic"].includes(spec.changeClass), "changeClass is invalid");
  assert(spec.ownerAuthorizationRequired === false && spec.ownerInLifecycle === false, "capability candidate cannot require Owner");
  assert(Array.isArray(spec.sourceEvidence) && spec.sourceEvidence.length > 0, "candidate source evidence is required");
  for (const binding of spec.sourceEvidence) verifyBinding(root, binding);
}

function persistEvidence(root, candidateRoot, capabilityVersion, sequence, targetState, evidence, recordedAtUtc) {
  assert(evidence?.schemaVersion === "ai-painter-capability-stage-evidence-v1", "stage evidence schema mismatch");
  assert(evidence.capabilityVersion === capabilityVersion && evidence.targetState === targetState, "stage evidence identity mismatch");
  assert(evidence.status === "passed" || targetState === "rejected" || targetState === "rolled_back", "non-terminal stage evidence must pass");
  assert(Array.isArray(evidence.bindings) && evidence.bindings.length > 0, "stage evidence bindings are required");
  for (const binding of evidence.bindings) verifyBinding(root, binding);
  const relative = `evidence/${String(sequence).padStart(3, "0")}-${targetState}.json`;
  const absolute = path.join(candidateRoot, ...relative.split("/"));
  writeExclusive(absolute, { ...evidence, ownerAuthorizationRequired: false, ownerResponseRequired: false, recordedAtUtc });
  return { path: relative, sha256: sha256File(absolute) };
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
function writeAtomic(file, value) { const temporary = `${file}.tmp-${process.pid}`; fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`); fs.renameSync(temporary, file); }
function writeExclusive(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function assert(condition, message) { if (!condition) throw new Error(message); }
