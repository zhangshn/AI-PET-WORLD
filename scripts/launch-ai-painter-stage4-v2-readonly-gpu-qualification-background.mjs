import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";
import {
  MATERIALIZED_RUN_ACTION,
  MATERIALIZED_RUN_TASK,
} from "./plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
import {
  QUALIFICATION_FAILURE_ACTION,
  QUALIFICATION_SUCCESS_PLAN_ACTION,
  continueStage4V2AfterReadonlyGpuQualification,
} from "./lib/ai-painter-stage4-v2-qualification-continuation-v1.mjs";
import {
  claimExactlyOneBackgroundSpawnMatch,
  exactSpawnNodeArguments,
  prepareExactlyOnceBackgroundSpawn,
  probeExactlyOnceBackgroundSpawn,
} from "./lib/ai-painter-exactly-once-background-spawn-v1.mjs";
import {
  STAGE4_V2_CAPABILITY,
  bindProjectFile,
  projectLogicalPath,
  readJsonObject,
  resolveProjectPath,
  sha256File,
  validateStage4V2PreReleaseQualificationTicket,
  writeExclusiveJson,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

export const STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ACTION =
  "launch:ai-painter-stage4-v2-readonly-gpu-qualification-background";
export const STAGE4_V2_QUALIFICATION_CHILD_RUN_ACTION =
  "run:ai-painter-stage4-v2-readonly-gpu-qualification";
export const STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ROOT =
  ".runtime/ai-painter/stage4-v2-readonly-gpu-background-launches";

const NODE_RUNNER_PATH = "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
const BACKGROUND_LAUNCHER_PATH =
  "scripts/launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs";
const SAFE_EXECUTION_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,191}$/u;
const HANDOFF_POLL_INTERVAL_MS = 5_000;
const HANDOFF_MAX_WAIT_MS = 45 * 60 * 1000;

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const args = process.argv.slice(2);
  const supervising = args[0] === "--supervise-handoff";
  const cli = supervising ? parseHandoffSupervisorCli(args) : parseLaunchCli(args);
  const operation = supervising
    ? superviseStage4V2ReadonlyGpuQualificationHandoff({
        projectRoot: process.cwd(),
        packageManifestBinding: cli.packageManifestBinding,
        launchIntentBinding: cli.launchIntentBinding,
        childProcessRecordBinding: cli.childProcessRecordBinding,
      })
    : launchStage4V2ReadonlyGpuQualificationBackground({
        projectRoot: process.cwd(),
        packageManifestPath: cli.packageManifestPath,
        packageManifestSha256: cli.packageManifestSha256,
      });
  operation.then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function launchStage4V2ReadonlyGpuQualificationBackground({
  projectRoot = process.cwd(),
  packageManifestPath = null,
  packageManifestSha256 = null,
  currentRegistryReader = readCurrentExecutionRegistry,
  backgroundSpawner = spawnBackgroundQualificationProcess,
  handoffSupervisorSpawner = null,
  processIdentityProbe = probeBackgroundProcessIdentity,
  launchAttemptProbe = probeExactlyOnceBackgroundSpawn,
  ticketValidator = validateStage4V2PreReleaseQualificationTicket,
  now = () => new Date(),
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  const resolvedHandoffSupervisorSpawner = handoffSupervisorSpawner
    ?? (backgroundSpawner === spawnBackgroundQualificationProcess
      ? spawnBackgroundQualificationHandoffSupervisor
      : null);
  const current = await currentRegistryReader(root);
  assert.equal(current.ok, true, current.errorCode ?? "current execution registry is not verified");
  verifyQualificationLaunchRegistryForEntry(current);

  const terminal = current.currentTaskTerminal;
  assert.equal(
    terminal?.schemaVersion,
    "ai-painter-stage4-v2-readonly-gpu-materialization-terminal-v1",
    "current terminal is not a V2 qualification materialization terminal",
  );
  assert.equal(terminal.executionState, "completed", "qualification materialization is incomplete");
  assert.equal(
    terminal.status,
    "stage4_v2_readonly_gpu_qualification_package_materialized",
    "qualification materialization terminal status mismatch",
  );
  assert.equal(terminal.packageId, current.registry.packageId, "terminal package identity mismatch");
  assert.equal(terminal.runId, current.registry.runId, "terminal run identity mismatch");
  assert.equal(terminal.outputDirectoryCreated, false, "qualification output already exists by terminal contract");
  assert.equal(terminal.ticketStatus, "issued_not_consumed_persisted", "qualification ticket is not launchable");
  assert.equal(terminal.nextMachineAction, MATERIALIZED_RUN_ACTION, "terminal background launch action mismatch");

  const manifestBinding = bindProjectFile(root, terminal.manifest.path, terminal.manifest.sha256);
  if (packageManifestPath !== null) {
    assert.equal(
      normalizeLogicalPath(root, packageManifestPath),
      manifestBinding.path,
      "explicit package manifest is not the current materialized package",
    );
  }
  if (packageManifestSha256 !== null) {
    assert.equal(packageManifestSha256, manifestBinding.sha256, "explicit package manifest SHA-256 mismatch");
  }
  const manifest = readProjectJson(root, manifestBinding.path);
  verifyLaunchableManifest(manifest, current.registry);
  const packagePayload = readBoundProjectJson(root, manifest.packagePayload);
  const ticket = readBoundProjectJson(root, manifest.preReleaseQualificationTicket);
  verifyLaunchablePayload(packagePayload, manifest);
  ticketValidator({
    projectRoot: root,
    ticket,
    packagePayload,
    verifyEvidence: true,
    nowUtc: now().toISOString(),
  });

  const backgroundLauncher = bindProjectFile(root, BACKGROUND_LAUNCHER_PATH);
  const childRunner = bindProjectFile(root, NODE_RUNNER_PATH);
  assert.deepEqual(
    packagePayload.programLineage.backgroundLauncher,
    backgroundLauncher,
    "package background-launcher lineage mismatch",
  );
  assert.deepEqual(
    packagePayload.programLineage.nodeRunner,
    childRunner,
    "package child-runner lineage mismatch",
  );
  const launchDirectory = `${STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ROOT}/${packagePayload.packageId}`;
  const launchAbsolute = resolveProjectPath(root, launchDirectory);
  fs.mkdirSync(path.dirname(launchAbsolute), { recursive: true });
  const launchIntentPath = path.join(launchAbsolute, "launch-intent.json");
  const journalPath = path.join(launchAbsolute, "launch-journal.json");
  const spawnAttemptPath = path.join(launchAbsolute, "child-spawn-attempt.json");
  const processRecordPath = path.join(launchAbsolute, "child-process-identity.json");
  const receiptPath = path.join(launchAbsolute, "launch-receipt.json");
  const failurePath = path.join(launchAbsolute, "launch-failure.json");
  if (fs.existsSync(launchAbsolute)) {
    const recovered = await recoverStage4V2QualificationBackgroundLaunch({
      root,
      current,
      manifest,
      manifestBinding,
      packagePayload,
      backgroundLauncher,
      childRunner,
      launchDirectory,
      launchIntentPath,
      journalPath,
      spawnAttemptPath,
      processRecordPath,
      receiptPath,
      failurePath,
      backgroundSpawner,
      processIdentityProbe,
      launchAttemptProbe,
      now,
      _testHooks,
    });
    return ensureQualificationHandoffSupervisor({
      root,
      launchAbsolute,
      manifestBinding,
      packagePayload,
      launchIntentBinding: recovered.launchIntent,
      processRecordPath,
      launchResult: recovered,
      handoffSupervisorSpawner: resolvedHandoffSupervisorSpawner,
      processIdentityProbe,
      launchAttemptProbe,
      now,
      _testHooks,
    });
  }
  verifyLaunchableCurrentRegistry(current);
  assert.equal(
    fs.existsSync(resolveProjectPath(root, packagePayload.outputDirectory)),
    false,
    "qualification output directory reuse is forbidden",
  );
  assert.equal(
    fs.existsSync(resolveProjectPath(root, packagePayload.preflightDirectory)),
    false,
    "qualification preflight directory reuse is forbidden",
  );
  fs.mkdirSync(launchAbsolute, { recursive: false });

  const recordedAtUtc = now().toISOString();
  const launchIntent = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-background-launch-intent-v1",
    status: "launch_intent_persisted_child_not_yet_confirmed",
    launchAction: STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ACTION,
    childRunAction: STAGE4_V2_QUALIFICATION_CHILD_RUN_ACTION,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    outputDirectory: packagePayload.outputDirectory,
    preflightDirectory: packagePayload.preflightDirectory,
    currentRegistry: {
      registryRevision: current.registry.registryRevision,
      registrySha256: current.registrySha256,
      taskId: current.registry.taskId,
      nextMachineAction: current.registry.nextMachineAction,
    },
    packageManifest: manifestBinding,
    packagePayload: manifest.packagePayload,
    signedTicket: manifest.preReleaseQualificationTicket,
    backgroundLauncher,
    childRunner,
    detachedFromCodexRequired: true,
    repeatedLaunchAllowed: false,
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  };
  writeExclusiveJson(launchIntentPath, launchIntent);
  const launchIntentBinding = bindProjectFile(root, projectLogicalPath(root, launchIntentPath));
  writeExclusiveJson(journalPath, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-background-launch-journal-v1",
    state: "intent_persisted_not_started",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    launchIntent: launchIntentBinding,
    recoveryLaunchCount: 0,
    processStartRecorded: false,
    receiptCommitted: false,
    automaticRetryAllowed: false,
    recordedAtUtc,
    updatedAtUtc: recordedAtUtc,
  });
  invokeHook(_testHooks, "afterLaunchIntentPersisted", {
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    launchIntent: launchIntentBinding,
  });

  const launched = await executeBackgroundLaunchAttempt({
    root,
    manifestBinding,
    packagePayload,
    childRunner,
    launchDirectory,
    launchIntentBinding,
    journalPath,
    spawnAttemptPath,
    processRecordPath,
    receiptPath,
    failurePath,
    backgroundSpawner,
    launchAttemptProbe,
    now,
    _testHooks,
    recoveredAttempt: false,
  });
  return ensureQualificationHandoffSupervisor({
    root,
    launchAbsolute,
    manifestBinding,
    packagePayload,
    launchIntentBinding: launched.launchIntent,
    processRecordPath,
    launchResult: launched,
    handoffSupervisorSpawner: resolvedHandoffSupervisorSpawner,
    processIdentityProbe,
    launchAttemptProbe,
    now,
    _testHooks,
  });
}

