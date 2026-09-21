import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { boundJson, projectFile, summarizeDiagnostic, decideDiagnostic, loadPhase, validateLaunchSnapshot, requestOf, retryTransientIo } from "../lib/ai-painter-diagnostic-shadow-v1.mjs";
import { PHASES, CLOSED_LOOP_CONTRACT_PATH, runAutonomousClosedLoop } from "../lib/ai-painter-autonomous-closed-loop-v1.mjs";

const evidence = { path: ".runtime/ai-painter/test-review.json", sha256: "a".repeat(64) };
function fixture() {
  const rows = ["scene-a", "scene-b"].flatMap(sampleId => [1, 2, 3].map(seed => ({ sampleId, seed,
    targetEncodedForGeneration: false, attribution: { uncoveredShareOfTotalAbsoluteRgbError: 0.9, compositorEquationExact: true },
    base: { laplacianMae: 0.02 }, final: { laplacianMae: 0.03 } })));
  return { source: { rows, modelStateSha256BeforeAndAfter: "b".repeat(64) },
    replay: { status: "replayed_exactly", cudaInitialized: false, optimizerSteps: 0, newRollouts: 0,
      rowsReplayed: 6, reconstructionControlsReplayed: 2, modelStateSha256BeforeAndAfter: "b".repeat(64) },
    alignment: ["scene-a", "scene-b"].map(sampleId => ({ sampleId, audit: { passed: true, issues: [], formalConditionalTrainingEligible: false } })) };
}
function summary(f = fixture()) { return summarizeDiagnostic(f.source, f.replay, f.alignment); }

