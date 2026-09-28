import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { replaceHeartbeatFile, heartbeatPublicationRule, guardedHeartbeat, ownedWorkerIsRunning, readonlyTrainFitSucceeded, exposureTelemetryFromProgress, drainExperimentTelemetry, fullTrainExposureSucceeded, experimentWorkerTimeoutMs, observedExperimentTermination, exposureComparisonDiagnosticValid, v21FullTrainExposurePolicy, exposureProgressPublicationValid, progressPublicationRule } from "../run-ai-painter-learning-capacity-experiment.mjs";
import { normalizeActiveTrainingProgress } from "../lib/ai-painter-active-training-telemetry-v1.mjs";

test("full exposure hard stop has no extra training grace and retains confirmed, not invented, updates", () => {
  assert.equal(experimentWorkerTimeoutMs({ maxWallSeconds: 1800 }, true), 1800000);
  assert.equal(experimentWorkerTimeoutMs({ maxWallSeconds: 600 }, false), 630000);
  assert.throws(() => experimentWorkerTimeoutMs({ maxWallSeconds: -1 }, true));
  const progress = { experimentIdentity: "owned", trainingStarted: true, gpuStarted: true,
    optimizerSteps: { generator: 100, discriminator: 101 } };
  assert.deepEqual(observedExperimentTermination(null, progress, "owned"), {
    trainingStarted: true, gpuStarted: true, lastConfirmedOptimizerSteps: progress.optimizerSteps, actualFinalOptimizerSteps: null,
  });
  assert.throws(() => observedExperimentTermination(null, progress, "other"));
  assert.equal(observedExperimentTermination(null, null, "owned").trainingStarted, null);
  assert.deepEqual(observedExperimentTermination(progress, null, "owned").actualFinalOptimizerSteps, progress.optimizerSteps);
});

function diagnosticFixture() {
  const rule = { epoch: 24, maximumAbsoluteMedianCorrelationDifferenceEachRole: .03,
    maximumRelativeMeanRgbMaeDifference: .05, all48CorrelationsRequiredEachRole: true,
    failureAction: "diagnostic_only_no_early_stop", invalidEvidenceAction: "fail_closed", formalAuditThreshold: false };
  const objects = Object.fromEntries(["object_footprints", "object_tree", "object_rock", "object_vegetation"]
    .map(role => [role, { validCorrelationCount: 48, medianCorrelation: .5 }]));
  const report = { passed: true, evidenceValid: true, rule, actual: { meanRgbMae: .1, objects },
    reference: { meanRgbMae: .1, objects: structuredClone(objects) },
    medianCorrelationAbsoluteDifferences: Object.fromEntries(Object.keys(objects).map(role => [role, 0])),
    meanRgbMaeRelativeDifference: 0 };
  return { pkg: { policy: { path: v21FullTrainExposurePolicy }, inputs: { reproductionRule: rule, progressPublicationRule: structuredClone(progressPublicationRule) } },
    result: { epoch24ReproductionEvidenceValid: true, epoch24ReproductionPassed: true, epoch24Reproduction: report } };
}
test("historical numerical drift stays false but is not a research completion gate", () => {
  const { pkg, result } = diagnosticFixture();
  result.epoch24Reproduction.actual.objects.object_rock.medianCorrelation = .54;
  result.epoch24Reproduction.medianCorrelationAbsoluteDifferences.object_rock = .54 - .5;
  result.epoch24ReproductionPassed = result.epoch24Reproduction.passed = false;
  assert.equal(exposureComparisonDiagnosticValid(result, pkg), true);
  const counterfeit = structuredClone(result); counterfeit.epoch24Reproduction.passed = true;
  counterfeit.epoch24ReproductionPassed = true;
  assert.equal(exposureComparisonDiagnosticValid(counterfeit, pkg), false);
});
test("diagnostics still reject missing, invalid, forged and old-policy evidence", () => {
  const { pkg, result } = diagnosticFixture();
  for (const change of [r => { delete r.epoch24Reproduction; },
    r => { r.epoch24ReproductionEvidenceValid = "true"; },
    r => { r.epoch24Reproduction.actual.objects.object_rock.validCorrelationCount = 47; },
    r => { r.epoch24Reproduction.meanRgbMaeRelativeDifference = .04; },
    r => { r.epoch24Reproduction.actual.objects.object_rock.medianCorrelation = NaN; },
    r => { r.epoch24Reproduction.medianCorrelationAbsoluteDifferences.object_rock = .04; }]) {
    const bad = structuredClone(result); change(bad);
    assert.equal(exposureComparisonDiagnosticValid(bad, pkg), false);
  }
  for (const version of ['v1', 'v2']) assert.equal(exposureComparisonDiagnosticValid(result, { ...pkg, policy: { path: v21FullTrainExposurePolicy.replace('v3.json', `${version}.json`) } }), false);
});

