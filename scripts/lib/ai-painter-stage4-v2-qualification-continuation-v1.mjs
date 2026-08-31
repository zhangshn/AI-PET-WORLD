import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readCurrentExecutionRegistry } from "../../src/server/ai-painter-current-execution-registry.mjs";
import {
  STAGE4_V2_CAPABILITY,
  bindProjectFile,
  projectLogicalPath,
  readJsonObject,
  resolveProjectPath,
  writeExclusiveJson,
} from "./ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";
import {
  verifyStage4V2ReadonlyGpuQualifiedLifecycle,
} from "./ai-painter-stage4-v2-qualification-lifecycle-v1.mjs";
import {
  validateExactlyOnceBackgroundSpawnAttempt,
} from "./ai-painter-exactly-once-background-spawn-v1.mjs";

export const QUALIFICATION_SUCCESS_PLAN_ACTION = "plan:ai-painter-stage4-v2-controlled-smoke";
export const QUALIFICATION_SUCCESS_LAUNCH_ACTION = "launch:ai-painter-stage4-v2-controlled-smoke-background";
export const QUALIFICATION_FAILURE_ACTION = "adjudicate:ai-painter-stage4-v2-readonly-gpu-qualification-failure";

const SUCCESS_TASK = "materialize_stage4_v2_controlled_smoke_contract";
const SMOKE_EXECUTION_TASK = "execute_stage4_v2_controlled_smoke";
const FAILURE_TASK = "adjudicate_stage4_v2_readonly_gpu_qualification_failure";
const ENTRYPOINT_REGISTRY_PATH =
  "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json";
const SMOKE_BACKGROUND_RECEIPT_ROOT =
  ".runtime/ai-painter/stage4-v2-controlled-smoke-background-launches";
const SMOKE_PACKAGE_ROOT =
  ".runtime/ai-painter/autonomous-closed-loop-packages";

const DEFAULT_ACTIONS = Object.freeze({
  [QUALIFICATION_SUCCESS_PLAN_ACTION]: {
    entryFile: "scripts/plan-ai-painter-stage4-v2-controlled-smoke.mjs",
    exportName: "materializeStage4V2ControlledSmoke",
  },
  [QUALIFICATION_SUCCESS_LAUNCH_ACTION]: {
    entryFile: "scripts/launch-ai-painter-stage4-v2-controlled-smoke-background.mjs",
    exportName: "launchStage4V2ControlledSmokeBackground",
  },
  [QUALIFICATION_FAILURE_ACTION]: {
    entryFile: "scripts/adjudicate-ai-painter-stage4-v2-readonly-gpu-qualification-failure.mjs",
    exportName: "adjudicateStage4V2ReadonlyGpuQualificationFailure",
  },
});

