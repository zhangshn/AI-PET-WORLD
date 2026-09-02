import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";
import {
  launchProjectCommandBackground,
  validateProjectCommandBackgroundReceipt,
} from "./lib/ai-painter-autonomous-background-launcher-v1.mjs";
import {
  captureImmutableCurrentRegistryEvidence,
} from "./lib/ai-painter-immutable-current-registry-evidence-v1.mjs";
import {
  bindAbsolute,
  readBoundJson,
  readJsonObject,
  resolveProjectPath,
  SMOKE_BACKGROUND_LAUNCH_ACTION,
  SMOKE_RUN_TASK,
  STAGE4_V2_CAPABILITY,
  validateStage4V2SmokePackagePayload,
  writeExclusiveJson,
  writeJsonAtomic,
} from "./lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  STAGE4_V2_CONTROLLED_SMOKE_RUNNER_PATH,
  validateStage4V2ControlledSmokeBackgroundLaunchIntent,
} from "./lib/ai-painter-stage4-v2-controlled-smoke-launch-intent-v1.mjs";

export { SMOKE_BACKGROUND_LAUNCH_ACTION };
const RUNNER_PATH = STAGE4_V2_CONTROLLED_SMOKE_RUNNER_PATH;
const RECEIPT_ROOT = ".runtime/ai-painter/stage4-v2-controlled-smoke-background-launches";
const SUPERVISOR_POLL_MS = 10_000;
const MAX_RECOVERY_LAUNCHES = 1;

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  launchStage4V2ControlledSmokeBackground({ projectRoot: process.cwd() }).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function launchStage4V2ControlledSmokeBackground({
  projectRoot = process.cwd(),
  backgroundLauncher = launchProjectCommandBackground,
  processIdentityProbe = queryProcessStartIdentity,
  currentRegistryReader = readCurrentExecutionRegistry,
  waitForPoll = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  successorInvoker = invokePersistedSmokeSuccessor,
  supervise = true,
  now = () => new Date(),
} = {}) {
  const root = path.resolve(projectRoot);
  const current = await currentRegistryReader(root);
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
  assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(current.registry.taskId, SMOKE_RUN_TASK);
  assert.equal(current.registry.nextMachineAction, SMOKE_BACKGROUND_LAUNCH_ACTION);
  assert.equal(current.registry.executionState, "package_materialized");
  assert.equal(current.currentTaskTerminal?.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-materialization-terminal-v1");
  const manifest = readBoundJson(root, current.currentTaskTerminal.packageManifest);
  const payload = readBoundJson(root, manifest.packagePayload);
  assert.deepEqual(payload.programGraphManifest, manifest.programGraphManifest,
    "Smoke payload/manifest program graph binding mismatch");
  validateStage4V2SmokePackagePayload(payload, {
    projectRoot: root,
    verifyEvidence: true,
  });
  assert.equal(payload.packageId, current.registry.packageId);
  assert.equal(payload.runId, current.registry.runId);
  const currentEvidence = captureImmutableCurrentRegistryEvidence({
    projectRoot: root,
    current,
  });
  const packageRoot = path.dirname(resolveProjectPath(root,
    current.currentTaskTerminal.packageManifest.path));
  const intent = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-background-launch-intent-v1",
    status: "ready_for_wmi_background_launch",
    launchAction: SMOKE_BACKGROUND_LAUNCH_ACTION,
    packageId: payload.packageId,
    runId: payload.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    runner: bindAbsolute(root, resolveProjectPath(root, RUNNER_PATH, {
      mustExist: true, kind: "file",
    })),
    packageManifest: current.currentTaskTerminal.packageManifest,
    packagePayload: manifest.packagePayload,
    currentRegistryTransaction: currentEvidence.transaction,
    currentRegistrySnapshot: currentEvidence.snapshot,
    detachedFromCodexRequired: true,
    ownerAuthorizationRequired: false,
    recordedAtUtc: current.registry.queuedAtUtc,
  };
  const intentPath = path.join(packageRoot, "background-launch-intent.json");
  writeOrVerifyJson(intentPath, intent);
  const intentBinding = bindAbsolute(root, intentPath);
  validateStage4V2ControlledSmokeBackgroundLaunchIntent({
    projectRoot: root,
    launchIntentBinding: intentBinding,
    packageManifestBinding: current.currentTaskTerminal.packageManifest,
    expectedCurrent: current,
  });
  const launchIdentity = `stage4-v2-smoke-bg-${payload.runId}`;
  const runnerArgs = [
    "--package-manifest", current.currentTaskTerminal.packageManifest.path,
    "--package-manifest-sha256", current.currentTaskTerminal.packageManifest.sha256,
    "--launch-intent", intentBinding.path,
    "--launch-intent-sha256", intentBinding.sha256,
  ];
  const launchPreparePath = path.join(packageRoot, "background-launch-prepare.json");
  const launchPrepare = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-background-launch-prepare-v1",
    status: "prepared_not_yet_proven_started",
    packageId: payload.packageId,
    runId: payload.runId,
    launchIdentity,
    launchIntent: intentBinding,
    runner: intent.runner,
    runnerArgs,
    ownerAuthorizationRequired: false,
    repeatedLaunchAllowed: false,
    recordedAtUtc: intent.recordedAtUtc,
  };
  writeOrVerifyJson(launchPreparePath, launchPrepare);
  const receiptPath = resolveProjectPath(root,
    `${RECEIPT_ROOT}/${launchIdentity}/launch-receipt.json`);
  const receipt = backgroundLauncher({
    root,
    launchIdentity,
    runnerPath: RUNNER_PATH,
    runnerArgs,
    receiptRoot: RECEIPT_ROOT,
    recordedAtUtc: now().toISOString(),
  });
  validateProjectCommandBackgroundReceipt({
    root,
    receipt,
    launchIdentity,
    runnerPath: RUNNER_PATH,
    runnerArgs,
    receiptRoot: RECEIPT_ROOT,
  });
  assert.equal(receipt.status, "background_process_started");
  assert.equal(receipt.detachedFromCodex, true);
  assert.equal(receipt.runnerPath, RUNNER_PATH);
  assert.equal(receipt.runnerSha256, intent.runner.sha256,
    "Smoke background receipt runner SHA-256 differs from launch intent");
  assert.deepEqual(receipt.runnerArgs, runnerArgs);
  assert.ok(Number.isInteger(receipt.processId) && receipt.processId > 0);
  const launchCommitPath = path.join(packageRoot, "background-launch-commit.json");
  const launchCommit = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-background-launch-commit-v1",
    status: "receipt_committed",
    packageId: payload.packageId,
    runId: payload.runId,
    prepare: bindAbsolute(root, launchPreparePath),
    receipt: bindAbsolute(root, receiptPath),
    processId: receipt.processId,
    launchMethod: receipt.launchMethod,
    detachedFromCodex: true,
    recordedAtUtc: receipt.recordedAtUtc,
  };
  writeOrVerifyJson(launchCommitPath, launchCommit);
  const processObservation = normalizeProcessObservation(
    await processIdentityProbe(receipt.processId), receipt.processId,
  );
  const identityPath = path.join(packageRoot, "background-process-identity.json");
  let initialProcessStartIdentity;
  let processIdentityBinding = null;
  if (processObservation.status === "active") {
    initialProcessStartIdentity = processObservation.processStartIdentity;
    const identityRecord = {
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-background-process-v1",
      status: "background_process_identity_verified",
      packageId: payload.packageId,
      runId: payload.runId,
      processId: receipt.processId,
      processStartIdentity: initialProcessStartIdentity,
      launchMethod: receipt.launchMethod,
      detachedFromCodex: true,
      launchIntent: intentBinding,
      recordedAtUtc: receipt.recordedAtUtc,
    };
    writeOrVerifyJson(identityPath, identityRecord);
    processIdentityBinding = bindAbsolute(root, identityPath);
  } else if (fs.existsSync(identityPath)) {
    const identityRecord = readJsonObject(identityPath);
    assert.equal(identityRecord.packageId, payload.packageId);
    assert.equal(identityRecord.runId, payload.runId);
    assert.equal(identityRecord.processId, receipt.processId);
    initialProcessStartIdentity = identityRecord.processStartIdentity;
    processIdentityBinding = bindAbsolute(root, identityPath);
  } else {
    assert.equal(processObservation.status, "dead",
      "Smoke background child identity is indeterminate before first verification");
    assert.equal(supervise, true,
      "Smoke background child died before process identity verification");
    initialProcessStartIdentity = `${receipt.processId}:unavailable_before_first_probe`;
  }
  const launchResult = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-background-launch-result-v1",
    status: "background_process_started_and_identity_verified",
    packageId: payload.packageId,
    runId: payload.runId,
    launchIntent: intentBinding,
    processIdentity: processIdentityBinding,
    receipt,
    detachedFromCodex: true,
    ownerAuthorizationRequired: false,
  };
  if (!supervise) return Object.freeze(launchResult);
  const supervision = await superviseStage4V2ControlledSmokeBackground({
    root,
    payload,
    runnerArgs,
    launchIdentity,
    initialReceipt: receipt,
    initialProcessStartIdentity,
    packageRoot,
    backgroundLauncher,
    processIdentityProbe,
    currentRegistryReader,
    waitForPoll,
    successorInvoker,
    now,
  });
  return Object.freeze({ ...launchResult, supervision });
}

