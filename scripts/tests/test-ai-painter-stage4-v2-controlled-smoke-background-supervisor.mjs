import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  launchProjectCommandBackground,
} from "../lib/ai-painter-autonomous-background-launcher-v1.mjs";
import {
  launchStage4V2ControlledSmokeBackground,
  superviseStage4V2ControlledSmokeBackground,
} from "../launch-ai-painter-stage4-v2-controlled-smoke-background.mjs";
import {
  validateStage4V2ControlledSmokeBackgroundLaunchIntent,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-launch-intent-v1.mjs";
import {
  buildDerivedTrainerExecution,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  buildStage4V2SmokeProgramGraph,
} from "../lib/ai-painter-program-graph-manifest-v1.mjs";

const RECEIPT_ROOT = ".runtime/ai-painter/stage4-v2-controlled-smoke-background-launches";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-smoke-supervisor-"));
const repositoryRoot = process.cwd();

try {
  await testTopLevelLaunchIntent();
  await testTopLevelPostSpawnRecovery();
  const payload = { packageId: "package-1", runId: "run-1" };
  const packageRoot = path.join(root, ".runtime", "package-1");
  const launchIdentity = "stage4-v2-smoke-bg-run-1";
  const runnerArgs = ["--package-manifest", "manifest.json", "--launch-intent", "intent.json"];
  fs.mkdirSync(packageRoot, { recursive: true });
  const initialReceipt = writeReceipt({ launchIdentity, processId: 101, runnerArgs });
  writeRawActiveRegistry({
    payload, processId: 101, processStartIdentity: "101:start",
    heartbeatAtUtc: "2026-09-01T00:00:00.000Z", ttlSeconds: 60,
  });
  let launches = 0;
  let registryReads = 0;
  let waits = 0;
  const firstClock = scriptedClock([
    "2026-09-01T00:00:30.000Z", "2026-09-01T00:00:30.000Z",
    "2026-09-01T00:00:30.000Z", "2026-09-01T00:01:01.000Z",
    "2026-09-01T00:01:01.000Z", "2026-09-01T00:01:02.000Z",
  ]);
  const result = await superviseStage4V2ControlledSmokeBackground({
    root,
    payload,
    runnerArgs,
    launchIdentity,
    initialReceipt,
    initialProcessStartIdentity: "101:start",
    packageRoot,
    backgroundLauncher: ({ launchIdentity: recoveryIdentity, runnerArgs: recoveryArgs }) => {
      launches += 1;
      assert.ok(waits >= 1,
        "recovery launch must wait for the exact bound heartbeat TTL");
      assert.equal(recoveryIdentity, `${launchIdentity}-recovery-1`);
      assert.deepEqual(recoveryArgs, runnerArgs);
      return writeReceipt({
        launchIdentity: recoveryIdentity, processId: 202, runnerArgs: recoveryArgs,
      });
    },
    processIdentityProbe: async (processId) => processId === 101
      ? { status: "dead", processId, processStartIdentity: null }
      : { status: "active", processId, processStartIdentity: "202:start" },
    currentRegistryReader: async () => {
      registryReads += 1;
      if (registryReads <= 2) return {
        ok: false, errorCode: "registry_active_execution_process_dead",
      };
      return terminalRegistry();
    },
    waitForPoll: async () => { waits += 1; },
    now: firstClock,
  });
  assert.equal(result.status, "terminal_registry_observed");
  assert.equal(result.recoveryLaunchCount, 1);
  assert.equal(launches, 1);
  const journal = JSON.parse(fs.readFileSync(path.join(
    packageRoot, "background-supervisor-journal.json",
  ), "utf8"));
  assert.equal(journal.newTrainingTicketAllowed, false);
  assert.equal(journal.automaticTrainingRetryAllowed, false);
  assert.equal(journal.recoveryLaunchCount, 1);
  assert.equal(journal.activeProcess.processId, 202);

  const failureRoot = path.join(root, ".runtime", "package-2");
  fs.mkdirSync(failureRoot, { recursive: true });
  const failureIdentity = "stage4-v2-smoke-bg-run-2";
  const failureReceipt = writeReceipt({
    launchIdentity: failureIdentity, processId: 303, runnerArgs,
  });
  writeRawActiveRegistry({
    payload: { packageId: "package-2", runId: "run-2" },
    processId: 303, processStartIdentity: "303:start",
    heartbeatAtUtc: "2026-08-31T23:00:00.000Z", ttlSeconds: 60,
  });
  let failureLaunches = 0;
  let probes = 0;
  await assert.rejects(() => superviseStage4V2ControlledSmokeBackground({
    root,
    payload: { packageId: "package-2", runId: "run-2" },
    runnerArgs,
    launchIdentity: failureIdentity,
    initialReceipt: failureReceipt,
    initialProcessStartIdentity: "303:start",
    packageRoot: failureRoot,
    backgroundLauncher: ({ launchIdentity: recoveryIdentity, runnerArgs: recoveryArgs }) => {
      failureLaunches += 1;
      return writeReceipt({
        launchIdentity: recoveryIdentity, processId: 404, runnerArgs: recoveryArgs,
      });
    },
    processIdentityProbe: async (processId) => {
      probes += 1;
      if (processId === 404 && probes === 2) {
        return { status: "active", processId, processStartIdentity: "404:start" };
      }
      return { status: "dead", processId, processStartIdentity: null };
    },
    currentRegistryReader: async () => ({
      ok: false, errorCode: "registry_active_execution_process_dead",
    }),
    waitForPoll: async () => {},
    now: sequentialClock(),
  }), /single bounded same-package recovery/u);
  assert.equal(failureLaunches, 1,
    "supervisor must never launch a second recovery child");

  const indeterminateRoot = path.join(root, ".runtime", "package-3");
  fs.mkdirSync(indeterminateRoot, { recursive: true });
  const indeterminateIdentity = "stage4-v2-smoke-bg-run-3";
  const indeterminateReceipt = writeReceipt({
    launchIdentity: indeterminateIdentity, processId: 505, runnerArgs,
  });
  let indeterminateLaunches = 0;
  await assert.rejects(() => superviseStage4V2ControlledSmokeBackground({
    root,
    payload: { packageId: "package-3", runId: "run-3" },
    runnerArgs,
    launchIdentity: indeterminateIdentity,
    initialReceipt: indeterminateReceipt,
    initialProcessStartIdentity: "505:start",
    packageRoot: indeterminateRoot,
    backgroundLauncher: () => { indeterminateLaunches += 1; },
    processIdentityProbe: async () => ({
      status: "indeterminate", processId: 505, processStartIdentity: null,
    }),
    currentRegistryReader: async () => ({
      ok: false, errorCode: "registry_active_execution_identity_indeterminate",
    }),
    waitForPoll: async () => {},
    now: sequentialClock(),
  }), /identity is indeterminate/u);
  assert.equal(indeterminateLaunches, 0,
    "indeterminate process identity must never trigger recovery launch");

  const successorRoot = path.join(root, ".runtime", "package-4");
  fs.mkdirSync(successorRoot, { recursive: true });
  const successorIdentity = "stage4-v2-smoke-bg-run-4";
  const successorReceipt = writeReceipt({
    launchIdentity: successorIdentity, processId: 606, runnerArgs,
  });
  let successorInvocations = 0;
  let successorRecoveryLaunches = 0;
  const successor = await superviseStage4V2ControlledSmokeBackground({
    root,
    payload: { packageId: "package-4", runId: "run-4" },
    runnerArgs,
    launchIdentity: successorIdentity,
    initialReceipt: successorReceipt,
    initialProcessStartIdentity: "606:start",
    packageRoot: successorRoot,
    backgroundLauncher: () => { successorRecoveryLaunches += 1; },
    processIdentityProbe: async () => ({
      status: "dead", processId: 606, processStartIdentity: null,
    }),
    currentRegistryReader: async () => ({
      ok: true,
      registrySha256: "d".repeat(64),
      registry: {
        packageId: "package-4",
        runId: "run-4",
        taskId: "materialize_stage4_v2_formal_stage0_to_stage2",
        nextMachineAction: "plan:ai-painter-stage4-v2-formal-stage0-to-stage2",
        queueStatus: "ready",
        executionState: "package_materialized",
        activeExecution: null,
        registryRevision: 12,
      },
    }),
    successorInvoker: async ({ nextMachineAction }) => {
      successorInvocations += 1;
      assert.equal(nextMachineAction,
        "plan:ai-painter-stage4-v2-formal-stage0-to-stage2");
      return { status: "formal_plan_materialized_not_executed" };
    },
    waitForPoll: async () => {},
    now: sequentialClock(),
  });
  assert.equal(successor.status, "terminal_registry_observed");
  assert.equal(successorInvocations, 1,
    "persisted same-package successor must be resumed exactly once");
  assert.equal(successorRecoveryLaunches, 0,
    "post-registry/pre-successor crash must not relaunch Smoke training");

  process.stdout.write("Stage4 V2 Smoke supervisor: TTL recovery, fail-close and post-registry successor recovery passed.\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

function writeReceipt({ launchIdentity, processId, runnerArgs }) {
  const receipt = {
    schemaVersion: "ai-painter-local-program-background-command-receipt-v1",
    status: "background_process_started",
    launchIdentity,
    runnerPath: "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs",
    runnerSha256: "a".repeat(64),
    runnerArgs,
    processId,
    launchMethod: "test_detached",
    detachedFromCodex: true,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc: "2026-09-01T00:00:00.000Z",
  };
  const directory = path.join(root, ...`${RECEIPT_ROOT}/${launchIdentity}`.split("/"));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "launch-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

function terminalRegistry() {
  return {
    ok: true,
    registrySha256: "c".repeat(64),
    registry: {
      packageId: "successor-package",
      runId: "successor-run",
      executionState: "package_materialized",
      activeExecution: null,
      registryRevision: 11,
    },
  };
}

function sequentialClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 8, 1, 0, 0, tick++));
}

async function testTopLevelLaunchIntent() {
  const launchRoot = path.join(root, "top-level-launch");
  const fixture = materializeLaunchFixture(launchRoot);
  let readerCalls = 0;
  let spawnCount = 0;
  const launchProcess = () => {
    spawnCount += 1;
    return fakeBackgroundProcess(909);
  };
  const result = await launchStage4V2ControlledSmokeBackground({
    projectRoot: launchRoot,
    currentRegistryReader: async () => {
      readerCalls += 1;
      return fixture.current;
    },
    backgroundLauncher: (input) => launchProjectCommandBackground({
      ...input,
      processLauncher: launchProcess,
    }),
    processIdentityProbe: async (processId) => ({
      status: "active",
      processId,
      processStartIdentity: fakeBackgroundProcess(processId).processStartIdentity,
    }),
    supervise: false,
    now: () => new Date("2026-09-01T00:00:00.000Z"),
  });
  assert.equal(readerCalls, 1,
    "top-level launcher ignored the injected current registry reader");
  assert.equal(spawnCount, 1,
    "top-level launcher did not create exactly one detached process");
  const intent = JSON.parse(fs.readFileSync(path.join(
    launchRoot, ...result.launchIntent.path.split("/")), "utf8"));
  assert.equal(Object.hasOwn(intent, "currentRegistry"), false,
    "background launch intent persisted mutable current.json evidence");
  assert.equal(intent.currentRegistryTransaction.path.endsWith("/transaction.json"), true);
  assert.equal(intent.currentRegistrySnapshot.path.endsWith("/current.staged.json"), true);
  assert.notEqual(intent.currentRegistrySnapshot.path,
    ".runtime/ai-painter/current-execution-registry/current.json");

  const intentPath = path.join(launchRoot, ...result.launchIntent.path.split("/"));
  const originalIntentBytes = fs.readFileSync(intentPath);
  const alternateIntentPath = path.join(path.dirname(intentPath),
    "alternate-background-launch-intent.json");
  fs.writeFileSync(alternateIntentPath, originalIntentBytes);
  assert.throws(() => validateStage4V2ControlledSmokeBackgroundLaunchIntent({
    projectRoot: launchRoot,
    launchIntentBinding: bindFile(launchRoot, alternateIntentPath),
    packageManifestBinding: fixture.manifestBinding,
  }), /outside the bound package namespace/u);
  for (const [name, mutate, pattern] of [
    ["launch_action", (value) => { value.launchAction = "launch:forged"; }, /launchAction|Expected values/u],
    ["detachment", (value) => { value.detachedFromCodexRequired = false; }, /false !== true|Expected values/u],
    ["owner_policy", (value) => { value.ownerAuthorizationRequired = true; }, /true !== false|Expected values/u],
    ["runner_hash", (value) => { value.runner.sha256 = "0".repeat(64); }, /runner identity/u],
    ["registry_transaction", (value) => {
      value.currentRegistryTransaction.sha256 = "0".repeat(64);
    }, /SHA-256 mismatch/u],
  ]) {
    const forged = JSON.parse(originalIntentBytes.toString("utf8"));
    mutate(forged);
    fs.writeFileSync(intentPath, `${JSON.stringify(forged, null, 2)}\n`);
    assert.throws(() => validateStage4V2ControlledSmokeBackgroundLaunchIntent({
      projectRoot: launchRoot,
      launchIntentBinding: bindFile(launchRoot, intentPath),
      packageManifestBinding: fixture.manifestBinding,
    }), pattern, `Smoke child accepted ${name} launch-intent tamper`);
    fs.writeFileSync(intentPath, originalIntentBytes);
  }

  for (const [name, tamper, pattern] of [
    ["transaction", (value) => {
      const transactionPath = path.join(value.root,
        ...value.transactionBinding.path.split("/"));
      const transaction = JSON.parse(fs.readFileSync(transactionPath, "utf8"));
      transaction.currentStaged.sha256 = "0".repeat(64);
      fs.writeFileSync(transactionPath, `${JSON.stringify(transaction, null, 2)}\n`);
    }, /SHA-256 mismatch|staged snapshot/u],
    ["staged_snapshot", (value) => {
      fs.appendFileSync(path.join(value.root,
        ...value.snapshotBinding.path.split("/")), " \n", "utf8");
    }, /SHA-256 mismatch/u],
    ["program_graph_dependency", (value) => {
      fs.appendFileSync(path.join(value.root,
        "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs"),
      "// post-materialization replacement\n", "utf8");
    }, /program graph manifest differs/u],
  ]) {
    const negative = materializeLaunchFixture(path.join(
      root, `top-level-launch-negative-${name}`));
    tamper(negative);
    await assert.rejects(() => launchStage4V2ControlledSmokeBackground({
      projectRoot: negative.root,
      currentRegistryReader: async () => negative.current,
      backgroundLauncher: () => {
        throw new Error("background launch must not occur after immutable evidence tamper");
      },
      supervise: false,
    }), pattern);
    assert.equal(fs.existsSync(path.join(negative.packageRoot,
      "background-launch-intent.json")), false,
    `${name} tamper wrote a background launch intent`);
  }
}

async function testTopLevelPostSpawnRecovery() {
  const launchRoot = path.join(root, "top-level-post-spawn-recovery");
  const fixture = materializeLaunchFixture(launchRoot);
  let spawnCount = 0;
  let crashAfterSpawn = true;
  const launch = (input) => launchProjectCommandBackground({
    ...input,
    processLauncher: () => {
      spawnCount += 1;
      return fakeBackgroundProcess(919);
    },
    attemptProbe: ({ attempt }) => ({
      status: "matched",
      matches: [{
        ...fakeBackgroundProcess(919),
        commandIdentitySha256: attempt.commandIdentitySha256,
      }],
    }),
    _testHooks: crashAfterSpawn ? {
      afterProcessSpawnBeforeReceipt() {
        crashAfterSpawn = false;
        throw new Error("fixture-post-spawn-before-receipt-crash");
      },
    } : null,
  });
  const options = {
    projectRoot: launchRoot,
    currentRegistryReader: async () => fixture.current,
    backgroundLauncher: launch,
    processIdentityProbe: async (processId) => ({
      status: "active",
      processId,
      processStartIdentity: fakeBackgroundProcess(processId).processStartIdentity,
    }),
    supervise: false,
    now: () => new Date("2026-09-01T00:00:00.000Z"),
  };
  await assert.rejects(
    () => launchStage4V2ControlledSmokeBackground(options),
    /fixture-post-spawn-before-receipt-crash/u,
  );
  const recovered = await launchStage4V2ControlledSmokeBackground(options);
  assert.equal(spawnCount, 1,
    "outer Smoke launcher respawned after post-spawn/pre-receipt interruption");
  assert.equal(recovered.receipt.recoveredAfterInterruptedSpawn, true);
  assert.equal(recovered.receipt.repeatedSpawnAllowed, false);

  const receiptPath = path.join(launchRoot, ...`${RECEIPT_ROOT}/${recovered.receipt.launchIdentity}/launch-receipt.json`.split("/"));
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  receipt.commandIdentitySha256 = "0".repeat(64);
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  await assert.rejects(
    () => launchStage4V2ControlledSmokeBackground(options),
    /identity mismatch/u,
  );
  assert.equal(spawnCount, 1,
    "tampered persisted receipt triggered another process spawn");
}

function materializeLaunchFixture(projectRoot) {
  fs.mkdirSync(projectRoot, { recursive: true });
  const runnerPath = path.join(projectRoot,
    "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs");
  fs.mkdirSync(path.dirname(runnerPath), { recursive: true });
  fs.writeFileSync(runnerPath, "export const fixtureRunner = true;\n", "utf8");
  writeProgramGraphFixtureFiles(projectRoot);
  const runner = bindFile(projectRoot, runnerPath);
  const packageId = "stage4-v2-launch-fixture-package";
  const runId = "stage4-v2-launch-fixture-run";
  const packageRoot = path.join(projectRoot, ".runtime", "fixture", packageId);
  fs.mkdirSync(packageRoot, { recursive: true });
  const programLineage = { outerRunner: runner };
  const programGraphPath = writeFixtureJson(projectRoot,
    `.runtime/fixture/${packageId}/program-graph-manifest.json`,
    buildStage4V2SmokeProgramGraph({
      projectRoot,
      programLineage,
    }));
  const programGraphManifest = bindFile(projectRoot, programGraphPath);
  const evidence = (name) => bindFile(projectRoot, writeFixtureJson(
    projectRoot, `.runtime/fixture/${packageId}/evidence/${name}.json`,
    { status: "fixture", name },
  ));
  const qualificationTerminal = evidence("qualification-terminal");
  const datasetRelease = evidence("dataset-release");
  const autoencoderCheckpoint = evidence("autoencoder-checkpoint");
  const thresholdContract = evidence("threshold-contract");
  const conditionPack = { ...evidence("condition-pack"), channelCount: 23 };
  const referenceRgb = evidence("reference-rgb");
  const styleFingerprint = evidence("style-fingerprint");
  const objectMasks = [
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
  ].map((role) => ({ role, ...evidence(role) }));
  const reviewPrograms = {
    conditionAlignment: evidence("condition-alignment"),
    professionalAesthetic: evidence("professional-aesthetic"),
    styleFeatureExtractor: evidence("style-feature-extractor"),
  };
  const outputDirectory = `.runtime/ai-painter/stage4-v2-controlled-smoke-executions/${runId}`;
  const payload = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-package-payload-v1",
    status: "materialized_not_executed",
    packageId,
    runId,
    architectureId: "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2",
    capabilityVersion: "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2",
    executionClass: "controlled_smoke",
    authorityClass: "local_ai_pre_release_capability_lifecycle",
    ownerAuthorizationRequired: false,
    datasetPackageId: "stage4-v2-fixture-dataset",
    outputDirectory,
    reviewExecutionBindingId:
      `stage4-v2-smoke-review-${crypto.createHash("sha256").update(JSON.stringify({ packageId, runId })).digest("hex").slice(0, 24)}`,
    readonlyGpuQualificationTerminal: qualificationTerminal,
    datasetRelease,
    autoencoderCheckpoint,
    machineReviewInputs: {
      thresholdContract,
      conditionPack,
      referenceRgb,
      objectMasks,
      styleFingerprint,
      reviewPrograms,
    },
    fixedInputs: {
      seed: 20263722,
      sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
      sampleSplit: "validation",
      resolution: { width: 256, height: 192 },
      epochCount: 30,
      previewEpochs: [1, 5, 10, 20, 30],
      batchSize: 1,
      conditionChannels: 23,
    },
    derivedTrainerExecution: buildDerivedTrainerExecution({
      packageId,
      runId,
      datasetPackageId: "stage4-v2-fixture-dataset",
      outputDirectory,
    }),
    inputEvidence: [qualificationTerminal, datasetRelease, autoencoderCheckpoint],
    programLineage,
    programGraphManifest,
    executionBoundary: {
      trainingAllowed: true,
      optimizerAllowed: true,
      backwardAllowed: true,
      weightMutationAllowed: true,
      checkpointWriteAllowed: true,
      stage0Allowed: false,
    },
    failurePolicy: {
      automaticRetryAllowed: false,
      historicalDenoiserCheckpointAllowed: false,
      outputReuseAllowed: false,
    },
  };
  const payloadPath = writeFixtureJson(projectRoot,
    `.runtime/fixture/${packageId}/package-payload.json`, payload);
  const payloadBinding = bindFile(projectRoot, payloadPath);
  const manifestPath = writeFixtureJson(projectRoot,
    `.runtime/fixture/${packageId}/smoke-package-manifest.json`, {
      packagePayload: payloadBinding,
      programGraphManifest,
    });
  const manifestBinding = bindFile(projectRoot, manifestPath);
  const terminalPath = writeFixtureJson(projectRoot,
    `.runtime/fixture/${packageId}/materialization-terminal.json`, {
      schemaVersion:
        "ai-painter-stage4-v2-controlled-smoke-materialization-terminal-v1",
      packageManifest: manifestBinding,
    });
  const terminalBinding = bindFile(projectRoot, terminalPath);
  const capsulePath = writeFixtureJson(projectRoot,
    `.runtime/fixture/${packageId}/task-capsule.json`, { status: "fixture" });
  const capsuleBinding = bindFile(projectRoot, capsulePath);
  const transactionId = "current-execution-registry-launch-fixture";
  const registry = {
    schemaVersion: "ai-painter-current-execution-registry-v1",
    registryRevision: 7,
    eventSequence: 7,
    transactionId,
    capabilityVersion:
      "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2",
    packageId,
    runId,
    taskId: "execute_stage4_v2_controlled_smoke",
    nextMachineAction:
      "launch:ai-painter-stage4-v2-controlled-smoke-background",
    executionState: "package_materialized",
    activeExecution: null,
    queuedAtUtc: "2026-09-01T00:00:00.000Z",
    taskCapsule: capsuleBinding,
    terminalEvidence: terminalBinding,
  };
  const currentPath = writeFixtureJson(projectRoot,
    ".runtime/ai-painter/current-execution-registry/current.json", registry);
  const snapshotPath = writeFixtureJson(projectRoot,
    `.runtime/ai-painter/current-execution-registry/transactions/${transactionId}/current.staged.json`,
    registry);
  const snapshotBinding = bindFile(projectRoot, snapshotPath);
  const transactionPath = writeFixtureJson(projectRoot,
    `.runtime/ai-painter/current-execution-registry/transactions/${transactionId}/transaction.json`, {
      schemaVersion: "ai-painter-current-execution-registry-transaction-v1",
      status: "committed",
      transactionId,
      registryRevision: registry.registryRevision,
      eventSequence: registry.eventSequence,
      currentSha256: bindFile(projectRoot, currentPath).sha256,
      currentStaged: snapshotBinding,
    });
  const transactionBinding = bindFile(projectRoot, transactionPath);
  return {
    root: projectRoot,
    runner,
    manifestBinding,
    packageRoot,
    snapshotBinding,
    transactionBinding,
    current: {
      ok: true,
      registry,
      registrySha256: bindFile(projectRoot, currentPath).sha256,
      currentTaskTerminal: JSON.parse(fs.readFileSync(terminalPath, "utf8")),
    },
  };
}

