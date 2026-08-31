import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CAPABILITY_LIFECYCLE_CONTRACT_PATH,
  advanceCapabilityLifecycle,
  createCapabilityCandidate,
  validateCapabilityLifecycleContract,
} from "./lib/ai-painter-capability-lifecycle-v1.mjs";

const projectRoot = process.cwd();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-capability-lifecycle-"));
let positive = 0;
let negative = 0;
try {
  copy(CAPABILITY_LIFECYCLE_CONTRACT_PATH);
  write("fixtures/source.json", "{\"source\":true}\n");
  const source = { path: "fixtures/source.json", sha256: sha("fixtures/source.json") };
  const spec = candidate("capability-lifecycle-fixture-a", source);
  const created = createCapabilityCandidate(spec, { root: fixtureRoot, recordedAtUtc: "2026-08-24T01:00:00.000Z" });
  assert.equal(created.state.state, "change_candidate"); positive += 1;
  const pathWithoutGpu = [
    "isolated_implementation", "cpu_contract_verified", "controlled_smoke_completed",
    "formal_stage_validation_completed", "independent_regression_completed", "machine_release_adjudicated",
  ];
  let current;
  for (const targetState of pathWithoutGpu) {
    current = advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: spec.capabilityVersion, targetState, evidence: evidence(spec.capabilityVersion, targetState, source), recordedAtUtc: `2026-08-24T01:0${current?.sequence ?? 1}:00.000Z` });
  }
  assert.equal(current.state, "machine_release_adjudicated");
  assert.equal(current.ownerResponseRequired, false); positive += 1;
  current = advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: spec.capabilityVersion, targetState: "rejected", evidence: { ...evidence(spec.capabilityVersion, "rejected", source), status: "failed" } });
  assert.equal(current.state, "rejected");
  assert.ok(fs.existsSync(path.join(created.candidateRoot, "phase-terminal.json"))); positive += 1;
  const db = new DatabaseSync(created.sqlitePath, { readOnly: true });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM lifecycle_transitions").get().count, 8);
  assert.equal(db.prepare("SELECT owner_response_required FROM capabilities").get().owner_response_required, 0);
  db.close(); positive += 1;

  const gpuSpec = candidate("capability-lifecycle-fixture-b", source);
  createCapabilityCandidate(gpuSpec, { root: fixtureRoot });
  for (const targetState of ["isolated_implementation", "cpu_contract_verified", "readonly_gpu_qualified", "controlled_smoke_completed"]) {
    advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: gpuSpec.capabilityVersion, targetState, evidence: evidence(gpuSpec.capabilityVersion, targetState, source) });
  }
  positive += 1;

  for (const [index, hookName] of [
    "afterLifecycleEvidencePersisted",
    "afterLifecycleSqliteCommitted",
    "afterLifecycleStateCommitted",
    "afterLifecycleEventCommitted",
  ].entries()) {
    const crashSpec = candidate(`capability-lifecycle-crash-${index}`, source);
    const crashCreated = createCapabilityCandidate(crashSpec, {
      root: fixtureRoot,
      recordedAtUtc: `2026-08-24T02:0${index}:00.000Z`,
    });
    const crashEvidence = {
      ...evidence(crashSpec.capabilityVersion, "isolated_implementation", source),
      crashWindow: hookName,
    };
    assert.throws(
      () => advanceCapabilityLifecycle({
        root: fixtureRoot,
        capabilityVersion: crashSpec.capabilityVersion,
        targetState: "isolated_implementation",
        evidence: crashEvidence,
        recordedAtUtc: `2026-08-24T03:0${index}:00.000Z`,
        _testHooks: { [hookName]: () => { throw new Error(`injected crash ${hookName}`); } },
      }),
      new RegExp(`injected crash ${hookName}`),
    );
    const recovered = advanceCapabilityLifecycle({
      root: fixtureRoot,
      capabilityVersion: crashSpec.capabilityVersion,
      targetState: "isolated_implementation",
      evidence: crashEvidence,
      recordedAtUtc: `2026-08-24T04:0${index}:00.000Z`,
    });
    const replayed = advanceCapabilityLifecycle({
      root: fixtureRoot,
      capabilityVersion: crashSpec.capabilityVersion,
      targetState: "isolated_implementation",
      evidence: crashEvidence,
      recordedAtUtc: `2026-08-24T05:0${index}:00.000Z`,
    });
    assert.deepEqual(replayed, recovered);
    assert.equal(recovered.updatedAtUtc, `2026-08-24T03:0${index}:00.000Z`);
    assertLifecycleCommitExactlyOnce(crashCreated, recovered);
    positive += 1;
  }

  const rejectedCrashSpec = candidate("capability-lifecycle-crash-terminal", source);
  const rejectedCrashCreated = createCapabilityCandidate(rejectedCrashSpec, { root: fixtureRoot });
  const rejectedCrashEvidence = {
    ...evidence(rejectedCrashSpec.capabilityVersion, "rejected", source),
    status: "failed",
    failureCode: "fixture_failure",
  };
  assert.throws(
    () => advanceCapabilityLifecycle({
      root: fixtureRoot,
      capabilityVersion: rejectedCrashSpec.capabilityVersion,
      targetState: "rejected",
      evidence: rejectedCrashEvidence,
      _testHooks: { afterLifecycleEventCommitted: () => { throw new Error("injected terminal crash"); } },
    }),
    /injected terminal crash/,
  );
  const rejectedRecovered = advanceCapabilityLifecycle({
    root: fixtureRoot,
    capabilityVersion: rejectedCrashSpec.capabilityVersion,
    targetState: "rejected",
    evidence: rejectedCrashEvidence,
  });
  assertLifecycleCommitExactlyOnce(rejectedCrashCreated, rejectedRecovered);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(rejectedCrashCreated.candidateRoot, "phase-terminal.json"), "utf8")),
    rejectedRecovered,
  );
  positive += 1;

  const underscoredSpec = candidate(
    "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2",
    source,
  );
  const underscoredCreated = createCapabilityCandidate(underscoredSpec, { root: fixtureRoot });
  assert.equal(underscoredCreated.state.capabilityVersion, underscoredSpec.capabilityVersion);
  assert.equal(underscoredCreated.state.state, "change_candidate");
  positive += 1;

  assert.throws(() => createCapabilityCandidate({ ...candidate("capability-owner-invalid", source), ownerAuthorizationRequired: true }, { root: fixtureRoot }), /cannot require Owner/); negative += 1;
  assert.throws(() => createCapabilityCandidate(candidate("stage4 invalid identity", source), { root: fixtureRoot }), /capabilityVersion is invalid/); negative += 1;
  assert.throws(() => createCapabilityCandidate(spec, { root: fixtureRoot }), /already exists/); negative += 1;
  assert.throws(() => advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: gpuSpec.capabilityVersion, targetState: "released", evidence: evidence(gpuSpec.capabilityVersion, "released", source) }), /invalid capability transition/); negative += 1;
  assert.throws(() => advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: gpuSpec.capabilityVersion, targetState: "formal_stage_validation_completed", evidence: { ...evidence(gpuSpec.capabilityVersion, "formal_stage_validation_completed", source), bindings: [{ ...source, sha256: "0".repeat(64) }] } }), /SHA-256 mismatch/); negative += 1;
  assert.throws(() => advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: spec.capabilityVersion, targetState: "released", evidence: evidence(spec.capabilityVersion, "released", source) }), /terminal capability/); negative += 1;

  const exactConflictSpec = candidate("capability-lifecycle-exact-conflict", source);
  createCapabilityCandidate(exactConflictSpec, { root: fixtureRoot });
  const exactEvidence = evidence(exactConflictSpec.capabilityVersion, "isolated_implementation", source);
  advanceCapabilityLifecycle({
    root: fixtureRoot,
    capabilityVersion: exactConflictSpec.capabilityVersion,
    targetState: "isolated_implementation",
    evidence: exactEvidence,
  });
  assert.throws(
    () => advanceCapabilityLifecycle({
      root: fixtureRoot,
      capabilityVersion: exactConflictSpec.capabilityVersion,
      targetState: "isolated_implementation",
      evidence: { ...exactEvidence, conflictingPayload: true },
    }),
    /evidence conflict/,
  );
  negative += 1;

  validateCapabilityLifecycleContract(fixtureRoot); positive += 1;
  process.stdout.write(`${JSON.stringify({ status: "passed", positive, negative, ownerInLifecycle: false, optionalGpuQualificationVerified: true, persistentTransitionsVerified: true }, null, 2)}\n`);
} finally {
  const resolved = path.resolve(fixtureRoot);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())));
  fs.rmSync(resolved, { recursive: true, force: true });
}