test("v3 requires exact bounded progress IO rule, not training retries", () => {
  const {pkg} = diagnosticFixture();
  assert.equal(exposureProgressPublicationValid(pkg), true);
  for (const change of [r => {r.maxReplaceAttempts = 7;}, r => {r.sameStagedBytesOnly = 1;},
    r => {r.retryDelaySeconds = .1;}, r => {r.retryableWindowsErrors.push(999);},
    r => {r.automaticRetries = 1;}, r => {delete r.persistentFailureAction;}]) {
    const bad = structuredClone(pkg); change(bad.inputs.progressPublicationRule);
    assert.equal(exposureProgressPublicationValid(bad), false);
  }
  assert.equal(exposureProgressPublicationValid({inputs:{}}), false);
});
test("full exposure completion requires 48x3 actual observations, exact limits and paired endpoint images", () => {
  const diagnostic = diagnosticFixture();
  const selectedRows = Array.from({ length: 48 }, (_, trainOrdinal) => ({ sampleId: `sample-${trainOrdinal}`, split: "train", trainOrdinal }));
  const observationPlan = [{ epoch: 0, optimizerStep: 0 }, { epoch: 24, optimizerStep: 1152 }, { epoch: 48, optimizerStep: 2304 }];
  const imagePlan = [0, 43].flatMap(i => ["prediction", "target_final_comparison"].map(purpose => ({ ...selectedRows[i], epoch: 48, optimizerStep: 2304, purpose })));
  const pkg = { schemaVersion: "ai-painter-learning-capacity-experiment-package-v1", evidenceContractVersion: 1,
    experimentType: "all_train_exposure_only", experimentIdentity: "exposure-fixture", selectedRows, observationPlan, imagePlan,
    ...diagnostic.pkg };
  const result = { schemaVersion: "ai-painter-learning-capacity-experiment-result-v1", evidenceContractVersion: 1,
    experimentType: pkg.experimentType, experimentIdentity: pkg.experimentIdentity, status: "experiment_executed_not_visual_qualified",
    trainingStarted: true, completedEpochs: 48, sourceBytesUnchanged: true, optimizerSteps: { generator: 2304, discriminator: 2304 },
    checkpointReloadExact: true, artifacts: [], stage4QualificationGranted: false, checkpointPromotable: false,
    validationContentRead: false, challengeContentRead: false, regressionContentRead: false,
    trainOnlyObservations: observationPlan.flatMap(point => selectedRows.map(row => ({ ...row, ...point, measurements: {} }))),
    imageArtifacts: imagePlan.map((row, i) => ({ ...row, path: `output-${i}.png`, sha256: "a".repeat(64), sourceLabel: row.purpose })),
    checkpoint: { path: "final-step.pt", sha256: "b".repeat(64) }, ...diagnostic.result };
  result.artifacts = [...result.imageArtifacts.map(({ path, sha256 }) => ({ path, sha256 })), result.checkpoint];
  assert.equal(fullTrainExposureSucceeded(result, pkg, 0), true);
  const outsideTolerance = structuredClone(result);
  outsideTolerance.epoch24Reproduction.actual.objects.object_rock.medianCorrelation = .54;
  outsideTolerance.epoch24Reproduction.medianCorrelationAbsoluteDifferences.object_rock = .54 - .5;
  outsideTolerance.epoch24ReproductionPassed = outsideTolerance.epoch24Reproduction.passed = false;
  assert.equal(fullTrainExposureSucceeded(outsideTolerance, pkg, 0), true);
  assert.equal(fullTrainExposureSucceeded(result, pkg, 0, true), false);
  for (const patch of [{ completedEpochs: 24 }, { optimizerSteps: { generator: 1152, discriminator: 1152 } },
    { sourceBytesUnchanged: false }, { checkpointReloadExact: false }, { stage4QualificationGranted: true },
    { validationContentRead: true }, { trainOnlyObservations: result.trainOnlyObservations.slice(1) },
    { imageArtifacts: result.imageArtifacts.slice(1) }]) assert.equal(fullTrainExposureSucceeded({ ...result, ...patch }, pkg, 0), false);
  const duplicate = structuredClone(result); duplicate.trainOnlyObservations[1] = duplicate.trainOnlyObservations[0];
  assert.equal(fullTrainExposureSucceeded(duplicate, pkg, 0), false);
  const repeatedImage = structuredClone(result); repeatedImage.imageArtifacts[1] = repeatedImage.imageArtifacts[0];
  assert.equal(fullTrainExposureSucceeded(repeatedImage, pkg, 0), false);
  assert.equal(fullTrainExposureSucceeded({ ...result, artifacts: [] }, pkg, 0), false);
  const changedHash = structuredClone(result); changedHash.imageArtifacts[0].sha256 = "c".repeat(64);
  assert.equal(fullTrainExposureSucceeded(changedHash, pkg, 0), false);
});

