import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import { materializeAutonomousClosedLoopPackage } from "./lib/ai-painter-autonomous-package-materializer-v1.mjs";
import { formatShanghai } from "./lib/ai-painter-program-event-store.mjs";
import {
  commitStage4V2ExternalRegistryDependencies,
} from "./lib/ai-painter-stage4-v2-external-registry-dependency-v1.mjs";
import {
  captureImmutableCurrentRegistryEvidence,
} from "./lib/ai-painter-immutable-current-registry-evidence-v1.mjs";
import {
  bindAbsolute,
  buildDerivedTrainerExecution,
  FIXED_EPOCH_COUNT,
  FIXED_PREVIEW_EPOCHS,
  FIXED_RESOLUTION,
  FIXED_SAMPLE_ID,
  FIXED_SEED,
  projectLogicalPath,
  readBoundJson,
  readJsonObject,
  resolveProjectPath,
  sha256File,
  SMOKE_BACKGROUND_LAUNCH_ACTION,
  SMOKE_OUTPUT_ROOT,
  SMOKE_PACKAGE_ROOT,
  SMOKE_PLAN_ACTION,
  SMOKE_RUN_ACTION,
  SMOKE_RUN_TASK,
  STAGE4_V2_CAPABILITY,
  validateStage4V2SmokePackagePayload,
} from "./lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  buildStage4V2SmokeTicket,
  ensureStage4V2SmokeTicketIssuer,
  initializeStage4V2SmokeTicketLedger,
  registerStage4V2SmokeTicket,
} from "./lib/ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs";

const QUALIFICATION_PACKAGE_ROOT = ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages";
const LIFECYCLE_ROOT = `.runtime/ai-painter/capability-lifecycle/${STAGE4_V2_CAPABILITY}`;
const DATASET_RELEASE_PATH = "data/ai-painter/system-governance/ai-painter-stage4-v2-mvp64-dataset-release-v1.json";
const BASE_CONFIG_PATH = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json";
const ADAPTER_PATH = "scripts/lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs";
const COMMON_PATH = "scripts/lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
const TICKET_PATH = "scripts/lib/ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs";
const REVIEW_ADAPTER_PATH = "scripts/lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs";
const PYTHON_ADAPTER_PATH = "ml/ai-painter/scripts/run_stage4_semantic_transport_v2_controlled_smoke.py";
const PYTHON_TRAINING_ADAPTER_PATH = "ml/ai-painter/scripts/stage4_semantic_transport_v2_controlled_smoke_training.py";
const OUTER_RUNNER_PATH = "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs";
const BACKGROUND_LAUNCHER_PATH = "scripts/launch-ai-painter-stage4-v2-controlled-smoke-background.mjs";
const LAUNCH_INTENT_VALIDATOR_PATH =
  "scripts/lib/ai-painter-stage4-v2-controlled-smoke-launch-intent-v1.mjs";
const IMMUTABLE_REGISTRY_EVIDENCE_PATH =
  "scripts/lib/ai-painter-immutable-current-registry-evidence-v1.mjs";
const GENERIC_BACKGROUND_LAUNCHER_PATH =
  "scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs";
const EXACTLY_ONCE_SPAWN_PATH =
  "scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs";