function writeProgramGraphFixtureFiles(projectRoot) {
  // The production program graph includes this Python AST helper as a bound
  // entrypoint. Keep the fixture complete so the supervisor test exercises
  // the same graph contract as a real package.
  writeFixtureText(projectRoot,
    "scripts/lib/ai-painter-python-import-ast-v1.py",
    fs.readFileSync(path.join(repositoryRoot,
      "scripts", "lib", "ai-painter-python-import-ast-v1.py"), "utf8"));
  writeFixtureText(projectRoot,
    "scripts/lib/ai-painter-stage4-v2-qualification-continuation-v1.mjs",
    "export async function dispatch(url) { return import(url.href); }\n");
  writeFixtureText(projectRoot,
    "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
    "export async function dispatch(url) { return import(url); }\n");
  writeFixtureText(projectRoot,
    "scripts/launch-ai-painter-stage4-v2-controlled-smoke-background.mjs",
    "export async function launch() { return import('./run-ai-painter-stage4-v2-controlled-smoke.mjs'); }\n");
  for (const logicalPath of [
    "scripts/plan-ai-painter-stage4-v2-controlled-smoke.mjs",
    "scripts/plan-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs",
    "scripts/run-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs",
    "scripts/adjudicate-ai-painter-stage4-v2-controlled-smoke-failure-boundary.mjs",
    "scripts/adjudicate-ai-painter-stage4-v2-readonly-gpu-qualification-failure.mjs",
    "scripts/lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs",
  ]) writeFixtureText(projectRoot, logicalPath, `fixture:${logicalPath}\n`);
}

