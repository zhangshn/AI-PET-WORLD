import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  materializeStage4V2ControlledSmoke,
} from "../plan-ai-painter-stage4-v2-controlled-smoke.mjs";
import {
  readSmokePayload,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  buildStage4V2QualificationProgramGraph,
} from "../lib/ai-painter-program-graph-manifest-v1.mjs";
import {
  bindProjectFile,
} from "../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const SOURCE_ROOT = process.cwd();
const CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const PLAN_ACTION = "plan:ai-painter-stage4-v2-controlled-smoke";
const BACKGROUND_ACTION = "launch:ai-painter-stage4-v2-controlled-smoke-background";
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6";
const FIXED_NOW = new Date("2026-09-01T00:00:00.000Z");
const KEY_PROTECTOR = {
  scheme: "test_copy_protector_v1",
  protect: (bytes) => Buffer.from(bytes),
  unprotect: (bytes) => Buffer.from(bytes),
};
const QUALIFICATION_PROGRAM_PATHS = Object.freeze({
  materializer: "scripts/plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
  backgroundLauncher: "scripts/launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs",
  nodeRunner: "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
  ticketCore: "scripts/lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs",
  qualificationLifecycle: "scripts/lib/ai-painter-stage4-v2-qualification-lifecycle-v1.mjs",
  pythonRunner: "ml/ai-painter/scripts/run_stage4_semantic_transport_v2_readonly_gpu_qualification.py",
  modelFactory: "ml/ai-painter/src/ai_painter/complete_world/model.py",
  successorModule: "scripts/plan-ai-painter-stage4-v2-controlled-smoke.mjs",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  trainerSupport: "ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py",
});
const SOURCE_QUALIFICATION_PROGRAM_GRAPH = buildStage4V2QualificationProgramGraph({
  projectRoot: SOURCE_ROOT,
  programLineage: Object.fromEntries(Object.entries(QUALIFICATION_PROGRAM_PATHS)
    .map(([role, logicalPath]) => [role, bindProjectFile(SOURCE_ROOT, logicalPath)])),
});

const positive = fixture();
try {
  const result = await materializeStage4V2ControlledSmoke({
    projectRoot: positive.root,
    now: FIXED_NOW,
    machineKeyProtector: KEY_PROTECTOR,
    commitCurrentRegistry: false,
    appendProgramEvent: false,
    currentRegistryReader: async () => positive.current,
  });
  assert.equal(result.status, "stage4_v2_controlled_smoke_package_materialized");
  assert.equal(result.nextMachineAction, BACKGROUND_ACTION);
  assert.equal(result.ownerAuthorizationRequired, false);
  assert.equal(result.gpuStarted, false);
  assert.equal(result.trainingStarted, false);
  const manifest = readBound(positive.root, result.packageManifest);
  assert.equal(manifest.status, "materialized_not_executed");
  assert.equal(manifest.outputDirectoryCreated, false);
  const payload = readBound(positive.root, manifest.packagePayload);
  assert.equal(payload.inputEvidence.some((item) =>
    item.path === ".runtime/ai-painter/current-execution-registry/current.json"), false,
  "Smoke payload persisted mutable current.json as evidence");
  assert.equal(payload.inputEvidence.some((item) =>
    item.path.endsWith("/transaction.json")), true,
  "Smoke payload omitted immutable current-registry transaction evidence");
  assert.equal(payload.inputEvidence.some((item) =>
    item.path.endsWith("/current.staged.json")), true,
  "Smoke payload omitted immutable current-registry staged snapshot evidence");
  assert.equal(fs.existsSync(path.join(
    positive.root, ...manifest.outputDirectory.split("/"),
  )), false, "planner must not create the training output directory");
  const terminal = readBound(positive.root, result.terminal);
  assert.equal(terminal.nextMachineAction, BACKGROUND_ACTION);
  assert.equal(terminal.gpuStarted, false);
  assert.equal(terminal.trainingStarted, false);
} finally { positive.cleanup(); }