test("exposure telemetry accepts only actual owned training updates, never a probe or observation", () => {
  const progress = { experimentIdentity: "exposure-test", trainingStarted: true,
    optimizerSteps: { generator: 2, discriminator: 2 }, trainingProgress: {
      epoch: 1, batchIndex: 2, batchCount: 48, optimizationStep: 2, loss: null, learningRate: .0001,
    } };
  assert.equal(exposureTelemetryFromProgress(progress, "exposure-test", normalizeActiveTrainingProgress).optimizationStep, 2);
  assert.equal(exposureTelemetryFromProgress({ ...progress, trainingStarted: false }, "exposure-test", normalizeActiveTrainingProgress), null);
  assert.equal(exposureTelemetryFromProgress({ ...progress, trainingProgress: null }, "exposure-test", normalizeActiveTrainingProgress), null);
  assert.throws(() => exposureTelemetryFromProgress(progress, "different", normalizeActiveTrainingProgress), /run_mismatch/);
  assert.throws(() => exposureTelemetryFromProgress(progress, "exposure-test", normalizeActiveTrainingProgress, 3), /update_count/);
  for (const patch of [{ epoch: 49 }, { batchCount: 2 }, { optimizationStep: 1 }, { reporterIdentity: "forged" }, { loss: -1 }]) {
    assert.throws(() => exposureTelemetryFromProgress({ ...progress, trainingProgress: { ...progress.trainingProgress, ...patch } },
      "exposure-test", normalizeActiveTrainingProgress));
  }
  assert.throws(() => exposureTelemetryFromProgress({ ...progress, optimizerSteps: { generator: 2, discriminator: 4 } },
    "exposure-test", normalizeActiveTrainingProgress), /update_count/);
});

test("telemetry must drain before a registry terminal and timeouts remain explicit", async () => {
  assert.equal(await drainExperimentTelemetry(Promise.resolve(), 20), true);
  assert.equal(await drainExperimentTelemetry(new Promise(() => {}), 10), false);
  await assert.rejects(drainExperimentTelemetry(Promise.reject(new Error("projection failure")), 20), /projection failure/);
});

function readonlyFitFixture() {
  const selectedRows = Array.from({ length: 48 }, (_, trainOrdinal) => ({ sampleId: `sample-${trainOrdinal}`, split: "train", trainOrdinal }));
  const pkg = { experimentIdentity: "readonly-fit-test", selectedRows };
  const result = { experimentIdentity: pkg.experimentIdentity, status: "readonly_train_fit_diagnostic_completed_no_qualification",
    trainingStarted: false, optimizerCreated: false, optimizerSteps: { generator: 0, discriminator: 0 }, forwardCalls: 48,
    checkpointWritten: false, modelStateUnchanged: true, sourceBytesUnchanged: true,
    samples: structuredClone(selectedRows), artifacts: [] };
  return { pkg, result };
}

test("readonly 48-row diagnostic completion requires exact identities and zero updates", () => {
  const { pkg, result } = readonlyFitFixture();
  assert.equal(readonlyTrainFitSucceeded(result, pkg, 0), true);
  assert.equal(readonlyTrainFitSucceeded(result, pkg, 1), false);
  assert.equal(readonlyTrainFitSucceeded(result, pkg, 0, true), false);
  for (const [key, value] of Object.entries({ status: "experiment_executed_not_visual_qualified", trainingStarted: true,
    optimizerCreated: true, optimizerSteps: { generator: 1, discriminator: 0 }, forwardCalls: 47,
    checkpointWritten: true, modelStateUnchanged: false, sourceBytesUnchanged: false,
    experimentIdentity: "different", artifacts: null })) {
    assert.equal(readonlyTrainFitSucceeded({ ...result, [key]: value }, pkg, 0), false, key);
  }
});

