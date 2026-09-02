import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  advanceCurrentExecutionRegistry,
  CURRENT_EXECUTION_REGISTRY_PATH,
  readCurrentExecutionRegistry,
  recoverExpiredActiveExecutionToFailedClosed,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import {
  CLOSED_LOOP_ROOT,
  runAutonomousClosedLoop,
} from "./lib/ai-painter-autonomous-closed-loop-v1.mjs";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import {
  formatShanghai,
} from "./lib/ai-painter-program-event-store.mjs";
import {
  bindAbsolute,
  projectLogicalPath,
  readBoundJson,
  readJsonObject,
  resolveProjectPath,
  sha256File,
  SMOKE_BACKGROUND_LAUNCH_ACTION,
  SMOKE_RUN_TASK,
  STAGE4_V2_CAPABILITY,
  validateStage4V2SmokePackagePayload,
  writeExclusiveJson,
  writeJsonAtomic,
} from "./lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  validateStage4V2ControlledSmokeBackgroundLaunchIntent,
} from "./lib/ai-painter-stage4-v2-controlled-smoke-launch-intent-v1.mjs";
import {
  commitStage4V2ExternalRegistryDependencies,
} from "./lib/ai-painter-stage4-v2-external-registry-dependency-v1.mjs";
import {
  captureImmutableCurrentRegistryEvidence,
  validateImmutableCurrentRegistryEvidence,
} from "./lib/ai-painter-immutable-current-registry-evidence-v1.mjs";
import {
  persistStage4V2LifecyclePublication,
} from "./lib/ai-painter-stage4-v2-lifecycle-publication-v1.mjs";

export const FORMAL_PLAN_ACTION = "plan:ai-painter-stage4-v2-formal-stage0-to-stage2";
export const FORMAL_PLAN_TASK = "materialize_stage4_v2_formal_stage0_to_stage2";
export const FAILURE_ACTION = "adjudicate:ai-painter-stage4-v2-controlled-smoke-failure-boundary";
export const FAILURE_TASK = "adjudicate_stage4_v2_controlled_smoke_failure_boundary";

