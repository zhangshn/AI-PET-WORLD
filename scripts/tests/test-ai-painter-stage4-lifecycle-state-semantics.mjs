import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createCapabilityCandidate, advanceCapabilityLifecycle } from "../lib/ai-painter-capability-lifecycle-v1.mjs";
import { projectStage4FailureLifecycle, readLastSuccessfulStage4Qualification } from "../lib/ai-painter-stage4-lifecycle-projection.mjs";
import { advanceCurrentExecutionRegistry, initializeCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../../src/server/ai-painter-current-execution-registry.mjs";

const PROJECT = fileURLToPath(new URL("../../", import.meta.url));
const CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const PREFIX = `.runtime/ai-painter/capability-lifecycle/${CAPABILITY}`;
const STAGES = ["isolated_implementation", "cpu_contract_verified", "readonly_gpu_qualified", "controlled_smoke_completed"];
const SCHEMAS = {
  cpu: "stage4-v2-cpu-contract-acceptance-terminal-v1", gpu: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
  smoke: "ai-painter-stage4-v2-controlled-smoke-terminal-v1", screen: "ai-painter-joint-full-data-screen-registry-terminal-v1",
  formal: "ai-painter-stage4-v2-formal-stage0-to-stage2-execution-terminal-v2",
};

for (const [kind, stage, prior] of [
  ["cpu", null, "isolated_implementation"], ["gpu", null, "cpu_contract_verified"],
  ["smoke", null, "readonly_gpu_qualified"], ["screen", null, "controlled_smoke_completed"],
  ["formal", 0, "controlled_smoke_completed"], ["formal", 1, "controlled_smoke_completed"],
  ["formal", 2, "controlled_smoke_completed"],
]) test(`${kind}/${stage}: bound failure preserves last success through real registry file/event/SQLite write-read`, async () => {
  await fixture(async (root) => {
    qualification(root, prior);
    await initialRegistry(root);
    const before = await readCurrentExecutionRegistry(root);
    const sourceTerminal = writeFailure(root, kind, stage);
    const sourceBytes = fs.readFileSync(path.join(root, sourceTerminal.path));
    const lifecycleBefore = snapshot(path.join(root, PREFIX));
    const projected = projectStage4FailureLifecycle({ projectRoot: root, capabilityVersion: CAPABILITY, sourceTerminal, actionKind: kind });
    assert.equal(projected.status, "verified", JSON.stringify(projected));
    assert.equal(projected.lifecycleStage, prior);
    assert.notEqual(projected.lifecycleStage, "formal_stage_validation_completed");
    assert.equal(projected.failedActionId, `fixture:${kind}`);
    assert.equal(projected.failedTrainingStage, stage);
    const capsulePath = ".runtime/fixture/failure/task-capsule.json";
    write(root, capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", integrity: { status: "verified" },
      lifecycleProjection: projected, failedActionId: projected.failedActionId, failedTrainingStage: projected.failedTrainingStage,
      evidence: [sourceTerminal, projected.qualificationEvidence].map((value) => ({ ...value, sha256Verified: true })) });
    const result = await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: CAPABILITY,
      packageId: `failure-${kind}-${stage}`, taskId: `failure-${kind}-${stage}`, taskKind: "failure_boundary_adjudication",
      runId: `failure-${kind}-${stage}`, lifecycleStage: projected.lifecycleStage, executionState: "package_materialized",
      activity: "adjudication_ready", nextMachineAction: "fixture:adjudicate", taskCapsulePath: capsulePath,
      terminalEvidencePath: sourceTerminal.path, expectedPreviousRegistryRevision: before.registry.registryRevision,
      expectedPreviousRegistrySha256: before.registrySha256 });
    assert.equal(result.ok, true);
    const readback = await readCurrentExecutionRegistry(root);
    assert.equal(readback.ok, true);
    assert.equal(readback.registry.lifecycleStage, prior);
    assert.equal(readback.registry.activeExecution, null);
    assert.equal(readback.taskCapsule.failedActionId, `fixture:${kind}`);
    assert.equal(readback.taskCapsule.failedTrainingStage, stage);
    assert.deepEqual(readback.registry.latestTrainingTerminal, before.registry.latestTrainingTerminal);
    assert.deepEqual(fs.readFileSync(path.join(root, sourceTerminal.path)), sourceBytes);
    assert.deepEqual(snapshot(path.join(root, PREFIX)), lifecycleBefore);
    assert.equal(result.registry.supersedes.registryRevision, before.registry.registryRevision);

  });
});

