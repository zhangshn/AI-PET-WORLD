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

  const recoverySpec = makeSpec("closed-loop-recovery-fixture", adapterPath, evidencePath, 1);
  let executeCalls = 0;
  const recoveryAdapters = passingAdapters();
  recoveryAdapters.execute = async () => (++executeCalls === 1
    ? { status: "failed", failureKind: "infrastructure", failureCode: "transient_fixture" }
    : { status: "passed" });
  const recovered = await runAutonomousClosedLoop({ root: fixtureRoot, spec: recoverySpec, packageSha256: digestJson(recoverySpec), adapters: recoveryAdapters });
  assert.equal(recovered.state, "completed");
  assert.equal(executeCalls, 2); positive += 1;

  const visualSpec = makeSpec("closed-loop-visual-failure", adapterPath, evidencePath);
  const visualAdapters = passingAdapters();
  visualAdapters.review = async () => ({ status: "failed", failureKind: "visual", failureCode: "frozen_review_failed" });
  const visual = await runAutonomousClosedLoop({ root: fixtureRoot, spec: visualSpec, packageSha256: digestJson(visualSpec), adapters: visualAdapters });
  assert.equal(visual.state, "failed_closed");
  assert.equal(visual.ownerResponseRequired, false); positive += 1;

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
  assert.throws(() => createExecutionStore({ root: fixtureRoot, spec: base, packageSha256: baseSha }), /already exists/); negative += 1;

  process.stdout.write(`${JSON.stringify({ status: "passed", positive, negative, ownerAuthorizationRequired: false, persistentState: true, automaticClosure: true }, null, 2)}\n`);
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
function reject(spec, message) {
  assert.throws(() => validateClosedLoopPackage(spec, { root: fixtureRoot, packageSha256: digestJson(spec) }), new RegExp(message));
  negative += 1;
}
function copyContract(relativePath) { write(relativePath, fs.readFileSync(path.join(projectRoot, relativePath))); }
function write(relativePath, content) { const target = path.join(fixtureRoot, relativePath); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
function shaFile(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }
function digestJson(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