function writeFixtureText(projectRoot, logicalPath, bytes) {
  const target = path.join(projectRoot, ...logicalPath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, "utf8");
  return target;
}

function fakeBackgroundProcess(processId) {
  const processCreationDateUtc = "2026-09-01T00:00:00.000Z";
  return {
    processId,
    processStartIdentity: `${processId}:${processCreationDateUtc}`,
    processIdentitySource: "fixture_exact_process_identity_v1",
    processCreationDateUtc,
    launchMethod: "fixture_detached_exactly_once",
  };
}

function writeFixtureJson(projectRoot, relative, value) {
  const target = path.join(projectRoot, ...relative.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

function bindFile(projectRoot, file) {
  return {
    path: path.relative(projectRoot, file).replaceAll("\\", "/"),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    byteSize: fs.statSync(file).size,
  };
}

function scriptedClock(values) {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]);
}

function writeRawActiveRegistry({
  payload, processId, processStartIdentity, heartbeatAtUtc, ttlSeconds,
}) {
  const base = path.join(root, ".runtime", "supervisor-fixtures", payload.runId);
  fs.mkdirSync(base, { recursive: true });
  const lockPath = path.join(base, "lock.json");
  const heartbeatPath = path.join(base, "heartbeat.json");
  fs.writeFileSync(lockPath, `${JSON.stringify({
    schemaVersion: "ai-painter-current-active-execution-lock-v1",
    packageId: payload.packageId,
    runId: payload.runId,
    processId,
    processStartIdentity,
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(heartbeatPath, `${JSON.stringify({
    schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
    packageId: payload.packageId,
    runId: payload.runId,
    processId,
    processStartIdentity,
    executionState: "executing",
    heartbeatAtUtc,
    ttlSeconds,
  }, null, 2)}\n`, "utf8");
  const currentPath = path.join(root, ".runtime", "ai-painter",
    "current-execution-registry", "current.json");
  fs.mkdirSync(path.dirname(currentPath), { recursive: true });
  fs.writeFileSync(currentPath, `${JSON.stringify({
    schemaVersion: "ai-painter-current-execution-registry-v1",
    packageId: payload.packageId,
    runId: payload.runId,
    executionState: "executing",
    activeExecution: {
      packageId: payload.packageId,
      runId: payload.runId,
      processId,
      processStartIdentity,
      lock: {
        path: logical(lockPath),
        sha256: crypto.createHash("sha256").update(fs.readFileSync(lockPath)).digest("hex"),
      },
      heartbeat: { path: logical(heartbeatPath), ttlSeconds },
    },
  }, null, 2)}\n`, "utf8");
}

function logical(absolute) {
  return path.relative(root, absolute).replaceAll("\\", "/");
}