export async function continueStage4V2AfterReadonlyGpuQualification({
  projectRoot = process.cwd(),
  qualificationResult,
  currentRegistryReader = readCurrentExecutionRegistry,
  actionInvoker = invokeRegisteredLocalAction,
  entrypointVerifier = verifyRegisteredAction,
  lifecycleVerifier = verifyStage4V2ReadonlyGpuQualifiedLifecycle,
  now = () => new Date(),
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  validateQualificationResult(qualificationResult);
  const terminalAbsolute = resolveProjectPath(
    root,
    qualificationResult.terminal.path,
    { mustExist: true, kind: "file" },
  );
  bindProjectFile(root, qualificationResult.terminal.path, qualificationResult.terminal.sha256);
  const continuationRoot = path.join(path.dirname(terminalAbsolute), "local-continuation");
  const intentPath = path.join(continuationRoot, "continuation-intent.json");
  const journalPath = path.join(continuationRoot, "continuation-journal.json");
  const resultPath = path.join(continuationRoot, "continuation-result.json");
  const failurePath = path.join(continuationRoot, "continuation-failure.json");
  const successfulQualification = qualificationResult.executionState === "completed"
    && qualificationResult.status === "stage4_v2_readonly_gpu_qualification_passed";
  const failedQualification = qualificationResult.executionState === "failed_closed";
  assert.equal(successfulQualification || failedQualification, true,
    "qualification result is not eligible for local continuation");
  if (successfulQualification) {
    lifecycleVerifier({
      projectRoot: root,
      qualificationTerminalBinding: qualificationResult.terminal,
    });
  }
  const expectedFirstAction = successfulQualification
    ? QUALIFICATION_SUCCESS_PLAN_ACTION
    : QUALIFICATION_FAILURE_ACTION;
  const expectedFirstTask = successfulQualification ? SUCCESS_TASK : FAILURE_TASK;
  let intent;
  let intentBinding;
  let journal;
  let initialCurrent = null;
  if (fs.existsSync(continuationRoot)) {
    assert.equal(fs.existsSync(intentPath), true, "continuation namespace has no immutable intent");
    assert.equal(fs.existsSync(journalPath), true, "continuation namespace has no recovery journal");
    if (fs.existsSync(failurePath)) {
      const failure = readJsonObject(failurePath);
      throw new Error(`qualification continuation is failed-closed: ${failure.error ?? failure.status}`);
    }
    intentBinding = bindProjectFile(root, projectLogicalPath(root, intentPath));
    intent = readJsonObject(intentPath);
    validateContinuationIntent(intent, {
      qualificationResult,
      expectedFirstAction,
      successfulQualification,
    });
    journal = readJsonObject(journalPath);
    validateContinuationJournal(journal, { qualificationResult, intentBinding });
    if (fs.existsSync(resultPath)) {
      const persisted = readJsonObject(resultPath);
      validateContinuationResult(persisted, { qualificationResult, intentBinding });
      return Object.freeze({
        ...persisted,
        result: bindProjectFile(root, projectLogicalPath(root, resultPath)),
        recoveredWithoutDuplicateAction: true,
      });
    }
  } else {
    initialCurrent = await currentRegistryReader(root);
    validateQualificationContinuationCurrent(initialCurrent, {
      qualificationResult,
      expectedTask: expectedFirstTask,
      expectedAction: expectedFirstAction,
    });
    const firstEntrypoint = entrypointVerifier({ root, action: expectedFirstAction });
    const recordedAtUtc = now().toISOString();
    fs.mkdirSync(continuationRoot, { recursive: false });
    intent = {
      schemaVersion: "ai-painter-stage4-v2-qualification-local-continuation-intent-v1",
      status: "continuation_intent_persisted",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      qualificationPackageId: qualificationResult.packageId,
      qualificationRunId: qualificationResult.runId,
      qualificationTerminal: qualificationResult.terminal,
      qualificationOutcome: successfulQualification ? "passed" : "failed_closed",
      firstAction: expectedFirstAction,
      firstEntrypoint,
      currentRegistry: {
        registryRevision: initialCurrent.registry.registryRevision,
        registrySha256: initialCurrent.registrySha256,
      },
      ownerAuthorizationRequired: false,
      codexRequired: false,
      automaticGpuReplayAllowed: false,
      recordedAtUtc,
    };
    writeExclusiveJson(intentPath, intent);
    intentBinding = bindProjectFile(root, projectLogicalPath(root, intentPath));
    journal = {
      schemaVersion: "ai-painter-stage4-v2-qualification-local-continuation-journal-v1",
      state: "intent_persisted",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      qualificationPackageId: qualificationResult.packageId,
      qualificationRunId: qualificationResult.runId,
      continuationIntent: intentBinding,
      smokePlanInvoked: false,
      smokeLaunchInvoked: false,
      failureAdjudicationInvoked: false,
      automaticGpuReplayAllowed: false,
      recordedAtUtc,
      updatedAtUtc: recordedAtUtc,
    };
    writeExclusiveJson(journalPath, journal);
    invokeContinuationHook(_testHooks, "afterContinuationIntentPersisted", {
      qualificationPackageId: qualificationResult.packageId,
      qualificationRunId: qualificationResult.runId,
    });
  }

  try {
    if (successfulQualification) {
      let smokeCurrent = initialCurrent ?? await currentRegistryReader(root);
      let planResult = null;
      let planEntrypoint = intent.firstEntrypoint;
      if (isQualificationPlanReady(smokeCurrent, qualificationResult)) {
        const verifiedPlanEntrypoint = entrypointVerifier({
          root,
          action: QUALIFICATION_SUCCESS_PLAN_ACTION,
        });
        assert.deepEqual(verifiedPlanEntrypoint, intent.firstEntrypoint,
          "Smoke planner program lineage changed after continuation intent");
        planEntrypoint = verifiedPlanEntrypoint;
        planResult = await actionInvoker({
          root,
          action: QUALIFICATION_SUCCESS_PLAN_ACTION,
          entrypoint: planEntrypoint,
        });
        smokeCurrent = await currentRegistryReader(root);
        journal = transitionContinuationJournal(journalPath, journal, "smoke_plan_committed", {
          smokePlanInvoked: true,
          smokePlanResult: summarizeActionResult(planResult),
          smokeRegistry: registryIdentity(smokeCurrent),
          updatedAtUtc: now().toISOString(),
        });
        invokeContinuationHook(_testHooks, "afterSmokePlanBeforeLaunch", {
          smokeRegistry: journal.smokeRegistry,
        });
      }
      const smokeLauncher = entrypointVerifier({
        root,
        action: QUALIFICATION_SUCCESS_LAUNCH_ACTION,
      });
      let smokeLaunchResult;
      const recoveredSmokeLaunch = recoverExactCommittedSmokeLaunch({
        root,
        current: smokeCurrent,
        journal,
      });
      if (recoveredSmokeLaunch) {
        smokeLaunchResult = recoveredSmokeLaunch;
      } else {
        validateSmokeLaunchReady(smokeCurrent);
        smokeLaunchResult = await actionInvoker({
          root,
          action: QUALIFICATION_SUCCESS_LAUNCH_ACTION,
          entrypoint: smokeLauncher,
        });
        invokeContinuationHook(_testHooks, "afterSmokeLaunchReturnedBeforeJournal", {
          smokePackageId: smokeCurrent.registry.packageId,
          smokeRunId: smokeCurrent.registry.runId,
        });
      }
      assert.equal(smokeLaunchResult?.detachedFromCodex, true,
        "Smoke launcher did not prove Codex-independent execution");
      const expectedSmokeRegistry = journal.smokeRegistry ?? registryIdentity(smokeCurrent);
      assert.equal(smokeLaunchResult?.packageId, expectedSmokeRegistry.packageId,
        "Smoke launcher package identity mismatch");
      assert.equal(smokeLaunchResult?.runId, expectedSmokeRegistry.runId,
        "Smoke launcher run identity mismatch");
      journal = transitionContinuationJournal(journalPath, journal, "smoke_launch_returned", {
        smokeLaunchInvoked: true,
        smokeRegistry: expectedSmokeRegistry,
        smokeLaunchResult: summarizeActionResult(smokeLaunchResult),
        recoveredFromExactCommittedSmoke: recoveredSmokeLaunch !== null,
        updatedAtUtc: now().toISOString(),
      });
      invokeContinuationHook(_testHooks, "afterSmokeLaunchBeforeResult", {
        smokeRegistry: journal.smokeRegistry,
      });
      const result = {
        schemaVersion: "ai-painter-stage4-v2-qualification-local-continuation-result-v1",
        status: "controlled_smoke_background_started",
        capabilityVersion: STAGE4_V2_CAPABILITY,
        qualificationPackageId: qualificationResult.packageId,
        qualificationRunId: qualificationResult.runId,
        qualificationTerminal: qualificationResult.terminal,
        continuationIntent: intentBinding,
        planAction: expectedFirstAction,
        planEntrypoint,
        planResult: summarizeActionResult(planResult),
        smokePackageId: expectedSmokeRegistry.packageId,
        smokeRunId: expectedSmokeRegistry.runId,
        smokeLaunchAction: QUALIFICATION_SUCCESS_LAUNCH_ACTION,
        smokeLaunchEntrypoint: smokeLauncher,
        smokeLaunchResult: summarizeActionResult(smokeLaunchResult),
        detachedFromCodex: true,
        ownerAuthorizationRequired: false,
        automaticGpuReplayAllowed: false,
        recordedAtUtc: now().toISOString(),
      };
      writeExclusiveJson(resultPath, result);
      transitionContinuationJournal(journalPath, journal, "result_committed", {
        result: bindProjectFile(root, projectLogicalPath(root, resultPath)),
        updatedAtUtc: now().toISOString(),
      });
      return Object.freeze({ ...result, result: bindProjectFile(root, projectLogicalPath(root, resultPath)) });
    }

    let afterAdjudication = initialCurrent ?? await currentRegistryReader(root);
    let adjudicationResult = null;
    let adjudicationEntrypoint = intent.firstEntrypoint;
    if (isQualificationFailureAdjudicationReady(afterAdjudication, qualificationResult)) {
      const verifiedAdjudicator = entrypointVerifier({ root, action: QUALIFICATION_FAILURE_ACTION });
      assert.deepEqual(verifiedAdjudicator, intent.firstEntrypoint,
        "failure adjudicator program lineage changed after continuation intent");
      adjudicationEntrypoint = verifiedAdjudicator;
      adjudicationResult = await actionInvoker({
        root,
        action: QUALIFICATION_FAILURE_ACTION,
        entrypoint: adjudicationEntrypoint,
      });
      afterAdjudication = await currentRegistryReader(root);
      journal = transitionContinuationJournal(journalPath, journal, "failure_adjudication_committed", {
        failureAdjudicationInvoked: true,
        adjudicationResult: summarizeActionResult(adjudicationResult),
        resultingRegistry: registryIdentity(afterAdjudication),
        updatedAtUtc: now().toISOString(),
      });
    }
    assert.equal(afterAdjudication.ok, true,
      afterAdjudication.errorCode ?? "failure adjudication registry is invalid");
    assert.equal(afterAdjudication.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
    assert.notEqual(afterAdjudication.registry.nextMachineAction, QUALIFICATION_FAILURE_ACTION,
      "failure adjudication did not advance the current task");
    const result = {
      schemaVersion: "ai-painter-stage4-v2-qualification-local-continuation-result-v1",
      status: "qualification_failure_adjudicated_locally",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      qualificationPackageId: qualificationResult.packageId,
      qualificationRunId: qualificationResult.runId,
      qualificationTerminal: qualificationResult.terminal,
      continuationIntent: intentBinding,
      adjudicationAction: expectedFirstAction,
      adjudicationEntrypoint,
      adjudicationResult: summarizeActionResult(adjudicationResult),
      resultingTaskId: afterAdjudication.registry.taskId,
      resultingNextMachineAction: afterAdjudication.registry.nextMachineAction,
      detachedFromCodex: true,
      ownerAuthorizationRequired: false,
      automaticGpuReplayAllowed: false,
      recordedAtUtc: now().toISOString(),
    };
    writeExclusiveJson(resultPath, result);
    transitionContinuationJournal(journalPath, journal, "result_committed", {
      result: bindProjectFile(root, projectLogicalPath(root, resultPath)),
      updatedAtUtc: now().toISOString(),
    });
    return Object.freeze({ ...result, result: bindProjectFile(root, projectLogicalPath(root, resultPath)) });
  } catch (error) {
    if (isInjectedCrash(error)) throw error;
    const failure = {
      schemaVersion: "ai-painter-stage4-v2-qualification-local-continuation-failure-v1",
      status: "local_continuation_failed_closed",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      qualificationPackageId: qualificationResult.packageId,
      qualificationRunId: qualificationResult.runId,
      qualificationTerminal: qualificationResult.terminal,
      continuationIntent: intentBinding,
      attemptedAction: expectedFirstAction,
      error: error instanceof Error ? error.message : String(error),
      ownerAuthorizationRequired: false,
      automaticRetryAllowed: false,
      automaticGpuReplayAllowed: false,
      recordedAtUtc: now().toISOString(),
    };
    if (!fs.existsSync(failurePath)) writeExclusiveJson(failurePath, failure);
    throw error;
  }
}

function validateQualificationContinuationCurrent(current, {
  qualificationResult,
  expectedTask,
  expectedAction,
}) {
  assert.equal(current.ok, true, current.errorCode ?? "continuation current registry is invalid");
  assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(current.registry.packageId, qualificationResult.packageId);
  assert.equal(current.registry.runId, qualificationResult.runId);
  assert.equal(current.registry.taskId, expectedTask, "qualification continuation task mismatch");
  assert.equal(current.registry.nextMachineAction, expectedAction,
    "qualification continuation action mismatch");
  assert.equal(current.registry.activeExecution, null,
    "qualification continuation cannot run beside active execution");
}

function isQualificationPlanReady(current, qualificationResult) {
  return current?.ok === true
    && current.registry.capabilityVersion === STAGE4_V2_CAPABILITY
    && current.registry.packageId === qualificationResult.packageId
    && current.registry.runId === qualificationResult.runId
    && current.registry.taskId === SUCCESS_TASK
    && current.registry.nextMachineAction === QUALIFICATION_SUCCESS_PLAN_ACTION
    && current.registry.activeExecution === null;
}

function validateSmokeLaunchReady(current) {
  assert.equal(current?.ok, true, current?.errorCode ?? "Smoke plan registry is invalid");
  assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(current.registry.taskId, SMOKE_EXECUTION_TASK,
    "Smoke planner did not publish the Smoke execution task");
  assert.equal(current.registry.nextMachineAction, QUALIFICATION_SUCCESS_LAUNCH_ACTION,
    "Smoke planner did not publish the detached Smoke launch action");
  assert.equal(current.registry.executionState, "package_materialized");
  assert.equal(current.registry.activeExecution, null);
}

function recoverExactCommittedSmokeLaunch({ root, current, journal }) {
  if (current?.ok !== true
    || current.registry.capabilityVersion !== STAGE4_V2_CAPABILITY) return null;
  const smokePackageId = journal.smokeRegistry?.packageId
    ?? (current.registry.taskId === SMOKE_EXECUTION_TASK ? current.registry.packageId : null);
  const smokeRunId = journal.smokeRegistry?.runId
    ?? (current.registry.taskId === SMOKE_EXECUTION_TASK ? current.registry.runId : null);
  if (!smokePackageId || !smokeRunId) return null;
  const packageRoot = resolveProjectPath(root,
    `${SMOKE_PACKAGE_ROOT}/${smokePackageId}`);
  if (!fs.existsSync(packageRoot)) return null;
  assert.equal(fs.statSync(packageRoot).isDirectory(), true,
    "Smoke package root is not a directory");
  const manifestBinding = bindProjectFile(root,
    projectLogicalPath(root, path.join(packageRoot, "package-manifest.json")));
  const manifest = readJsonObject(resolveProjectPath(root, manifestBinding.path, {
    mustExist: true, kind: "file",
  }));
  assert.equal(manifest.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-package-manifest-v1");
  assert.equal(manifest.packageId, smokePackageId,
    "Smoke manifest package differs from planned Smoke package");
  assert.equal(manifest.runId, smokeRunId,
    "Smoke manifest run differs from planned Smoke run");
  const launchCommitPath = path.join(packageRoot, "background-launch-commit.json");
  if (!fs.existsSync(launchCommitPath)) return null;
  const launchCommitBinding = bindProjectFile(root,
    projectLogicalPath(root, launchCommitPath));
  const launchCommit = readJsonObject(launchCommitPath);
  assert.equal(launchCommit.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-background-launch-commit-v1");
  assert.equal(launchCommit.status, "receipt_committed");
  assert.equal(launchCommit.packageId, smokePackageId,
    "Smoke launch commit package mismatch");
  assert.equal(launchCommit.runId, smokeRunId,
    "Smoke launch commit run mismatch");
  const launchIdentity = `stage4-v2-smoke-bg-${smokeRunId}`;
  const receiptBinding = bindProjectFile(root,
    `${SMOKE_BACKGROUND_RECEIPT_ROOT}/${launchIdentity}/launch-receipt.json`);
  assert.deepEqual(launchCommit.receipt, receiptBinding,
    "Smoke launch commit binds another launch receipt");
  const receipt = readJsonObject(resolveProjectPath(root, receiptBinding.path, {
    mustExist: true, kind: "file",
  }));
  assert.equal(receipt.schemaVersion,
    "ai-painter-local-program-background-command-receipt-v1");
  assert.equal(receipt.status, "background_process_started");
  assert.equal(receipt.launchIdentity, launchIdentity,
    "Smoke receipt launch identity mismatch");
  assert.ok(receipt.spawnAttempt?.path && receipt.spawnAttempt?.sha256,
    "Smoke receipt has no immutable spawn attempt binding");
  const spawnAttempt = readJsonObject(resolveProjectPath(root,
    receipt.spawnAttempt.path, { mustExist: true, kind: "file" }));
  bindProjectFile(root, receipt.spawnAttempt.path, receipt.spawnAttempt.sha256);
  validateExactlyOnceBackgroundSpawnAttempt(spawnAttempt);
  assert.equal(spawnAttempt.launchIdentity, launchIdentity,
    "Smoke spawn attempt launch identity mismatch");
  assert.equal(spawnAttempt.runnerPath, receipt.runnerPath,
    "Smoke spawn attempt runner path mismatch");
  assert.equal(spawnAttempt.runnerSha256, receipt.runnerSha256,
    "Smoke spawn attempt runner SHA mismatch");
  assert.deepEqual(spawnAttempt.runnerArgs, receipt.runnerArgs,
    "Smoke spawn attempt runner arguments mismatch");
  assert.equal(spawnAttempt.commandIdentitySha256, receipt.commandIdentitySha256,
    "Smoke receipt command identity mismatch");
  assert.ok(Number.isInteger(receipt.processId) && receipt.processId > 0,
    "Smoke receipt process identity is invalid");
  assert.equal(receipt.processStartIdentity,
    `${receipt.processId}:${receipt.processCreationDateUtc}`,
    "Smoke receipt PID/start identity mismatch");
  assert.equal(receipt.detachedFromCodex, true,
    "Smoke receipt is not Codex-independent");
  assert.deepEqual(receipt.runnerArgs.slice(0, 4), [
    "--package-manifest", manifestBinding.path,
    "--package-manifest-sha256", manifestBinding.sha256,
  ], "Smoke receipt package manifest arguments mismatch");
  validateSmokeRegistryDescendsFromLaunch({
    root,
    current,
    smokePackageId,
    smokeRunId,
    manifestBinding,
    receipt,
    packageRoot,
  });
  const active = current.registry.activeExecution;
  if (active !== null && current.registry.packageId === smokePackageId
    && current.registry.runId === smokeRunId) {
    assert.equal(current.registry.nextMachineAction, null,
      "active Smoke registry unexpectedly retains a launch action");
    assert.equal(active.capabilityVersion, STAGE4_V2_CAPABILITY,
      "active Smoke capability identity mismatch");
    assert.equal(active.packageId, smokePackageId,
      "active Smoke package identity mismatch");
    assert.equal(active.runId, smokeRunId,
      "active Smoke run identity mismatch");
    assert.equal(active.processId, receipt.processId,
      "Smoke receipt process differs from active execution");
    assert.equal(active.processStartIdentity, receipt.processStartIdentity,
      "Smoke receipt start identity differs from active execution");
  }
  const executionTerminalPath = path.join(packageRoot, "execution-terminal.json");
  const completed = fs.existsSync(executionTerminalPath);
  const executionTerminalBinding = completed
    ? bindProjectFile(root, projectLogicalPath(root, executionTerminalPath))
    : null;
  return Object.freeze({
    status: completed
      ? "background_process_completed_identity_bound"
      : active !== null
        ? "background_process_already_active_identity_bound"
        : "background_process_launch_receipt_committed_identity_bound",
    packageId: smokePackageId,
    runId: smokeRunId,
    processId: receipt.processId,
    processStartIdentity: receipt.processStartIdentity,
    launchReceipt: receiptBinding,
    launchCommit: launchCommitBinding,
    smokeExecutionTerminal: executionTerminalBinding,
    detachedFromCodex: true,
    qualificationRelaunchCount: 0,
  });
}

function validateSmokeRegistryDescendsFromLaunch({
  root,
  current,
  smokePackageId,
  smokeRunId,
  manifestBinding,
  packageRoot,
}) {
  const registry = current.registry;
  assert.equal(registry.registryRevision >= 0, true,
    "Smoke successor registry revision is invalid");
  const executionTerminalPath = path.join(packageRoot, "execution-terminal.json");
  if (registry.packageId === smokePackageId && registry.runId === smokeRunId
    && registry.taskId === SMOKE_EXECUTION_TASK) {
    assert.equal(current.currentTaskTerminal?.schemaVersion,
      "ai-painter-stage4-v2-controlled-smoke-materialization-terminal-v1",
      "Smoke execution lost its materialization terminal");
    assert.deepEqual(current.currentTaskTerminal.packageManifest, manifestBinding,
      "Smoke execution materialization manifest changed");
    return;
  }
  assert.equal(fs.existsSync(executionTerminalPath), true,
    "Smoke successor registry exists without the immutable Smoke terminal");
  const smokeTerminalBinding = bindProjectFile(root,
    projectLogicalPath(root, executionTerminalPath));
  const smokeTerminal = readJsonObject(executionTerminalPath);
  assert.equal(smokeTerminal.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-terminal-v1");
  assert.equal(smokeTerminal.packageId, smokePackageId);
  assert.equal(smokeTerminal.runId, smokeRunId);
  const currentTerminal = current.currentTaskTerminal;
  if (currentTerminal?.schemaVersion
    === "ai-painter-stage4-v2-controlled-smoke-terminal-v1") {
    assert.deepEqual(registry.terminalEvidence, smokeTerminalBinding,
      "Smoke successor registry binds another Smoke terminal");
    return;
  }
  if (currentTerminal?.schemaVersion
    === "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-terminal-v1") {
    const plan = readBoundContinuationJson(root, currentTerminal.plan);
    assert.deepEqual(plan.parentControlledSmokeTerminal, smokeTerminalBinding,
      "formal successor belongs to another Smoke terminal");
    return;
  }
  if (currentTerminal?.schemaVersion
    === "ai-painter-stage4-v2-controlled-smoke-failure-boundary-terminal-v1") {
    assert.deepEqual(currentTerminal.sourceTerminal, smokeTerminalBinding,
      "failure successor belongs to another Smoke terminal");
    return;
  }
  throw new Error("current registry is not an exact descendant of the launched Smoke");
}

function readBoundContinuationJson(root, binding) {
  assert.ok(binding?.path && binding?.sha256,
    "continuation evidence binding is missing");
  bindProjectFile(root, binding.path, binding.sha256);
  return readJsonObject(resolveProjectPath(root, binding.path, {
    mustExist: true, kind: "file",
  }));
}

function isQualificationFailureAdjudicationReady(current, qualificationResult) {
  return current?.ok === true
    && current.registry.capabilityVersion === STAGE4_V2_CAPABILITY
    && current.registry.packageId === qualificationResult.packageId
    && current.registry.runId === qualificationResult.runId
    && current.registry.taskId === FAILURE_TASK
    && current.registry.nextMachineAction === QUALIFICATION_FAILURE_ACTION
    && current.registry.activeExecution === null;
}

function validateContinuationIntent(intent, {
  qualificationResult,
  expectedFirstAction,
  successfulQualification,
}) {
  assert.equal(intent.schemaVersion, "ai-painter-stage4-v2-qualification-local-continuation-intent-v1");
  assert.equal(intent.status, "continuation_intent_persisted");
  assert.equal(intent.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(intent.qualificationPackageId, qualificationResult.packageId);
  assert.equal(intent.qualificationRunId, qualificationResult.runId);
  assert.deepEqual(intent.qualificationTerminal, qualificationResult.terminal);
  assert.equal(intent.qualificationOutcome, successfulQualification ? "passed" : "failed_closed");
  assert.equal(intent.firstAction, expectedFirstAction);
  assert.equal(intent.ownerAuthorizationRequired, false);
  assert.equal(intent.codexRequired, false);
  assert.equal(intent.automaticGpuReplayAllowed, false);
}

function validateContinuationJournal(journal, { qualificationResult, intentBinding }) {
  assert.equal(journal.schemaVersion, "ai-painter-stage4-v2-qualification-local-continuation-journal-v1");
  assert.ok([
    "intent_persisted",
    "smoke_plan_committed",
    "smoke_launch_returned",
    "failure_adjudication_committed",
    "result_committed",
  ].includes(journal.state), "continuation journal state is invalid");
  assert.equal(journal.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(journal.qualificationPackageId, qualificationResult.packageId);
  assert.equal(journal.qualificationRunId, qualificationResult.runId);
  assert.deepEqual(journal.continuationIntent, intentBinding);
  assert.equal(journal.automaticGpuReplayAllowed, false);
}

function validateContinuationResult(result, { qualificationResult, intentBinding }) {
  assert.equal(result.schemaVersion, "ai-painter-stage4-v2-qualification-local-continuation-result-v1");
  assert.ok([
    "controlled_smoke_background_started",
    "qualification_failure_adjudicated_locally",
  ].includes(result.status));
  assert.equal(result.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(result.qualificationPackageId, qualificationResult.packageId);
  assert.equal(result.qualificationRunId, qualificationResult.runId);
  assert.deepEqual(result.qualificationTerminal, qualificationResult.terminal);
  assert.deepEqual(result.continuationIntent, intentBinding);
  assert.equal(result.detachedFromCodex, true);
  assert.equal(result.ownerAuthorizationRequired, false);
  assert.equal(result.automaticGpuReplayAllowed, false);
}

function transitionContinuationJournal(journalPath, current, state, patch) {
  const allowed = {
    intent_persisted: ["smoke_plan_committed", "smoke_launch_returned", "failure_adjudication_committed", "result_committed"],
    smoke_plan_committed: ["smoke_launch_returned", "result_committed"],
    smoke_launch_returned: ["smoke_launch_returned", "result_committed"],
    failure_adjudication_committed: ["failure_adjudication_committed", "result_committed"],
    result_committed: ["result_committed"],
  };
  assert.ok(allowed[current.state]?.includes(state),
    `invalid continuation journal transition ${current.state} -> ${state}`);
  const next = { ...current, ...patch, state };
  writeJsonAtomic(journalPath, next);
  const reread = readJsonObject(journalPath);
  assert.deepEqual(reread, next, "continuation journal read-back mismatch");
  return next;
}

function registryIdentity(current) {
  assert.equal(current?.ok, true, current?.errorCode ?? "continuation registry is invalid");
  return {
    registryRevision: current.registry.registryRevision,
    registrySha256: current.registrySha256,
    capabilityVersion: current.registry.capabilityVersion,
    packageId: current.registry.packageId,
    runId: current.registry.runId,
    taskId: current.registry.taskId,
    nextMachineAction: current.registry.nextMachineAction,
  };
}

function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  const descriptor = fs.openSync(temporaryPath, "r+");
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.renameSync(temporaryPath, filePath);
}

function invokeContinuationHook(hooks, point, detail) {
  if (typeof hooks?.onContinuationPoint === "function") hooks.onContinuationPoint(point, detail);
}

function isInjectedCrash(error) {
  return error && typeof error === "object" && error.code === "AI_PAINTER_TEST_CRASH";
}

export function verifyRegisteredAction({ root, action }) {
  const definition = DEFAULT_ACTIONS[action];
  assert.ok(definition, `continuation action is not allowed: ${action}`);
  const registryBinding = bindProjectFile(root, ENTRYPOINT_REGISTRY_PATH);
  const registry = readJsonObject(resolveProjectPath(root, registryBinding.path, { mustExist: true, kind: "file" }));
  assert.equal(registry.schemaVersion, "ai-painter-current-entrypoint-registry-v1");
  assert.equal(registry.status, "active");
  const matches = registry.currentEntrypoints.filter((entry) => entry.packageScript === action);
  assert.equal(matches.length, 1, `current entrypoint registry must contain exactly one ${action}`);
  assert.equal(matches[0].entryFile, definition.entryFile, `${action} entry file mismatch`);
  const entryFile = bindProjectFile(root, definition.entryFile);
  return Object.freeze({
    action,
    entryFile,
    exportName: definition.exportName,
    entrypointRegistry: registryBinding,
  });
}

export async function invokeRegisteredLocalAction({ root, action, entrypoint }) {
  const definition = DEFAULT_ACTIONS[action];
  assert.ok(definition, `continuation action is not allowed: ${action}`);
  assert.equal(entrypoint.action, action);
  assert.equal(entrypoint.entryFile.path, definition.entryFile);
  bindProjectFile(root, entrypoint.entryFile.path, entrypoint.entryFile.sha256);
  const absolute = resolveProjectPath(root, entrypoint.entryFile.path, { mustExist: true, kind: "file" });
  const moduleUrl = pathToFileURL(absolute);
  moduleUrl.searchParams.set("sha256", entrypoint.entryFile.sha256);
  const module = await import(moduleUrl.href);
  const callable = module[definition.exportName];
  assert.equal(typeof callable, "function", `${action} export ${definition.exportName} is missing`);
  return callable({ projectRoot: root });
}

function validateQualificationResult(result) {
  assert.ok(result && typeof result === "object", "qualification result is required");
  assert.equal(result.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-execution-result-v1");
  assert.equal(result.ownerAuthorizationRequired, false);
  assert.equal(result.trainingStarted, false);
  assert.equal(typeof result.packageId, "string");
  assert.equal(typeof result.runId, "string");
  assert.ok(result.terminal && typeof result.terminal.path === "string");
  assert.match(result.terminal.sha256 ?? "", /^[a-f0-9]{64}$/u);
}

function summarizeActionResult(result) {
  if (!result || typeof result !== "object") return { status: "completed_without_structured_result" };
  return Object.fromEntries(Object.entries(result).filter(([key, value]) => (
    [
      "status", "executionState", "packageId", "runId", "detachedFromCodex",
      "terminal", "launchReceipt", "launchCommit", "processId",
      "processStartIdentity", "qualificationRelaunchCount",
    ]
      .includes(key)
      && (value === null || ["string", "boolean", "number", "object"].includes(typeof value))
  )));
}
