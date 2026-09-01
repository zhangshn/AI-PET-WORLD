import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
  recoverExpiredActiveExecutionToFailedClosed,
  recoverPreparedCurrentExecutionRegistryAdvance,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import { catalogPath } from "./lib/ai-pet-world-storage.mjs";
import {
  buildStage4V2ExternalRegistryDependencyManifest,
} from "./lib/ai-painter-stage4-v2-external-registry-dependency-v1.mjs";
import {
  captureImmutableCurrentRegistryEvidence,
  validateImmutableCurrentRegistryEvidence,
} from "./lib/ai-painter-immutable-current-registry-evidence-v1.mjs";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
} from "./lib/ai-painter-program-event-store.mjs";
import {
  MATERIALIZED_RUN_ACTION,
  MATERIALIZED_RUN_TASK,
} from "./plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
import {
  validateStage4V2QualificationProgramGraph,
} from "./lib/ai-painter-program-graph-manifest-v1.mjs";
import {
  validateStage4V2BackgroundLaunchIntent,
} from "./launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs";
import {
  continueStage4V2AfterReadonlyGpuQualification,
} from "./lib/ai-painter-stage4-v2-qualification-continuation-v1.mjs";
import {
  reconcileStage4V2ReadonlyGpuQualifiedLifecycle,
  verifyStage4V2ReadonlyGpuQualifiedLifecycle,
} from "./lib/ai-painter-stage4-v2-qualification-lifecycle-v1.mjs";
import {
  STAGE4_V2_CAPABILITY,
  bindProjectFile,
  closeStage4V2UnconsumedQualificationTicket,
  consumeStage4V2QualificationTicket,
  projectLogicalPath,
  readJsonObject,
  recoverStage4V2QualificationTicketConsumption,
  resolveProjectPath,
  sha256File,
  validateStage4V2PreReleaseQualificationTicket,
  writeExclusiveJson,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const PYTHON_RELATIVE = "ml/ai-painter/.venv/Scripts/python.exe";
const PYTHON_RUNNER_ROLE = "pythonRunner";
const QUALIFICATION_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVE_EXECUTION_HEARTBEAT_TTL_SECONDS = 60;
const ACTIVE_EXECUTION_HEARTBEAT_INTERVAL_MS = 10_000;
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const MINIMUM_FREE_DISK_BYTES = 20 * 1024 ** 3;
const MINIMUM_FREE_GPU_MEMORY_MIB = 4096;
const MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT = 10;
const MAXIMUM_NONQUALIFICATION_GPU_MEMORY_MIB = 3000;
const MAXIMUM_IDLE_PROCESS_SM_UTILIZATION_PERCENT = 10;
const QUALIFICATION_PARAMETER_TENSOR_COUNT = 210;
const QUALIFICATION_PARAMETER_SCALAR_COUNT = 4_743_755;
const QUALIFICATION_SHARED_PARAMETER_TENSOR_COUNT = 98;
const QUALIFICATION_RESPONSIBILITY_PATH_TENSOR_COUNT = 12;
const QUALIFICATION_RGB_HEAD_TENSOR_COUNT = 4;
const QUALIFICATION_AUTOENCODER_PARAMETER_TENSOR_COUNT = 64;
const QUALIFICATION_AUTOENCODER_PARAMETER_SCALAR_COUNT = 2_527_887;
const FAILURE_TASK = "adjudicate_stage4_v2_readonly_gpu_qualification_failure";
const FAILURE_ACTION = "adjudicate:ai-painter-stage4-v2-readonly-gpu-qualification-failure";
const SMOKE_TASK = "materialize_stage4_v2_controlled_smoke_contract";
const SMOKE_ACTION = "plan:ai-painter-stage4-v2-controlled-smoke";

const COMPUTE_RISK_TOKENS = Object.freeze([
  "python", "pythonw", "torch", "torchrun", "pytorch", "train", "accelerate",
  "deepspeed", "jupyter", "cuda", "blender", "render", "comfy", "ollama", "diffusion",
]);
const KNOWN_WINDOWS_GRAPHICS_PROCESSES = new Set([
  "applicationframehost.exe", "chatgpt.exe", "chrome.exe", "code.exe", "crossdeviceresume.exe",
  "dwm.exe", "explorer.exe", "logioptionsplus_agent.exe", "msedgewebview2.exe", "notepad.exe",
  "nvcontainer.exe", "nvidia overlay.exe", "phoneexperiencehost.exe", "qq.exe", "searchhost.exe",
  "shellexperiencehost.exe", "shellhost.exe", "startmenuexperiencehost.exe", "systemsettings.exe",
  "tabtip.exe", "textinputhost.exe", "v2rayn.exe",
]);
const UNKNOWN_NVIDIA_NAMES = new Set([
  "", "[insufficient permissions]", "insufficient permissions", "[unknown]", "unknown", "[n/a]", "n/a",
]);

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const cli = parseQualificationCli(process.argv.slice(2));
  runStage4V2ReadonlyGpuQualification({
    projectRoot: process.cwd(),
    packageManifestPath: cli.packageManifestPath,
    packageManifestSha256: cli.packageManifestSha256,
    backgroundLaunchIntentBinding: cli.backgroundLaunchIntentBinding,
    requireBackgroundLaunch: true,
  }).then(async (result) => {
    // This process was itself started by the detached local launcher.  Keep the
    // successor dispatch in the same local background chain so a successful
    // qualification reaches Smoke planning + detached Smoke launch, while a
    // failure reaches the read-only adjudicator, without a chat/Codex wake-up.
    const continuation = await continueStage4V2AfterReadonlyGpuQualification({
      projectRoot: process.cwd(),
      qualificationResult: result,
    });
    process.stdout.write(`${JSON.stringify({ ...result, localContinuation: continuation }, null, 2)}\n`);
    if (result.executionState === "failed_closed") process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function runStage4V2ReadonlyGpuQualification({
  projectRoot = process.cwd(),
  packageManifestPath = null,
  packageManifestSha256 = null,
  backgroundLaunchIntentBinding = null,
  requireBackgroundLaunch = false,
  commandRunner = spawnSync,
  commitCurrentRegistry = true,
  appendProgramEvent = true,
  now = () => new Date(),
  qualificationInvoker = invokePythonQualification,
  currentRegistryReader = readCurrentExecutionRegistry,
  interruptedRecoveryHandler = recoverInterruptedQualification,
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  const context = {
    root,
    current: null,
    packagePayload: null,
    manifest: null,
    ticket: null,
    paths: null,
    preflightCreated: false,
    ticketConsumed: false,
    outputCreated: false,
    activeExecutionRegistered: false,
    activeLease: null,
    heartbeatTimer: null,
    heartbeatError: null,
    outerJournal: null,
  };
  try {
    const current = await currentRegistryReader(root);
    if (
      current.ok !== true
      && [
        "registry_active_execution_heartbeat_expired",
        "registry_active_execution_process_not_active",
        "registry_active_execution_process_start_identity_mismatch",
      ].includes(current.errorCode)
    ) {
      return await interruptedRecoveryHandler({
        root,
        packageManifestPath,
        appendProgramEvent,
        now,
        _testHooks,
      });
    }
    assert.equal(current.ok, true, current.errorCode ?? "current execution registry is not verified");
    verifyMaterializedRegistry(current);
    context.current = current;
    const materializationTerminal = current.currentTaskTerminal;
    assert.equal(materializationTerminal.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-materialization-terminal-v1");
    assert.equal(materializationTerminal.status, "stage4_v2_readonly_gpu_qualification_package_materialized");
    assert.equal(materializationTerminal.executionState, "completed");
    assert.equal(materializationTerminal.ownerAuthorizationRequired, false);
    const manifestBinding = materializationTerminal.manifest;
    if (packageManifestPath !== null) {
      assert.equal(normalizeLogicalPath(root, packageManifestPath), manifestBinding.path,
        "explicit package manifest is not the current registered package");
    }
    if (packageManifestSha256 !== null) {
      assert.equal(packageManifestSha256, manifestBinding.sha256,
        "explicit package manifest SHA-256 mismatch");
    }
    bindProjectFile(root, manifestBinding.path, manifestBinding.sha256);
    const manifest = readProjectJson(root, manifestBinding.path);
    verifyPackageManifest(manifest, current.registry);
    context.manifest = manifest;
    const packagePayload = readBoundProjectJson(root, manifest.packagePayload);
    const ticket = readBoundProjectJson(root, manifest.preReleaseQualificationTicket);
    context.packagePayload = packagePayload;
    context.ticket = ticket;
    validatePackagePayload(packagePayload, manifest);
    assert.deepEqual(
      packagePayload.programGraphManifest,
      manifest.programGraphManifest,
      "qualification payload/manifest program graph binding mismatch",
    );
    validateStage4V2QualificationProgramGraph({
      projectRoot: root,
      manifestBinding: packagePayload.programGraphManifest,
      programLineage: packagePayload.programLineage,
    });
    const ticketValidation = validateStage4V2PreReleaseQualificationTicket({
      projectRoot: root,
      ticket,
      packagePayload,
      verifyEvidence: true,
      nowUtc: now().toISOString(),
    });
    assert.equal(
      ticketValidation.issuer.protectedPrivateKey?.protectionScheme,
      "windows_dpapi_local_machine_v1",
      "formal qualification ticket issuer is not protected by Windows DPAPI LocalMachine",
    );
    if (requireBackgroundLaunch) {
      validateStage4V2BackgroundLaunchIntent({
        projectRoot: root,
        launchIntentBinding: backgroundLaunchIntentBinding,
        packageManifestBinding: manifestBinding,
        packagePayloadBinding: manifest.packagePayload,
        signedTicketBinding: manifest.preReleaseQualificationTicket,
        packagePayload,
      });
    } else if (backgroundLaunchIntentBinding !== null) {
      validateStage4V2BackgroundLaunchIntent({
        projectRoot: root,
        launchIntentBinding: backgroundLaunchIntentBinding,
        packageManifestBinding: manifestBinding,
        packagePayloadBinding: manifest.packagePayload,
        signedTicketBinding: manifest.preReleaseQualificationTicket,
        packagePayload,
      });
    }
    verifyProgramLineageRoles(packagePayload.programLineage);
    assert.equal(fs.existsSync(resolveProjectPath(root, packagePayload.outputDirectory)), false,
      "qualification output directory reuse is forbidden");
    assert.equal(fs.existsSync(resolveProjectPath(root, packagePayload.preflightDirectory)), false,
      "qualification preflight directory reuse is forbidden");

    const preflightRoot = resolveProjectPath(root, packagePayload.preflightDirectory);
    fs.mkdirSync(path.dirname(preflightRoot), { recursive: true });
    fs.mkdirSync(preflightRoot, { recursive: false });
    context.preflightCreated = true;
    const paths = buildExecutionPaths({ root, packagePayload, preflightRoot });
    context.paths = paths;
    context.outerJournal = initializeQualificationOuterJournal({
      paths,
      packagePayload,
      current,
      now,
    });

    const resource = runResourcePreflight({ root, commandRunner, now });
    const cpu = runCpuAndProgramPreflight({ root, packagePayload, commandRunner, now });
    const pythonCuda = runPythonCudaPreflight({ root, commandRunner, now });
    const preflight = {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-preflight-report-v1",
      status: "passed_ticket_not_consumed_gpu_workload_not_started",
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      packageManifest: manifestBinding,
      packagePayload: manifest.packagePayload,
      signedTicket: manifest.preReleaseQualificationTicket,
      cpu,
      pythonCuda,
      resources: resource,
      outputDirectory: packagePayload.outputDirectory,
      outputDirectoryExists: false,
      ticketConsumed: false,
      ownerAuthorizationRequired: false,
      optimizerCreated: false,
      backwardExecuted: false,
      weightsModified: false,
      trainingStarted: false,
      recordedAtUtc: now().toISOString(),
    };
    writeExclusiveJson(paths.preflightReport, preflight);
    const preflightBinding = bindAbsolute(root, paths.preflightReport);
    transitionQualificationOuterJournal(context, "preflight_persisted", now);

    if (commitCurrentRegistry) {
      const active = await registerCurrentActiveExecution({
        root,
        current: context.current,
        packagePayload,
        paths,
        now,
      });
      context.current = active.registryCommit;
      context.activeExecutionRegistered = true;
      context.activeLease = active.lease;
      context.heartbeatTimer = startActiveExecutionHeartbeat({ context, now });
      transitionQualificationOuterJournal(context, "active_execution_registered", now);
    }

    const consumed = consumeStage4V2QualificationTicket({
      projectRoot: root,
      ticket,
      packagePayload,
      ticketBinding: manifest.preReleaseQualificationTicket,
      packagePayloadBinding: manifest.packagePayload,
      consumptionPath: projectLogicalPath(root, paths.ticketConsumption),
      consumedAtUtc: now().toISOString(),
    });
    context.ticketConsumed = true;
    transitionQualificationOuterJournal(context, "ticket_consumed", now, {
      ticketConsumption: consumed.consumptionBinding,
    });
    const outputRoot = resolveProjectPath(root, packagePayload.outputDirectory);
    fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
    paths.outputRoot = outputRoot;

    const activeConfig = buildActiveConfig({
      packagePayload,
      ticket,
      ticketBinding: manifest.preReleaseQualificationTicket,
      consumptionBinding: consumed.consumptionBinding,
      preflightBinding,
    });
    writeExclusiveJson(paths.activeConfig, activeConfig);
    const activeConfigBinding = bindAbsolute(root, paths.activeConfig);
    transitionQualificationOuterJournal(context, "gpu_invocation_started", now, {
      activeConfig: activeConfigBinding,
    });
    invokeRunnerHook(_testHooks, "beforeQualificationInvocation", {
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
    });
    const gpu = await qualificationInvoker({
      root,
      packagePayload,
      activeConfigBinding,
      outputRoot,
    });
    // The Python qualification runner exclusively materializes its output
    // namespace.  Node must not pre-create it, otherwise an old/partial run
    // could be mistaken for the current immutable evidence directory.
    context.outputCreated = fs.existsSync(outputRoot);
    transitionQualificationOuterJournal(context, "gpu_invocation_returned", now, {
      outputDirectoryCreated: context.outputCreated,
      exitStatus: gpu.status,
    });
    writeExclusiveText(paths.stdout, gpu.stdout);
    writeExclusiveText(paths.stderr, gpu.stderr);
    if (gpu.error || gpu.status !== 0) {
      throw new Error(gpu.error?.message ?? `V2 Python qualification exited ${gpu.status}: ${tail(gpu.stderr)}`);
    }
    if (context.heartbeatError) throw context.heartbeatError;
    assert.equal(context.outputCreated, true, "Python qualification did not materialize its output directory");
    const evidence = validatePythonQualificationEvidence({
      root,
      packagePayload,
      activeConfigBinding,
      outputRoot,
    });
    const completedAtUtc = now().toISOString();
    const activeExecutionEvidence = freezeActiveExecutionEvidence(context, completedAtUtc);
    const finalization = {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-finalization-v1",
      executionState: "completed",
      status: "stage4_v2_readonly_gpu_qualification_passed",
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      ticketConsumption: consumed.consumptionBinding,
      preflightReport: preflightBinding,
      activeConfig: activeConfigBinding,
      gpuDiagnostic: evidence.gpuDiagnostic,
      cudaTelemetry: evidence.cudaTelemetry,
      stateIntegrity: evidence.stateIntegrity,
      qualificationResult: evidence.qualificationResult,
      activeExecutionEvidence,
      stdout: bindAbsolute(root, paths.stdout),
      stderr: bindAbsolute(root, paths.stderr),
      controlledSmokeRegistration: {
        status: "eligible_not_registered",
        nextTaskId: SMOKE_TASK,
        nextMachineAction: SMOKE_ACTION,
        capabilityVersion: STAGE4_V2_CAPABILITY,
        parentQualificationRunId: packagePayload.runId,
        fixedInputs: packagePayload.fixedInputs,
        ownerAuthorizationRequired: false,
        automaticExecutionAllowed: true,
      },
      checkpointWritten: false,
      optimizerCreated: false,
      backwardExecuted: false,
      weightsModified: false,
      trainingStarted: false,
      completedAtUtc,
      completedAtAsiaShanghai: formatShanghai(completedAtUtc),
    };
    writeExclusiveJson(paths.finalization, finalization);
    const finalizationBinding = bindAbsolute(root, paths.finalization);
    const terminal = {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
      executionState: "completed",
      status: "stage4_v2_readonly_gpu_qualification_passed",
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      finalization: finalizationBinding,
      qualificationResult: evidence.qualificationResult,
      stateIntegrity: evidence.stateIntegrity,
      controlledSmokeRegistration: finalization.controlledSmokeRegistration,
      nextMachineAction: SMOKE_ACTION,
      ownerAuthorizationRequired: false,
      checkpointWritten: false,
      weightsModified: false,
      trainingStarted: false,
      recordedAtUtc: completedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(completedAtUtc),
    };
    writeExclusiveJson(paths.terminal, terminal);
    const terminalBinding = bindAbsolute(root, paths.terminal);
    const capsule = buildTerminalCapsule({
      packagePayload,
      status: "readonly_gpu_qualified",
      terminal,
      terminalBinding,
      blocker: {
        code: "controlled_smoke_not_yet_materialized",
        summaryZh: "V2只读GPU资格已通过；下一步由本地程序登记并物化同能力身份的受控Smoke。",
      },
      nextAction: { code: SMOKE_ACTION, labelZh: "登记并物化V2受控Smoke闭环。" },
      evidence: [
        preflightBinding,
        consumed.consumptionBinding,
        activeConfigBinding,
        ...(activeExecutionEvidence ? [activeExecutionEvidence.lock, activeExecutionEvidence.finalHeartbeat] : []),
        evidence.gpuDiagnostic,
        evidence.cudaTelemetry,
        evidence.stateIntegrity,
        evidence.qualificationResult,
        finalizationBinding,
        terminalBinding,
      ],
    });
    writeExclusiveJson(paths.capsule, capsule);
    const capsuleBinding = bindAbsolute(root, paths.capsule);
    transitionQualificationOuterJournal(context, "artifacts_staged", now, {
      terminal: terminalBinding,
      finalization: finalizationBinding,
      capsule: capsuleBinding,
    });

    const lifecycle = reconcileStage4V2ReadonlyGpuQualifiedLifecycle({
      projectRoot: root,
      qualificationTerminalBinding: terminalBinding,
      recordedAtUtc: completedAtUtc,
    });
    transitionQualificationOuterJournal(context, "lifecycle_committed", now, {
      lifecycleState: lifecycle.stateBinding,
      lifecycleEvidence: lifecycle.evidenceBinding,
    });
    invokeRunnerHook(_testHooks, "afterQualificationLifecycleCommittedBeforeEvent", {
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      terminal: terminalBinding,
      lifecycleEvidence: lifecycle.evidenceBinding,
    });

    const eventCommit = appendProgramEvent
      ? appendTerminalEvent({
          runId: packagePayload.runId,
          status: "success",
          title: "Stage4 V2只读GPU资格通过",
          detail: "七项责任CUDA前向、梯度、掩码隔离和模型状态不变证据已保存；训练未启动。",
          terminalBinding,
          timestamp: completedAtUtc,
        })
      : null;
    if (eventCommit !== null) {
      transitionQualificationOuterJournal(context, "event_committed", now, {
        programEventId: eventCommit.event.id,
      });
    }
    let registryCommit = null;
    if (commitCurrentRegistry) {
      assert.ok(eventCommit !== null, "current registry publication requires a committed program event");
      registryCommit = await advanceCurrentExecutionRegistry({
        projectRoot: root,
        capabilityVersion: STAGE4_V2_CAPABILITY,
        packageId: packagePayload.packageId,
        taskId: SMOKE_TASK,
        taskKind: "controlled_smoke_planning",
        taskGoal: "Materialize one controlled Stage4 V2 Smoke closed loop from the verified readonly-GPU qualification terminal.",
        priority: 1,
        queueStatus: "ready",
        nextMachineAction: SMOKE_ACTION,
        queuedAtUtc: completedAtUtc,
        runId: packagePayload.runId,
        lifecycleStage: "readonly_gpu_qualified",
        executionState: "package_materialized",
        activity: "controlled_smoke_registration_ready",
        taskCapsulePath: capsuleBinding.path,
        terminalEvidencePath: terminalBinding.path,
        expectedPreviousRegistryRevision: context.current.registry.registryRevision,
        expectedPreviousRegistrySha256: context.current.registrySha256,
        dependencyManifest: buildQualificationRegistryDependencyManifest({
          root,
          context,
          eventCommit,
          bindings: [
            { role: "qualification_terminal", ...terminalBinding },
            { role: "qualification_finalization", ...finalizationBinding },
            { role: "qualification_capsule", ...capsuleBinding },
            { role: "qualification_lifecycle_evidence", ...lifecycle.evidenceBinding },
          ],
        }),
      });
      context.current = registryCommit;
    }
    return Object.freeze({
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-execution-result-v1",
      executionState: "completed",
      status: terminal.status,
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      terminal: terminalBinding,
      finalization: finalizationBinding,
      controlledSmokeRegistration: terminal.controlledSmokeRegistration,
      registryRevision: registryCommit?.registry?.registryRevision ?? null,
      registrySha256: registryCommit?.registrySha256 ?? null,
      ownerAuthorizationRequired: false,
      optimizerCreated: false,
      backwardExecuted: false,
      weightsModified: false,
      trainingStarted: false,
    });
  } catch (error) {
    if (context.outerJournal?.state === "artifacts_staged") {
      try {
        reconcileQualificationLifecycleJournalFromCanonical(context, now);
      } catch {
        // The canonical lifecycle did not commit this exact terminal.  Keep
        // the original error and follow the ordinary failed-close path.
      }
    }
    if (["lifecycle_committed", "event_committed"].includes(context.outerJournal?.state)) {
      return await recoverCommittedQualificationPublication({
        context,
        commitCurrentRegistry,
        appendProgramEvent,
        now,
        _testHooks,
      });
    }
    if (context.current && context.packagePayload && context.ticket) {
      return await persistFailedClosed({
        context,
        error,
        commitCurrentRegistry,
        appendProgramEvent,
        now,
      });
    }
    throw error;
  } finally {
    stopActiveExecutionHeartbeat(context);
  }
}

async function recoverCommittedQualificationPublication({
  context,
  commitCurrentRegistry,
  appendProgramEvent,
  now,
  expiredActiveRecovery = null,
  _testHooks = null,
}) {
  assert.ok(["lifecycle_committed", "event_committed"].includes(context.outerJournal?.state),
    "qualification publication recovery journal state is invalid");
  assert.equal(appendProgramEvent, true,
    "event-committed qualification recovery requires the program event store");
  const terminalBinding = context.outerJournal.evidence?.terminal;
  const finalizationBinding = context.outerJournal.evidence?.finalization;
  const capsuleBinding = context.outerJournal.evidence?.capsule;
  assertProjectBinding(context.root, terminalBinding, "journal terminal");
  assertProjectBinding(context.root, finalizationBinding, "journal finalization");
  assertProjectBinding(context.root, capsuleBinding, "journal capsule");
  const terminal = readBoundProjectJson(context.root, terminalBinding);
  const succeeded = terminal.executionState === "completed"
    && terminal.status === "stage4_v2_readonly_gpu_qualification_passed";
  const failed = terminal.executionState === "failed_closed"
    && terminal.status === "stage4_v2_readonly_gpu_qualification_failed_closed";
  assert.equal(succeeded || failed, true, "event-committed qualification terminal is ambiguous");
  const lifecycle = succeeded
    ? verifyStage4V2ReadonlyGpuQualifiedLifecycle({
        projectRoot: context.root,
        qualificationTerminalBinding: terminalBinding,
      })
    : null;
  if (succeeded) {
    assert.equal(context.outerJournal.state === "lifecycle_committed"
      || context.outerJournal.evidence?.lifecycleEvidence?.sha256 === lifecycle.evidenceBinding.sha256, true,
    "successful qualification publication has no committed lifecycle evidence");
  }
  const eventCommit = appendTerminalEvent({
    runId: context.packagePayload.runId,
    status: succeeded ? "success" : "failed",
    title: succeeded
      ? "Stage4 V2只读GPU资格通过"
      : "Stage4 V2只读GPU资格失败关闭",
    detail: succeeded
      ? "七项责任CUDA前向、梯度、掩码隔离和模型状态不变证据已保存；训练未启动。"
      : "程序已保存具体失败证据；未自动重试、未训练、未修改权重。",
    terminalBinding,
    timestamp: terminal.recordedAtUtc,
  });
  if (context.outerJournal.state === "lifecycle_committed") {
    transitionQualificationOuterJournal(context, "event_committed", now, {
      programEventId: eventCommit.event.id,
    });
  }
  const visible = await readCurrentExecutionRegistry(context.root);
  let registryCommit = visible;
  const targetTask = succeeded ? SMOKE_TASK : FAILURE_TASK;
  const targetAction = succeeded ? SMOKE_ACTION : FAILURE_ACTION;
  if (expiredActiveRecovery !== null && visible.ok !== true) {
    const preparedRecovery = await recoverPreparedQualificationPublicationIfPresent({
      context,
      terminalBinding,
      targetTask,
      targetAction,
      succeeded,
      _testHooks,
    });
    if (preparedRecovery !== null) registryCommit = preparedRecovery;
  }
  if (
    registryCommit.ok !== true
    || registryCommit.registry.packageId !== context.packagePayload.packageId
    || registryCommit.registry.runId !== context.packagePayload.runId
    || registryCommit.registry.taskId !== targetTask
    || registryCommit.registry.nextMachineAction !== targetAction
    || registryCommit.registry.terminalEvidence.path !== terminalBinding.path
    || registryCommit.registry.terminalEvidence.sha256 !== terminalBinding.sha256
  ) {
    assert.equal(commitCurrentRegistry, true,
      "event-committed qualification registry recovery was disabled");
    assert.equal(context.current.ok, true,
      "event-committed qualification previous registry is unavailable");
    registryCommit = await advanceCurrentExecutionRegistry({
      projectRoot: context.root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: context.packagePayload.packageId,
      taskId: targetTask,
      taskKind: succeeded ? "controlled_smoke_planning" : "cpu_readonly_adjudication",
      taskGoal: succeeded
        ? "Materialize one controlled Stage4 V2 Smoke closed loop from the verified readonly-GPU qualification terminal."
        : "Classify the saved Stage4 V2 readonly-GPU qualification failure without retrying GPU work.",
      priority: 1,
      queueStatus: "ready",
      nextMachineAction: targetAction,
      queuedAtUtc: terminal.recordedAtUtc ?? now().toISOString(),
      runId: context.packagePayload.runId,
      lifecycleStage: succeeded ? "readonly_gpu_qualified" : "cpu_contract_verified",
      executionState: "package_materialized",
      activity: succeeded
        ? "controlled_smoke_registration_ready"
        : "readonly_gpu_qualification_failed_closed_adjudication_ready",
      taskCapsulePath: capsuleBinding.path,
      terminalEvidencePath: terminalBinding.path,
      expectedPreviousRegistryRevision: context.current.registry.registryRevision,
      expectedPreviousRegistrySha256: context.current.registrySha256,
      dependencyManifest: buildQualificationRegistryDependencyManifest({
        root: context.root,
        context,
        eventCommit,
        bindings: [
          { role: "qualification_terminal", ...terminalBinding },
          { role: "qualification_finalization", ...finalizationBinding },
          { role: "qualification_capsule", ...capsuleBinding },
          ...(context.staleRegistryEvidence
            ? [
                {
                  role: "qualification_recovery_stale_registry_transaction",
                  ...context.staleRegistryEvidence.transaction,
                },
                {
                  role: "qualification_recovery_stale_registry_snapshot",
                  ...context.staleRegistryEvidence.snapshot,
                },
              ]
            : []),
          ...(lifecycle
            ? [{ role: "qualification_lifecycle_evidence", ...lifecycle.evidenceBinding }]
            : []),
        ],
      }),
      _expiredActiveRecovery: expiredActiveRecovery,
      _testHooks,
    });
  }
  if (context.staleRegistryEvidence) {
    validateImmutableCurrentRegistryEvidence({
      projectRoot: context.root,
      transaction: context.staleRegistryEvidence.transaction,
      snapshot: context.staleRegistryEvidence.snapshot,
    });
    revalidateNestedProjectBindings(
      context.root,
      context.staleRegistryEvidence,
      "qualificationSuccessRecovery.staleRegistryEvidence",
    );
  }
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-execution-result-v1",
    executionState: terminal.executionState,
    status: terminal.status,
    packageId: context.packagePayload.packageId,
    runId: context.packagePayload.runId,
    terminal: terminalBinding,
    finalization: finalizationBinding,
    controlledSmokeRegistration: terminal.controlledSmokeRegistration ?? null,
    registryRevision: registryCommit.registry?.registryRevision ?? null,
    registrySha256: registryCommit.registrySha256 ?? null,
    recoveredWithoutGpuReplay: true,
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
    trainingStarted: false,
  });
}

async function recoverPreparedQualificationPublicationIfPresent({
  context,
  terminalBinding,
  targetTask,
  targetAction,
  succeeded,
  _testHooks,
}) {
  const writerClaimPath = resolveProjectPath(
    context.root,
    ".runtime/ai-painter/current-execution-registry/writer.claim.json",
  );
  if (!fs.existsSync(writerClaimPath)) return null;
  const claim = readJsonObject(writerClaimPath);
  assert.match(claim.transactionId, /^current-execution-registry-[a-z0-9-]+$/u,
    "prepared qualification publication writer identity is invalid");
  const pendingPath = `.runtime/ai-painter/current-execution-registry/transactions/${claim.transactionId}/transaction.pending.json`;
  const pending = readProjectJson(context.root, pendingPath);
  assert.equal(pending.transactionId, claim.transactionId,
    "prepared qualification publication transaction identity mismatch");
  const stagedCurrent = readBoundProjectJson(context.root, pending.currentStaged);
  assert.equal(stagedCurrent.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(stagedCurrent.packageId, context.packagePayload.packageId);
  assert.equal(stagedCurrent.runId, context.packagePayload.runId);
  assert.equal(stagedCurrent.taskId, targetTask);
  assert.equal(stagedCurrent.nextMachineAction, targetAction);
  assert.equal(stagedCurrent.executionState, "package_materialized");
  assert.equal(stagedCurrent.lifecycleStage,
    succeeded ? "readonly_gpu_qualified" : "cpu_contract_verified");
  assert.equal(stagedCurrent.activeExecution, null);
  assert.equal(stagedCurrent.terminalEvidence.path, terminalBinding.path);
  assert.equal(stagedCurrent.terminalEvidence.sha256, terminalBinding.sha256);
  return await recoverPreparedCurrentExecutionRegistryAdvance({
    projectRoot: context.root,
    transactionId: claim.transactionId,
    _testHooks,
  });
}

export async function recoverInterruptedQualification({
  root,
  packageManifestPath = null,
  appendProgramEvent = true,
  now = () => new Date(),
  _testHooks = null,
}) {
  const currentPath = ".runtime/ai-painter/current-execution-registry/current.json";
  const currentBinding = bindProjectFile(root, currentPath);
  const registry = readProjectJson(root, currentPath);
  const immutableStaleRegistry = captureImmutableCurrentRegistryEvidence({
    projectRoot: root,
    current: {
      ok: true,
      registry,
      registrySha256: currentBinding.sha256,
    },
  });
  assert.equal(registry.capabilityVersion, STAGE4_V2_CAPABILITY,
    "stale active recovery capability mismatch");
  assert.ok(registry.activeExecution, "stale active recovery has no active execution");
  assert.equal(registry.activeExecution.packageId, registry.packageId,
    "stale active recovery package mismatch");
  assert.equal(registry.activeExecution.runId, registry.runId,
    "stale active recovery run mismatch");
  const materializationTerminal = readBoundProjectJson(root, registry.terminalEvidence);
  assert.equal(
    materializationTerminal.schemaVersion,
    "ai-painter-stage4-v2-readonly-gpu-materialization-terminal-v1",
    "stale active recovery terminal is not the materialization terminal",
  );
  const manifestBinding = materializationTerminal.manifest;
  if (packageManifestPath !== null) {
    assert.equal(normalizeLogicalPath(root, packageManifestPath), manifestBinding.path,
      "recovery manifest is not the stale current package");
  }
  const manifest = readBoundProjectJson(root, manifestBinding);
  const packagePayload = readBoundProjectJson(root, manifest.packagePayload);
  const ticket = readBoundProjectJson(root, manifest.preReleaseQualificationTicket);
  assert.equal(packagePayload.packageId, registry.packageId);
  assert.equal(packagePayload.runId, registry.runId);
  validatePackagePayload(packagePayload, manifest);
  validateStage4V2PreReleaseQualificationTicket({
    projectRoot: root,
    ticket,
    packagePayload,
    verifyEvidence: true,
    nowUtc: null,
  });
  const preflightRoot = resolveProjectPath(root, packagePayload.preflightDirectory, {
    mustExist: true,
    kind: "directory",
  });
  const paths = buildExecutionPaths({ root, packagePayload, preflightRoot });
  let originalJournal = readJsonObject(paths.outerJournal);
  assert.equal(
    originalJournal.schemaVersion,
    "ai-painter-stage4-v2-readonly-gpu-outer-transaction-journal-v1",
    "stale active recovery journal schema mismatch",
  );
  assert.equal(originalJournal.packageId, packagePayload.packageId,
    "stale active recovery journal package mismatch");
  assert.equal(originalJournal.runId, packagePayload.runId,
    "stale active recovery journal run mismatch");
  assert.equal(originalJournal.capabilityVersion, STAGE4_V2_CAPABILITY,
    "stale active recovery journal capability mismatch");
  assert.equal(originalJournal.automaticGpuReplayAllowed, false,
    "stale active recovery journal permits GPU replay");

  if (originalJournal.state === "artifacts_staged") {
    const journalRecoveryContext = {
      root,
      packagePayload,
      paths,
      outerJournal: originalJournal,
    };
    try {
      reconcileQualificationLifecycleJournalFromCanonical(journalRecoveryContext, now);
      originalJournal = journalRecoveryContext.outerJournal;
    } catch {
      // No exact canonical success transition exists.  The host-interruption
      // path below closes the package without replaying GPU work.
    }
  }

  if (["lifecycle_committed", "event_committed"].includes(originalJournal.state)) {
    const successRecoveryContext = {
      root,
      current: {
        ok: true,
        registry,
        registrySha256: currentBinding.sha256,
      },
      packagePayload,
      manifest,
      ticket,
      paths,
      outerJournal: originalJournal,
      staleRegistryEvidence: {
        transaction: immutableStaleRegistry.transaction,
        snapshot: immutableStaleRegistry.snapshot,
      },
    };
    return await recoverCommittedQualificationPublication({
      context: successRecoveryContext,
      commitCurrentRegistry: true,
      appendProgramEvent,
      now,
      expiredActiveRecovery: {
        capabilityVersion: STAGE4_V2_CAPABILITY,
        packageId: packagePayload.packageId,
        runId: packagePayload.runId,
      },
      _testHooks,
    });
  }

  const recoveryRoot = path.join(preflightRoot, "host-interruption-recovery");
  if (!fs.existsSync(recoveryRoot)) fs.mkdirSync(recoveryRoot, { recursive: false });
  const recoveryJournalPath = path.join(recoveryRoot, "outer-transaction-journal.json");
  let recoveryJournal;
  if (fs.existsSync(recoveryJournalPath)) {
    recoveryJournal = readJsonObject(recoveryJournalPath);
  } else {
    const recoveredAtUtc = now().toISOString();
    recoveryJournal = {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-host-recovery-journal-v1",
      state: "initialized",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      staleRegistry: {
        registryRevision: registry.registryRevision,
        registrySha256: currentBinding.sha256,
        transaction: immutableStaleRegistry.transaction,
        snapshot: immutableStaleRegistry.snapshot,
      },
      sourceOuterJournal: bindAbsolute(root, paths.outerJournal),
      gpuReplayStarted: false,
      automaticRetryAllowed: false,
      recoveredAtUtc,
      updatedAtUtc: recoveredAtUtc,
    };
    writeExclusiveJson(recoveryJournalPath, recoveryJournal);
  }
  assert.equal(recoveryJournal.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(recoveryJournal.packageId, packagePayload.packageId);
  assert.equal(recoveryJournal.runId, packagePayload.runId);
  assert.equal(recoveryJournal.staleRegistry.registryRevision, registry.registryRevision);
  assert.equal(recoveryJournal.staleRegistry.registrySha256, currentBinding.sha256);
  assert.deepEqual(recoveryJournal.staleRegistry.transaction,
    immutableStaleRegistry.transaction,
    "host recovery stale registry transaction changed");
  assert.deepEqual(recoveryJournal.staleRegistry.snapshot,
    immutableStaleRegistry.snapshot,
    "host recovery stale registry snapshot changed");
  assert.equal(recoveryJournal.gpuReplayStarted, false);

  let ticketDisposition = null;
  const ticketConsumptionPath = projectLogicalPath(root, paths.ticketConsumption);
  if (fs.existsSync(paths.ticketConsumption)) {
    ticketDisposition = {
      status: "consumed_once_before_host_interruption",
      binding: bindAbsolute(root, paths.ticketConsumption),
    };
  } else {
    try {
      const closed = closeStage4V2UnconsumedQualificationTicket({
        projectRoot: root,
        ticket,
        ticketBinding: manifest.preReleaseQualificationTicket,
        packagePayloadBinding: manifest.packagePayload,
        closurePath: projectLogicalPath(root, path.join(recoveryRoot, "ticket-closure.json")),
        reasonCode: "host_interruption_failed_closed",
        error: "expired active execution recovered without GPU replay",
        closedAtUtc: recoveryJournal.recoveredAtUtc,
      });
      ticketDisposition = { status: "closed_unconsumed", binding: closed.closureBinding };
    } catch (closureError) {
      const recoveredConsumption = recoverStage4V2QualificationTicketConsumption({
        projectRoot: root,
        ticket,
        packagePayload,
        ticketBinding: manifest.preReleaseQualificationTicket,
        packagePayloadBinding: manifest.packagePayload,
        consumptionPath: ticketConsumptionPath,
        nowUtc: recoveryJournal.recoveredAtUtc,
      });
      ticketDisposition = {
        status: "prepared_consumption_recovered_then_failed_closed",
        binding: recoveredConsumption.consumptionBinding,
        closureError: closureError instanceof Error ? closureError.message : String(closureError),
      };
    }
  }

  const knownOutputEvidence = [
    paths.gpuDiagnostic,
    paths.cudaTelemetry,
    paths.stateIntegrity,
    paths.qualificationResult,
  ].filter((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
    .map((candidate) => bindAbsolute(root, candidate));
  const activeExecutionEvidence = {
    lock: bindProjectFile(root, registry.activeExecution.lock.path, registry.activeExecution.lock.sha256),
    finalHeartbeat: bindProjectFile(root, registry.activeExecution.heartbeat.path),
  };
  const failureReportPath = path.join(recoveryRoot, "failure-report.json");
  const failureReport = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-host-interruption-report-v1",
    executionState: "failed_closed",
    status: "stage4_v2_readonly_gpu_qualification_host_interruption_failed_closed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    staleRegistry: recoveryJournal.staleRegistry,
    sourceOuterJournal: recoveryJournal.sourceOuterJournal,
    sourceOuterJournalState: originalJournal.state,
    gpuInvocationMayHaveStarted: originalJournal.gpuInvocationMayHaveStarted === true,
    existingOutputEvidence: knownOutputEvidence,
    existingOutputEvidencePromotedToSuccess: false,
    activeExecutionEvidence,
    ticketDisposition,
    gpuReplayStarted: false,
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    trainingStarted: false,
    recordedAtUtc: recoveryJournal.recoveredAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recoveryJournal.recoveredAtUtc),
  };
  ensureImmutableJsonFile(failureReportPath, failureReport);
  const failureBinding = bindAbsolute(root, failureReportPath);
  const terminalPath = path.join(recoveryRoot, "phase-terminal.json");
  const terminal = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-host-recovery-terminal-v1",
    executionState: "failed_closed",
    status: "stage4_v2_readonly_gpu_qualification_host_interruption_failed_closed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    staleRegistryTransaction: immutableStaleRegistry.transaction,
    staleRegistrySnapshot: immutableStaleRegistry.snapshot,
    failureReport: failureBinding,
    nextMachineAction: FAILURE_ACTION,
    automaticGpuReplayAllowed: false,
    gpuReplayStarted: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc: recoveryJournal.recoveredAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recoveryJournal.recoveredAtUtc),
  };
  ensureImmutableJsonFile(terminalPath, terminal);
  const terminalBinding = bindAbsolute(root, terminalPath);
  const capsulePath = path.join(recoveryRoot, "task-capsule.json");
  const capsule = buildTerminalCapsule({
    packagePayload,
    status: "readonly_gpu_qualification_host_interruption_failed_closed",
    terminal,
    terminalBinding,
    blocker: {
      code: "expired_active_execution_host_interruption",
      summaryZh: "资格执行宿主中断；程序只收口既有证据并失败关闭，未重放GPU。",
    },
    nextAction: { code: FAILURE_ACTION, labelZh: "仅对既有证据执行CPU只读失败裁决。" },
    evidence: [
      immutableStaleRegistry.transaction,
      immutableStaleRegistry.snapshot,
      recoveryJournal.sourceOuterJournal,
      activeExecutionEvidence.lock,
      activeExecutionEvidence.finalHeartbeat,
      ...(ticketDisposition.binding ? [ticketDisposition.binding] : []),
      ...knownOutputEvidence,
      failureBinding,
      terminalBinding,
    ],
  });
  ensureImmutableJsonFile(capsulePath, capsule);
  const capsuleBinding = bindAbsolute(root, capsulePath);
  revalidateNestedProjectBindings(root, {
    staleRegistry: recoveryJournal.staleRegistry,
    sourceOuterJournal: recoveryJournal.sourceOuterJournal,
    activeExecutionEvidence,
    ticketDisposition,
    knownOutputEvidence,
    failureReport: failureBinding,
    terminal: terminalBinding,
    capsule: capsuleBinding,
  });
  validateImmutableCurrentRegistryEvidence({
    projectRoot: root,
    transaction: recoveryJournal.staleRegistry.transaction,
    snapshot: recoveryJournal.staleRegistry.snapshot,
  });

  if (recoveryJournal.state === "initialized") {
    recoveryJournal = {
      ...recoveryJournal,
      state: "artifacts_staged",
      terminal: terminalBinding,
      failureReport: failureBinding,
      capsule: capsuleBinding,
      updatedAtUtc: now().toISOString(),
    };
    writeJsonAtomic(recoveryJournalPath, recoveryJournal);
  }
  assert.ok(["artifacts_staged", "event_committed"].includes(recoveryJournal.state),
    "host recovery journal state is invalid");
  assert.equal(appendProgramEvent, true,
    "host recovery registry publication requires a recovery program event");
  const eventCommit = appendHostRecoveryEvent({
    runId: packagePayload.runId,
    terminalBinding,
    timestamp: recoveryJournal.recoveredAtUtc,
  });
  if (recoveryJournal.state === "artifacts_staged") {
    recoveryJournal = {
      ...recoveryJournal,
      state: "event_committed",
      programEventId: eventCommit.event.id,
      updatedAtUtc: now().toISOString(),
    };
    writeJsonAtomic(recoveryJournalPath, recoveryJournal);
  }
  const recoveryContext = {
    root,
    packagePayload,
    paths: { ...paths, outerJournal: recoveryJournalPath },
    outerJournal: recoveryJournal,
  };
  const writerClaimPath = resolveProjectPath(
    root,
    ".runtime/ai-painter/current-execution-registry/writer.claim.json",
  );
  if (fs.existsSync(writerClaimPath)) {
    const claim = readJsonObject(writerClaimPath);
    assert.match(claim.transactionId, /^current-execution-registry-[a-z0-9-]+$/u,
      "prepared recovery writer transaction identity is invalid");
    const pendingPath = `.runtime/ai-painter/current-execution-registry/transactions/${claim.transactionId}/transaction.pending.json`;
    const pending = readProjectJson(root, pendingPath);
    assert.equal(pending.transactionId, claim.transactionId,
      "prepared recovery pending transaction identity mismatch");
    const stagedCurrent = readBoundProjectJson(root, pending.currentStaged);
    assert.equal(stagedCurrent.packageId, packagePayload.packageId,
      "prepared recovery belongs to a different package");
    assert.equal(stagedCurrent.runId, packagePayload.runId,
      "prepared recovery belongs to a different run");
    assert.equal(stagedCurrent.capabilityVersion, STAGE4_V2_CAPABILITY,
      "prepared recovery belongs to a different capability");
    assert.equal(stagedCurrent.executionState, "failed_closed",
      "prepared recovery is not the bound failed-close transaction");
    assert.equal(stagedCurrent.terminalEvidence.path, terminalBinding.path,
      "prepared recovery terminal path mismatch");
    assert.equal(stagedCurrent.terminalEvidence.sha256, terminalBinding.sha256,
      "prepared recovery terminal SHA-256 mismatch");
    const recoveredPrepared = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: root,
      transactionId: claim.transactionId,
      _testHooks,
    });
    assert.equal(recoveredPrepared.registry.packageId, packagePayload.packageId,
      "prepared recovery published a different package");
    assert.equal(recoveredPrepared.registry.runId, packagePayload.runId,
      "prepared recovery published a different run");
    assert.equal(recoveredPrepared.registry.executionState, "failed_closed",
      "prepared recovery did not fail-close the stale active execution");
    revalidateNestedProjectBindings(root, {
      staleRegistry: recoveryJournal.staleRegistry,
      sourceOuterJournal: recoveryJournal.sourceOuterJournal,
      activeExecutionEvidence,
      ticketDisposition,
      knownOutputEvidence,
      failureReport: failureBinding,
      terminal: terminalBinding,
      capsule: capsuleBinding,
    });
    validateImmutableCurrentRegistryEvidence({
      projectRoot: root,
      transaction: recoveryJournal.staleRegistry.transaction,
      snapshot: recoveryJournal.staleRegistry.snapshot,
    });
    return Object.freeze({
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-execution-result-v1",
      executionState: "failed_closed",
      status: terminal.status,
      packageId: packagePayload.packageId,
      runId: packagePayload.runId,
      failureReport: failureBinding,
      terminal: terminalBinding,
      registryRevision: recoveredPrepared.registry.registryRevision,
      registrySha256: recoveredPrepared.registrySha256,
      recoveredWithoutGpuReplay: true,
      recoveredPreparedRegistryTransaction: true,
      ownerAuthorizationRequired: false,
      automaticRetryAllowed: false,
      trainingStarted: false,
    });
  }
  const registryCommit = await recoverExpiredActiveExecutionToFailedClosed({
    projectRoot: root,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    taskCapsulePath: capsuleBinding.path,
    terminalEvidencePath: terminalBinding.path,
    expectedPreviousRegistryRevision: registry.registryRevision,
    expectedPreviousRegistrySha256: currentBinding.sha256,
    dependencyManifest: buildQualificationRegistryDependencyManifest({
      root,
      context: recoveryContext,
      eventCommit,
      bindings: [
        { role: "host_recovery_stale_registry_transaction", ...immutableStaleRegistry.transaction },
        { role: "host_recovery_stale_registry_snapshot", ...immutableStaleRegistry.snapshot },
        { role: "host_recovery_failure_report", ...failureBinding },
        { role: "host_recovery_terminal", ...terminalBinding },
        { role: "host_recovery_capsule", ...capsuleBinding },
      ],
    }),
    _testHooks,
  });
  revalidateNestedProjectBindings(root, {
    staleRegistry: recoveryJournal.staleRegistry,
    sourceOuterJournal: recoveryJournal.sourceOuterJournal,
    activeExecutionEvidence,
    ticketDisposition,
    knownOutputEvidence,
    failureReport: failureBinding,
    terminal: terminalBinding,
    capsule: capsuleBinding,
  });
  validateImmutableCurrentRegistryEvidence({
    projectRoot: root,
    transaction: recoveryJournal.staleRegistry.transaction,
    snapshot: recoveryJournal.staleRegistry.snapshot,
  });
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-execution-result-v1",
    executionState: "failed_closed",
    status: terminal.status,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    failureReport: failureBinding,
    terminal: terminalBinding,
    registryRevision: registryCommit.registry.registryRevision,
    registrySha256: registryCommit.registrySha256,
    recoveredWithoutGpuReplay: true,
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
    trainingStarted: false,
  });
}

