import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ADJUDICATION_ACTION,
  ADJUDICATION_TASK,
  CAPABILITY_VERSION,
  adjudicateStage4V2ReadonlyGpuQualificationFailure,
  classifyStage4V2ReadonlyGpuFailure,
} from "../adjudicate-ai-painter-stage4-v2-readonly-gpu-qualification-failure.mjs";

testDeterministicClassification();
await testReadOnlyAdjudicationWritesImmutableEvidence();
await testAdjudicationRecoversAfterEventBeforeRegistry();
await testAdjudicationRecoversAfterRegistryBeforeJournal();
process.stdout.write("Stage4 V2 readonly-GPU failure adjudication tests passed.\n");

function testDeterministicClassification() {
  const cases = [
    ["trainer entrypoint argument mismatch", "program_integration_failure"],
    ["CUDA out of memory during resource preflight", "resource_boundary_failure"],
    ["autograd returned zero gradient for responsibility output", "computation_graph_or_gradient_failure"],
    ["bound evidence SHA-256 mismatch", "evidence_integrity_failure"],
    ["external license policy boundary", "policy_boundary_failure"],
  ];
  for (const [error, category] of cases) {
    const result = classifyStage4V2ReadonlyGpuFailure({
      terminal: { executionState: "failed_closed" },
      failureReport: { failureCode: "fixture", error },
    });
    assert.equal(result.category, category);
    assert.equal(typeof result.nextBoundaryAction, "string");
  }
  assert.equal(classifyStage4V2ReadonlyGpuFailure({
    terminal: { executionState: "failed_closed" },
    failureReport: null,
    evidenceIntegrityError: "failure_report_sha256_mismatch",
  }).category, "evidence_integrity_failure");
}