export async function superviseStage4V2ControlledSmokeBackground({
  root,
  payload,
  runnerArgs,
  launchIdentity,
  initialReceipt,
  initialProcessStartIdentity,
  packageRoot,
  backgroundLauncher = launchProjectCommandBackground,
  processIdentityProbe = queryProcessStartIdentity,
  currentRegistryReader = readCurrentExecutionRegistry,
  waitForPoll = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  successorInvoker = invokePersistedSmokeSuccessor,
  now = () => new Date(),
  maxRecoveryLaunches = MAX_RECOVERY_LAUNCHES,
} = {}) {
  assert.equal(maxRecoveryLaunches, 1,
    "Smoke supervisor permits exactly one same-package recovery launch");
  const journalPath = path.join(packageRoot, "background-supervisor-journal.json");
  const heartbeatPath = path.join(packageRoot, "background-supervisor-heartbeat.json");
  const initialJournal = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-background-supervisor-journal-v1",
    status: "supervising",
    packageId: payload.packageId,
    runId: payload.runId,
    launchIdentity,
    activeProcess: {
      processId: initialReceipt.processId,
      processStartIdentity: initialProcessStartIdentity,
      launchReceipt: receiptBinding(root, launchIdentity),
    },
    recoveryLaunchCount: 0,
    maximumRecoveryLaunches: maxRecoveryLaunches,
    newTrainingTicketAllowed: false,
    automaticTrainingRetryAllowed: false,
    recordedAtUtc: initialReceipt.recordedAtUtc,
    updatedAtUtc: initialReceipt.recordedAtUtc,
  };
  if (!fs.existsSync(journalPath)) writeExclusiveJson(journalPath, initialJournal);
  let journal = readJsonObject(journalPath);
  assert.equal(journal.packageId, payload.packageId);
  assert.equal(journal.runId, payload.runId);
  assert.equal(journal.launchIdentity, launchIdentity);
  assert.equal(journal.maximumRecoveryLaunches, 1);
  assert.equal(journal.newTrainingTicketAllowed, false);
  assert.equal(journal.automaticTrainingRetryAllowed, false);

  while (true) {
    const observed = normalizeProcessObservation(
      await processIdentityProbe(journal.activeProcess.processId),
      journal.activeProcess.processId,
    );
    const current = await currentRegistryReader(root);
    const exactActive = observed.status === "active"
      && observed.processStartIdentity === journal.activeProcess.processStartIdentity;
    const pendingSuccessor = current.ok === true
      ? expectedPersistedSuccessor(current, payload) : null;
    if (pendingSuccessor && exactActive) {
      writeJsonAtomic(heartbeatPath, supervisorHeartbeat(payload, journal,
        now().toISOString(), observed.status));
      await waitForPoll(SUPERVISOR_POLL_MS);
      continue;
    }
    let localContinuation = null;
    if (pendingSuccessor) {
      assert.equal(
        observed.status === "dead"
          || (observed.status === "active"
            && observed.processStartIdentity !== journal.activeProcess.processStartIdentity),
        true,
        "Smoke successor registry is pending but child identity is indeterminate",
      );
      localContinuation = await successorInvoker({
        projectRoot: root,
        nextMachineAction: pendingSuccessor.nextMachineAction,
      });
    }
    if (current.ok === true && (isTerminalOrHandoff(current, payload)
      || pendingSuccessor !== null)) {
      const completedAtUtc = now().toISOString();
      journal = {
        ...journal,
        status: "terminal_registry_observed",
        terminalRegistry: {
          packageId: current.registry.packageId,
          runId: current.registry.runId,
          executionState: current.registry.executionState,
          registryRevision: current.registry.registryRevision,
          registrySha256: current.registrySha256,
        },
        persistedSuccessorRecovered: pendingSuccessor !== null,
        persistedSuccessorAction: pendingSuccessor?.nextMachineAction ?? null,
        updatedAtUtc: completedAtUtc,
      };
      writeJsonAtomic(journalPath, journal);
      writeJsonAtomic(heartbeatPath, supervisorHeartbeat(payload, journal, completedAtUtc));
      return Object.freeze({
        status: "terminal_registry_observed",
        recoveryLaunchCount: journal.recoveryLaunchCount,
        journal: bindAbsolute(root, journalPath),
        heartbeat: bindAbsolute(root, heartbeatPath),
        localContinuation,
      });
    }
    const heartbeatAtUtc = now().toISOString();
    writeJsonAtomic(heartbeatPath, supervisorHeartbeat(payload, journal,
      heartbeatAtUtc, observed.status));
    if (observed.status === "active"
      && observed.processStartIdentity === journal.activeProcess.processStartIdentity) {
      if (current.ok !== true) {
        assert.equal(journal.recoveryLaunchCount, 1,
          "active initial Smoke child has an invalid current registry");
        // The recovery child starts while the expired prior active execution is
        // still the raw current revision.  It will atomically recover that
        // revision before registering its own active execution.
        validateRawSmokeCurrent({
          root, payload, journal, now: now(), allowPreviousProcess: true,
        });
      } else {
        assert.equal(current.registry.packageId, payload.packageId,
          "Smoke supervisor current package changed without a terminal handoff");
        assert.equal(current.registry.runId, payload.runId,
          "Smoke supervisor current run changed without a terminal handoff");
      }
      await waitForPoll(SUPERVISOR_POLL_MS);
      continue;
    }
    assert.equal(
      observed.status === "dead"
        || (observed.status === "active"
          && observed.processStartIdentity !== journal.activeProcess.processStartIdentity),
      true,
      "Smoke child identity is indeterminate; recovery launch is forbidden",
    );
    const raw = validateRawSmokeCurrent({
      root, payload, journal, now: now(), allowPreviousProcess: true,
    });
    if (!raw.heartbeatExpired) {
      journal = {
        ...journal,
        status: "dead_child_waiting_for_bound_heartbeat_expiry",
        deadProcessObservedAtUtc: journal.deadProcessObservedAtUtc ?? heartbeatAtUtc,
        heartbeatExpiresAtUtc: raw.heartbeatExpiresAtUtc,
        updatedAtUtc: heartbeatAtUtc,
      };
      writeJsonAtomic(journalPath, journal);
      await waitForPoll(Math.min(SUPERVISOR_POLL_MS,
        Math.max(1, raw.heartbeatExpiresAtMs - now().getTime())));
      continue;
    }
    assert.equal(journal.recoveryLaunchCount < maxRecoveryLaunches, true,
      "Smoke child died after the single bounded same-package recovery launch");
    const recoveryNumber = journal.recoveryLaunchCount + 1;
    const recoveryIdentity = `${launchIdentity}-recovery-${recoveryNumber}`;
    const recoveryReceipt = backgroundLauncher({
      root,
      launchIdentity: recoveryIdentity,
      runnerPath: RUNNER_PATH,
      runnerArgs,
      receiptRoot: RECEIPT_ROOT,
      recordedAtUtc: heartbeatAtUtc,
    });
    assert.equal(recoveryReceipt.status, "background_process_started");
    assert.equal(recoveryReceipt.detachedFromCodex, true);
    assert.equal(recoveryReceipt.runnerPath, RUNNER_PATH);
    assert.equal(recoveryReceipt.runnerSha256, initialReceipt.runnerSha256,
      "Smoke recovery receipt runner SHA-256 differs from the initial launch");
    assert.deepEqual(recoveryReceipt.runnerArgs, runnerArgs);
    const recoveryObservation = normalizeProcessObservation(
      await processIdentityProbe(recoveryReceipt.processId), recoveryReceipt.processId,
    );
    assert.equal(recoveryObservation.status, "active",
      "Smoke same-package recovery child did not become active");
    journal = {
      ...journal,
      status: "same_package_recovery_launched",
      activeProcess: {
        processId: recoveryReceipt.processId,
        processStartIdentity: recoveryObservation.processStartIdentity,
        launchReceipt: receiptBinding(root, recoveryIdentity),
      },
      recoveryLaunchCount: recoveryNumber,
      previousProcess: {
        processId: journal.activeProcess.processId,
        processStartIdentity: journal.activeProcess.processStartIdentity,
        observedStatus: observed.status,
      },
      samePackageRunnerArgsPreserved: true,
      newTrainingTicketIssued: false,
      updatedAtUtc: heartbeatAtUtc,
    };
    writeJsonAtomic(journalPath, journal);
    await waitForPoll(SUPERVISOR_POLL_MS);
  }
}

