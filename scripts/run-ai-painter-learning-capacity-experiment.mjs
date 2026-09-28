// One bounded experiment controller using the existing current-registry writer.
// No capability publication, formal-stage advancement, restart or shutdown API.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readCurrentExecutionRegistry, advanceCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";

const root = process.cwd();
const python = path.join(root, "ml/ai-painter/.venv/Scripts/python.exe");
const defaultWorker = "ml/ai-painter/scripts/painter_learning_capacity_experiment.py";
const reconstructionPolicy = "data/ai-painter/system-governance/ai-painter-decoder-reconstruction-experiment-policy-v1.json";
const v11TrainOnlyPolicy = "data/ai-painter/system-governance/stage4-mvp-v11-train-only-capacity-probe-v1.json";
const consumedV21TrainOnlyPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-train-only-capacity-probe-v1.json";
const v21TrainOnlyPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-train-only-capacity-probe-v2.json";
export const v21AllTrainFitPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-all-train-fit-readonly-policy-v1.json";
const consumedV21FullTrainExposurePolicy = "data/ai-painter/system-governance/stage4-mvp-v21-full-train-exposure-policy-v1.json";
const consumedV21FullTrainExposurePolicyV2 = "data/ai-painter/system-governance/stage4-mvp-v21-full-train-exposure-policy-v2.json";
export const v21FullTrainExposurePolicy = "data/ai-painter/system-governance/stage4-mvp-v21-full-train-exposure-policy-v3.json";
const consumedWholeFrameFidelityPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-whole-frame-fidelity-policy-v1.json";
export const wholeFrameFidelityPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-whole-frame-fidelity-policy-v2.json";
export function wholeFrameObjectiveValid(result, pkg, readProof = binding => {
  assert.deepEqual(binding, bind(binding.path)); return read(binding.path);
}) {
  try {
    const plan = pkg?.inputs?.objectivePlan;
    assert.equal(pkg?.policy?.path, wholeFrameFidelityPolicy);
    assert.deepEqual(pkg.inputs.heartbeatPublicationRule, heartbeatPublicationRule);
    assert.deepEqual(result.heartbeatPublicationRule, heartbeatPublicationRule);
    assert.equal(plan?.candidateId, "stage4_mvp_v21_whole_frame_fidelity_cpu_candidate_v1");
    assert.equal(plan.rgbWeight, 1); assert.equal(plan.edgeWeight, .25);
    assert.equal(plan.formula, "unchanged_v21_total_plus_full_rgb_l1_plus_signed_adjacent_edge_l1");
    assert.equal(plan.coefficientSelection, "fixed_inherited_v13_coefficients_no_search");
    assert.equal(plan.targetSplit, "train"); assert.equal(plan.existingTermsPreserved, true);
    assert.equal(plan.qualificationGranted, false);
    assert.deepEqual(plan.program, bind("ml/ai-painter/src/ai_painter/complete_world/native_rgb_whole_frame_fidelity_candidate_cpu.py"));
    assert.deepEqual(plan.tests, bind("ml/ai-painter/tests/test_native_rgb_whole_frame_fidelity_candidate_cpu.py"));
    assert.equal(plan.cpuEvidence.path, ".runtime/ai-painter/learning-capacity-experiments/v21-full-train-exposure-5464211239b5f3b53e0a2675c9fe5f7e208c21ab7bbb6ed6/controller-whole-frame-fidelity-cpu-candidate.json");
    assert.deepEqual(plan.cpuEvidence, bind(plan.cpuEvidence.path));
    assert.deepEqual(result.objectivePlan, plan);
    assert.equal(result.historicalComparisonPurpose, "changed_loss_comparison_not_numerical_reproduction");
    assert.equal(plan.historicalComparisonPurpose, result.historicalComparisonPurpose);
    assert.equal(result.zeroUpdateGpuProbePassed, true);
    const proofPath = `${pkg.outputRoot}/zero-update-gpu-probe.json`;
    const proofs = result.artifacts.filter(item => item.path === proofPath);
    assert.equal(proofs.length, 1);
    const proof = readProof(proofs[0]);
    assert.equal(proof.passed, true); assert.equal(proof.caseCount, 48);
    assert.equal(proof.optimizerCreated, false);
    assert.deepEqual(proof.optimizerSteps, { generator: 0, discriminator: 0 });
    assert.equal(proof.cases.length, 48);
    for (const [index, entry] of proof.cases.entries()) {
      assert.equal(entry.objectiveId, plan.candidateId);
      assert.equal(entry.passed, true); assert.equal(entry.optimizerCreated, false);
      assert.deepEqual(entry.optimizerSteps, proof.optimizerSteps);
      assert.deepEqual(entry.initialStateSha256, entry.finalStateSha256);
      for (const key of ["Model", "Critic"]) assert.match(entry.initialStateSha256[key], /^[a-f0-9]{64}$/u);
      assert.equal(entry.case.sampleId, pkg.selectedRows[index].sampleId);
      assert.equal(entry.case.trainOrdinal, index); assert.equal(entry.case.split, "train");
      for (const key of ["v21UnchangedTotal", "wholeFrameRgbMae", "wholeFrameSignedEdgeMae", "wholeFrameFidelity"])
        assert(Number.isFinite(entry.objectiveTerms[key]));
    }
    return true;
  } catch { return false; }
}
export const progressPublicationRule = Object.freeze({ schemaVersion: "bounded_windows_progress_publication_v1",
  maxReplaceAttempts: 6, retryDelaySeconds: .05, retryableWindowsErrors: [5, 32, 33],
  sameStagedBytesOnly: true, persistentFailureAction: "fail_closed" });
