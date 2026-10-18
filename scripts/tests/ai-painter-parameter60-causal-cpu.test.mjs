import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { CPU_POLICY, validateParameter60CpuPolicy, createCpuEvidenceWriter, preserveCpuFailure,
  requireCpuDeadline } from "../check-ai-painter-parameter60-causal-cpu.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const bytes = fs.readFileSync(path.join(root, CPU_POLICY.path));
const policy = JSON.parse(bytes);
const clone = () => JSON.parse(JSON.stringify(policy));

test("registered policy is exact and CPU-only; diagnostic success grants no qualification", () => {
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), CPU_POLICY.sha256);
  assert.deepEqual(validateParameter60CpuPolicy(policy), { schemaValidated: true, qualificationGranted: false });
  const formal = fs.readFileSync(path.join(root, policy.formalSpecification.path));
  assert.equal(crypto.createHash("sha256").update(formal).digest("hex"), policy.formalSpecification.sha256);
  assert.ok(formal.toString("utf8").includes(CPU_POLICY.path));
});

test("each forbidden qualification and source-state use is rejected", () => {
  for (const key of Object.keys(policy.qualification)) {
    const changed = clone();
    changed.qualification[key] = true;
    assert.throws(() => validateParameter60CpuPolicy(changed), { name: "AssertionError" }, key);
  }
  for (const key of ["trainingInitializationAllowed", "historicalReplayAllowed", "archivedGradientsInstalled",
    "archivedRngRestored", "requiresGradHistoricalClaim"]) {
    const changed = clone();
    changed.sourceStateUse[key] = true;
    assert.throws(() => validateParameter60CpuPolicy(changed), { name: "AssertionError" }, key);
  }
  const changed = clone();
  changed.qualification.extraTrainingFlag = false;
  assert.throws(() => validateParameter60CpuPolicy(changed));
});

test("CPU budget, real numerical work and tolerance widening are rejected", () => {
  for (const [key, value] of Object.entries(policy.resources)) {
    const changed = clone();
    changed.resources[key] = value + 1;
    assert.throws(() => validateParameter60CpuPolicy(changed), { name: "AssertionError" }, key);
  }
  for (const key of ["atol", "rtol"]) {
    const changed = clone();
    changed.comparison[key] *= 2;
    assert.throws(() => validateParameter60CpuPolicy(changed));
  }
  for (const key of ["originalGateKept", "originalGradientValuesKept", "evidenceOnly"]) {
    const changed = clone();
    changed.comparison[key] = false;
    assert.throws(() => validateParameter60CpuPolicy(changed));
  }
});

test("different sample/split/model layer/specification/actions cannot reuse this policy", () => {
  const edits = [
    p => { p.scope.sampleSplit = "validation"; },
    p => { p.scope.sampleCount = 2; },
    p => { p.scope.resolution = [512, 384]; },
    p => { p.scope.failureSampleId = "another-train-sample"; },
    p => { p.scope.sourceStateTiming = "before_exception"; },
    p => { p.scope.sourceReplayAllowedRemainsFalse = false; },
    p => { p.target.parameterIndex = 52; },
    p => { p.target.parameterName += "_other"; },
    p => { p.target.weightShape[0] = 47; },
    p => { p.formalSpecification.version = "AI-PAINTER-SPEC-1.60"; },
    p => { p.allowedActions.push("train"); },
    p => { p.unimplementedGpuScope.executableEntryRegistered = true; },
    p => { p.sourceAlgorithmBindings.reverse(); },
    p => { p.sourceEvidence.pop(); },
    p => { p.outputRoot = ".runtime/ai-painter/old-failed-run"; },
  ];
  for (const edit of edits) {
    const changed = clone();
    edit(changed);
    assert.throws(() => validateParameter60CpuPolicy(changed));
  }
});

test("CPU entry never dispatches old training, registry writers or a GPU worker", () => {
  const source = fs.readFileSync(path.join(root, policy.entrypointPath), "utf8");
  assert.ok(source.includes("runOwnedWorker(python, argv"));
  assert.ok(source.includes("productionRegistryWritten"));
  for (const prohibited of ["runOwnedGpu", "registerExecution(", "spawnBackground(", "--train", "--gpu"]) {
    assert.ok(!source.includes(prohibited), prohibited);
  }
});

test("normal evidence cannot consume the failure reserve or overwrite prior bytes", t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "parameter60-cpu-evidence-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(folder)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(folder).startsWith("parameter60-cpu-evidence-"));
    assert.ok(!fs.lstatSync(folder).isSymbolicLink());
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const put = createCpuEvidenceWriter(folder, 65536 + 512);
  const original = put("request.json", { fixture: "x".repeat(400) });
  assert.ok(original.bytes < 512);
  assert.throws(() => put("worker.json", { fixture: "x".repeat(100) }), /quota/);
  assert.throws(() => put("request.json", {}), /EEXIST/);
  const failure = put("failure.json", { error: "fixture primary failure" }, { failure: true });
  assert.ok(failure.bytes > 0);
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(folder, "request.json"))).digest("hex"), original.sha256);
});

test("missing registry does not replace a primary failure or prevent its bounded record", () => {
  const primary = new Error("fixture worker failure");
  primary.stderr = "x".repeat(20000);
  const observed = [];
  const returned = preserveCpuFailure(primary, { runId: "fixture", requestBinding: {},
    registryBefore: { sha256: "a".repeat(64) },
    readRegistryHash: () => { throw new Error("fixture registry unavailable"); },
    put: (...args) => { observed.push(args); return { fixture: "failure binding" }; },
    now: () => "fixture-time" });
  assert.equal(returned, primary);
  assert.equal(primary.message, "fixture worker failure");
  assert.equal(observed.length, 1);
  const [name, record, options] = observed[0];
  assert.equal(name, "failure.json");
  assert.equal(record.registryUnchanged, null);
  assert.equal(record.registryObservationError, "fixture registry unavailable");
  assert.equal(record.stderr.truncated, true);
  assert.equal(record.stderr.originalBytes, 20000);
  assert.equal(Buffer.byteLength(record.stderr.text), 16384);
  assert.deepEqual(options, { failure: true });
});

test("failure persistence error remains secondary and preserves the identical primary exception", () => {
  const primary = new Error("fixture numerical primary");
  const returned = preserveCpuFailure(primary, { runId: "fixture", requestBinding: {},
    registryBefore: { sha256: "a".repeat(64) }, readRegistryHash: () => "a".repeat(64),
    put: () => { throw new Error("fixture disk failure"); } });
  assert.equal(returned, primary);
  assert.equal(primary.message, "fixture numerical primary");
  assert.match(primary.secondaryCpuEvidenceError, /fixture disk failure/);
  assert.equal(primary.evidence, undefined);
});

test("total deadline is checked after computation, not just before the worker starts", () => {
  requireCpuDeadline(120000, 119999);
  assert.throws(() => requireCpuDeadline(120000, 120000), /total wall deadline/);
  assert.throws(() => requireCpuDeadline(120000, 120001), /total wall deadline/);
  const source = fs.readFileSync(path.join(root, policy.entrypointPath), "utf8");
  const completed = source.indexOf("reader.verifyStable();", source.indexOf("result = await"));
  const reportWrite = source.indexOf('put("report.json"');
  const finalCheck = source.indexOf("requireCpuDeadline(deadline);", reportWrite);
  assert.ok(source.indexOf("requireCpuDeadline(deadline);", completed) < reportWrite);
  assert.ok(finalCheck > reportWrite && finalCheck < source.indexOf("return { status: value.status"));
});
