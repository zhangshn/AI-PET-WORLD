import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { persistPolicyBoundaryReport } from "./ai-painter-local-autonomy-governance-v3.mjs";

export const CLOSED_LOOP_CONTRACT_PATH =
  "data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json";
export const CURRENT_ENTRYPOINT_REGISTRY_PATH =
  "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json";
export const CLOSED_LOOP_ROOT = ".runtime/ai-painter/autonomous-closed-loop-executions";

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

export async function runAutonomousClosedLoop({
  root = process.cwd(), spec, packageSha256, adapters, now = () => new Date().toISOString(),
}) {
  validateClosedLoopPackage(spec, { root, packageSha256 });
  const loadedAdapters = adapters ?? await loadPhaseAdapters(spec, { root });
  assert(canonical(Object.keys(loadedAdapters).sort()) === canonical([...PHASES].sort()), "runtime adapter set mismatch");
  const store = createExecutionStore({ root, spec, packageSha256, now: now() });
  let state = store.state;
  const context = Object.freeze({
    projectRoot: path.resolve(root), packageIdentity: spec.packageIdentity,
    capabilityVersion: spec.capabilityVersion, outputRoot: spec.outputRoot,
    executionRoot: store.executionRoot, inputEvidence: structuredClone(spec.inputEvidence),
  });

  for (let index = 0; index < PHASES.length; index += 1) {
    const phase = PHASES[index];
    state = transition(store, spec, state, STATE_FOR_PHASE[phase], phase, null, now());
    let attempt = 0;
    while (true) {
      if (phase === "review" && attempt === 0 && !fs.existsSync(path.join(store.executionRoot, "review-state.json"))) {
        recordReviewState(store, spec, "review_pending", 0, now());
        recordReviewState(store, spec, "review_running", 1, now());
      }
      const heartbeatAtUtc = now();
      writeJsonAtomic(path.join(store.executionRoot, "heartbeat.json"), {
        schemaVersion: "ai-painter-autonomous-heartbeat-v1", packageIdentity: spec.packageIdentity,
        phase, attempt, state: state.state, heartbeatAtUtc,
      });
      let result;
      try {
        const runtimeContext = createAdapterRuntimeContext({ context, store, spec, state, phase, attempt, now });
        result = await loadedAdapters[phase](runtimeContext);
      } catch (error) {
        result = { status: "failed", failureKind: "program", failureCode: "adapter_exception", detail: String(error?.stack ?? error) };
      }
      validateAdapterResult(result, phase);
      const evidence = persistPhaseEvidence(store.executionRoot, phase, attempt, result, now());
      const infrastructureRetryPending = result.status === "failed" && result.failureKind === "infrastructure" && attempt < spec.maxInfrastructureRecoveryAttempts;
      if (phase === "review" && !infrastructureRetryPending) {
        const reviewState = result.status === "passed" ? "review_passed" : result.failureKind === "evidence" ? "review_evidence_conflict" : "review_failed";
        recordReviewState(store, spec, reviewState, 2, now(), evidence.sha256);
      }
      if (result.status === "passed") {
        state = updateEvidence(store, spec, state, evidence, now());
        break;
      }
      if (result.failureKind === "infrastructure" && attempt < spec.maxInfrastructureRecoveryAttempts) {
        attempt += 1;
        state = recordRecovery(store, spec, state, phase, attempt, evidence, now());
        continue;
      }
      const terminal = result.failureKind === "policy_boundary" ? "blocked_policy_boundary" : "failed_closed";
      state = transition(store, spec, state, terminal, phase, evidence, now(), result.failureCode);
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
      persistTerminal(store.executionRoot, spec, state, { ...result, policyBoundaryReport }, evidence, now());
      return state;
    }
  }
  state = transition(store, spec, state, "completed", "finalize", state.latestEvidence, now());
  persistTerminal(store.executionRoot, spec, state, { status: "passed", decision: "completed" }, state.latestEvidence, now());
  return state;
}

function createAdapterRuntimeContext({ context, store, spec, state, phase, attempt, now }) {
  const writeHeartbeat = (adapterProgress = null) => {
    const heartbeatAtUtc = now();
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

function recordReviewState(store, spec, reviewState, sequence, recordedAtUtc, evidenceSha256 = null) {
  const allowed = ["review_pending", "review_running", "review_passed", "review_failed", "review_evidence_conflict"];
  assert(allowed.includes(reviewState), "review state is invalid");
  const db = openDatabase(store.sqlitePath);
  try {
    db.prepare("INSERT INTO review_transitions(package_identity, sequence, review_state, recorded_at_utc, evidence_sha256) VALUES (?, ?, ?, ?, ?)").run(spec.packageIdentity, sequence, reviewState, recordedAtUtc, evidenceSha256);
  } finally { db.close(); }
  writeJsonAtomic(path.join(store.executionRoot, "review-state.json"), {
    schemaVersion: "ai-painter-machine-review-state-v1", packageIdentity: spec.packageIdentity,
    state: reviewState, sequence, evidenceSha256, ownerResponseRequired: false, updatedAtUtc: recordedAtUtc,
  });
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