async function recoverStage4V2QualificationBackgroundLaunch({
  root,
  current,
  manifest,
  manifestBinding,
  packagePayload,
  backgroundLauncher,
  childRunner,
  launchDirectory,
  launchIntentPath,
  journalPath,
  spawnAttemptPath,
  processRecordPath,
  receiptPath,
  failurePath,
  backgroundSpawner,
  processIdentityProbe,
  launchAttemptProbe,
  now,
  _testHooks,
}) {
  assert.equal(fs.existsSync(launchIntentPath), true,
    "existing background launch namespace has no immutable launch intent");
  assert.equal(fs.existsSync(journalPath), true,
    "existing background launch namespace has no recovery journal");
  const launchIntentBinding = bindProjectFile(root, projectLogicalPath(root, launchIntentPath));
  validateStage4V2BackgroundLaunchIntent({
    projectRoot: root,
    launchIntentBinding,
    packageManifestBinding: manifestBinding,
    packagePayloadBinding: manifest.packagePayload,
    signedTicketBinding: manifest.preReleaseQualificationTicket,
    packagePayload,
  });
  const journal = readJsonObject(journalPath);
  validateLaunchJournal(journal, { packagePayload, launchIntentBinding });
  if (fs.existsSync(failurePath)) {
    const failure = readJsonObject(failurePath);
    throw new Error(`qualification background launch is failed-closed: ${failure.error ?? failure.status}`);
  }
  if (fs.existsSync(receiptPath)) {
    const receiptBinding = bindProjectFile(root, projectLogicalPath(root, receiptPath));
    const receipt = readJsonObject(receiptPath);
    validateLaunchReceipt(receipt, {
      packagePayload,
      manifestBinding,
      launchIntentBinding,
      childRunner,
    });
    return buildLaunchResult({
      packagePayload,
      launchIntentBinding,
      receiptBinding,
      receipt,
      recovered: true,
    });
  }
  if (fs.existsSync(processRecordPath)) {
    const processRecord = readJsonObject(processRecordPath);
    validateProcessRecord(processRecord, { packagePayload, launchIntentBinding, childRunner });
    if (current.registry.activeExecution !== null) {
      assert.equal(current.registry.activeExecution.packageId, packagePayload.packageId,
        "active qualification package differs from launch process record");
      assert.equal(current.registry.activeExecution.runId, packagePayload.runId,
        "active qualification run differs from launch process record");
      assert.equal(current.registry.activeExecution.processId, processRecord.processId,
        "active qualification PID differs from launch process record");
      assert.equal(current.registry.activeExecution.processStartIdentity, processRecord.processStartIdentity,
        "active qualification process start identity differs from launch process record");
    }
    const observed = await processIdentityProbe({
      root,
      processId: processRecord.processId,
      expectedProcessStartIdentity: processRecord.processStartIdentity,
    });
    assert.ok(observed && ["active", "dead", "indeterminate"].includes(observed.status),
      "background process identity probe is invalid");
    if (observed.status !== "active" || observed.processStartIdentity !== processRecord.processStartIdentity) {
      const error = new Error(`background child identity is not uniquely active: ${observed.status}`);
      persistLaunchFailure({
        root,
        failurePath,
        packagePayload,
        manifestBinding,
        launchIntentBinding,
        launched: processRecord,
        error,
        now,
      });
      throw error;
    }
    const receipt = buildLaunchReceipt({
      packagePayload,
      manifestBinding,
      launchIntentBinding,
      childRunner,
      launched: processRecord,
      now,
      recoveredReceipt: true,
      spawnAttemptBinding: processRecord.spawnAttempt,
      commandIdentitySha256: processRecord.commandIdentitySha256,
    });
    writeExclusiveJson(receiptPath, receipt);
    const receiptBinding = bindProjectFile(root, projectLogicalPath(root, receiptPath));
    updateLaunchJournal(journalPath, {
      ...journal,
      state: "receipt_committed",
      processStartRecorded: true,
      receiptCommitted: true,
      receipt: receiptBinding,
      updatedAtUtc: now().toISOString(),
    });
    return buildLaunchResult({
      packagePayload,
      launchIntentBinding,
      receiptBinding,
      receipt,
      recovered: true,
    });
  }

  if (fs.existsSync(spawnAttemptPath)) {
    const runnerArgs = qualificationRunnerArgs({
      manifestBinding, launchIntentBinding,
    });
    const attempt = prepareExactlyOnceBackgroundSpawn({
      projectRoot: root,
      attemptPath: spawnAttemptPath,
      launchIdentity: `stage4-v2-qualification-${packagePayload.packageId}`,
      runnerPath: childRunner.path,
      runnerSha256: childRunner.sha256,
      runnerArgs,
      recordedAtUtc: journal.recordedAtUtc,
    });
    let recovered;
    try {
      recovered = claimExactlyOneBackgroundSpawnMatch(
        await launchAttemptProbe({ projectRoot: root, attempt }), attempt,
      );
    } catch (error) {
      persistLaunchFailure({
        root, failurePath, packagePayload, manifestBinding,
        launchIntentBinding, launched: null, error, now,
      });
      throw error;
    }
    const launched = {
      ...recovered,
      stdoutPath: `${launchDirectory}/stdout.log`,
      stderrPath: `${launchDirectory}/stderr.log`,
    };
    const processRecord = buildQualificationProcessRecord({
      root,
      packagePayload,
      launchIntentBinding,
      childRunner,
      spawnAttemptPath,
      attempt,
      launched,
      recoveredAttempt: true,
      now,
    });
    writeExclusiveJson(processRecordPath, processRecord);
    const processRecordBinding = bindProjectFile(root,
      projectLogicalPath(root, processRecordPath));
    const receipt = buildLaunchReceipt({
      packagePayload, manifestBinding, launchIntentBinding, childRunner,
      launched, now, recoveredReceipt: true,
      spawnAttemptBinding: bindProjectFile(root,
        projectLogicalPath(root, spawnAttemptPath)),
      commandIdentitySha256: attempt.commandIdentitySha256,
    });
    writeExclusiveJson(receiptPath, receipt);
    const receiptBinding = bindProjectFile(root, projectLogicalPath(root, receiptPath));
    updateLaunchJournal(journalPath, {
      ...journal,
      state: "receipt_committed",
      spawnAttempt: bindProjectFile(root,
        projectLogicalPath(root, spawnAttemptPath)),
      childProcessIdentity: processRecordBinding,
      processStartRecorded: true,
      receiptCommitted: true,
      receipt: receiptBinding,
      recoveredWithoutDuplicateSpawn: true,
      updatedAtUtc: now().toISOString(),
    });
    return buildLaunchResult({
      packagePayload, launchIntentBinding, receiptBinding, receipt,
      recovered: true,
    });
  }

  assert.equal(journal.state, "intent_persisted_not_started",
    "launch recovery has no process identity but journal is not safely resumable");
  assert.equal(journal.recoveryLaunchCount, 0,
    "launch recovery already consumed its single pre-start recovery");
  assert.equal(fs.existsSync(resolveProjectPath(root, packagePayload.outputDirectory)), false,
    "launch recovery found qualification output without a child identity");
  assert.equal(fs.existsSync(resolveProjectPath(root, packagePayload.preflightDirectory)), false,
    "launch recovery found qualification preflight evidence without a child identity");
  updateLaunchJournal(journalPath, {
    ...journal,
    state: "pre_start_recovery_resumed",
    recoveryLaunchCount: 1,
    updatedAtUtc: now().toISOString(),
  });
  return executeBackgroundLaunchAttempt({
    root,
    manifestBinding,
    packagePayload,
    childRunner,
    launchDirectory,
    launchIntentBinding,
    journalPath,
    spawnAttemptPath,
    processRecordPath,
    receiptPath,
    failurePath,
    backgroundSpawner,
    now,
    _testHooks,
    recoveredAttempt: true,
  });
}