export function exposureProgressPublicationValid(pkg) {
  try { assert.deepEqual(pkg?.inputs?.progressPublicationRule, progressPublicationRule); return true; }
  catch { return false; }
}
const env = { ...process.env, PYTHONPATH: [path.join(root, "ml/ai-painter/src"), path.join(root, "ml/ai-painter/scripts")].join(path.delimiter), PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1", CUBLAS_WORKSPACE_CONFIG: ":4096:8" };
const sha = data => createHash("sha256").update(data).digest("hex");
const bind = logical => ({ path: logical, sha256: sha(fs.readFileSync(path.join(root, logical))) });
const read = logical => JSON.parse(fs.readFileSync(path.join(root, logical), "utf8"));
export function readonlyTrainFitSucceeded(result, pkg, exitCode, timedOut = false) {
  if (exitCode !== 0 || timedOut || !result || !pkg) return false;
  if (result.status !== "readonly_train_fit_diagnostic_completed_no_qualification"
    || result.trainingStarted !== false || result.optimizerCreated !== false
    || result.optimizerSteps?.generator !== 0 || result.optimizerSteps?.discriminator !== 0
    || result.forwardCalls !== 48 || result.checkpointWritten !== false
    || result.modelStateUnchanged !== true || result.sourceBytesUnchanged !== true
    || result.experimentIdentity !== pkg.experimentIdentity
    || !Array.isArray(result.artifacts)
    || !Array.isArray(result.samples) || result.samples.length !== 48
    || !Array.isArray(pkg.selectedRows) || pkg.selectedRows.length !== 48) return false;
  const ids = new Set();
  return result.samples.every((row, ordinal) => {
    const expected = pkg.selectedRows[ordinal];
    if (!row || !expected || typeof expected.sampleId !== "string" || ids.has(expected.sampleId)) return false;
    ids.add(expected.sampleId);
    return expected.split === "train" && expected.trainOrdinal === ordinal
      && row.sampleId === expected.sampleId && row.split === "train" && row.trainOrdinal === ordinal;
  });
}
export function exposureTelemetryFromProgress(progress, runId, normalize, lastStep = 0) {
  assert.equal(progress?.experimentIdentity, runId, "exposure_progress_run_mismatch");
  if (progress.trainingStarted !== true || progress.trainingProgress == null) return null;
  const generator = progress.optimizerSteps?.generator;
  const discriminator = progress.optimizerSteps?.discriminator;
  assert(Number.isSafeInteger(generator) && generator >= lastStep && generator <= 2304
    && Number.isSafeInteger(discriminator) && discriminator >= generator && discriminator <= generator + 1 && discriminator <= 2304,
  "exposure_progress_update_count_invalid");
  const normalized = normalize(progress.trainingProgress);
  assert(normalized.epoch >= 1 && normalized.epoch <= 48 && normalized.batchCount === 48
    && normalized.optimizationStep === generator, "exposure_progress_training_fields_invalid");
  return normalized;
}
export function exposureComparisonDiagnosticValid(result, pkg) {
  const report = result?.epoch24Reproduction;
  const rule = pkg?.inputs?.reproductionRule;
  if (![v21FullTrainExposurePolicy, wholeFrameFidelityPolicy].includes(pkg?.policy?.path) || !report || !rule
    || result.epoch24ReproductionEvidenceValid !== true || report.evidenceValid !== true
    || typeof result.epoch24ReproductionPassed !== "boolean" || report.passed !== result.epoch24ReproductionPassed
    || rule.epoch !== 24 || rule.maximumAbsoluteMedianCorrelationDifferenceEachRole !== .03
    || rule.maximumRelativeMeanRgbMaeDifference !== .05 || rule.all48CorrelationsRequiredEachRole !== true
    || rule.failureAction !== "diagnostic_only_no_early_stop" || rule.invalidEvidenceAction !== "fail_closed"
    || rule.formalAuditThreshold !== false || !report.rule
    || Object.keys(rule).length !== Object.keys(report.rule).length
    || !Object.keys(rule).every(key => rule[key] === report.rule[key])) return false;
  let insideTolerance = true;
  for (const role of ["object_footprints", "object_tree", "object_rock", "object_vegetation"]) {
    const left = report.actual?.objects?.[role], right = report.reference?.objects?.[role];
    const difference = report.medianCorrelationAbsoluteDifferences?.[role];
    if (left?.validCorrelationCount !== 48 || right?.validCorrelationCount !== 48
      || !Number.isFinite(left.medianCorrelation) || !Number.isFinite(right.medianCorrelation)
      || Math.abs(left.medianCorrelation) > 1 || Math.abs(right.medianCorrelation) > 1
      || !Number.isFinite(difference) || difference < 0
      || Math.abs(difference - Math.abs(left.medianCorrelation - right.medianCorrelation)) > 1e-12) return false;
    insideTolerance &&= difference <= .03;
  }
  const actual = report.actual?.meanRgbMae, reference = report.reference?.meanRgbMae;
  if (!Number.isFinite(actual) || !Number.isFinite(reference) || actual < 0 || reference < 0) return false;
  const relative = reference > 0 ? Math.abs(actual - reference) / reference : actual === 0 ? 0 : null;
  if (relative === null || !Number.isFinite(report.meanRgbMaeRelativeDifference)
    || Math.abs(report.meanRgbMaeRelativeDifference - relative) > 1e-12) return false;
  return report.passed === (insideTolerance && relative <= .05);
}
export function fullTrainExposureSucceeded(result, pkg, exitCode, timedOut = false) {
  if (exitCode !== 0 || timedOut || !result || !pkg
    || result.schemaVersion !== "ai-painter-learning-capacity-experiment-result-v1"
    || pkg.schemaVersion !== "ai-painter-learning-capacity-experiment-package-v1"
    || result.evidenceContractVersion !== 1 || pkg.evidenceContractVersion !== 1
    || !["all_train_exposure_only", "whole_frame_fidelity_train_only"].includes(result.experimentType) || pkg.experimentType !== result.experimentType
    || result.status !== "experiment_executed_not_visual_qualified" || result.experimentIdentity !== pkg.experimentIdentity
    || result.trainingStarted !== true || result.completedEpochs !== 48 || result.sourceBytesUnchanged !== true
    || result.optimizerSteps?.generator !== 2304 || result.optimizerSteps?.discriminator !== 2304
    || result.checkpointReloadExact !== true || !Array.isArray(result.artifacts)
    || !Array.isArray(pkg.selectedRows) || pkg.selectedRows.length !== 48
    || !Array.isArray(pkg.observationPlan) || pkg.observationPlan.length !== 3
    || !Array.isArray(result.trainOnlyObservations) || result.trainOnlyObservations.length !== 144
    || !Array.isArray(pkg.imagePlan) || pkg.imagePlan.length !== 4
    || !Array.isArray(result.imageArtifacts) || result.imageArtifacts.length !== 4
    || !exposureComparisonDiagnosticValid(result, pkg) || !exposureProgressPublicationValid(pkg)) return false;
  if (result.experimentType === "whole_frame_fidelity_train_only" ? !wholeFrameObjectiveValid(result, pkg)
    : pkg.policy.path !== v21FullTrainExposurePolicy) return false;
  for (const key of ["stage4QualificationGranted", "checkpointPromotable", "validationContentRead", "challengeContentRead", "regressionContentRead"])
    if (result[key] !== false) return false;
  const expectedPoints = [[0, 0], [24, 1152], [48, 2304]];
  if (!pkg.observationPlan.every((p, i) => p?.epoch === expectedPoints[i][0] && p.optimizerStep === expectedPoints[i][1])) return false;
  const selected = new Map();
  for (const [ordinal, row] of pkg.selectedRows.entries()) {
    if (!row || typeof row.sampleId !== "string" || row.split !== "train" || row.trainOrdinal !== ordinal || selected.has(row.sampleId)) return false;
    selected.set(row.sampleId, row);
  }
  const seen = new Set();
  for (const row of result.trainOnlyObservations) {
    if (!row || !selected.has(row.sampleId) || row.split !== "train"
      || !expectedPoints.some(([epoch, step]) => row.epoch === epoch && row.optimizerStep === step)
      || !row.measurements || typeof row.measurements !== "object" || Array.isArray(row.measurements)) return false;
    const key = `${row.epoch}:${row.optimizerStep}:${row.sampleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  const expectedImages = new Set([0, 43].flatMap(ordinal => ["prediction", "target_final_comparison"].map(purpose => `${pkg.selectedRows[ordinal].sampleId}:${purpose}`)));
  const imageKey = row => row?.split === "train" && row.epoch === 48 && row.optimizerStep === 2304 ? `${row.sampleId}:${row.purpose}` : null;
  const planned = pkg.imagePlan.map(imageKey), actual = result.imageArtifacts.map(imageKey);
  const artifacts = new Map();
  for (const item of result.artifacts) {
    if (typeof item?.path !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256) || artifacts.has(item.path)) return false;
    artifacts.set(item.path, item.sha256);
  }
  if (!result.checkpoint || artifacts.get(result.checkpoint.path) !== result.checkpoint.sha256) return false;
  if (!result.imageArtifacts.every(image => typeof image?.path === "string"
    && /\.(png|jpe?g)$/iu.test(image.path) && artifacts.get(image.path) === image.sha256
    && typeof image.sourceLabel === "string" && image.sourceLabel.trim().length > 0)) return false;
  return planned.every(key => expectedImages.has(key)) && new Set(planned).size === 4
    && actual.every(key => expectedImages.has(key)) && new Set(actual).size === 4;
}
export async function drainExperimentTelemetry(task, timeoutMs = 15000) {
  let timer;
  try {
    return await Promise.race([Promise.resolve(task).then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); })]);
  } finally { clearTimeout(timer); }
}
export function experimentWorkerTimeoutMs(resources, fullTrainExposure = false) {
  assert(Number.isSafeInteger(resources?.maxWallSeconds) && resources.maxWallSeconds > 0);
  return (resources.maxWallSeconds + (fullTrainExposure ? 0 : 30)) * 1000;
}
export function observedExperimentTermination(result, progress, runId) {
  if (result) {
    assert.equal(result.experimentIdentity, runId, "terminal_result_run_mismatch");
    return { gpuStarted: result.gpuStarted ?? null, trainingStarted: result.trainingStarted ?? null,
      lastConfirmedOptimizerSteps: result.optimizerSteps ?? null, actualFinalOptimizerSteps: result.optimizerSteps ?? null };
  }
  if (progress) assert.equal(progress.experimentIdentity, runId, "terminal_progress_run_mismatch");
  return { gpuStarted: progress?.gpuStarted ?? null, trainingStarted: progress?.trainingStarted ?? null,
    lastConfirmedOptimizerSteps: progress?.optimizerSteps ?? null, actualFinalOptimizerSteps: null };
}
export const heartbeatPublicationRule = Object.freeze({
  maxReplaceAttempts: 21, retryDelayMilliseconds: 100, maxWaitMilliseconds: 2000,
  sameStagedBytesOnly: true, preservePreviousHeartbeat: true, automaticTrainingRetries: 0,
});
export function replaceHeartbeatFile(temporary, target, {
  rename = fs.renameSync,
  pause = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds),
  now = () => performance.now(),
} = {}) {
  // Retry only publication of these exact staged bytes. A bounded sharing
  // violation is not a model retry; permanent errors still fail closed. Keep
  // the old heartbeat readable, and never delete it to force replacement.
  const started = now();
  let lastError;
  let attempts = 0;
  const elapsed = () => Math.max(0, now() - started);
  const fail = error => {
    error.heartbeatPublication = { ...heartbeatPublicationRule, attempts, elapsedMilliseconds: elapsed(),
      temporary, target, errorCode: error.code ?? null };
    throw error;
  };
  while (attempts < heartbeatPublicationRule.maxReplaceAttempts) {
    if (lastError && elapsed() >= heartbeatPublicationRule.maxWaitMilliseconds) fail(lastError);
    attempts += 1;
    try {
      rename(temporary, target);
      return { attempts, elapsedMilliseconds: elapsed(), recovered: attempts > 1 };
    } catch (error) {
      lastError = error;
      const remaining = heartbeatPublicationRule.maxWaitMilliseconds - elapsed();
      if (!["EPERM", "EACCES", "EBUSY"].includes(error.code)
        || attempts >= heartbeatPublicationRule.maxReplaceAttempts || remaining <= 0) fail(error);
      pause(Math.min(heartbeatPublicationRule.retryDelayMilliseconds, remaining));
    }
  }
}
export function guardedHeartbeat(heartbeat, onFailure) {
  try { heartbeat(); return true; }
  catch (error) { onFailure(error); return false; }
}
function write(logical, value, mutable = false) {
  const target = path.join(root, logical);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = mutable ? target + ".tmp" : target;
  const fd = fs.openSync(temporary, mutable ? "w" : "wx");
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  if (mutable) {
    const publication = replaceHeartbeatFile(temporary, target);
    if (publication.recovered) console.warn(JSON.stringify({ event: "heartbeat_publication_recovered",
      path: logical, ...publication, recordedAtUtc: new Date().toISOString() }));
  }
}
function runCpu(args, timeout = 120000) {
  const result = spawnSync(python, args, { cwd: root, env, encoding: "utf8", windowsHide: true, timeout, maxBuffer: 2 ** 22 });
  if (result.error || result.status !== 0) throw new Error(`CPU operation failed: ${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`);
  return result;
}
function processIdentity() {
  const script = `$p=Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${process.pid}'; [pscustomobject]@{ processId=[int]$p.ProcessId; creationDate=$p.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", windowsHide: true, timeout: 10000 });
  assert.equal(result.status, 0, "controller process identity unavailable");
  const value = JSON.parse(result.stdout.replace(/^\uFEFF/u, ""));
  return `${process.pid}:${value.creationDate}`;
}
export function ownedWorkerIsRunning(child) {
  return Boolean(child && child.exitCode === null && child.signalCode === null && Number.isInteger(child.pid) && child.pid > 0);
}
function stopOwnedWorker(child) {
  if (!ownedWorkerIsRunning(child)) return;
  if (process.platform === "win32") {
    // The venv redirector owns the real interpreter. Stop only this spawned tree.
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 10000, encoding: "utf8" });
  } else child.kill("SIGTERM");
}

async function main() {
  const mode = process.argv[2];
  assert(["prepare", "run"].includes(mode), "usage: node scripts/run-ai-painter-learning-capacity-experiment.mjs prepare|run [--policy path]");
  const policy = process.argv[3] === "--policy" && process.argv.length === 5 ? process.argv[4] : null;
  assert(process.argv.length === 3 || policy !== null, "invalid experiment arguments");
  assert(policy !== consumedV21TrainOnlyPolicy, "V21 train-only v1 identity failed closed; use only the bound v2 replacement policy");
  assert(![consumedV21FullTrainExposurePolicy, consumedV21FullTrainExposurePolicyV2].includes(policy), "full exposure v1/v2 were consumed and failed closed; use only the independently bound v3 policy");
  assert(policy !== consumedWholeFrameFidelityPolicy, "whole-frame fidelity v1 was consumed and failed closed; use only the independently bound v2 policy");
  const policyArgs = policy === null ? [] : ["--policy", policy];
  const reconstruction = policy === reconstructionPolicy;
  const v11TrainOnly = policy === v11TrainOnlyPolicy;
  const v21TrainOnly = policy === v21TrainOnlyPolicy;
  const readonlyTrainFit = policy === v21AllTrainFitPolicy;
  const wholeFrameFidelity = policy === wholeFrameFidelityPolicy;
  const fullTrainExposure = policy === v21FullTrainExposurePolicy || wholeFrameFidelity;
  const taskKind = readonlyTrainFit ? "readonly_train_fit_diagnostic" : "bounded_train_only_learning_capacity_experiment";
  const taskGoal = readonlyTrainFit ? "48 train originals, frozen epoch-24 forward only; no weight updates or qualification"
    : wholeFrameFidelity ? "48 train originals, fresh V21 with isolated whole-frame fidelity, maximum 48 epochs; no formal release"
    : fullTrainExposure ? "48 train originals, fresh V21, maximum 48 epochs; no generalization or formal release"
    : reconstruction ? "256x192 decoder-only train reconstruction; encoder frozen; no Denoiser or formal qualification"
    : "256x192 real training and checkpoint reload experiment; no formal qualification or publication";
  const worker = readonlyTrainFit ? "ml/ai-painter/scripts/diagnose_stage4_mvp_v21_all_train_fit_readonly.py"
    : wholeFrameFidelity ? "ml/ai-painter/scripts/painter_stage4_v21_whole_frame_fidelity_probe.py"
    : fullTrainExposure ? "ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py"
    : v21TrainOnly ? "ml/ai-painter/scripts/painter_stage4_v21_train_only_capacity_probe.py"
    : v11TrainOnly ? "ml/ai-painter/scripts/painter_stage4_v11_train_only_capacity_probe.py"
    : reconstruction ? "ml/ai-painter/scripts/painter_decoder_reconstruction_experiment.py" : defaultWorker;
  const testPattern = readonlyTrainFit ? "test_diagnose_stage4_mvp_v21_all_train_fit_readonly.py"
    : wholeFrameFidelity ? "test_stage4_v21_whole_frame_fidelity_probe.py"
    : fullTrainExposure ? "test_stage4_v21_full_train_exposure_probe.py"
    : v21TrainOnly ? "test_stage4_v21_train_only_capacity_probe.py"
    : v11TrainOnly ? "test_stage4_v11_train_only_capacity_probe.py"
    : reconstruction ? "test_decoder_reconstruction_experiment.py" : "test_learning_capacity_experiment.py";
  const entry = read("data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json");
  assert(entry.currentEntrypoints.some(e => e.entryFile === "scripts/run-ai-painter-learning-capacity-experiment.mjs"), "experiment controller is not registered");
  const previous = await readCurrentExecutionRegistry(root);
  assert(previous.ok && previous.registry.activeExecution === null, "current registry is invalid or an execution is active");
  const controllerTests = spawnSync(process.execPath, ["--test", "scripts/tests/test-ai-painter-experiment-heartbeat.mjs",
    ...(wholeFrameFidelity ? ["scripts/tests/test-ai-painter-whole-frame-fidelity-controller.mjs"] : [])], {
    cwd: root, env, encoding: "utf8", windowsHide: true, timeout: 20000, maxBuffer: 2 ** 20,
  });
  assert(!controllerTests.error && controllerTests.status === 0, `controller behavior tests failed: ${controllerTests.error?.message ?? ""}\n${controllerTests.stdout}\n${controllerTests.stderr}`);
  const cpu = runCpu(["-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", testPattern, "-v"]);
  const packageBinding = JSON.parse(runCpu([worker, "prepare", ...policyArgs]).stdout.trim());
  const pkg = read(packageBinding.path);
  assert.equal(bind(packageBinding.path).sha256, packageBinding.sha256);
  if (fullTrainExposure) assert(exposureProgressPublicationValid(pkg), "frozen progress publication rule differs");
  if (wholeFrameFidelity) assert.deepEqual(pkg.inputs.heartbeatPublicationRule, heartbeatPublicationRule,
    "frozen heartbeat publication rule differs");
  const directory = path.posix.dirname(packageBinding.path);
  const cpuPath = `${directory}/cpu-tests.json`;
  if (!fs.existsSync(path.join(root, cpuPath))) write(cpuPath, { status: "experiment_cpu_behavior_tests_passed", executionState: "completed", recordedAtUtc: new Date().toISOString(), stdout: cpu.stdout, stderr: cpu.stderr, package: packageBinding,
    controllerBehaviorTests: { program: bind("scripts/tests/test-ai-painter-experiment-heartbeat.mjs"), exitCode: controllerTests.status, stdout: controllerTests.stdout, stderr: controllerTests.stderr } });
  console.log(JSON.stringify({ status: "experiment_prepared_not_gpu_started", package: packageBinding, cpu: bind(cpuPath) }));
  if (mode === "prepare") return;
  assert(!fs.existsSync(path.join(root, directory, "controller-started.json")), "experiment already consumed; no automatic restart");
  write(`${directory}/controller-started.json`, { recordedAtUtc: new Date().toISOString(), previousRegistry: { revision: previous.registry.registryRevision, sha256: previous.registrySha256 }, package: packageBinding });
  const runId = pkg.experimentIdentity;
  const identity = { capabilityVersion: runId, packageId: runId, runId, processId: process.pid, processStartIdentity: processIdentity() };
  const lockPath = `${directory}/execution-lock.json`;
  const heartbeatPath = `${directory}/heartbeat.json`;
  write(lockPath, { schemaVersion: "ai-painter-current-active-execution-lock-v1", ...identity });
  const heartbeat = () => write(heartbeatPath, { schemaVersion: "ai-painter-current-active-execution-heartbeat-v1", ...identity, executionState: "executing", heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120 }, true);
  heartbeat();
  let registered = false;
  let child = null;
  let heartbeatFailure = null;
  let telemetryTimer = null;
  let telemetryClosed = false;
  let telemetryTask = Promise.resolve();
  let telemetryFailed = false;
  let telemetryLastStep = 0;
  const timer = setInterval(() => guardedHeartbeat(heartbeat, error => {
    heartbeatFailure ??= error;
    clearInterval(timer);
    stopOwnedWorker(child);
  }), 10000);
  const active = { schemaVersion: "ai-painter-current-active-execution-v1", ...identity, executionState: "executing", programLineage: { controller: bind("scripts/run-ai-painter-learning-capacity-experiment.mjs"), worker: bind(worker) }, lock: bind(lockPath), heartbeat: { path: heartbeatPath, ttlSeconds: 120 } };
  const capsule = (logical, evidence) => write(logical, { schemaVersion: "ai-painter-local-task-capsule-v1", taskId: runId, integrity: { status: "verified" }, evidence: evidence.map((b, i) => ({ ...b, kind: `experiment_${i}`, sha256Verified: true })) });
  const cpuCapsule = `${directory}/cpu-capsule.json`;
  capsule(cpuCapsule, [packageBinding, bind(cpuPath)]);
  try {
    const activeResult = await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: runId, packageId: runId, taskId: runId,
      taskKind, taskGoal, queueStatus: "running", nextMachineAction: null,
      runId, lifecycleStage: "isolated_implementation", executionState: "executing", activity: readonlyTrainFit ? "readonly_train_fit_running" : "experiment_running_not_formal_stage4", taskCapsulePath: cpuCapsule, terminalEvidencePath: cpuPath,
      activeExecution: active, expectedPreviousRegistryRevision: previous.registry.registryRevision, expectedPreviousRegistrySha256: previous.registrySha256 });
    assert(activeResult.ok, "experiment active registry commit failed");
    registered = true;
    if (heartbeatFailure) throw heartbeatFailure;
    if (fullTrainExposure) {
      const { createActiveTrainingTelemetryReporter, normalizeActiveTrainingProgress } =
        await import("./lib/ai-painter-active-training-telemetry-v1.mjs");
      const reporter = createActiveTrainingTelemetryReporter({ projectRoot: root, runId, packageId: runId });
      const poll = async () => {
        if (telemetryClosed || telemetryFailed) return;
        const progressPath = `${directory}/progress.json`;
        if (!fs.existsSync(path.join(root, progressPath))) return;
        const progress = exposureTelemetryFromProgress(read(progressPath), runId,
          normalizeActiveTrainingProgress, telemetryLastStep);
        if (!progress || telemetryClosed) return;
        await reporter(progress);
        telemetryLastStep = progress.optimizationStep;
      };
      telemetryTimer = setInterval(() => {
        if (telemetryClosed || telemetryFailed) return;
        telemetryTask = telemetryTask.then(poll).catch(error => {
          telemetryFailed = true;
          write(`${directory}/telemetry-store-failure.json`, {
            status: "telemetry_projection_failed_training_state_unaffected", runId,
            lastConfirmedOptimizationStep: telemetryLastStep, error: String(error.stack ?? error),
            recordedAtUtc: new Date().toISOString(),
          });
        });
      }, 2000);
    }
    let timedOut = false;
    const code = await new Promise((resolve, reject) => {
      child = spawn(python, [worker, "run", "--package", packageBinding.path, "--sha256", packageBinding.sha256], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      write(`${directory}/controller-lease.json`, { experimentIdentity: runId, workerParentPid: process.pid, workerLauncherPid: child.pid,
        registryRevision: activeResult.registry.registryRevision, registrySha256: activeResult.registrySha256 });
      const log = fs.createWriteStream(path.join(root, directory, "worker.log"), { flags: "wx" });
      child.stdout.on("data", data => { log.write(data); process.stdout.write(data); });
      child.stderr.on("data", data => { log.write(data); process.stderr.write(data); });
      const timeout = setTimeout(() => { timedOut = true; stopOwnedWorker(child); }, experimentWorkerTimeoutMs(pkg.resources, fullTrainExposure));
      child.once("error", error => { clearTimeout(timeout); log.end(); reject(error); });
      child.once("close", exitCode => { clearTimeout(timeout); log.end(); resolve(exitCode); });
    });
    clearInterval(timer);
    telemetryClosed = true;
    if (telemetryTimer) clearInterval(telemetryTimer);
    assert(await drainExperimentTelemetry(telemetryTask), "experiment telemetry did not drain before terminal");
    if (heartbeatFailure) throw heartbeatFailure;
    const resultPath = `${directory}/result.json`;
    const result = fs.existsSync(path.join(root, resultPath)) ? read(resultPath) : null;
    const stoppedProgressPath = `${directory}/progress.json`;
    const observedTermination = observedExperimentTermination(result,
      !result && fs.existsSync(path.join(root, stoppedProgressPath)) ? read(stoppedProgressPath) : null, runId);
    const success = readonlyTrainFit ? readonlyTrainFitSucceeded(result, pkg, code, timedOut)
      : fullTrainExposure ? fullTrainExposureSucceeded(result, pkg, code, timedOut)
      : code === 0 && !timedOut && result?.status === "experiment_executed_not_visual_qualified" && result?.checkpointReloadExact === true;
    if (success) for (const artifact of result.artifacts) assert.equal(bind(artifact.path).sha256, artifact.sha256, "experiment output hash changed");
    const terminalPath = `${directory}/terminal.json`;
    write(terminalPath, { schemaVersion: "ai-painter-learning-capacity-experiment-terminal-v1", status: success ? readonlyTrainFit ? "readonly_train_fit_diagnostic_completed_no_qualification" : "experiment_completed_not_formal_qualified" : "experiment_failed_closed",
      executionState: success ? "completed" : "failed_closed", experimentIdentity: runId, runId, recordedAtUtc: new Date().toISOString(), exitCode: code, timedOut,
      result: result ? bind(resultPath) : null, ...observedTermination,
      completedEpochs: fullTrainExposure && Number.isSafeInteger(result?.completedEpochs) && result.completedEpochs >= 0 ? result.completedEpochs : null,
      errorCode: typeof result?.error === "string" ? result.error : null,
      formalTrainingQualified: false, formalStageAdvanced: false, checkpointPromotable: false, worldEntryAllowed: false });
    const terminalCapsule = `${directory}/terminal-capsule.json`;
    capsule(terminalCapsule, [packageBinding, bind(cpuPath), bind(terminalPath), ...(result ? [bind(resultPath)] : [])]);
    const current = await readCurrentExecutionRegistry(root);
    assert(current.ok && current.registry.runId === runId, "current execution changed during experiment");
    const done = await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: runId, packageId: runId, taskId: runId,
      taskKind, taskGoal: readonlyTrainFit ? "Inspect all-48 train fit evidence; not training, generalization or formal release" : "Inspect the saved 256x192 experimental evidence; no formal release", queueStatus: success ? "completed" : "failed_closed", nextMachineAction: null,
      runId, lifecycleStage: "isolated_implementation", executionState: success ? "completed" : "failed_closed", activity: success ? readonlyTrainFit ? "readonly_train_fit_completed" : "experiment_completed" : "experiment_failed_closed",
      taskCapsulePath: terminalCapsule, terminalEvidencePath: terminalPath, activeExecution: null,
      latestTrainingTerminal: !readonlyTrainFit && observedTermination.trainingStarted === true ? { runId, ...bind(terminalPath), status: read(terminalPath).status, evidence: { manifest: bind(result ? resultPath : terminalPath) } } : null,
      expectedPreviousRegistryRevision: current.registry.registryRevision, expectedPreviousRegistrySha256: current.registrySha256 });
    assert(done.ok, `experiment terminal registry commit failed: ${done.errorCode ?? "unknown"}`);
    console.log(JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), registryRevision: done.registry.registryRevision }));
    if (!success) process.exitCode = 1;
  } catch (error) {
    if (ownedWorkerIsRunning(child)) {
      await new Promise(resolve => { child.once("close", resolve); stopOwnedWorker(child); setTimeout(resolve, 10000); });
    }
    telemetryClosed = true;
    if (telemetryTimer) clearInterval(telemetryTimer);
    if (!await drainExperimentTelemetry(telemetryTask)) {
      // Preserve the live registry for recovery; never permit a late write to
      // masquerade as an active reporter after the registry terminal is closed.
      const pendingPath = `${directory}/telemetry-drain-timeout.json`;
      if (!fs.existsSync(path.join(root, pendingPath))) write(pendingPath, {
        status: "telemetry_drain_timeout_recovery_required", runId, error: String(error.stack ?? error),
        recordedAtUtc: new Date().toISOString(),
      });
      throw new Error("telemetry drain timed out; active registry requires recovery", { cause: error });
    }
    const errorPath = `${directory}/controller-failure.json`;
    let interruptedProgress = null;
    let progressReadError = null;
    try {
      const progressPath = `${directory}/progress.json`;
      if (fs.existsSync(path.join(root, progressPath))) {
        const value = read(progressPath);
        assert.equal(value.experimentIdentity, runId, "interrupted progress identity mismatch");
        interruptedProgress = value;
      }
    } catch (progressError) { progressReadError = progressError.message; }
    if (!fs.existsSync(path.join(root, errorPath))) write(errorPath, { status: "experiment_controller_failed_closed", executionState: "failed_closed", registered,
      experimentIdentity: runId, runId, gpuStarted: interruptedProgress?.gpuStarted ?? null,
      trainingStarted: interruptedProgress?.trainingStarted ?? null,
      lastConfirmedOptimizerSteps: interruptedProgress?.optimizerSteps ?? null, actualFinalOptimizerSteps: null,
      progressReadError, error: error.stack, heartbeatPublication: error.heartbeatPublication ?? null,
      recordedAtUtc: new Date().toISOString() });
    if (registered) {
      const current = await readCurrentExecutionRegistry(root);
      if (current.ok && current.registry.runId === runId && current.registry.activeExecution !== null) {
        const failureCapsule = `${directory}/controller-failure-capsule.json`;
        capsule(failureCapsule, [packageBinding, bind(errorPath)]);
        await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: runId, packageId: runId,
          taskId: runId, taskKind, queueStatus: "failed_closed", nextMachineAction: null,
          runId, lifecycleStage: "isolated_implementation", executionState: "failed_closed", activity: "experiment_controller_failed_closed",
          taskCapsulePath: failureCapsule, terminalEvidencePath: errorPath, activeExecution: null,
          latestTrainingTerminal: !readonlyTrainFit && interruptedProgress?.trainingStarted === true
            ? { runId, ...bind(errorPath), status: "experiment_controller_failed_closed", evidence: { manifest: bind(errorPath) } } : null,
          expectedPreviousRegistryRevision: current.registry.registryRevision, expectedPreviousRegistrySha256: current.registrySha256 });
      }
    }
    throw error;
  } finally { clearInterval(timer); telemetryClosed = true; if (telemetryTimer) clearInterval(telemetryTimer); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