test("readonly diagnostic rejects missing, duplicated, reordered or non-train samples", () => {
  const { pkg, result } = readonlyFitFixture();
  assert.equal(readonlyTrainFitSucceeded({ ...result, samples: result.samples.slice(1) }, pkg, 0), false);
  assert.equal(readonlyTrainFitSucceeded({ ...result, samples: [null, ...result.samples.slice(1)] }, pkg, 0), false);
  for (const patch of [{ sampleId: "different" }, { split: "validation" }, { trainOrdinal: 1 }]) {
    const changed = structuredClone(result);
    Object.assign(changed.samples[0], patch);
    assert.equal(readonlyTrainFitSucceeded(changed, pkg, 0), false);
  }
  const duplicate = structuredClone(pkg);
  duplicate.selectedRows[1].sampleId = duplicate.selectedRows[0].sampleId;
  const aligned = structuredClone(result);
  aligned.samples[1].sampleId = aligned.samples[0].sampleId;
  assert.equal(readonlyTrainFitSucceeded(aligned, duplicate, 0), false);
});

test("already exited or signaled workers are never termination targets", () => {
  for (const child of [null, {pid:123,exitCode:0,signalCode:null}, {pid:123,exitCode:null,signalCode:"SIGTERM"},
    {pid:0,exitCode:null,signalCode:null}, {pid:"123",exitCode:null,signalCode:null}]) {
    assert.equal(ownedWorkerIsRunning(child), false);
  }
});

test("only the live spawned child identity can request termination", () => {
  assert.equal(ownedWorkerIsRunning({pid:123,exitCode:null,signalCode:null}), true);
});

test("transient Windows rename failures retry finitely without rewriting data", () => {
  const calls = [], delays = [];
  replaceHeartbeatFile("exact.tmp", "exact.json", { rename: (...args) => {
    calls.push(args);
    if (calls.length < 3) throw Object.assign(new Error("busy"), { code: "EPERM" });
  }, pause: ms => delays.push(ms) });
  assert.deepEqual(calls, Array.from({ length: 3 }, () => ["exact.tmp", "exact.json"]));
  assert.deepEqual(delays, [100, 100]);
});

test("persistent permission failures stop at the attempt cap and retain diagnostics", () => {
  const error = Object.assign(new Error("locked"), { code: "EACCES" });
  let attempts = 0;
  const delays = [];
  assert.throws(() => replaceHeartbeatFile("a.tmp", "a.json", {
    rename: () => { attempts += 1; throw error; }, pause: ms => delays.push(ms),
  }), e => e === error);
  assert.equal(attempts, 21);
  assert.deepEqual(delays, Array(20).fill(100));
  assert.equal(error.heartbeatPublication.attempts, 21);
  assert.equal(error.heartbeatPublication.automaticTrainingRetries, 0);
  assert.equal(error.heartbeatPublication.errorCode, "EACCES");
});

test("heartbeat publication monotonic deadline is independent of its attempt cap", () => {
  let clock = 0, attempts = 0;
  const error = Object.assign(new Error("locked"), { code: "EPERM" });
  assert.throws(() => replaceHeartbeatFile("a.tmp", "a.json", {
    now: () => clock, rename: () => { attempts += 1; clock += 400; throw error; },
    pause: ms => { clock += ms; },
  }), e => e === error);
  assert.equal(attempts, 4);
  assert.equal(clock, 2000);
  assert.equal(error.heartbeatPublication.elapsedMilliseconds, 2000);
  assert.equal(heartbeatPublicationRule.maxWaitMilliseconds, 2000);
});

test("all allowed transient errors recover with the same staged path and no extra model action", () => {
  for (const code of ["EPERM", "EACCES", "EBUSY"]) {
    let attempts = 0, clock = 0;
    const result = replaceHeartbeatFile("same.tmp", "same.json", {
      now: () => clock, pause: ms => { clock += ms; },
      rename: (a, b) => {
        assert.equal(a, "same.tmp"); assert.equal(b, "same.json");
        if (++attempts <= 8) throw Object.assign(new Error("reader busy"), { code });
      },
    });
    assert.deepEqual(result, { attempts: 9, elapsedMilliseconds: 800, recovered: true });
  }
});