async function executeBackgroundLaunchAttempt({
  root,
  manifestBinding,
  packagePayload,
  childRunner,
  launchDirectory,
  launchIntentBinding,
  journalPath,
  spawnAttemptPath,
  processRecordPath,
  receiptPath,
  failurePath,
  backgroundSpawner,
  now,
  _testHooks,
  recoveredAttempt,
}) {
  let launched = null;
  try {
    const runnerArgs = qualificationRunnerArgs({
      manifestBinding, launchIntentBinding,
    });
    const attempt = prepareExactlyOnceBackgroundSpawn({
      projectRoot: root,
      attemptPath: spawnAttemptPath,
      launchIdentity: `stage4-v2-qualification-${packagePayload.packageId}`,
      runnerPath: childRunner.path,
      runnerSha256: childRunner.sha256,
      runnerArgs,
      recordedAtUtc: now().toISOString(),
    });
    const spawnAttemptBinding = bindProjectFile(root,
      projectLogicalPath(root, spawnAttemptPath));
    updateLaunchJournal(journalPath, {
      ...readJsonObject(journalPath),
      state: "spawn_attempt_persisted",
      spawnAttempt: spawnAttemptBinding,
      updatedAtUtc: now().toISOString(),
    });
    invokeHook(_testHooks, "afterChildSpawnAttemptPersisted", {
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      spawnAttempt: spawnAttemptBinding,
    });
    launched = await backgroundSpawner({
      root,
      runnerPath: childRunner.path,
      runnerArgs,
      launchDirectory,
      spawnAttempt: attempt,
    });
    validateSpawnResult(launched);
    invokeHook(_testHooks, "afterChildSpawnBeforeProcessRecord", {
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      spawnAttempt: spawnAttemptBinding,
      processId: launched.processId,
    });
    const processRecord = buildQualificationProcessRecord({
      root, packagePayload, launchIntentBinding, childRunner,
      spawnAttemptPath, attempt, launched, recoveredAttempt, now,
    });
    writeExclusiveJson(processRecordPath, processRecord);
    const processRecordBinding = bindProjectFile(root, projectLogicalPath(root, processRecordPath));
    const journal = readJsonObject(journalPath);
    updateLaunchJournal(journalPath, {
      ...journal,
      state: "child_identity_recorded",
      spawnAttempt: spawnAttemptBinding,
      processStartRecorded: true,
      childProcessIdentity: processRecordBinding,
      updatedAtUtc: now().toISOString(),
    });
    invokeHook(_testHooks, "afterChildSpawnBeforeReceipt", {
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      childProcessIdentity: processRecordBinding,
    });
    const receipt = buildLaunchReceipt({
      packagePayload,
      manifestBinding,
      launchIntentBinding,
      childRunner,
      launched,
      now,
      recoveredReceipt: false,
      spawnAttemptBinding,
      commandIdentitySha256: attempt.commandIdentitySha256,
    });
    writeExclusiveJson(receiptPath, receipt);
    const receiptBinding = bindProjectFile(root, projectLogicalPath(root, receiptPath));
    updateLaunchJournal(journalPath, {
      ...readJsonObject(journalPath),
      state: "receipt_committed",
      processStartRecorded: true,
      receiptCommitted: true,
      receipt: receiptBinding,
      updatedAtUtc: now().toISOString(),
    });
    invokeHook(_testHooks, "afterLaunchReceiptPersisted", {
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      receipt: receiptBinding,
    });
    return buildLaunchResult({
      packagePayload,
      launchIntentBinding,
      receiptBinding,
      receipt,
      recovered: recoveredAttempt,
    });
  } catch (error) {
    if (isInjectedCrash(error)) throw error;
    persistLaunchFailure({
      root,
      failurePath,
      packagePayload,
      manifestBinding,
      launchIntentBinding,
      launched,
      error,
      now,
    });
    throw error;
  }
}