for (const [role, relative] of [
  ["launchIntentValidator", "scripts/lib/ai-painter-stage4-v2-controlled-smoke-launch-intent-v1.mjs"],
  ["immutableRegistryEvidence", "scripts/lib/ai-painter-immutable-current-registry-evidence-v1.mjs"],
  ["genericBackgroundLauncher", "scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs"],
  ["exactlyOnceBackgroundSpawn", "scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs"],
]) {
  const lineageTamper = fixture();
  try {
    const result = await materializeStage4V2ControlledSmoke({
      projectRoot: lineageTamper.root,
      now: FIXED_NOW,
      machineKeyProtector: KEY_PROTECTOR,
      commitCurrentRegistry: false,
      appendProgramEvent: false,
      currentRegistryReader: async () => lineageTamper.current,
    });
    const manifest = readBound(lineageTamper.root, result.packageManifest);
    const payload = readBound(lineageTamper.root, manifest.packagePayload);
    assert.equal(payload.programLineage[role].path, relative,
      `Smoke payload omitted ${role} program lineage`);
    mutateValidBytes(lineageTamper, relative);
    assert.throws(() => readSmokePayload(lineageTamper.root, payload.packageId),
      /SHA-256 mismatch/u,
      `Smoke package accepted post-materialization ${role} substitution`);
  } finally { lineageTamper.cleanup(); }
}

