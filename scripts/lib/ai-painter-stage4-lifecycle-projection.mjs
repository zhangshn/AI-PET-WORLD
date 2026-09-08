import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

export const STAGE4_LIFECYCLE_PROJECTION_SCHEMA = "ai-painter-stage4-lifecycle-projection-v1";
export const CPU_LIFECYCLE_STAGE = "cpu_contract_verified";
export const LEGACY_CPU_LIFECYCLE_STAGE = "cpu_contract_accepted";
const SUCCESS_STAGES = Object.freeze([
  "change_candidate", "isolated_implementation", CPU_LIFECYCLE_STAGE,
  "readonly_gpu_qualified", "controlled_smoke_completed", "formal_stage_validation_completed",
  "independent_regression_completed", "machine_release_adjudicated", "released",
]);
const FAILURE_CEILINGS = Object.freeze({
  cpu: "isolated_implementation", gpu: CPU_LIFECYCLE_STAGE,
  smoke: "readonly_gpu_qualified", screen: "controlled_smoke_completed",
  formal: "controlled_smoke_completed",
});
const TERMINAL_KINDS = Object.freeze({
  "stage4-v2-cpu-contract-acceptance-terminal-v1": "cpu",
  "ai-painter-stage4-v2-readonly-gpu-terminal-v1": "gpu",
  "ai-painter-stage4-v2-controlled-smoke-terminal-v1": "smoke",
  "ai-painter-joint-full-data-screen-registry-terminal-v1": "screen",
  "ai-painter-stage4-v2-formal-stage0-to-stage2-execution-terminal-v2": "formal",
});

/** Read compatibility is not a registry migration or a new capability qualification. */
export function cpuLifecycleCompatibility(rawLifecycleStage, sourceEvidence) {
  assert.ok([CPU_LIFECYCLE_STAGE, LEGACY_CPU_LIFECYCLE_STAGE].includes(rawLifecycleStage),
    "cpu_lifecycle_enum_unrecognized");
  assert.ok(sourceEvidence?.path && /^[a-f0-9]{64}$/u.test(sourceEvidence.sha256 ?? ""),
    "cpu_lifecycle_source_binding_missing");
  return {
    schemaVersion: STAGE4_LIFECYCLE_PROJECTION_SCHEMA,
    ruleId: "stage4-cpu-accepted-to-verified-v1",
    rawLifecycleStage,
    lifecycleStage: CPU_LIFECYCLE_STAGE,
    mode: rawLifecycleStage === LEGACY_CPU_LIFECYCLE_STAGE ? "read_compatibility_only" : "native_formal_enum",
    sourceEvidence: { path: sourceEvidence.path, sha256: sourceEvidence.sha256 },
    historicalEvidenceRewritten: false,
    currentExecutionRegistryWritten: false,
  };
}