test("missing, tampered, foreign, kind-conflicting and prematurely advanced evidence return unknown without writing", async () => {
  await fixture(async (root) => {
    qualification(root, "readonly_gpu_qualified");
    const sourceTerminal = writeFailure(root, "smoke", null);
    const args = { projectRoot: root, capabilityVersion: CAPABILITY, sourceTerminal, actionKind: "smoke" };
    const before = snapshot(root);
    for (const input of [
      { ...args, sourceTerminal: { ...sourceTerminal, sha256: "0".repeat(64) } },
      { ...args, capabilityVersion: "different-capability-v1" },
      { ...args, actionKind: "formal" },
      { ...args, sourceTerminal: { path: "../outside.json", sha256: "0".repeat(64) } },
      { ...args, sourceTerminal: null },
    ]) assert.equal(projectStage4FailureLifecycle(input).status, "unknown_or_stale");
    assert.deepEqual(snapshot(root), before);
    const tooLate = writeFailure(root, "gpu", null);
    assert.equal(projectStage4FailureLifecycle({ ...args, sourceTerminal: tooLate, actionKind: "gpu" }).status, "unknown_or_stale");
    const db = new DatabaseSync(path.join(root, PREFIX, "lifecycle.sqlite"));
    db.prepare("UPDATE capabilities SET state = 'formal_stage_validation_completed' WHERE capability_version = ?").run(CAPABILITY);
    db.close();
    const corrupted = snapshot(root);
    assert.equal(projectStage4FailureLifecycle(args).status, "unknown_or_stale");
    assert.deepEqual(snapshot(root), corrupted);
  });
});

test("a passed wrapper referencing a failed execution is not accepted as successful qualification", async () => {
  await fixture(async (root) => {
    qualification(root, "readonly_gpu_qualified");
    const failure = writeFailure(root, "smoke", null);
    advanceCapabilityLifecycle({ root, capabilityVersion: CAPABILITY, targetState: "controlled_smoke_completed",
      evidence: { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: CAPABILITY,
        targetState: "controlled_smoke_completed", status: "passed", bindings: [failure] } });
    const before = snapshot(root);
    assert.equal(readLastSuccessfulStage4Qualification({ projectRoot: root, capabilityVersion: CAPABILITY }).status, "unknown_or_stale");
    assert.deepEqual(snapshot(root), before);
  });
});

test("Stage4 CPU-to-Smoke skip is rejected even when the generic lifecycle store accepts it", async () => {
  await fixture(async (root) => {
    qualification(root, "cpu_contract_verified");
    advanceCapabilityLifecycle({ root, capabilityVersion: CAPABILITY, targetState: "controlled_smoke_completed",
      evidence: { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: CAPABILITY,
        targetState: "controlled_smoke_completed", status: "passed", bindings: [binding(root, ".runtime/fixture/source.json")] } });
    const before = snapshot(root);
    const result = readLastSuccessfulStage4Qualification({ projectRoot: root, capabilityVersion: CAPABILITY });
    assert.equal(result.status, "unknown_or_stale");
    assert.match(result.errorCode, /lifecycle_transition_invalid/u);
    assert.deepEqual(snapshot(root), before);
  });
});

for (const replaced of ["candidate.json", "evidence/002-cpu_contract_verified.json", "source.json"]) {
  test(`mid-read replacement of ${replaced} cannot remain verified`, async () => {
    await fixture(async (root) => {
      qualification(root, "readonly_gpu_qualified");
      const target = path.join(root, replaced === "source.json" ? ".runtime/fixture/source.json" : `${PREFIX}/${replaced}`);
      const statePath = path.join(root, PREFIX, "state.json");
      const originalRead = fs.readFileSync;
      let stateReads = 0;
      let mutated = false;
      fs.readFileSync = function (file, ...args) {
        if (file === statePath && ++stateReads === 2) {
          fs.appendFileSync(target, "\n");
          mutated = true;
        }
        return originalRead.call(this, file, ...args);
      };
      let result;
      try { result = readLastSuccessfulStage4Qualification({ projectRoot: root, capabilityVersion: CAPABILITY }); }
      finally { fs.readFileSync = originalRead; }
      assert.equal(mutated, true);
      assert.equal(result.status, "unknown_or_stale");
      assert.match(result.errorCode, /lifecycle_changed_during_read/u);
    });
  });
}

