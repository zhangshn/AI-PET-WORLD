import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CLOSED_LOOP_CONTRACT_PATH,
  PHASES,
  createExecutionStore,
  runAutonomousClosedLoop,
  validateClosedLoopPackage,
} from "./lib/ai-painter-autonomous-closed-loop-v1.mjs";
import { materializeAutonomousClosedLoopPackage } from "./lib/ai-painter-autonomous-package-materializer-v1.mjs";

const projectRoot = process.cwd();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-closed-loop-"));
let positive = 0;
let negative = 0;

try {
  copyContract(CLOSED_LOOP_CONTRACT_PATH);
  copyContract("data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json");
  const evidencePath = "fixtures/input-evidence.json";
  write(evidencePath, "{\"identity\":\"fixture\"}\n");
  const adapterPath = "fixtures/adapters.mjs";
  write(adapterPath, PHASES.map((phase) => `export async function ${phase}() { return { status: \"passed\", evidenceCode: \"${phase}_passed\" }; }`).join("\n") + "\n");
  const base = makeSpec("closed-loop-complete-fixture", adapterPath, evidencePath);
  const baseSha = digestJson(base);

  const materialized = materializeAutonomousClosedLoopPackage({
    schemaVersion: "ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity: "closed-loop-materialized-fixture",
    capabilityVersion: "fixture-capability-v1",
    ownerAuthorizationRequired: false,
    maxInfrastructureRecoveryAttempts: 1,
    outputRoot: ".runtime/ai-painter/fixture-outputs/closed-loop-materialized-fixture",
    programFiles: { adapters: adapterPath },
    inputEvidencePaths: [evidencePath],
    phaseAdapters: Object.fromEntries(PHASES.map((phase) => [phase, { path: adapterPath, exportName: phase }])),
  }, { root: fixtureRoot, recordedAtUtc: "2026-08-24T00:00:00.000Z" });
  assert.equal(materialized.ownerAuthorizationRequired, false);
  assert.ok(fs.existsSync(path.join(fixtureRoot, materialized.packagePath)));
  positive += 1;
  assert.throws(() => materializeAutonomousClosedLoopPackage({
    schemaVersion: "ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity: "closed-loop-materialized-fixture",
    capabilityVersion: "fixture-capability-v1",
    ownerAuthorizationRequired: false,
    maxInfrastructureRecoveryAttempts: 1,
    outputRoot: ".runtime/ai-painter/fixture-outputs/closed-loop-materialized-fixture",
    programFiles: { adapters: adapterPath }, inputEvidencePaths: [evidencePath],
    phaseAdapters: Object.fromEntries(PHASES.map((phase) => [phase, { path: adapterPath, exportName: phase }])),
  }, { root: fixtureRoot }), /already exists/);
  negative += 1;

  validateClosedLoopPackage(base, { root: fixtureRoot, packageSha256: baseSha }); positive += 1;
  const completed = await runAutonomousClosedLoop({ root: fixtureRoot, spec: base, packageSha256: baseSha, adapters: passingAdapters() });
  assert.equal(completed.state, "completed");
  assert.equal(completed.ownerResponseRequired, false);
  positive += 1;
  const completedRoot = path.join(fixtureRoot, ".runtime", "ai-painter", "autonomous-closed-loop-executions", base.packageIdentity);
  assert.equal(JSON.parse(fs.readFileSync(path.join(completedRoot, "progress.json"), "utf8")).percent, 100);
  const heartbeat = JSON.parse(fs.readFileSync(path.join(completedRoot, "heartbeat.json"), "utf8"));
  assert.equal(heartbeat.adapterProgress.phasePercent, 50);
  assert.equal(JSON.parse(fs.readFileSync(path.join(completedRoot, "phase-terminal.json"), "utf8")).ownerAuthorizationRequired, false);
  const db = new DatabaseSync(path.join(completedRoot, "execution.sqlite"), { readOnly: true });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM transitions").get().count, 8);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM artifacts").get().count, 6);
  assert.equal(db.prepare("SELECT owner_response_required FROM executions").get().owner_response_required, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM review_transitions").get().count, 3);
  assert.equal(JSON.parse(fs.readFileSync(path.join(completedRoot, "review-state.json"), "utf8")).state, "review_passed");
  db.close(); positive += 1;

  fs.unlinkSync(path.join(completedRoot, "phase-terminal.json"));
  const terminalRecoveryCalls = { preflight: 0 };
  const terminalRecoveryAdapters = passingAdapters();
  terminalRecoveryAdapters.preflight = async () => { terminalRecoveryCalls.preflight += 1; return { status: "passed" }; };
  const terminalRecovered = await runAutonomousClosedLoop({
    root: fixtureRoot, spec: base, packageSha256: baseSha, adapters: terminalRecoveryAdapters,
  });
  assert.equal(terminalRecovered.state, "completed");
  assert.equal(terminalRecoveryCalls.preflight, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(completedRoot, "phase-terminal.json"), "utf8")).finalResult.recoveredFromBoundEvidence, true);
  positive += 1;

  const completedResumeCalls = { preflight: 0 };
  const completedResumeAdapters = passingAdapters();
  completedResumeAdapters.preflight = async () => { completedResumeCalls.preflight += 1; return { status: "passed" }; };
  const completedAgain = await runAutonomousClosedLoop({
    root: fixtureRoot, spec: base, packageSha256: baseSha, adapters: completedResumeAdapters,
  });
  assert.equal(completedAgain.state, "completed");
  assert.equal(completedResumeCalls.preflight, 0);
  positive += 1;

  const invalidResumeSpec = makeSpec("closed-loop-invalid-resume-no-preflight", adapterPath, evidencePath);
  const invalidResumeSha = digestJson(invalidResumeSpec);
  const invalidResumeStore = createExecutionStore({ root: fixtureRoot, spec: invalidResumeSpec, packageSha256: invalidResumeSha });
  seedExecutingState(invalidResumeStore, invalidResumeSpec, null);
  await assert.rejects(
    () => runAutonomousClosedLoop({ root: fixtureRoot, spec: invalidResumeSpec, packageSha256: invalidResumeSha, adapters: passingAdapters() }),
    /completed phase lacks passed evidence: preflight/,
  );
  negative += 1;

  const resumeSpec = makeSpec("closed-loop-in-progress-resume", adapterPath, evidencePath);
  const resumeSha = digestJson(resumeSpec);
  const resumeStore = createExecutionStore({ root: fixtureRoot, spec: resumeSpec, packageSha256: resumeSha, now: "2026-08-24T00:01:00.000Z" });
  const preflightEvidence = writePhaseEvidence(resumeStore.executionRoot, "preflight", 0, { status: "passed", evidenceCode: "preflight_passed" });
  seedExecutingState(resumeStore, resumeSpec, preflightEvidence);
  const resumeCalls = { preflight: 0, execute: 0 };
  const resumeAdapters = passingAdapters();
  resumeAdapters.preflight = async () => { resumeCalls.preflight += 1; return { status: "passed" }; };
  resumeAdapters.execute = async (context) => {
    resumeCalls.execute += 1;
    context.reportProgress({ phasePercent: 100, message: "completed_training_recovered_without_retraining" });
    return { status: "passed", recoveredWithoutRetraining: true };
  };
  const resumed = await runAutonomousClosedLoop({
    root: fixtureRoot, spec: resumeSpec, packageSha256: resumeSha, adapters: resumeAdapters,
  });
  assert.equal(resumed.state, "completed");
  assert.equal(resumeCalls.preflight, 0);
  assert.equal(resumeCalls.execute, 1);
  const resumeDb = new DatabaseSync(resumeStore.sqlitePath, { readOnly: true });
  assert.equal(resumeDb.prepare("SELECT COUNT(*) AS count FROM artifacts WHERE phase = 'preflight'").get().count, 1);
  resumeDb.close();
  assert.match(fs.readFileSync(path.join(resumeStore.executionRoot, "execution-recovery-audit.jsonl"), "utf8"), /passed_phase_artifact_recovered/);
  positive += 1;

  const passedResumeSpec = makeSpec("closed-loop-passed-execute-resume", adapterPath, evidencePath);
  const passedResumeSha = digestJson(passedResumeSpec);
  const passedResumeStore = createExecutionStore({ root: fixtureRoot, spec: passedResumeSpec, packageSha256: passedResumeSha });
  const passedPreflight = writePhaseEvidence(passedResumeStore.executionRoot, "preflight", 0, { status: "passed" });
  seedExecutingState(passedResumeStore, passedResumeSpec, passedPreflight, { registerPreflightArtifact: true });
  writePhaseEvidence(passedResumeStore.executionRoot, "execute", 0, { status: "passed", recoveredWithoutRetraining: true });
  let passedExecuteCalls = 0;
  const passedResumeAdapters = passingAdapters();
  passedResumeAdapters.execute = async () => { passedExecuteCalls += 1; return { status: "passed" }; };
  const passedResumed = await runAutonomousClosedLoop({
    root: fixtureRoot, spec: passedResumeSpec, packageSha256: passedResumeSha, adapters: passedResumeAdapters,
  });
  assert.equal(passedResumed.state, "completed");
  assert.equal(passedExecuteCalls, 0);
  positive += 1;

  const recoverySpec = makeSpec("closed-loop-recovery-fixture", adapterPath, evidencePath, 1);
  let executeCalls = 0;
  const recoveryAdapters = passingAdapters();
  recoveryAdapters.execute = async () => (++executeCalls === 1
    ? { status: "failed", failureKind: "infrastructure", failureCode: "transient_fixture" }
    : { status: "passed" });
  const recovered = await runAutonomousClosedLoop({ root: fixtureRoot, spec: recoverySpec, packageSha256: digestJson(recoverySpec), adapters: recoveryAdapters });
  assert.equal(recovered.state, "completed");
  assert.equal(executeCalls, 2); positive += 1;

  const mismatchedRecoverySpec = makeSpec("closed-loop-recovery-count-mismatch", adapterPath, evidencePath, 1);
  const mismatchedRecoverySha = digestJson(mismatchedRecoverySpec);
  const mismatchedRecoveryStore = createExecutionStore({ root: fixtureRoot, spec: mismatchedRecoverySpec, packageSha256: mismatchedRecoverySha });
  const mismatchedState = { ...mismatchedRecoveryStore.state, state: "preflight", phase: "preflight", sequence: 1, recoveryAttempt: 1 };
  writeJson(path.join(mismatchedRecoveryStore.executionRoot, "execution-state.json"), mismatchedState);
  const mismatchedDb = new DatabaseSync(mismatchedRecoveryStore.sqlitePath);
  mismatchedDb.prepare("UPDATE executions SET state = 'preflight', phase = 'preflight' WHERE package_identity = ?").run(mismatchedRecoverySpec.packageIdentity);
  mismatchedDb.prepare("INSERT INTO transitions(package_identity, sequence, from_state, to_state, phase, recorded_at_utc, evidence_sha256) VALUES (?, 1, 'package_materialized', 'preflight', 'preflight', ?, NULL)").run(mismatchedRecoverySpec.packageIdentity, "2026-08-24T00:02:00.000Z");
  mismatchedDb.close();
  await assert.rejects(
    () => runAutonomousClosedLoop({ root: fixtureRoot, spec: mismatchedRecoverySpec, packageSha256: mismatchedRecoverySha, adapters: passingAdapters() }),
    /recoveryAttempt conflicts with SQLite recoveries/,
  );
  negative += 1;

  const activeLeaseSpec = makeSpec("closed-loop-active-lease", adapterPath, evidencePath);
  const activeLeaseSha = digestJson(activeLeaseSpec);
  const activeLeaseStore = createExecutionStore({ root: fixtureRoot, spec: activeLeaseSpec, packageSha256: activeLeaseSha });
  writeLease(activeLeaseStore.executionRoot, process.pid);
  await assert.rejects(
    () => runAutonomousClosedLoop({ root: fixtureRoot, spec: activeLeaseSpec, packageSha256: activeLeaseSha, adapters: passingAdapters() }),
    /active runner PID/,
  );
  fs.rmSync(path.join(activeLeaseStore.executionRoot, "execution-runner-lease"), { recursive: true, force: true });
  negative += 1;

  const staleLeaseSpec = makeSpec("closed-loop-stale-lease", adapterPath, evidencePath);
  const staleLeaseSha = digestJson(staleLeaseSpec);
  const staleLeaseStore = createExecutionStore({ root: fixtureRoot, spec: staleLeaseSpec, packageSha256: staleLeaseSha });
  writeLease(staleLeaseStore.executionRoot, 2147483647);
  const staleLeaseResult = await runAutonomousClosedLoop({ root: fixtureRoot, spec: staleLeaseSpec, packageSha256: staleLeaseSha, adapters: passingAdapters() });
  assert.equal(staleLeaseResult.state, "completed");
  const staleHistoryRoot = path.join(staleLeaseStore.executionRoot, "execution-runner-lease-history");
  const staleArchives = fs.readdirSync(staleHistoryRoot).filter((entry) => entry.startsWith("stale-"));
  assert.equal(staleArchives.length, 1);
  assert.ok(fs.existsSync(path.join(staleHistoryRoot, staleArchives[0], "takeover.json")));
  assert.match(fs.readFileSync(path.join(staleLeaseStore.executionRoot, "execution-lease-history.jsonl"), "utf8"), /stale_lease_archived_for_takeover/);
  positive += 1;

  const reviewFailedResultSpec = makeSpec("closed-loop-review-failed-result", adapterPath, evidencePath);
  const reviewFailedResultAdapters = passingAdapters();
  reviewFailedResultAdapters.review = async () => ({ status: "passed", reviewOutcome: "machine_reviews_failed", passCount: 2, failCount: 4 });
  const reviewFailedResult = await runAutonomousClosedLoop({
    root: fixtureRoot, spec: reviewFailedResultSpec, packageSha256: digestJson(reviewFailedResultSpec), adapters: reviewFailedResultAdapters,
  });
  assert.equal(reviewFailedResult.state, "completed");
  const reviewFailedRoot = executionRoot(reviewFailedResultSpec.packageIdentity);
  assert.equal(JSON.parse(fs.readFileSync(path.join(reviewFailedRoot, "review-state.json"), "utf8")).state, "review_completed_with_failed_result");
  const reviewFailedDb = new DatabaseSync(path.join(reviewFailedRoot, "execution.sqlite"), { readOnly: true });
  assert.equal(reviewFailedDb.prepare("SELECT COUNT(*) AS count FROM review_transitions WHERE review_state = 'review_completed_with_failed_result'").get().count, 1);
  reviewFailedDb.close();
  positive += 1;

  const visualSpec = makeSpec("closed-loop-visual-failure", adapterPath, evidencePath);
  const visualAdapters = passingAdapters();
  visualAdapters.review = async () => ({ status: "failed", failureKind: "visual", failureCode: "frozen_review_failed" });
  const visual = await runAutonomousClosedLoop({ root: fixtureRoot, spec: visualSpec, packageSha256: digestJson(visualSpec), adapters: visualAdapters });
  assert.equal(visual.state, "failed_closed");
  assert.equal(visual.ownerResponseRequired, false);
  const visualRoot = executionRoot(visualSpec.packageIdentity);
  fs.unlinkSync(path.join(visualRoot, "phase-terminal.json"));
  let failedTerminalReplayCalls = 0;
  const failedTerminalAdapters = passingAdapters();
  failedTerminalAdapters.review = async () => { failedTerminalReplayCalls += 1; return { status: "passed" }; };
  const visualRecovered = await runAutonomousClosedLoop({
    root: fixtureRoot, spec: visualSpec, packageSha256: digestJson(visualSpec), adapters: failedTerminalAdapters,
  });
  assert.equal(visualRecovered.state, "failed_closed");
  assert.equal(failedTerminalReplayCalls, 0);
  const recoveredVisualTerminal = JSON.parse(fs.readFileSync(path.join(visualRoot, "phase-terminal.json"), "utf8"));
  assert.equal(recoveredVisualTerminal.finalResult.failureCode, "frozen_review_failed");
  assert.equal(recoveredVisualTerminal.finalResult.recoveredFromBoundEvidence, true);
  positive += 1;

  const policySpec = makeSpec("closed-loop-policy-boundary", adapterPath, evidencePath);
  const policyAdapters = passingAdapters();
  policyAdapters.preflight = async () => ({
    status: "failed", failureKind: "policy_boundary", failureCode: "external_cost_not_registered",
    boundaryClass: "unregistered_external_cost", summaryZh: "测试中的未登记外部成本边界。", safeAlternative: "保持本地CPU路径。",
  });
  const policy = await runAutonomousClosedLoop({ root: fixtureRoot, spec: policySpec, packageSha256: digestJson(policySpec), adapters: policyAdapters });
  assert.equal(policy.state, "blocked_policy_boundary"); positive += 1;

  reject({ ...base, ownerAuthorizationRequired: true }, "cannot require Owner authorization");
  reject({ ...base, ownerInStateMachine: true }, "cannot place Owner");
  reject({ ...base, maxInfrastructureRecoveryAttempts: 4 }, "recovery limit");
  reject({ ...base, outputRoot: "../outside" }, "runtime path");
  reject({ ...base, inputEvidence: [{ path: evidencePath, sha256: "0".repeat(64) }] }, "evidence SHA-256 mismatch");
  const missingPhase = structuredClone(base); delete missingPhase.phaseAdapters.review;
  reject(missingPhase, "phase adapter set mismatch");
  const ownerToken = structuredClone(base); ownerToken.description = "waiting_owner_decision";
  reject(ownerToken, "forbidden Owner runtime token");
  const wrongAdapter = structuredClone(base); wrongAdapter.phaseAdapters.execute.sha256 = "f".repeat(64);
  reject(wrongAdapter, "adapter SHA-256 mismatch");
  const unboundPackage = { ...base, capabilityVersion: "fixture-capability-v2" };
  assert.throws(
    () => validateClosedLoopPackage(unboundPackage, { root: fixtureRoot, packageSha256: baseSha }),
    /package SHA-256 does not bind/,
  );
  negative += 1;
  assert.throws(() => createExecutionStore({ root: fixtureRoot, spec: base, packageSha256: baseSha }), /already exists/); negative += 1;

  process.stdout.write(`${JSON.stringify({
    status: "passed", positive, negative, ownerAuthorizationRequired: false,
    persistentState: true, automaticClosure: true, singleExecutorLease: true,
    staleLeaseTakeoverAudited: true, passedPhaseRecoveryWithoutReplay: true,
    terminalEvidenceSelfHealing: true, reviewFailedResultStateCovered: true,
  }, null, 2)}\n`);
} finally {
  const resolved = path.resolve(fixtureRoot);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())));
  fs.rmSync(resolved, { recursive: true, force: true });
}