const crashRecovery = fixture();
try {
  const eventIds = [];
  let registryPublications = 0;
  const externalDependencyCommitter = (input) => {
    eventIds.push(input.eventInput.id);
    const journal = {
      schemaVersion: input.journalSchemaVersion,
      state: "event_committed",
      operationId: input.operationId,
      packageId: input.packageId,
      runId: input.runId,
      bindings: input.bindings,
      eventId: input.eventInput.id,
    };
    if (fs.existsSync(input.journalPath)) {
      assert.deepEqual(JSON.parse(fs.readFileSync(input.journalPath, "utf8")), journal,
        "planner recovery changed its durable event journal");
    } else {
      fs.writeFileSync(input.journalPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
    }
    return {
      journal,
      eventCommit: { event: input.eventInput },
      dependencyManifest: {
        schemaVersion: "ai-painter-current-execution-registry-dependency-manifest-v1",
        mode: "external",
        fixtureOperationId: input.operationId,
      },
    };
  };
  await assert.rejects(() => materializeStage4V2ControlledSmoke({
    projectRoot: crashRecovery.root,
    now: FIXED_NOW,
    machineKeyProtector: KEY_PROTECTOR,
    commitCurrentRegistry: true,
    appendProgramEvent: true,
    currentRegistryReader: async () => crashRecovery.current,
    currentRegistryAdvancer: async () => {
      registryPublications += 1;
      throw new Error("registry must not be reached before injected crash");
    },
    externalDependencyCommitter,
    _testHooks: {
      afterPlannerExternalDependenciesCommitted: () => {
        throw new Error("injected:post-event-pre-registry");
      },
    },
  }), /injected:post-event-pre-registry/u);
  assert.equal(registryPublications, 0);
  const packagesBefore = findSmokePayloads(crashRecovery.root);
  assert.equal(packagesBefore.length, 1);
  const packageRoot = path.dirname(packagesBefore[0]);
  const ticketBefore = sha256(path.join(packageRoot, "smoke-ticket.json"));
  const result = await materializeStage4V2ControlledSmoke({
    projectRoot: crashRecovery.root,
    now: new Date("2026-09-01T01:00:00.000Z"),
    machineKeyProtector: KEY_PROTECTOR,
    commitCurrentRegistry: true,
    appendProgramEvent: true,
    currentRegistryReader: async () => crashRecovery.current,
    currentRegistryAdvancer: async (input) => {
      registryPublications += 1;
      assert.equal(input.packageId, resultIdentityFromPackagePath(packageRoot));
      assert.equal(input.nextMachineAction, BACKGROUND_ACTION);
      assert.equal(input.dependencyManifest.mode, "external");
      return { registry: { registryRevision: 61 }, registrySha256: "e".repeat(64) };
    },
    externalDependencyCommitter,
  });
  assert.equal(result.registryRevision, 61);
  assert.equal(registryPublications, 1);
  assert.equal(findSmokePayloads(crashRecovery.root).length, 1,
    "planner retry created another package");
  assert.equal(sha256(path.join(packageRoot, "smoke-ticket.json")), ticketBefore,
    "planner retry replaced the one-time Smoke ticket");
  assert.equal(eventIds.length, 2);
  assert.equal(eventIds[0], eventIds[1],
    "planner retry emitted a different program event identity");
  assert.equal(fs.existsSync(path.join(
    crashRecovery.root, ...readBound(crashRecovery.root, result.packageManifest)
      .outputDirectory.split("/"),
  )), false);
} finally { crashRecovery.cleanup(); }

const prefixCrashHooks = [
  "afterMaterializationIntentPersisted",
  "afterGenericPackageRootCreated",
  "afterGenericPackagePersisted",
  "afterGenericPackageMaterialized",
  "afterPayloadPersisted",
  "afterTicketPersisted",
  "afterTicketRegistered",
  "afterSmokeManifestPersisted",
  "afterTerminalPersisted",
  "afterCapsulePersisted",
];
for (const hookName of prefixCrashHooks) {
  const recovery = fixture();
  try {
    await assert.rejects(() => materializeStage4V2ControlledSmoke({
      projectRoot: recovery.root,
      now: FIXED_NOW,
      machineKeyProtector: KEY_PROTECTOR,
      commitCurrentRegistry: false,
      appendProgramEvent: false,
      currentRegistryReader: async () => recovery.current,
      _testHooks: {
        [hookName]: () => {
          throw new Error(`injected:materialization-prefix:${hookName}`);
        },
      },
    }), new RegExp(`injected:materialization-prefix:${hookName}`, "u"));
    const intentPath = findSingle(recovery.root,
      ".runtime/ai-painter/stage4-v2-controlled-smoke-materializations",
      "materialization-intent.json");
    const intentShaBefore = sha256(intentPath);
    const result = await materializeStage4V2ControlledSmoke({
      projectRoot: recovery.root,
      now: new Date("2026-09-01T03:00:00.000Z"),
      machineKeyProtector: KEY_PROTECTOR,
      commitCurrentRegistry: false,
      appendProgramEvent: false,
      currentRegistryReader: async () => recovery.current,
    });
    assert.equal(result.status,
      "stage4_v2_controlled_smoke_package_materialized");
    assert.equal(sha256(intentPath), intentShaBefore,
      `${hookName} recovery replaced the materialization intent`);
    assert.equal(findSmokePayloads(recovery.root).length, 1,
      `${hookName} recovery created a second package`);
    const packageRoot = path.dirname(findSmokePayloads(recovery.root)[0]);
    assert.equal(fs.existsSync(path.join(
      path.dirname(intentPath), "materialization-completed.json",
    )), true, `${hookName} recovery did not close the journal`);
    assert.equal(fs.existsSync(path.join(packageRoot, "task-capsule.json")), true);
    assert.equal(readTicketCount(recovery.root), 1,
      `${hookName} recovery registered more than one ticket`);
  } finally { recovery.cleanup(); }
}

const tamperedPrefix = fixture();
try {
  await assert.rejects(() => materializeStage4V2ControlledSmoke({
    projectRoot: tamperedPrefix.root,
    now: FIXED_NOW,
    machineKeyProtector: KEY_PROTECTOR,
    commitCurrentRegistry: false,
    appendProgramEvent: false,
    currentRegistryReader: async () => tamperedPrefix.current,
    _testHooks: {
      afterPayloadPersisted: () => {
        throw new Error("injected:tamper-prefix");
      },
    },
  }), /injected:tamper-prefix/u);
  const payloadPath = findSmokePayloads(tamperedPrefix.root)[0];
  fs.appendFileSync(payloadPath, " ", "utf8");
  await assert.rejects(() => materializeStage4V2ControlledSmoke({
    projectRoot: tamperedPrefix.root,
    now: new Date("2026-09-01T04:00:00.000Z"),
    machineKeyProtector: KEY_PROTECTOR,
    commitCurrentRegistry: false,
    appendProgramEvent: false,
    currentRegistryReader: async () => tamperedPrefix.current,
  }), /payload recovery differs/u);
  assert.equal(readTicketCount(tamperedPrefix.root), 0,
    "tampered materialization prefix registered a ticket");
} finally { tamperedPrefix.cleanup(); }

for (const [name, mutate, pattern] of [
  ["qualification_terminal", (f) => {
    f.current.currentTaskTerminal.status = "stage4_v2_readonly_gpu_qualification_failed";
  }, /qualification_passed/u],
  ["lifecycle", (f) => {
    f.current.registry.lifecycleStage = "cpu_contract_verified";
  }, /snapshot content mismatch|readonly_gpu_qualified/u],
  ["dataset_release_replacement", (f) => {
    const releasePath = path.join(f.root,
      "data/ai-painter/system-governance/ai-painter-stage4-v2-mvp64-dataset-release-v1.json");
    const release = JSON.parse(fs.readFileSync(releasePath, "utf8"));
    release.datasetReleaseIdentity = "stage4-v2-mvp64-valid-looking-replacement";
    fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`, "utf8");
  }, /qualification inputEvidence\[0\] SHA-256 mismatch|dataset release differs/u],
  ["source_manifest_replacement", (f) => mutateValidBytes(f,
    ".runtime/fixtures/source-manifest.json"), /qualification inputEvidence.*SHA-256 mismatch/u],
  ["source_index_replacement", (f) => mutateValidBytes(f,
    ".runtime/fixtures/source-index.json"), /qualification inputEvidence.*SHA-256 mismatch/u],
  ["sample194_image_replacement", (f) => mutateValidBytes(f,
    ".runtime/fixtures/sample-194.png"), /qualification inputEvidence.*SHA-256 mismatch/u],
  ["sample194_condition_replacement", (f) => mutateValidBytes(f,
    ".runtime/fixtures/condition-pack.json"), /qualification inputEvidence.*SHA-256 mismatch/u],
  ["object_mask_replacement", (f) => mutateValidBytes(f,
    ".runtime/fixtures/object_tree.png"), /object_tree.*SHA-256 mismatch/u],
  ["style_fingerprint_replacement", (f) => mutateValidBytes(f,
    ".runtime/fixtures/style-fingerprint.json"), /style fingerprint SHA-256 mismatch/u],
  ["condition_review_program_replacement", (f) => mutateValidBytes(f,
    ".runtime/fixtures/condition-alignment.mjs"), /condition alignment reviewer SHA-256 mismatch/u],
  ["aesthetic_review_program_replacement", (f) => mutateValidBytes(f,
    ".runtime/fixtures/professional-aesthetic.mjs"), /professional aesthetic reviewer SHA-256 mismatch/u],
  ["style_review_program_replacement", (f) => mutateValidBytes(f,
    ".runtime/fixtures/style-feature-extractor.mjs"), /style feature extractor SHA-256 mismatch/u],
  ["qualification_program_replacement", (f) => mutateValidBytes(f,
    "ml/ai-painter/src/ai_painter/complete_world/model.py"), /qualification programLineage\.modelFactory SHA-256 mismatch/u],
  ["review_threshold_replacement", (f) => mutateValidBytes(f,
    "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json"), /qualification inputEvidence.*SHA-256 mismatch|machine review threshold contract SHA-256 mismatch/u],
  ["threshold", (f) => {
    const qualificationPayloadPath = path.join(f.root,
      ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/qualification-package/package-payload.json");
    const payload = JSON.parse(fs.readFileSync(qualificationPayloadPath, "utf8"));
    payload.bindings.reviewThresholdContract.sha256 = "f".repeat(64);
    fs.writeFileSync(qualificationPayloadPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    const manifestPath = path.join(path.dirname(qualificationPayloadPath), "package-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.packagePayload = binding(f.root, qualificationPayloadPath);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }, /SHA-256|hash|mismatch/u],
]) {
  const negative = fixture();
  try {
    mutate(negative);
    await assert.rejects(() => materializeStage4V2ControlledSmoke({
      projectRoot: negative.root,
      now: FIXED_NOW,
      machineKeyProtector: KEY_PROTECTOR,
      commitCurrentRegistry: false,
      appendProgramEvent: false,
      currentRegistryReader: async () => negative.current,
    }), pattern, `${name} substitution must fail before materialization`);
    assertZeroPlannerWrites(negative, name);
  } finally { negative.cleanup(); }
}

process.stdout.write(`Stage4 V2 Smoke real planner: 2 positive + ${prefixCrashHooks.length} pre-terminal crash recoveries + 15 pre-materialization negative cases + 4 post-materialization program-lineage substitutions passed.\n`);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-smoke-planner-"));
  for (const relative of new Set([
    "data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json",
    "scripts/lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs",
    "scripts/lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs",
    "scripts/lib/ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs",
    "scripts/lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs",
    "scripts/lib/ai-painter-stage4-v2-controlled-smoke-launch-intent-v1.mjs",
    "scripts/lib/ai-painter-immutable-current-registry-evidence-v1.mjs",
    "scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs",
    "scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs",
    "ml/ai-painter/scripts/run_stage4_semantic_transport_v2_controlled_smoke.py",
    "ml/ai-painter/scripts/stage4_semantic_transport_v2_controlled_smoke_training.py",
    "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
    "ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py",
    "ml/ai-painter/src/ai_painter/complete_world/model.py",
    "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
    "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
    "src/server/ai-painter-current-execution-registry.mjs",
    "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs",
    "scripts/launch-ai-painter-stage4-v2-controlled-smoke-background.mjs",
    ...SOURCE_QUALIFICATION_PROGRAM_GRAPH.files.map((entry) => entry.path),
  ])) copy(root, relative);
  write(root, "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json", {});

  const evidence = (name, value = { status: "fixture" }) => binding(
    root, write(root, `.runtime/fixtures/${name}`, value),
  );
  const sourceManifest = evidence("source-manifest.json");
  const sourceIndex = evidence("source-index.json");
  const image = evidence("sample-194.png", { rgb: true });
  const masks = Object.fromEntries([
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
  ].map((role) => [role, evidence(`${role}.png`, { role })]));
  const channelIds = [
    ...Object.keys(masks),
    ...Array.from({ length: 19 }, (_, index) => `fixture_channel_${index + 1}`),
  ];
  const conditionPackPath = write(root, ".runtime/fixtures/condition-pack.json", {
    schemaVersion: "fixture-condition-pack-v1",
    channels: channelIds.map((id) => masks[id]
      ? { id, path: masks[id].path, sha256: masks[id].sha256 }
      : { id, ...evidence(`${id}.png`, { id }) }),
  });
  const conditionPack = binding(root, conditionPackPath);
  const samples = Array.from({ length: 64 }, (_, index) => ({
    sampleId: index === 0 ? SAMPLE_ID : `fixture-sample-${String(index).padStart(3, "0")}`,
    split: index === 0 ? "validation" : "train",
    image: index === 0 ? image : evidence(`sample-${index}.png`, { index }),
    conditionPack: index === 0 ? conditionPack : evidence(`condition-${index}.json`, { index }),
  }));
  const datasetReleasePath = write(root,
    "data/ai-painter/system-governance/ai-painter-stage4-v2-mvp64-dataset-release-v1.json", {
      schemaVersion: "ai-painter-stage4-v2-dataset-release-contract-v1",
      datasetReleaseIdentity: "stage4-v2-mvp64-fixture-release",
      status: "verified_dataset_release",
      immutable: true,
      releaseScope: { releasedSampleCount: 64 },
      sourcePackage: { manifest: sourceManifest, sourceIndex },
      samples,
    });
  const datasetRelease = binding(root, datasetReleasePath);

  const styleFingerprint = evidence("style-fingerprint.json");
  const conditionAlignment = evidence("condition-alignment.mjs");
  const professionalAesthetic = { ...evidence("professional-aesthetic.mjs"), role: "professional_aesthetic" };
  const styleFeatureExtractor = evidence("style-feature-extractor.mjs");
  const thresholdPath = write(root,
    "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json", {
      schemaVersion: "fixture-threshold-v1",
      styleFingerprint,
      implementationProvenance: {
        conditionAlignment, professionalAesthetic, styleFeatureExtractor,
      },
    });
  const threshold = binding(root, thresholdPath);
  const autoencoder = evidence("project-autoencoder.pt", { frozen: true });
  const qualificationTerminalPath = write(root,
    ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/qualification-package/terminal.json", {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
      executionState: "completed",
      status: "stage4_v2_readonly_gpu_qualification_passed",
      packageId: "qualification-package",
      runId: "qualification-run",
    });
  const qualificationTerminal = binding(root, qualificationTerminalPath);
  const qualificationProgramLineage = Object.fromEntries(
    Object.entries(QUALIFICATION_PROGRAM_PATHS).map(([role, logicalPath]) => [
      role,
      binding(root, path.join(root, ...logicalPath.split("/"))),
    ]),
  );
  const qualificationProgramGraphPath = write(root,
    ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/qualification-package/program-graph-manifest.json",
    buildStage4V2QualificationProgramGraph({
      projectRoot: root,
      programLineage: qualificationProgramLineage,
    }));
  const qualificationProgramGraph = binding(root, qualificationProgramGraphPath);
  const qualificationPayloadPath = write(root,
    ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/qualification-package/package-payload.json", {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-package-payload-v1",
      packageId: "qualification-package",
      runId: "qualification-run",
      bindings: { datasetRelease, reviewThresholdContract: threshold },
      autoencoderBinding: autoencoder,
      inputEvidence: [
        datasetRelease,
        sourceManifest,
        sourceIndex,
        image,
        conditionPack,
        autoencoder,
        threshold,
      ],
      programLineage: qualificationProgramLineage,
      programGraphManifest: qualificationProgramGraph,
    });
  const qualificationPayload = binding(root, qualificationPayloadPath);
  write(root,
    ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/qualification-package/package-manifest.json", {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-package-manifest-v1",
      packageId: "qualification-package",
      packagePayload: qualificationPayload,
      programGraphManifest: qualificationProgramGraph,
    });

  const capsule = evidence("qualification-capsule.json");
  const transactionId = "current-execution-registry-fixture";
  const registry = {
    schemaVersion: "ai-painter-current-execution-registry-v1",
    registryRevision: 60,
    eventSequence: 60,
    capabilityVersion: CAPABILITY,
    lifecycleStage: "readonly_gpu_qualified",
    nextMachineAction: PLAN_ACTION,
    packageId: "qualification-package",
    runId: "qualification-run",
    transactionId,
    taskCapsule: capsule,
    terminalEvidence: qualificationTerminal,
  };
  const currentPath = write(root,
    ".runtime/ai-painter/current-execution-registry/current.json", registry);
  const stagedPath = write(root,
    `.runtime/ai-painter/current-execution-registry/transactions/${transactionId}/current.staged.json`,
    registry);
  const stagedBinding = binding(root, stagedPath);
  write(root,
    `.runtime/ai-painter/current-execution-registry/transactions/${transactionId}/transaction.json`, {
      schemaVersion: "ai-painter-current-execution-registry-transaction-v1",
      transactionId,
      status: "committed",
      registryRevision: registry.registryRevision,
      currentSha256: sha256(currentPath),
      currentStaged: stagedBinding,
    });
  const lifecycleRoot = `.runtime/ai-painter/capability-lifecycle/${CAPABILITY}`;
  write(root, `${lifecycleRoot}/readonly-evidence.json`, {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    bindings: [qualificationTerminal],
  });
  const lifecycleStatePath = write(root, `${lifecycleRoot}/state.json`, {
    schemaVersion: "ai-painter-capability-lifecycle-state-v1",
    state: "readonly_gpu_qualified",
    latestEvidence: { path: "readonly-evidence.json" },
  });
  const current = {
    ok: true,
    registrySha256: sha256(currentPath),
    registry,
    currentTaskTerminal: JSON.parse(fs.readFileSync(qualificationTerminalPath, "utf8")),
  };
  const currentRegistryRoot = path.join(root, ".runtime", "ai-painter",
    "current-execution-registry");
  return {
    root, current,
    lifecycleStatePath,
    lifecycleStateSha256: sha256(lifecycleStatePath),
    currentRegistryDigest: directoryDigest(currentRegistryRoot),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function copy(root, relative) {
  const source = path.join(SOURCE_ROOT, ...relative.split("/"));
  const target = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
function write(root, relative, value) {
  const target = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const bytes = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(target, bytes, "utf8");
  return target;
}
function binding(root, absolute) {
  return {
    path: path.relative(root, absolute).replaceAll("\\", "/"),
    sha256: sha256(absolute),
    byteSize: fs.statSync(absolute).size,
  };
}
function sha256(absolute) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
}
function readBound(root, value) {
  const target = path.join(root, ...value.path.split("/"));
  assert.equal(sha256(target), value.sha256);
  return JSON.parse(fs.readFileSync(target, "utf8"));
}
function findSmokePayloads(root) {
  const base = path.join(root, ".runtime", "ai-painter", "autonomous-closed-loop-packages");
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { recursive: true })
    .filter((item) => String(item).endsWith("package-payload.json"))
    .map((item) => path.join(base, String(item)));
}
function resultIdentityFromPackagePath(packageRoot) {
  return path.basename(packageRoot);
}
function findSmokeOutputs(root) {
  const base = path.join(root, ".runtime", "ai-painter", "stage4-v2-controlled-smoke-executions");
  return fs.existsSync(base) ? fs.readdirSync(base) : [];
}
function findSingle(root, relativeBase, fileName) {
  const base = path.join(root, ...relativeBase.split("/"));
  assert.equal(fs.existsSync(base), true, `missing fixture directory: ${relativeBase}`);
  const matches = fs.readdirSync(base, { recursive: true })
    .filter((item) => path.basename(String(item)) === fileName)
    .map((item) => path.join(base, String(item)));
  assert.equal(matches.length, 1,
    `expected one ${fileName}, found ${matches.length}`);
  return matches[0];
}
function readTicketCount(root) {
  const databasePath = path.join(root, ".runtime", "ai-painter",
    "stage4-v2-controlled-smoke-ticket-ledger.sqlite");
  if (!fs.existsSync(databasePath)) return 0;
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return Number(database.prepare("SELECT COUNT(*) AS count FROM tickets").get().count);
  } finally {
    database.close();
  }
}

function mutateValidBytes(fixtureValue, relativePath) {
  const target = path.join(fixtureValue.root, ...relativePath.split("/"));
  fs.appendFileSync(target, " \n", "utf8");
}

function assertZeroPlannerWrites(fixtureValue, name) {
  assert.equal(findSmokePayloads(fixtureValue.root).length, 0,
    `${name} substitution created a Smoke package`);
  assert.equal(findSmokeOutputs(fixtureValue.root).length, 0,
    `${name} substitution created a training output`);
  assert.equal(fs.existsSync(path.join(fixtureValue.root, ".runtime", "ai-painter",
    "stage4-v2-controlled-smoke-ticket-ledger.sqlite")), false,
  `${name} substitution created the Smoke ticket ledger`);
  assert.equal(fs.existsSync(path.join(fixtureValue.root, ".runtime", "ai-painter",
    "stage4-v2-controlled-smoke-materializations")), false,
  `${name} substitution created a materialization journal`);
  assert.equal(directoryDigest(path.join(fixtureValue.root, ".runtime", "ai-painter",
    "current-execution-registry")), fixtureValue.currentRegistryDigest,
  `${name} substitution changed the current-execution registry`);
  assert.equal(sha256(fixtureValue.lifecycleStatePath),
    fixtureValue.lifecycleStateSha256,
    `${name} substitution changed the capability lifecycle`);
}

function directoryDigest(directory) {
  const entries = fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .sort()
    .map((filePath) => ({
      path: path.relative(directory, filePath).replaceAll("\\", "/"),
      sha256: sha256(filePath),
    }));
  return crypto.createHash("sha256")
    .update(JSON.stringify(entries))
    .digest("hex");
}