async function testReadOnlyAdjudicationWritesImmutableEvidence() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-gpu-adjudication-"));
  try {
    const sourceRoot = path.join(root, ".runtime", "source");
    fs.mkdirSync(sourceRoot, { recursive: true });
    const failurePath = path.join(sourceRoot, "failure-report.json");
    writeJson(failurePath, {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-failure-report-v1",
      executionState: "failed_closed",
      status: "stage4_v2_readonly_gpu_qualification_failed_closed",
      packageId: "fixture-package",
      runId: "fixture-run",
      capabilityVersion: CAPABILITY_VERSION,
      failureCode: "qualification_resource_preflight_failed",
      error: "available GPU memory below frozen minimum",
      automaticRetryAllowed: false,
      ownerAuthorizationRequired: false,
    });
    const failureBinding = binding(root, failurePath);
    const terminalPath = path.join(sourceRoot, "phase-terminal.json");
    writeJson(terminalPath, {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
      executionState: "failed_closed",
      status: "stage4_v2_readonly_gpu_qualification_failed_closed",
      packageId: "fixture-package",
      runId: "fixture-run",
      capabilityVersion: CAPABILITY_VERSION,
      failureReport: failureBinding,
      nextMachineAction: ADJUDICATION_ACTION,
      ownerAuthorizationRequired: false,
      automaticRetryAllowed: false,
    });
    const terminalBinding = binding(root, terminalPath);
    const current = {
      ok: true,
      registrySha256: "a".repeat(64),
      registry: {
        registryRevision: 7,
        capabilityVersion: CAPABILITY_VERSION,
        packageId: "fixture-package",
        taskId: ADJUDICATION_TASK,
        taskKind: "cpu_readonly_adjudication",
        nextMachineAction: ADJUDICATION_ACTION,
        executionState: "package_materialized",
        activeExecution: null,
        terminalEvidence: { ...terminalBinding, status: "stage4_v2_readonly_gpu_qualification_failed_closed" },
      },
      currentTaskTerminal: JSON.parse(fs.readFileSync(terminalPath, "utf8")),
    };
    let registryInput = null;
    const commitOrder = [];
    const result = await adjudicateStage4V2ReadonlyGpuQualificationFailure({
      projectRoot: root,
      currentReader: async () => current,
      registryWriter: async (input) => {
        commitOrder.push("registry");
        registryInput = input;
        return { registry: { registryRevision: 8 }, registrySha256: "b".repeat(64) };
      },
      dependencyCommitter: fakeDependencyCommitter(root, commitOrder),
      commitCurrentRegistry: true,
      appendProgramEvent: true,
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    });
    assert.equal(result.classification, "resource_boundary_failure");
    assert.equal(result.nextMachineAction, null);
    assert.equal(result.automaticRetryAllowed, false);
    assert.equal(result.ownerAuthorizationRequired, false);
    assert.equal(result.gpuStarted, false);
    assert.equal(result.trainingStarted, false);
    assert.equal(result.registryRevision, 8);
    assert.equal(registryInput.expectedPreviousRegistryRevision, 7);
    assert.equal(registryInput.nextMachineAction, null);
    assert.equal(registryInput.queueStatus, "completed");
    assert.equal(registryInput.executionState, "completed");
    assert.equal(registryInput.dependencyManifest.mode, "external");
    assert.match(registryInput.dependencyManifest.outerJournal.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(typeof registryInput.dependencyManifest.outerJournal.operationId, "string");
    assert.deepEqual(commitOrder, ["event", "registry"]);
    const terminal = JSON.parse(fs.readFileSync(path.join(root, result.terminal.path), "utf8"));
    assert.equal(terminal.executionState, "completed");
    assert.equal(terminal.classification, "resource_boundary_failure");
    assert.equal(terminal.nextMachineAction, null);
    assert.equal(terminal.checkpointWeightsRead, false);
    assert.match(result.terminal.sha256, /^[a-f0-9]{64}$/u);
    assert.throws(() => fs.writeFileSync(path.join(root, result.terminal.path), "duplicate", { flag: "wx" }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testAdjudicationRecoversAfterEventBeforeRegistry() {
  const fixture = createFailureFixture();
  try {
    const eventCommits = [];
    let registryCalls = 0;
    const args = {
      projectRoot: fixture.root,
      currentReader: async () => fixture.current,
      registryWriter: async () => {
        registryCalls += 1;
        return { registry: { registryRevision: 8 }, registrySha256: "b".repeat(64) };
      },
      dependencyCommitter: fakeDependencyCommitter(fixture.root, eventCommits),
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    };
    await assert.rejects(
      adjudicateStage4V2ReadonlyGpuQualificationFailure({
        ...args,
        _testHooks: {
          afterProgramEventCommitted() {
            throw new Error("injected:post-event-pre-registry");
          },
        },
      }),
      /injected:post-event-pre-registry/,
    );
    const recovered = await adjudicateStage4V2ReadonlyGpuQualificationFailure({
      ...args,
      now: () => new Date("2026-09-01T01:00:00.000Z"),
    });
    assert.equal(registryCalls, 1);
    assert.equal(eventCommits.length, 1, "recovery duplicated the append-only event");
    assert.equal(recovered.adjudicationRunId,
      `stage4-v2-readonly-gpu-failure-adjudication-${fixture.terminalBinding.sha256.slice(0, 24)}`);
    const journal = readJson(path.join(
      fixture.root,
      ".runtime/ai-painter/stage4-v2-readonly-gpu-failure-adjudications",
      recovered.adjudicationRunId,
      "outer-transaction-journal.json",
    ));
    assert.equal(journal.state, "registry_committed");
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

async function testAdjudicationRecoversAfterRegistryBeforeJournal() {
  const fixture = createFailureFixture();
  try {
    const eventCommits = [];
    let registryCalls = 0;
    let visible = fixture.current;
    const registryWriter = async (input) => {
      registryCalls += 1;
      const terminalBinding = binding(fixture.root, path.join(fixture.root, input.terminalEvidencePath));
      const capsuleBinding = binding(fixture.root, path.join(fixture.root, input.taskCapsulePath));
      visible = {
        ok: true,
        registrySha256: "b".repeat(64),
        registry: {
          ...input,
          registryRevision: 8,
          terminalEvidence: terminalBinding,
          taskCapsule: capsuleBinding,
        },
        currentTaskTerminal: readJson(path.join(fixture.root, input.terminalEvidencePath)),
      };
      return visible;
    };
    const args = {
      projectRoot: fixture.root,
      currentReader: async () => visible,
      registryWriter,
      dependencyCommitter: fakeDependencyCommitter(fixture.root, eventCommits),
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    };
    await assert.rejects(
      adjudicateStage4V2ReadonlyGpuQualificationFailure({
        ...args,
        _testHooks: {
          afterRegistryCommitted() {
            throw new Error("injected:post-registry-pre-journal");
          },
        },
      }),
      /injected:post-registry-pre-journal/,
    );
    const recovered = await adjudicateStage4V2ReadonlyGpuQualificationFailure({
      ...args,
      now: () => new Date("2026-09-01T02:00:00.000Z"),
    });
    assert.equal(recovered.recovered, true);
    assert.equal(registryCalls, 1, "committed registry was published twice");
    assert.equal(eventCommits.length, 1, "committed event was appended twice");
    const journal = readJson(path.join(
      fixture.root,
      ".runtime/ai-painter/stage4-v2-readonly-gpu-failure-adjudications",
      recovered.adjudicationRunId,
      "outer-transaction-journal.json",
    ));
    assert.equal(journal.state, "registry_committed");
    assert.equal(journal.registry.registrySha256, "b".repeat(64));
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function createFailureFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-gpu-adjudication-recovery-"));
  const sourceRoot = path.join(root, ".runtime", "source");
  fs.mkdirSync(sourceRoot, { recursive: true });
  const failurePath = path.join(sourceRoot, "failure-report.json");
  writeJson(failurePath, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-failure-report-v1",
    executionState: "failed_closed",
    status: "stage4_v2_readonly_gpu_qualification_failed_closed",
    packageId: "fixture-package",
    runId: "fixture-run",
    capabilityVersion: CAPABILITY_VERSION,
    failureCode: "qualification_resource_preflight_failed",
    error: "available GPU memory below frozen minimum",
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
  });
  const failureBinding = binding(root, failurePath);
  const terminalPath = path.join(sourceRoot, "phase-terminal.json");
  writeJson(terminalPath, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
    executionState: "failed_closed",
    status: "stage4_v2_readonly_gpu_qualification_failed_closed",
    packageId: "fixture-package",
    runId: "fixture-run",
    capabilityVersion: CAPABILITY_VERSION,
    failureReport: failureBinding,
    nextMachineAction: ADJUDICATION_ACTION,
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
  });
  const terminalBinding = binding(root, terminalPath);
  return {
    root,
    terminalBinding,
    current: {
      ok: true,
      registrySha256: "a".repeat(64),
      registry: {
        registryRevision: 7,
        capabilityVersion: CAPABILITY_VERSION,
        packageId: "fixture-package",
        taskId: ADJUDICATION_TASK,
        taskKind: "cpu_readonly_adjudication",
        nextMachineAction: ADJUDICATION_ACTION,
        executionState: "package_materialized",
        activeExecution: null,
        terminalEvidence: {
          ...terminalBinding,
          status: "stage4_v2_readonly_gpu_qualification_failed_closed",
        },
      },
      currentTaskTerminal: readJson(terminalPath),
    },
  };
}

function fakeDependencyCommitter(root, commitOrder) {
  return ({
    journalPath,
    operationId,
    capabilityVersion,
    packageId,
    runId,
    recordedAtUtc,
    bindings,
    eventInput,
  }) => {
    const journal = {
      schemaVersion: "fixture-registry-dependency-journal-v1",
      state: "event_committed",
      operationId,
      capabilityVersion,
      packageId,
      runId,
      bindings,
      programEventId: eventInput.id,
      ownerAuthorizationRequired: false,
      recordedAtUtc,
    };
    if (!fs.existsSync(journalPath)) {
      writeJson(journalPath, journal);
      commitOrder.push("event");
    } else {
      assert.deepEqual(readJson(journalPath), journal,
        "fake dependency event changed during recovery");
    }
    const journalBinding = binding(root, journalPath);
    return {
      eventCommit: { event: eventInput },
      dependencyManifest: {
        schemaVersion: "ai-painter-current-execution-registry-dependency-manifest-v1",
        mode: "external",
        outerJournal: {
          path: journalBinding.path,
          sha256: journalBinding.sha256,
          requiredState: "event_committed",
          operationId,
        },
        bindings,
        programEvent: {
          event: eventInput,
          eventId: eventInput.id,
          ledgerPath: ".runtime/fixture/events.jsonl",
          latestPath: ".runtime/fixture/latest.json",
          catalogDatabasePath: ".runtime/fixture/catalog.sqlite",
        },
        catalogArtifacts: [],
      },
    };
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function binding(root, filePath) {
  return {
    path: path.relative(root, filePath).replaceAll("\\", "/"),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
  };
}