const MATERIALIZATION_JOURNAL_ROOT =
  ".runtime/ai-painter/stage4-v2-controlled-smoke-materializations";

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  materializeStage4V2ControlledSmoke({ projectRoot: process.cwd() }).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function materializeStage4V2ControlledSmoke({
  projectRoot = process.cwd(),
  now = new Date(),
  machineKeyProtector = null,
  commitCurrentRegistry = true,
  appendProgramEvent = true,
  currentRegistryReader = readCurrentExecutionRegistry,
  currentRegistryAdvancer = advanceCurrentExecutionRegistry,
  externalDependencyCommitter = commitStage4V2ExternalRegistryDependencies,
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  const current = await currentRegistryReader(root);
  verifyPlanningRegistry(current);
  const currentEvidence = captureImmutableCurrentRegistryEvidence({
    projectRoot: root,
    current,
  });
  const qualification = collectQualification(root, current);
  const immutableInputs = collectAndVerifySmokeImmutableInputs({
    root,
    current,
    currentEvidence,
    qualification,
  });
  reconcileReadonlyLifecycle(root, qualification.terminalBinding, now.toISOString());

  const identity = newIdentity(qualification.terminalBinding);
  const materialization = loadOrCreateMaterializationIntent({
    root,
    identity,
    qualificationTerminal: qualification.terminalBinding,
    requestedAtUtc: now.toISOString(),
  });
  const materializedAt = new Date(materialization.intent.recordedAtUtc);
  assert.ok(Number.isFinite(materializedAt.getTime()),
    "Smoke materialization journal timestamp is invalid");
  invokeMaterializationHook(_testHooks,
    "afterMaterializationIntentPersisted", {
      identity,
      materializationIntent: materialization.intentBinding,
  });
  const outputDirectory = `${SMOKE_OUTPUT_ROOT}/${identity.runId}`;
  assert.equal(fs.existsSync(resolveProjectPath(root, outputDirectory)), false, "Smoke output reuse is forbidden");
  const {
    datasetReleaseBinding,
    datasetRelease,
    sample,
    machineReviewInputs,
    objectMasks,
    programPaths,
    programLineage,
    baseConfigBinding,
    currentTaskCapsuleBinding,
    currentTerminalBinding,
  } = immutableInputs;
  const issuer = ensureStage4V2SmokeTicketIssuer({ projectRoot: root, keyProtector: machineKeyProtector });
  const inputEvidence = uniqueBindings([
    currentEvidence.transaction,
    currentEvidence.snapshot,
    currentTaskCapsuleBinding,
    currentTerminalBinding,
    qualification.manifestBinding,
    qualification.payloadBinding,
    qualification.terminalBinding,
    datasetReleaseBinding,
    datasetRelease.sourcePackage.manifest,
    datasetRelease.sourcePackage.sourceIndex,
    sample.image,
    sample.conditionPack,
    qualification.payload.autoencoderBinding,
    machineReviewInputs.thresholdContract,
    machineReviewInputs.styleFingerprint,
    ...objectMasks,
    ...Object.values(machineReviewInputs.reviewPrograms),
    baseConfigBinding,
    materialization.intentBinding,
  ]);
  const derivedTrainerExecution = buildDerivedTrainerExecution({
    packageId: identity.packageId,
    runId: identity.runId,
    datasetPackageId: datasetRelease.datasetReleaseIdentity,
    outputDirectory,
  });
  const reviewExecutionBindingId =
    `stage4-v2-smoke-review-${sha256Of({ packageId: identity.packageId, runId: identity.runId }).slice(0, 24)}`;

  const generic = materializeAutonomousClosedLoopPackage({
    schemaVersion: "ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity: identity.packageId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    ownerAuthorizationRequired: false,
    maxInfrastructureRecoveryAttempts: 0,
    outputRoot: outputDirectory,
    programFiles: programPaths,
    inputEvidencePaths: inputEvidence.map((item) => item.path),
    phaseAdapters: Object.fromEntries([
      ["preflight", "stage4V2SmokePreflight"], ["execute", "stage4V2SmokeExecute"],
      ["validate", "stage4V2SmokeValidate"], ["review", "stage4V2SmokeReview"],
      ["adjudicate", "stage4V2SmokeAdjudicate"], ["finalize", "stage4V2SmokeFinalize"],
    ].map(([phase, exportName]) => [phase, { path: ADAPTER_PATH, exportName }])),
  }, {
    root,
    recordedAtUtc: materialization.intent.recordedAtUtc,
    recoverExistingExact: true,
    _testHooks: {
      afterPackageRootCreated: (value) => invokeMaterializationHook(
        _testHooks, "afterGenericPackageRootCreated", value,
      ),
      afterPackagePersisted: (value) => invokeMaterializationHook(
        _testHooks, "afterGenericPackagePersisted", value,
      ),
    },
  });
  const packageRoot = resolveProjectPath(root, path.dirname(generic.packagePath));
  const genericPackageBinding = bindPath(root, generic.packagePath);
  const genericManifestBinding = bindPath(root, generic.manifestPath);
  recordMaterializationStep({
    root, materialization, step: "generic_package",
    evidence: [genericPackageBinding, genericManifestBinding],
  });
  invokeMaterializationHook(_testHooks, "afterGenericPackageMaterialized", {
    identity, genericPackageBinding, genericManifestBinding,
  });
  const payload = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-package-payload-v1",
    status: "materialized_not_executed",
    packageId: identity.packageId,
    runId: identity.runId,
    architectureId: STAGE4_V2_CAPABILITY,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    executionClass: "controlled_smoke",
    authorityClass: "local_ai_pre_release_capability_lifecycle",
    ownerAuthorizationRequired: false,
    datasetPackageId: datasetRelease.datasetReleaseIdentity,
    datasetRelease: datasetReleaseBinding,
    baseConfig: bindPath(root, BASE_CONFIG_PATH),
    outputDirectory,
    reviewExecutionBindingId,
    readonlyGpuQualificationTerminal: qualification.terminalBinding,
    autoencoderCheckpoint: qualification.payload.autoencoderBinding,
    machineReviewInputs,
    fixedInputs: {
      seed: FIXED_SEED,
      sampleId: FIXED_SAMPLE_ID,
      sampleSplit: "validation",
      resolutionStage: 0,
      resolution: FIXED_RESOLUTION,
      batchSize: 1,
      epochCount: FIXED_EPOCH_COUNT,
      previewEpochs: FIXED_PREVIEW_EPOCHS,
      conditionChannels: 23,
      latentChannels: 12,
    },
    derivedTrainerExecution,
    ticketIssuer: issuer.issuerBinding,
    inputEvidence,
    programLineage,
    executionBoundary: {
      gpuForwardAllowed: true, optimizerAllowed: true, backwardAllowed: true,
      weightMutationAllowed: true, checkpointWriteAllowed: true, trainingAllowed: true,
      smokeAllowed: true, stage0Allowed: false, stage1Allowed: false, stage2Allowed: false,
      formalInferenceAllowed: false, runtimeFrameAllowed: false, worldEntryAllowed: false,
    },
    failurePolicy: {
      failClosed: true, automaticRetryAllowed: false,
      historicalDenoiserCheckpointAllowed: false, outputReuseAllowed: false,
      thresholdMutationAllowed: false, checkpointPromotionAllowed: false,
    },
    materializedAtUtc: materialization.intent.recordedAtUtc,
  };
  validateStage4V2SmokePackagePayload(payload, { projectRoot: root, verifyEvidence: true });
  const payloadPath = path.join(packageRoot, "package-payload.json");
  writeOrVerifyMaterializationJson(payloadPath, payload,
    "Smoke package payload recovery differs");
  const payloadBinding = bindAbsolute(root, payloadPath);
  recordMaterializationStep({
    root, materialization, step: "package_payload", evidence: [payloadBinding],
  });
  invokeMaterializationHook(_testHooks, "afterPayloadPersisted", {
    identity, payloadBinding,
  });
  const issuedAtUtc = materialization.intent.recordedAtUtc;
  const ticket = buildStage4V2SmokeTicket({
    packageId: identity.packageId,
    runId: identity.runId,
    packagePayload: payload,
    packagePayloadBinding: payloadBinding,
    issuer: issuer.issuer,
    privateKey: issuer.privateKey,
    inputEvidence,
    programLineage,
    outputDirectory,
    issuedAtUtc,
    expiresAtUtc: new Date(
      materializedAt.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString(),
    nonce: materialization.intent.ticketNonce,
  });
  const ticketPath = path.join(packageRoot, "smoke-ticket.json");
  writeOrVerifyMaterializationJson(ticketPath, ticket,
    "Smoke ticket recovery differs");
  const ticketBinding = bindAbsolute(root, ticketPath);
  recordMaterializationStep({
    root, materialization, step: "smoke_ticket", evidence: [ticketBinding],
  });
  invokeMaterializationHook(_testHooks, "afterTicketPersisted", {
    identity, ticketBinding,
  });
  const replayLedger = initializeStage4V2SmokeTicketLedger({ projectRoot: root });
  const ticketRegistration = registerStage4V2SmokeTicket({
    projectRoot: root,
    ticket,
    ticketBinding,
    packagePayloadBinding: payloadBinding,
    allowExistingExact: true,
  });
  recordMaterializationStep({
    root, materialization, step: "ticket_registered",
    evidence: [payloadBinding, ticketBinding],
    detail: {
      ledgerPath: ticketRegistration.path,
      ticketId: ticketRegistration.ticketId,
      status: ticketRegistration.status,
    },
  });
  invokeMaterializationHook(_testHooks, "afterTicketRegistered", {
    identity, ticketBinding, ticketRegistration,
  });
  const smokeManifest = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-package-manifest-v1",
    status: "materialized_not_executed",
    packageId: identity.packageId,
    runId: identity.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    autonomousClosedLoopPackage: { path: generic.packagePath, sha256: generic.packageSha256 },
    packagePayload: payloadBinding,
    smokeTicket: ticketBinding,
    ticketIssuer: issuer.issuerBinding,
    replayLedger,
    materializationJournal: materialization.intentBinding,
    outputDirectory,
    outputDirectoryCreated: false,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: issuedAtUtc,
  };
  const smokeManifestPath = path.join(packageRoot, "smoke-package-manifest.json");
  writeOrVerifyMaterializationJson(smokeManifestPath, smokeManifest,
    "Smoke package manifest recovery differs");
  const smokeManifestBinding = bindAbsolute(root, smokeManifestPath);
  recordMaterializationStep({
    root, materialization, step: "smoke_manifest",
    evidence: [smokeManifestBinding],
  });
  invokeMaterializationHook(_testHooks, "afterSmokeManifestPersisted", {
    identity, smokeManifestBinding,
  });
  const terminal = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-materialization-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_controlled_smoke_package_materialized",
    packageId: identity.packageId,
    runId: identity.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageManifest: smokeManifestBinding,
    packagePayload: payloadBinding,
    smokeTicket: ticketBinding,
    materializationJournal: materialization.intentBinding,
    outputDirectory,
    nextMachineAction: SMOKE_BACKGROUND_LAUNCH_ACTION,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: issuedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(issuedAtUtc),
  };
  const terminalPath = path.join(packageRoot, "materialization-terminal.json");
  writeOrVerifyMaterializationJson(terminalPath, terminal,
    "Smoke materialization terminal recovery differs");
  const terminalBinding = bindAbsolute(root, terminalPath);
  recordMaterializationStep({
    root, materialization, step: "materialization_terminal",
    evidence: [terminalBinding],
  });
  invokeMaterializationHook(_testHooks, "afterTerminalPersisted", {
    identity, terminalBinding,
  });
  const capsule = buildCapsule({ payload, terminal, terminalBinding, evidence: [
    payloadBinding, ticketBinding, smokeManifestBinding,
    qualification.terminalBinding, materialization.intentBinding,
  ] });
  const capsulePath = path.join(packageRoot, "task-capsule.json");
  writeOrVerifyMaterializationJson(capsulePath, capsule,
    "Smoke task capsule recovery differs");
  const capsuleBinding = bindAbsolute(root, capsulePath);
  recordMaterializationStep({
    root, materialization, step: "task_capsule", evidence: [capsuleBinding],
  });
  invokeMaterializationHook(_testHooks, "afterCapsulePersisted", {
    identity, capsuleBinding,
  });
  const materializationCompletionBinding = completeMaterializationJournal({
    root, materialization,
    evidence: [
      genericPackageBinding, genericManifestBinding, payloadBinding,
      ticketBinding, smokeManifestBinding, terminalBinding, capsuleBinding,
    ],
  });
  return publishMaterializedSmokePlanner({
    root, current, qualification, identity, terminal, terminalBinding,
    capsuleBinding, smokeManifestBinding, payloadBinding, ticketBinding,
    materializationCompletionBinding,
    commitCurrentRegistry, appendProgramEvent, currentRegistryAdvancer,
    externalDependencyCommitter, _testHooks,
  });
}