test("unrelated IO errors are not retried or masked", () => {
  let attempts = 0;
  assert.throws(() => replaceHeartbeatFile("a.tmp", "a.json", {
    rename: () => { attempts += 1; throw Object.assign(new Error("missing"), { code: "ENOENT" }); },
    pause: () => assert.fail("must not pause"),
  }), { code: "ENOENT" });
  assert.equal(attempts, 1);
});

test("interval failure is delivered to the controller failure handler", () => {
  const failure = new Error("heartbeat unavailable");
  const events = [];
  const ok = guardedHeartbeat(() => { throw failure; }, error => events.push(error));
  assert.equal(ok, false);
  assert.deepEqual(events, [failure]);
});

test("successful heartbeat never requests worker termination", () => {
  let writes = 0;
  assert.equal(guardedHeartbeat(() => { writes += 1; }, () => assert.fail("no failure expected")), true);
  assert.equal(writes, 1);
});

test("failed replacement preserves both the old heartbeat and new temporary bytes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aip-heartbeat-"));
  const previous = path.join(dir, "heartbeat.json"), temporary = previous + ".tmp";
  try {
    fs.writeFileSync(previous, '{"sequence":1}\n');
    fs.writeFileSync(temporary, '{"sequence":2}\n');
    assert.throws(() => replaceHeartbeatFile(temporary, previous, {
      rename: () => { throw Object.assign(new Error("busy"), { code: "EBUSY" }); }, pause: () => {},
    }), { code: "EBUSY" });
    assert.equal(JSON.parse(fs.readFileSync(previous)).sequence, 1);
    assert.equal(JSON.parse(fs.readFileSync(temporary)).sequence, 2);
    replaceHeartbeatFile(temporary, previous);
    assert.equal(JSON.parse(fs.readFileSync(previous)).sequence, 2);
    assert.equal(fs.existsSync(temporary), false);
  } finally {
    for (const p of [previous, temporary]) if (fs.existsSync(p)) fs.unlinkSync(p);
    fs.rmdirSync(dir);
  }
});

for (const { lockMs, recovers } of [{ lockMs: 800, recovers: true }, { lockMs: 2600, recovers: false }]) {
test(`actual Windows ${lockMs}ms reader lock ${recovers ? "recovers" : "fails closed"} without deleting the live heartbeat`, { skip: process.platform !== "win32", timeout: 10000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aip-heartbeat-lock-"));
  const target = path.join(dir, "heartbeat.json"), temporary = target + ".tmp";
  let child;
  try {
    fs.writeFileSync(target, '{"sequence":1}\n');
    fs.writeFileSync(temporary, '{"sequence":2}\n');
    const escaped = target.replaceAll("'", "''");
    const script = `$stream=[System.IO.File]::Open('${escaped}',[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::Read); try { [Console]::WriteLine('locked'); Start-Sleep -Milliseconds ${lockMs} } finally { $stream.Dispose() }`;
    child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true });
    const completed = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => code === 0 ? resolve() : reject(new Error(`reader exit ${code}`))); });
    await new Promise((resolve, reject) => {
      child.stdout.on("data", value => { if (value.toString().includes("locked")) resolve(); });
      child.once("error", reject);
      child.once("close", () => reject(new Error("reader closed before lock confirmation")));
    });
    let attempts = 0;
    const replace = () => replaceHeartbeatFile(temporary, target, { rename: (a, b) => { attempts += 1; fs.renameSync(a, b); } });
    if (recovers) {
      assert.equal(replace().recovered, true);
    } else {
      let failures = 0;
      assert.equal(guardedHeartbeat(replace, error => {
        failures += 1;
        assert(["EPERM", "EACCES", "EBUSY"].includes(error.code));
        assert(error.heartbeatPublication.attempts <= 21);
        assert.equal(error.heartbeatPublication.automaticTrainingRetries, 0);
      }), false);
      assert.equal(failures, 1);
    }
    await completed;
    assert(attempts > 1, "test must encounter a real sharing violation");
    assert.equal(JSON.parse(fs.readFileSync(target)).sequence, recovers ? 2 : 1);
    assert.equal(fs.existsSync(temporary), !recovers);
    if (!recovers) assert.equal(JSON.parse(fs.readFileSync(temporary)).sequence, 2);
  } finally {
    if (child && child.exitCode === null) {
      await new Promise(resolve => child.once("close", resolve));
    }
    for (const p of [target, temporary]) if (fs.existsSync(p)) fs.unlinkSync(p);
    fs.rmdirSync(dir);
  }
});
}
