import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import {
  buildStage4V2CandidateSpec,
  buildStage4V2IsolatedImplementationEvidence,
  collectStage4V2LifecycleSources,
  reconcileStage4V2CapabilityLifecycle,
  STAGE4_V2_CAPABILITY,
  STAGE4_V2_CPU_ACCEPTANCE_TERMINAL,
  STAGE4_V2_LIFECYCLE_ROOT,
} from "../reconcile-ai-painter-stage4-v2-capability-lifecycle.mjs";
import {
  advanceCapabilityLifecycle,
  createCapabilityCandidate,
} from "../lib/ai-painter-capability-lifecycle-v1.mjs";

const TEST_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_ROOT, "../..");
const RECONCILER_PATH = path.join(
  PROJECT_ROOT,
  "scripts/reconcile-ai-painter-stage4-v2-capability-lifecycle.mjs",
);
const CURRENT_PATH = ".runtime/ai-painter/current-execution-registry/current.json";

test("fresh reconciliation creates the canonical V2 lifecycle and the second run is byte-idempotent", () => {
  withFixture((fixture) => {
    const currentBefore = sha256File(fixture.absolute(CURRENT_PATH));
    const timestamps = [
      "2026-08-31T14:00:00.000Z",
      "2026-08-31T14:00:01.000Z",
      "2026-08-31T14:00:02.000Z",
    ];
    const first = reconcileStage4V2CapabilityLifecycle({
      projectRoot: fixture.root,
      now: () => timestamps.shift(),
    });
    assert.equal(first.status, "reconciled");
    assert.equal(first.lifecycleState, "cpu_contract_verified");
    assert.equal(first.lifecycleSequence, 2);
    assert.deepEqual(first.actions, [
      "created_change_candidate",
      "advanced_isolated_implementation",
      "advanced_cpu_contract_verified",
    ]);
    assertClosedResult(first);
    assert.equal(sha256File(fixture.absolute(CURRENT_PATH)), currentBefore);

    const state = fixture.read(`${STAGE4_V2_LIFECYCLE_ROOT}/state.json`);
    assert.equal(state.state, "cpu_contract_verified");
    assert.equal(state.sequence, 2);
    const candidate = fixture.read(`${STAGE4_V2_LIFECYCLE_ROOT}/candidate.json`);
    assert.equal(candidate.capabilityVersion, STAGE4_V2_CAPABILITY);
    assert.equal(candidate.changeClass, "model_family");
    assert.deepEqual(candidate.sourceEvidence.map((binding) => binding.role), [
      "failure_boundary_classification",
      "v2_parent_contract",
      "cpu_acceptance_terminal",
    ]);
    assertLifecycleDatabase(fixture.root, "cpu_contract_verified", 3);

    const lifecycleBefore = snapshotDirectory(fixture.absolute(STAGE4_V2_LIFECYCLE_ROOT));
    const second = reconcileStage4V2CapabilityLifecycle({
      projectRoot: fixture.root,
      now: () => { throw new Error("idempotent run attempted a lifecycle write"); },
    });
    assert.equal(second.status, "already_reconciled");
    assert.deepEqual(second.actions, []);
    assertClosedResult(second);
    assert.deepEqual(snapshotDirectory(fixture.absolute(STAGE4_V2_LIFECYCLE_ROOT)), lifecycleBefore);
    assert.equal(sha256File(fixture.absolute(CURRENT_PATH)), currentBefore);
  });
});

test("reconciliation resumes a verified isolated implementation without duplicating prior transitions", () => {
  withFixture((fixture) => {
    const sources = collectStage4V2LifecycleSources({
      projectRoot: fixture.root,
      cpuAcceptanceTerminalPath: fixture.cpuTerminalPath,
    });
    const candidate = buildStage4V2CandidateSpec(sources);
    const isolatedEvidence = buildStage4V2IsolatedImplementationEvidence(sources);
    createCapabilityCandidate(candidate, {
      root: fixture.root,
      recordedAtUtc: "2026-08-31T14:10:00.000Z",
    });
    advanceCapabilityLifecycle({
      root: fixture.root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      targetState: "isolated_implementation",
      evidence: isolatedEvidence,
      recordedAtUtc: "2026-08-31T14:10:01.000Z",
    });
    const currentBefore = sha256File(fixture.absolute(CURRENT_PATH));

    const result = reconcileStage4V2CapabilityLifecycle({
      projectRoot: fixture.root,
      now: () => "2026-08-31T14:10:02.000Z",
    });
    assert.equal(result.status, "reconciled");
    assert.deepEqual(result.actions, ["advanced_cpu_contract_verified"]);
    assert.equal(result.lifecycleState, "cpu_contract_verified");
    assertLifecycleDatabase(fixture.root, "cpu_contract_verified", 3);
    assert.equal(sha256File(fixture.absolute(CURRENT_PATH)), currentBefore);
  });
});

