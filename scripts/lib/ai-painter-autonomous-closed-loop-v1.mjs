import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { persistPolicyBoundaryReport } from "./ai-painter-local-autonomy-governance-v3.mjs";

export const CLOSED_LOOP_CONTRACT_PATH =
  "data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json";
export const CURRENT_ENTRYPOINT_REGISTRY_PATH =
  "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json";
export const CLOSED_LOOP_ROOT = ".runtime/ai-painter/autonomous-closed-loop-executions";

const EXECUTION_LEASE_DIRECTORY = "execution-runner-lease";
const EXECUTION_LEASE_HISTORY_DIRECTORY = "execution-runner-lease-history";

export const PHASES = Object.freeze([
  "preflight", "execute", "validate", "review", "adjudicate", "finalize",
]);

const STATE_FOR_PHASE = Object.freeze({
  preflight: "preflight",
  execute: "executing",
  validate: "validating",
  review: "reviewing",
  adjudicate: "adjudicating",
  finalize: "finalizing",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  package_materialized: ["preflight", "failed_closed", "blocked_policy_boundary"],
  preflight: ["preflight", "executing", "failed_closed", "blocked_policy_boundary"],
  executing: ["executing", "validating", "failed_closed", "blocked_policy_boundary"],
  validating: ["validating", "reviewing", "failed_closed", "blocked_policy_boundary"],
  reviewing: ["reviewing", "adjudicating", "failed_closed", "blocked_policy_boundary"],
  adjudicating: ["adjudicating", "finalizing", "failed_closed", "blocked_policy_boundary"],
  finalizing: ["finalizing", "completed", "failed_closed", "blocked_policy_boundary"],
});

const TERMINAL_STATES = new Set(["completed", "failed_closed", "blocked_policy_boundary"]);
const FORBIDDEN_OWNER_TOKENS = [
  "waiting_owner_authorization", "waiting_owner_decision", "owner-action-request.json",
  "owner-decision-request.json", "owner_authorization_required", "owner_signature_required",
];

export function loadClosedLoopContract(root = process.cwd()) {
  const evidence = readBoundJson(root, CLOSED_LOOP_CONTRACT_PATH);
  const value = evidence.value;
  assert(value?.schemaVersion === "ai-painter-autonomous-closed-loop-contract-v1", "closed-loop contract schema mismatch");
  assert(value?.status === "active", "closed-loop contract is not active");
  assert(value?.authority === "local_ai_pet_world_program", "local AI authority mismatch");
  assert(value?.ownerInNormalStateMachine === false, "Owner must not be in the normal state machine");
  assert(value?.perTaskOwnerAuthorizationRequired === false, "per-task Owner authorization must be false");
  assert(value?.perStageOwnerAuthorizationRequired === false, "per-stage Owner authorization must be false");
  assert(canonical(value.normalPhaseOrder) === canonical(PHASES), "closed-loop phase order mismatch");
  assert(value?.terminalRules?.ownerWaitStateAllowed === false, "Owner wait states must be forbidden");
  assert(value?.terminalRules?.ownerRequestArtifactAllowed === false, "Owner request artifacts must be forbidden");
  return evidence;
}

export function validateClosedLoopPackage(spec, { root = process.cwd(), packageSha256 } = {}) {
  loadClosedLoopContract(root);
  assert(spec?.schemaVersion === "ai-painter-autonomous-closed-loop-package-v1", "package schema mismatch");
  assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(spec.packageIdentity ?? ""), "package identity is invalid");
  assertHex(packageSha256, "package SHA-256");
  assert(typeof spec.capabilityVersion === "string" && spec.capabilityVersion.length >= 3, "capabilityVersion is invalid");
  assert(spec.ownerAuthorizationRequired === false, "closed-loop package cannot require Owner authorization");
  assert(spec.ownerInStateMachine === false, "closed-loop package cannot place Owner in its state machine");
  assert(Number.isInteger(spec.maxInfrastructureRecoveryAttempts) && spec.maxInfrastructureRecoveryAttempts >= 0 && spec.maxInfrastructureRecoveryAttempts <= 3, "infrastructure recovery limit is invalid");
  validateRelativeRuntimeRoot(spec.outputRoot, "outputRoot");
  assert(spec.programLineage && Object.keys(spec.programLineage).length > 0, "programLineage is required");
  for (const [role, digest] of Object.entries(spec.programLineage)) {
    assert(/^[A-Za-z0-9._-]+$/.test(role), "programLineage role is invalid");
    assertHex(digest, `programLineage.${role}`);
  }
  assert(Array.isArray(spec.inputEvidence) && spec.inputEvidence.length > 0, "inputEvidence is required");
  for (const evidence of spec.inputEvidence) verifyBoundFile(root, evidence);
  assert(spec.phaseAdapters && typeof spec.phaseAdapters === "object", "phaseAdapters are required");
  assert(canonical(Object.keys(spec.phaseAdapters).sort()) === canonical([...PHASES].sort()), "phase adapter set mismatch");
  const serialized = JSON.stringify(spec).toLowerCase();
  for (const token of FORBIDDEN_OWNER_TOKENS) assert(!serialized.includes(token), `forbidden Owner runtime token: ${token}`);
  for (const phase of PHASES) validateAdapterBinding(root, phase, spec.phaseAdapters[phase]);
  const canonicalPackageSha256 = sha256(Buffer.from(`${JSON.stringify(spec, null, 2)}\n`, "utf8"));
  assert(canonicalPackageSha256 === packageSha256, "package SHA-256 does not bind the supplied package bytes");
  return true;
}

export async function loadPhaseAdapters(spec, { root = process.cwd() } = {}) {
  const adapters = {};
  for (const phase of PHASES) {
    const binding = spec.phaseAdapters[phase];
    const absolutePath = resolveExistingProjectFile(root, binding.path);
    assert(sha256File(absolutePath) === binding.sha256, `${phase} adapter SHA-256 mismatch`);
    const module = await import(`${pathToFileURL(absolutePath).href}?sha256=${binding.sha256}`);
    const adapter = module[binding.exportName];
    assert(typeof adapter === "function", `${phase} adapter export is not a function`);
    adapters[phase] = adapter;
  }
  return adapters;
}