const HEARTBEAT_TTL_SECONDS = 60;
const HEARTBEAT_INTERVAL_MS = 10_000;
const LIFECYCLE_ROOT = `.runtime/ai-painter/capability-lifecycle/${STAGE4_V2_CAPABILITY}`;

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const cli = parseCli(process.argv.slice(2));
  runStage4V2ControlledSmoke({
    projectRoot: process.cwd(),
    packageManifestBinding: {
      path: cli.packageManifest, sha256: cli.packageManifestSha256,
    },
    launchIntentBinding: {
      path: cli.launchIntent, sha256: cli.launchIntentSha256,
    },
  }).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.executionState === "failed_closed") process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function runStage4V2ControlledSmoke({
  projectRoot = process.cwd(),
  packageManifestBinding,
  launchIntentBinding,
  appendProgramEvent = true,
  commitCurrentRegistry = true,
  successorInvoker = invokeStage4V2SmokeSuccessor,
  now = () => new Date(),
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  validateBinding(packageManifestBinding, "packageManifestBinding");
  validateBinding(launchIntentBinding, "launchIntentBinding");
  let current = await readCurrentExecutionRegistry(root);
  if (current.ok !== true) {
    current = await recoverInterruptedSmokeToMaterialized({
      root, packageManifestBinding, now, _testHooks,
    });
  } else if (current.currentTaskTerminal?.schemaVersion
    === "ai-painter-stage4-v2-controlled-smoke-host-recovery-terminal-v1") {
    current = await restoreRecoveredSmokeMaterialization({ root, current });
  }
  verifyMaterializedCurrent(current);
  assert.equal(packageManifestBinding.path, current.currentTaskTerminal.packageManifest.path,
    "runner package manifest path is not current");
  assert.equal(packageManifestBinding.sha256, current.currentTaskTerminal.packageManifest.sha256,
    "runner package manifest SHA-256 is not current");
  const launchIntent = validateStage4V2ControlledSmokeBackgroundLaunchIntent({
    projectRoot: root,
    launchIntentBinding,
    packageManifestBinding: current.currentTaskTerminal.packageManifest,
  }).intent;
  assert.equal(launchIntent.packageId, current.registry.packageId);
  assert.equal(launchIntent.runId, current.registry.runId);
  const ownPath = resolveProjectPath(root, "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs", {
    mustExist: true, kind: "file",
  });
  assert.equal(launchIntent.runner.sha256, sha256File(ownPath),
    "outer runner differs from launch intent");
  const materializationTerminal = current.currentTaskTerminal;
  const smokeManifest = readBoundJson(root, materializationTerminal.packageManifest);
  assert.equal(smokeManifest.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-package-manifest-v1");
  const payload = readBoundJson(root, smokeManifest.packagePayload);
  assert.deepEqual(payload.programGraphManifest, smokeManifest.programGraphManifest,
    "Smoke payload/manifest program graph binding mismatch");
  validateStage4V2SmokePackagePayload(payload, {
    projectRoot: root,
    verifyEvidence: true,
  });
  assert.equal(payload.programLineage.outerRunner.path,
    "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs");
  assert.equal(payload.programLineage.outerRunner.sha256, sha256File(ownPath));
  const genericBinding = smokeManifest.autonomousClosedLoopPackage;
  const genericPath = resolveProjectPath(root, genericBinding.path, {
    mustExist: true, kind: "file",
  });
  assert.equal(sha256File(genericPath), genericBinding.sha256,
    "autonomous closed-loop package SHA-256 mismatch");
  const spec = readJsonObject(genericPath);
  assert.equal(spec.packageIdentity, payload.packageId);
  assert.equal(spec.outputRoot, payload.outputDirectory);

  const packageRoot = path.dirname(resolveProjectPath(root, materializationTerminal.packageManifest.path));
  const executionAttempt = nextExecutionAttempt(packageRoot);
  const lockPath = path.join(packageRoot,
    `active-execution-attempt-${executionAttempt}-lock.json`);
  const heartbeatPath = path.join(packageRoot,
    `active-execution-attempt-${executionAttempt}-heartbeat-preflight.json`);
  const processStartIdentity = queryCurrentProcessStartIdentity();
  const lockRecord = {
    schemaVersion: "ai-painter-current-active-execution-lock-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: payload.packageId,
    runId: payload.runId,
    processId: process.pid,
    processStartIdentity,
  };
  writeExclusiveJson(lockPath, lockRecord);
  writeJsonAtomic(heartbeatPath, heartbeatRecord(payload, processStartIdentity, "preflight", now()));
  const lockBinding = bindAbsolute(root, lockPath);
  const activeExecution = {
    schemaVersion: "ai-painter-current-active-execution-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: payload.packageId,
    runId: payload.runId,
    executionState: "preflight",
    processId: process.pid,
    processStartIdentity,
    programLineage: Object.fromEntries(Object.entries(payload.programLineage).map(
      ([role, binding]) => [role, { path: binding.path, sha256: binding.sha256 }],
    )),
    lock: { path: lockBinding.path, sha256: lockBinding.sha256 },
    heartbeat: {
      path: projectLogicalPath(root, heartbeatPath),
      ttlSeconds: HEARTBEAT_TTL_SECONDS,
    },
  };
  if (commitCurrentRegistry) {
    current = await advanceCurrentExecutionRegistry({
      projectRoot: root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: payload.packageId,
      taskId: SMOKE_RUN_TASK,
      taskKind: "controlled_smoke",
      taskGoal: "Execute the fixed V2 controlled Smoke through automatic review, adjudication and finalization.",
      priority: 1,
      queueStatus: "running",
      nextMachineAction: null,
      queuedAtUtc: current.registry.queuedAtUtc ?? now().toISOString(),
      runId: payload.runId,
      lifecycleStage: "readonly_gpu_qualified",
      executionState: "preflight",
      activity: "stage4_v2_controlled_smoke_preflight",
      taskCapsulePath: current.registry.taskCapsule.path,
      terminalEvidencePath: current.registry.terminalEvidence.path,
      activeExecution,
      expectedPreviousRegistryRevision: current.registry.registryRevision,
      expectedPreviousRegistrySha256: current.registrySha256,
    });
  }
  let heartbeatError = null;
  const heartbeatTimer = setInterval(() => {
    try {
      const liveRegistry = readJsonObject(resolveProjectPath(
        root, CURRENT_EXECUTION_REGISTRY_PATH, { mustExist: true, kind: "file" },
      ));
      assert.equal(liveRegistry.packageId, payload.packageId,
        "heartbeat registry package changed while Smoke was active");
      assert.equal(liveRegistry.runId, payload.runId,
        "heartbeat registry run changed while Smoke was active");
      assert.ok(liveRegistry.activeExecution,
        "Smoke active execution disappeared before terminal publication");
      const currentHeartbeatPath = resolveProjectPath(
        root, liveRegistry.activeExecution.heartbeat.path,
        { mustExist: true, kind: "file" },
      );
      const prior = readJsonObject(currentHeartbeatPath);
      assert.equal(prior.executionState, liveRegistry.executionState,
        "Smoke heartbeat state differs from current registry state");
      writeJsonAtomic(currentHeartbeatPath, {
        ...prior, heartbeatAtUtc: now().toISOString(),
      });
    } catch (error) { heartbeatError = error; }
  }, HEARTBEAT_INTERVAL_MS);

  let genericState;
  try {
    genericState = await runAutonomousClosedLoop({
      root, spec, packageSha256: genericBinding.sha256,
    });
  } finally {
    clearInterval(heartbeatTimer);
  }
  if (heartbeatError) throw new Error(`Smoke heartbeat persistence failed: ${heartbeatError.message}`);
  const genericTerminalPath = resolveProjectPath(
    root, `${CLOSED_LOOP_ROOT}/${payload.packageId}/phase-terminal.json`,
    { mustExist: true, kind: "file" },
  );
  const genericTerminalBinding = bindAbsolute(root, genericTerminalPath);
  const outputRoot = resolveProjectPath(root, payload.outputDirectory);
  const smokeFinalizationPath = path.join(outputRoot, "smoke-finalization.json");
  const smokeFinalizationBinding = fs.existsSync(smokeFinalizationPath)
    ? bindAbsolute(root, smokeFinalizationPath) : null;
  const genericTerminal = readJsonObject(genericTerminalPath);
  let smokeFinalization = null;
  let finalizationEvidenceError = null;
  if (smokeFinalizationBinding) {
    try {
      smokeFinalization = validateOuterFinalizationChain({
        root, payload, genericTerminal, smokeFinalizationBinding,
      });
    } catch (error) {
      finalizationEvidenceError = error;
    }
  }
  const succeeded = genericState.state === "completed"
    && smokeFinalization?.status === "stage4_v2_controlled_smoke_passed"
    && finalizationEvidenceError === null;
  const nextMachineAction = succeeded ? FORMAL_PLAN_ACTION : FAILURE_ACTION;
  const completedAtUtc = genericTerminal.recordedAtUtc;
  const failureKind = succeeded ? null
    : finalizationEvidenceError ? "evidence"
    : genericTerminal.finalResult?.failureKind
      ?? (smokeFinalization?.status === "stage4_v2_controlled_smoke_real_visual_failure"
        ? "visual" : "evidence");
  const failureCode = succeeded ? null
    : finalizationEvidenceError ? "stage4_v2_smoke_finalization_evidence_conflict"
    : genericTerminal.finalResult?.failureCode
      ?? smokeFinalization?.status
      ?? genericTerminal.failureCode
      ?? "stage4_v2_controlled_smoke_unknown_failure";
  const terminal = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-terminal-v1",
    executionState: succeeded ? "completed" : "failed_closed",
    status: succeeded
      ? "stage4_v2_controlled_smoke_passed"
      : "stage4_v2_controlled_smoke_failed_closed",
    packageId: payload.packageId,
    runId: payload.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageManifest: materializationTerminal.packageManifest,
    packagePayload: smokeManifest.packagePayload,
    programGraphManifest: smokeManifest.programGraphManifest,
    autonomousClosedLoopTerminal: genericTerminalBinding,
    smokeFinalization: smokeFinalizationBinding,
    resourceTelemetry: smokeFinalization?.resourceTelemetry ?? null,
    failureKind,
    failureCode,
    finalizationEvidenceError: finalizationEvidenceError
      ? String(finalizationEvidenceError.message ?? finalizationEvidenceError) : null,
    nextMachineAction,
    ownerAuthorizationRequired: false,
    automaticSuccessorAllowed: true,
    formalTrainingStarted: false,
    recordedAtUtc: completedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(completedAtUtc),
  };
  const terminalPath = path.join(packageRoot, "execution-terminal.json");
  writeOrVerifyJson(terminalPath, terminal);
  const terminalBinding = bindAbsolute(root, terminalPath);
  let lifecyclePublication = null;
  if (succeeded) {
    const lifecycleResult = reconcileControlledSmokeLifecycle(
      root, terminalBinding, completedAtUtc,
    );
    lifecyclePublication = persistStage4V2LifecyclePublication({
      projectRoot: root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      expectedState: "controlled_smoke_completed",
      expectedEvidenceStatus: "passed",
      sourceTerminalBinding: terminalBinding,
      lifecycleResult,
      receiptPath: path.join(packageRoot,
        "controlled-smoke-lifecycle-publication.json"),
      requireLifecycleTerminal: false,
      _testHooks,
    });
  }
  const capsule = {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${payload.runId}-controlled-smoke-terminal`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-stage4-v2", nameZh: "AI Painter Stage4 V2" },
    fixedOverallProgress: {
      completedStages: 3, totalStages: 5, percent: 60,
      source: "current_execution_registry",
    },
    currentStage: {
      number: 4, total: 5, labelZh: "Stage 0→1→2完整训练",
      status: terminal.status,
    },
    candidateTerminal: {
      runId: payload.runId, status: terminal.status, recordedAtUtc: completedAtUtc,
    },
    latestBlocker: succeeded ? null : {
      code: smokeFinalization?.status ?? genericState.failureCode ?? "controlled_smoke_failed",
      summaryZh: "受控Smoke已失败关闭；本地程序将依据本包既有证据执行只读责任边界裁决。",
    },
    nextAllowedAction: {
      code: nextMachineAction,
      labelZh: succeeded
        ? "物化同一V2路线的Stage 0→Stage 1→Stage 2正式训练闭环。"
        : "仅依据本次Smoke证据执行CPU只读失败边界裁决。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
    },
    forbiddenActions: [
      "reuse_ticket_run_or_output", "read_historical_or_failed_denoiser_checkpoint",
      "lower_machine_review_threshold", "automatic_smoke_retry",
    ],
    taskIdentity: {
      modelId: STAGE4_V2_CAPABILITY, sampleId: payload.fixedInputs.sampleId,
      sampleSplit: payload.fixedInputs.sampleSplit, seed: payload.fixedInputs.seed,
    },
    latestTerminal: terminalBinding,
    evidence: [genericTerminalBinding, smokeFinalizationBinding].filter(Boolean).map(
      (binding, index) => ({ kind: `controlled_smoke_terminal_evidence_${index + 1}`, ...binding, sha256Verified: true }),
    ),
    integrity: {
      status: "verified", requiredEvidencePresent: true,
      boundEvidenceVerified: true, identityMatches: true,
    },
  };
  const capsulePath = path.join(packageRoot, "execution-task-capsule.json");
  writeOrVerifyJson(capsulePath, capsule);
  const capsuleBinding = bindAbsolute(root, capsulePath);
  const eventInput = {
    id: `stage4-v2-controlled-smoke-terminal-${payload.runId}`,
    timestamp: completedAtUtc,
    action: succeeded
      ? "stage4_v2_controlled_smoke_passed"
      : "stage4_v2_controlled_smoke_failed_closed",
    runId: payload.runId,
    kind: "controlled_smoke_terminal",
    status: succeeded ? "success" : "failed",
    title: succeeded ? "Stage4 V2受控Smoke通过" : "Stage4 V2受控Smoke失败关闭",
    titleZh: succeeded ? "Stage4 V2受控Smoke通过" : "Stage4 V2受控Smoke失败关闭",
    detailZh: succeeded
      ? "训练、机器审核、因果裁决和终态记录已在同一执行包内完成。"
      : "程序已保存训练、审核或程序失败证据，并进入自动只读失败边界裁决。",
    evidencePath: terminalBinding.path,
    evidenceSha256: terminalBinding.sha256,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  };
  const externalDependencies = appendProgramEvent ? commitStage4V2ExternalRegistryDependencies({
    projectRoot: root,
    journalPath: path.join(packageRoot,
      "execution-terminal-registry-dependency-journal.json"),
    journalSchemaVersion:
      "ai-painter-stage4-v2-controlled-smoke-terminal-registry-dependency-journal-v1",
    operationId: `stage4-v2-smoke-terminal-registry-${payload.runId}`,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: payload.packageId,
    runId: payload.runId,
    recordedAtUtc: completedAtUtc,
    bindings: [
      { role: "controlled_smoke_terminal", ...terminalBinding },
      { role: "controlled_smoke_capsule", ...capsuleBinding },
      { role: "controlled_smoke_closed_loop_terminal", ...genericTerminalBinding },
      ...(smokeFinalizationBinding
        ? [{ role: "controlled_smoke_finalization", ...smokeFinalizationBinding }]
        : []),
      ...(lifecyclePublication ? [
        {
          role: "controlled_smoke_lifecycle_publication_state",
          ...lifecyclePublication.receiptBinding,
        },
        {
          role: "controlled_smoke_lifecycle_evidence",
          ...lifecyclePublication.evidenceBinding,
        },
      ] : []),
    ],
    eventInput,
    _testHooks,
  }) : null;
  let registryCommit = null;
  if (commitCurrentRegistry) {
    assert.ok(externalDependencies,
      "current registry publication requires committed external dependencies");
    const latest = await readCurrentExecutionRegistry(root);
    assert.equal(latest.ok, true, latest.errorCode ?? "current registry invalid");
    registryCommit = await advanceCurrentExecutionRegistry({
      projectRoot: root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: payload.packageId,
      taskId: succeeded ? FORMAL_PLAN_TASK : FAILURE_TASK,
      taskKind: succeeded ? "formal_training_planning" : "cpu_readonly_adjudication",
      taskGoal: succeeded
        ? "Materialize the same V2 route Stage 0 through Stage 2 formal training closed loop."
        : "Classify the saved controlled-Smoke failure boundary without retrying training.",
      priority: 1,
      queueStatus: "ready",
      nextMachineAction,
      queuedAtUtc: completedAtUtc,
      runId: payload.runId,
      lifecycleStage: succeeded ? "controlled_smoke_completed" : "readonly_gpu_qualified",
      executionState: "package_materialized",
      activity: succeeded
        ? "stage4_v2_formal_stage0_to_stage2_planning_ready"
        : "stage4_v2_controlled_smoke_failure_adjudication_ready",
      taskCapsulePath: capsuleBinding.path,
      terminalEvidencePath: terminalBinding.path,
      activeExecution: null,
      expectedPreviousRegistryRevision: latest.registry.registryRevision,
      expectedPreviousRegistrySha256: latest.registrySha256,
      dependencyManifest: externalDependencies.dependencyManifest,
    });
  }
  const localContinuation = commitCurrentRegistry
    ? await successorInvoker({ projectRoot: root, nextMachineAction })
    : null;
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-execution-result-v1",
    executionState: terminal.executionState,
    status: terminal.status,
    packageId: payload.packageId,
    runId: payload.runId,
    terminal: terminalBinding,
    lifecyclePublication: lifecyclePublication?.receiptBinding ?? null,
    nextMachineAction,
    localContinuation,
    registryRevision: registryCommit?.registry?.registryRevision ?? null,
    ownerAuthorizationRequired: false,
  });
}

export async function invokeStage4V2SmokeSuccessor({
  projectRoot = process.cwd(), nextMachineAction,
} = {}) {
  if (nextMachineAction === FORMAL_PLAN_ACTION) {
    const module = await import("./plan-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs");
    return module.materializeStage4V2FormalStage0ToStage2Plan({ projectRoot });
  }
  if (nextMachineAction === FAILURE_ACTION) {
    const module = await import("./adjudicate-ai-painter-stage4-v2-controlled-smoke-failure-boundary.mjs");
    return module.adjudicateStage4V2ControlledSmokeFailureBoundary({ projectRoot });
  }
  throw new Error(`unsupported controlled-Smoke successor: ${nextMachineAction}`);
}

export async function recoverInterruptedSmokeToMaterialized({
  root,
  packageManifestBinding,
  now = () => new Date(),
  externalDependencyCommitter = commitStage4V2ExternalRegistryDependencies,
  _testHooks = null,
} = {}) {
  const currentPath = resolveProjectPath(root, CURRENT_EXECUTION_REGISTRY_PATH, {
    mustExist: true, kind: "file",
  });
  const staleBinding = bindAbsolute(root, currentPath);
  const stale = readJsonObject(currentPath);
  const staleRegistryEvidence = captureImmutableCurrentRegistryEvidence({
    projectRoot: root,
    current: {
      ok: true,
      registrySha256: staleBinding.sha256,
      registry: stale,
    },
  });
  assert.equal(stale.capabilityVersion, STAGE4_V2_CAPABILITY,
    "stale Smoke capability differs");
  assert.equal(stale.taskId, SMOKE_RUN_TASK, "stale execution is not the V2 Smoke");
  assert.ok(stale.activeExecution, "stale Smoke has no active execution");
  assert.equal(stale.activeExecution.packageId, stale.packageId);
  assert.equal(stale.activeExecution.runId, stale.runId);
  const sourceTerminal = readBoundJson(root, stale.terminalEvidence);
  assert.equal(sourceTerminal.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-materialization-terminal-v1");
  assert.equal(sourceTerminal.packageManifest.path, packageManifestBinding.path);
  assert.equal(sourceTerminal.packageManifest.sha256, packageManifestBinding.sha256);
  const packageRoot = path.dirname(resolveProjectPath(root, packageManifestBinding.path, {
    mustExist: true, kind: "file",
  }));
  const recoveryRoot = path.join(packageRoot, "host-interruption-recoveries",
    `registry-revision-${stale.registryRevision}`);
  fs.mkdirSync(recoveryRoot, { recursive: true });
  const journalPath = path.join(recoveryRoot, "recovery-journal.json");
  let journal;
  if (fs.existsSync(journalPath)) journal = readJsonObject(journalPath);
  else {
    const recordedAtUtc = now().toISOString();
    journal = {
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-host-recovery-journal-v1",
      status: "stale_active_execution_identified",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: stale.packageId,
      runId: stale.runId,
      staleRegistry: {
        registryRevision: stale.registryRevision,
        transaction: staleRegistryEvidence.transaction,
        snapshot: staleRegistryEvidence.snapshot,
      },
      resumeTaskCapsule: stale.taskCapsule,
      resumeTerminalEvidence: stale.terminalEvidence,
      trainingReplayAllowed: false,
      recordedAtUtc,
    };
    writeExclusiveJson(journalPath, journal);
  }
  assert.deepEqual(journal.staleRegistry.transaction,
    staleRegistryEvidence.transaction,
  "host recovery journal binds another stale registry transaction");
  assert.deepEqual(journal.staleRegistry.snapshot,
    staleRegistryEvidence.snapshot,
  "host recovery journal binds another stale registry snapshot");
  validateImmutableCurrentRegistryEvidence({
    projectRoot: root,
    transaction: journal.staleRegistry.transaction,
    snapshot: journal.staleRegistry.snapshot,
    expectedRegistry: stale,
    expectedCurrentSha256: staleBinding.sha256,
  });
  const staleLock = bindAbsolute(root, resolveProjectPath(
    root, stale.activeExecution.lock.path, { mustExist: true, kind: "file" },
  ));
  assert.equal(staleLock.sha256, stale.activeExecution.lock.sha256,
    "stale Smoke lock changed");
  const staleHeartbeat = bindAbsolute(root, resolveProjectPath(
    root, stale.activeExecution.heartbeat.path, { mustExist: true, kind: "file" },
  ));
  const recoveryTerminal = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-host-recovery-terminal-v1",
    executionState: "failed_closed",
    status: "stage4_v2_controlled_smoke_host_interruption_recovered_for_resume",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: stale.packageId,
    runId: stale.runId,
    staleRegistry: journal.staleRegistry,
    staleLock,
    staleHeartbeat,
    resumeTaskCapsule: journal.resumeTaskCapsule,
    resumeTerminalEvidence: journal.resumeTerminalEvidence,
    genericClosedLoopWillResumePassedPrefix: true,
    ticketWillNotBeReissued: true,
    completedTrainingPhaseWillNotBeReplayed: true,
    inProgressTrainingWillNotBeAutomaticallyRetried: true,
    ownerAuthorizationRequired: false,
    recordedAtUtc: journal.recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(journal.recordedAtUtc),
  };
  const recoveryTerminalPath = path.join(recoveryRoot, "terminal.json");
  writeOrVerifyJson(recoveryTerminalPath, recoveryTerminal);
  const recoveryTerminalBinding = bindAbsolute(root, recoveryTerminalPath);
  const recoveryCapsule = {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${stale.runId}-smoke-host-recovery-${stale.registryRevision}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-stage4-v2", nameZh: "AI Painter Stage4 V2" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: recoveryTerminal.status },
    candidateTerminal: { runId: stale.runId, status: recoveryTerminal.status, recordedAtUtc: journal.recordedAtUtc },
    latestBlocker: { code: "host_interruption", summaryZh: "本地后台进程已中断；程序保留原证据并从闭环已完成前缀恢复。" },
    nextAllowedAction: { code: SMOKE_BACKGROUND_LAUNCH_ACTION, labelZh: "恢复同一受控Smoke后台闭环；不得重新签发票据或重训已通过阶段。", ownerAuthorizationRequired: false, automaticExecutionAllowed: true },
    forbiddenActions: ["reissue_smoke_ticket", "retrain_passed_phase", "reuse_historical_output"],
    taskIdentity: { modelId: STAGE4_V2_CAPABILITY, runId: stale.runId },
    latestTerminal: recoveryTerminalBinding,
    evidence: [
      staleRegistryEvidence.transaction,
      staleRegistryEvidence.snapshot,
      staleLock,
      staleHeartbeat,
      recoveryTerminalBinding,
    ].map((binding, index) => ({
      kind: `host_recovery_evidence_${index + 1}`,
      ...binding,
      sha256Verified: true,
    })),
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true },
  };
  const recoveryCapsulePath = path.join(recoveryRoot, "task-capsule.json");
  writeOrVerifyJson(recoveryCapsulePath, recoveryCapsule);
  const recoveryCapsuleBinding = bindAbsolute(root, recoveryCapsulePath);
  const recoveryDependencies = externalDependencyCommitter({
    projectRoot: root,
    journalPath: path.join(recoveryRoot,
      "failed-closed-registry-dependency-journal.json"),
    journalSchemaVersion:
      "ai-painter-stage4-v2-controlled-smoke-host-recovery-registry-dependency-journal-v1",
    operationId: `stage4-v2-smoke-host-recovery-${stale.runId}-${stale.registryRevision}`,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: stale.packageId,
    runId: stale.runId,
    recordedAtUtc: journal.recordedAtUtc,
    bindings: [
      { role: "stale_registry_transaction", ...staleRegistryEvidence.transaction },
      { role: "stale_registry_snapshot", ...staleRegistryEvidence.snapshot },
      { role: "stale_smoke_lock", ...staleLock },
      { role: "stale_smoke_heartbeat", ...staleHeartbeat },
      { role: "smoke_host_recovery_terminal", ...recoveryTerminalBinding },
      { role: "smoke_host_recovery_capsule", ...recoveryCapsuleBinding },
    ],
    eventInput: {
      id: `stage4-v2-controlled-smoke-host-interruption-${stale.runId}-${stale.registryRevision}`,
      timestamp: journal.recordedAtUtc,
      action: "stage4_v2_controlled_smoke_host_interruption_failed_closed",
      runId: stale.runId,
      kind: "controlled_smoke_host_recovery",
      status: "failed",
      title: "Stage4 V2 controlled Smoke host interruption recorded",
      titleZh: "Stage4 V2受控Smoke后台中断已记录",
      detailZh: "旧进程与过期心跳已核验；恢复终态已保存，未重复启动训练。",
      evidencePath: recoveryTerminalBinding.path,
      evidenceSha256: recoveryTerminalBinding.sha256,
      fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    },
    _testHooks,
  });
  const recovered = await recoverExpiredActiveExecutionToFailedClosed({
    projectRoot: root,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: stale.packageId,
    runId: stale.runId,
    taskCapsulePath: recoveryCapsuleBinding.path,
    terminalEvidencePath: recoveryTerminalBinding.path,
    expectedPreviousRegistryRevision: stale.registryRevision,
    expectedPreviousRegistrySha256: staleBinding.sha256,
    dependencyManifest: recoveryDependencies.dependencyManifest,
    _testHooks,
  });
  return restoreRecoveredSmokeMaterialization({
    root,
    current: recovered,
    externalDependencyCommitter,
  });
}

async function restoreRecoveredSmokeMaterialization({
  root,
  current,
  externalDependencyCommitter = commitStage4V2ExternalRegistryDependencies,
}) {
  assert.equal(current.ok ?? true, true,
    current.errorCode ?? "host recovery registry is invalid");
  const registry = current.registry;
  const terminal = current.currentTaskTerminal
    ?? readBoundJson(root, registry.terminalEvidence);
  assert.equal(terminal.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-host-recovery-terminal-v1");
  validateImmutableCurrentRegistryEvidence({
    projectRoot: root,
    transaction: terminal.staleRegistry.transaction,
    snapshot: terminal.staleRegistry.snapshot,
  });
  const restoreDependencies = externalDependencyCommitter({
    projectRoot: root,
    journalPath: path.join(path.dirname(resolveProjectPath(
      root, registry.terminalEvidence.path, { mustExist: true, kind: "file" },
    )), "restore-materialization-registry-dependency-journal.json"),
    journalSchemaVersion:
      "ai-painter-stage4-v2-controlled-smoke-restore-registry-dependency-journal-v1",
    operationId: `stage4-v2-smoke-host-restored-${registry.runId}-${terminal.staleRegistry.registryRevision}`,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: registry.packageId,
    runId: registry.runId,
    recordedAtUtc: terminal.recordedAtUtc,
    bindings: [
      { role: "smoke_host_recovery_terminal", ...registry.terminalEvidence },
      { role: "smoke_resume_task_capsule", ...terminal.resumeTaskCapsule },
      { role: "smoke_resume_materialization_terminal", ...terminal.resumeTerminalEvidence },
    ],
    eventInput: {
    id: `stage4-v2-controlled-smoke-host-recovered-${registry.runId}-${terminal.staleRegistry.registryRevision}`,
    timestamp: terminal.recordedAtUtc,
    action: "stage4_v2_controlled_smoke_host_interruption_recovered",
    runId: registry.runId,
    kind: "controlled_smoke_host_recovery",
    status: "success",
    title: "Stage4 V2受控Smoke后台中断已恢复",
    titleZh: "Stage4 V2受控Smoke后台中断已恢复",
    detailZh: "旧进程与过期心跳已核验；同包闭环仅恢复未完成阶段，不重新签发票据或重训已完成阶段。",
    evidencePath: registry.terminalEvidence.path,
    evidenceSha256: registry.terminalEvidence.sha256,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    },
  });
  assert.equal(restoreDependencies.eventCommit.event.id.startsWith(
    "stage4-v2-controlled-smoke-host-recovered-"), true);
  return advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: registry.packageId,
    taskId: SMOKE_RUN_TASK,
    taskKind: "controlled_smoke",
    taskGoal: "Resume the same V2 controlled Smoke from its durable closed-loop phase prefix.",
    priority: 1,
    queueStatus: "ready",
    nextMachineAction: SMOKE_BACKGROUND_LAUNCH_ACTION,
    queuedAtUtc: terminal.recordedAtUtc,
    runId: registry.runId,
    lifecycleStage: "readonly_gpu_qualified",
    executionState: "package_materialized",
    activity: "stage4_v2_controlled_smoke_host_recovered_ready",
    taskCapsulePath: terminal.resumeTaskCapsule.path,
    terminalEvidencePath: terminal.resumeTerminalEvidence.path,
    activeExecution: null,
    expectedPreviousRegistryRevision: registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
    dependencyManifest: restoreDependencies.dependencyManifest,
  });
}

function nextExecutionAttempt(packageRoot) {
  const pattern = /^active-execution-attempt-(\d+)-lock\.json$/u;
  let maximum = 0;
  for (const name of fs.readdirSync(packageRoot)) {
    const match = pattern.exec(name);
    if (match) maximum = Math.max(maximum, Number(match[1]));
  }
  return maximum + 1;
}

export function validateOuterFinalizationChain({
  root, payload, genericTerminal, smokeFinalizationBinding,
}) {
  const finalResultBinding = genericTerminal.finalResult?.finalization;
  assert.deepEqual(finalResultBinding, smokeFinalizationBinding,
    "closed-loop final phase does not bind the outer Smoke finalization");
  const finalization = readBoundJson(root, smokeFinalizationBinding);
  assert.equal(finalization.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-finalization-v1");
  assert.equal(finalization.packageId, payload.packageId);
  assert.equal(finalization.runId, payload.runId);
  for (const [label, binding] of [
    ["trainingManifest", finalization.trainingManifest],
    ["machineReview", finalization.machineReview],
    ["reviewExecutionBinding", finalization.reviewExecutionBinding],
    ["reviewPhaseEvidence", finalization.reviewPhaseEvidence],
    ["causalAdjudication", finalization.causalAdjudication],
    ["adjudicationPhaseEvidence", finalization.adjudicationPhaseEvidence],
    ["resourceTelemetry", finalization.resourceTelemetry],
  ]) {
    validateBinding(binding, `finalization.${label}`);
    assert.equal(sha256File(resolveProjectPath(root, binding.path, {
      mustExist: true, kind: "file",
    })), binding.sha256, `finalization ${label} changed`);
  }
  const causal = readBoundJson(root, finalization.causalAdjudication);
  assert.deepEqual(causal.sourceMachineReview, finalization.machineReview,
    "causal adjudication consumed another machine review");
  assert.deepEqual(causal.sourceReviewExecutionBinding,
    finalization.reviewExecutionBinding,
    "causal adjudication consumed another review execution binding");
  assert.deepEqual(causal.sourceReviewPhaseEvidence, finalization.reviewPhaseEvidence,
    "causal adjudication consumed another review phase evidence");
  const adjudicationPhase = readBoundJson(root, finalization.adjudicationPhaseEvidence);
  assert.deepEqual(adjudicationPhase.result?.adjudication,
    finalization.causalAdjudication,
    "finalization did not consume the passed adjudication phase output");
  const reviewPhase = readBoundJson(root, finalization.reviewPhaseEvidence);
  assert.deepEqual(reviewPhase.result?.machineReview, finalization.machineReview,
    "finalization did not transitively consume the passed review output");
  return finalization;
}

function verifyMaterializedCurrent(current) {
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
  assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(current.registry.taskId, SMOKE_RUN_TASK);
  assert.equal(current.registry.nextMachineAction, SMOKE_BACKGROUND_LAUNCH_ACTION);
  assert.equal(current.registry.lifecycleStage, "readonly_gpu_qualified");
  assert.equal(current.registry.executionState, "package_materialized");
  assert.equal(current.currentTaskTerminal?.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-materialization-terminal-v1");
}

function heartbeatRecord(payload, processStartIdentity, executionState, now) {
  return {
    schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: payload.packageId,
    runId: payload.runId,
    executionState,
    processId: process.pid,
    processStartIdentity,
    heartbeatAtUtc: now.toISOString(),
    ttlSeconds: HEARTBEAT_TTL_SECONDS,
  };
}

function reconcileControlledSmokeLifecycle(root, terminalBinding, recordedAtUtc) {
  const statePath = resolveProjectPath(root, `${LIFECYCLE_ROOT}/state.json`, {
    mustExist: true, kind: "file",
  });
  const state = readJsonObject(statePath);
  if (state.state === "readonly_gpu_qualified") {
    return advanceCapabilityLifecycle({
      root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      targetState: "controlled_smoke_completed",
      evidence: {
        schemaVersion: "ai-painter-capability-stage-evidence-v1",
        capabilityVersion: STAGE4_V2_CAPABILITY,
        targetState: "controlled_smoke_completed",
        status: "passed",
        bindings: [terminalBinding],
      },
      recordedAtUtc,
    });
  }
  assert.equal(state.state, "controlled_smoke_completed",
    `V2 lifecycle conflict: ${state.state}`);
  assert.ok(state.latestEvidence?.path, "controlled-Smoke lifecycle evidence is missing");
  const evidence = readJsonObject(path.join(path.dirname(statePath), state.latestEvidence.path));
  assert.ok(evidence.bindings.some((binding) => binding.path === terminalBinding.path
    && binding.sha256 === terminalBinding.sha256),
  "controlled-Smoke lifecycle evidence differs from execution terminal");
  return state;
}

function queryCurrentProcessStartIdentity() {
  if (process.platform === "win32") {
    const command = [
      "$ErrorActionPreference='Stop'",
      `$p=Get-CimInstance -ClassName Win32_Process -Filter \"ProcessId = ${process.pid}\" -ErrorAction Stop`,
      "if ($null -eq $p) { exit 3 }",
      "$o=[pscustomobject]@{ processId=[int]$p.ProcessId; creationDate=$p.CreationDate.ToUniversalTime().ToString('o') }",
      "ConvertTo-Json -InputObject $o -Compress",
    ].join("; ");
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command", command,
    ], { encoding: "utf8", windowsHide: true, timeout: 10_000 });
    assert.equal(result.error, undefined, "current process WMI identity query failed");
    assert.equal(result.status, 0, "current process WMI identity query failed");
    const value = JSON.parse(String(result.stdout).replace(/^\uFEFF/u, ""));
    return `${process.pid}:${value.creationDate}`;
  }
  const result = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {
    encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.status, 0, "current process start query failed");
  return `${process.pid}:${String(result.stdout).trim()}`;
}

function writeOrVerifyJson(target, value) {
  if (!fs.existsSync(target)) {
    writeExclusiveJson(target, value);
    return;
  }
  assert.deepEqual(readJsonObject(target), value,
    `immutable execution evidence conflicts: ${target}`);
}

function parseCli(args) {
  const value = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
  };
  const parsed = {
    packageManifest: value("--package-manifest"),
    packageManifestSha256: value("--package-manifest-sha256"),
    launchIntent: value("--launch-intent"),
    launchIntentSha256: value("--launch-intent-sha256"),
  };
  assert.ok(Object.values(parsed).every((item) => typeof item === "string" && item.length > 0),
    "Smoke runner requires package-manifest and launch-intent path/SHA bindings");
  return parsed;
}

function validateBinding(binding, label) {
  assert.ok(binding && typeof binding.path === "string"
    && /^[a-f0-9]{64}$/u.test(binding.sha256 ?? ""), `${label} is invalid`);
}