async function ensureQualificationHandoffSupervisor({
  root,
  launchAbsolute,
  manifestBinding,
  packagePayload,
  launchIntentBinding,
  processRecordPath,
  launchResult,
  handoffSupervisorSpawner,
  processIdentityProbe,
  launchAttemptProbe,
  now,
  _testHooks,
}) {
  if (handoffSupervisorSpawner === null) return launchResult;
  const childProcessRecordBinding = bindProjectFile(
    root,
    projectLogicalPath(root, processRecordPath),
  );
  const supervisorIntentPath = path.join(launchAbsolute, "handoff-supervisor-intent.json");
  const supervisorProcessPath = path.join(launchAbsolute, "handoff-supervisor-process.json");
  const supervisorSpawnAttemptPath = path.join(launchAbsolute,
    "handoff-supervisor-spawn-attempt.json");
  const supervisorReceiptPath = path.join(launchAbsolute, "handoff-supervisor-receipt.json");
  const supervisorFailurePath = path.join(launchAbsolute, "handoff-supervisor-failure.json");
  const supervisorRuntimeDirectory = path.join(launchAbsolute, "handoff-supervisor-runtime");
  const proposedIntent = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-handoff-supervisor-intent-v1",
    status: "handoff_supervision_required",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    packageManifest: manifestBinding,
    launchIntent: launchIntentBinding,
    qualificationChildProcess: childProcessRecordBinding,
    successorSource: "current_execution_registry_exact_action",
    qualificationRelaunchAllowed: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: now().toISOString(),
  };
  const intent = fs.existsSync(supervisorIntentPath)
    ? {
      ...proposedIntent,
      recordedAtUtc: readJsonObject(supervisorIntentPath).recordedAtUtc,
    }
    : proposedIntent;
  writeOrVerifyLaunchJson(supervisorIntentPath, intent,
    "qualification handoff supervisor intent conflict");
  const intentBinding = bindProjectFile(root, projectLogicalPath(root, supervisorIntentPath));
  if (fs.existsSync(supervisorFailurePath)) {
    const failure = readJsonObject(supervisorFailurePath);
    throw new Error(`qualification handoff supervisor failed-closed: ${failure.error ?? failure.status}`);
  }
  if (fs.existsSync(supervisorReceiptPath)) {
    const receipt = readJsonObject(supervisorReceiptPath);
    assert.equal(receipt.packageId, packagePayload.packageId,
      "qualification handoff supervisor receipt package mismatch");
    assert.equal(receipt.runId, packagePayload.runId,
      "qualification handoff supervisor receipt run mismatch");
    assert.deepEqual(receipt.supervisorIntent, intentBinding,
      "qualification handoff supervisor receipt intent mismatch");
    if (fs.existsSync(supervisorProcessPath)) {
      const processRecord = readJsonObject(supervisorProcessPath);
      const observed = await processIdentityProbe({
        root,
        processId: processRecord.processId,
        expectedProcessStartIdentity: processRecord.processStartIdentity,
      });
      const handoffResultPath = path.join(launchAbsolute, "handoff-continuation-result.json");
      assert.equal(observed.status === "active" || fs.existsSync(handoffResultPath), true,
        "qualification handoff supervisor is dead without a committed continuation result");
    }
    return Object.freeze({
      ...launchResult,
      handoffSupervisor: bindProjectFile(root,
        projectLogicalPath(root, supervisorReceiptPath)),
      handoffSupervisionStarted: true,
    });
  }

  fs.mkdirSync(supervisorRuntimeDirectory, { recursive: true });
  const launcherArgs = [
    "--supervise-handoff",
    "--package-manifest", manifestBinding.path,
    "--package-manifest-sha256", manifestBinding.sha256,
    "--launch-intent", launchIntentBinding.path,
    "--launch-intent-sha256", launchIntentBinding.sha256,
    "--child-process-record", childProcessRecordBinding.path,
    "--child-process-record-sha256", childProcessRecordBinding.sha256,
  ];
  const spawnAttemptExisted = fs.existsSync(supervisorSpawnAttemptPath);
  const spawnAttempt = prepareExactlyOnceBackgroundSpawn({
    projectRoot: root,
    attemptPath: supervisorSpawnAttemptPath,
    launchIdentity: `stage4-v2-qualification-handoff-${packagePayload.packageId}`,
    runnerPath: BACKGROUND_LAUNCHER_PATH,
    runnerSha256: sha256File(resolveProjectPath(root, BACKGROUND_LAUNCHER_PATH, {
      mustExist: true, kind: "file",
    })),
    runnerArgs: launcherArgs,
    recordedAtUtc: intent.recordedAtUtc,
  });
  const spawnAttemptBinding = bindProjectFile(root,
    projectLogicalPath(root, supervisorSpawnAttemptPath));
  let processRecord;
  if (fs.existsSync(supervisorProcessPath)) {
    processRecord = readJsonObject(supervisorProcessPath);
    assert.equal(processRecord.packageId, packagePayload.packageId);
    assert.equal(processRecord.runId, packagePayload.runId);
    assert.deepEqual(processRecord.spawnAttempt, spawnAttemptBinding,
      "handoff supervisor process binds another spawn attempt");
    const observed = await processIdentityProbe({
      root,
      processId: processRecord.processId,
      expectedProcessStartIdentity: processRecord.processStartIdentity,
    });
    assert.equal(observed.status, "active",
      "handoff supervisor process is no longer active before receipt commit");
  } else {
    let launched;
    let recoveredSpawn = false;
    if (spawnAttemptExisted) {
      launched = claimExactlyOneBackgroundSpawnMatch(
        await launchAttemptProbe({ projectRoot: root, attempt: spawnAttempt }),
        spawnAttempt,
      );
      recoveredSpawn = true;
    } else {
      launched = await handoffSupervisorSpawner({
        root,
        launcherPath: BACKGROUND_LAUNCHER_PATH,
        launcherArgs,
        launchDirectory: projectLogicalPath(root, supervisorRuntimeDirectory),
        spawnAttempt,
      });
      validateSpawnResult(launched);
      invokeHook(_testHooks, "afterHandoffSupervisorSpawnBeforeProcessRecord", {
        spawnAttempt: spawnAttemptBinding,
        processId: launched.processId,
      });
    }
    processRecord = {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-handoff-supervisor-process-v1",
      status: "handoff_supervisor_process_identity_recorded",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      supervisorIntent: intentBinding,
      spawnAttempt: spawnAttemptBinding,
      commandIdentitySha256: spawnAttempt.commandIdentitySha256,
      qualificationRelaunchAllowed: false,
      ...launched,
      recoveredSpawnWithoutDuplicate: recoveredSpawn,
      recordedAtUtc: now().toISOString(),
    };
    writeExclusiveJson(supervisorProcessPath, processRecord);
  }
  const processBinding = bindProjectFile(root, projectLogicalPath(root, supervisorProcessPath));
  invokeHook(_testHooks, "afterHandoffSupervisorSpawnBeforeReceipt", {
    process: processBinding,
  });
  const receipt = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-handoff-supervisor-receipt-v1",
    status: "detached_handoff_supervisor_started",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    supervisorIntent: intentBinding,
    supervisorProcess: processBinding,
    detachedFromCodex: true,
    qualificationRelaunchAllowed: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: now().toISOString(),
  };
  writeExclusiveJson(supervisorReceiptPath, receipt);
  return Object.freeze({
    ...launchResult,
    handoffSupervisor: bindProjectFile(root,
      projectLogicalPath(root, supervisorReceiptPath)),
    handoffSupervisionStarted: true,
  });
}