function isTerminalOrHandoff(current, payload) {
  const sameExecution = current.registry.packageId === payload.packageId
    && current.registry.runId === payload.runId;
  return !sameExecution || (["completed", "failed_closed", "blocked_policy_boundary"]
    .includes(current.registry.executionState) && current.registry.activeExecution === null);
}

function expectedPersistedSuccessor(current, payload) {
  const registry = current.registry;
  if (registry.packageId !== payload.packageId || registry.runId !== payload.runId
    || registry.executionState !== "package_materialized"
    || registry.activeExecution !== null) return null;
  if (registry.taskId === SMOKE_RUN_TASK
    && registry.nextMachineAction === SMOKE_BACKGROUND_LAUNCH_ACTION) return null;
  const expected = new Map([
    ["materialize_stage4_v2_formal_stage0_to_stage2",
      "plan:ai-painter-stage4-v2-formal-stage0-to-stage2"],
    ["adjudicate_stage4_v2_controlled_smoke_failure_boundary",
      "adjudicate:ai-painter-stage4-v2-controlled-smoke-failure-boundary"],
  ]);
  const action = expected.get(registry.taskId);
  assert.ok(action,
    "same-package Smoke registry is neither active, terminal nor an expected successor");
  assert.equal(registry.nextMachineAction, action,
    "persisted Smoke successor task/action identity differs");
  assert.equal(registry.queueStatus, "ready",
    "persisted Smoke successor is not ready");
  return { taskId: registry.taskId, nextMachineAction: action };
}

