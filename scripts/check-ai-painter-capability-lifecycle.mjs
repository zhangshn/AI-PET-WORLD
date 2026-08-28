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

  assert.throws(() => createCapabilityCandidate({ ...candidate("capability-owner-invalid", source), ownerAuthorizationRequired: true }, { root: fixtureRoot }), /cannot require Owner/); negative += 1;
  assert.throws(() => createCapabilityCandidate(spec, { root: fixtureRoot }), /already exists/); negative += 1;
  assert.throws(() => advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: gpuSpec.capabilityVersion, targetState: "released", evidence: evidence(gpuSpec.capabilityVersion, "released", source) }), /invalid capability transition/); negative += 1;
  assert.throws(() => advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: gpuSpec.capabilityVersion, targetState: "formal_stage_validation_completed", evidence: { ...evidence(gpuSpec.capabilityVersion, "formal_stage_validation_completed", source), bindings: [{ ...source, sha256: "0".repeat(64) }] } }), /SHA-256 mismatch/); negative += 1;
  assert.throws(() => advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: spec.capabilityVersion, targetState: "released", evidence: evidence(spec.capabilityVersion, "released", source) }), /terminal capability/); negative += 1;

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