function candidate(capabilityVersion, source) { return { schemaVersion: "ai-painter-capability-change-candidate-v1", capabilityVersion, changeClass: "model_family", ownerAuthorizationRequired: false, ownerInLifecycle: false, sourceEvidence: [source] }; }
function evidence(capabilityVersion, targetState, source) { return { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion, targetState, status: "passed", bindings: [source] }; }
function copy(relative) { write(relative, fs.readFileSync(path.join(projectRoot, relative))); }
function write(relative, bytes) { const absolute = path.join(fixtureRoot, relative); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, bytes); }
function sha(relative) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(fixtureRoot, relative))).digest("hex"); }
function assertLifecycleCommitExactlyOnce(created, state) {
  const database = new DatabaseSync(created.sqlitePath, { readOnly: true });
  try {
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM lifecycle_transitions").get().count, 2);
    const capability = database.prepare(
      "SELECT state, updated_at_utc, owner_response_required FROM capabilities WHERE capability_version = ?",
    ).get(state.capabilityVersion);
    assert.deepEqual({ ...capability }, {
      state: state.state,
      updated_at_utc: state.updatedAtUtc,
      owner_response_required: 0,
    });
  } finally {
    database.close();
  }
  const events = fs.readFileSync(path.join(created.candidateRoot, "event-ledger.jsonl"), "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((event) => event.sequence === state.sequence);
  assert.equal(events.length, 1);
  assert.equal(events[0].evidenceSha256, state.latestEvidence.sha256);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(created.candidateRoot, "state.json"), "utf8")), state);
}