/** Reads only the selected capability's canonical ledger; never scans older runs. */
export function readLastSuccessfulStage4Qualification({ projectRoot, capabilityVersion }) {
  try {
    const receipts = new Map();
    assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9_-]{7,127}$/u, "lifecycle_capability_invalid");
    const prefix = `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`;
    const stateFile = readFile(projectRoot, `${prefix}/state.json`, receipts);
    const state = JSON.parse(stateFile.bytes);
    assert.equal(state.schemaVersion, "ai-painter-capability-lifecycle-state-v1", "lifecycle_state_schema_invalid");
    assert.equal(state.capabilityVersion, capabilityVersion, "lifecycle_capability_mismatch");
    assert.ok(Number.isInteger(state.sequence) && state.sequence >= 0, "lifecycle_sequence_invalid");
    const candidate = JSON.parse(readFile(projectRoot, `${prefix}/candidate.json`, receipts).bytes);
    assert.equal(candidate.schemaVersion, "ai-painter-capability-change-candidate-v1", "lifecycle_candidate_schema_invalid");
    assert.equal(candidate.capabilityVersion, capabilityVersion, "lifecycle_candidate_capability_mismatch");
    assert.equal(candidate.ownerInLifecycle, false, "lifecycle_owner_gate_forbidden");
    assert.equal(candidate.ownerAuthorizationRequired, false, "lifecycle_owner_gate_forbidden");
    verifyBindings(projectRoot, candidate.sourceEvidence, receipts);
    const ledger = readFile(projectRoot, `${prefix}/event-ledger.jsonl`, receipts);
    assert.ok(ledger.bytes.toString("utf8").endsWith("\n"), "lifecycle_partial_event");
    const events = ledger.bytes.toString("utf8").trim().split("\n").map((line) => JSON.parse(line));
    const databasePath = resolveFile(projectRoot, `${prefix}/lifecycle.sqlite`);
    // Immutable URI avoids read-only SQLite creating -wal/-shm sidecars. A live,
    // uncheckpointed WAL cannot be ignored: fail closed and let the writer settle.
    assert.ok(!fs.existsSync(`${databasePath}-wal`) || fs.statSync(`${databasePath}-wal`).size === 0,
      "lifecycle_sqlite_uncheckpointed_wal");
    const databaseHash = crypto.createHash("sha256").update(fs.readFileSync(databasePath)).digest("hex");
    const db = new DatabaseSync(`${pathToFileURL(databasePath).href}?mode=ro&immutable=1`, { readOnly: true });
    let row;
    let transitions;
    try {
      row = db.prepare("SELECT state, change_class, owner_response_required FROM capabilities WHERE capability_version = ?").get(capabilityVersion);
      transitions = db.prepare("SELECT sequence, from_state, to_state, evidence_sha256 FROM lifecycle_transitions WHERE capability_version = ? ORDER BY sequence").all(capabilityVersion);
    } finally { db.close(); }
    assert.equal(row?.state, state.state, "lifecycle_sqlite_state_conflict");
    assert.equal(row?.change_class, candidate.changeClass, "lifecycle_change_class_conflict");
    assert.equal(row?.owner_response_required, 0, "lifecycle_owner_gate_forbidden");
    assert.equal(events.length, state.sequence + 1, "lifecycle_event_count_conflict");
    assert.equal(transitions.length, events.length, "lifecycle_sqlite_count_conflict");
    let lastSuccess = null;
    let lastEvidence = null;
    let previous = null;
    for (const [sequence, event] of events.entries()) {
      const transition = transitions[sequence];
      assert.equal(event.capabilityVersion, capabilityVersion, "lifecycle_event_capability_conflict");
      assert.equal(event.schemaVersion, "ai-painter-capability-lifecycle-event-v1", "lifecycle_event_schema_invalid");
      assert.equal(event.sequence, sequence, "lifecycle_event_sequence_conflict");
      assert.equal(transition.sequence, sequence, "lifecycle_sqlite_sequence_conflict");
      assert.equal(transition.to_state, event.state, "lifecycle_event_sqlite_conflict");
      assert.equal(transition.from_state, previous, "lifecycle_transition_source_conflict");
      assert.equal(transition.evidence_sha256, event.evidenceSha256, "lifecycle_evidence_index_conflict");
      assert.equal(event.ownerResponseRequired, false, "lifecycle_owner_gate_forbidden");
      if (sequence === 0) {
        assert.equal(event.state, "change_candidate", "lifecycle_initial_state_invalid");
        assert.equal(event.evidenceSha256, null, "lifecycle_initial_evidence_invalid");
        lastSuccess = event.state;
      } else {
        const nextIndex = SUCCESS_STAGES.indexOf(event.state);
        const previousIndex = SUCCESS_STAGES.indexOf(previous);
        // Stage4 V2 requires GPU qualification; absence of a GPU requirement
        // field does not permit skipping this stage.
        const success = nextIndex === previousIndex + 1;
        const rejection = event.state === "rejected" && previousIndex >= 0 && previous !== "released";
        const rollback = event.state === "rolled_back" && previous === "released";
        assert.ok(previousIndex >= 0 && (success || rejection || rollback), "lifecycle_transition_invalid");
        const binding = { path: `${prefix}/evidence/${String(sequence).padStart(3, "0")}-${event.state}.json`, sha256: event.evidenceSha256 };
        const evidence = readBoundJson(projectRoot, binding, receipts);
        assert.equal(evidence.schemaVersion, "ai-painter-capability-stage-evidence-v1", "lifecycle_evidence_schema_invalid");
        assert.equal(evidence.capabilityVersion, capabilityVersion, "lifecycle_evidence_capability_mismatch");
        assert.equal(evidence.targetState, event.state, "lifecycle_evidence_target_mismatch");
        verifyBindings(projectRoot, evidence.bindings, receipts);
        if (success) {
          assert.equal(evidence.status, "passed", "lifecycle_success_evidence_not_passed");
          // A valid-looking stage wrapper must not launder a failed execution.
          for (const source of evidence.bindings) {
            if (!source.path.endsWith(".json")) continue;
            const value = readBoundJson(projectRoot, source, receipts);
            assert.ok(!["failed_closed", "blocked_policy_boundary"].includes(value.executionState),
              "lifecycle_success_binds_failed_execution");
          }
          lastSuccess = event.state;
          lastEvidence = binding;
        }
      }
      previous = event.state;
    }
    assert.equal(previous, state.state, "lifecycle_event_tail_conflict");
    const tail = events.at(-1);
    if (state.sequence === 0) assert.equal(state.latestEvidence, null, "lifecycle_initial_tail_invalid");
    else {
      assert.equal(state.latestEvidence?.path, `evidence/${String(state.sequence).padStart(3, "0")}-${state.state}.json`, "lifecycle_tail_path_conflict");
      assert.equal(state.latestEvidence?.sha256, tail.evidenceSha256, "lifecycle_tail_hash_conflict");
    }
    for (const [relative, expectedHash] of receipts) {
      assert.equal(readFile(projectRoot, relative).sha256, expectedHash, "lifecycle_changed_during_read");
    }
    assert.equal(readFile(projectRoot, `${prefix}/lifecycle.sqlite`).sha256, databaseHash, "lifecycle_changed_during_read");
    assert.ok(!fs.existsSync(`${databasePath}-wal`) || fs.statSync(`${databasePath}-wal`).size === 0,
      "lifecycle_sqlite_changed_during_read");
    return { status: "verified", lifecycleStage: lastSuccess, capabilityDisposition: state.state,
      sourceEvidence: lastEvidence ?? { path: `${prefix}/candidate.json`, sha256: receipts.get(`${prefix}/candidate.json`) },
      lifecycleSequence: state.sequence };
  } catch (error) { return unknown(error); }
}