function verifyMaterializedRegistry(current) {
  const registry = current.registry;
  assert.equal(registry.capabilityVersion, STAGE4_V2_CAPABILITY, "current capability is not Stage4 V2");
  assert.equal(registry.taskId, MATERIALIZED_RUN_TASK, "current task is not V2 readonly-GPU execution");
  assert.equal(registry.nextMachineAction, MATERIALIZED_RUN_ACTION, "current machine action is not V2 readonly-GPU execution");
  assert.equal(registry.taskKind, "readonly_gpu_qualification", "current task kind mismatch");
  assert.equal(registry.lifecycleStage, "cpu_contract_verified", "current lifecycle is not CPU verified");
  assert.equal(registry.executionState, "package_materialized", "qualification package is not materialized");
  assert.equal(registry.activeExecution, null, "another current execution is active");
}

function verifyPackageManifest(manifest, registry) {
  assert.equal(manifest.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-package-manifest-v1");
  assert.equal(manifest.status, "materialized_not_executed");
  assert.equal(manifest.packageId, registry.packageId);
  assert.equal(manifest.runId, registry.runId);
  assert.equal(manifest.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(manifest.outputDirectoryCreated, false);
  assert.equal(manifest.preflightDirectoryCreated, false);
  assert.equal(manifest.ownerAuthorizationRequired, false);
  for (const field of ["gpuStarted", "optimizerCreated", "backwardExecuted", "weightsModified", "trainingStarted"]) {
    assert.equal(manifest[field], false, `materialized manifest ${field} must be false`);
  }
  assert.ok(manifest.programGraphManifest?.path
    && manifest.programGraphManifest?.sha256,
  "qualification program graph manifest binding is missing");
}

function validatePackagePayload(payload, manifest) {
  assert.equal(payload.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-package-payload-v1");
  assert.equal(payload.status, "materialized_not_executed");
  assert.equal(payload.packageId, manifest.packageId);
  assert.equal(payload.runId, manifest.runId);
  assert.equal(payload.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(payload.executionClass, "readonly_gpu_qualification");
  assert.equal(payload.authorityClass, "local_ai_pre_release_capability_lifecycle");
  assert.equal(payload.ledgerPath, manifest.replayLedger.path);
  assert.deepEqual(payload.ticketIssuer, manifest.ticketIssuer);
  assert.equal(payload.fixedInputs?.seed, 20263722);
  assert.deepEqual(payload.fixedInputs?.resolution, { width: 256, height: 192 });
  assert.equal(payload.fixedInputs?.batchSize, 1);
  assert.equal(payload.fixedInputs?.diffusionTimestep, 500);
  assert.equal(payload.fixedInputs?.conditionChannels, 23);
  assert.equal(payload.fixedInputs?.latentChannels, 12);
  assert.equal(payload.executionBoundary?.gpuForwardAllowed, true);
  assert.equal(payload.executionBoundary?.torchAutogradGradAllowed, true);
  for (const field of [
    "optimizerAllowed", "backwardAllowed", "weightMutationAllowed", "denoiserCheckpointReadAllowed",
    "checkpointWriteAllowed", "trainingAllowed", "smokeAllowed", "stage0Allowed", "formalInferenceAllowed",
    "runtimeFrameAllowed", "worldEntryAllowed",
  ]) assert.equal(payload.executionBoundary?.[field], false, `${field} must be false`);
  assert.equal(payload.executionBoundary?.autoencoderCheckpointOnly, true);
  assert.equal(payload.failurePolicy?.failClosed, true);
  assert.equal(payload.failurePolicy?.automaticRetryAllowed, false);
  assert.equal(payload.failurePolicy?.historicalDirectoryScanAllowed, false);
  assert.equal(payload.failurePolicy?.callerVerifiedBooleanTrusted, false);
  assert.equal(payload.failurePolicy?.ownerAuthorizationRequired, false);
  assert.ok(payload.programGraphManifest?.path
    && payload.programGraphManifest?.sha256,
  "qualification payload program graph binding is missing");
}

function verifyProgramLineageRoles(programLineage) {
  assert.deepEqual(
    Object.keys(programLineage).sort(),
    ["backgroundLauncher", "materializer", "modelFactory", "nodeRunner", "pythonRunner", "qualificationLifecycle", "successorModule", "ticketCore", "trainer", "trainerSupport"].sort(),
    "V2 qualification program lineage roles mismatch",
  );
}

async function registerCurrentActiveExecution({ root, current, packagePayload, paths, now }) {
  const processStartIdentity = queryCurrentProcessStartIdentity();
  const lockRecord = {
    schemaVersion: "ai-painter-current-active-execution-lock-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    processId: process.pid,
    processStartIdentity,
  };
  writeExclusiveJson(paths.activeExecutionLock, lockRecord);
  const heartbeatRecord = buildActiveHeartbeatRecord({
    packagePayload,
    processStartIdentity,
    heartbeatAtUtc: now().toISOString(),
  });
  writeJsonAtomic(paths.activeExecutionHeartbeat, heartbeatRecord);
  const lockBinding = bindAbsolute(root, paths.activeExecutionLock);
  const lease = {
    packagePayload,
    processStartIdentity,
    lock: { path: lockBinding.path, sha256: lockBinding.sha256 },
    heartbeat: {
      path: projectLogicalPath(root, paths.activeExecutionHeartbeat),
      ttlSeconds: ACTIVE_EXECUTION_HEARTBEAT_TTL_SECONDS,
    },
  };
  const activeExecution = {
    schemaVersion: "ai-painter-current-active-execution-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    executionState: "executing",
    processId: process.pid,
    processStartIdentity,
    programLineage: Object.fromEntries(Object.entries(packagePayload.programLineage).map(
      ([role, binding]) => [role, { path: binding.path, sha256: binding.sha256 }],
    )),
    lock: lease.lock,
    heartbeat: lease.heartbeat,
  };
  const registryCommit = await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    taskId: MATERIALIZED_RUN_TASK,
    taskKind: "readonly_gpu_qualification",
    taskGoal: "Execute one signed, single-use Stage4 V2 readonly-GPU qualification without training or weight mutation.",
    priority: 1,
    queueStatus: "running",
    nextMachineAction: null,
    queuedAtUtc: current.registry.queuedAtUtc ?? now().toISOString(),
    runId: packagePayload.runId,
    lifecycleStage: "cpu_contract_verified",
    executionState: "executing",
    activity: "readonly_gpu_qualification_executing",
    taskCapsulePath: current.registry.taskCapsule.path,
    terminalEvidencePath: current.registry.terminalEvidence.path,
    activeExecution,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  });
  return Object.freeze({ registryCommit, lease: Object.freeze(lease) });
}

function buildActiveHeartbeatRecord({ packagePayload, processStartIdentity, heartbeatAtUtc }) {
  return {
    schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    executionState: "executing",
    processId: process.pid,
    processStartIdentity,
    heartbeatAtUtc,
    ttlSeconds: ACTIVE_EXECUTION_HEARTBEAT_TTL_SECONDS,
  };
}

export function startActiveExecutionHeartbeat({
  context,
  now = () => new Date(),
  intervalMs = ACTIVE_EXECUTION_HEARTBEAT_INTERVAL_MS,
}) {
  const timer = setInterval(() => {
    try {
      writeJsonAtomic(
        context.paths.activeExecutionHeartbeat,
        buildActiveHeartbeatRecord({
          packagePayload: context.packagePayload,
          processStartIdentity: context.activeLease.processStartIdentity,
          heartbeatAtUtc: now().toISOString(),
        }),
      );
    } catch (error) {
      context.heartbeatError = new Error(`active execution heartbeat persistence failed: ${error.message}`);
    }
  }, intervalMs);
  return timer;
}

export function stopActiveExecutionHeartbeat(context) {
  if (context.heartbeatTimer !== null) clearInterval(context.heartbeatTimer);
  context.heartbeatTimer = null;
}

function freezeActiveExecutionEvidence(context, recordedAtUtc, { throwOnHeartbeatError = true } = {}) {
  if (!context.activeExecutionRegistered) return null;
  stopActiveExecutionHeartbeat(context);
  if (context.heartbeatError && throwOnHeartbeatError) throw context.heartbeatError;
  try {
    writeJsonAtomic(
      context.paths.activeExecutionHeartbeat,
      buildActiveHeartbeatRecord({
        packagePayload: context.packagePayload,
        processStartIdentity: context.activeLease.processStartIdentity,
        heartbeatAtUtc: recordedAtUtc,
      }),
    );
  } catch (error) {
    if (throwOnHeartbeatError) throw error;
  }
  if (!fs.existsSync(context.paths.activeExecutionHeartbeat)) return null;
  return Object.freeze({
    lock: bindAbsolute(context.root, context.paths.activeExecutionLock),
    finalHeartbeat: bindAbsolute(context.root, context.paths.activeExecutionHeartbeat),
  });
}

function queryCurrentProcessStartIdentity() {
  if (process.platform === "win32") {
    const script = [
      "$ErrorActionPreference='Stop'",
      `$p=Get-CimInstance -ClassName Win32_Process -Filter \"ProcessId = ${process.pid}\" -ErrorAction Stop`,
      "if ($null -eq $p) { exit 3 }",
      "$o=[pscustomobject]@{ processId=[int]$p.ProcessId; creationDate=$p.CreationDate.ToUniversalTime().ToString('o') }",
      "ConvertTo-Json -InputObject $o -Compress",
    ].join("; ");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    assert.equal(result.error, undefined, "current process identity WMI query failed");
    assert.equal(result.status, 0, "current process identity WMI query failed");
    const value = JSON.parse(String(result.stdout).replace(/^\uFEFF/u, ""));
    assert.equal(Number(value.processId), process.pid, "current process identity PID mismatch");
    assert.equal(typeof value.creationDate, "string", "current process creation time missing");
    return `${process.pid}:${value.creationDate}`;
  }
  const result = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.error, undefined, "current process identity query failed");
  assert.equal(result.status, 0, "current process identity query failed");
  assert.ok(String(result.stdout).trim(), "current process creation time missing");
  return `${process.pid}:${String(result.stdout).trim()}`;
}

function buildExecutionPaths({ root, packagePayload, preflightRoot }) {
  const outputRoot = resolveProjectPath(root, packagePayload.outputDirectory);
  return {
    preflightRoot,
    outputRoot,
    preflightReport: path.join(preflightRoot, "preflight-report.json"),
    ticketConsumption: path.join(preflightRoot, "ticket-consumption.json"),
    cpuCommandReport: path.join(preflightRoot, "cpu-command-results.json"),
    activeExecutionLock: path.join(preflightRoot, "active-execution-lock.json"),
    activeExecutionHeartbeat: path.join(preflightRoot, "active-execution-heartbeat.json"),
    outerJournal: path.join(preflightRoot, "outer-transaction-journal.json"),
    activeConfig: path.join(preflightRoot, "active-config.json"),
    stdout: path.join(preflightRoot, "python-runner-stdout.txt"),
    stderr: path.join(preflightRoot, "python-runner-stderr.txt"),
    gpuDiagnostic: path.join(outputRoot, "gpu-diagnostic.json"),
    cudaTelemetry: path.join(outputRoot, "cuda-telemetry.json"),
    stateIntegrity: path.join(outputRoot, "state-integrity.json"),
    qualificationResult: path.join(outputRoot, "qualification-result.json"),
    finalization: path.join(outputRoot, "finalization.json"),
    terminal: path.join(outputRoot, "phase-terminal.json"),
    capsule: path.join(outputRoot, "task-capsule.json"),
  };
}

function initializeQualificationOuterJournal({ paths, packagePayload, current, now }) {
  const journal = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-outer-transaction-journal-v1",
    state: "preflight_namespace_created",
    operationId: `stage4-v2-readonly-gpu-qualification:${packagePayload.packageId}:${packagePayload.runId}`,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    previousRegistry: {
      registryRevision: current.registry.registryRevision,
      registrySha256: current.registrySha256,
      packageId: current.registry.packageId,
      runId: current.registry.runId,
    },
    evidence: {},
    gpuInvocationMayHaveStarted: false,
    automaticGpuReplayAllowed: false,
    createdAtUtc: now().toISOString(),
    updatedAtUtc: now().toISOString(),
  };
  writeExclusiveJson(paths.outerJournal, journal);
  return journal;
}