export async function superviseStage4V2ReadonlyGpuQualificationHandoff({
  projectRoot = process.cwd(),
  packageManifestBinding,
  launchIntentBinding,
  childProcessRecordBinding,
  currentRegistryReader = readCurrentExecutionRegistry,
  processIdentityProbe = probeBackgroundProcessIdentity,
  continuationInvoker = continueStage4V2AfterReadonlyGpuQualification,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  pollIntervalMs = HANDOFF_POLL_INTERVAL_MS,
  maxWaitMs = HANDOFF_MAX_WAIT_MS,
  now = () => new Date(),
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  const manifest = readBoundProjectJson(root, packageManifestBinding);
  const packagePayload = readBoundProjectJson(root, manifest.packagePayload);
  const launchIntent = readBoundProjectJson(root, launchIntentBinding);
  const childProcess = readBoundProjectJson(root, childProcessRecordBinding);
  assert.equal(packagePayload.packageId, childProcess.packageId,
    "handoff child/package identity mismatch");
  assert.equal(packagePayload.runId, childProcess.runId,
    "handoff child/run identity mismatch");
  assert.deepEqual(childProcess.launchIntent, launchIntentBinding,
    "handoff child launch intent mismatch");
  assert.equal(launchIntent.packageManifest.path, packageManifestBinding.path,
    "handoff launch manifest path mismatch");
  assert.equal(launchIntent.packageManifest.sha256, packageManifestBinding.sha256,
    "handoff launch manifest SHA mismatch");

  const launchRoot = resolveProjectPath(root,
    `${STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ROOT}/${packagePayload.packageId}`,
    { mustExist: true, kind: "directory" });
  const journalPath = path.join(launchRoot, "handoff-continuation-journal.json");
  const resultPath = path.join(launchRoot, "handoff-continuation-result.json");
  const failurePath = path.join(launchRoot, "handoff-continuation-failure.json");
  let journal;
  if (fs.existsSync(journalPath)) {
    journal = readJsonObject(journalPath);
    validateHandoffJournal(journal, { packagePayload, childProcessRecordBinding });
  } else {
    journal = {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-handoff-continuation-journal-v1",
      state: "monitoring_qualification_child",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      qualificationChildProcess: childProcessRecordBinding,
      continuationDispatchCount: 0,
      qualificationRelaunchCount: 0,
      ownerAuthorizationRequired: false,
      recordedAtUtc: now().toISOString(),
      updatedAtUtc: now().toISOString(),
    };
    writeExclusiveJson(journalPath, journal);
  }
  if (fs.existsSync(failurePath)) {
    const failure = readJsonObject(failurePath);
    throw new Error(`qualification handoff failed-closed: ${failure.error ?? failure.status}`);
  }
  if (fs.existsSync(resultPath)) {
    const result = readJsonObject(resultPath);
    validateHandoffResult(result, { packagePayload, childProcessRecordBinding });
    return Object.freeze({ ...result, recoveredCommittedResult: true });
  }

  const startedAt = Date.now();
  try {
    while (Date.now() - startedAt <= maxWaitMs) {
      const observed = await processIdentityProbe({
        root,
        processId: childProcess.processId,
        expectedProcessStartIdentity: childProcess.processStartIdentity,
      });
      assert.ok(observed && ["active", "dead", "indeterminate"].includes(observed.status),
        "qualification handoff child process probe is invalid");
      if (observed.status === "indeterminate") {
        throw new Error("qualification child process identity is indeterminate");
      }
      if (observed.status === "active"
        && observed.processStartIdentity === childProcess.processStartIdentity) {
        await wait(pollIntervalMs);
        continue;
      }

      const terminalPath = resolveProjectPath(root,
        `${packagePayload.outputDirectory}/phase-terminal.json`,
        { mustExist: true, kind: "file" });
      const terminalBinding = bindProjectFile(root, projectLogicalPath(root, terminalPath));
      const terminal = readJsonObject(terminalPath);
      const qualificationResult = qualificationResultFromTerminal({
        packagePayload,
        terminal,
        terminalBinding,
      });
      const current = await currentRegistryReader(root);
      const continuationRoot = path.join(path.dirname(terminalPath), "local-continuation");
      if (!fs.existsSync(continuationRoot)) {
        verifyExactQualificationSuccessorRegistry(current, qualificationResult);
      }
      if (journal.state === "monitoring_qualification_child") {
        journal = {
          ...journal,
          state: "successor_registry_confirmed",
          successorAction: terminal.nextMachineAction,
          successorRegistryRevision: current.registry.registryRevision,
          qualificationTerminal: terminalBinding,
          updatedAtUtc: now().toISOString(),
        };
        updateLaunchJournal(journalPath, journal);
      }
      invokeHook(_testHooks, "afterSuccessorRegistryBeforeContinuation", {
        qualificationResult,
        currentRegistry: current.registry,
      });
      const continuation = await continuationInvoker({
        projectRoot: root,
        qualificationResult,
      });
      const result = {
        schemaVersion: "ai-painter-stage4-v2-readonly-gpu-handoff-continuation-result-v1",
        status: "qualification_successor_dispatched",
        capabilityVersion: STAGE4_V2_CAPABILITY,
        packageId: packagePayload.packageId,
        runId: packagePayload.runId,
        qualificationChildProcess: childProcessRecordBinding,
        qualificationTerminal: terminalBinding,
        successorAction: terminal.nextMachineAction,
        continuationStatus: continuation?.status ?? null,
        continuationResult: continuation?.result ?? null,
        continuationDispatchCount: 1,
        qualificationRelaunchCount: 0,
        detachedFromCodex: true,
        ownerAuthorizationRequired: false,
        recordedAtUtc: now().toISOString(),
      };
      writeExclusiveJson(resultPath, result);
      updateLaunchJournal(journalPath, {
        ...journal,
        state: "continuation_committed",
        continuationDispatchCount: 1,
        qualificationRelaunchCount: 0,
        result: bindProjectFile(root, projectLogicalPath(root, resultPath)),
        updatedAtUtc: now().toISOString(),
      });
      return Object.freeze(result);
    }
    throw new Error("qualification handoff supervisor timed out before child termination");
  } catch (error) {
    if (isInjectedCrash(error)) throw error;
    const failure = {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-handoff-continuation-failure-v1",
      status: "qualification_handoff_failed_closed",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      qualificationChildProcess: childProcessRecordBinding,
      continuationDispatchCount: journal.continuationDispatchCount,
      qualificationRelaunchCount: 0,
      automaticRetryAllowed: false,
      ownerAuthorizationRequired: false,
      error: error instanceof Error ? error.message : String(error),
      recordedAtUtc: now().toISOString(),
    };
    if (!fs.existsSync(failurePath)) writeExclusiveJson(failurePath, failure);
    throw error;
  }
}

function qualificationResultFromTerminal({ packagePayload, terminal, terminalBinding }) {
  assert.equal(terminal.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-terminal-v1");
  assert.equal(terminal.packageId, packagePayload.packageId);
  assert.equal(terminal.runId, packagePayload.runId);
  assert.equal(terminal.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.ok(["completed", "failed_closed"].includes(terminal.executionState));
  const succeeded = terminal.executionState === "completed"
    && terminal.status === "stage4_v2_readonly_gpu_qualification_passed";
  const failed = terminal.executionState === "failed_closed"
    && terminal.status === "stage4_v2_readonly_gpu_qualification_failed_closed";
  assert.equal(succeeded || failed, true, "qualification terminal outcome is invalid for handoff");
  assert.equal(terminal.nextMachineAction,
    succeeded ? QUALIFICATION_SUCCESS_PLAN_ACTION : QUALIFICATION_FAILURE_ACTION,
    "qualification terminal successor action mismatch");
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-execution-result-v1",
    executionState: terminal.executionState,
    status: terminal.status,
    packageId: terminal.packageId,
    runId: terminal.runId,
    terminal: terminalBinding,
    ownerAuthorizationRequired: false,
    trainingStarted: false,
  });
}

function verifyExactQualificationSuccessorRegistry(current, qualificationResult) {
  assert.equal(current?.ok, true,
    current?.errorCode ?? "qualification successor registry is invalid");
  assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(current.registry.packageId, qualificationResult.packageId);
  assert.equal(current.registry.runId, qualificationResult.runId);
  assert.deepEqual(current.registry.terminalEvidence, qualificationResult.terminal,
    "qualification successor registry binds another terminal");
  assert.equal(current.registry.activeExecution, null,
    "qualification successor registry still has an active execution");
  const succeeded = qualificationResult.executionState === "completed";
  assert.equal(current.registry.taskId,
    succeeded
      ? "materialize_stage4_v2_controlled_smoke_contract"
      : "adjudicate_stage4_v2_readonly_gpu_qualification_failure");
  assert.equal(current.registry.nextMachineAction,
    succeeded ? QUALIFICATION_SUCCESS_PLAN_ACTION : QUALIFICATION_FAILURE_ACTION);
}

function validateHandoffJournal(journal, { packagePayload, childProcessRecordBinding }) {
  assert.equal(journal.schemaVersion,
    "ai-painter-stage4-v2-readonly-gpu-handoff-continuation-journal-v1");
  assert.ok(["monitoring_qualification_child", "successor_registry_confirmed", "continuation_committed"]
    .includes(journal.state), "qualification handoff journal state is invalid");
  assert.equal(journal.packageId, packagePayload.packageId);
  assert.equal(journal.runId, packagePayload.runId);
  assert.deepEqual(journal.qualificationChildProcess, childProcessRecordBinding);
  assert.ok([0, 1].includes(journal.continuationDispatchCount));
  assert.equal(journal.qualificationRelaunchCount, 0);
}

function validateHandoffResult(result, { packagePayload, childProcessRecordBinding }) {
  assert.equal(result.schemaVersion,
    "ai-painter-stage4-v2-readonly-gpu-handoff-continuation-result-v1");
  assert.equal(result.status, "qualification_successor_dispatched");
  assert.equal(result.packageId, packagePayload.packageId);
  assert.equal(result.runId, packagePayload.runId);
  assert.deepEqual(result.qualificationChildProcess, childProcessRecordBinding);
  assert.equal(result.continuationDispatchCount, 1);
  assert.equal(result.qualificationRelaunchCount, 0);
  assert.equal(result.detachedFromCodex, true);
}

function writeOrVerifyLaunchJson(filePath, value, message) {
  if (!fs.existsSync(filePath)) {
    writeExclusiveJson(filePath, value);
    return;
  }
  assert.deepEqual(readJsonObject(filePath), value, message);
}

function buildLaunchReceipt({
  packagePayload,
  manifestBinding,
  launchIntentBinding,
  childRunner,
  launched,
  now,
  recoveredReceipt,
  spawnAttemptBinding,
  commandIdentitySha256,
}) {
  return {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-background-launch-receipt-v1",
    status: "background_child_started_identity_bound",
    launchAction: STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ACTION,
    childRunAction: STAGE4_V2_QUALIFICATION_CHILD_RUN_ACTION,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    outputDirectory: packagePayload.outputDirectory,
    packageManifest: manifestBinding,
    launchIntent: launchIntentBinding,
    childRunner,
    spawnAttempt: spawnAttemptBinding,
    commandIdentitySha256,
    processId: launched.processId,
    processStartIdentity: launched.processStartIdentity,
    processIdentitySource: launched.processIdentitySource,
    processCreationDateUtc: launched.processCreationDateUtc,
    launchMethod: launched.launchMethod,
    windowsHidden: launched.windowsHidden,
    detachedFromCodex: true,
    launcherReturnedWithoutWaiting: true,
    launcherWillNotTerminateChild: true,
    stdoutPath: launched.stdoutPath ?? null,
    stderrPath: launched.stderrPath ?? null,
    recoveredReceipt,
    repeatedLaunchAllowed: false,
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: now().toISOString(),
  };
}

function buildLaunchResult({
  packagePayload,
  launchIntentBinding,
  receiptBinding,
  receipt,
  recovered,
}) {
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-background-launch-result-v1",
    status: receipt.status,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    processId: receipt.processId,
    processStartIdentity: receipt.processStartIdentity,
    launchIntent: launchIntentBinding,
    launchReceipt: receiptBinding,
    detachedFromCodex: true,
    recoveredWithoutDuplicateSpawn: recovered,
    gpuStartedByLauncher: false,
    trainingStarted: false,
  });
}

