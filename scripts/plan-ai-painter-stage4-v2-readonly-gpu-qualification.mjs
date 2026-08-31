import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  advanceCurrentExecutionRegistry,
  finalizePreparedCurrentExecutionRegistryAdvance,
  readCurrentExecutionRegistry,
  recoverPreparedCurrentExecutionRegistryAdvance,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
} from "./lib/ai-painter-program-event-store.mjs";
import { catalogPath } from "./lib/ai-pet-world-storage.mjs";
import {
  buildStage4V2ExternalRegistryDependencyManifest,
} from "./lib/ai-painter-stage4-v2-external-registry-dependency-v1.mjs";
import {
  captureImmutableCurrentRegistryEvidence,
} from "./lib/ai-painter-immutable-current-registry-evidence-v1.mjs";
import {
  buildAiPainterProgramGraphManifest,
} from "./lib/ai-painter-program-graph-manifest-v1.mjs";
import {
  DEFAULT_STAGE4_V2_QUALIFICATION_LEDGER_PATH,
  STAGE4_V2_CAPABILITY,
  bindProjectFile,
  buildStage4V2PreReleaseQualificationTicket,
  closeStage4V2UnconsumedQualificationTicket,
  ensureStage4V2MachineTicketIssuer,
  initializeStage4V2QualificationReplayLedger,
  projectLogicalPath,
  readJsonObject,
  registerStage4V2QualificationTicket,
  resolveProjectPath,
  sha256File,
  validateStage4V2PreReleaseQualificationTicket,
  writeExclusiveJson,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

export const STAGE4_V2_QUALIFICATION_PACKAGE_ROOT =
  ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages";
export const STAGE4_V2_QUALIFICATION_OUTPUT_ROOT =
  ".runtime/ai-painter/stage4-v2-readonly-gpu-qualifications";
export const STAGE4_V2_QUALIFICATION_PREFLIGHT_ROOT =
  ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-preflights";
export const STAGE4_V2_QUALIFICATION_MATERIALIZATION_FAILURE_ROOT =
  ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-materialization-failures";
export const STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT =
  ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-materializations";
export const MATERIALIZED_RUN_TASK = "execute_stage4_v2_readonly_gpu_qualification";
// The current task is launched through the local detached-process boundary.
// The child `run:` entry is deliberately not published as the next machine
// action because a 15-40 minute CUDA qualification must not inherit the
// lifetime of Codex, a terminal, or another foreground caller.
export const MATERIALIZED_RUN_ACTION =
  "launch:ai-painter-stage4-v2-readonly-gpu-qualification-background";

const PARENT_CONTRACT_SCHEMA =
  "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2";
const CPU_TERMINAL_SCHEMA = "stage4-v2-cpu-contract-acceptance-terminal-v1";
const FIRST_TRAIN_SAMPLE = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3";
const FIXED_VALIDATION_SAMPLE = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6";

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  materializeStage4V2ReadonlyGpuQualification({
    projectRoot: parseProjectRoot(process.argv.slice(2)),
  }).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function materializeStage4V2ReadonlyGpuQualification({
  projectRoot = process.cwd(),
  now = new Date(),
  machineKeyProtector = null,
  currentRegistryReader = readCurrentExecutionRegistry,
  registryWriter = advanceCurrentExecutionRegistry,
  programEventWriter = appendAiPainterProgramEvent,
  commitCurrentRegistry = true,
  appendProgramEvent = true,
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  const current = await currentRegistryReader(root);
  assert.equal(current.ok, true, current.errorCode ?? "current execution registry is not verified");
  if (isCommittedQualificationMaterializationCurrent(current)) {
    return recoverCommittedQualificationMaterialization({ root, current });
  }
  verifyPlanningRegistry(current);

  const parent = collectAndVerifyParentEvidence(root, current);
  const materializationIntent = ensureQualificationMaterializationIntent({
    root,
    current,
    parentRegistryTransaction: parent.parentRegistryTransaction,
    parentRegistrySnapshot: parent.parentRegistrySnapshot,
    now,
  });
  const identity = Object.freeze({
    packageId: materializationIntent.packageId,
    runId: materializationIntent.runId,
  });
  invokeMaterializationHook(_testHooks, "afterMaterializationIntentPersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
    intentPath: materializationIntent.intentPath,
  });
  const packageDirectory = `${STAGE4_V2_QUALIFICATION_PACKAGE_ROOT}/${identity.packageId}`;
  const outputDirectory = `${STAGE4_V2_QUALIFICATION_OUTPUT_ROOT}/${identity.runId}`;
  const preflightDirectory = `${STAGE4_V2_QUALIFICATION_PREFLIGHT_ROOT}/${identity.runId}`;
  const packageAbsolute = resolveProjectPath(root, packageDirectory);
  const outputAbsolute = resolveProjectPath(root, outputDirectory);
  const preflightAbsolute = resolveProjectPath(root, preflightDirectory);
  if (fs.existsSync(packageAbsolute)) {
    assert.equal(fs.lstatSync(packageAbsolute).isDirectory(), true,
      "qualification package recovery path is not a directory");
    assert.equal(fs.lstatSync(packageAbsolute).isSymbolicLink(), false,
      "qualification package recovery path cannot be a symbolic link");
  }
  assert.equal(fs.existsSync(outputAbsolute), false, "qualification output reuse is forbidden");
  assert.equal(fs.existsSync(preflightAbsolute), false, "qualification preflight reuse is forbidden");

  const issuer = ensureStage4V2MachineTicketIssuer({
    projectRoot: root,
    keyProtector: machineKeyProtector,
  });
  const programLineage = collectProgramLineage(root, parent.contract);
  const programGraph = buildQualificationProgramGraph(root, programLineage);
  const inputEvidence = uniqueBindings([
    parent.parentRegistryTransaction,
    parent.parentRegistrySnapshot,
    parent.currentTaskCapsule,
    parent.cpuTerminal,
    parent.cpuAcceptanceReport,
    parent.sourceAdjudicationTerminal,
    parent.sourceAdjudicationClassification,
    parent.parentContract,
    parent.conditionContract,
    parent.datasetRelease,
    parent.sourceManifest,
    parent.sourceIndex,
    parent.lossContract,
    parent.reviewThresholdContract,
    parent.foundationContract,
    parent.autoencoderCheckpoint,
    parent.autoencoderSourceManifest,
    parent.firstTrainSample.image,
    parent.firstTrainSample.conditionPack,
    parent.fixedValidationSample.image,
    parent.fixedValidationSample.conditionPack,
  ]);
  const issuedAtUtc = materializationIntent.issuedAtUtc;
  const expiresAtUtc = materializationIntent.expiresAtUtc;
  const packagePayload = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-package-payload-v1",
    status: "materialized_not_executed",
    packageId: identity.packageId,
    runId: identity.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    executionClass: "readonly_gpu_qualification",
    authorityClass: "local_ai_pre_release_capability_lifecycle",
    parentRegistry: {
      registryRevision: current.registry.registryRevision,
      eventSequence: current.registry.eventSequence,
      taskId: current.registry.taskId,
      lifecycleStageObserved: current.registry.lifecycleStage,
      lifecycleStageNormalized: "cpu_contract_verified",
      binding: parent.parentRegistrySnapshot,
      transaction: parent.parentRegistryTransaction,
    },
    outputDirectory,
    preflightDirectory,
    ledgerPath: DEFAULT_STAGE4_V2_QUALIFICATION_LEDGER_PATH,
    ticketIssuer: issuer.issuerBinding,
    inputEvidence,
    programLineage,
    bindings: {
      parentContract: parent.parentContract,
      datasetRelease: parent.datasetRelease,
      trainerSupport: bindDeclared(root, parent.contract.programBindings.trainerSupport, "V2 trainer support"),
      foundationAutoencoder: parent.foundationContract,
      conditionContract: parent.conditionContract,
      lossContract: parent.lossContract,
      reviewThresholdContract: parent.reviewThresholdContract,
    },
    fixedInputs: {
      seed: 20263722,
      resolution: { width: 256, height: 192 },
      batchSize: 1,
      diffusionTimestep: 500,
      firstTrainSampleId: FIRST_TRAIN_SAMPLE,
      fixedValidationSampleId: FIXED_VALIDATION_SAMPLE,
      conditionChannels: 23,
      latentChannels: 12,
      responsibilities: [
        "terrain_path_ground",
        "terrain_water",
        "terrain_shoreline",
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
      ],
    },
    autoencoderBinding: parent.autoencoderCheckpoint,
    executionBoundary: {
      gpuForwardAllowed: true,
      torchAutogradGradAllowed: true,
      optimizerAllowed: false,
      backwardAllowed: false,
      weightMutationAllowed: false,
      checkpointReadAllowed: true,
      autoencoderCheckpointOnly: true,
      denoiserCheckpointReadAllowed: false,
      checkpointWriteAllowed: false,
      trainingAllowed: false,
      smokeAllowed: false,
      stage0Allowed: false,
      formalInferenceAllowed: false,
      runtimeFrameAllowed: false,
      worldEntryAllowed: false,
    },
    failurePolicy: {
      failClosed: true,
      automaticRetryAllowed: false,
      outputReuseAllowed: false,
      historicalDirectoryScanAllowed: false,
      callerVerifiedBooleanTrusted: false,
      ownerAuthorizationRequired: false,
    },
    issuedAtUtc,
  };

  let packagePayloadBinding = null;
  let programGraphBinding = null;
  let ticket = null;
  let ticketBinding = null;
  let manifestBinding = null;
  let terminalBinding = null;
  let capsuleBinding = null;
  let ticketRegistered = false;
  let registryCommit = null;
  let programEventCommit = null;
  let packageDirectoryCreated = false;
  let outerJournal = null;
  const paths = {
    payload: path.join(packageAbsolute, "package-payload.json"),
    programGraph: path.join(packageAbsolute, "program-graph-manifest.json"),
    ticket: path.join(packageAbsolute, "pre-release-qualification-ticket.json"),
    manifest: path.join(packageAbsolute, "package-manifest.json"),
    terminal: path.join(packageAbsolute, "materialization-terminal.json"),
    capsule: path.join(packageAbsolute, "task-capsule.json"),
    outerJournal: path.join(packageAbsolute, "outer-transaction-journal.json"),
    eventCommitEvidence: path.join(packageAbsolute, "materialization-event-commit.json"),
    completionReceipt: path.join(packageAbsolute, "materialization-completion-receipt.json"),
    dependencyManifest: path.join(packageAbsolute, "registry-dependency-manifest.json"),
  };
  try {
  fs.mkdirSync(resolveProjectPath(root, STAGE4_V2_QUALIFICATION_PACKAGE_ROOT), { recursive: true });
  if (!fs.existsSync(packageAbsolute)) fs.mkdirSync(packageAbsolute, { recursive: false });
  packageDirectoryCreated = true;
  invokeMaterializationHook(_testHooks, "afterPackageDirectoryCreated", {
    packageId: identity.packageId,
    runId: identity.runId,
  });
  writeOrVerifyPlannerJson(paths.programGraph, programGraph,
    "qualification program graph manifest");
  programGraphBinding = bindAbsolute(root, paths.programGraph);
  packagePayload.programGraphManifest = programGraphBinding;
  invokeMaterializationHook(_testHooks, "afterProgramGraphManifestPersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
    programGraphManifest: programGraphBinding,
  });
  writeOrVerifyPlannerJson(paths.payload, packagePayload, "qualification package payload");
  packagePayloadBinding = bindAbsolute(root, paths.payload);
  invokeMaterializationHook(_testHooks, "afterPackagePayloadPersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
  });
  ticket = buildStage4V2PreReleaseQualificationTicket({
    packageId: identity.packageId,
    runId: identity.runId,
    packagePayload,
    packagePayloadBinding: packagePayloadBinding,
    issuer: issuer.issuer,
    privateKey: issuer.privateKey,
    inputEvidence,
    programLineage,
    outputDirectory,
    issuedAtUtc,
    expiresAtUtc,
    nonce: materializationIntent.ticketNonce,
  });
  writeOrVerifyPlannerJson(paths.ticket, ticket, "qualification ticket");
  ticketBinding = bindAbsolute(root, paths.ticket);
  invokeMaterializationHook(_testHooks, "afterQualificationTicketPersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
    ticketId: ticket.ticketId,
  });
  const ledger = initializeStage4V2QualificationReplayLedger({ projectRoot: root });
  registerStage4V2QualificationTicket({
    projectRoot: root,
    ticket,
    ticketBinding,
    packagePayloadBinding,
  });
  ticketRegistered = true;
  invokeMaterializationHook(_testHooks, "afterTicketRegistered", {
    packageId: identity.packageId,
    runId: identity.runId,
    ticketId: ticket.ticketId,
  });
  const manifest = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-package-manifest-v1",
    status: "materialized_not_executed",
    packageId: identity.packageId,
    runId: identity.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packagePayload: packagePayloadBinding,
    programGraphManifest: programGraphBinding,
    preReleaseQualificationTicket: ticketBinding,
    ticketIssuer: issuer.issuerBinding,
    replayLedger: ledger,
    outputDirectory,
    outputDirectoryCreated: false,
    preflightDirectory,
    preflightDirectoryCreated: false,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    trainingStarted: false,
    recordedAtUtc: issuedAtUtc,
  };
  writeOrVerifyPlannerJson(paths.manifest, manifest, "qualification package manifest");
  manifestBinding = bindAbsolute(root, paths.manifest);
  invokeMaterializationHook(_testHooks, "afterPackageManifestPersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
  });
  const terminal = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_readonly_gpu_qualification_package_materialized",
    packageId: identity.packageId,
    runId: identity.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    manifest: manifestBinding,
    packagePayload: packagePayloadBinding,
    preReleaseQualificationTicket: ticketBinding,
    outputDirectory,
    outputDirectoryCreated: false,
    ticketStatus: "issued_not_consumed_persisted",
    nextMachineAction: MATERIALIZED_RUN_ACTION,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: issuedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(issuedAtUtc),
  };
  writeOrVerifyPlannerJson(paths.terminal, terminal, "qualification materialization terminal");
  terminalBinding = bindAbsolute(root, paths.terminal);
  invokeMaterializationHook(_testHooks, "afterMaterializationTerminalPersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
  });
  const capsule = buildMaterializationCapsule({
    identity,
    terminal,
    terminalBinding,
    manifestBinding,
    payloadBinding: packagePayloadBinding,
    ticketBinding,
    issuerBinding: issuer.issuerBinding,
  });
  writeOrVerifyPlannerJson(paths.capsule, capsule, "qualification materialization capsule");
  capsuleBinding = bindAbsolute(root, paths.capsule);
  invokeMaterializationHook(_testHooks, "afterMaterializationCapsulePersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
  });
  outerJournal = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-outer-journal-v1",
    state: "artifacts_staged",
    operationId: materializationIntent.operationId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: identity.packageId,
    runId: identity.runId,
    previousRegistry: {
      registryRevision: current.registry.registryRevision,
      registrySha256: current.registrySha256,
    },
    evidence: {
      manifest: manifestBinding,
      terminal: terminalBinding,
      capsule: capsuleBinding,
      ticket: ticketBinding,
    },
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: issuedAtUtc,
    updatedAtUtc: issuedAtUtc,
  };
  outerJournal = loadOrCreatePlannerJournal(paths.outerJournal, outerJournal);
  invokeMaterializationHook(_testHooks, "afterMaterializationJournalPersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
  });

  // Commit the durable program event before publishing the current-registry
  // pointer.  The registry must never advertise a package whose ledger event
  // is still absent.
  if (appendProgramEvent) {
    programEventCommit = programEventWriter({
      id: `stage4-v2-readonly-gpu-package-materialized-${identity.runId}`,
      timestamp: issuedAtUtc,
      action: "stage4_v2_readonly_gpu_qualification_package_materialized",
      runId: identity.runId,
      kind: "readonly_gpu_qualification_materialization",
      status: "success",
      title: "Stage4 V2只读GPU资格包已物化",
      titleZh: "Stage4 V2只读GPU资格包已物化",
      detailZh: "本地程序已签发操作系统机器密钥签名的一次性资格票据；GPU、训练和权重修改均未启动。",
      evidencePath: terminalBinding.path,
      evidenceSha256: terminalBinding.sha256,
      fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    });
    outerJournal = {
      ...outerJournal,
      state: "event_committed",
      programEventId: programEventCommit.event.id,
      updatedAtUtc: issuedAtUtc,
    };
    writePlannerJournalAtomic(paths.outerJournal, outerJournal);
    invokeMaterializationHook(_testHooks, "afterProgramEventCommitted", {
      packageId: identity.packageId,
      runId: identity.runId,
    });
  }
  if (commitCurrentRegistry) {
    assert.ok(programEventCommit !== null,
      "current registry publication requires a committed materialization event");
    invokeMaterializationHook(_testHooks, "beforeRegistryAdvance", {
      packageId: identity.packageId,
      runId: identity.runId,
    });
    const preRegistryCompletionBinding = persistPreRegistryMaterializationCompletion({
      root,
      materializationIntent,
      identity,
      paths,
      manifestBinding,
      terminalBinding,
      capsuleBinding,
      ticketBinding,
      programEventCommit,
      _testHooks,
    });
    const dependencyManifest = buildPlannerRegistryDependencyManifest({
      root,
      paths,
      outerJournal,
      programEventCommit,
      bindings: [
        { role: "qualification_manifest", ...manifestBinding },
        { role: "qualification_materialization_terminal", ...terminalBinding },
        { role: "qualification_materialization_capsule", ...capsuleBinding },
        { role: "qualification_ticket", ...ticketBinding },
        { role: "qualification_materialization_completion_receipt", ...preRegistryCompletionBinding },
      ],
    });
    writeOrVerifyPlannerJson(paths.dependencyManifest, dependencyManifest,
      "qualification materialization registry dependency manifest");
    invokeMaterializationHook(_testHooks, "afterRegistryDependencyManifestPersisted", {
      packageId: identity.packageId,
      runId: identity.runId,
    });
    registryCommit = await registryWriter({
      projectRoot: root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: identity.packageId,
      taskId: MATERIALIZED_RUN_TASK,
      taskKind: "readonly_gpu_qualification",
      taskGoal: "Execute one signed, single-use Stage4 V2 readonly-GPU qualification without training or weight mutation.",
      priority: 1,
      queueStatus: "ready",
      nextMachineAction: MATERIALIZED_RUN_ACTION,
      queuedAtUtc: issuedAtUtc,
      runId: identity.runId,
      lifecycleStage: "cpu_contract_verified",
      executionState: "package_materialized",
      activity: "readonly_gpu_qualification_materialized_not_started",
      taskCapsulePath: capsuleBinding.path,
      terminalEvidencePath: terminalBinding.path,
      expectedPreviousRegistryRevision: current.registry.registryRevision,
      expectedPreviousRegistrySha256: current.registrySha256,
      dependencyManifest,
    });
    invokeMaterializationHook(_testHooks, "afterRegistryCommitted", {
      packageId: identity.packageId,
      runId: identity.runId,
      registryRevision: registryCommit.registry.registryRevision,
    });
    persistQualificationMaterializationCompletion({
      root,
      materializationIntent,
      identity,
      manifestBinding,
      terminalBinding,
      capsuleBinding,
      ticketBinding,
      dependencyManifestBinding: bindAbsolute(root, paths.dependencyManifest),
      registryCommit,
    });
    invokeMaterializationHook(_testHooks, "afterMaterializationCompletionPersisted", {
      packageId: identity.packageId,
      runId: identity.runId,
    });
  }
  return buildMaterializationResult({
    identity,
    terminal,
    manifestBinding,
    terminalBinding,
    capsuleBinding,
    ticketBinding,
    ticket,
    expiresAtUtc,
    outputDirectory,
    registryCommit,
    programEventCommit,
  });
  } catch (error) {
    if (error?._aiPainterInjectedMaterializationCrash === true) throw error;
    const recoveredRegistry = await currentRegistryReader(root).catch(() => null);
    if (
      recoveredRegistry?.ok === true
      && recoveredRegistry.registry.packageId === identity.packageId
      && recoveredRegistry.registry.runId === identity.runId
      && recoveredRegistry.registry.nextMachineAction === MATERIALIZED_RUN_ACTION
      && terminalBinding !== null
      && capsuleBinding !== null
      && manifestBinding !== null
      && ticketBinding !== null
      && ticket !== null
    ) {
      if (fs.existsSync(paths.dependencyManifest)) {
        persistQualificationMaterializationCompletion({
          root,
          materializationIntent,
          identity,
          manifestBinding,
          terminalBinding,
          capsuleBinding,
          ticketBinding,
          dependencyManifestBinding: bindAbsolute(root, paths.dependencyManifest),
          registryCommit: recoveredRegistry,
        });
      }
      return buildMaterializationResult({
        identity,
        terminal: readJsonObject(paths.terminal),
        manifestBinding,
        terminalBinding,
        capsuleBinding,
        ticketBinding,
        ticket,
        expiresAtUtc,
        outputDirectory,
        registryCommit: recoveredRegistry,
        programEventCommit,
      });
    }
    if (
      outerJournal?.state === "event_committed"
      && commitCurrentRegistry
      && programEventCommit !== null
      && terminalBinding !== null
      && capsuleBinding !== null
      && manifestBinding !== null
      && ticketBinding !== null
      && ticket !== null
    ) {
      try {
        const recovered = await recoverPlannerRegistryPublication({
          root,
          current,
          identity,
          paths,
          outerJournal,
          programEventCommit,
          manifestBinding,
          terminalBinding,
          capsuleBinding,
          ticketBinding,
          issuedAtUtc,
          _testHooks,
          registryWriter,
        });
        persistQualificationMaterializationCompletion({
          root,
          materializationIntent,
          identity,
          manifestBinding,
          terminalBinding,
          capsuleBinding,
          ticketBinding,
          dependencyManifestBinding: bindAbsolute(root, paths.dependencyManifest),
          registryCommit: recovered,
        });
        return buildMaterializationResult({
          identity,
          terminal: readJsonObject(paths.terminal),
          manifestBinding,
          terminalBinding,
          capsuleBinding,
          ticketBinding,
          ticket,
          expiresAtUtc,
          outputDirectory,
          registryCommit: recovered,
        });
      } catch (recoveryError) {
        await persistStage4V2QualificationMaterializationFailureClosed({
          root,
          identity,
          packageDirectory,
          outputDirectory,
          preflightDirectory,
          ticket,
          ticketBinding,
          packagePayloadBinding,
          ticketRegistered,
          previousRegistry: current,
          error: recoveryError,
          nowUtc: issuedAtUtc,
          appendProgramEvent,
          programEventWriter,
          packageDirectoryCreated,
        });
        throw recoveryError;
      }
    }
    await persistStage4V2QualificationMaterializationFailureClosed({
      root,
      identity,
      packageDirectory,
      outputDirectory,
      preflightDirectory,
      ticket,
      ticketBinding,
      packagePayloadBinding,
      ticketRegistered,
      previousRegistry: current,
      error,
      nowUtc: new Date().toISOString(),
      appendProgramEvent,
      programEventWriter,
      packageDirectoryCreated,
    });
    throw error;
  }
}