function transitionQualificationOuterJournal(context, nextState, now, evidence = {}) {
  if (context.outerJournal === null || context.paths?.outerJournal === undefined) return;
  const transitions = {
    preflight_namespace_created: ["preflight_persisted", "artifacts_staged"],
    preflight_persisted: ["active_execution_registered", "ticket_consumed", "artifacts_staged"],
    active_execution_registered: ["ticket_consumed", "artifacts_staged"],
    ticket_consumed: ["gpu_invocation_started", "artifacts_staged"],
    gpu_invocation_started: ["gpu_invocation_returned", "artifacts_staged"],
    gpu_invocation_returned: ["artifacts_staged"],
    artifacts_staged: ["lifecycle_committed", "event_committed"],
    lifecycle_committed: ["event_committed"],
    event_committed: [],
  };
  const currentState = context.outerJournal.state;
  assert.ok(transitions[currentState]?.includes(nextState),
    `invalid qualification outer-journal transition ${currentState} -> ${nextState}`);
  const updated = {
    ...context.outerJournal,
    state: nextState,
    evidence: { ...context.outerJournal.evidence, ...evidence },
    gpuInvocationMayHaveStarted:
      context.outerJournal.gpuInvocationMayHaveStarted
      || nextState === "gpu_invocation_started"
      || nextState === "gpu_invocation_returned",
    updatedAtUtc: now().toISOString(),
  };
  writeJsonAtomic(context.paths.outerJournal, updated);
  const persisted = readJsonObject(context.paths.outerJournal);
  assert.deepEqual(persisted, updated, "qualification outer journal read-back mismatch");
  context.outerJournal = updated;
}