async function invokePersistedSmokeSuccessor({ projectRoot, nextMachineAction }) {
  const loadedSmokeModule = await import("./run-ai-painter-stage4-v2-controlled-smoke.mjs");
  return loadedSmokeModule.invokeStage4V2SmokeSuccessor({ projectRoot, nextMachineAction });
}

function validateRawSmokeCurrent({
  root, payload, journal, now, allowPreviousProcess,
}) {
  const currentPath = resolveProjectPath(root,
    ".runtime/ai-painter/current-execution-registry/current.json", {
      mustExist: true, kind: "file",
    });
  const currentBinding = bindAbsolute(root, currentPath);
  const registry = readJsonObject(currentPath);
  assert.equal(registry.packageId, payload.packageId,
    "raw Smoke registry package differs");
  assert.equal(registry.runId, payload.runId,
    "raw Smoke registry run differs");
  if (registry.activeExecution === null) {
    assert.equal(registry.executionState, "package_materialized",
      "dead Smoke child has neither an active execution nor a materialized package");
    return {
      currentBinding,
      heartbeatExpired: true,
      heartbeatExpiresAtMs: now.getTime(),
      heartbeatExpiresAtUtc: now.toISOString(),
    };
  }
  const active = registry.activeExecution;
  assert.equal(active.packageId, payload.packageId);
  assert.equal(active.runId, payload.runId);
  const activeMatchesJournal = active.processId === journal.activeProcess.processId
    && active.processStartIdentity === journal.activeProcess.processStartIdentity;
  const previousMatches = allowPreviousProcess
    && journal.previousProcess
    && active.processId === journal.previousProcess.processId
    && active.processStartIdentity === journal.previousProcess.processStartIdentity;
  assert.equal(activeMatchesJournal || previousMatches, true,
    "raw Smoke registry active process is neither supervised nor the bound prior process");
  const lockPath = resolveProjectPath(root, active.lock.path, {
    mustExist: true, kind: "file",
  });
  assert.equal(bindAbsolute(root, lockPath).sha256, active.lock.sha256,
    "raw Smoke active lock changed");
  const lock = readJsonObject(lockPath);
  assert.equal(lock.packageId, payload.packageId);
  assert.equal(lock.runId, payload.runId);
  assert.equal(lock.processId, active.processId);
  assert.equal(lock.processStartIdentity, active.processStartIdentity);
  const heartbeatPath = resolveProjectPath(root, active.heartbeat.path, {
    mustExist: true, kind: "file",
  });
  const heartbeat = readJsonObject(heartbeatPath);
  for (const [key, expected] of [
    ["packageId", payload.packageId], ["runId", payload.runId],
    ["processId", active.processId],
    ["processStartIdentity", active.processStartIdentity],
    ["executionState", registry.executionState],
    ["ttlSeconds", active.heartbeat.ttlSeconds],
  ]) assert.equal(heartbeat[key], expected,
    `raw Smoke heartbeat ${key} differs`);
  const heartbeatAtMs = Date.parse(heartbeat.heartbeatAtUtc);
  assert.ok(Number.isFinite(heartbeatAtMs), "raw Smoke heartbeat timestamp is invalid");
  const heartbeatExpiresAtMs = heartbeatAtMs + active.heartbeat.ttlSeconds * 1000;
  return {
    currentBinding,
    heartbeatExpired: now.getTime() > heartbeatExpiresAtMs,
    heartbeatExpiresAtMs,
    heartbeatExpiresAtUtc: new Date(heartbeatExpiresAtMs).toISOString(),
  };
}