async function publishMaterializedSmokePlanner({
  root, current, qualification, identity, terminal, terminalBinding,
  capsuleBinding, smokeManifestBinding, payloadBinding, ticketBinding,
  materializationCompletionBinding,
  commitCurrentRegistry, appendProgramEvent, currentRegistryAdvancer,
  externalDependencyCommitter, _testHooks,
}) {
  assert.equal(commitCurrentRegistry && !appendProgramEvent, false,
    "Smoke planner cannot publish current state without a durable program event");
  const materializationCompletion = readBoundJson(
    root, materializationCompletionBinding,
  );
  assert.equal(materializationCompletion.status,
    "controlled_smoke_materialization_completed_not_executed");
  assert.equal(materializationCompletion.packageId, identity.packageId);
  assert.equal(materializationCompletion.runId, identity.runId);
  const packageRoot = path.dirname(resolveProjectPath(root,
    terminalBinding.path, { mustExist: true, kind: "file" }));
  const eventInput = {
    id: `stage4-v2-controlled-smoke-materialized-${identity.runId}`,
    timestamp: terminal.recordedAtUtc,
    action: "stage4_v2_controlled_smoke_package_materialized",
    runId: identity.runId,
    kind: "controlled_smoke_materialization",
    status: "success",
    title: "Stage4 V2受控Smoke闭环已物化",
    titleZh: "Stage4 V2受控Smoke闭环已物化",
    detailZh: "机器票据已签发且未消费；训练、GPU和权重修改尚未启动。",
    evidencePath: terminalBinding.path,
    evidenceSha256: terminalBinding.sha256,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  };
  const bindings = [
    { role: "controlled_smoke_package_payload", ...payloadBinding },
    { role: "controlled_smoke_ticket", ...ticketBinding },
    { role: "controlled_smoke_manifest", ...smokeManifestBinding },
    { role: "controlled_smoke_materialization_terminal", ...terminalBinding },
    { role: "controlled_smoke_task_capsule", ...capsuleBinding },
    {
      role: "controlled_smoke_materialization_journal_completion",
      ...materializationCompletionBinding,
    },
    { role: "readonly_gpu_qualification_terminal", ...qualification.terminalBinding },
  ];
  const externalDependencies = appendProgramEvent
    ? externalDependencyCommitter({
        projectRoot: root,
        journalPath: path.join(packageRoot,
          "materialization-registry-dependency-journal.json"),
        journalSchemaVersion:
          "ai-painter-stage4-v2-controlled-smoke-materialization-registry-dependency-journal-v1",
        operationId: `stage4-v2-smoke-materialization-registry-${identity.runId}`,
        capabilityVersion: STAGE4_V2_CAPABILITY,
        packageId: identity.packageId,
        runId: identity.runId,
        recordedAtUtc: terminal.recordedAtUtc,
        bindings,
        eventInput,
        _testHooks,
      }) : null;
  if (typeof _testHooks?.afterPlannerExternalDependenciesCommitted === "function") {
    _testHooks.afterPlannerExternalDependenciesCommitted({
      externalDependencies, packageId: identity.packageId, runId: identity.runId,
    });
  }
  let registryCommit = null;
  if (commitCurrentRegistry) {
    assert.ok(externalDependencies,
      "Smoke planner registry publication lacks external dependencies");
    registryCommit = await currentRegistryAdvancer({
      projectRoot: root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: identity.packageId,
      taskId: SMOKE_RUN_TASK,
      taskKind: "controlled_smoke",
      taskGoal: "Execute the fixed Stage4 V2 controlled Smoke, machine review, causal adjudication and finalization.",
      priority: 1,
      queueStatus: "ready",
      nextMachineAction: SMOKE_BACKGROUND_LAUNCH_ACTION,
      queuedAtUtc: terminal.recordedAtUtc,
      runId: identity.runId,
      lifecycleStage: "readonly_gpu_qualified",
      executionState: "package_materialized",
      activity: "stage4_v2_controlled_smoke_materialized_not_started",
      taskCapsulePath: capsuleBinding.path,
      terminalEvidencePath: terminalBinding.path,
      expectedPreviousRegistryRevision: current.registry.registryRevision,
      expectedPreviousRegistrySha256: current.registrySha256,
      dependencyManifest: externalDependencies.dependencyManifest,
    });
  }
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-materialization-result-v1",
    status: terminal.status,
    packageId: identity.packageId,
    runId: identity.runId,
    packageManifest: smokeManifestBinding,
    terminal: terminalBinding,
    materializationJournal: materializationCompletionBinding,
    ticketStatus: "issued_not_consumed",
    nextMachineAction: SMOKE_BACKGROUND_LAUNCH_ACTION,
    registryRevision: registryCommit?.registry?.registryRevision ?? null,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
  });
}