function reconcileQualificationLifecycleJournalFromCanonical(context, now) {
  assert.equal(context.outerJournal?.state, "artifacts_staged");
  const terminalBinding = context.outerJournal.evidence?.terminal;
  assertProjectBinding(context.root, terminalBinding, "staged qualification terminal");
  const terminal = readBoundProjectJson(context.root, terminalBinding);
  assert.equal(terminal.executionState, "completed");
  assert.equal(terminal.status, "stage4_v2_readonly_gpu_qualification_passed");
  const lifecycle = verifyStage4V2ReadonlyGpuQualifiedLifecycle({
    projectRoot: context.root,
    qualificationTerminalBinding: terminalBinding,
  });
  transitionQualificationOuterJournal(context, "lifecycle_committed", now, {
    lifecycleState: lifecycle.stateBinding,
    lifecycleEvidence: lifecycle.evidenceBinding,
  });
  return lifecycle;
}

function buildQualificationRegistryDependencyManifest({ root, context, eventCommit, bindings }) {
  assert.equal(context.outerJournal?.state, "event_committed",
    "qualification outer journal is not event-committed");
  const committed = {
    ...context.outerJournal,
    bindings,
    programEventId: eventCommit.event.id,
  };
  writeJsonAtomic(context.paths.outerJournal, committed);
  context.outerJournal = readJsonObject(context.paths.outerJournal);
  assert.deepEqual(context.outerJournal, committed,
    "qualification registry dependency journal read-back mismatch");
  return buildStage4V2ExternalRegistryDependencyManifest({
    projectRoot: root,
    journalPath: context.paths.outerJournal,
    eventCommit,
    bindings,
  });
}