function buildMaterializationResult({
  identity,
  terminal,
  manifestBinding,
  terminalBinding,
  capsuleBinding,
  ticketBinding,
  ticket,
  expiresAtUtc,
  outputDirectory,
  registryCommit,
}) {
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-result-v1",
    status: terminal.status,
    packageId: identity.packageId,
    runId: identity.runId,
    packageManifest: manifestBinding,
    materializationTerminal: terminalBinding,
    taskCapsule: capsuleBinding,
    ticket: { ...ticketBinding, ticketId: ticket.ticketId, expiresAtUtc },
    outputDirectory,
    outputDirectoryCreated: false,
    registryRevision: registryCommit?.registry?.registryRevision ?? null,
    registrySha256: registryCommit?.registrySha256 ?? null,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
  });
}

function buildPlannerRegistryDependencyManifest({
  root,
  paths,
  outerJournal,
  programEventCommit,
  bindings,
}) {
  assert.equal(outerJournal?.state, "event_committed",
    "materialization journal is not event-committed");
  assert.ok(programEventCommit?.event?.id,
    "materialization program event commit is missing");
  const committed = {
    ...outerJournal,
    bindings,
    programEventId: programEventCommit.event.id,
  };
  writePlannerJournalAtomic(paths.outerJournal, committed);
  return buildStage4V2ExternalRegistryDependencyManifest({
    projectRoot: root,
    journalPath: paths.outerJournal,
    eventCommit: programEventCommit,
    bindings,
  });
}