test("two scenes remain two scenes, not six independent samples", () => {
  const result = summary();
  assert.equal(result.sceneCount, 2); assert.equal(result.sampleSeedCount, 6);
  assert.deepEqual(result.uncoveredErrorShareRange, [0.9, 0.9]);
  assert.equal(result.finalLaplacianWorseCount, 6);
});
test("bounded majority decision is advice only, not a training action", () => {
  const decision = decideDiagnostic(summary(), evidence);
  assert.equal(decision.matchedOption, "inspect_base_generation_and_pairing");
  assert.equal(decision.applied, false); assert.equal(decision.nextMachineAction, null);
});
test("existing coarse failures take pairing priority without changing thresholds", () => {
  const f = fixture(); f.alignment[0].audit.passed = false; f.alignment[0].audit.issues = [{ code: "path_alignment" }];
  assert.equal(decideDiagnostic(summary(f), evidence).matchedOption, "inspect_source_pairing");
});
test("head-region majority can recommend composition inspection", () => {
  const f = fixture(); f.source.rows.forEach(r => { r.attribution.uncoveredShareOfTotalAbsoluteRgbError = 0.1; });
  assert.equal(decideDiagnostic(summary(f), evidence).matchedOption, "inspect_head_composition_and_pairing");
});
test("mixed or tied attribution stops inconclusively", () => {
  const f = fixture(); f.source.rows[0].attribution.uncoveredShareOfTotalAbsoluteRgbError = 0.5;
  assert.equal(decideDiagnostic(summary(f), evidence).matchedOption, "stop_inconclusive");
});
test("missing rows and duplicate seeds fail closed", () => {
  const f = fixture(); f.source.rows.pop(); assert.throws(() => summary(f));
  const g = fixture(); g.source.rows[1].seed = 1; assert.throws(() => summary(g));
});
test("nonfinite and out-of-range error shares are not evidence", () => {
  for (const value of [NaN, Infinity, -0.1, 1.1, null]) {
    const f = fixture(); f.source.rows[0].attribution.uncoveredShareOfTotalAbsoluteRgbError = value;
    assert.throws(() => summary(f));
  }
});
test("GPU use, optimizer updates and fresh sampling violate shadow scope", () => {
  for (const [key, value] of [["cudaInitialized", true], ["optimizerSteps", 1], ["newRollouts", 1]]) {
    const f = fixture(); f.replay[key] = value; assert.throws(() => summary(f));
  }
});
test("target-fed generation, changed models and changed compositor fail", () => {
  const f = fixture(); f.source.rows[0].targetEncodedForGeneration = true; assert.throws(() => summary(f));
  const g = fixture(); g.replay.modelStateSha256BeforeAndAfter = "c".repeat(64); assert.throws(() => summary(g));
  const h = fixture(); h.source.rows[0].attribution.compositorEquationExact = false; assert.throws(() => summary(h));
});
test("coarse checker cannot claim formal qualification or hide an issue", () => {
  const f = fixture(); f.alignment[0].audit.formalConditionalTrainingEligible = true; assert.throws(() => summary(f));
  const g = fixture(); g.alignment[0].audit.issues = [{ code: "hidden" }]; assert.throws(() => summary(g));
});
test("alignment must match the exact scene identities and order", () => {
  const f = fixture(); f.alignment.reverse(); assert.throws(() => summary(f));
});
test("unsafe project paths are rejected", () => {
  for (const value of ["../outside", "data/../outside", "F:/other.json", "/other", "data\\other", ""]) {
    assert.throws(() => projectFile(process.cwd(), value));
  }
});
test("bound JSON is rehashed and same-path edits are rejected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "painter-diagnostic-test-"));
  const file = path.join(root, "evidence.json"), data = Buffer.from('{"value":1}');
  try {
    fs.writeFileSync(file, data, { flag: "wx" });
    const binding = { path: "evidence.json", sha256: crypto.createHash("sha256").update(data).digest("hex") };
    assert.equal(boundJson(root, binding).value, 1);
    fs.writeFileSync(file, '{"value":2}'); assert.throws(() => boundJson(root, binding), /hash mismatch/);
  } finally { fs.unlinkSync(file); fs.rmdirSync(root); }
});
test("incomplete summary cannot create a vacuous unanimous decision", () => {
  assert.throws(() => decideDiagnostic({ rows: [], coarseAlignmentPassedCount: 2 }, evidence));
});
test("transient IO retries the same operation a bounded number of times", async () => {
  let attempts = 0;
  const delays = [];
  const value = await retryTransientIo(() => {
    attempts++;
    if (attempts < 3) throw Object.assign(new Error("sharing violation"), { code: "EPERM" });
    return "same transaction completed";
  }, { sleep: async ms => { delays.push(ms); } });
  assert.equal(value, "same transaction completed"); assert.equal(attempts, 3); assert.deepEqual(delays, [50, 100]);
});
test("persistent IO errors stop after six attempts; semantic errors never retry", async () => {
  let attempts = 0;
  await assert.rejects(() => retryTransientIo(() => { attempts++; throw Object.assign(new Error("locked"), { code: "EBUSY" }); }, { sleep: async () => {} }));
  assert.equal(attempts, 6); attempts = 0;
  await assert.rejects(() => retryTransientIo(() => { attempts++; throw new Error("hash mismatch"); }, { sleep: async () => {} }));
  assert.equal(attempts, 1);
});
test("current request is resolved by exact package output path, not old request basenames", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "painter-request-test-"));
  fs.mkdirSync(path.join(root, "current"));
  const file = path.join(root, "current/diagnostic-request.json");
  const data = Buffer.from(JSON.stringify({ schemaVersion: "ai-painter-diagnostic-shadow-request-v1", identity: "current-id",
    outputRoot: "current", mode: "cpu_readonly_shadow_no_training_or_release",
    limits: { wallSeconds: 180, cpuThreads: 4, optimizerSteps: 0, newRollouts: 0, automaticRetries: 0, maxOutputMiB: 4 } }));
  fs.writeFileSync(file, data);
  const current = { path: "current/diagnostic-request.json", sha256: crypto.createHash("sha256").update(data).digest("hex") };
  const context = { projectRoot: root, packageIdentity: "current-id", outputRoot: "current",
    inputEvidence: [{ path: "old/diagnostic-request.json", sha256: "a".repeat(64) }, current] };
  try {
    assert.equal(requestOf(context).request.identity, "current-id");
    assert.throws(() => requestOf({ ...context, inputEvidence: [current, current] }), /one diagnostic request/);
    assert.throws(() => requestOf({ ...context, inputEvidence: context.inputEvidence.slice(0, 1) }), /one diagnostic request/);
    assert.throws(() => requestOf({ ...context, packageIdentity: "another-id" }));
  } finally { fs.unlinkSync(file); fs.rmdirSync(path.join(root, "current")); fs.rmdirSync(root); }
});
test("launch requires the same idle registry and preserves the latest training", () => {
  const request = { expectedPreviousRevision: 84, expectedPreviousSha256: "c".repeat(64), latestTrainingRunId: "training-id" };
  const current = { ok: true, registrySha256: "c".repeat(64), registry: {
    registryRevision: 84, activeExecution: null, latestTrainingTerminal: { runId: "training-id" } } };
  assert.doesNotThrow(() => validateLaunchSnapshot(request, current));
  for (const change of [c => { c.ok = false; }, c => { c.registry.registryRevision++; },
    c => { c.registrySha256 = "d".repeat(64); }, c => { c.registry.activeExecution = { processId: 1 }; },
    c => { c.registry.latestTrainingTerminal.runId = "different"; }]) {
    const invalid = structuredClone(current); change(invalid);
    assert.throws(() => validateLaunchSnapshot(request, invalid));
  }
});
test("phase consumption verifies both SQLite evidence hash and output hash", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "painter-phase-test-"));
  const output = path.join(root, "output"), execution = path.join(root, "execution");
  const evidenceDir = path.join(execution, "phase-evidence");
  fs.mkdirSync(output); fs.mkdirSync(execution); fs.mkdirSync(evidenceDir);
  const artifactPath = path.join(output, "execute.json"), envelopePath = path.join(evidenceDir, "execute-attempt-0.json");
  const databasePath = path.join(execution, "execution.sqlite");
  const hash = value => crypto.createHash("sha256").update(value).digest("hex");
  const artifact = Buffer.from('{"replay":"fixture"}');
  const envelope = Buffer.from(JSON.stringify({ result: { artifact: { path: "output/execute.json", sha256: hash(artifact) } } }));
  fs.writeFileSync(artifactPath, artifact); fs.writeFileSync(envelopePath, envelope);
  const db = new DatabaseSync(databasePath);
  try {
    db.exec("CREATE TABLE artifacts (package_identity TEXT, phase TEXT, logical_path TEXT, sha256 TEXT)");
    db.prepare("INSERT INTO artifacts VALUES (?,?,?,?)").run("fixture", "execute", "phase-evidence/execute-attempt-0.json", hash(envelope));
  } finally { db.close(); }
  const context = { projectRoot: root, executionRoot: execution, outputRoot: "output", packageIdentity: "fixture" };
  try {
    assert.equal(loadPhase(context, "execute").replay, "fixture");
    fs.writeFileSync(artifactPath, '{"replay":"changed"}'); assert.throws(() => loadPhase(context, "execute"), /hash mismatch/);
    fs.writeFileSync(artifactPath, artifact);
    fs.writeFileSync(envelopePath, '{}'); assert.throws(() => loadPhase(context, "execute"), /SQLite ledger/);
  } finally {
    for (const file of [artifactPath, envelopePath, databasePath]) fs.unlinkSync(file);
    fs.rmdirSync(evidenceDir); fs.rmdirSync(execution); fs.rmdirSync(output); fs.rmdirSync(root);
  }
});