function invokeRunnerHook(hooks, point, detail) {
  if (typeof hooks?.onRunnerPoint === "function") hooks.onRunnerPoint(point, detail);
}

function runCpuAndProgramPreflight({ root, packagePayload, commandRunner, now }) {
  const parentContract = readBoundProjectJson(root, packagePayload.bindings.parentContract);
  const commands = [];
  for (const prerequisite of Object.values(parentContract.prerequisiteBindings ?? {})) {
    const command = prerequisite.checkerCommand?.command;
    const args = prerequisite.checkerCommand?.args;
    assert.ok(["node", "python"].includes(command), `unsupported prerequisite command: ${command}`);
    assert.ok(Array.isArray(args) && args.length > 0, "prerequisite checker args are missing");
    commands.push({
      id: prerequisite.id,
      command: command === "node" ? process.execPath : resolveProjectPath(root, PYTHON_RELATIVE, { mustExist: true, kind: "file" }),
      args,
    });
  }
  commands.push({
    id: "node_runner_syntax",
    command: process.execPath,
    args: ["--check", packagePayload.programLineage.nodeRunner.path],
  });
  commands.push({
    id: "node_materializer_syntax",
    command: process.execPath,
    args: ["--check", packagePayload.programLineage.materializer.path],
  });
  commands.push({
    id: "python_runner_syntax",
    command: resolveProjectPath(root, PYTHON_RELATIVE, { mustExist: true, kind: "file" }),
    args: ["-B", "-m", "py_compile", packagePayload.programLineage.pythonRunner.path],
  });
  const results = commands.map((command) => {
    const result = commandRunner(command.command, command.args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      env: pythonEnvironment(root, false),
    });
    if (result.error || result.status !== 0) {
      throw result.error ?? new Error(`CPU preflight ${command.id} failed (${result.status}): ${tail(result.stderr)}`);
    }
    return {
      id: command.id,
      commandIdentity: path.basename(command.command),
      args: command.args,
      exitCode: result.status,
      stdoutSha256: shaText(result.stdout ?? ""),
      stderrSha256: shaText(result.stderr ?? ""),
      stdoutTail: tail(result.stdout ?? ""),
      stderrTail: tail(result.stderr ?? ""),
    };
  });
  return {
    status: "passed",
    commandCount: results.length,
    results,
    gpuWorkloadStarted: false,
    recordedAtUtc: now().toISOString(),
  };
}

function runPythonCudaPreflight({ root, commandRunner, now }) {
  const python = resolveProjectPath(root, PYTHON_RELATIVE, { mustExist: true, kind: "file" });
  const probe = [
    "import json,sys,torch",
    "print(json.dumps({'pythonVersion':sys.version.split()[0],'torchVersion':torch.__version__,'cudaBuildVersion':torch.version.cuda,'cudaAvailable':torch.cuda.is_available(),'cudaDeviceCount':torch.cuda.device_count() if torch.cuda.is_available() else 0}))",
  ].join(";");
  const result = commandRunner(python, ["-B", "-c", probe], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
    env: pythonEnvironment(root, true),
  });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`Python CUDA preflight failed (${result.status}): ${tail(result.stderr)}`);
  }
  const details = JSON.parse(String(result.stdout).trim());
  assert.equal(details.cudaAvailable, true, "CUDA is unavailable");
  assert.equal(details.cudaDeviceCount, 1, "exactly one CUDA device is required");
  return {
    schemaVersion: "ai-painter-stage4-v2-python-cuda-preflight-v1",
    status: "passed",
    details,
    modelGpuWorkloadStarted: false,
    recordedAtUtc: now().toISOString(),
  };
}

export function runResourcePreflight({ root, commandRunner = spawnSync, now = () => new Date() }) {
  const gpuResult = runExternal(commandRunner, "nvidia-smi", [
    "--query-gpu=name,driver_version,utilization.gpu,memory.used,memory.free,memory.total,temperature.gpu",
    "--format=csv,noheader,nounits",
  ], root, true);
  const computeResult = runExternal(commandRunner, "nvidia-smi", [
    "--query-compute-apps=pid,process_name,used_gpu_memory",
    "--format=csv,noheader,nounits",
  ], root, true);
  const pmonResult = runExternal(commandRunner, "nvidia-smi", ["pmon", "-c", "1", "-s", "um"], root, true);
  const blockers = [];
  const gpuRows = String(gpuResult.stdout ?? "").split(/\r?\n/u).map((row) => row.trim()).filter(Boolean);
  if (gpuResult.error || gpuResult.status !== 0) blockers.push("nvidia_smi_gpu_query_failed");
  if (gpuRows.length !== 1) blockers.push("gpu_inventory_not_exactly_one");
  let gpu = {};
  if (gpuRows.length === 1) {
    const parts = gpuRows[0].split(",").map((part) => part.trim());
    if (parts.length !== 7) blockers.push("nvidia_smi_gpu_row_invalid");
    else {
      const values = parts.slice(2).map(Number);
      if (values.some((value) => !Number.isFinite(value))) blockers.push("nvidia_smi_gpu_values_invalid");
      else {
        gpu = {
          name: parts[0],
          driverVersion: parts[1],
          utilizationPercent: values[0],
          usedMemoryMiB: values[1],
          freeMemoryMiB: values[2],
          totalMemoryMiB: values[3],
          temperatureCelsius: values[4],
        };
        if (gpu.utilizationPercent > MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT) blockers.push("gpu_utilization_above_idle_limit");
        if (gpu.usedMemoryMiB > MAXIMUM_NONQUALIFICATION_GPU_MEMORY_MIB) blockers.push("nonqualification_gpu_memory_above_limit");
        if (gpu.freeMemoryMiB < MINIMUM_FREE_GPU_MEMORY_MIB) blockers.push("free_gpu_memory_below_limit");
      }
    }
  }
  if (computeResult.error || computeResult.status !== 0) blockers.push("nvidia_smi_compute_process_query_failed");
  const computeRows = parseNvidiaComputeProcesses(computeResult.stdout ?? "");
  const pmonRows = parseNvidiaPmonProcesses(pmonResult.stdout ?? "");
  if ((pmonResult.error || pmonResult.status !== 0) && computeRows.length > 0) blockers.push("nvidia_smi_pmon_query_failed");
  const unresolvedPids = computeRows
    .filter((row) => Number.isInteger(row.pid) && UNKNOWN_NVIDIA_NAMES.has(String(row.nvidiaProcessName ?? "").toLowerCase()))
    .map((row) => row.pid);
  const wmi = queryWmiProcessIdentities({ pids: unresolvedPids, root, commandRunner });
  if (unresolvedPids.length > 0 && wmi.status !== "completed") blockers.push("wmi_gpu_process_resolution_failed");
  const classified = classifyGpuProcesses({ computeRows, pmonRows, wmiRows: wmi.rows });
  blockers.push(...classified.blockers);
  const disk = fs.statfsSync(root);
  const runtimeRoot = resolveProjectPath(root, ".runtime", { mustExist: true, kind: "directory" });
  const runtimeDisk = fs.statfsSync(runtimeRoot);
  const projectFreeBytes = Number(disk.bavail) * Number(disk.bsize);
  const runtimeFreeBytes = Number(runtimeDisk.bavail) * Number(runtimeDisk.bsize);
  if (projectFreeBytes < MINIMUM_FREE_DISK_BYTES) blockers.push("project_free_disk_below_limit");
  if (runtimeFreeBytes < MINIMUM_FREE_DISK_BYTES) blockers.push("runtime_free_disk_below_limit");
  const report = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-resource-preflight-v1",
    status: blockers.length === 0 ? "passed" : "failed",
    gpu: {
      ...gpu,
      processClassificationContract: "windows_wddm_pmon_wmi_compute_conflict_v1",
      computeProcesses: classified.rows,
      wmiReconciliation: { status: wmi.status, requestedPids: unresolvedPids, resolvedPids: Object.keys(wmi.rows).map(Number) },
      safeWddmGraphicsProcessCount: classified.rows.filter((row) => row.classification === "idle_wddm_graphics").length,
      conflictingComputeProcessCount: classified.rows.filter((row) => row.classification === "conflicting_compute").length,
    },
    disk: { projectFreeBytes, runtimeFreeBytes, minimumFreeBytes: MINIMUM_FREE_DISK_BYTES },
    limits: {
      maximumIdleGpuUtilizationPercent: MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT,
      maximumNonqualificationGpuMemoryMiB: MAXIMUM_NONQUALIFICATION_GPU_MEMORY_MIB,
      minimumFreeGpuMemoryMiB: MINIMUM_FREE_GPU_MEMORY_MIB,
      maximumIdleProcessSmUtilizationPercent: MAXIMUM_IDLE_PROCESS_SM_UTILIZATION_PERCENT,
    },
    blockers: [...new Set(blockers)].sort(),
    gpuWorkloadStarted: false,
    recordedAtUtc: now().toISOString(),
  };
  assert.deepEqual(report.blockers, [], `resource preflight failed: ${report.blockers.join(",")}`);
  return report;
}

export function parseNvidiaComputeProcesses(stdout) {
  const rows = [];
  for (const raw of String(stdout).split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || line.toLowerCase().startsWith("no running")) continue;
    const parts = line.split(",", 3).map((part) => part.trim());
    if (parts.length !== 3 || !/^\d+$/u.test(parts[0])) {
      rows.push({ raw: line, parseStatus: "invalid", pid: null, nvidiaProcessName: null, usedGpuMemoryMiB: null });
      continue;
    }
    rows.push({
      raw: line,
      parseStatus: "parsed",
      pid: Number(parts[0]),
      nvidiaProcessName: parts[1],
      usedGpuMemoryMiB: optionalInteger(parts[2]),
      usedGpuMemoryRaw: parts[2],
    });
  }
  return rows;
}

export function parseNvidiaPmonProcesses(stdout) {
  const rows = {};
  for (const raw of String(stdout).split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/u);
    if (parts.length < 5 || !/^\d+$/u.test(parts[1])) continue;
    rows[Number(parts[1])] = {
      gpuIndex: optionalInteger(parts[0]),
      pid: Number(parts[1]),
      processType: parts[2].toUpperCase(),
      smUtilizationPercent: optionalInteger(parts[3]),
      memoryUtilizationPercent: optionalInteger(parts[4]),
      command: parts.length >= 6 ? parts.at(-1) : null,
      raw: line,
    };
  }
  return rows;
}

export function classifyGpuProcesses({ computeRows, pmonRows, wmiRows }) {
  const rows = [];
  const blockers = [];
  for (const row of computeRows) {
    const reasons = [];
    const pmon = Number.isInteger(row.pid) ? pmonRows[row.pid] ?? {} : {};
    const wmi = Number.isInteger(row.pid) ? wmiRows[row.pid] ?? {} : {};
    const nvidiaName = String(row.nvidiaProcessName ?? "");
    const unresolved = UNKNOWN_NVIDIA_NAMES.has(nvidiaName.toLowerCase());
    const resolvedName = windowsBasename(wmi.executablePath)
      || windowsBasename(wmi.name)
      || (unresolved ? "" : windowsBasename(nvidiaName));
    const identityText = [resolvedName, nvidiaName, wmi.executablePath, wmi.commandLine, pmon.command]
      .map((value) => String(value ?? "").toLowerCase()).join(" ");
    const processType = String(pmon.processType ?? "").toUpperCase();
    const riskIdentity = COMPUTE_RISK_TOKENS.some((token) => identityText.includes(token));
    const knownGraphics = KNOWN_WINDOWS_GRAPHICS_PROCESSES.has(resolvedName);
    const hasCompute = processType.includes("C");
    const hasGraphics = processType.includes("G");
    if (row.parseStatus !== "parsed") reasons.push("gpu_process_row_unparseable");
    if (unresolved && !resolvedName) reasons.push("gpu_process_identity_unresolved");
    if (hasCompute || riskIdentity) reasons.push("conflicting_gpu_compute_process_detected");
    if (!knownGraphics && !hasGraphics && (row.usedGpuMemoryMiB ?? 0) > 0) reasons.push("unclassified_gpu_process_detected");
    if ((pmon.smUtilizationPercent ?? 0) > MAXIMUM_IDLE_PROCESS_SM_UTILIZATION_PERCENT) reasons.push("gpu_process_sm_utilization_above_idle_limit");
    blockers.push(...reasons);
    rows.push({
      pid: row.pid,
      nvidiaProcessName: nvidiaName,
      resolvedProcessName: resolvedName || null,
      usedGpuMemoryMiB: row.usedGpuMemoryMiB,
      usedGpuMemoryRaw: row.usedGpuMemoryRaw,
      pmonType: processType || null,
      pmonSmUtilizationPercent: pmon.smUtilizationPercent ?? null,
      wmiIdentity: Object.keys(wmi).length > 0 ? wmi : null,
      classification: reasons.length > 0 ? "conflicting_compute" : "idle_wddm_graphics",
      blockingReasons: reasons,
    });
  }
  return { rows, blockers: [...new Set(blockers)].sort() };
}

