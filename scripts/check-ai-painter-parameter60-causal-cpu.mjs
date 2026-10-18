// Independent CPU preparation. This is not a GPU/training scheduler.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReader } from "./lib/ai-painter-stage4-dataset-audit.mjs";
import { runOwnedWorker } from "./lib/ai-painter-owned-worker-v1.mjs";

export const CPU_POLICY = Object.freeze({
  path: "data/ai-painter/system-governance/ai-painter-parameter60-causal-cpu-policy-v1.json",
  sha256: "67cec6ef0c5c2d395eb9f7f4e13d9ec301c35366db6597c361379efd4bd7c51f",
});
const SELF = fileURLToPath(import.meta.url);
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const LABELS = ["actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb"];
const SOURCE_ROLES = ["decode1Bridge", "decode1Model", "decode1Operator", "trainingProfile", "capture"];
const FAILURE_RESERVE = 65536;
const OWN_PROGRAMS = [
  "scripts/check-ai-painter-parameter60-causal-cpu.mjs",
  "scripts/lib/ai-painter-owned-worker-v1.mjs",
  "scripts/lib/ai-painter-owned-worker-native-v1.mjs",
  "scripts/windows/ai-painter-owned-worker-owner.cs",
  "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
  "ml/ai-painter/scripts/check_parameter60_causal_preflight_cpu.py",
  "ml/ai-painter/src/ai_painter/complete_world/parameter60_causal_restore_v1.py",
  "ml/ai-painter/src/ai_painter/complete_world/parameter60_causal_observation_v1.py",
  "ml/ai-painter/tests/test_parameter60_causal_restore_v1.py",
  "ml/ai-painter/tests/test_parameter60_causal_observation_v1.py",
];