test("tampered classification binding fails closed before a candidate is created", () => {
  withFixture((fixture) => {
    const classification = fixture.read(fixture.classificationPath);
    classification.classificationBasis = "tampered-after-cpu-acceptance";
    fixture.write(fixture.classificationPath, classification);
    const currentBefore = sha256File(fixture.absolute(CURRENT_PATH));

    assert.throws(
      () => reconcileStage4V2CapabilityLifecycle({ projectRoot: fixture.root }),
      /failure_boundary_classification SHA-256 mismatch/u,
    );
    assert.equal(fs.existsSync(fixture.absolute(STAGE4_V2_LIFECYCLE_ROOT)), false);
    assert.equal(sha256File(fixture.absolute(CURRENT_PATH)), currentBefore);
  });
});

test("CPU terminal bytes cannot be replaced by a self-bound unsafe terminal", () => {
  withFixture((fixture) => {
    const terminal = fixture.read(fixture.cpuTerminalPath);
    terminal.safety.gpuStarted = true;
    fixture.write(fixture.cpuTerminalPath, terminal);
    const currentBefore = sha256File(fixture.absolute(CURRENT_PATH));

    assert.throws(
      () => reconcileStage4V2CapabilityLifecycle({ projectRoot: fixture.root }),
      /V2 CPU acceptance terminal SHA-256 mismatch/u,
    );
    assert.equal(fs.existsSync(fixture.absolute(STAGE4_V2_LIFECYCLE_ROOT)), false);
    assert.equal(sha256File(fixture.absolute(CURRENT_PATH)), currentBefore);
  });
});

test("a conflicting pre-existing candidate is preserved and rejected without repair", () => {
  withFixture((fixture) => {
    const sources = collectStage4V2LifecycleSources({
      projectRoot: fixture.root,
      cpuAcceptanceTerminalPath: fixture.cpuTerminalPath,
    });
    const conflicting = {
      ...buildStage4V2CandidateSpec(sources),
      changeClass: "program_lineage",
    };
    createCapabilityCandidate(conflicting, {
      root: fixture.root,
      recordedAtUtc: "2026-08-31T14:20:00.000Z",
    });
    const lifecycleBefore = snapshotDirectory(fixture.absolute(STAGE4_V2_LIFECYCLE_ROOT));

    assert.throws(
      () => reconcileStage4V2CapabilityLifecycle({ projectRoot: fixture.root }),
      /existing V2 capability candidate conflicts with canonical reconciliation/u,
    );
    assert.deepEqual(snapshotDirectory(fixture.absolute(STAGE4_V2_LIFECYCLE_ROOT)), lifecycleBefore);
    assertLifecycleDatabase(fixture.root, "change_candidate", 1, "program_lineage");
  });
});

test("reconciliation source has no subprocess or GPU execution surface", () => {
  const source = fs.readFileSync(RECONCILER_PATH, "utf8");
  assert.doesNotMatch(source, /node:child_process|\bspawn(?:Sync)?\b|\bexecFile(?:Sync)?\b|nvidia-smi|torch\.|\.cuda\b/u);
  assert.doesNotMatch(source, /advanceCurrentExecutionRegistry|initializeCurrentExecutionRegistry/u);
  assert.match(source, /currentExecutionRegistryWritten: false/u);
  assert.match(source, /gpuStarted: false/u);
  assert.match(source, /trainingStarted: false/u);
});