test("actual six-phase runner consumes zero-based evidence and does not replay a terminal package", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "painter-shadow-loop-test-"));
  const contract = path.join(root, CLOSED_LOOP_CONTRACT_PATH);
  fs.mkdirSync(path.dirname(contract), { recursive: true });
  fs.copyFileSync(path.resolve(CLOSED_LOOP_CONTRACT_PATH), contract);
  fs.writeFileSync(path.join(root, "adapter.mjs"), 'export function stub() { return {status:"passed"}; }');
  fs.writeFileSync(path.join(root, "input.json"), '{}');
  const hash = value => crypto.createHash("sha256").update(value).digest("hex");
  const adapterSha = hash(fs.readFileSync(path.join(root, "adapter.mjs")));
  const outputRoot = ".runtime/ai-painter/fixture-shadow-output";
  fs.mkdirSync(path.join(root, outputRoot), { recursive: true });
  const spec = { schemaVersion: "ai-painter-autonomous-closed-loop-package-v1", packageIdentity: "diagnostic-shadow-loop-fixture",
    capabilityVersion: "shadow-fixture", ownerAuthorizationRequired: false, ownerInStateMachine: false,
    maxInfrastructureRecoveryAttempts: 0, outputRoot, programLineage: { adapter: adapterSha },
    inputEvidence: [{ path: "input.json", sha256: hash('{}') }],
    phaseAdapters: Object.fromEntries(PHASES.map(p => [p, { kind: "project_module_export", path: "adapter.mjs", sha256: adapterSha, exportName: "stub" }])) };
  const packageSha256 = hash(JSON.stringify(spec, null, 2) + "\n");
  const calls = [];
  const adapters = Object.fromEntries(PHASES.map((name, index) => [name, async context => {
    if (index) assert.equal(loadPhase(context, PHASES[index - 1]).phase, PHASES[index - 1]);
    calls.push(name);
    const data = Buffer.from(JSON.stringify({ phase: name }));
    const location = `${outputRoot}/${name}.json`;
    fs.writeFileSync(path.join(root, location), data, { flag: "wx" });
    return { status: "passed", artifact: { path: location, sha256: hash(data) } };
  }]));
  try {
    const state = await runAutonomousClosedLoop({ root, spec, packageSha256, adapters });
    assert.equal(state.state, "completed"); assert.deepEqual(calls, PHASES);
    const again = await runAutonomousClosedLoop({ root, spec, packageSha256,
      adapters: Object.fromEntries(PHASES.map(p => [p, () => { throw Error("must not replay"); }])) });
    assert.equal(again.state, "completed"); assert.deepEqual(calls, PHASES);
  } finally {
    // Only the exact directory created by mkdtemp above is test-owned.
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert(path.basename(root).startsWith("painter-shadow-loop-test-"));
    fs.rmSync(root, { recursive: true, force: false });
  }
});