function receiptBinding(root, launchIdentity) {
  return bindAbsolute(root, resolveProjectPath(root,
    `${RECEIPT_ROOT}/${launchIdentity}/launch-receipt.json`, {
      mustExist: true, kind: "file",
    }));
}

function supervisorHeartbeat(payload, journal, heartbeatAtUtc,
  observedProcessStatus = null) {
  return {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-background-supervisor-heartbeat-v1",
    status: journal.status,
    packageId: payload.packageId,
    runId: payload.runId,
    activeProcessId: journal.activeProcess.processId,
    activeProcessStartIdentity: journal.activeProcess.processStartIdentity,
    observedProcessStatus,
    recoveryLaunchCount: journal.recoveryLaunchCount,
    heartbeatAtUtc,
    ttlSeconds: 30,
  };
}

function normalizeProcessObservation(value, processId) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    assert.ok(["active", "dead", "indeterminate"].includes(value.status),
      "Smoke background process probe status is invalid");
    if (value.status === "active") assert.equal(
      typeof value.processStartIdentity, "string",
      "active Smoke process identity is absent",
    );
    return value;
  }
  assert.equal(typeof value, "string", "Smoke background process probe is invalid");
  assert.equal(["dead", "indeterminate", ""].includes(value.trim()), false,
    "Smoke background process is not active");
  return { status: "active", processId, processStartIdentity: value };
}