async function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-state-semantics-"));
  try { await run(root); }
  finally {
    const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(root));
    assert.ok(relative.startsWith("stage4-state-semantics-") && !relative.includes(path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function qualification(root, target) {
  const contractPath = "data/ai-painter/system-governance/ai-painter-capability-lifecycle-contract-v1.json";
  write(root, contractPath, JSON.parse(fs.readFileSync(path.join(PROJECT, contractPath), "utf8")));
  write(root, ".runtime/fixture/source.json", { status: "passed", syntheticFixtureOnly: true });
  const source = binding(root, ".runtime/fixture/source.json");
  createCapabilityCandidate({ schemaVersion: "ai-painter-capability-change-candidate-v1", capabilityVersion: CAPABILITY,
    changeClass: "program_lineage", ownerInLifecycle: false, ownerAuthorizationRequired: false, sourceEvidence: [source] }, { root });
  for (const stage of STAGES) {
    advanceCapabilityLifecycle({ root, capabilityVersion: CAPABILITY, targetState: stage,
      evidence: { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: CAPABILITY,
        targetState: stage, status: "passed", bindings: [source] } });
    if (stage === target) break;
  }
}
function writeFailure(root, kind, stage) {
  const relative = `.runtime/fixture/${kind}-failure.json`;
  write(root, relative, { schemaVersion: SCHEMAS[kind], capabilityVersion: CAPABILITY, runId: `failure-${kind}-${stage}`,
    action: `fixture:${kind}`, failedTrainingStage: stage, executionState: "failed_closed", status: `${kind}_failed`, syntheticFixtureOnly: true });
  return binding(root, relative);
}
async function initialRegistry(root) {
  const base = ".runtime/fixture/initial";
  write(root, `${base}/candidate.json`, { schemaVersion: "stage4-post-decode-bounded-candidate-v1", status: "cpu_inactive_candidate_planned_not_implemented" });
  write(root, `${base}/terminal.json`, { schemaVersion: "stage4-post-decode-failure-bounded-planning-terminal-v1",
    executionState: "completed", status: "bounded_candidate_planning_completed", planningRunId: "fixture-initial", nextAction: "fixture:next",
    candidate: binding(root, `${base}/candidate.json`) });
  write(root, `${base}/capsule.json`, { schemaVersion: "ai-painter-local-task-capsule-v2", latestTerminal: binding(root, `${base}/terminal.json`) });
  write(root, `${base}/training/phase-terminal.json`, { schemaVersion: "stage4-post-decode-object-rgb-stage0-terminal-v1",
    executionState: "failed_closed", status: "post_decode_object_rgb_stage0_real_visual_failure", runId: "fixture-old-training" });
  write(root, `${base}/training/execution-state.json`, { status: "failed_closed", phase: "machine_review_completed" });
  write(root, `${base}/training/machine-review.json`, { previewCount: 1, previewPassCount: 0, previewFailCount: 1 });
  write(root, `${base}/training/training-output/progress.json`, { phase: "training_completed", epoch: 1, epochTarget: 1 });
  const result = await initializeCurrentExecutionRegistry({ projectRoot: root, currentTaskCapsulePath: `${base}/capsule.json`,
    currentTaskTerminalPath: `${base}/terminal.json`, currentCandidatePath: `${base}/candidate.json`,
    latestTrainingTerminalPath: `${base}/training/phase-terminal.json`, archivedEvidenceNamespaces: [] });
  assert.equal(result.ok, true);
}
function write(root, relative, value) { textFile(root, relative, JSON.stringify(value, null, 2) + "\n"); }
function textFile(root, relative, value) { const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value); }
function sha(root, relative) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex"); }
function binding(root, relative) { return { path: relative, sha256: sha(root, relative) }; }
function snapshot(root) {
  return Object.fromEntries(fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
    .map((entry) => { const relative = path.relative(root, path.join(entry.parentPath, entry.name)); return [relative, sha(root, relative)]; }));
}