function makeSpec(packageIdentity, adapterPath, evidencePath, retries = 0) {
  const adapterSha = shaFile(path.join(fixtureRoot, adapterPath));
  const phaseAdapters = Object.fromEntries(PHASES.map((phase) => [phase, { kind: "project_module_export", path: adapterPath, sha256: adapterSha, exportName: phase }]));
  return {
    schemaVersion: "ai-painter-autonomous-closed-loop-package-v1",
    packageIdentity,
    capabilityVersion: "fixture-capability-v1",
    ownerAuthorizationRequired: false,
    ownerInStateMachine: false,
    maxInfrastructureRecoveryAttempts: retries,
    outputRoot: `.runtime/ai-painter/fixture-outputs/${packageIdentity}`,
    programLineage: { runner: "1".repeat(64) },
    inputEvidence: [{ path: evidencePath, sha256: shaFile(path.join(fixtureRoot, evidencePath)) }],
    phaseAdapters,
  };
}

function passingAdapters() {
  return Object.fromEntries(PHASES.map((phase) => [phase, async (context) => {
    context.reportProgress({ phasePercent: 50, message: `${phase}_in_progress`, metrics: { fixture: 1 } });
    context.heartbeat();
    context.reportProgress({ phasePercent: 50, message: `${phase}_completed`, metrics: { fixture: 1 } });
    return { status: "passed" };
  }]));
}
function seedExecutingState(store, spec, preflightEvidence, { registerPreflightArtifact = false } = {}) {
  const updatedAtUtc = "2026-08-24T00:01:02.000Z";
  const state = {
    ...store.state, state: "executing", phase: "execute", sequence: 2,
    latestEvidence: preflightEvidence, updatedAtUtc,
  };
  writeJson(path.join(store.executionRoot, "execution-state.json"), state);
  const db = new DatabaseSync(store.sqlitePath);
  db.exec("BEGIN IMMEDIATE");
  db.prepare("UPDATE executions SET state = 'executing', phase = 'execute', updated_at_utc = ? WHERE package_identity = ?").run(updatedAtUtc, spec.packageIdentity);
  db.prepare("INSERT INTO transitions(package_identity, sequence, from_state, to_state, phase, recorded_at_utc, evidence_sha256) VALUES (?, 1, 'package_materialized', 'preflight', 'preflight', ?, NULL)").run(spec.packageIdentity, "2026-08-24T00:01:01.000Z");
  db.prepare("INSERT INTO transitions(package_identity, sequence, from_state, to_state, phase, recorded_at_utc, evidence_sha256) VALUES (?, 2, 'preflight', 'executing', 'execute', ?, NULL)").run(spec.packageIdentity, updatedAtUtc);
  if (registerPreflightArtifact) {
    db.prepare("INSERT INTO artifacts(package_identity, phase, attempt, logical_path, sha256, recorded_at_utc) VALUES (?, 'preflight', 0, ?, ?, ?)").run(
      spec.packageIdentity, preflightEvidence.path, preflightEvidence.sha256, updatedAtUtc,
    );
  }
  db.exec("COMMIT");
  db.close();
}
function writePhaseEvidence(targetExecutionRoot, phase, attempt, result) {
  const payload = {
    schemaVersion: "ai-painter-autonomous-phase-evidence-v1",
    phase, attempt, recordedAtUtc: "2026-08-24T00:01:01.500Z", result,
  };
  const relativePath = `phase-evidence/${phase}-attempt-${attempt}.json`;
  const absolutePath = path.join(targetExecutionRoot, ...relativePath.split("/"));
  writeJson(absolutePath, payload);
  return { phase, attempt, path: relativePath, sha256: shaFile(absolutePath) };
}
function writeLease(targetExecutionRoot, pid) {
  const leaseRoot = path.join(targetExecutionRoot, "execution-runner-lease");
  fs.mkdirSync(leaseRoot, { recursive: false });
  writeJson(path.join(leaseRoot, "lease.json"), {
    schemaVersion: "ai-painter-autonomous-execution-lease-v1",
    packageIdentity: path.basename(targetExecutionRoot), token: "a".repeat(32),
    pid, hostname: os.hostname(), acquiredAtUtc: "2026-08-24T00:00:00.000Z",
    heartbeatAtUtc: "2026-08-24T00:00:00.000Z", takeover: null,
  });
}
function executionRoot(packageIdentity) {
  return path.join(fixtureRoot, ".runtime", "ai-painter", "autonomous-closed-loop-executions", packageIdentity);
}
function reject(spec, message) {
  assert.throws(() => validateClosedLoopPackage(spec, { root: fixtureRoot, packageSha256: digestJson(spec) }), new RegExp(message));
  negative += 1;
}
function copyContract(relativePath) { write(relativePath, fs.readFileSync(path.join(projectRoot, relativePath))); }
function write(relativePath, content) { const target = path.join(fixtureRoot, relativePath); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function shaFile(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }
function digestJson(value) { return crypto.createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`).digest("hex"); }