function queryWmiProcessIdentities({ pids, root, commandRunner }) {
  if (pids.length === 0) return { status: "not_required", rows: {} };
  if (process.platform !== "win32") return { status: "unsupported_non_windows", rows: {} };
  const safePids = [...new Set(pids.filter((pid) => Number.isInteger(pid) && pid > 0))].sort((a, b) => a - b);
  const script = [
    "$ErrorActionPreference='Stop'",
    `$ids=@(${safePids.join(",")})`,
    "$rows=@(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $ids -contains [int]$_.ProcessId } | Select-Object ProcessId,Name,ExecutablePath,CommandLine)",
    "ConvertTo-Json -InputObject $rows -Compress",
  ].join(";");
  const result = commandRunner("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return { status: "failed", rows: {} };
  try {
    const parsed = String(result.stdout).trim() ? JSON.parse(String(result.stdout).replace(/^\uFEFF/u, "")) : [];
    if (!Array.isArray(parsed)) return { status: "failed_invalid_shape", rows: {} };
    const rows = {};
    for (const item of parsed) {
      if (Number.isInteger(item?.ProcessId) && safePids.includes(item.ProcessId)) {
        rows[item.ProcessId] = {
          processId: item.ProcessId,
          name: item.Name ?? null,
          executablePath: item.ExecutablePath ?? null,
          commandLine: item.CommandLine ?? null,
        };
      }
    }
    return { status: "completed", rows };
  } catch {
    return { status: "failed_invalid_json", rows: {} };
  }
}

function buildActiveConfig({ packagePayload, ticket, ticketBinding, consumptionBinding, preflightBinding }) {
  return {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-active-config-v1",
    status: "active",
    packageId: packagePayload.packageId,
    runId: packagePayload.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    outputDirectory: packagePayload.outputDirectory,
    ticket: {
      ticketId: ticket.ticketId,
      ticketPath: ticketBinding.path,
      ticketSha256: ticketBinding.sha256,
      consumptionPath: consumptionBinding.path,
      consumptionSha256: consumptionBinding.sha256,
      status: "consumed_once",
    },
    bindings: packagePayload.bindings,
    programLineage: packagePayload.programLineage,
    fixedInputs: packagePayload.fixedInputs,
    autoencoderBinding: packagePayload.autoencoderBinding,
    preflightReport: preflightBinding,
    safety: {
      gpuForwardAllowed: true,
      autogradGradAllowed: true,
      autoencoderCheckpointReadAllowed: true,
      denoiserCheckpointReadAllowed: false,
      optimizerAllowed: false,
      backwardAllowed: false,
      weightMutationAllowed: false,
      checkpointWriteAllowed: false,
      trainingAllowed: false,
      smokeAllowed: false,
      stage0Allowed: false,
      formalInferenceAllowed: false,
      runtimeFrameAllowed: false,
      worldEntryAllowed: false,
    },
    recordedAtUtc: new Date().toISOString(),
  };
}

function invokePythonQualification({ root, packagePayload, activeConfigBinding, outputRoot }) {
  const python = resolveProjectPath(root, PYTHON_RELATIVE, { mustExist: true, kind: "file" });
  const runner = resolveProjectPath(root, packagePayload.programLineage[PYTHON_RUNNER_ROLE].path, { mustExist: true, kind: "file" });
  return runNonBlockingChildProcess({
    command: python,
    args: [
      "-B",
      runner,
      "--active-config", resolveProjectPath(root, activeConfigBinding.path, { mustExist: true, kind: "file" }),
      "--active-config-sha256", activeConfigBinding.sha256,
      "--output-dir", outputRoot,
    ],
    cwd: root,
    env: pythonEnvironment(root, true),
    timeoutMs: QUALIFICATION_TIMEOUT_MS,
    maxOutputBytes: 64 * 1024 * 1024,
  });
}

export function runNonBlockingChildProcess({
  command,
  args,
  cwd,
  env = process.env,
  timeoutMs,
  maxOutputBytes,
}) {
  const child = spawn(command, args, { cwd, windowsHide: true, env });
  return new Promise((resolve) => {
    const stdout = [];
    const stderr = [];
    let byteCount = 0;
    let completed = false;
    let timer = null;
    let forcedError = null;
    const finish = (value) => {
      if (completed) return;
      completed = true;
      if (timer !== null) clearTimeout(timer);
      resolve(value);
    };
    const collect = (target) => (chunk) => {
      if (forcedError !== null) return;
      byteCount += chunk.length;
      if (byteCount > maxOutputBytes) {
        forcedError = new Error("bounded child process output exceeded limit");
        child.kill();
        return;
      }
      target.push(Buffer.from(chunk));
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.on("error", (error) => finish({ status: null, error, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }));
    child.on("close", (status) => finish({ status, error: forcedError, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }));
    timer = setTimeout(() => {
      forcedError = new Error("bounded child process timed out");
      child.kill();
    }, timeoutMs);
  });
}

export function validatePythonQualificationEvidence({ root, packagePayload, activeConfigBinding, outputRoot }) {
  const paths = {
    gpuDiagnostic: path.join(outputRoot, "gpu-diagnostic.json"),
    cudaTelemetry: path.join(outputRoot, "cuda-telemetry.json"),
    stateIntegrity: path.join(outputRoot, "state-integrity.json"),
    qualificationResult: path.join(outputRoot, "qualification-result.json"),
  };
  for (const filePath of Object.values(paths)) {
    assert.equal(fs.existsSync(filePath), true, `Python qualification evidence missing: ${path.basename(filePath)}`);
    assert.equal(fs.statSync(filePath).isFile(), true);
  }
  const diagnostic = readJsonObject(paths.gpuDiagnostic);
  const cuda = readJsonObject(paths.cudaTelemetry);
  const state = readJsonObject(paths.stateIntegrity);
  const result = readJsonObject(paths.qualificationResult);
  const activeConfig = readBoundProjectJson(root, activeConfigBinding);

  assert.equal(diagnostic.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-diagnostic-v1");
  assert.equal(cuda.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-cuda-telemetry-v1");
  assert.equal(state.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-state-integrity-v1");
  assert.equal(result.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-qualification-v1");
  assert.equal(result.packageId, packagePayload.packageId, "qualification result package mismatch");
  assert.equal(result.runId, packagePayload.runId, "qualification result run mismatch");
  assert.equal(result.architectureId, STAGE4_V2_CAPABILITY, "qualification result architecture mismatch");
  assert.equal(result.status, "stage4_v2_readonly_gpu_qualification_passed", "qualification result did not pass");
  assert.equal(result.executionState, "completed", "qualification result is not terminal");
  assertBindingIdentity(result.activeConfig, activeConfigBinding, "qualification active config");
  assert.equal(result.ticket?.ticketId, activeConfig.ticket?.ticketId,
    "qualification ticket identity mismatch");
  assert.equal(result.ticket?.status, "consumed_once", "qualification ticket was not consumed once");
  assertProjectBinding(root, result.ticket?.ticket, "qualification signed ticket");
  assertProjectBinding(root, result.ticket?.consumption, "qualification ticket consumption");
  assertBindingIdentity(result.ticket.ticket, {
    path: activeConfig.ticket.ticketPath,
    sha256: activeConfig.ticket.ticketSha256,
  }, "qualification signed ticket");
  assertBindingIdentity(result.ticket.consumption, {
    path: activeConfig.ticket.consumptionPath,
    sha256: activeConfig.ticket.consumptionSha256,
  }, "qualification ticket consumption");
  assert.equal(result.ownerAuthorizationRequired, false, "qualification reintroduced an Owner gate");
  assert.equal(result.automaticSmokeStarted, false, "qualification automatically started Smoke");
  assertProjectBinding(root, result.gpuDiagnostic, "qualification GPU diagnostic");
  assertProjectBinding(root, result.cudaTelemetry, "qualification CUDA telemetry");
  assertProjectBinding(root, result.stateIntegrity, "qualification state integrity");
  assertBindingIdentity(result.gpuDiagnostic, bindAbsolute(root, paths.gpuDiagnostic), "qualification GPU diagnostic");
  assertBindingIdentity(result.cudaTelemetry, bindAbsolute(root, paths.cudaTelemetry), "qualification CUDA telemetry");
  assertBindingIdentity(result.stateIntegrity, bindAbsolute(root, paths.stateIntegrity), "qualification state integrity");

  assert.equal(diagnostic.status, "passed", "GPU diagnostic did not pass");
  assert.equal(diagnostic.packageId, packagePayload.packageId, "diagnostic package mismatch");
  assert.equal(diagnostic.runId, packagePayload.runId, "diagnostic run mismatch");
  assert.equal(diagnostic.architectureId, STAGE4_V2_CAPABILITY, "diagnostic architecture mismatch");
  const datasetRelease = readBoundProjectJson(root, packagePayload.bindings.datasetRelease);
  assert.equal(diagnostic.datasetReleaseIdentity, datasetRelease.datasetReleaseIdentity,
    "diagnostic dataset release mismatch");
  assert.equal(diagnostic.seed, packagePayload.fixedInputs.seed, "diagnostic seed mismatch");
  assert.deepEqual(diagnostic.resolution, packagePayload.fixedInputs.resolution, "diagnostic resolution mismatch");
  assert.equal(diagnostic.diffusionTimestep, packagePayload.fixedInputs.diffusionTimestep,
    "diagnostic diffusion timestep mismatch");
  assert.equal(diagnostic.formalObjective, "formal_v6_composite_exact_reuse_v1",
    "diagnostic formal objective mismatch");
  validateQualificationParameterInventory(diagnostic.parameterInventory,
    packagePayload.fixedInputs.responsibilities);
  const recomputedGraph = validateQualificationSampleEvidence({
    diagnostic,
    fixedInputs: packagePayload.fixedInputs,
  });
  assert.equal(diagnostic.all210ParametersReached,
    recomputedGraph.aggregateAllParametersReached,
    "aggregate formal graph reachability summary is forged or stale");
  assert.equal(diagnostic.sample194All210ParametersReached,
    recomputedGraph.validationAllParametersReached,
    "sample 194 reachability summary is forged or stale");
  validateQualificationSourceBindings({
    root,
    diagnostic,
    packagePayload,
    datasetRelease,
  });
  assert.equal(diagnostic.safety?.autoencoderCheckpointRead, true);
  assert.equal(diagnostic.safety?.autoencoderFrozen, true);
  for (const field of [
    "denoiserCheckpointRead", "optimizerCreated", "backwardExecuted", "weightsModified",
    "checkpointWritten", "smokeStarted", "trainingStarted",
  ]) assert.equal(diagnostic.safety?.[field], false, `diagnostic safety ${field} is open`);

  assert.equal(cuda.status, "measured", "CUDA telemetry did not complete measurement");
  assert.equal(cuda.deviceIndex, 0, "CUDA telemetry used the wrong device");
  assert.deepEqual(cuda.measuredResolution, packagePayload.fixedInputs.resolution,
    "CUDA telemetry resolution mismatch");
  validateQualificationCudaTelemetry(cuda);
  assert.equal(cuda.preflightMemoryUsedAsDiagnosticPeak, false,
    "preflight memory was substituted for diagnostic peak memory");
  assert.equal(cuda.native1024x768PeakClaimed, false,
    "Stage 0 qualification falsely claimed native 1024x768 peak memory");

  assert.equal(state.status, "verified_unchanged", "model state integrity did not pass");
  assert.equal(state.denoiserUnchanged, true, "Denoiser state changed");
  assert.equal(state.autoencoderUnchanged, true, "Autoencoder state changed");
  assert.equal(state.autoencoderTraining, false, "Autoencoder left eval mode");
  assert.equal(state.autoencoderRequiresGradParameterCount, 0, "Autoencoder parameters require gradients");
  assert.equal(state.allParameterGradFieldsRemainNone, true, "qualification populated parameter .grad fields");
  assertSingleStateIdentity(state.autoencoder, "Autoencoder", [
    "checkpointState", "loaded", "beforeQualification", "afterQualification",
  ]);
  assertSingleStateIdentity(state.denoiser, "Denoiser", [
    "fixedInitialization", "beforeQualification", "afterQualification",
  ]);
  return Object.freeze({
    gpuDiagnostic: bindAbsolute(root, paths.gpuDiagnostic),
    cudaTelemetry: bindAbsolute(root, paths.cudaTelemetry),
    stateIntegrity: bindAbsolute(root, paths.stateIntegrity),
    qualificationResult: bindAbsolute(root, paths.qualificationResult),
  });
}

function assertSingleStateIdentity(value, label, expectedKeys) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} hash set is missing`);
  assert.deepEqual(Object.keys(value), expectedKeys, `${label} hash boundary keys changed`);
  const hashes = Object.values(value);
  for (const hash of hashes) assert.match(hash, /^[a-f0-9]{64}$/u, `${label} state hash is invalid`);
  assert.equal(new Set(hashes).size, 1, `${label} state hashes changed across qualification`);
}

function validateQualificationParameterInventory(inventory, responsibilities) {
  assert.ok(inventory && typeof inventory === "object" && !Array.isArray(inventory),
    "diagnostic parameter inventory is missing");
  assert.equal(inventory.parameterTensorCount, QUALIFICATION_PARAMETER_TENSOR_COUNT,
    "diagnostic parameter tensor identity changed");
  assert.equal(inventory.parameterScalarCount, QUALIFICATION_PARAMETER_SCALAR_COUNT,
    "diagnostic parameter scalar identity changed");
  assert.equal(inventory.sharedParameterTensorCount,
    QUALIFICATION_SHARED_PARAMETER_TENSOR_COUNT,
    "diagnostic shared parameter tensor identity changed");
  assert.equal(inventory.autoencoderParameterTensorCount,
    QUALIFICATION_AUTOENCODER_PARAMETER_TENSOR_COUNT,
    "diagnostic Autoencoder parameter tensor identity changed");
  assert.equal(inventory.autoencoderParameterScalarCount,
    QUALIFICATION_AUTOENCODER_PARAMETER_SCALAR_COUNT,
    "diagnostic Autoencoder parameter scalar identity changed");
  assert.equal(inventory.optimizerParameterIdentityExact, true);
  assert.equal(inventory.autoencoderExcluded, true);
  assert.equal(inventory.privateParameterNamespacesPairwiseDisjoint, true);
  assert.deepEqual(Object.keys(inventory.responsibilityNamespaces ?? {}), responsibilities,
    "diagnostic responsibility namespace order/identity changed");
  for (const identity of responsibilities) {
    assert.deepEqual(inventory.responsibilityNamespaces[identity], {
      responsibilityPathTensorCount: QUALIFICATION_RESPONSIBILITY_PATH_TENSOR_COUNT,
      rgbHeadTensorCount: QUALIFICATION_RGB_HEAD_TENSOR_COUNT,
    }, `diagnostic responsibility namespace count changed: ${identity}`);
  }
}

function validateQualificationSampleEvidence({ diagnostic, fixedInputs }) {
  assert.deepEqual(diagnostic.latentShape, [1, fixedInputs.latentChannels, 48, 64],
    "diagnostic latent shape changed");
  assert.deepEqual(diagnostic.conditionShape, [1, fixedInputs.conditionChannels, 192, 256],
    "diagnostic condition shape changed");
  assert.ok(Array.isArray(diagnostic.samples), "diagnostic samples are missing");
  assert.equal(diagnostic.samples.length, 2, "diagnostic must contain exactly two fixed samples");
  const expectedSamples = [
    {
      role: "first_formal_train_record",
      sampleId: fixedInputs.firstTrainSampleId,
      split: "train",
      requireAll: false,
    },
    {
      role: "fixed_validation_sample_194",
      sampleId: fixedInputs.fixedValidationSampleId,
      split: "validation",
      requireAll: true,
    },
  ];
  const responsibilitySet = new Set(fixedInputs.responsibilities);
  let parameterIdentity = null;
  const aggregateNonzero = new Set();
  let validationAllParametersReached = false;
  for (const [index, sample] of diagnostic.samples.entries()) {
    const expected = expectedSamples[index];
    assert.equal(sample.role, expected.role, `diagnostic sample role changed at ${index}`);
    assert.equal(sample.sampleId, expected.sampleId, `diagnostic sample identity changed: ${expected.role}`);
    assert.equal(sample.split, expected.split, `diagnostic sample split changed: ${expected.role}`);
    assert.equal(sample.timestep, fixedInputs.diffusionTimestep,
      `diagnostic sample timestep changed: ${expected.role}`);
    assert.equal(sample.formalObjective, "formal_v6_composite_exact_reuse_v1",
      `diagnostic sample objective changed: ${expected.role}`);
    assert.ok(Number.isFinite(sample.compositeLoss) && sample.compositeLoss >= 0,
      `diagnostic sample loss is invalid: ${expected.role}`);
    assert.deepEqual(Object.keys(sample.responsibilityOccupancy ?? {}),
      fixedInputs.responsibilities,
      `diagnostic responsibility occupancy identity changed: ${expected.role}`);
    for (const identity of fixedInputs.responsibilities) {
      assert.equal(typeof sample.responsibilityOccupancy[identity], "boolean",
        `diagnostic responsibility occupancy is invalid: ${expected.role}:${identity}`);
    }
    if (expected.requireAll) {
      assert.equal(Object.values(sample.responsibilityOccupancy).every(Boolean), true,
        "fixed validation sample does not cover every responsibility");
    }
    const gradient = sample.parameterGradients;
    assert.equal(gradient?.parameterTensorCount, QUALIFICATION_PARAMETER_TENSOR_COUNT,
      `parameter gradient count changed: ${expected.role}`);
    assert.ok(Array.isArray(gradient.parameters),
      `parameter gradient rows are missing: ${expected.role}`);
    assert.equal(gradient.parameters.length, QUALIFICATION_PARAMETER_TENSOR_COUNT,
      `parameter gradient row count changed: ${expected.role}`);
    const names = [];
    const nonzeroNames = [];
    const permittedAbsent = [];
    let scalarCount = 0;
    for (const row of gradient.parameters) {
      assert.ok(typeof row.parameterName === "string" && row.parameterName.length > 0,
        `parameter gradient name is invalid: ${expected.role}`);
      assert.ok(Array.isArray(row.shape) && row.shape.length > 0
        && row.shape.every((value) => Number.isInteger(value) && value > 0),
      `parameter gradient shape is invalid: ${row.parameterName}`);
      scalarCount += row.shape.reduce((product, value) => product * value, 1);
      const privateResponsibility = inferPrivateResponsibility(
        row.parameterName, fixedInputs.responsibilities,
      );
      assert.equal(row.privateResponsibility, privateResponsibility,
        `parameter private responsibility is forged: ${row.parameterName}`);
      const required = expected.requireAll || privateResponsibility === null
        || sample.responsibilityOccupancy[privateResponsibility] === true;
      assert.equal(row.requiredForSample, required,
        `parameter required-for-sample flag is forged: ${row.parameterName}`);
      assert.equal(typeof row.gradientPresent, "boolean");
      assert.equal(row.finite, true,
        `parameter gradient is not finite: ${row.parameterName}`);
      assert.equal(typeof row.nonzero, "boolean");
      if (required) {
        assert.equal(row.gradientPresent, true,
          `required parameter gradient is absent: ${row.parameterName}`);
        assert.equal(row.nonzero, true,
          `required parameter gradient is zero: ${row.parameterName}`);
      }
      if (row.gradientPresent && row.nonzero) {
        assert.ok(Number.isFinite(row.maximumAbsoluteGradient)
          && row.maximumAbsoluteGradient > 0,
        `parameter maximum gradient is invalid: ${row.parameterName}`);
      }
      if (!row.gradientPresent) {
        assert.equal(row.nonzero, false,
          `absent parameter gradient is marked nonzero: ${row.parameterName}`);
      }
      names.push(row.parameterName);
      if (row.nonzero) nonzeroNames.push(row.parameterName);
      else if (!required) permittedAbsent.push(row.parameterName);
    }
    assert.equal(new Set(names).size, QUALIFICATION_PARAMETER_TENSOR_COUNT,
      `parameter names are duplicated: ${expected.role}`);
    assert.equal(scalarCount, QUALIFICATION_PARAMETER_SCALAR_COUNT,
      `parameter scalar count recomputation failed: ${expected.role}`);
    assert.deepEqual(gradient.nonzeroParameterNames, nonzeroNames,
      `parameter nonzero-name summary is forged: ${expected.role}`);
    assert.equal(gradient.nonzeroParameterTensorCount, nonzeroNames.length,
      `parameter nonzero-count summary is forged: ${expected.role}`);
    assert.deepEqual(gradient.permittedAbsentOrZeroParameterNames, permittedAbsent,
      `parameter permitted-absence summary is forged: ${expected.role}`);
    assert.equal(gradient.allRequiredParametersFiniteNonzero, true);
    const currentIdentity = gradient.parameters.map((row) => ({
      parameterName: row.parameterName,
      shape: row.shape,
      privateResponsibility: row.privateResponsibility,
    }));
    if (parameterIdentity === null) parameterIdentity = currentIdentity;
    else assert.deepEqual(currentIdentity, parameterIdentity,
      "parameter name/shape/private-responsibility changed across samples");
    for (const name of nonzeroNames) aggregateNonzero.add(name);
    if (expected.requireAll) {
      validationAllParametersReached = nonzeroNames.length
        === QUALIFICATION_PARAMETER_TENSOR_COUNT;
    }
    validateTensorGradientEvidence(sample.noisyLatentGradient,
      [1, fixedInputs.latentChannels, 48, 64], "noisy latent", fixedInputs.latentChannels);
    validateTensorGradientEvidence(sample.conditionGradient,
      [1, fixedInputs.conditionChannels, 192, 256], "condition", fixedInputs.conditionChannels);
    validateTypedResizeEvidence(sample.typedResize, fixedInputs.conditionChannels);
    validateForwardEvidence(sample.forwardEvidence, fixedInputs, responsibilitySet,
      sample.responsibilityOccupancy);
    assert.equal(sample.allParameterGradFieldsRemainNone, true,
      `sample populated parameter .grad fields: ${expected.role}`);
  }
  return {
    aggregateAllParametersReached: aggregateNonzero.size
      === QUALIFICATION_PARAMETER_TENSOR_COUNT,
    validationAllParametersReached,
  };
}

function inferPrivateResponsibility(name, responsibilities) {
  for (const identity of responsibilities) {
    if (name.startsWith(`responsibility_paths.${identity}.`)
      || name.startsWith(`rgb_responsibility_heads.${identity}.`)) return identity;
  }
  return null;
}

function validateTensorGradientEvidence(value, shape, label, channelCount) {
  assert.deepEqual(value?.shape, shape, `${label} gradient shape changed`);
  assert.equal(value.finite, true, `${label} gradient is nonfinite`);
  assert.equal(value.nonzero, true, `${label} gradient is zero`);
  assert.equal(value.allChannelsNonzero, true,
    `${label} gradient has an unreachable channel`);
  assert.ok(Array.isArray(value.perChannelMaximumAbsoluteGradient)
    && value.perChannelMaximumAbsoluteGradient.length === channelCount,
  `${label} per-channel gradient summary is incomplete`);
  assert.equal(value.perChannelMaximumAbsoluteGradient.every(
    (item) => Number.isFinite(item) && item > 0,
  ), true, `${label} per-channel gradient summary is invalid`);
}

function validateTypedResizeEvidence(value, conditionChannels) {
  assert.equal(value?.status, "exact_reference_match",
    "typed-resize reference comparison did not pass");
  assert.deepEqual(value.shape, [1, conditionChannels, 48, 64],
    "typed-resize output shape changed");
  assert.equal(value.discreteMode, "nearest");
  assert.equal(value.continuousMode, "bilinear_align_corners_false");
  assert.equal(value.maximumAbsoluteDifference, 0,
    "typed-resize evidence is not byte-exact to its reference");
}

function validateForwardEvidence(value, fixedInputs, responsibilitySet, occupancy) {
  assert.deepEqual(value?.velocityShape, [1, fixedInputs.latentChannels, 48, 64]);
  assert.deepEqual(value.conditionProbeShape, [1, fixedInputs.conditionChannels, 48, 64]);
  assert.deepEqual(value.rgbShape, [1, 3, 192, 256]);
  assert.ok(Array.isArray(value.responsibilities));
  assert.deepEqual(value.responsibilities.map((row) => row.identity),
    [...responsibilitySet], "forward responsibility order changed");
  for (const row of value.responsibilities) {
    assert.equal(row.preservedMaskNonzero, occupancy[row.identity],
      `forward preserved-mask occupancy changed: ${row.identity}`);
    assert.deepEqual(row.transportWeightsShape, [1, 9, 48, 64]);
    assert.ok(Number.isFinite(row.transportWeightSumTolerance)
      && row.transportWeightSumTolerance > 0
      && row.transportWeightSumTolerance <= 0.001,
    `forward transport tolerance is invalid: ${row.identity}`);
  }
  assert.equal(value.rgbMasksExact, true);
  assert.equal(value.rgbGatingExact, true);
  assert.equal(value.outsideResponsibilityUnionEqualsBaseRgb, true);
}

function validateQualificationSourceBindings({
  root, diagnostic, packagePayload, datasetRelease,
}) {
  const source = diagnostic.sourceBindings;
  assert.deepEqual(Object.keys(source ?? {}), [
    "datasetRelease", "sourceManifest", "sourceIndex", "trainAssets", "validationAssets",
  ], "diagnostic source-binding identity changed");
  assertBindingIdentity(source.datasetRelease, packagePayload.bindings.datasetRelease,
    "diagnostic dataset release binding");
  assertProjectBinding(root, source.datasetRelease, "diagnostic dataset release binding");
  assertBindingIdentity(source.sourceManifest, datasetRelease.sourcePackage?.manifest,
    "diagnostic source manifest");
  assertBindingIdentity(source.sourceIndex, datasetRelease.sourcePackage?.sourceIndex,
    "diagnostic source index");
  assertProjectBinding(root, source.sourceManifest, "diagnostic source manifest");
  assertProjectBinding(root, source.sourceIndex, "diagnostic source index");
  const conditionContract = readBoundProjectJson(root,
    packagePayload.bindings.conditionContract);
  const channelOrder = conditionContract.tensorContract?.channelOrder;
  assert.ok(Array.isArray(channelOrder)
    && channelOrder.length === packagePayload.fixedInputs.conditionChannels,
  "condition contract channel order is invalid");
  const expectedAssets = [
    [source.trainAssets, packagePayload.fixedInputs.firstTrainSampleId, "train"],
    [source.validationAssets, packagePayload.fixedInputs.fixedValidationSampleId, "validation"],
  ];
  for (const [assets, sampleId, split] of expectedAssets) {
    const matches = (datasetRelease.samples ?? []).filter((row) => row.sampleId === sampleId);
    assert.equal(matches.length, 1, `dataset release sample identity is not unique: ${sampleId}`);
    const released = matches[0];
    assert.equal(released.split, split, `dataset release sample split changed: ${sampleId}`);
    for (const role of ["image", "conditionPack", "contribution"]) {
      assertBindingIdentity(assets?.[role], released[role], `${sampleId} ${role}`);
      assertProjectBinding(root, assets[role], `${sampleId} ${role}`);
    }
    assert.ok(Array.isArray(assets.channels)
      && assets.channels.length === channelOrder.length,
    `diagnostic channel bindings are incomplete: ${sampleId}`);
    assert.deepEqual(assets.channels.map((row) => row.id), channelOrder,
      `diagnostic channel order changed: ${sampleId}`);
    for (const [index, channel] of assets.channels.entries()) {
      assert.equal(channel.id, channelOrder[index]);
      assertProjectBinding(root, channel, `${sampleId} channel ${channel.id}`);
    }
  }
}

function validateQualificationCudaTelemetry(cuda) {
  const phaseNames = [
    "model_loaded", "formal_train_latent_normalization",
    "first_formal_train_record", "fixed_validation_sample_194",
  ];
  assert.deepEqual(cuda.phases?.map((entry) => entry.phase), phaseNames,
    "CUDA telemetry phase sequence mismatch");
  assert.ok(typeof cuda.deviceName === "string" && cuda.deviceName.length > 0,
    "CUDA telemetry device name is missing");
  assert.ok(Array.isArray(cuda.deviceCapability) && cuda.deviceCapability.length === 2
    && cuda.deviceCapability.every((value) => Number.isInteger(value) && value >= 0),
  "CUDA telemetry device capability is invalid");
  for (const field of ["torchVersion", "cudaRuntimeVersion", "pythonVersion"]) {
    assert.ok(typeof cuda[field] === "string" && cuda[field].length > 0,
      `CUDA telemetry ${field} is missing`);
  }
  for (const field of [
    "driverFreeBytesBefore", "driverTotalBytesBefore",
    "driverFreeBytesAfter", "driverTotalBytesAfter",
  ]) assert.ok(Number.isInteger(cuda[field]) && cuda[field] >= 0,
    `CUDA telemetry ${field} is invalid`);
  assert.ok(cuda.driverTotalBytesBefore > 0 && cuda.driverTotalBytesAfter > 0);
  assert.ok(cuda.driverFreeBytesBefore <= cuda.driverTotalBytesBefore);
  assert.ok(cuda.driverFreeBytesAfter <= cuda.driverTotalBytesAfter);
  let priorTimestamp = Number.NEGATIVE_INFINITY;
  for (const row of cuda.phases) {
    const timestamp = Date.parse(row.recordedAtUtc);
    assert.ok(Number.isFinite(timestamp) && timestamp >= priorTimestamp,
      `CUDA phase timestamp is invalid or non-monotonic: ${row.phase}`);
    priorTimestamp = timestamp;
    assert.ok(Number.isFinite(row.durationSeconds) && row.durationSeconds >= 0,
      `CUDA phase duration is invalid: ${row.phase}`);
    for (const field of [
      "allocatedBytes", "reservedBytes", "peakAllocatedBytes", "peakReservedBytes",
      "driverFreeBytes", "driverTotalBytes",
    ]) assert.ok(Number.isInteger(row[field]) && row[field] >= 0,
      `CUDA phase ${row.phase} ${field} is invalid`);
    assert.ok(row.allocatedBytes <= row.reservedBytes,
      `CUDA phase allocated memory exceeds reserved memory: ${row.phase}`);
    assert.ok(row.allocatedBytes <= row.peakAllocatedBytes,
      `CUDA phase peak allocated memory is stale: ${row.phase}`);
    assert.ok(row.reservedBytes <= row.peakReservedBytes,
      `CUDA phase peak reserved memory is stale: ${row.phase}`);
    assert.ok(row.peakAllocatedBytes <= row.peakReservedBytes,
      `CUDA phase peak allocation exceeds peak reservation: ${row.phase}`);
    assert.ok(row.driverTotalBytes > 0 && row.driverFreeBytes <= row.driverTotalBytes,
      `CUDA phase driver memory is invalid: ${row.phase}`);
  }
  const peakAllocated = Math.max(...cuda.phases.map((row) => row.peakAllocatedBytes));
  const peakReserved = Math.max(...cuda.phases.map((row) => row.peakReservedBytes));
  assert.equal(cuda.peakGpuMemoryBytes, peakAllocated,
    "CUDA peakGpuMemoryBytes is forged or stale");
  assert.equal(cuda.peakReservedBytes, peakReserved,
    "CUDA peakReservedBytes is forged or stale");
  assert.ok(peakAllocated > 0, "CUDA measured peak allocation must be positive");
  assert.ok(Number.isFinite(cuda.durationSeconds) && cuda.durationSeconds >= 0,
    "CUDA total duration is invalid");
}

function assertProjectBinding(root, binding, label) {
  assert.ok(binding && typeof binding === "object" && !Array.isArray(binding), `${label} binding is missing`);
  return bindProjectFile(root, binding.path, binding.sha256);
}

function revalidateNestedProjectBindings(root, value, label = "evidence", seen = new WeakSet()) {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => revalidateNestedProjectBindings(root, entry, `${label}[${index}]`, seen));
    return;
  }
  if (typeof value.path === "string" && /^[a-f0-9]{64}$/u.test(value.sha256 ?? "")) {
    const rebound = bindProjectFile(root, value.path, value.sha256);
    if (value.byteSize !== undefined) {
      assert.equal(rebound.byteSize, value.byteSize, `${label} byte size mismatch`);
    }
  }
  for (const [key, entry] of Object.entries(value)) {
    revalidateNestedProjectBindings(root, entry, `${label}.${key}`, seen);
  }
}

function assertBindingIdentity(actual, expected, label) {
  assert.equal(actual?.path, expected?.path, `${label} path mismatch`);
  assert.equal(actual?.sha256, expected?.sha256, `${label} SHA-256 mismatch`);
}

async function persistFailedClosed({ context, error, commitCurrentRegistry, appendProgramEvent, now }) {
  const root = context.root;
  const payload = context.packagePayload;
  const recordedAtUtc = now().toISOString();
  const activeExecutionEvidence = freezeActiveExecutionEvidence(
    context,
    recordedAtUtc,
    { throwOnHeartbeatError: false },
  );
  const failureRoot = selectFailureRoot(context);
  fs.mkdirSync(path.dirname(failureRoot), { recursive: true });
  if (!fs.existsSync(failureRoot)) fs.mkdirSync(failureRoot, { recursive: false });
  const errorText = error instanceof Error ? error.stack ?? error.message : String(error);
  const failurePath = path.join(failureRoot, "failure-report.json");
  const finalizationPath = path.join(failureRoot, "finalization.json");
  const terminalPath = path.join(failureRoot, "phase-terminal.json");
  const capsulePath = path.join(failureRoot, "task-capsule.json");
  if (!fs.existsSync(failurePath)) writeExclusiveJson(failurePath, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-failure-report-v1",
    executionState: "failed_closed",
    status: "stage4_v2_readonly_gpu_qualification_failed_closed",
    packageId: payload.packageId,
    runId: payload.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    failureCode: classifyFailure(errorText, context),
    error: errorText,
    ticketConsumed: context.ticketConsumed,
    outputDirectoryCreated: context.outputCreated,
    activeExecutionEvidence,
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  const failureBinding = bindAbsolute(root, failurePath);
  if (!fs.existsSync(finalizationPath)) writeExclusiveJson(finalizationPath, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-finalization-v1",
    executionState: "failed_closed",
    status: "stage4_v2_readonly_gpu_qualification_failed_closed",
    packageId: payload.packageId,
    runId: payload.runId,
    failureReport: failureBinding,
    activeExecutionEvidence,
    ticketConsumed: context.ticketConsumed,
    controlledSmokeRegistration: { status: "ineligible", eligible: false },
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    trainingStarted: false,
    completedAtUtc: recordedAtUtc,
    completedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  });
  const finalizationBinding = bindAbsolute(root, finalizationPath);
  if (!fs.existsSync(terminalPath)) writeExclusiveJson(terminalPath, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
    executionState: "failed_closed",
    status: "stage4_v2_readonly_gpu_qualification_failed_closed",
    packageId: payload.packageId,
    runId: payload.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    failureReport: failureBinding,
    finalization: finalizationBinding,
    nextMachineAction: FAILURE_ACTION,
    controlledSmokeRegistration: { status: "ineligible", eligible: false },
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
    checkpointWritten: false,
    weightsModified: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  });
  const terminalBinding = bindAbsolute(root, terminalPath);
  if (!fs.existsSync(capsulePath)) writeExclusiveJson(capsulePath, buildTerminalCapsule({
    packagePayload: payload,
    status: "readonly_gpu_qualification_failed_closed",
    terminal: readJsonObject(terminalPath),
    terminalBinding,
    blocker: { code: classifyFailure(errorText, context), summaryZh: "V2只读GPU资格失败关闭；程序已保存失败边界，禁止自动重试或启动Smoke。" },
    nextAction: { code: FAILURE_ACTION, labelZh: "仅依据已保存证据执行只读失败裁决。" },
    evidence: [
      ...(activeExecutionEvidence ? [activeExecutionEvidence.lock, activeExecutionEvidence.finalHeartbeat] : []),
      failureBinding,
      finalizationBinding,
      terminalBinding,
    ],
  }));
  const capsuleBinding = bindAbsolute(root, capsulePath);
  transitionQualificationOuterJournal(context, "artifacts_staged", now, {
    terminal: terminalBinding,
    finalization: finalizationBinding,
    capsule: capsuleBinding,
    failureReport: failureBinding,
  });
  const eventCommit = appendProgramEvent
    ? appendTerminalEvent({
        runId: payload.runId,
        status: "failed",
        title: "Stage4 V2只读GPU资格失败关闭",
        detail: "程序已保存具体失败证据；未自动重试、未训练、未修改权重。",
        terminalBinding,
        timestamp: recordedAtUtc,
      })
    : null;
  if (eventCommit !== null) {
    transitionQualificationOuterJournal(context, "event_committed", now, {
      programEventId: eventCommit.event.id,
    });
  }
  let registryCommit = null;
  if (commitCurrentRegistry) {
    assert.ok(eventCommit !== null, "failure registry publication requires a committed program event");
    registryCommit = await advanceCurrentExecutionRegistry({
      projectRoot: root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: payload.packageId,
      taskId: FAILURE_TASK,
      taskKind: "cpu_readonly_adjudication",
      taskGoal: "Classify the saved Stage4 V2 readonly-GPU qualification failure without retrying GPU work.",
      priority: 1,
      queueStatus: "ready",
      nextMachineAction: FAILURE_ACTION,
      queuedAtUtc: recordedAtUtc,
      runId: payload.runId,
      lifecycleStage: "cpu_contract_verified",
      executionState: "package_materialized",
      activity: "readonly_gpu_qualification_failed_closed_adjudication_ready",
      taskCapsulePath: capsuleBinding.path,
      terminalEvidencePath: terminalBinding.path,
      expectedPreviousRegistryRevision: context.current.registry.registryRevision,
      expectedPreviousRegistrySha256: context.current.registrySha256,
      dependencyManifest: buildQualificationRegistryDependencyManifest({
        root,
        context,
        eventCommit,
        bindings: [
          { role: "qualification_failure_report", ...failureBinding },
          { role: "qualification_failure_terminal", ...terminalBinding },
          { role: "qualification_failure_finalization", ...finalizationBinding },
          { role: "qualification_failure_capsule", ...capsuleBinding },
        ],
      }),
    });
  }
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-execution-result-v1",
    executionState: "failed_closed",
    status: "stage4_v2_readonly_gpu_qualification_failed_closed",
    packageId: payload.packageId,
    runId: payload.runId,
    failureReport: failureBinding,
    terminal: terminalBinding,
    ticketConsumed: context.ticketConsumed,
    registryRevision: registryCommit?.registry?.registryRevision ?? null,
    registrySha256: registryCommit?.registrySha256 ?? null,
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
    trainingStarted: false,
  });
}

function selectFailureRoot(context) {
  if (context.outputCreated && context.paths?.outputRoot) return context.paths.outputRoot;
  if (context.preflightCreated && context.paths?.preflightRoot) return context.paths.preflightRoot;
  return resolveProjectPath(
    context.root,
    `.runtime/ai-painter/stage4-v2-readonly-gpu-qualification-failures/${context.packagePayload.runId}`,
  );
}

function classifyFailure(errorText, context) {
  const lower = errorText.toLowerCase();
  if (lower.includes("ticket") || lower.includes("signature") || lower.includes("replay")) return "qualification_ticket_or_replay_contract_failed";
  if (lower.includes("resource") || lower.includes("gpu_utilization") || lower.includes("memory") || lower.includes("disk") || lower.includes("wddm")) return "qualification_resource_preflight_failed";
  if (!context.ticketConsumed) return "qualification_consumption_preflight_failed";
  if (lower.includes("state") || lower.includes("weights") || lower.includes("autoencoder")) return "qualification_state_integrity_failed";
  return "qualification_cuda_or_evidence_failed";
}

function buildTerminalCapsule({ packagePayload, status, terminal, terminalBinding, blocker, nextAction, evidence }) {
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${packagePayload.runId}-${status}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status },
    candidateTerminal: {
      runId: packagePayload.runId,
      status,
      programStatus: terminal.status,
      previewMachineStatus: null,
      modelQualificationStatus: status,
      previewCount: null,
      previewPassCount: null,
      previewFailCount: null,
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc: terminal.recordedAtUtc,
      recordedAtAsiaShanghai: terminal.recordedAtAsiaShanghai,
    },
    latestBlocker: blocker,
    nextAllowedAction: {
      ...nextAction,
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: [
      "reuse_ticket_run_or_output",
      "read_historical_or_failed_denoiser_checkpoint",
      "automatic_gpu_retry",
      "start_stage0_before_controlled_smoke",
      "lower_machine_review_threshold",
    ],
    taskIdentity: {
      modelId: STAGE4_V2_CAPABILITY,
      sampleId: packagePayload.fixedInputs.fixedValidationSampleId,
      conditionLabel: "v7-complete-map-194",
      sampleSplit: "validation",
      seed: packagePayload.fixedInputs.seed,
      requiredBoundarySides: ["west"],
    },
    evidence: evidence.map((binding, index) => ({
      kind: `qualification_evidence_${index + 1}`,
      labelZh: `资格证据${index + 1}`,
      ...binding,
      expectedSha256: binding.sha256,
      sha256Verified: true,
      recordedAtUtc: terminal.recordedAtUtc,
      recordedAtAsiaShanghai: terminal.recordedAtAsiaShanghai,
    })),
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
  };
}

function appendTerminalEvent({ runId, status, title, detail, terminalBinding, timestamp = new Date().toISOString() }) {
  return appendAiPainterProgramEvent({
    id: `stage4-v2-readonly-gpu-terminal-${runId}`,
    timestamp,
    action: "stage4_v2_readonly_gpu_qualification",
    runId,
    kind: "readonly_gpu_qualification",
    status,
    title,
    titleZh: title,
    detailZh: detail,
    evidencePath: terminalBinding.path,
    evidenceSha256: terminalBinding.sha256,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  });
}

function appendHostRecoveryEvent({ runId, terminalBinding, timestamp }) {
  return appendAiPainterProgramEvent({
    id: `stage4-v2-readonly-gpu-host-recovery-${runId}`,
    timestamp,
    action: "stage4_v2_readonly_gpu_qualification_host_interruption_recovery",
    runId,
    kind: "readonly_gpu_qualification_recovery",
    status: "failed",
    title: "Stage4 V2只读GPU资格宿主中断失败关闭",
    titleZh: "Stage4 V2只读GPU资格宿主中断失败关闭",
    detailZh: "本地程序验证旧PID死亡且心跳过期后，仅收口既有证据并清除活动执行；未重放GPU。",
    evidencePath: terminalBinding.path,
    evidenceSha256: terminalBinding.sha256,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  });
}

function readBoundProjectJson(root, binding) {
  bindProjectFile(root, binding.path, binding.sha256);
  return readProjectJson(root, binding.path);
}

function readProjectJson(root, logicalPath) {
  return readJsonObject(resolveProjectPath(root, logicalPath, { mustExist: true, kind: "file" }));
}

function bindAbsolute(root, absolutePath) {
  const logicalPath = projectLogicalPath(root, absolutePath);
  return bindProjectFile(root, logicalPath, sha256File(absolutePath));
}

function normalizeLogicalPath(root, input) {
  if (path.isAbsolute(input)) return projectLogicalPath(root, input);
  return input.split(path.sep).join("/");
}

function pythonEnvironment(root, cudaVisible) {
  const env = { ...process.env };
  const entries = [
    resolveProjectPath(root, "ml/ai-painter/src"),
    resolveProjectPath(root, "ml/ai-painter/scripts"),
  ];
  if (env.PYTHONPATH) entries.push(env.PYTHONPATH);
  env.PYTHONPATH = entries.join(path.delimiter);
  env.PYTHONDONTWRITEBYTECODE = "1";
  if (cudaVisible) env.CUDA_VISIBLE_DEVICES = "0";
  else env.CUDA_VISIBLE_DEVICES = "";
  return env;
}

function runExternal(commandRunner, command, args, cwd, allowFailure) {
  const result = commandRunner(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw result.error ?? new Error(`${command} exited ${result.status}: ${tail(result.stderr)}`);
  }
  return result;
}

function optionalInteger(value) {
  const normalized = String(value).trim().toLowerCase();
  if (["", "-", "n/a", "[n/a]", "not supported"].includes(normalized)) return null;
  const match = /-?\d+/u.exec(normalized);
  return match ? Number(match[0]) : null;
}

function windowsBasename(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  return value.trim().replaceAll("/", "\\").split("\\").at(-1).toLowerCase();
}

function writeExclusiveText(filePath, value) {
  fs.writeFileSync(filePath, value ?? "", { flag: "wx", encoding: "utf8" });
}

function ensureImmutableJsonFile(filePath, value) {
  if (!fs.existsSync(filePath)) {
    writeExclusiveJson(filePath, value);
    return;
  }
  assert.deepEqual(readJsonObject(filePath), value,
    `immutable recovery evidence changed: ${projectLogicalPath(process.cwd(), filePath)}`);
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", encoding: "utf8" });
    const descriptor = fs.openSync(temporaryPath, "r+");
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
}

function shaText(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function tail(value, limit = 2000) {
  const text = String(value ?? "");
  return text.length <= limit ? text : text.slice(-limit);
}

function parseQualificationCli(args) {
  assert.equal(
    args.length,
    8,
    "formal qualification child requires --package, --package-sha256, --launch-intent and --launch-intent-sha256",
  );
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    assert.ok([
      "--package",
      "--package-sha256",
      "--launch-intent",
      "--launch-intent-sha256",
    ].includes(flag), `unsupported qualification child argument: ${flag}`);
    assert.equal(values.has(flag), false, `duplicate qualification child argument: ${flag}`);
    values.set(flag, args[index + 1]);
  }
  assert.match(values.get("--package-sha256") ?? "", /^[a-f0-9]{64}$/u,
    "package SHA-256 is invalid");
  assert.match(values.get("--launch-intent-sha256") ?? "", /^[a-f0-9]{64}$/u,
    "launch-intent SHA-256 is invalid");
  return {
    packageManifestPath: values.get("--package"),
    packageManifestSha256: values.get("--package-sha256"),
    backgroundLaunchIntentBinding: {
      path: values.get("--launch-intent"),
      sha256: values.get("--launch-intent-sha256"),
    },
  };
}