function validateLaunchJournal(journal, { packagePayload, launchIntentBinding }) {
  assert.equal(journal.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-background-launch-journal-v1");
  assert.ok([
    "intent_persisted_not_started",
    "pre_start_recovery_resumed",
    "spawn_attempt_persisted",
    "child_identity_recorded",
    "receipt_committed",
  ].includes(journal.state), "background launch journal state is invalid");
  assert.equal(journal.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(journal.packageId, packagePayload.packageId);
  assert.equal(journal.runId, packagePayload.runId);
  assert.deepEqual(journal.launchIntent, launchIntentBinding);
  assert.ok(Number.isInteger(journal.recoveryLaunchCount) && journal.recoveryLaunchCount >= 0
    && journal.recoveryLaunchCount <= 1, "background launch recovery count is invalid");
  assert.equal(journal.automaticRetryAllowed, false);
}

function validateProcessRecord(record, { packagePayload, launchIntentBinding, childRunner }) {
  assert.equal(record.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-background-child-process-v1");
  assert.equal(record.status, "child_process_identity_recorded");
  assert.equal(record.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(record.packageId, packagePayload.packageId);
  assert.equal(record.runId, packagePayload.runId);
  assert.equal(record.outputDirectory, packagePayload.outputDirectory);
  assert.deepEqual(record.launchIntent, launchIntentBinding);
  assert.deepEqual(record.childRunner, childRunner);
  assert.ok(record.spawnAttempt?.path && /^[a-f0-9]{64}$/u.test(record.spawnAttempt.sha256 ?? ""),
    "qualification child spawn attempt binding is missing");
  assert.match(record.commandIdentitySha256 ?? "", /^[a-f0-9]{64}$/u,
    "qualification child command identity is missing");
  assert.equal(record.detachedFromCodex, true);
  validateSpawnResult(record);
}

function buildQualificationProcessRecord({
  root,
  packagePayload,
  launchIntentBinding,
  childRunner,
  spawnAttemptPath,
  attempt,
  launched,
  recoveredAttempt,
  now,
}) {
  return {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-background-child-process-v1",
    status: "child_process_identity_recorded",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    outputDirectory: packagePayload.outputDirectory,
    launchIntent: launchIntentBinding,
    childRunner,
    spawnAttempt: bindProjectFile(root, projectLogicalPath(root, spawnAttemptPath)),
    commandIdentitySha256: attempt.commandIdentitySha256,
    ...launched,
    detachedFromCodex: true,
    recoveredAttempt,
    recordedAtUtc: now().toISOString(),
  };
}

function qualificationRunnerArgs({ manifestBinding, launchIntentBinding }) {
  return [
    "--package", manifestBinding.path,
    "--package-sha256", manifestBinding.sha256,
    "--launch-intent", launchIntentBinding.path,
    "--launch-intent-sha256", launchIntentBinding.sha256,
  ];
}

function validateLaunchReceipt(receipt, {
  packagePayload,
  manifestBinding,
  launchIntentBinding,
  childRunner,
}) {
  assert.equal(receipt.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-background-launch-receipt-v1");
  assert.equal(receipt.status, "background_child_started_identity_bound");
  assert.equal(receipt.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(receipt.packageId, packagePayload.packageId);
  assert.equal(receipt.runId, packagePayload.runId);
  assert.equal(receipt.outputDirectory, packagePayload.outputDirectory);
  assert.deepEqual(receipt.packageManifest, manifestBinding);
  assert.deepEqual(receipt.launchIntent, launchIntentBinding);
  assert.deepEqual(receipt.childRunner, childRunner);
  assert.ok(receipt.spawnAttempt?.path && /^[a-f0-9]{64}$/u.test(receipt.spawnAttempt.sha256 ?? ""),
    "qualification receipt spawn attempt binding is missing");
  assert.match(receipt.commandIdentitySha256 ?? "", /^[a-f0-9]{64}$/u,
    "qualification receipt command identity is missing");
  assert.equal(receipt.detachedFromCodex, true);
  assert.equal(receipt.launcherReturnedWithoutWaiting, true);
  assert.equal(receipt.launcherWillNotTerminateChild, true);
  validateSpawnResult(receipt);
}

function persistLaunchFailure({
  root,
  failurePath,
  packagePayload,
  manifestBinding,
  launchIntentBinding,
  launched,
  error,
  now,
}) {
  const failure = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-background-launch-failure-v1",
    status: "background_launch_failed_closed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    outputDirectory: packagePayload.outputDirectory,
    packageManifest: manifestBinding,
    launchIntent: launchIntentBinding,
    processMayHaveStarted: launched !== null,
    processIdentity: launched === null ? null : {
      processId: launched.processId,
      processStartIdentity: launched.processStartIdentity,
    },
    automaticRetryAllowed: false,
    repeatedLaunchAllowed: false,
    gpuStartedByLauncher: false,
    trainingStarted: false,
    error: error instanceof Error ? error.message : String(error),
    recordedAtUtc: now().toISOString(),
  };
  if (!fs.existsSync(failurePath)) writeExclusiveJson(failurePath, failure);
  return bindProjectFile(root, projectLogicalPath(root, failurePath));
}

function updateLaunchJournal(journalPath, value) {
  const temporaryPath = `${journalPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  const descriptor = fs.openSync(temporaryPath, "r+");
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.renameSync(temporaryPath, journalPath);
}

export async function probeBackgroundProcessIdentity({
  root,
  processId,
  expectedProcessStartIdentity,
}) {
  assert.ok(Number.isInteger(processId) && processId > 0, "background process probe PID is invalid");
  if (process.platform === "win32") {
    const script = [
      "$ErrorActionPreference='Stop'",
      `$p=Get-CimInstance Win32_Process -Filter \"ProcessId = ${processId}\" -ErrorAction SilentlyContinue`,
      "if ($null -eq $p) { exit 3 }",
      "$o=[pscustomobject]@{ processId=[int]$p.ProcessId; creationDate=$p.CreationDate.ToUniversalTime().ToString('o') }",
      "ConvertTo-Json -InputObject $o -Compress",
    ].join("; ");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      cwd: path.resolve(root),
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    if (result.status === 3) return { status: "dead", processStartIdentity: null };
    if (result.error || result.status !== 0) return { status: "indeterminate", processStartIdentity: null };
    try {
      const value = JSON.parse(String(result.stdout).replace(/^\uFEFF/u, "").trim());
      const identity = `${Number(value.processId)}:${value.creationDate}`;
      return {
        status: identity === expectedProcessStartIdentity ? "active" : "dead",
        processStartIdentity: identity,
      };
    } catch {
      return { status: "indeterminate", processStartIdentity: null };
    }
  }
  try {
    const observed = execFileSync("ps", ["-o", "lstart=", "-p", String(processId)], {
      cwd: path.resolve(root), encoding: "utf8", timeout: 10_000,
    }).trim();
    if (!observed) return { status: "dead", processStartIdentity: null };
    const identity = `${processId}:${observed}`;
    return { status: identity === expectedProcessStartIdentity ? "active" : "dead", processStartIdentity: identity };
  } catch {
    return { status: "dead", processStartIdentity: null };
  }
}

function isInjectedCrash(error) {
  return error && typeof error === "object" && error.code === "AI_PAINTER_TEST_CRASH";
}

export async function spawnBackgroundQualificationProcess({
  root,
  runnerPath,
  runnerArgs,
  launchDirectory,
  spawnAttempt,
}) {
  assert.ok(spawnAttempt?.processMarker,
    "background qualification spawn attempt marker is required");
  const absoluteRunner = resolveProjectPath(root, runnerPath, { mustExist: true, kind: "file" });
  const launchRoot = resolveProjectPath(root, launchDirectory, { mustExist: true, kind: "directory" });
  const stdoutAbsolute = path.join(launchRoot, "stdout.log");
  const stderrAbsolute = path.join(launchRoot, "stderr.log");
  if (process.platform === "win32") {
    const result = launchWindowsHiddenProcess({
      root,
      executable: process.execPath,
      absoluteRunner,
      runnerArgs,
      spawnAttempt,
      stdoutAbsolute,
      stderrAbsolute,
    });
    return {
      ...result,
      stdoutPath: projectLogicalPath(root, stdoutAbsolute),
      stderrPath: projectLogicalPath(root, stderrAbsolute),
    };
  }
  return launchPosixDetachedProcess({
    root,
    absoluteRunner,
    runnerArgs,
    spawnAttempt,
    stdoutAbsolute,
    stderrAbsolute,
  });
}

export async function spawnBackgroundQualificationHandoffSupervisor({
  root,
  launcherPath,
  launcherArgs,
  launchDirectory,
  spawnAttempt,
}) {
  return spawnBackgroundQualificationProcess({
    root,
    runnerPath: launcherPath,
    runnerArgs: launcherArgs,
    launchDirectory,
    spawnAttempt,
  });
}

function launchWindowsHiddenProcess({
  root,
  executable,
  absoluteRunner,
  runnerArgs,
  spawnAttempt,
  stdoutAbsolute,
  stderrAbsolute,
}) {
  const argumentTokens = exactSpawnNodeArguments(spawnAttempt, absoluteRunner)
    .map(quoteWindowsCommandLineArgument);
  const argumentList = argumentTokens
    .map((value) => `'${escapePowerShellSingleQuoted(value)}'`)
    .join(",");
  const script = [
    "$ErrorActionPreference='Stop'",
    `$executable='${escapePowerShellSingleQuoted(executable)}'`,
    `$workingDirectory='${escapePowerShellSingleQuoted(path.resolve(root))}'`,
    `$stdoutPath='${escapePowerShellSingleQuoted(stdoutAbsolute)}'`,
    `$stderrPath='${escapePowerShellSingleQuoted(stderrAbsolute)}'`,
    `$argumentList=@(${argumentList})`,
    "$process=Start-Process -FilePath $executable -ArgumentList $argumentList -WorkingDirectory $workingDirectory -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru",
    "$observed=Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$process.Id) -ErrorAction Stop",
    "if ($null -eq $observed) { throw 'started child has no Win32_Process identity' }",
    "[ordered]@{ processId=[int]$observed.ProcessId; creationDateUtc=$observed.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress",
  ].join("\n");
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const result = execFileSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    {
      cwd: path.resolve(root),
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    },
  );
  const parsed = JSON.parse(String(result).replace(/^\uFEFF/u, "").trim());
  assert.ok(Number.isInteger(parsed.processId) && parsed.processId > 0, "background child PID is invalid");
  assert.ok(typeof parsed.creationDateUtc === "string" && Number.isFinite(Date.parse(parsed.creationDateUtc)),
    "background child creation identity is invalid");
  return {
    processId: parsed.processId,
    processStartIdentity: `${parsed.processId}:${parsed.creationDateUtc}`,
    processIdentitySource: "windows_cim_win32_process_creation_date_v1",
    processCreationDateUtc: parsed.creationDateUtc,
    launchMethod: "windows_start_process_hidden_cim_identity",
    windowsHidden: true,
  };
}

async function launchPosixDetachedProcess({
  root,
  absoluteRunner,
  runnerArgs,
  spawnAttempt,
  stdoutAbsolute,
  stderrAbsolute,
}) {
  const stdout = fs.openSync(stdoutAbsolute, "ax");
  const stderr = fs.openSync(stderrAbsolute, "ax");
  let child;
  try {
    child = spawn(process.execPath, exactSpawnNodeArguments(spawnAttempt, absoluteRunner), {
      cwd: path.resolve(root),
      detached: true,
      windowsHide: true,
      stdio: ["ignore", stdout, stderr],
    });
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
  } finally {
    fs.closeSync(stdout);
    fs.closeSync(stderr);
  }
  const identityResult = execFileSync("ps", ["-o", "lstart=", "-p", String(child.pid)], {
    cwd: path.resolve(root),
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  }).trim();
  assert.ok(identityResult.length > 0, "background child POSIX start identity is unavailable");
  return {
    processId: child.pid,
    processStartIdentity: `${child.pid}:${identityResult}`,
    processIdentitySource: "posix_ps_lstart_v1",
    processCreationDateUtc: new Date(identityResult).toISOString(),
    launchMethod: "posix_detached_process_group",
    windowsHidden: false,
    stdoutPath: projectLogicalPath(root, stdoutAbsolute),
    stderrPath: projectLogicalPath(root, stderrAbsolute),
  };
}

export function validateStage4V2BackgroundLaunchIntent({
  projectRoot,
  launchIntentBinding,
  packageManifestBinding,
  packagePayloadBinding,
  signedTicketBinding,
  packagePayload,
}) {
  assert.ok(launchIntentBinding && typeof launchIntentBinding.path === "string",
    "background launch intent binding is required");
  const rebound = bindProjectFile(projectRoot, launchIntentBinding.path, launchIntentBinding.sha256);
  const intent = readProjectJson(projectRoot, rebound.path);
  assert.equal(intent.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-background-launch-intent-v1");
  assert.equal(intent.status, "launch_intent_persisted_child_not_yet_confirmed");
  assert.equal(intent.launchAction, STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ACTION);
  assert.equal(intent.childRunAction, STAGE4_V2_QUALIFICATION_CHILD_RUN_ACTION);
  assert.equal(intent.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(intent.packageId, packagePayload.packageId);
  assert.equal(intent.runId, packagePayload.runId);
  assert.match(intent.packageId, SAFE_EXECUTION_ID, "launch intent package identity is unsafe");
  assert.match(intent.runId, SAFE_EXECUTION_ID, "launch intent run identity is unsafe");
  assert.equal(
    rebound.path,
    `${STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ROOT}/${packagePayload.packageId}/launch-intent.json`,
    "background launch intent is outside the immutable package launch namespace",
  );
  assert.equal(intent.outputDirectory, packagePayload.outputDirectory);
  assert.equal(intent.preflightDirectory, packagePayload.preflightDirectory);
  assert.deepEqual(intent.packageManifest, packageManifestBinding);
  assert.deepEqual(intent.packagePayload, packagePayloadBinding);
  assert.deepEqual(intent.signedTicket, signedTicketBinding);
  assert.deepEqual(intent.backgroundLauncher, packagePayload.programLineage.backgroundLauncher);
  assert.deepEqual(intent.childRunner, packagePayload.programLineage.nodeRunner);
  assert.equal(intent.detachedFromCodexRequired, true);
  assert.equal(intent.repeatedLaunchAllowed, false);
  assert.equal(intent.automaticRetryAllowed, false);
  assert.equal(intent.ownerAuthorizationRequired, false);
  assert.equal(intent.gpuStarted, false);
  assert.equal(intent.trainingStarted, false);
  return Object.freeze({ intent, binding: rebound });
}

function verifyLaunchableCurrentRegistry(current) {
  const registry = current.registry;
  assert.equal(registry.capabilityVersion, STAGE4_V2_CAPABILITY, "current capability is not Stage4 V2");
  assert.equal(registry.taskId, MATERIALIZED_RUN_TASK, "current task is not V2 readonly-GPU execution");
  assert.equal(registry.nextMachineAction, MATERIALIZED_RUN_ACTION, "current action is not V2 background launch");
  assert.equal(registry.taskKind, "readonly_gpu_qualification", "current task kind mismatch");
  assert.equal(registry.lifecycleStage, "cpu_contract_verified", "current lifecycle is not CPU verified");
  assert.equal(registry.executionState, "package_materialized", "qualification package is not materialized");
  assert.equal(registry.activeExecution, null, "another current execution is active");
}

function verifyQualificationLaunchRegistryForEntry(current) {
  const registry = current.registry;
  assert.equal(registry.capabilityVersion, STAGE4_V2_CAPABILITY, "current capability is not Stage4 V2");
  assert.equal(registry.taskId, MATERIALIZED_RUN_TASK, "current task is not V2 readonly-GPU execution");
  assert.equal(registry.taskKind, "readonly_gpu_qualification", "current task kind mismatch");
  assert.equal(registry.lifecycleStage, "cpu_contract_verified", "current lifecycle is not CPU verified");
  const materialized = registry.executionState === "package_materialized"
    && registry.nextMachineAction === MATERIALIZED_RUN_ACTION
    && registry.activeExecution === null;
  const active = registry.executionState === "executing"
    && registry.nextMachineAction === null
    && registry.activeExecution?.packageId === registry.packageId
    && registry.activeExecution?.runId === registry.runId;
  assert.equal(materialized || active, true,
    "current qualification is neither launchable nor the exact active background child");
}

function verifyLaunchableManifest(manifest, registry) {
  assert.equal(manifest.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-package-manifest-v1");
  assert.equal(manifest.status, "materialized_not_executed");
  assert.equal(manifest.packageId, registry.packageId);
  assert.equal(manifest.runId, registry.runId);
  assert.equal(manifest.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(manifest.outputDirectoryCreated, false);
  assert.equal(manifest.preflightDirectoryCreated, false);
  assert.equal(manifest.ownerAuthorizationRequired, false);
  assert.equal(manifest.gpuStarted, false);
  assert.equal(manifest.trainingStarted, false);
}

function verifyLaunchablePayload(payload, manifest) {
  assert.equal(payload.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-package-payload-v1");
  assert.equal(payload.status, "materialized_not_executed");
  assert.equal(payload.packageId, manifest.packageId);
  assert.equal(payload.runId, manifest.runId);
  assert.match(payload.packageId, SAFE_EXECUTION_ID, "qualification package identity is unsafe");
  assert.match(payload.runId, SAFE_EXECUTION_ID, "qualification run identity is unsafe");
  assert.equal(payload.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(payload.executionClass, "readonly_gpu_qualification");
  assert.equal(payload.outputDirectory, manifest.outputDirectory);
  assert.equal(payload.preflightDirectory, manifest.preflightDirectory);
  assert.equal(payload.failurePolicy?.automaticRetryAllowed, false);
  assert.equal(payload.failurePolicy?.ownerAuthorizationRequired, false);
  assert.equal(payload.executionBoundary?.trainingAllowed, false);
  assert.equal(payload.executionBoundary?.smokeAllowed, false);
  assert.equal(payload.executionBoundary?.stage0Allowed, false);
}

function validateSpawnResult(launched) {
  assert.ok(launched && typeof launched === "object", "background spawner returned no result");
  assert.ok(Number.isInteger(launched.processId) && launched.processId > 0, "background child PID is invalid");
  assert.ok(typeof launched.processStartIdentity === "string" && launched.processStartIdentity.length > 0,
    "background child process start identity is missing");
  assert.ok(typeof launched.processIdentitySource === "string" && launched.processIdentitySource.length > 0,
    "background child process identity source is missing");
  assert.ok(
    typeof launched.processCreationDateUtc === "string"
      && Number.isFinite(Date.parse(launched.processCreationDateUtc)),
    "background child process creation time is invalid",
  );
  assert.equal(
    launched.processStartIdentity,
    `${launched.processId}:${launched.processCreationDateUtc}`,
    "background child PID/start identity binding mismatch",
  );
  assert.ok(typeof launched.launchMethod === "string" && launched.launchMethod.length > 0,
    "background child launch method is missing");
  assert.equal(typeof launched.windowsHidden, "boolean", "background child hidden-window flag is missing");
}

function readBoundProjectJson(root, binding) {
  const rebound = bindProjectFile(root, binding.path, binding.sha256);
  return readJsonObject(resolveProjectPath(root, rebound.path, { mustExist: true, kind: "file" }));
}

function readProjectJson(root, logicalPath) {
  return readJsonObject(resolveProjectPath(root, logicalPath, { mustExist: true, kind: "file" }));
}

function normalizeLogicalPath(root, value) {
  return projectLogicalPath(root, path.resolve(root, value));
}

function parseLaunchCli(args) {
  if (args.length === 0) return { packageManifestPath: null, packageManifestSha256: null };
  assert.equal(args.length, 4, "only --package <manifest> --package-sha256 <sha256> is supported");
  assert.equal(args[0], "--package");
  assert.equal(args[2], "--package-sha256");
  assert.match(args[3], /^[a-f0-9]{64}$/u, "package SHA-256 is invalid");
  return { packageManifestPath: args[1], packageManifestSha256: args[3] };
}

function parseHandoffSupervisorCli(args) {
  assert.deepEqual(args.slice(0, 1), ["--supervise-handoff"]);
  assert.equal(args.length, 13,
    "handoff supervisor requires exact manifest, intent and child-process bindings");
  const expected = [
    "--package-manifest", "--package-manifest-sha256",
    "--launch-intent", "--launch-intent-sha256",
    "--child-process-record", "--child-process-record-sha256",
  ];
  for (let index = 0; index < expected.length; index += 1) {
    assert.equal(args[1 + index * 2], expected[index],
      `unexpected handoff supervisor argument: ${args[1 + index * 2]}`);
  }
  for (const index of [2, 6, 10]) {
    assert.ok(typeof args[index] === "string" && args[index].length > 0,
      "handoff supervisor binding path is missing");
  }
  for (const index of [4, 8, 12]) {
    assert.match(args[index], /^[a-f0-9]{64}$/u,
      "handoff supervisor binding SHA-256 is invalid");
  }
  return {
    packageManifestBinding: { path: args[2], sha256: args[4] },
    launchIntentBinding: { path: args[6], sha256: args[8] },
    childProcessRecordBinding: { path: args[10], sha256: args[12] },
  };
}

function invokeHook(hooks, point, detail) {
  if (typeof hooks?.onLaunchPoint === "function") hooks.onLaunchPoint(point, detail);
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replaceAll("'", "''");
}

function quoteWindowsCommandLineArgument(value) {
  const text = String(value);
  if (!/[\s"]/u.test(text)) return text;
  return `"${text.replace(/(\\*)"/gu, "$1$1\\\"").replace(/(\\*)$/u, "$1$1")}"`;
}