/** Failure action identity comes from bound terminal bytes, never the UI or its status label. */
export function projectStage4FailureLifecycle({ projectRoot, capabilityVersion, sourceTerminal, actionKind }) {
  let failedActionId = null;
  let failedTrainingStage = null;
  try {
    assert.ok(Object.hasOwn(FAILURE_CEILINGS, actionKind), "failure_action_kind_unrecognized");
    const terminal = readBoundJson(projectRoot, sourceTerminal);
    assert.equal(TERMINAL_KINDS[terminal.schemaVersion], actionKind, "failure_terminal_kind_mismatch");
    assert.equal(terminal.capabilityVersion ?? terminal.architectureId, capabilityVersion, "failure_capability_mismatch");
    assert.ok(["failed_closed", "blocked_policy_boundary"].includes(terminal.executionState), "source_terminal_not_failed");
    const action = terminal.failedActionId ?? terminal.action;
    assert.ok(typeof action === "string" && action.length > 0, "failed_action_identity_missing");
    failedActionId = action;
    failedTrainingStage = terminal.failedTrainingStage ?? null;
    if (actionKind === "formal") assert.ok(failedTrainingStage === null || [0, 1, 2].includes(failedTrainingStage), "failed_training_stage_invalid");
    else assert.equal(failedTrainingStage, null, "non_formal_training_stage_forbidden");
    const qualification = readLastSuccessfulStage4Qualification({ projectRoot, capabilityVersion });
    assert.equal(qualification.status, "verified", qualification.errorCode ?? "last_successful_qualification_unverifiable");
    assert.ok(SUCCESS_STAGES.indexOf(qualification.lifecycleStage) <= SUCCESS_STAGES.indexOf(FAILURE_CEILINGS[actionKind]),
      "failure_prior_qualification_exceeds_action_boundary");
    readBoundBytes(projectRoot, sourceTerminal);
    return { schemaVersion: STAGE4_LIFECYCLE_PROJECTION_SCHEMA, status: "verified",
      lifecycleStage: qualification.lifecycleStage, capabilityDisposition: qualification.capabilityDisposition,
      qualificationEvidence: qualification.sourceEvidence, failedActionId, failedTrainingStage,
      sourceTerminal: { path: sourceTerminal.path, sha256: sourceTerminal.sha256 },
      historicalEvidenceRewritten: false, currentExecutionRegistryWritten: false };
  } catch (error) { return { ...unknown(error), failedActionId, failedTrainingStage, sourceTerminal: sourceTerminal ?? null }; }
}

function unknown(error) {
  return { schemaVersion: STAGE4_LIFECYCLE_PROJECTION_SCHEMA, status: "unknown_or_stale",
    lifecycleStage: "unknown_or_stale", errorCode: error.message,
    historicalEvidenceRewritten: false, currentExecutionRegistryWritten: false };
}
function verifyBindings(root, bindings, receipts) {
  assert.ok(Array.isArray(bindings) && bindings.length > 0, "lifecycle_evidence_bindings_missing");
  for (const binding of bindings) readBoundBytes(root, binding, receipts);
}
function readBoundBytes(root, binding, receipts) {
  assert.match(binding?.sha256 ?? "", /^[a-f0-9]{64}$/u, "lifecycle_binding_sha256_invalid");
  const file = readFile(root, binding.path, receipts);
  assert.equal(file.sha256, binding.sha256, "lifecycle_binding_sha256_mismatch");
  return file.bytes;
}
function readBoundJson(root, binding, receipts) { return JSON.parse(readBoundBytes(root, binding, receipts)); }
function readFile(root, relative, receipts) {
  const bytes = fs.readFileSync(resolveFile(root, relative));
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (receipts?.has(relative)) assert.equal(receipts.get(relative), sha256, "lifecycle_changed_during_read");
  receipts?.set(relative, sha256);
  return { bytes, sha256 };
}
function resolveFile(root, relative) {
  assert.ok(typeof relative === "string" && relative.length > 0 && !relative.includes("\\")
    && !relative.includes(":") && !path.isAbsolute(relative) && !relative.split("/").includes("..")
    && path.posix.normalize(relative) === relative, "lifecycle_path_invalid");
  const absolute = path.resolve(root, relative);
  const trusted = relative.startsWith(".runtime/") ? path.join(root, ".runtime") : root;
  const physicalRelative = path.relative(fs.realpathSync(trusted), fs.realpathSync(absolute));
  assert.ok(physicalRelative && !physicalRelative.startsWith("..") && !path.isAbsolute(physicalRelative), "lifecycle_path_escape");
  assert.ok(fs.statSync(absolute).isFile(), "lifecycle_not_regular_file");
  return absolute;
}