test("CLI performs the same CPU-only reconciliation in an isolated project root", () => {
  withFixture((fixture) => {
    const currentBefore = sha256File(fixture.absolute(CURRENT_PATH));
    const result = spawnSync(process.execPath, [RECONCILER_PATH], {
      cwd: fixture.root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, "reconciled");
    assert.equal(output.lifecycleState, "cpu_contract_verified");
    assertClosedResult(output);
    assert.equal(sha256File(fixture.absolute(CURRENT_PATH)), currentBefore);
  });
});

function withFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-pet-world-stage4-v2-lifecycle-"));
  const resolvedTemp = path.resolve(os.tmpdir());
  assert.ok(path.relative(resolvedTemp, root).startsWith("ai-pet-world-stage4-v2-lifecycle-"));
  try {
    const fixture = createFixture(root);
    run(fixture);
  } finally {
    assert.ok(path.relative(resolvedTemp, root).startsWith("ai-pet-world-stage4-v2-lifecycle-"));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function createFixture(root) {
  const lifecycleContractPath = "data/ai-painter/system-governance/ai-painter-capability-lifecycle-contract-v1.json";
  const cpuTerminalPath = STAGE4_V2_CPU_ACCEPTANCE_TERMINAL.path;
  const actualTerminal = readProjectJson(cpuTerminalPath);
  const actualReport = readProjectJson(actualTerminal.cpuAcceptanceReport.path);
  const actualContract = readProjectJson(actualTerminal.successorContract.path);
  const evidencePaths = new Set([
    lifecycleContractPath,
    CURRENT_PATH,
    cpuTerminalPath,
    actualTerminal.cpuAcceptanceReport.path,
    actualTerminal.sourceAdjudication.terminal.path,
    actualTerminal.sourceAdjudication.classification.path,
    actualTerminal.successorContract.path,
    ...Object.values(actualReport.programLineage).map((binding) => binding.path),
    actualContract.conditionContract.path,
    actualContract.datasetBinding.path,
    actualContract.datasetBinding.sourceManifest.path,
    actualContract.datasetBinding.sourceIndex.path,
    actualContract.lossContract.path,
    actualContract.reviewThresholdContract.path,
    actualContract.foundationAssetBinding.path,
    ...Object.values(actualContract.prerequisiteBindings).map((binding) => binding.path),
    ...Object.values(actualContract.programBindings).map((binding) => binding.path),
  ]);
  for (const logicalPath of evidencePaths) copyProjectFile(logicalPath, root);
  const classificationPath = actualTerminal.sourceAdjudication.classification.path;

  return {
    root,
    classificationPath,
    cpuTerminalPath,
    absolute(logicalPath) { return absolute(root, logicalPath); },
    read(logicalPath) { return readJson(root, logicalPath); },
    write(logicalPath, value) { writeJson(root, logicalPath, value); },
  };
}

function assertClosedResult(result) {
  assert.equal(result.currentExecutionRegistryWritten, false);
  assert.equal(result.gpuStarted, false);
  assert.equal(result.optimizerCreated, false);
  assert.equal(result.backwardExecuted, false);
  assert.equal(result.weightsModified, false);
  assert.equal(result.trainingStarted, false);
  assert.equal(result.ownerAuthorizationRequired, false);
}

function assertLifecycleDatabase(root, expectedState, expectedTransitionCount, expectedChangeClass = "model_family") {
  const database = new DatabaseSync(absolute(root, `${STAGE4_V2_LIFECYCLE_ROOT}/lifecycle.sqlite`), { readOnly: true });
  try {
    const capability = database.prepare(
      "SELECT state, change_class, owner_response_required FROM capabilities WHERE capability_version = ?",
    ).get(STAGE4_V2_CAPABILITY);
    assert.deepEqual({ ...capability }, {
      state: expectedState,
      change_class: expectedChangeClass,
      owner_response_required: 0,
    });
    const count = database.prepare(
      "SELECT COUNT(*) AS count FROM lifecycle_transitions WHERE capability_version = ?",
    ).get(STAGE4_V2_CAPABILITY);
    assert.equal(count.count, expectedTransitionCount);
  } finally {
    database.close();
  }
}

function snapshotDirectory(directory) {
  const result = {};
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else result[path.relative(directory, absolutePath).replaceAll("\\", "/")] = sha256File(absolutePath);
    }
  };
  visit(directory);
  return result;
}

function copyProjectFile(logicalPath, fixtureRoot) {
  const destination = absolute(fixtureRoot, logicalPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(PROJECT_ROOT, ...logicalPath.split("/")), destination);
}

function readJson(root, logicalPath) {
  return JSON.parse(fs.readFileSync(absolute(root, logicalPath), "utf8"));
}

function readProjectJson(logicalPath) {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, ...logicalPath.split("/")), "utf8"));
}

function writeJson(root, logicalPath, value) {
  writeText(root, logicalPath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(root, logicalPath, value) {
  const destination = absolute(root, logicalPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, value, "utf8");
}

function absolute(root, logicalPath) {
  const result = path.resolve(root, ...logicalPath.split("/"));
  const relative = path.relative(path.resolve(root), result);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  return result;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