export function createExecutionStore({ root = process.cwd(), spec, packageSha256, now = new Date().toISOString() }) {
  validateClosedLoopPackage(spec, { root, packageSha256 });
  const executionRoot = resolveInsideRoot(root, `${CLOSED_LOOP_ROOT}/${spec.packageIdentity}`);
  fs.mkdirSync(path.dirname(executionRoot), { recursive: true });
  assert(!fs.existsSync(executionRoot), "closed-loop execution already exists");
  fs.mkdirSync(executionRoot, { recursive: false });
  fs.mkdirSync(path.join(executionRoot, "phase-evidence"), { recursive: false });
  const sqlitePath = path.join(executionRoot, "execution.sqlite");
  const db = openDatabase(sqlitePath);
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare(`INSERT INTO executions(package_identity, package_sha256, capability_version, state, phase, created_at_utc, updated_at_utc, owner_response_required) VALUES (?, ?, ?, 'package_materialized', NULL, ?, ?, 0)`).run(
      spec.packageIdentity, packageSha256, spec.capabilityVersion, now, now,
    );
    db.prepare(`INSERT INTO transitions(package_identity, sequence, from_state, to_state, phase, recorded_at_utc, evidence_sha256) VALUES (?, 0, NULL, 'package_materialized', NULL, ?, NULL)`).run(spec.packageIdentity, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  db.close();
  const state = buildState(spec, packageSha256, "package_materialized", null, 0, now, null);
  writeJsonAtomic(path.join(executionRoot, "execution-state.json"), state);
  writeJsonAtomic(path.join(executionRoot, "progress.json"), buildProgress(state, 0));
  appendEvent(executionRoot, state, null, now);
  writeTaskCapsule(executionRoot, state);
  return { executionRoot, sqlitePath, state };
}

export function readExecutionState({ root = process.cwd(), packageIdentity }) {
  const executionRoot = resolveInsideRoot(root, `${CLOSED_LOOP_ROOT}/${packageIdentity}`);
  const statePath = path.join(executionRoot, "execution-state.json");
  assert(fs.existsSync(statePath), "execution state does not exist");
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

export function openExecutionStore({ root = process.cwd(), spec, packageSha256 }) {
  const store = readExistingExecutionStore({ root, spec, packageSha256 });
  return { ...store, continuity: auditExecutionContinuity(store, spec, store.state) };
}

function readExistingExecutionStore({ root = process.cwd(), spec, packageSha256 }) {
  const store = locateExistingExecutionStore({ root, spec, packageSha256 });
  const { sqlitePath, state } = store;
  const db = openDatabase(sqlitePath);
  try {
    const persisted = db.prepare("SELECT package_sha256, capability_version, state, phase, owner_response_required FROM executions WHERE package_identity = ?").get(spec.packageIdentity);
    assert(persisted, "persistent execution record is missing");
    assert(persisted.package_sha256 === packageSha256, "persistent package SHA-256 mismatch");
    assert(persisted.capability_version === spec.capabilityVersion, "persistent capability version mismatch");
    assert(persisted.state === state.state && persisted.phase === state.phase, "persistent execution state conflict");
    assert(persisted.owner_response_required === 0, "persistent execution cannot wait for Owner");
  } finally { db.close(); }
  return store;
}

function locateExistingExecutionStore({ root = process.cwd(), spec, packageSha256 }) {
  validateClosedLoopPackage(spec, { root, packageSha256 });
  const executionRoot = resolveInsideRoot(root, `${CLOSED_LOOP_ROOT}/${spec.packageIdentity}`);
  assert(fs.existsSync(executionRoot) && fs.statSync(executionRoot).isDirectory(), "closed-loop execution does not exist");
  const phaseEvidenceRoot = path.join(executionRoot, "phase-evidence");
  const sqlitePath = path.join(executionRoot, "execution.sqlite");
  const statePath = path.join(executionRoot, "execution-state.json");
  assert(fs.existsSync(phaseEvidenceRoot) && fs.statSync(phaseEvidenceRoot).isDirectory(), "closed-loop phase evidence directory is missing");
  assert(fs.existsSync(sqlitePath) && fs.statSync(sqlitePath).isFile(), "closed-loop SQLite state is missing");
  assert(fs.existsSync(statePath) && fs.statSync(statePath).isFile(), "closed-loop execution state is missing");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert(state?.schemaVersion === "ai-painter-autonomous-execution-state-v1", "execution state schema mismatch");
  assert(state.packageIdentity === spec.packageIdentity, "execution package identity mismatch");
  assert(state.packageSha256 === packageSha256, "execution package SHA-256 mismatch");
  assert(state.capabilityVersion === spec.capabilityVersion, "execution capability version mismatch");
  assert(state.ownerAuthorizationRequired === false && state.ownerResponseRequired === false, "execution cannot wait for Owner");
  return { executionRoot, sqlitePath, state, resumed: true };
}

export async function runAutonomousClosedLoop({
  root = process.cwd(), spec, packageSha256, adapters, now = () => new Date().toISOString(),
}) {
  validateClosedLoopPackage(spec, { root, packageSha256 });
  if (adapters) assert(canonical(Object.keys(adapters).sort()) === canonical([...PHASES].sort()), "runtime adapter set mismatch");
  const executionRoot = resolveInsideRoot(root, `${CLOSED_LOOP_ROOT}/${spec.packageIdentity}`);
  let store = fs.existsSync(executionRoot)
    ? locateExistingExecutionStore({ root, spec, packageSha256 })
    : createExecutionStore({ root, spec, packageSha256, now: now() });
  const lease = acquireExecutionLease(store, spec, now());
  try {
    const loadedAdapters = adapters ?? await loadPhaseAdapters(spec, { root });
    assert(canonical(Object.keys(loadedAdapters).sort()) === canonical([...PHASES].sort()), "runtime adapter set mismatch");
    if (store.resumed) store = openExecutionStore({ root, spec, packageSha256 });
    let state = store.state;
    let continuity = auditExecutionContinuity(store, spec, state);
    state = repairRecoverablePassedPrefix(store, spec, state, continuity, now());
    continuity = auditExecutionContinuity(store, spec, state);
    const context = Object.freeze({
      projectRoot: path.resolve(root), packageIdentity: spec.packageIdentity,
      capabilityVersion: spec.capabilityVersion, outputRoot: spec.outputRoot,
      executionRoot: store.executionRoot, inputEvidence: structuredClone(spec.inputEvidence),
    });

    if (TERMINAL_STATES.has(state.state)) {
      ensureTerminalEvidence(store, spec, state, continuity, now());
      return state;
    }
    const startIndex = state.state === "package_materialized"
      ? 0
      : PHASES.indexOf(state.phase);
    assert(startIndex >= 0, "resumable execution phase is invalid");
    assert(state.state === "package_materialized" || STATE_FOR_PHASE[state.phase] === state.state, "resumable execution state/phase mismatch");

    for (let index = startIndex; index < PHASES.length; index += 1) {
      const phase = PHASES[index];
      if (state.state !== STATE_FOR_PHASE[phase] || state.phase !== phase) {
        state = transition(store, spec, state, STATE_FOR_PHASE[phase], phase, null, now());
      }
      const persisted = reconcilePersistedPhaseOutcome({ root, store, spec, state, phase, now });
      state = persisted.state;
      if (persisted.terminal) return state;
      if (persisted.completed) continue;
      let attempt = nextPhaseAttempt(store.executionRoot, phase);
      let recoveryAttempt = Number.isInteger(state.recoveryAttempt) ? state.recoveryAttempt : 0;
      while (true) {
        if (phase === "review" && !fs.existsSync(path.join(store.executionRoot, "review-state.json"))) {
          recordReviewState(store, spec, "review_pending", now());
          recordReviewState(store, spec, "review_running", now());
        }
        const heartbeatAtUtc = now();
        refreshExecutionLease(store, lease, heartbeatAtUtc);
        writeJsonAtomic(path.join(store.executionRoot, "heartbeat.json"), {
          schemaVersion: "ai-painter-autonomous-heartbeat-v1", packageIdentity: spec.packageIdentity,
          phase, attempt, state: state.state, heartbeatAtUtc,
        });
        let result;
        try {
          const runtimeContext = createAdapterRuntimeContext({ context, store, spec, state, phase, attempt, now, lease });
          result = await loadedAdapters[phase](runtimeContext);
        } catch (error) {
          result = { status: "failed", failureKind: "program", failureCode: "adapter_exception", detail: String(error?.stack ?? error) };
        }
        validateAdapterResult(result, phase);
        const evidence = persistPhaseEvidence(store.executionRoot, phase, attempt, result, now());
        const infrastructureRetryPending = result.status === "failed" && result.failureKind === "infrastructure" && recoveryAttempt < spec.maxInfrastructureRecoveryAttempts;
        if (phase === "review" && !infrastructureRetryPending) {
          recordCompletedReviewState(store, spec, result, evidence, now());
        }
        if (result.status === "passed") {
          state = updateEvidence(store, spec, state, evidence, now());
          break;
        }
        if (result.failureKind === "infrastructure" && recoveryAttempt < spec.maxInfrastructureRecoveryAttempts) {
          recoveryAttempt += 1;
          attempt += 1;
          state = recordRecovery(store, spec, state, phase, recoveryAttempt, evidence, now());
          continue;
        }
        return closeFromFailedEvidence({ root, store, spec, state, phase, result, evidence, now });
      }
    }
    state = transition(store, spec, state, "completed", "finalize", state.latestEvidence, now());
    persistTerminal(store.executionRoot, spec, state, { status: "passed", decision: "completed" }, state.latestEvidence, now());
    return state;
  } finally {
    releaseExecutionLease(store, lease, now());
  }
}

function auditExecutionContinuity(store, spec, state) {
  const db = openDatabase(store.sqlitePath);
  let persisted;
  let transitions;
  let artifacts;
  let recoveries;
  try {
    persisted = db.prepare("SELECT * FROM executions WHERE package_identity = ?").get(spec.packageIdentity);
    transitions = db.prepare("SELECT * FROM transitions WHERE package_identity = ? ORDER BY sequence").all(spec.packageIdentity);
    artifacts = db.prepare("SELECT * FROM artifacts WHERE package_identity = ? ORDER BY phase, attempt").all(spec.packageIdentity);
    recoveries = db.prepare("SELECT * FROM recoveries WHERE package_identity = ? ORDER BY phase, attempt").all(spec.packageIdentity);
  } finally { db.close(); }
  assert(persisted, "persistent execution record is missing");
  assert(transitions.length > 0, "persistent transition history is missing");
  assert(transitions[0].sequence === 0 && transitions[0].from_state === null && transitions[0].to_state === "package_materialized" && transitions[0].phase === null, "transition history origin is invalid");
  let previous = null;
  for (let index = 0; index < transitions.length; index += 1) {
    const row = transitions[index];
    assert(row.sequence === index, "transition sequence is not contiguous");
    if (index > 0) {
      assert(row.from_state === previous.to_state, "transition state chain is not contiguous");
      assert(ALLOWED_TRANSITIONS[row.from_state]?.includes(row.to_state), "transition history contains an invalid transition");
      if (STATE_FOR_PHASE[row.phase]) assert(STATE_FOR_PHASE[row.phase] === row.to_state || TERMINAL_STATES.has(row.to_state), "transition phase/state identity mismatch");
    }
    previous = row;
  }
  assert(previous.to_state === persisted.state && previous.phase === persisted.phase, "persistent transition tail conflicts with execution state");
  assert(state.sequence === previous.sequence, "execution JSON sequence conflicts with SQLite");
  assert(state.state === persisted.state && state.phase === persisted.phase, "execution JSON state conflicts with SQLite");
  assert(state.failureCode === (persisted.failure_code ?? null), "execution failure code conflicts with SQLite");

  const evidenceByPhase = readPhaseEvidenceRecords(store.executionRoot);
  const artifactByPhase = new Map();
  for (const artifact of artifacts) {
    assert(PHASES.includes(artifact.phase), "artifact phase is invalid");
    assert(!artifactByPhase.has(artifact.phase), "multiple passed artifacts exist for one phase");
    const record = evidenceByPhase.get(artifact.phase)?.find((entry) => entry.attempt === artifact.attempt);
    assert(record, "artifact does not bind an existing phase evidence file");
    assert(record.path === artifact.logical_path && record.sha256 === artifact.sha256, "artifact binding does not match phase evidence");
    assert(record.payload.result.status === "passed", "artifact cannot bind failed phase evidence");
    artifactByPhase.set(artifact.phase, artifact);
  }

  const recoveryByPhase = new Map();
  for (const recovery of recoveries) {
    assert(PHASES.includes(recovery.phase), "recovery phase is invalid");
    const rows = recoveryByPhase.get(recovery.phase) ?? [];
    assert(recovery.attempt === rows.length + 1, "recovery attempt sequence is not contiguous");
    const record = evidenceByPhase.get(recovery.phase)?.find((entry) => entry.sha256 === recovery.failure_evidence_sha256);
    assert(record?.payload?.result?.status === "failed" && record.payload.result.failureKind === "infrastructure", "recovery must bind infrastructure failure evidence");
    rows.push(recovery);
    recoveryByPhase.set(recovery.phase, rows);
  }

  let currentIndex = -1;
  let requiredPassedCount = 0;
  if (state.state === "package_materialized") {
    assert(state.phase === null, "materialized execution cannot have a phase");
    assert(artifacts.length === 0 && recoveries.length === 0, "materialized execution cannot have artifact or recovery records");
    for (const records of evidenceByPhase.values()) assert(records.length === 0, "materialized execution cannot have phase evidence");
  } else {
    currentIndex = PHASES.indexOf(state.phase);
    assert(currentIndex >= 0, "execution phase is invalid");
    if (!TERMINAL_STATES.has(state.state)) assert(STATE_FOR_PHASE[state.phase] === state.state, "execution state/phase mismatch");
    requiredPassedCount = state.state === "completed" ? PHASES.length : currentIndex;
  }

  const recoverablePassedArtifacts = [];
  for (let index = 0; index < PHASES.length; index += 1) {
    const phase = PHASES[index];
    const records = evidenceByPhase.get(phase) ?? [];
    const firstPassedIndex = records.findIndex((entry) => entry.payload.result.status === "passed");
    if (firstPassedIndex >= 0) assert(firstPassedIndex === records.length - 1, "phase evidence exists after a passed result");
    if (index < requiredPassedCount) {
      const passed = records.at(-1);
      assert(passed?.payload?.result?.status === "passed", `completed phase lacks passed evidence: ${phase}`);
      const artifact = artifactByPhase.get(phase);
      if (artifact) assert(artifact.attempt === passed.attempt && artifact.sha256 === passed.sha256, `completed phase artifact is stale: ${phase}`);
      else recoverablePassedArtifacts.push(passed);
    }
    if (currentIndex >= 0 && index > currentIndex) assert(records.length === 0, "future phase evidence exists before the phase transition");
  }

  if (!TERMINAL_STATES.has(state.state) && state.state !== "package_materialized") {
    const currentRecoveryCount = (recoveryByPhase.get(state.phase) ?? []).length;
    assert(currentRecoveryCount <= spec.maxInfrastructureRecoveryAttempts, "persistent recovery count exceeds package limit");
    assert(state.recoveryAttempt === currentRecoveryCount, "execution recoveryAttempt conflicts with SQLite recoveries");
    for (let index = currentIndex + 1; index < PHASES.length; index += 1) {
      assert((recoveryByPhase.get(PHASES[index]) ?? []).length === 0, "future phase recovery exists before phase transition");
    }
  }
  if (state.latestEvidence !== null) {
    const bound = evidenceByPhase.get(state.latestEvidence.phase)?.find((entry) => entry.attempt === state.latestEvidence.attempt);
    assert(bound && bound.path === state.latestEvidence.path && bound.sha256 === state.latestEvidence.sha256, "execution latestEvidence binding is invalid");
  }
  if (state.state === "completed") {
    const finalRecord = evidenceByPhase.get("finalize")?.at(-1);
    assert(finalRecord?.payload?.result?.status === "passed", "completed execution lacks passed finalize evidence");
  } else if (state.state === "failed_closed" || state.state === "blocked_policy_boundary") {
    const failed = evidenceByPhase.get(state.phase)?.at(-1);
    assert(failed?.payload?.result?.status === "failed", "failed terminal execution lacks failed phase evidence");
    assert(failed.sha256 === state.latestEvidence?.sha256, "failed terminal does not bind its failure evidence");
    assert(failed.payload.result.failureCode === state.failureCode, "failed terminal code conflicts with bound evidence");
  }
  return { evidenceByPhase, artifactByPhase, recoveryByPhase, recoverablePassedArtifacts };
}

function readPhaseEvidenceRecords(executionRoot) {
  const evidenceRoot = path.join(executionRoot, "phase-evidence");
  const byPhase = new Map(PHASES.map((phase) => [phase, []]));
  for (const entry of fs.readdirSync(evidenceRoot)) {
    const match = /^(preflight|execute|validate|review|adjudicate|finalize)-attempt-(\d+)\.json$/u.exec(entry);
    assert(match, `unknown phase evidence entry: ${entry}`);
    const phase = match[1];
    const attempt = Number(match[2]);
    assert(Number.isSafeInteger(attempt) && attempt >= 0, "phase evidence attempt is invalid");
    const absolute = path.join(evidenceRoot, entry);
    assert(fs.statSync(absolute).isFile(), "phase evidence entry must be a file");
    const payload = JSON.parse(fs.readFileSync(absolute, "utf8"));
    assert(payload?.schemaVersion === "ai-painter-autonomous-phase-evidence-v1", "phase evidence schema mismatch");
    assert(payload.phase === phase && payload.attempt === attempt, "phase evidence identity mismatch");
    validateAdapterResult(payload.result, phase);
    byPhase.get(phase).push({ phase, attempt, path: `phase-evidence/${entry}`, sha256: sha256File(absolute), payload });
  }
  for (const records of byPhase.values()) {
    records.sort((left, right) => left.attempt - right.attempt);
    for (let index = 1; index < records.length; index += 1) assert(records[index].attempt > records[index - 1].attempt, "duplicate phase evidence attempt");
  }
  return byPhase;
}

function repairRecoverablePassedPrefix(store, spec, state, continuity, recordedAtUtc) {
  for (const evidence of continuity.recoverablePassedArtifacts) {
    registerPassedArtifact(store, spec, evidence, recordedAtUtc);
    appendRecoveryAudit(store.executionRoot, "passed_phase_artifact_recovered", recordedAtUtc, { phase: evidence.phase, attempt: evidence.attempt, evidenceSha256: evidence.sha256 });
  }
  return state;
}

function reconcilePersistedPhaseOutcome({ root, store, spec, state, phase, now }) {
  const continuity = auditExecutionContinuity(store, spec, state);
  const records = continuity.evidenceByPhase.get(phase) ?? [];
  if (records.length === 0) return { state, completed: false, terminal: false };
  const evidence = records.at(-1);
  const result = evidence.payload.result;
  if (result.status === "passed") {
    registerPassedArtifact(store, spec, evidence, now());
    const next = { ...state, latestEvidence: evidenceBinding(evidence), updatedAtUtc: now() };
    writeJsonAtomic(path.join(store.executionRoot, "execution-state.json"), next);
    if (phase === "review") ensureCompletedReviewState(store, spec, result, evidenceBinding(evidence), now());
    appendRecoveryAudit(store.executionRoot, "passed_phase_recovered_without_adapter_replay", now(), { phase, attempt: evidence.attempt, evidenceSha256: evidence.sha256 });
    return { state: next, completed: true, terminal: false };
  }
  if (result.failureKind === "infrastructure") {
    const recoveryRows = continuity.recoveryByPhase.get(phase) ?? [];
    const alreadyRecorded = recoveryRows.some((row) => row.failure_evidence_sha256 === evidence.sha256);
    if (alreadyRecorded) return { state, completed: false, terminal: false };
    if (state.recoveryAttempt < spec.maxInfrastructureRecoveryAttempts) {
      const next = recordRecovery(store, spec, state, phase, state.recoveryAttempt + 1, evidenceBinding(evidence), now());
      appendRecoveryAudit(store.executionRoot, "infrastructure_recovery_commit_repaired", now(), { phase, attempt: evidence.attempt, evidenceSha256: evidence.sha256 });
      return { state: next, completed: false, terminal: false };
    }
  }
  if (phase === "review") ensureCompletedReviewState(store, spec, result, evidenceBinding(evidence), now());
  const terminalState = closeFromFailedEvidence({ root, store, spec, state, phase, result, evidence: evidenceBinding(evidence), now });
  return { state: terminalState, completed: false, terminal: true };
}

function registerPassedArtifact(store, spec, evidence, recordedAtUtc) {
  assert(evidence.payload.result.status === "passed", "only passed phase evidence can be registered as an artifact");
  const db = openDatabase(store.sqlitePath);
  try {
    db.exec("BEGIN IMMEDIATE");
    const existing = db.prepare("SELECT attempt, logical_path, sha256 FROM artifacts WHERE package_identity = ? AND phase = ?").get(spec.packageIdentity, evidence.phase);
    if (existing) {
      assert(existing.attempt === evidence.attempt && existing.logical_path === evidence.path && existing.sha256 === evidence.sha256, "passed artifact conflicts with persisted evidence");
    } else {
      db.prepare("INSERT INTO artifacts(package_identity, phase, attempt, logical_path, sha256, recorded_at_utc) VALUES (?, ?, ?, ?, ?, ?)").run(
        spec.packageIdentity, evidence.phase, evidence.attempt, evidence.path, evidence.sha256, recordedAtUtc,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally { db.close(); }
}

function evidenceBinding(evidence) {
  return { phase: evidence.phase, attempt: evidence.attempt, path: evidence.path, sha256: evidence.sha256 };
}

function closeFromFailedEvidence({ root, store, spec, state, phase, result, evidence, now }) {
  const terminal = result.failureKind === "policy_boundary" ? "blocked_policy_boundary" : "failed_closed";
  const next = transition(store, spec, state, terminal, phase, evidence, now(), result.failureCode);
  let policyBoundaryReport = null;
  if (terminal === "blocked_policy_boundary") {
    policyBoundaryReport = persistPolicyBoundaryReport({
      schemaVersion: "ai-painter-policy-boundary-report-input-v1",
      reportId: `${spec.packageIdentity}-${phase}-policy-boundary`,
      boundaryClass: result.boundaryClass,
      failureCode: result.failureCode,
      summaryZh: result.summaryZh,
      safeAlternative: result.safeAlternative ?? null,
      evidencePaths: [`${CLOSED_LOOP_ROOT}/${spec.packageIdentity}/${evidence.path}`],
    }, { root, recordedAtUtc: now() });
  }
  persistTerminal(store.executionRoot, spec, next, { ...result, policyBoundaryReport }, evidence, now());
  return next;
}

function ensureTerminalEvidence(store, spec, state, continuity, recordedAtUtc) {
  const terminalPath = path.join(store.executionRoot, "phase-terminal.json");
  if (fs.existsSync(terminalPath)) {
    const terminal = JSON.parse(fs.readFileSync(terminalPath, "utf8"));
    assert(terminal?.schemaVersion === "ai-painter-autonomous-closed-loop-terminal-v1", "terminal schema mismatch");
    assert(terminal.packageIdentity === spec.packageIdentity && terminal.status === state.state, "terminal identity/state mismatch");
    assert(terminal.ownerAuthorizationRequired === false && terminal.ownerResponseRequired === false, "terminal cannot wait for Owner");
    assert(terminal.latestEvidence?.sha256 === state.latestEvidence?.sha256, "terminal evidence binding mismatch");
    return;
  }
  const record = continuity.evidenceByPhase.get(state.phase)?.find((entry) => entry.sha256 === state.latestEvidence?.sha256);
  assert(record, "terminal self-recovery lacks bound phase evidence");
  const finalResult = state.state === "completed"
    ? { status: "passed", decision: "completed", recoveredFromBoundEvidence: true }
    : { ...record.payload.result, recoveredFromBoundEvidence: true };
  persistTerminal(store.executionRoot, spec, state, finalResult, state.latestEvidence, recordedAtUtc);
  appendRecoveryAudit(store.executionRoot, "terminal_recovered_from_bound_evidence", recordedAtUtc, { state: state.state, evidenceSha256: state.latestEvidence.sha256 });
}

function recordCompletedReviewState(store, spec, result, evidence, recordedAtUtc) {
  const reviewState = result.status === "passed"
    ? (result.reviewOutcome === "machine_reviews_failed" ? "review_completed_with_failed_result" : "review_passed")
    : result.failureKind === "evidence" ? "review_evidence_conflict" : "review_failed";
  ensureCompletedReviewState(store, spec, result, evidence, recordedAtUtc, reviewState);
}

function ensureCompletedReviewState(store, spec, result, evidence, recordedAtUtc, expectedState = null) {
  const reviewState = expectedState ?? (result.status === "passed"
    ? (result.reviewOutcome === "machine_reviews_failed" ? "review_completed_with_failed_result" : "review_passed")
    : result.failureKind === "evidence" ? "review_evidence_conflict" : "review_failed");
  const statePath = path.join(store.executionRoot, "review-state.json");
  if (fs.existsSync(statePath)) {
    const current = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (current.state === reviewState && current.evidenceSha256 === evidence.sha256) return;
    assert(["review_pending", "review_running"].includes(current.state), "completed review state conflicts with recovered result");
  }
  recordReviewState(store, spec, reviewState, recordedAtUtc, evidence.sha256);
}

function appendRecoveryAudit(executionRoot, action, recordedAtUtc, detail) {
  fs.appendFileSync(path.join(executionRoot, "execution-recovery-audit.jsonl"), `${JSON.stringify({
    schemaVersion: "ai-painter-autonomous-execution-recovery-audit-v1", action, recordedAtUtc, ...detail,
  })}\n`, "utf8");
}

function acquireExecutionLease(store, spec, recordedAtUtc) {
  const lockPath = path.join(store.executionRoot, EXECUTION_LEASE_DIRECTORY);
  const historyRoot = path.join(store.executionRoot, EXECUTION_LEASE_HISTORY_DIRECTORY);
  fs.mkdirSync(historyRoot, { recursive: true });
  let takeover = null;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const token = crypto.randomBytes(16).toString("hex");
    const candidatePath = `${lockPath}.candidate-${process.pid}-${token}`;
    const lease = {
      schemaVersion: "ai-painter-autonomous-execution-lease-v1",
      packageIdentity: spec.packageIdentity,
      token, pid: process.pid, hostname: os.hostname(), acquiredAtUtc: recordedAtUtc,
      heartbeatAtUtc: recordedAtUtc, takeover,
    };
    fs.mkdirSync(candidatePath, { recursive: false });
    writeJsonExclusive(path.join(candidatePath, "lease.json"), lease);
    try {
      fs.renameSync(candidatePath, lockPath);
      appendLeaseHistory(store.executionRoot, "lease_acquired", recordedAtUtc, lease);
      return lease;
    } catch (error) {
      fs.rmSync(candidatePath, { recursive: true, force: true });
      if (!fs.existsSync(lockPath)) continue;
      const existing = readExecutionLease(lockPath, spec.packageIdentity);
      if (existing.hostname !== os.hostname()) throw new Error("closed-loop execution lease belongs to another host");
      if (isProcessAlive(existing.pid)) throw new Error(`closed-loop execution already has an active runner PID ${existing.pid}`);
      const archiveName = `stale-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      const archivePath = path.join(historyRoot, archiveName);
      try {
        fs.renameSync(lockPath, archivePath);
      } catch (takeoverError) {
        if (!fs.existsSync(lockPath)) continue;
        throw takeoverError;
      }
      const archivedLeasePath = path.join(archivePath, "lease.json");
      const archivedSha256 = sha256File(archivedLeasePath);
      takeover = {
        staleLeaseArchive: `${EXECUTION_LEASE_HISTORY_DIRECTORY}/${archiveName}/lease.json`,
        staleLeaseSha256: archivedSha256, stalePid: existing.pid,
      };
      writeJsonExclusive(path.join(archivePath, "takeover.json"), {
        schemaVersion: "ai-painter-autonomous-execution-lease-takeover-v1",
        packageIdentity: spec.packageIdentity, staleLeaseSha256: archivedSha256,
        stalePid: existing.pid, replacementPid: process.pid, recordedAtUtc,
      });
      appendLeaseHistory(store.executionRoot, "stale_lease_archived_for_takeover", recordedAtUtc, takeover);
    }
  }
  throw new Error("closed-loop execution lease acquisition did not converge");
}

function readExecutionLease(lockPath, packageIdentity) {
  const leasePath = path.join(lockPath, "lease.json");
  assert(fs.existsSync(leasePath) && fs.statSync(leasePath).isFile(), "closed-loop execution lease is incomplete");
  const lease = JSON.parse(fs.readFileSync(leasePath, "utf8"));
  assert(lease?.schemaVersion === "ai-painter-autonomous-execution-lease-v1", "closed-loop execution lease schema mismatch");
  assert(lease.packageIdentity === packageIdentity, "closed-loop execution lease package mismatch");
  assert(typeof lease.token === "string" && /^[a-f0-9]{32}$/u.test(lease.token), "closed-loop execution lease token is invalid");
  assert(Number.isInteger(lease.pid) && lease.pid > 0, "closed-loop execution lease PID is invalid");
  assert(typeof lease.hostname === "string" && lease.hostname.length > 0, "closed-loop execution lease hostname is invalid");
  return lease;
}

function refreshExecutionLease(store, lease, recordedAtUtc) {
  const lockPath = path.join(store.executionRoot, EXECUTION_LEASE_DIRECTORY);
  const current = readExecutionLease(lockPath, lease.packageIdentity);
  assert(current.token === lease.token && current.pid === process.pid, "closed-loop execution lease ownership changed");
  writeJsonAtomic(path.join(lockPath, "lease.json"), { ...current, heartbeatAtUtc: recordedAtUtc });
}

function releaseExecutionLease(store, lease, recordedAtUtc) {
  const lockPath = path.join(store.executionRoot, EXECUTION_LEASE_DIRECTORY);
  if (!fs.existsSync(lockPath)) return;
  const current = readExecutionLease(lockPath, lease.packageIdentity);
  assert(current.token === lease.token && current.pid === process.pid, "cannot release a foreign execution lease");
  appendLeaseHistory(store.executionRoot, "lease_released", recordedAtUtc, {
    packageIdentity: lease.packageIdentity, token: lease.token, pid: process.pid,
  });
  fs.rmSync(lockPath, { recursive: true, force: false });
}

function appendLeaseHistory(executionRoot, action, recordedAtUtc, detail) {
  fs.appendFileSync(path.join(executionRoot, "execution-lease-history.jsonl"), `${JSON.stringify({
    schemaVersion: "ai-painter-autonomous-execution-lease-history-v1", action, recordedAtUtc, detail,
  })}\n`, "utf8");
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function nextPhaseAttempt(executionRoot, phase) {
  const escapedPhase = phase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(`^${escapedPhase}-attempt-(\\d+)\\.json$`, "u");
  let maximum = -1;
  for (const entry of fs.readdirSync(path.join(executionRoot, "phase-evidence"))) {
    const match = pattern.exec(entry);
    if (match) maximum = Math.max(maximum, Number(match[1]));
  }
  return maximum + 1;
}

function createAdapterRuntimeContext({ context, store, spec, state, phase, attempt, now, lease }) {
  const writeHeartbeat = (adapterProgress = null) => {
    const heartbeatAtUtc = now();
    refreshExecutionLease(store, lease, heartbeatAtUtc);
    writeJsonAtomic(path.join(store.executionRoot, "heartbeat.json"), {
      schemaVersion: "ai-painter-autonomous-heartbeat-v1", packageIdentity: spec.packageIdentity,
      phase, attempt, state: state.state, adapterProgress, heartbeatAtUtc,
    });
    return heartbeatAtUtc;
  };
  const reportProgress = (value) => {
    const adapterProgress = validateAdapterProgress(value);
    const updatedAtUtc = writeHeartbeat(adapterProgress);
    const current = JSON.parse(fs.readFileSync(path.join(store.executionRoot, "progress.json"), "utf8"));
    writeJsonAtomic(path.join(store.executionRoot, "progress.json"), {
      ...current, adapterProgress, updatedAtUtc,
    });
    return adapterProgress;
  };
  return Object.freeze({ ...context, phase, attempt, heartbeat: () => writeHeartbeat(), reportProgress });
}

function validateAdapterProgress(value) {
  assert(value && typeof value === "object" && !Array.isArray(value), "adapter progress must be an object");
  const allowed = new Set(["phasePercent", "epoch", "epochTarget", "optimizerStep", "optimizerStepTarget", "etaSeconds", "message", "metrics"]);
  for (const key of Object.keys(value)) assert(allowed.has(key), `unknown adapter progress field: ${key}`);
  const numeric = ["phasePercent", "epoch", "epochTarget", "optimizerStep", "optimizerStepTarget", "etaSeconds"];
  for (const key of numeric) if (value[key] !== undefined) assert(Number.isFinite(value[key]) && value[key] >= 0, `adapter progress ${key} must be finite and non-negative`);
  if (value.phasePercent !== undefined) assert(value.phasePercent <= 100, "adapter progress phasePercent cannot exceed 100");
  if (value.message !== undefined) assert(typeof value.message === "string" && value.message.length <= 512, "adapter progress message is invalid");
  if (value.metrics !== undefined) {
    assert(value.metrics && typeof value.metrics === "object" && !Array.isArray(value.metrics), "adapter progress metrics must be an object");
    for (const [key, metric] of Object.entries(value.metrics)) {
      assert(/^[A-Za-z0-9_.-]{1,80}$/u.test(key), "adapter progress metric name is invalid");
      assert(Number.isFinite(metric), `adapter progress metric ${key} must be finite`);
    }
  }
  return structuredClone(value);
}

function transition(store, spec, state, toState, phase, evidence, recordedAtUtc, failureCode = null) {
  assert(!TERMINAL_STATES.has(state.state), "terminal execution cannot transition");
  assert(ALLOWED_TRANSITIONS[state.state]?.includes(toState), `invalid transition ${state.state} -> ${toState}`);
  const sequence = state.sequence + 1;
  const db = openDatabase(store.sqlitePath);
  try {
    db.exec("BEGIN IMMEDIATE");
    const current = db.prepare("SELECT state FROM executions WHERE package_identity = ?").get(spec.packageIdentity);
    assert(current?.state === state.state, "persistent execution state conflict");
    db.prepare("UPDATE executions SET state = ?, phase = ?, updated_at_utc = ?, failure_code = ?, owner_response_required = 0 WHERE package_identity = ?").run(toState, phase, recordedAtUtc, failureCode, spec.packageIdentity);
    db.prepare("INSERT INTO transitions(package_identity, sequence, from_state, to_state, phase, recorded_at_utc, evidence_sha256) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      spec.packageIdentity, sequence, state.state, toState, phase, recordedAtUtc, evidence?.sha256 ?? null,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally { db.close(); }
  const next = buildState(spec, state.packageSha256, toState, phase, sequence, recordedAtUtc, evidence ?? state.latestEvidence, failureCode);
  writeJsonAtomic(path.join(store.executionRoot, "execution-state.json"), next);
  writeJsonAtomic(path.join(store.executionRoot, "progress.json"), buildProgress(next, PHASES.indexOf(phase) + (toState === "completed" ? 1 : 0)));
  appendEvent(store.executionRoot, next, evidence, recordedAtUtc);
  writeTaskCapsule(store.executionRoot, next);
  return next;
}

function updateEvidence(store, spec, state, evidence, recordedAtUtc) {
  const db = openDatabase(store.sqlitePath);
  try {
    db.prepare("INSERT INTO artifacts(package_identity, phase, attempt, logical_path, sha256, recorded_at_utc) VALUES (?, ?, ?, ?, ?, ?)").run(
      spec.packageIdentity, evidence.phase, evidence.attempt, evidence.path, evidence.sha256, recordedAtUtc,
    );
  } finally { db.close(); }
  const next = { ...state, latestEvidence: evidence, updatedAtUtc: recordedAtUtc };
  writeJsonAtomic(path.join(store.executionRoot, "execution-state.json"), next);
  return next;
}

function recordRecovery(store, spec, state, phase, attempt, evidence, recordedAtUtc) {
  const db = openDatabase(store.sqlitePath);
  try {
    db.prepare("INSERT INTO recoveries(package_identity, phase, attempt, failure_evidence_sha256, recorded_at_utc) VALUES (?, ?, ?, ?, ?)").run(
      spec.packageIdentity, phase, attempt, evidence.sha256, recordedAtUtc,
    );
  } finally { db.close(); }
  const next = { ...state, recoveryAttempt: attempt, latestEvidence: evidence, updatedAtUtc: recordedAtUtc };
  writeJsonAtomic(path.join(store.executionRoot, "execution-state.json"), next);
  return next;
}

function persistPhaseEvidence(executionRoot, phase, attempt, result, recordedAtUtc) {
  const relative = `phase-evidence/${phase}-attempt-${attempt}.json`;
  const absolute = path.join(executionRoot, ...relative.split("/"));
  const payload = { schemaVersion: "ai-painter-autonomous-phase-evidence-v1", phase, attempt, recordedAtUtc, result };
  writeJsonExclusive(absolute, payload);
  return { phase, attempt, path: relative, sha256: sha256File(absolute) };
}

function persistTerminal(executionRoot, spec, state, result, evidence, recordedAtUtc) {
  writeJsonExclusive(path.join(executionRoot, "phase-terminal.json"), {
    schemaVersion: "ai-painter-autonomous-closed-loop-terminal-v1",
    packageIdentity: spec.packageIdentity, status: state.state, failureCode: state.failureCode,
    ownerAuthorizationRequired: false, ownerResponseRequired: false,
    finalResult: result, latestEvidence: evidence, recordedAtUtc,
  });
}

function validateAdapterBinding(root, phase, binding) {
  assert(binding?.kind === "project_module_export", `${phase} adapter kind is invalid`);
  assert(typeof binding.exportName === "string" && /^[A-Za-z_$][\w$]*$/.test(binding.exportName), `${phase} exportName is invalid`);
  const absolutePath = resolveExistingProjectFile(root, binding.path);
  assertHex(binding.sha256, `${phase} adapter SHA-256`);
  assert(sha256File(absolutePath) === binding.sha256, `${phase} adapter SHA-256 mismatch`);
  const source = fs.readFileSync(absolutePath, "utf8").toLowerCase();
  for (const token of FORBIDDEN_OWNER_TOKENS) assert(!source.includes(token), `${phase} adapter contains forbidden Owner token: ${token}`);
}

function validateAdapterResult(result, phase) {
  assert(result && typeof result === "object" && !Array.isArray(result), `${phase} result must be an object`);
  assert(["passed", "failed"].includes(result.status), `${phase} result status is invalid`);
  const serialized = JSON.stringify(result).toLowerCase();
  for (const token of FORBIDDEN_OWNER_TOKENS) assert(!serialized.includes(token), `${phase} result contains forbidden Owner token: ${token}`);
  if (result.status === "failed") {
    assert(["infrastructure", "business", "visual", "evidence", "program", "policy_boundary"].includes(result.failureKind), `${phase} failureKind is invalid`);
    assert(typeof result.failureCode === "string" && result.failureCode.length > 0, `${phase} failureCode is required`);
    if (result.failureKind === "policy_boundary") {
      assert(typeof result.boundaryClass === "string" && result.boundaryClass.length > 0, `${phase} policy boundaryClass is required`);
      assert(typeof result.summaryZh === "string" && result.summaryZh.length > 0, `${phase} policy summaryZh is required`);
    }
  }
}

function verifyBoundFile(root, binding) {
  assert(binding && typeof binding === "object", "evidence binding is invalid");
  const absolutePath = resolveExistingProjectFile(root, binding.path);
  assertHex(binding.sha256, "evidence SHA-256");
  assert(sha256File(absolutePath) === binding.sha256, `evidence SHA-256 mismatch: ${binding.path}`);
}

function openDatabase(sqlitePath) {
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS executions (
      package_identity TEXT PRIMARY KEY, package_sha256 TEXT NOT NULL UNIQUE,
      capability_version TEXT NOT NULL, state TEXT NOT NULL, phase TEXT,
      failure_code TEXT, created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL,
      owner_response_required INTEGER NOT NULL CHECK(owner_response_required = 0)
    );
    CREATE TABLE IF NOT EXISTS transitions (
      package_identity TEXT NOT NULL, sequence INTEGER NOT NULL, from_state TEXT,
      to_state TEXT NOT NULL, phase TEXT, recorded_at_utc TEXT NOT NULL, evidence_sha256 TEXT,
      PRIMARY KEY(package_identity, sequence)
    );
    CREATE TABLE IF NOT EXISTS artifacts (
      package_identity TEXT NOT NULL, phase TEXT NOT NULL, attempt INTEGER NOT NULL,
      logical_path TEXT NOT NULL, sha256 TEXT NOT NULL UNIQUE, recorded_at_utc TEXT NOT NULL,
      PRIMARY KEY(package_identity, phase, attempt)
    );
    CREATE TABLE IF NOT EXISTS recoveries (
      package_identity TEXT NOT NULL, phase TEXT NOT NULL, attempt INTEGER NOT NULL,
      failure_evidence_sha256 TEXT NOT NULL, recorded_at_utc TEXT NOT NULL,
      PRIMARY KEY(package_identity, phase, attempt)
    );
    CREATE TABLE IF NOT EXISTS review_transitions (
      package_identity TEXT NOT NULL, sequence INTEGER NOT NULL, review_state TEXT NOT NULL,
      recorded_at_utc TEXT NOT NULL, evidence_sha256 TEXT,
      PRIMARY KEY(package_identity, sequence)
    );
  `);
  return db;
}

function buildState(spec, packageSha256, state, phase, sequence, updatedAtUtc, latestEvidence, failureCode = null) {
  return {
    schemaVersion: "ai-painter-autonomous-execution-state-v1", packageIdentity: spec.packageIdentity,
    packageSha256, capabilityVersion: spec.capabilityVersion, state, phase, sequence,
    recoveryAttempt: 0, latestEvidence, failureCode, ownerAuthorizationRequired: false,
    ownerResponseRequired: false, updatedAtUtc,
  };
}

function buildProgress(state, completedPhaseCount) {
  return {
    schemaVersion: "ai-painter-autonomous-progress-v1", packageIdentity: state.packageIdentity,
    state: state.state, phase: state.phase, completedPhaseCount: Math.max(0, completedPhaseCount),
    totalPhaseCount: PHASES.length, percent: Math.min(100, Math.max(0, (completedPhaseCount / PHASES.length) * 100)),
    ownerResponseRequired: false, updatedAtUtc: state.updatedAtUtc,
  };
}

function recordReviewState(store, spec, reviewState, recordedAtUtc, evidenceSha256 = null) {
  const allowed = ["review_pending", "review_running", "review_passed", "review_completed_with_failed_result", "review_failed", "review_evidence_conflict"];
  assert(allowed.includes(reviewState), "review state is invalid");
  const db = openDatabase(store.sqlitePath);
  try {
    const latest = db.prepare("SELECT MAX(sequence) AS sequence FROM review_transitions WHERE package_identity = ?").get(spec.packageIdentity);
    const sequence = Number.isInteger(latest?.sequence) ? latest.sequence + 1 : 0;
    db.prepare("INSERT INTO review_transitions(package_identity, sequence, review_state, recorded_at_utc, evidence_sha256) VALUES (?, ?, ?, ?, ?)").run(spec.packageIdentity, sequence, reviewState, recordedAtUtc, evidenceSha256);
    writeJsonAtomic(path.join(store.executionRoot, "review-state.json"), {
      schemaVersion: "ai-painter-machine-review-state-v1", packageIdentity: spec.packageIdentity,
      state: reviewState, sequence, evidenceSha256, ownerResponseRequired: false, updatedAtUtc: recordedAtUtc,
    });
  } finally { db.close(); }
}

function appendEvent(executionRoot, state, evidence, recordedAtUtc) {
  const event = {
    schemaVersion: "ai-painter-autonomous-program-event-v1",
    eventId: `${state.packageIdentity}-${String(state.sequence).padStart(4, "0")}`,
    packageIdentity: state.packageIdentity, sequence: state.sequence, state: state.state,
    phase: state.phase, failureCode: state.failureCode, evidenceSha256: evidence?.sha256 ?? null,
    ownerResponseRequired: false, recordedAtUtc,
  };
  fs.appendFileSync(path.join(executionRoot, "event-ledger.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

function writeTaskCapsule(executionRoot, state) {
  writeJsonAtomic(path.join(executionRoot, "local-task-capsule.json"), {
    schemaVersion: "ai-painter-local-task-capsule-v2",
    module: "AI Painter", packageIdentity: state.packageIdentity,
    capabilityVersion: state.capabilityVersion, currentStage: state.phase,
    status: state.state, latestEvidence: state.latestEvidence,
    ownerAuthorizationRequired: false, ownerResponseRequired: false,
    updatedAtUtc: state.updatedAtUtc,
  });
}

function readBoundJson(root, relativePath) {
  const absolutePath = resolveExistingProjectFile(root, relativePath);
  const bytes = fs.readFileSync(absolutePath);
  return { value: JSON.parse(bytes.toString("utf8")), path: relativePath, sha256: sha256(bytes) };
}

function resolveExistingProjectFile(root, relativePath) {
  assert(typeof relativePath === "string" && relativePath.length > 0, "project-relative path is required");
  assert(!path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath), "absolute paths are forbidden");
  const absolutePath = resolveInsideRoot(root, relativePath);
  assert(fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(), `file does not exist: ${relativePath}`);
  return absolutePath;
}

function resolveInsideRoot(root, relativePath) {
  const projectRoot = path.resolve(root);
  const absolutePath = path.resolve(projectRoot, relativePath);
  assert(absolutePath.startsWith(`${projectRoot}${path.sep}`), `path escapes project root: ${relativePath}`);
  return absolutePath;
}

function validateRelativeRuntimeRoot(value, label) {
  assert(typeof value === "string" && value.startsWith(".runtime/ai-painter/") && !value.includes("..") && !value.includes("\\"), `${label} must be a normalized AI Painter runtime path`);
}

function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "w" });
  fs.renameSync(temporary, filePath);
}

function writeJsonExclusive(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function sha256File(filePath) { return sha256(fs.readFileSync(filePath)); }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function canonical(value) { return JSON.stringify(value); }
function assertHex(value, label) { assert(typeof value === "string" && /^[a-f0-9]{64}$/.test(value), `${label} is invalid`); }
function assert(condition, message) { if (!condition) throw new Error(message); }

export { sha256File };