async function recoverPlannerRegistryPublication({
  root,
  current,
  identity,
  paths,
  outerJournal,
  programEventCommit,
  manifestBinding,
  terminalBinding,
  capsuleBinding,
  ticketBinding,
  issuedAtUtc,
  _testHooks,
  registryWriter = advanceCurrentExecutionRegistry,
}) {
  const preRegistryCompletionBinding = persistPreRegistryMaterializationCompletion({
    root,
    materializationIntent: {
      operationId: outerJournal.operationId,
      intentPath: `${STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT}/${current.registrySha256}/materialization-intent.json`,
      issuedAtUtc,
    },
    identity,
    paths,
    manifestBinding,
    terminalBinding,
    capsuleBinding,
    ticketBinding,
    programEventCommit,
    _testHooks,
  });
  const dependencyManifest = buildPlannerRegistryDependencyManifest({
    root,
    paths,
    outerJournal,
    programEventCommit,
    bindings: [
      { role: "qualification_manifest", ...manifestBinding },
      { role: "qualification_materialization_terminal", ...terminalBinding },
      { role: "qualification_materialization_capsule", ...capsuleBinding },
      { role: "qualification_ticket", ...ticketBinding },
      { role: "qualification_materialization_completion_receipt", ...preRegistryCompletionBinding },
    ],
  });
  writeOrVerifyPlannerJson(paths.dependencyManifest, dependencyManifest,
    "qualification materialization registry dependency manifest");
  invokeMaterializationHook(_testHooks, "afterRegistryDependencyManifestPersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
  });
  const writerClaimPath = resolveProjectPath(
    root,
    ".runtime/ai-painter/current-execution-registry/writer.claim.json",
  );
  if (fs.existsSync(writerClaimPath)) {
    const claim = readJsonObject(writerClaimPath);
    assert.match(claim.transactionId, /^current-execution-registry-[a-z0-9-]+$/u,
      "materialization recovery writer transaction identity is invalid");
    const pendingPath = `.runtime/ai-painter/current-execution-registry/transactions/${claim.transactionId}/transaction.pending.json`;
    const pending = readJsonObject(resolveProjectPath(root, pendingPath));
    const staged = readJsonObject(resolveProjectPath(root, pending.currentStaged.path));
    assert.equal(sha256File(resolveProjectPath(root, pending.currentStaged.path)), pending.currentStaged.sha256,
      "materialization recovery staged current SHA-256 mismatch");
    assert.equal(staged.capabilityVersion, STAGE4_V2_CAPABILITY,
      "materialization recovery staged capability mismatch");
    assert.equal(staged.packageId, identity.packageId,
      "materialization recovery staged package mismatch");
    assert.equal(staged.runId, identity.runId,
      "materialization recovery staged run mismatch");
    assert.equal(staged.taskId, MATERIALIZED_RUN_TASK,
      "materialization recovery staged task mismatch");
    assert.equal(staged.nextMachineAction, MATERIALIZED_RUN_ACTION,
      "materialization recovery staged action mismatch");
    return claim.processId === process.pid
      ? finalizePreparedCurrentExecutionRegistryAdvance({
          projectRoot: root,
          transactionId: claim.transactionId,
          _testHooks,
        })
      : recoverPreparedCurrentExecutionRegistryAdvance({
          projectRoot: root,
          transactionId: claim.transactionId,
          _testHooks,
        });
  }
  return registryWriter({
    projectRoot: root,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: identity.packageId,
    taskId: MATERIALIZED_RUN_TASK,
    taskKind: "readonly_gpu_qualification",
    taskGoal: "Execute one signed, single-use Stage4 V2 readonly-GPU qualification without training or weight mutation.",
    priority: 1,
    queueStatus: "ready",
    nextMachineAction: MATERIALIZED_RUN_ACTION,
    queuedAtUtc: issuedAtUtc,
    runId: identity.runId,
    lifecycleStage: "cpu_contract_verified",
    executionState: "package_materialized",
    activity: "readonly_gpu_qualification_materialized_not_started",
    taskCapsulePath: capsuleBinding.path,
    terminalEvidencePath: terminalBinding.path,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
    dependencyManifest,
  });
}

function writePlannerJournalAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      flag: "wx",
      encoding: "utf8",
    });
    const descriptor = fs.openSync(temporary, "r+");
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
  assert.deepEqual(readJsonObject(filePath), value,
    "materialization outer journal read-back mismatch");
}

export async function persistStage4V2QualificationMaterializationFailureClosed({
  root,
  identity,
  packageDirectory,
  outputDirectory,
  preflightDirectory,
  ticket,
  ticketBinding,
  packagePayloadBinding,
  ticketRegistered,
  previousRegistry,
  error,
  nowUtc,
  appendProgramEvent,
  programEventWriter = appendAiPainterProgramEvent,
  packageDirectoryCreated,
}) {
  const failureDirectory = packageDirectoryCreated
    ? packageDirectory
    : `${STAGE4_V2_QUALIFICATION_MATERIALIZATION_FAILURE_ROOT}/${identity.runId}`;
  const failureAbsolute = resolveProjectPath(root, failureDirectory);
  if (!packageDirectoryCreated) {
    fs.mkdirSync(resolveProjectPath(root, STAGE4_V2_QUALIFICATION_MATERIALIZATION_FAILURE_ROOT), { recursive: true });
    fs.mkdirSync(failureAbsolute, { recursive: false });
  }
  const closurePath = `${failureDirectory}/ticket-closure.json`;
  let ticketClosure = null;
  let ticketClosureError = null;
  if (
    ticketRegistered
    && ticket !== null
    && ticketBinding !== null
    && packagePayloadBinding !== null
  ) {
    try {
      ticketClosure = closeStage4V2UnconsumedQualificationTicket({
        projectRoot: root,
        ticket,
        ticketBinding,
        packagePayloadBinding,
        closurePath,
        reasonCode: "materialization_failed_closed",
        error: error instanceof Error ? error.message : String(error),
        closedAtUtc: nowUtc,
      });
    } catch (closureError) {
      ticketClosureError = closureError instanceof Error
        ? closureError.message
        : String(closureError);
    }
  }
  const failureReportPath = `${failureDirectory}/materialization-failure-report.json`;
  const failureReport = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-failure-report-v1",
    status: "materialization_failed_closed",
    executionState: "failed_closed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: identity.packageId,
    runId: identity.runId,
    errorCode: error instanceof Error ? error.message : String(error),
    previousRegistry: {
      registryRevision: previousRegistry.registry.registryRevision,
      registrySha256: previousRegistry.registrySha256,
      taskId: previousRegistry.registry.taskId,
      runId: previousRegistry.registry.runId,
    },
    ticket: ticketBinding === null ? null : {
      ...ticketBinding,
      ticketId: ticket?.ticketId ?? null,
      registered: ticketRegistered,
      disposition: ticketRegistered
        ? (ticketClosure === null ? "closure_failed_fail_closed" : "closed_unconsumed")
        : "never_registered_unconsumable",
    },
    ticketClosure: ticketClosure?.closureBinding ?? null,
    ticketClosureError,
    outputDirectory,
    outputDirectoryCreated: fs.existsSync(resolveProjectPath(root, outputDirectory)),
    preflightDirectory,
    preflightDirectoryCreated: fs.existsSync(resolveProjectPath(root, preflightDirectory)),
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    trainingStarted: false,
    automaticRetryAllowed: false,
    recordedAtUtc: nowUtc,
    recordedAtAsiaShanghai: formatShanghai(nowUtc),
  };
  writeExclusiveJson(resolveProjectPath(root, failureReportPath), failureReport);
  const failureReportBinding = bindProjectFile(root, failureReportPath);
  const failureTerminalPath = `${failureDirectory}/materialization-failure-terminal.json`;
  const failureTerminal = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-failure-terminal-v1",
    executionState: "failed_closed",
    status: "stage4_v2_readonly_gpu_qualification_materialization_failed_closed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: identity.packageId,
    runId: identity.runId,
    failureReport: failureReportBinding,
    ticketClosure: ticketClosure?.closureBinding ?? null,
    previousRegistryRetained: true,
    automaticRetryAllowed: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: nowUtc,
    recordedAtAsiaShanghai: formatShanghai(nowUtc),
  };
  writeExclusiveJson(resolveProjectPath(root, failureTerminalPath), failureTerminal);
  const failureTerminalBinding = bindProjectFile(root, failureTerminalPath);
  const failureCapsulePath = `${failureDirectory}/materialization-failure-capsule.json`;
  const failureEvidence = [
    ["materialization_failure_report", failureReportBinding],
    ["materialization_failure_terminal", failureTerminalBinding],
    ...(ticketClosure === null ? [] : [["ticket_closure", ticketClosure.closureBinding]]),
  ].map(([kind, binding]) => ({
    kind,
    ...binding,
    sha256Verified: true,
  }));
  writeExclusiveJson(resolveProjectPath(root, failureCapsulePath), {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${identity.packageId}-materialization-failure`,
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    candidateTerminal: {
      runId: identity.runId,
      status: "failed_closed",
      programStatus: failureTerminal.status,
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc: nowUtc,
    },
    nextAllowedAction: null,
    evidence: failureEvidence,
    integrity: {
      status: ticketClosureError === null ? "verified" : "failed_closed_with_ticket_closure_error",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
    },
  });
  if (appendProgramEvent) {
    try {
      programEventWriter({
        id: `stage4-v2-readonly-gpu-package-materialization-failed-${identity.runId}`,
        timestamp: nowUtc,
        action: "stage4_v2_readonly_gpu_qualification_materialization_failed_closed",
        runId: identity.runId,
        kind: "readonly_gpu_qualification_materialization",
        status: "failed",
        title: "Stage4 V2只读GPU资格包物化失败关闭",
        titleZh: "Stage4 V2只读GPU资格包物化失败关闭",
        detailZh: "物化失败已保存；已登记的一次性票据已关闭或明确记录为不可消费，GPU与训练均未启动。",
        evidencePath: failureTerminalBinding.path,
        evidenceSha256: failureTerminalBinding.sha256,
        fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
      });
    } catch {
      // The immutable local failure terminal is authoritative when the shared
      // event store itself is the failing dependency.
    }
  }
  return Object.freeze({
    failureReport: failureReportBinding,
    failureTerminal: failureTerminalBinding,
    failureCapsule: bindProjectFile(root, failureCapsulePath),
    ticketClosure: ticketClosure?.closureBinding ?? null,
    ticketClosureError,
  });
}

function invokeMaterializationHook(hooks, point, detail) {
  if (typeof hooks?.onMaterializationPoint === "function") {
    try {
      hooks.onMaterializationPoint(point, detail);
    } catch (error) {
      if (error && typeof error === "object") {
        error._aiPainterInjectedMaterializationCrash = true;
      }
      throw error;
    }
  }
}

function ensureQualificationMaterializationIntent({
  root,
  current,
  parentRegistryTransaction,
  parentRegistrySnapshot,
  now,
}) {
  const scopeDirectory = `${STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT}/${current.registrySha256}`;
  const scopeAbsolute = resolveProjectPath(root, scopeDirectory);
  const stagingAbsolute = `${scopeAbsolute}.staging`;
  const intentPath = path.join(scopeAbsolute, "materialization-intent.json");
  const intentHashPath = path.join(scopeAbsolute, "materialization-intent.sha256.json");
  fs.mkdirSync(resolveProjectPath(root, STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT), {
    recursive: true,
  });
  let intent;
  if (!fs.existsSync(scopeAbsolute)) {
    if (fs.existsSync(stagingAbsolute)) {
      const stagedIntentPath = path.join(stagingAbsolute, "materialization-intent.json");
      const stagedHashPath = path.join(stagingAbsolute, "materialization-intent.sha256.json");
      if (fs.existsSync(stagedIntentPath) && fs.existsSync(stagedHashPath)) {
        validateMaterializationIntentHash(stagedIntentPath, stagedHashPath);
        fs.renameSync(stagingAbsolute, scopeAbsolute);
      } else {
        removeQualificationMaterializationIntentStaging(stagingAbsolute, scopeAbsolute);
      }
    }
  }
  if (!fs.existsSync(scopeAbsolute)) {
    fs.mkdirSync(stagingAbsolute, { recursive: false });
    const identity = newPackageIdentity(now);
    const issuedAtUtc = now.toISOString();
    intent = {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-intent-v1",
      status: "materialization_in_progress",
      operationId: `stage4-v2-readonly-gpu-qualification-materialization:${current.registrySha256}`,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      parentRegistry: {
        registryRevision: current.registry.registryRevision,
        registrySha256: current.registrySha256,
        taskId: current.registry.taskId,
        transaction: parentRegistryTransaction,
        snapshot: parentRegistrySnapshot,
      },
      packageId: identity.packageId,
      runId: identity.runId,
      packageDirectory: `${STAGE4_V2_QUALIFICATION_PACKAGE_ROOT}/${identity.packageId}`,
      outputDirectory: `${STAGE4_V2_QUALIFICATION_OUTPUT_ROOT}/${identity.runId}`,
      preflightDirectory: `${STAGE4_V2_QUALIFICATION_PREFLIGHT_ROOT}/${identity.runId}`,
      ticketNonce: `stage4-v2-qualification-${randomUUID().replaceAll("-", "")}`,
      issuedAtUtc,
      expiresAtUtc: new Date(Date.parse(issuedAtUtc) + 24 * 60 * 60 * 1000).toISOString(),
      ownerAuthorizationRequired: false,
      gpuStarted: false,
      trainingStarted: false,
    };
    const stagedIntentPath = path.join(stagingAbsolute, "materialization-intent.json");
    const stagedHashPath = path.join(stagingAbsolute, "materialization-intent.sha256.json");
    writeExclusiveJson(stagedIntentPath, intent);
    writeExclusiveJson(stagedHashPath, {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-intent-hash-v1",
      intentFile: "materialization-intent.json",
      sha256: sha256File(stagedIntentPath),
    });
    validateMaterializationIntentHash(stagedIntentPath, stagedHashPath);
    fs.renameSync(stagingAbsolute, scopeAbsolute);
  } else {
    intent = readJsonObject(intentPath);
  }
  assert.equal(fs.lstatSync(scopeAbsolute).isDirectory(), true,
    "qualification materialization intent scope is not a directory");
  assert.equal(fs.lstatSync(scopeAbsolute).isSymbolicLink(), false,
    "qualification materialization intent scope cannot be a symbolic link");
  validateMaterializationIntentHash(intentPath, intentHashPath);
  assert.deepEqual(
    fs.readFileSync(intentPath),
    Buffer.from(`${JSON.stringify(intent, null, 2)}\n`, "utf8"),
    "qualification materialization intent bytes are not canonical",
  );
  verifyQualificationMaterializationIntent({
    intent,
    current,
    parentRegistryTransaction,
    parentRegistrySnapshot,
  });
  return Object.freeze({
    ...intent,
    intentPath: projectLogicalPath(root, intentPath),
    publicationPath: `${scopeDirectory}/materialization-published.json`,
  });
}

function validateMaterializationIntentHash(intentPath, hashPath) {
  const record = readJsonObject(hashPath);
  assert.equal(record.schemaVersion,
    "ai-painter-stage4-v2-readonly-gpu-materialization-intent-hash-v1",
    "qualification materialization intent hash schema mismatch");
  assert.equal(record.intentFile, "materialization-intent.json",
    "qualification materialization intent hash file mismatch");
  assert.match(record.sha256 ?? "", /^[a-f0-9]{64}$/u,
    "qualification materialization intent hash is invalid");
  assert.equal(sha256File(intentPath), record.sha256,
    "qualification materialization intent SHA-256 mismatch");
}

function removeQualificationMaterializationIntentStaging(stagingAbsolute, scopeAbsolute) {
  assert.equal(path.resolve(stagingAbsolute), `${path.resolve(scopeAbsolute)}.staging`,
    "qualification materialization intent staging target mismatch");
  assert.equal(path.dirname(path.resolve(stagingAbsolute)), path.dirname(path.resolve(scopeAbsolute)),
    "qualification materialization intent staging escapes parent");
  assert.equal(fs.lstatSync(stagingAbsolute).isDirectory(), true,
    "qualification materialization intent staging is not a directory");
  assert.equal(fs.lstatSync(stagingAbsolute).isSymbolicLink(), false,
    "qualification materialization intent staging cannot be a symbolic link");
  fs.rmSync(stagingAbsolute, { recursive: true, force: false });
}

function verifyQualificationMaterializationIntent({
  intent,
  current,
  parentRegistryTransaction,
  parentRegistrySnapshot,
}) {
  assert.equal(intent?.schemaVersion,
    "ai-painter-stage4-v2-readonly-gpu-materialization-intent-v1",
    "qualification materialization intent schema mismatch");
  assert.equal(intent.status, "materialization_in_progress",
    "qualification materialization intent status mismatch");
  assert.equal(intent.operationId,
    `stage4-v2-readonly-gpu-qualification-materialization:${current.registrySha256}`,
    "qualification materialization intent operation mismatch");
  assert.equal(intent.capabilityVersion, STAGE4_V2_CAPABILITY,
    "qualification materialization intent capability mismatch");
  assert.deepEqual(intent.parentRegistry, {
    registryRevision: current.registry.registryRevision,
    registrySha256: current.registrySha256,
    taskId: current.registry.taskId,
    transaction: parentRegistryTransaction,
    snapshot: parentRegistrySnapshot,
  }, "qualification materialization intent parent registry changed");
  assert.equal(intent.packageDirectory,
    `${STAGE4_V2_QUALIFICATION_PACKAGE_ROOT}/${intent.packageId}`,
    "qualification materialization package path mismatch");
  assert.equal(intent.outputDirectory,
    `${STAGE4_V2_QUALIFICATION_OUTPUT_ROOT}/${intent.runId}`,
    "qualification materialization output path mismatch");
  assert.equal(intent.preflightDirectory,
    `${STAGE4_V2_QUALIFICATION_PREFLIGHT_ROOT}/${intent.runId}`,
    "qualification materialization preflight path mismatch");
  assert.match(intent.ticketNonce ?? "", /^[A-Za-z0-9][A-Za-z0-9._-]{7,191}$/u,
    "qualification materialization ticket nonce is invalid");
  assert.ok(Number.isFinite(Date.parse(intent.issuedAtUtc)),
    "qualification materialization issue time is invalid");
  assert.ok(Date.parse(intent.expiresAtUtc) > Date.parse(intent.issuedAtUtc),
    "qualification materialization expiry is invalid");
  assert.equal(intent.ownerAuthorizationRequired, false);
  assert.equal(intent.gpuStarted, false);
  assert.equal(intent.trainingStarted, false);
}

function isCommittedQualificationMaterializationCurrent(current) {
  return current.registry?.capabilityVersion === STAGE4_V2_CAPABILITY
    && current.registry?.taskId === MATERIALIZED_RUN_TASK
    && current.registry?.nextMachineAction === MATERIALIZED_RUN_ACTION
    && current.registry?.executionState === "package_materialized"
    && current.registry?.activeExecution === null
    && current.currentTaskTerminal?.schemaVersion
      === "ai-painter-stage4-v2-readonly-gpu-materialization-terminal-v1"
    && current.currentTaskTerminal?.status
      === "stage4_v2_readonly_gpu_qualification_package_materialized";
}

function recoverCommittedQualificationMaterialization({ root, current }) {
  const terminalBinding = bindProjectFile(
    root,
    current.registry.terminalEvidence.path,
    current.registry.terminalEvidence.sha256,
  );
  const terminal = current.currentTaskTerminal;
  assert.equal(terminal.packageId, current.registry.packageId,
    "committed qualification materialization package mismatch");
  assert.equal(terminal.runId, current.registry.runId,
    "committed qualification materialization run mismatch");
  const payloadBinding = bindDeclared(root, terminal.packagePayload,
    "committed qualification package payload");
  const payload = readJsonObject(resolveProjectPath(root, payloadBinding.path, {
    mustExist: true,
    kind: "file",
  }));
  assert.equal(payload.packageId, terminal.packageId);
  assert.equal(payload.runId, terminal.runId);
  const ticketBinding = bindDeclared(root, terminal.preReleaseQualificationTicket,
    "committed qualification ticket");
  const ticket = readJsonObject(resolveProjectPath(root, ticketBinding.path, {
    mustExist: true,
    kind: "file",
  }));
  validateStage4V2PreReleaseQualificationTicket({
    projectRoot: root,
    ticket,
    packagePayload: payload,
    verifyEvidence: true,
  });
  const manifestBinding = bindDeclared(root, terminal.manifest,
    "committed qualification package manifest");
  const capsuleBinding = bindProjectFile(
    root,
    current.registry.taskCapsule.path,
    current.registry.taskCapsule.sha256,
  );
  const intentPath = `${STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT}/${payload.parentRegistry.binding.sha256}/materialization-intent.json`;
  const intent = readJsonObject(resolveProjectPath(root, intentPath, {
    mustExist: true,
    kind: "file",
  }));
  assert.equal(intent.packageId, terminal.packageId,
    "committed qualification materialization intent package mismatch");
  assert.equal(intent.runId, terminal.runId,
    "committed qualification materialization intent run mismatch");
  assert.deepEqual(intent.parentRegistry.snapshot, payload.parentRegistry.binding,
    "committed qualification materialization intent parent snapshot mismatch");
  assert.deepEqual(intent.parentRegistry.transaction, payload.parentRegistry.transaction,
    "committed qualification materialization intent parent transaction mismatch");
  const packageRoot = path.dirname(resolveProjectPath(root, terminalBinding.path));
  const dependencyManifestBinding = bindAbsolute(
    root,
    path.join(packageRoot, "registry-dependency-manifest.json"),
  );
  persistQualificationMaterializationCompletion({
    root,
    materializationIntent: {
      ...intent,
      intentPath,
      publicationPath: `${STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT}/${payload.parentRegistry.binding.sha256}/materialization-published.json`,
    },
    identity: { packageId: terminal.packageId, runId: terminal.runId },
    manifestBinding,
    terminalBinding,
    capsuleBinding,
    ticketBinding,
    dependencyManifestBinding,
    registryCommit: current,
  });
  return buildMaterializationResult({
    identity: { packageId: terminal.packageId, runId: terminal.runId },
    terminal,
    manifestBinding,
    terminalBinding,
    capsuleBinding,
    ticketBinding,
    ticket,
    expiresAtUtc: ticket.expiresAtUtc,
    outputDirectory: payload.outputDirectory,
    registryCommit: current,
  });
}

function persistPreRegistryMaterializationCompletion({
  root,
  materializationIntent,
  identity,
  paths,
  manifestBinding,
  terminalBinding,
  capsuleBinding,
  ticketBinding,
  programEventCommit,
  _testHooks = null,
}) {
  assert.equal(programEventCommit?.event?.id,
    `stage4-v2-readonly-gpu-package-materialized-${identity.runId}`,
    "qualification materialization event identity mismatch");
  const eventEvidence = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-event-commit-v1",
    status: "materialization_program_event_committed",
    operationId: materializationIntent.operationId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: identity.packageId,
    runId: identity.runId,
    programEvent: programEventCommit.event,
    ledger: programEventCommit.ledger,
    latest: programEventCommit.latest,
    catalog: programEventCommit.catalog,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: materializationIntent.issuedAtUtc,
  };
  writeOrVerifyPlannerJson(paths.eventCommitEvidence, eventEvidence,
    "qualification materialization event commit evidence");
  const eventCommitBinding = bindAbsolute(root, paths.eventCommitEvidence);
  invokeMaterializationHook(_testHooks, "afterMaterializationEventCommitEvidencePersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
  });
  const completion = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-completion-receipt-v1",
    status: "materialization_artifacts_and_event_completed_registry_pending",
    operationId: materializationIntent.operationId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: identity.packageId,
    runId: identity.runId,
    intent: bindProjectFile(root, materializationIntent.intentPath),
    evidence: {
      manifest: manifestBinding,
      terminal: terminalBinding,
      capsule: capsuleBinding,
      ticket: ticketBinding,
      eventCommit: eventCommitBinding,
    },
    registryPublicationPending: true,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: materializationIntent.issuedAtUtc,
  };
  writeOrVerifyPlannerJson(paths.completionReceipt, completion,
    "qualification materialization pre-registry completion receipt");
  invokeMaterializationHook(_testHooks, "afterPreRegistryCompletionReceiptPersisted", {
    packageId: identity.packageId,
    runId: identity.runId,
  });
  return bindAbsolute(root, paths.completionReceipt);
}

function persistQualificationMaterializationCompletion({
  root,
  materializationIntent,
  identity,
  manifestBinding,
  terminalBinding,
  capsuleBinding,
  ticketBinding,
  dependencyManifestBinding,
  registryCommit,
}) {
  const packageRoot = path.dirname(resolveProjectPath(root, terminalBinding.path));
  const preRegistryCompletionBinding = bindAbsolute(
    root,
    path.join(packageRoot, "materialization-completion-receipt.json"),
  );
  const completion = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-publication-receipt-v1",
    status: "materialization_published_registry_committed",
    operationId: materializationIntent.operationId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: identity.packageId,
    runId: identity.runId,
    parentRegistry: materializationIntent.parentRegistry,
    intent: bindProjectFile(root, materializationIntent.intentPath),
    evidence: {
      manifest: manifestBinding,
      terminal: terminalBinding,
      capsule: capsuleBinding,
      ticket: ticketBinding,
      preRegistryCompletion: preRegistryCompletionBinding,
      registryDependencyManifest: dependencyManifestBinding,
    },
    committedRegistry: {
      registryRevision: registryCommit.registry.registryRevision,
      registrySha256: registryCommit.registrySha256,
      taskId: registryCommit.registry.taskId,
      nextMachineAction: registryCommit.registry.nextMachineAction,
    },
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: materializationIntent.issuedAtUtc,
  };
  writeOrVerifyPlannerJson(
    resolveProjectPath(root, materializationIntent.publicationPath),
    completion,
    "qualification materialization publication receipt",
  );
  return bindProjectFile(root, materializationIntent.publicationPath);
}

function writeOrVerifyPlannerJson(filePath, value, label) {
  if (!fs.existsSync(filePath)) {
    writeExclusiveJson(filePath, value);
    return;
  }
  assert.deepEqual(readJsonObject(filePath), value,
    `${label} conflicts with immutable recovery bytes`);
}

function loadOrCreatePlannerJournal(filePath, initial) {
  if (!fs.existsSync(filePath)) {
    writeExclusiveJson(filePath, initial);
    return initial;
  }
  const existing = readJsonObject(filePath);
  assert.ok(["artifacts_staged", "event_committed"].includes(existing.state),
    "qualification materialization journal state is invalid");
  for (const key of [
    "schemaVersion",
    "operationId",
    "capabilityVersion",
    "packageId",
    "runId",
    "previousRegistry",
    "evidence",
    "gpuStarted",
    "trainingStarted",
    "recordedAtUtc",
  ]) {
    assert.deepEqual(existing[key], initial[key],
      `qualification materialization journal ${key} changed`);
  }
  return existing;
}

export function collectAndVerifyParentEvidence(projectRoot, current) {
  const immutableRegistry = captureImmutableCurrentRegistryEvidence({
    projectRoot,
    current,
  });
  const parentRegistryTransaction = immutableRegistry.transaction;
  const parentRegistrySnapshot = immutableRegistry.snapshot;
  const currentTaskCapsule = bindProjectFile(
    projectRoot,
    current.registry.taskCapsule.path,
    current.registry.taskCapsule.sha256,
  );
  const cpuTerminal = bindProjectFile(
    projectRoot,
    current.registry.terminalEvidence.path,
    current.registry.terminalEvidence.sha256,
  );
  const terminal = readJsonObject(resolveProjectPath(projectRoot, cpuTerminal.path, { mustExist: true, kind: "file" }));
  assert.equal(terminal.schemaVersion, CPU_TERMINAL_SCHEMA, "V2 CPU terminal schema mismatch");
  assert.equal(terminal.executionState, "completed", "V2 CPU terminal is not complete");
  assert.equal(terminal.status, "stage4_v2_cpu_contract_acceptance_passed_inactive", "V2 CPU terminal did not pass");
  assert.equal(terminal.activationState, "inactive", "V2 CPU terminal activation must remain inactive");
  assert.equal(terminal.ownerAuthorizationRequired, false, "V2 CPU terminal has invalid Owner gate");
  assert.equal(terminal.safety?.gpuStarted, false, "V2 CPU terminal unexpectedly started GPU");
  assert.equal(terminal.safety?.trainingStarted, false, "V2 CPU terminal unexpectedly started training");

  const cpuAcceptanceReport = bindDeclared(projectRoot, terminal.cpuAcceptanceReport, "CPU acceptance report");
  const sourceAdjudicationTerminal = bindDeclared(projectRoot, terminal.sourceAdjudication?.terminal, "source adjudication terminal");
  const sourceAdjudicationClassification = bindDeclared(projectRoot, terminal.sourceAdjudication?.classification, "source adjudication classification");
  const parentContract = bindDeclared(projectRoot, terminal.successorContract, "V2 parent contract");
  const contract = readJsonObject(resolveProjectPath(projectRoot, parentContract.path, { mustExist: true, kind: "file" }));
  assert.equal(contract.schemaVersion, PARENT_CONTRACT_SCHEMA, "V2 parent contract schema mismatch");
  assert.equal(contract.contractId, PARENT_CONTRACT_SCHEMA, "V2 parent contract identity mismatch");
  assert.equal(contract.architectureId, STAGE4_V2_CAPABILITY, "V2 parent architecture mismatch");
  assert.equal(contract.status, "cpu_supported_inactive", "V2 parent contract is not CPU inactive");
  assert.equal(contract.activationGates?.gpuNow, false, "V2 parent contract already permits GPU");
  assert.equal(contract.activationGates?.trainingNow, false, "V2 parent contract already permits training");

  const conditionContract = bindDeclared(projectRoot, contract.conditionContract, "condition contract");
  const datasetRelease = bindDeclared(projectRoot, contract.datasetBinding, "dataset release");
  const sourceManifest = bindDeclared(projectRoot, contract.datasetBinding?.sourceManifest, "dataset source manifest");
  const sourceIndex = bindDeclared(projectRoot, contract.datasetBinding?.sourceIndex, "dataset source index");
  const lossContract = bindDeclared(projectRoot, contract.lossContract, "loss contract");
  const reviewThresholdContract = bindDeclared(projectRoot, contract.reviewThresholdContract, "review threshold contract");
  const foundationContract = bindDeclared(projectRoot, contract.foundationAssetBinding, "foundation Autoencoder contract");
  const dataset = readJsonObject(resolveProjectPath(projectRoot, datasetRelease.path, { mustExist: true, kind: "file" }));
  assert.equal(dataset.status, "verified_dataset_release", "dataset release is not verified");
  assert.equal(dataset.releaseScope?.releasedSampleCount, 64, "dataset release sample count mismatch");
  const firstTrain = selectUniqueSample(dataset, FIRST_TRAIN_SAMPLE, "train");
  const fixedValidation = selectUniqueSample(dataset, FIXED_VALIDATION_SAMPLE, "validation");
  const firstTrainSample = {
    sampleId: firstTrain.sampleId,
    image: bindDeclared(projectRoot, firstTrain.image, "first train image"),
    conditionPack: bindDeclared(projectRoot, firstTrain.conditionPack, "first train condition pack"),
  };
  const fixedValidationSample = {
    sampleId: fixedValidation.sampleId,
    image: bindDeclared(projectRoot, fixedValidation.image, "fixed validation image"),
    conditionPack: bindDeclared(projectRoot, fixedValidation.conditionPack, "fixed validation condition pack"),
  };
  const foundation = readJsonObject(resolveProjectPath(projectRoot, foundationContract.path, { mustExist: true, kind: "file" }));
  assert.equal(foundation.assetIdentity, contract.foundationAssetBinding.identity, "foundation asset identity mismatch");
  assert.equal(foundation.capabilityReleaseStatus, "not_released", "foundation contract must remain pre-release");
  assert.equal(foundation.lineageInterpretation?.denoiserWeightsMayBeLoaded, false, "foundation contract permits Denoiser weights");
  const autoencoderCheckpoint = bindDeclared(projectRoot, foundation.checkpoint, "foundation Autoencoder checkpoint");
  const autoencoderSourceManifest = bindDeclared(projectRoot, foundation.sourceManifest, "foundation Autoencoder source manifest");

  for (const [role, binding] of Object.entries(contract.programBindings ?? {})) {
    bindDeclared(projectRoot, binding, `parent program binding ${role}`);
  }
  return Object.freeze({
    parentRegistryTransaction,
    parentRegistrySnapshot,
    currentTaskCapsule,
    cpuTerminal,
    cpuAcceptanceReport,
    sourceAdjudicationTerminal,
    sourceAdjudicationClassification,
    parentContract,
    contract,
    conditionContract,
    datasetRelease,
    sourceManifest,
    sourceIndex,
    lossContract,
    reviewThresholdContract,
    foundationContract,
    autoencoderCheckpoint,
    autoencoderSourceManifest,
    firstTrainSample,
    fixedValidationSample,
  });
}

function collectProgramLineage(projectRoot, contract) {
  const files = {
    materializer: "scripts/plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
    backgroundLauncher: "scripts/launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs",
    nodeRunner: "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
    ticketCore: "scripts/lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs",
    qualificationLifecycle: "scripts/lib/ai-painter-stage4-v2-qualification-lifecycle-v1.mjs",
    pythonRunner: "ml/ai-painter/scripts/run_stage4_semantic_transport_v2_readonly_gpu_qualification.py",
    modelFactory: contract.programBindings.modelFactory.path,
    successorModule: contract.programBindings.successorModule.path,
    trainer: contract.programBindings.trainer.path,
    trainerSupport: contract.programBindings.trainerSupport.path,
  };
  return Object.freeze(Object.fromEntries(
    Object.entries(files).map(([role, logicalPath]) => [role, bindProjectFile(projectRoot, logicalPath)]),
  ));
}

function buildMaterializationCapsule({
  identity,
  terminal,
  terminalBinding,
  manifestBinding,
  payloadBinding,
  ticketBinding,
  issuerBinding,
}) {
  const evidence = [
    ["package_payload", "资格执行包载荷", payloadBinding],
    ["signed_pre_release_ticket", "机器签名发布前资格票据", ticketBinding],
    ["ticket_issuer", "操作系统保护的机器签发器", issuerBinding],
    ["package_manifest", "资格执行包Manifest", manifestBinding],
    ["materialization_terminal", "资格包物化终态", terminalBinding],
  ].map(([kind, labelZh, binding]) => ({
    kind,
    labelZh,
    ...binding,
    expectedSha256: binding.sha256,
    sha256Verified: true,
    recordedAtUtc: terminal.recordedAtUtc,
    recordedAtAsiaShanghai: terminal.recordedAtAsiaShanghai,
  }));
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${identity.packageId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: "readonly_gpu_qualification_materialized" },
    candidateTerminal: {
      runId: identity.runId,
      status: "materialized_not_executed",
      programStatus: terminal.status,
      previewMachineStatus: null,
      modelQualificationStatus: "readonly_gpu_qualification_pending",
      previewCount: null,
      previewPassCount: null,
      previewFailCount: null,
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc: terminal.recordedAtUtc,
      recordedAtAsiaShanghai: terminal.recordedAtAsiaShanghai,
    },
    latestBlocker: {
      code: "readonly_gpu_qualification_not_yet_executed",
      summaryZh: "V2 CPU合同已通过且一次性资格包已物化；只读CUDA资格尚未执行。",
    },
    nextAllowedAction: {
      code: MATERIALIZED_RUN_ACTION,
      labelZh: "消费机器签名的一次性票据并执行V2只读GPU资格。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: [
      "reuse_ticket_or_output_directory",
      "read_historical_or_failed_denoiser_checkpoint",
      "create_optimizer",
      "execute_backward",
      "modify_weights",
      "start_training_or_smoke",
      "start_stage0_stage1_or_stage2",
    ],
    taskIdentity: {
      modelId: STAGE4_V2_CAPABILITY,
      sampleId: FIXED_VALIDATION_SAMPLE,
      conditionLabel: "v7-complete-map-194",
      sampleSplit: "validation",
      seed: 20263722,
      requiredBoundarySides: ["west"],
    },
    evidence,
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
  };
}

function verifyPlanningRegistry(current) {
  const registry = current.registry;
  assert.equal(registry.capabilityVersion, STAGE4_V2_CAPABILITY, "current capability is not Stage4 V2");
  assert.equal(registry.taskId, "plan_stage4_v2_readonly_gpu_qualification", "current task is not V2 qualification planning");
  assert.equal(registry.nextMachineAction, "plan:ai-painter-stage4-v2-readonly-gpu-qualification", "current action is not V2 qualification planning");
  assert.equal(registry.taskKind, "cpu_readonly_gpu_qualification_planning", "current task kind mismatch");
  assert.ok(["cpu_contract_accepted", "cpu_contract_verified"].includes(registry.lifecycleStage), "current lifecycle is not CPU verified");
  assert.equal(registry.executionState, "package_materialized", "current planning package is not materialized");
  assert.equal(registry.activeExecution, null, "another current execution is active");
  assert.equal(current.currentTaskTerminal?.status, "stage4_v2_cpu_contract_acceptance_passed_inactive", "current CPU terminal mismatch");
}

function newPackageIdentity(now) {
  const stamp = now.toISOString().replace(/[-:TZ.]/gu, "").slice(0, 17);
  const suffix = randomUUID().slice(0, 8);
  return Object.freeze({
    packageId: `stage4-v2-readonly-gpu-package-${stamp}-${suffix}`,
    runId: `stage4-v2-readonly-gpu-${stamp}-${suffix}`,
  });
}

function selectUniqueSample(dataset, sampleId, split) {
  const matches = (dataset.samples ?? []).filter((sample) => sample?.sampleId === sampleId);
  assert.equal(matches.length, 1, `dataset sample ${sampleId} must exist exactly once`);
  assert.equal(matches[0].split, split, `dataset sample ${sampleId} split mismatch`);
  return matches[0];
}

function bindDeclared(projectRoot, declared, role) {
  assert.ok(declared && typeof declared.path === "string", `${role} path is missing`);
  assert.ok(typeof declared.sha256 === "string", `${role} SHA-256 is missing`);
  return bindProjectFile(projectRoot, declared.path, declared.sha256);
}

function bindAbsolute(projectRoot, absolutePath) {
  const logicalPath = projectLogicalPath(projectRoot, absolutePath);
  return bindProjectFile(projectRoot, logicalPath, sha256File(absolutePath));
}

function uniqueBindings(bindings) {
  const paths = new Set();
  for (const binding of bindings) {
    assert.equal(paths.has(binding.path), false, `duplicate evidence path: ${binding.path}`);
    paths.add(binding.path);
  }
  return Object.freeze(bindings.map((binding) => Object.freeze({ ...binding })));
}

function parseProjectRoot(args) {
  if (args.length === 0) return process.cwd();
  assert.deepEqual(args.slice(0, 1), ["--project-root"], "only --project-root is supported");
  assert.equal(args.length, 2, "--project-root requires one value");
  return args[1];
}