export function validateParameter60CpuPolicy(policy) {
  assert.equal(policy.schemaVersion, "ai-painter-parameter60-causal-cpu-policy-v1");
  assert.equal(policy.status, "active_cpu_preflight_only_not_gpu_or_training");
  assert.equal(policy.formalSpecification.version, "AI-PAINTER-SPEC-1.62");
  assert.equal(policy.formalSpecification.path, "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md");
  assert.match(policy.formalSpecification.sha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(policy.resources, { maxWallSeconds: 120, threads: 2, maxOutputBytes: 8388608,
    cudaCalls: 0, fullModelForwards: 0, fullModelAutogradCalls: 0, optimizerConstruction: 0, optimizerUpdates: 0 });
  assert.deepEqual(policy.gradientLabels, LABELS);
  assert.deepEqual(policy.scope.resolution, [256, 192]);
  assert.equal(policy.scope.sampleSplit, "train");
  assert.equal(policy.scope.sampleCount, 1);
  assert.equal(policy.scope.failureSampleId, "ai-cold-start-v7-v7-capacity-slot-157-grassland-forest-transition-v2");
  assert.equal(policy.scope.sourceStateTiming, "after_exception");
  assert.equal(policy.scope.sourceReplayAllowedRemainsFalse, true);
  assert.equal(policy.scope.originalDataSplits, "48/8/4/4 unchanged");
  assert.equal(policy.target.parameterIndex, 60);
  assert.equal(policy.target.parameterName, "core.core.terrain.full_resolution_detail.layers.3.weight");
  assert.deepEqual(policy.target.weightShape, [48, 48, 3, 3]);
  assert.equal(policy.comparison.atol, 1e-6);
  assert.equal(policy.comparison.rtol, 1e-5);
  assert.equal(policy.comparison.originalGateKept, true);
  assert.equal(policy.comparison.originalGradientValuesKept, true);
  assert.equal(policy.comparison.evidenceOnly, true);
  assert.deepEqual(policy.allowedActions, ["authenticate_exact_failed_snapshot", "restore_cpu_diagnostic_state",
    "synthetic_cpu_observer_and_reference_tests"]);
  assert.deepEqual(policy.sourceStateUse, { purpose: "failure_evidence_cpu_diagnostic_only",
    trainingInitializationAllowed: false, historicalReplayAllowed: false, originalFailureUnchanged: true,
    archivedGradientsInstalled: false, archivedRngRestored: false, requiresGradHistoricalClaim: false });
  assert.deepEqual(Object.keys(policy.qualification).sort(), ["gpuExecutionAllowed", "trainingAllowed",
    "modelModificationAllowed", "checkpointWritten", "rootCauseProven", "stage4Qualified",
    "capabilityReleased", "runtimeFrameAllowed"].sort());
  for (const value of Object.values(policy.qualification)) assert.equal(value, false);
  assert.equal(policy.unimplementedGpuScope.designReferenceOnly, true);
  assert.equal(policy.unimplementedGpuScope.executableEntryRegistered, false);
  assert.deepEqual(policy.sourceAlgorithmBindings.map(item => item.role), SOURCE_ROLES);
  assert.equal(policy.sourceEvidence.length, 4);
  assert.equal(policy.outputRoot, ".runtime/ai-painter/parameter60-causal-cpu-checks");
  assert.equal(policy.entrypointPath, "scripts/check-ai-painter-parameter60-causal-cpu.mjs");
  assert.equal(policy.workerPath, "ml/ai-painter/scripts/check_parameter60_causal_preflight_cpu.py");
  return { schemaValidated: true, qualificationGranted: false };
}

export function requireCpuDeadline(deadline, now = Date.now()) {
  assert.ok(Number.isFinite(deadline) && now < deadline, "CPU total wall deadline exceeded");
}

export function createCpuEvidenceWriter(absolute, maximum) {
  assert.ok(path.isAbsolute(absolute) && Number.isInteger(maximum) && maximum > FAILURE_RESERVE);
  let outputBytes = 0;
  return (name, value, { failure = false } = {}) => {
    assert.ok(/^[a-z-]+\.json$/u.test(name), "private CPU evidence filename required");
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
    const ceiling = failure ? maximum : maximum - FAILURE_RESERVE;
    assert.ok(outputBytes + bytes.length <= ceiling, "CPU evidence quota exceeded");
    fs.writeFileSync(path.join(absolute, name), bytes, { flag: "wx" });
    outputBytes += bytes.length;
    return { sha256: hash(bytes), bytes: bytes.length };
  };
}

function boundedStream(value) {
  if (value == null) return null;
  const bytes = Buffer.from(String(value));
  return { text: bytes.subarray(0, 16384).toString("utf8"), originalBytes: bytes.length,
    truncated: bytes.length > 16384 };
}

export function preserveCpuFailure(primary, { put, requestBinding, runId, registryBefore, readRegistryHash,
  result = null, now = () => new Date().toISOString() }) {
  let registryUnchanged = null;
  let registryObservationError = null;
  try { registryUnchanged = readRegistryHash() === registryBefore.sha256; }
  catch (secondary) { registryObservationError = String(secondary.message ?? secondary).slice(0, 2048); }
  try {
    primary.evidence = put("failure.json", { status: "cpu_preflight_failed_closed", runId,
      recordedAtUtc: now(), request: requestBinding,
      error: String(primary.stack ?? primary).slice(0, 8192), errorCode: primary.code ?? null,
      stdout: boundedStream(primary.stdout ?? result?.stdout),
      stderr: boundedStream(primary.stderr ?? result?.stderr),
      ownedReceipt: primary.ownedReceipt ?? result?.ownedReceipt ?? null,
      registryBefore, registryUnchanged, registryObservationError,
      gpuExecutionAllowed: false, trainingAllowed: false, qualificationGranted: false }, { failure: true });
  } catch (secondary) {
    // Evidence persistence failure cannot replace the original execution error.
    primary.secondaryCpuEvidenceError = String(secondary.stack ?? secondary).slice(0, 4096);
  }
  return primary;
}

export async function runParameter60CpuPreflight(root) {
  assert.equal(process.platform, "win32", "existing owned CPU transport currently requires Windows");
  assert.ok(path.isAbsolute(root), "absolute project root required");
  const started = Date.now();
  const deadline = started + 120000;
  const reader = createReader(root);
  const policy = reader.bound(CPU_POLICY);
  validateParameter60CpuPolicy(policy);
  reader.bytes(policy.formalSpecification.path, policy.formalSpecification.sha256);
  reader.bytes(policy.designBinding.path, policy.designBinding.sha256);
  const registryPath = ".runtime/ai-painter/current-execution-registry/current.json";
  const registryBytes = reader.bytes(registryPath);
  assert.equal(JSON.parse(registryBytes).activeExecution, null, "active execution prevents this CPU check");
  const registryBefore = { path: registryPath, sha256: hash(registryBytes) };
  const guard = path.join(root, ".runtime/ai-painter/owned-worker-guards/active.json");
  assert.ok(!fs.existsSync(guard), "existing CPU guard retained; no automatic removal");
  const originals = policy.sourceEvidence.map(binding => reader.bound(binding));
  const manifest = originals[1];
  assert.equal(manifest.context.split, "train");
  assert.equal(manifest.context.sampleId, policy.scope.failureSampleId);
  const lineage = new Map();
  for (const item of policy.sourceAlgorithmBindings) {
    reader.bytes(item.binding.path, item.binding.sha256);
    lineage.set(item.binding.path, item.binding);
  }
  // Reuse the captured Python lineage, not every old entry or historical document.
  // The CPU worker independently verifies the project modules actually imported.
  for (const binding of Object.values(manifest.context.programBindings)) {
    if (binding.path.startsWith("ml/ai-painter/") && binding.path.endsWith(".py")) {
      if (lineage.has(binding.path)) assert.deepEqual(lineage.get(binding.path), binding, "source role collision");
      reader.bytes(binding.path, binding.sha256);
      lineage.set(binding.path, binding);
    }
  }
  for (const logical of OWN_PROGRAMS) {
    const bytes = reader.bytes(logical);
    lineage.set(logical, { path: logical, sha256: hash(bytes) });
  }
  assert.ok(lineage.size <= 256, "CPU program lineage count exceeded");
  reader.bytes(policy.sourceTensorArchive.path, policy.sourceTensorArchive.sha256);
  for (const binding of Object.values(policy.sourceSampleBindings)) reader.bytes(binding.path, binding.sha256);
  const python = path.join(root, "ml/ai-painter/.venv/Scripts/python.exe");
  const interpreter = { path: python, sha256: hash(fs.readFileSync(python)) };
  reader.verifyStable();
  assert.ok(Date.now() < deadline, "CPU preparation budget exhausted before launch");
  const runId = "parameter60-cpu-" + crypto.randomUUID();
  const outputRoot = policy.outputRoot + "/" + runId;
  const absolute = path.join(root, outputRoot);
  fs.mkdirSync(absolute, { recursive: true });
  assert.equal(fs.realpathSync(absolute), path.join(fs.realpathSync(path.join(root, ".runtime")),
    "ai-painter", "parameter60-causal-cpu-checks", runId), "CPU output storage mapping differs");
  const writeEvidence = createCpuEvidenceWriter(absolute, policy.resources.maxOutputBytes);
  const put = (name, value, options) => {
    const logical = outputRoot + "/" + name;
    return { path: logical, ...writeEvidence(name, value, options) };
  };
  const request = { schemaVersion: "parameter60-causal-cpu-request-v1", runId, outputRoot,
    policy: CPU_POLICY, programBindings: [...lineage.values()], interpreter, deadlineUnixMs: deadline };
  const requestBinding = put("request.json", request);
  const argv = ["-B", path.join(root, policy.workerPath), "--request", requestBinding.path,
    "--request-sha256", requestBinding.sha256];
  let result;
  try {
    result = await runOwnedWorker(python, argv, { cwd: root,
      timeout: Math.max(1, deadline - Date.now()), maxBuffer: 8 * 1024**2,
      abortReason: () => Date.now() >= deadline ? "CPU preparation total wall exhausted" : null,
      env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONDONTWRITEBYTECODE: "1", PYTHONNOUSERSITE: "1",
        PYTHONPATH: [path.join(root, "ml/ai-painter/src"), path.join(root, "ml/ai-painter/scripts")].join(path.delimiter),
        OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2" } });
    const value = JSON.parse(result.stdout);
    assert.equal(value.runId, runId);
    assert.equal(value.status, "cpu_preflight_passed_not_gpu_or_root_cause");
    assert.ok(value.tests.run > 0);
    assert.equal(value.tests.failed + value.tests.errors, 0);
    assert.deepEqual(value.counts, { fullModelForwards: 0, fullModelAutogradCalls: 0,
      optimizerConstruction: 0, optimizerUpdates: 0, cudaCalls: 0 });
    for (const key of ["gpuExecutionAllowed", "trainingAllowed", "rootCauseProven", "stage4Qualified",
      "checkpointWritten", "productionRegistryWritten"]) assert.equal(value[key], false, key);
    assert.equal(result.ownedReceipt.cleanupConfirmed, true);
    assert.equal(result.ownedReceipt.guardReleaseConfirmed, true);
    assert.equal(result.ownedReceipt.ownerClosed, true);
    reader.verifyStable();
    assert.equal(hash(fs.readFileSync(python)), interpreter.sha256, "Python changed during CPU execution");
    requireCpuDeadline(deadline);
    const worker = put("worker-result.json", { value, stderr: result.stderr, ownedReceipt: result.ownedReceipt });
    requireCpuDeadline(deadline);
    const report = put("report.json", { status: value.status, runId, recordedAtUtc: new Date().toISOString(),
      request: requestBinding, worker, registryBefore, registryAfter: registryBefore,
      inputReceipts: reader.receipts(), elapsedMs: Date.now() - started,
      evidenceRole: "CPU_check_result_not_a_training_or_execution_registry_terminal",
      qualificationGranted: false, gpuExecutionAllowed: false, trainingAllowed: false });
    requireCpuDeadline(deadline);
    return { status: value.status, runId, evidence: report, tests: value.tests.run,
      gpuExecutionAllowed: false, trainingAllowed: false };
  } catch (error) {
    throw preserveCpuFailure(error, { put, requestBinding, runId, registryBefore, result,
      readRegistryHash: () => hash(fs.readFileSync(path.join(root, registryPath))) });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  assert.equal(process.argv.length, 2, "CPU entry accepts no scope-widening arguments");
  runParameter60CpuPreflight(path.resolve(path.dirname(SELF), "..")).then(value => {
    console.log(JSON.stringify(value, null, 2));
  }).catch(error => {
    console.error(JSON.stringify({ status: "failed_closed", error: String(error.message), evidence: error.evidence ?? null,
      secondaryCpuEvidenceError: error.secondaryCpuEvidenceError ?? null }));
    process.exitCode = 1;
  });
}