function writeOrVerifyJson(target, value) {
  if (!fs.existsSync(target)) {
    writeExclusiveJson(target, value);
    return;
  }
  assert.deepEqual(readJsonObject(target), value,
    `immutable background launch evidence conflicts: ${target}`);
}

function queryProcessStartIdentity(processId) {
  if (process.platform !== "win32") return {
    status: "active", processId,
    processStartIdentity: `${processId}:detached-process`,
  };
  const command = [
    "$ErrorActionPreference='Stop'",
    `$p=Get-CimInstance -ClassName Win32_Process -Filter \"ProcessId = ${processId}\" -ErrorAction Stop`,
    "if ($null -eq $p) { exit 3 }",
    "$p.CreationDate.ToUniversalTime().ToString('o')",
  ].join("; ");
  const result = spawnSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command", command,
  ], { encoding: "utf8", windowsHide: true, timeout: 10_000 });
  if (result.error || result.status === 3) return {
    status: "dead", processId, processStartIdentity: null,
  };
  if (result.status !== 0) return {
    status: "indeterminate", processId, processStartIdentity: null,
  };
  const creationDate = String(result.stdout).replace(/^\uFEFF/u, "").trim();
  assert.ok(creationDate, "background process creation identity is empty");
  return {
    status: "active", processId,
    processStartIdentity: `${processId}:${creationDate}`,
  };
}