function verifyPlanningRegistry(current) {
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
  assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(current.registry.lifecycleStage, "readonly_gpu_qualified");
  assert.equal(current.registry.nextMachineAction, SMOKE_PLAN_ACTION);
  assert.equal(current.currentTaskTerminal?.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-terminal-v1");
  assert.equal(current.currentTaskTerminal?.status, "stage4_v2_readonly_gpu_qualification_passed");
  assert.equal(current.currentTaskTerminal?.executionState, "completed");
}

function collectQualification(root, current) {
  const manifestPath = `${QUALIFICATION_PACKAGE_ROOT}/${current.registry.packageId}/package-manifest.json`;
  const manifestBinding = bindPath(root, manifestPath);
  const manifest = readBoundJson(root, manifestBinding);
  assert.equal(manifest.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-package-manifest-v1");
  assert.equal(manifest.packageId, current.registry.packageId);
  const payload = readBoundJson(root, manifest.packagePayload);
  assert.equal(payload.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-package-payload-v1");
  assert.equal(payload.runId, current.registry.runId);
  const terminalBinding = current.registry.terminalEvidence;
  const terminal = readBoundJson(root, terminalBinding);
  assert.equal(terminal.status, "stage4_v2_readonly_gpu_qualification_passed");
  return { manifestBinding, payloadBinding: manifest.packagePayload, payload, terminalBinding, terminal };
}

export function collectAndVerifySmokeImmutableInputs({
  root,
  current,
  currentEvidence,
  qualification,
}) {
  verifyQualificationImmutableLineage(root, qualification.payload);

  const datasetReleaseBinding = bindPath(root, DATASET_RELEASE_PATH);
  assert.deepEqual(
    datasetReleaseBinding,
    qualification.payload.bindings?.datasetRelease,
    "current dataset release differs from readonly GPU qualification binding",
  );
  requireExactQualificationInputEvidence(
    qualification.payload,
    datasetReleaseBinding,
    "dataset release",
  );
  const datasetRelease = readBoundJson(root, datasetReleaseBinding);
  assert.equal(datasetRelease.schemaVersion,
    "ai-painter-stage4-v2-dataset-release-contract-v1");
  assert.equal(datasetRelease.status, "verified_dataset_release",
    "dataset release is not verified");
  assert.equal(datasetRelease.immutable, true,
    "dataset release is not immutable");
  assert.equal(datasetRelease.releaseScope?.releasedSampleCount, 64,
    "dataset release sample count mismatch");
  assert.equal(datasetRelease.samples?.length, 64,
    "dataset release samples length mismatch");

  const sourceManifestBinding = bindDeclaredExact(
    root,
    datasetRelease.sourcePackage?.manifest,
    "dataset source manifest",
  );
  const sourceIndexBinding = bindDeclaredExact(
    root,
    datasetRelease.sourcePackage?.sourceIndex,
    "dataset source index",
  );
  requireExactQualificationInputEvidence(
    qualification.payload,
    sourceManifestBinding,
    "dataset source manifest",
  );
  requireExactQualificationInputEvidence(
    qualification.payload,
    sourceIndexBinding,
    "dataset source index",
  );

  const sample = selectFixedSample(datasetRelease);
  const sampleImageBinding = bindDeclaredExact(root, sample.image,
    "fixed sample194 reference image");
  const conditionPackBinding = bindDeclaredExact(root, sample.conditionPack,
    "fixed sample194 condition pack");
  requireExactQualificationInputEvidence(
    qualification.payload,
    sampleImageBinding,
    "fixed sample194 reference image",
  );
  requireExactQualificationInputEvidence(
    qualification.payload,
    conditionPackBinding,
    "fixed sample194 condition pack",
  );
  const conditionPack = readBoundJson(root, conditionPackBinding);

  const thresholdBinding = bindDeclaredExact(
    root,
    qualification.payload.bindings?.reviewThresholdContract,
    "machine review threshold contract",
  );
  requireExactQualificationInputEvidence(
    qualification.payload,
    thresholdBinding,
    "machine review threshold contract",
  );
  const threshold = readBoundJson(root, thresholdBinding);
  const objectMasks = [
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
  ].map((role) => {
    const channel = conditionPack.channels?.find((item) => item.id === role);
    assert.ok(channel, `fixed condition pack missing ${role}`);
    const binding = bindDeclaredExact(root, channel, `${role} object mask`);
    return { role, path: binding.path, sha256: binding.sha256 };
  });
  const styleFingerprintBinding = bindDeclaredExact(
    root,
    threshold.styleFingerprint,
    "style fingerprint",
  );
  const conditionAlignmentBinding = bindDeclaredExact(
    root,
    threshold.implementationProvenance?.conditionAlignment,
    "condition alignment reviewer",
  );
  const professionalAestheticBinding = bindDeclaredExact(
    root,
    threshold.implementationProvenance?.professionalAesthetic,
    "professional aesthetic reviewer",
  );
  const styleFeatureExtractorBinding = bindDeclaredExact(
    root,
    threshold.implementationProvenance?.styleFeatureExtractor,
    "style feature extractor",
  );
  const machineReviewInputs = {
    thresholdContract: thresholdBinding,
    conditionPack: { ...conditionPackBinding, channelCount: 23 },
    referenceRgb: sampleImageBinding,
    objectMasks,
    styleFingerprint: styleFingerprintBinding,
    reviewPrograms: {
      conditionAlignment: conditionAlignmentBinding,
      professionalAesthetic: {
        ...professionalAestheticBinding,
        role: threshold.implementationProvenance.professionalAesthetic.role,
      },
      styleFeatureExtractor: styleFeatureExtractorBinding,
    },
  };

  const programPaths = {
    nodeAdapter: ADAPTER_PATH,
    commonContract: COMMON_PATH,
    ticketAuthority: TICKET_PATH,
    machineReviewAdapter: REVIEW_ADAPTER_PATH,
    pythonAdapter: PYTHON_ADAPTER_PATH,
    pythonTrainingAdapter: PYTHON_TRAINING_ADAPTER_PATH,
    frozenTrainer: qualification.payload.programLineage?.trainer?.path,
    trainerSupport: qualification.payload.programLineage?.trainerSupport?.path,
    modelFactory: qualification.payload.programLineage?.modelFactory?.path,
    modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
    authorizationPolicy: "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
    currentRegistry: "src/server/ai-painter-current-execution-registry.mjs",
    outerRunner: OUTER_RUNNER_PATH,
    backgroundLauncher: BACKGROUND_LAUNCHER_PATH,
    launchIntentValidator: LAUNCH_INTENT_VALIDATOR_PATH,
    immutableRegistryEvidence: IMMUTABLE_REGISTRY_EVIDENCE_PATH,
    genericBackgroundLauncher: GENERIC_BACKGROUND_LAUNCHER_PATH,
    exactlyOnceBackgroundSpawn: EXACTLY_ONCE_SPAWN_PATH,
  };
  for (const [role, logicalPath] of Object.entries(programPaths)) {
    assert.ok(typeof logicalPath === "string" && logicalPath.length > 0,
      `Smoke program path missing: ${role}`);
  }
  const programLineage = Object.fromEntries(Object.entries(programPaths)
    .map(([role, logicalPath]) => [role, bindPath(root, logicalPath)]));
  const baseConfigBinding = bindPath(root, BASE_CONFIG_PATH);
  const currentTaskCapsuleBinding = bindDeclaredExact(
    root,
    current.registry.taskCapsule,
    "current qualification task capsule",
  );
  const currentTerminalBinding = bindDeclaredExact(
    root,
    current.registry.terminalEvidence,
    "current qualification terminal",
  );
  assert.deepEqual(currentTerminalBinding, qualification.terminalBinding,
    "current qualification terminal differs from qualification package terminal");
  assert.deepEqual(currentEvidence.transactionValue.currentStaged,
    currentEvidence.snapshot,
    "current transaction staged snapshot binding changed");

  return Object.freeze({
    datasetReleaseBinding,
    datasetRelease,
    sample,
    machineReviewInputs,
    objectMasks,
    programPaths: Object.freeze(programPaths),
    programLineage: Object.freeze(programLineage),
    baseConfigBinding,
    currentTaskCapsuleBinding,
    currentTerminalBinding,
  });
}

function verifyQualificationImmutableLineage(root, payload) {
  assert.ok(Array.isArray(payload.inputEvidence)
    && payload.inputEvidence.length > 0,
  "qualification inputEvidence is missing");
  const evidencePaths = new Set();
  for (const [index, binding] of payload.inputEvidence.entries()) {
    assert.equal(evidencePaths.has(binding?.path), false,
      `qualification inputEvidence path is duplicated at index ${index}`);
    evidencePaths.add(binding.path);
    bindDeclaredExact(root, binding,
      `qualification inputEvidence[${index}]`);
  }
  assert.ok(payload.programLineage
    && typeof payload.programLineage === "object"
    && !Array.isArray(payload.programLineage)
    && Object.keys(payload.programLineage).length > 0,
  "qualification programLineage is missing");
  for (const [role, binding] of Object.entries(payload.programLineage)) {
    bindDeclaredExact(root, binding, `qualification programLineage.${role}`);
  }
}

function requireExactQualificationInputEvidence(payload, expected, role) {
  const matches = payload.inputEvidence.filter((binding) =>
    binding?.path === expected.path);
  assert.equal(matches.length, 1,
    `${role} must occur exactly once in qualification inputEvidence`);
  assert.deepEqual(bindingIdentity(matches[0]), bindingIdentity(expected),
    `${role} differs from qualification inputEvidence`);
}

function bindDeclaredExact(root, declared, role) {
  assert.ok(declared && typeof declared.path === "string",
    `${role} path is missing`);
  assert.match(declared.sha256 ?? "", /^[a-f0-9]{64}$/u,
    `${role} SHA-256 is invalid`);
  const actual = bindPath(root, declared.path);
  assert.equal(actual.sha256, declared.sha256,
    `${role} SHA-256 mismatch`);
  if (Object.hasOwn(declared, "byteSize")) {
    assert.equal(actual.byteSize, declared.byteSize,
      `${role} byte size mismatch`);
  }
  return actual;
}

function bindingIdentity(binding) {
  return {
    path: binding.path,
    sha256: binding.sha256,
    byteSize: binding.byteSize,
  };
}

export function reconcileReadonlyLifecycle(root, qualificationTerminal, recordedAtUtc = new Date().toISOString()) {
  const statePath = resolveProjectPath(root, `${LIFECYCLE_ROOT}/state.json`, { mustExist: true, kind: "file" });
  const state = readJsonObject(statePath);
  if (state.state === "cpu_contract_verified") {
    return advanceCapabilityLifecycle({
      root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      targetState: "readonly_gpu_qualified",
      evidence: {
        schemaVersion: "ai-painter-capability-stage-evidence-v1",
        capabilityVersion: STAGE4_V2_CAPABILITY,
        targetState: "readonly_gpu_qualified",
        status: "passed",
        bindings: [qualificationTerminal],
      },
      recordedAtUtc,
    });
  }
  assert.equal(state.state, "readonly_gpu_qualified", `V2 lifecycle conflict: ${state.state}`);
  assert.ok(state.latestEvidence?.path, "readonly lifecycle evidence missing");
  const evidence = readJsonObject(path.join(path.dirname(statePath), state.latestEvidence.path));
  assert.ok(evidence.bindings.some((item) => item.path === qualificationTerminal.path
    && item.sha256 === qualificationTerminal.sha256), "readonly lifecycle does not bind the current qualification terminal");
  return state;
}

function selectFixedSample(datasetRelease) {
  assert.equal(datasetRelease.schemaVersion, "ai-painter-stage4-v2-dataset-release-contract-v1");
  assert.equal(datasetRelease.samples.length, 64);
  const rows = datasetRelease.samples.filter((item) => item.sampleId === FIXED_SAMPLE_ID);
  assert.equal(rows.length, 1, "fixed validation sample identity is not unique");
  assert.equal(rows[0].split, "validation");
  return rows[0];
}

function buildCapsule({ payload, terminal, terminalBinding, evidence }) {
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${payload.runId}-controlled-smoke-materialized`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-stage4-v2", nameZh: "AI Painter Stage4 V2" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: "controlled_smoke_materialized" },
    candidateTerminal: { runId: payload.runId, status: terminal.status, recordedAtUtc: terminal.recordedAtUtc },
    latestBlocker: null,
    nextAllowedAction: { code: SMOKE_BACKGROUND_LAUNCH_ACTION, labelZh: "由本地后台执行V2受控Smoke闭环。", ownerAuthorizationRequired: false, automaticExecutionAllowed: true },
    forbiddenActions: ["reuse_ticket_run_or_output", "read_historical_or_failed_denoiser_checkpoint", "lower_machine_review_threshold", "start_stage0_before_smoke_qualification"],
    taskIdentity: { modelId: STAGE4_V2_CAPABILITY, sampleId: FIXED_SAMPLE_ID, sampleSplit: "validation", seed: FIXED_SEED },
    latestTerminal: terminalBinding,
    evidence: evidence.map((binding, index) => ({ kind: `smoke_materialization_evidence_${index + 1}`, ...binding, sha256Verified: true })),
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true },
  };
}

const MATERIALIZATION_STEPS = Object.freeze([
  "generic_package",
  "package_payload",
  "smoke_ticket",
  "ticket_registered",
  "smoke_manifest",
  "materialization_terminal",
  "task_capsule",
]);

function loadOrCreateMaterializationIntent({
  root, identity, qualificationTerminal, requestedAtUtc,
}) {
  assert.ok(Number.isFinite(Date.parse(requestedAtUtc)),
    "Smoke materialization requestedAtUtc is invalid");
  const logicalDirectory = `${MATERIALIZATION_JOURNAL_ROOT}/${identity.packageId}`;
  const directory = resolveProjectPath(root, logicalDirectory);
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  if (fs.existsSync(directory)) {
    assert.equal(fs.statSync(directory).isDirectory(), true,
      "Smoke materialization journal namespace is not a directory");
  } else {
    fs.mkdirSync(directory, { recursive: false });
  }
  const intentPath = path.join(directory, "materialization-intent.json");
  if (!fs.existsSync(intentPath)) {
    writeOrVerifyMaterializationJson(intentPath, {
      schemaVersion:
        "ai-painter-stage4-v2-controlled-smoke-materialization-intent-v1",
      status: "materialization_intent_persisted",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: identity.packageId,
      runId: identity.runId,
      qualificationTerminal,
      ticketNonce: crypto.randomBytes(24).toString("hex"),
      stepOrder: MATERIALIZATION_STEPS,
      outputDirectory: `${SMOKE_OUTPUT_ROOT}/${identity.runId}`,
      ownerAuthorizationRequired: false,
      gpuStarted: false,
      trainingStarted: false,
      recordedAtUtc: requestedAtUtc,
    }, "Smoke materialization intent conflict");
  }
  const intent = readJsonObject(intentPath);
  assert.equal(intent.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-materialization-intent-v1");
  assert.equal(intent.status, "materialization_intent_persisted");
  assert.equal(intent.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(intent.packageId, identity.packageId);
  assert.equal(intent.runId, identity.runId);
  assert.deepEqual(intent.qualificationTerminal, qualificationTerminal,
    "Smoke materialization intent qualification identity differs");
  assert.match(intent.ticketNonce, /^[a-f0-9]{48}$/u,
    "Smoke materialization ticket nonce is invalid");
  assert.deepEqual(intent.stepOrder, MATERIALIZATION_STEPS);
  assert.equal(intent.outputDirectory,
    `${SMOKE_OUTPUT_ROOT}/${identity.runId}`);
  assert.equal(intent.ownerAuthorizationRequired, false);
  assert.equal(intent.gpuStarted, false);
  assert.equal(intent.trainingStarted, false);
  assert.ok(Number.isFinite(Date.parse(intent.recordedAtUtc)),
    "Smoke materialization intent timestamp is invalid");
  return Object.freeze({
    directory,
    logicalDirectory,
    intent: Object.freeze(intent),
    intentBinding: bindAbsolute(root, intentPath),
  });
}

function recordMaterializationStep({
  root, materialization, step, evidence, detail = null,
}) {
  const index = MATERIALIZATION_STEPS.indexOf(step);
  assert.ok(index >= 0, `unknown Smoke materialization step: ${step}`);
  for (let prior = 0; prior < index; prior += 1) {
    const priorPath = materializationStepPath(
      materialization.directory, prior, MATERIALIZATION_STEPS[prior],
    );
    assert.equal(fs.existsSync(priorPath), true,
      `Smoke materialization prior step is missing: ${MATERIALIZATION_STEPS[prior]}`);
  }
  const target = materializationStepPath(materialization.directory, index, step);
  const value = {
    schemaVersion:
      "ai-painter-stage4-v2-controlled-smoke-materialization-step-v1",
    status: "materialization_step_committed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: materialization.intent.packageId,
    runId: materialization.intent.runId,
    stepIndex: index + 1,
    step,
    materializationIntent: materialization.intentBinding,
    evidence: evidence.map((binding) => ({
      path: binding.path,
      sha256: binding.sha256,
    })),
    detail,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: materialization.intent.recordedAtUtc,
  };
  writeOrVerifyMaterializationJson(target, value,
    `Smoke materialization step conflict: ${step}`);
  return bindAbsolute(root, target);
}

function completeMaterializationJournal({ root, materialization, evidence }) {
  const stepBindings = MATERIALIZATION_STEPS.map((step, index) =>
    bindAbsolute(root, materializationStepPath(
      materialization.directory, index, step,
    )));
  const target = path.join(materialization.directory, "materialization-completed.json");
  const value = {
    schemaVersion:
      "ai-painter-stage4-v2-controlled-smoke-materialization-completion-v1",
    executionState: "completed",
    status: "controlled_smoke_materialization_completed_not_executed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: materialization.intent.packageId,
    runId: materialization.intent.runId,
    materializationIntent: materialization.intentBinding,
    committedSteps: stepBindings,
    evidence: evidence.map((binding) => ({
      path: binding.path,
      sha256: binding.sha256,
    })),
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: materialization.intent.recordedAtUtc,
  };
  writeOrVerifyMaterializationJson(target, value,
    "Smoke materialization completion conflict");
  return bindAbsolute(root, target);
}

function materializationStepPath(directory, index, step) {
  return path.join(directory,
    `${String(index + 1).padStart(2, "0")}-${step}.json`);
}

function writeOrVerifyMaterializationJson(targetPath, value, message) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  const stagedPath = `${targetPath}.staged`;
  if (fs.existsSync(targetPath)) {
    assert.equal(fs.statSync(targetPath).isFile(), true,
      `${message}: target is not a file`);
    assert.equal(fs.readFileSync(targetPath).equals(bytes), true, message);
    if (fs.existsSync(stagedPath)) {
      assert.equal(fs.readFileSync(stagedPath).equals(bytes), true,
        `${message}: staged bytes differ`);
      fs.unlinkSync(stagedPath);
    }
    return;
  }
  if (fs.existsSync(stagedPath)) {
    assert.equal(fs.readFileSync(stagedPath).equals(bytes), true,
      `${message}: staged bytes differ`);
  } else {
    const descriptor = fs.openSync(stagedPath, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, bytes);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  }
  try {
    fs.linkSync(stagedPath, targetPath);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    assert.equal(fs.readFileSync(targetPath).equals(bytes), true,
      `${message}: concurrent bytes differ`);
  }
  fs.unlinkSync(stagedPath);
}

function invokeMaterializationHook(hooks, name, value) {
  if (typeof hooks?.[name] === "function") hooks[name](value);
}

function newIdentity(qualificationTerminal) {
  assert.match(qualificationTerminal?.sha256 ?? "", /^[a-f0-9]{64}$/u,
    "qualification terminal identity is invalid");
  const runId = `stage4-v2-controlled-smoke-${qualificationTerminal.sha256.slice(0, 32)}`;
  return { packageId: runId, runId };
}
function bindPath(root, logicalPath) { const absolute = resolveProjectPath(root, logicalPath, { mustExist: true, kind: "file" }); return bindAbsolute(root, absolute); }
function uniqueBindings(values) {
  const map = new Map();
  for (const value of values) {
    const existing = map.get(value.path);
    if (existing) {
      assert.equal(existing.sha256, value.sha256,
        `conflicting evidence identity for path: ${value.path}`);
      continue;
    }
    map.set(value.path, value);
  }
  return [...map.values()];
}
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])); return value; }
function sha256Of(value) { return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }

export { SMOKE_BACKGROUND_LAUNCH_ACTION, SMOKE_PLAN_ACTION, SMOKE_RUN_ACTION, SMOKE_RUN_TASK };
