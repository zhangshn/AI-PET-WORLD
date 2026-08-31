import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  MATERIALIZED_RUN_ACTION,
  MATERIALIZED_RUN_TASK,
  STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT,
  materializeStage4V2ReadonlyGpuQualification,
} from "../plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
import {
  DEFAULT_STAGE4_V2_QUALIFICATION_LEDGER_PATH,
  STAGE4_V2_CAPABILITY,
  validateStage4V2PreReleaseQualificationTicket,
} from "../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const PREFIX_HOOKS = [
  "afterMaterializationIntentPersisted",
  "afterPackageDirectoryCreated",
  "afterPackagePayloadPersisted",
  "afterQualificationTicketPersisted",
  "afterTicketRegistered",
  "afterPackageManifestPersisted",
  "afterMaterializationTerminalPersisted",
  "afterMaterializationCapsulePersisted",
  "afterMaterializationJournalPersisted",
  "afterProgramEventCommitted",
  "afterMaterializationEventCommitEvidencePersisted",
  "afterPreRegistryCompletionReceiptPersisted",
  "afterRegistryDependencyManifestPersisted",
  "afterRegistryCommitted",
  "afterMaterializationCompletionPersisted",
];

for (const hookName of PREFIX_HOOKS) {
  const fixture = createFixture();
  try {
    const firstNow = new Date("2026-09-01T03:00:00.000Z");
    await assert.rejects(
      materializeStage4V2ReadonlyGpuQualification({
        ...fixture.arguments,
        now: firstNow,
        _testHooks: {
          onMaterializationPoint(point) {
            if (point === hookName) throw new Error(`injected:${hookName}`);
          },
        },
      }),
      new RegExp(`injected:${hookName}`, "u"),
    );
    const intentDirectory = path.join(
      fixture.root,
      ...STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT.split("/"),
      fixture.source.registrySha256,
    );
    const intentPath = path.join(intentDirectory, "materialization-intent.json");
    assert.equal(fs.existsSync(intentPath), true, `${hookName} lost materialization intent`);
    const originalIntentBytes = fs.readFileSync(intentPath);

    const recovered = await materializeStage4V2ReadonlyGpuQualification({
      ...fixture.arguments,
      now: new Date("2026-09-01T07:00:00.000Z"),
    });
    assert.equal(recovered.packageId, JSON.parse(originalIntentBytes).packageId,
      `${hookName} minted another qualification package`);
    assert.equal(recovered.runId, JSON.parse(originalIntentBytes).runId,
      `${hookName} minted another qualification run`);
    assert.deepEqual(fs.readFileSync(intentPath), originalIntentBytes,
      `${hookName} recovery rewrote the materialization intent`);
    assert.equal(fixture.registryCommitCount(), 1,
      `${hookName} published the current registry more than once`);
    assert.equal(fixture.uniqueProgramEventCount(), 1,
      `${hookName} duplicated the materialization program event`);
    assert.equal(fs.existsSync(path.join(intentDirectory, "materialization-published.json")), true,
      `${hookName} recovery omitted the publication receipt`);
    const packageRoot = path.join(fixture.root, recovered.packageManifest.path, "..");
    const dependencyManifest = JSON.parse(fs.readFileSync(path.join(
      path.resolve(packageRoot),
      "registry-dependency-manifest.json",
    ), "utf8"));
    assert.equal(dependencyManifest.mode, "external");
    assert.match(dependencyManifest.outerJournal.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(dependencyManifest.outerJournal.operationId,
      `stage4-v2-readonly-gpu-qualification-materialization:${fixture.source.registrySha256}`);
    assert.ok(dependencyManifest.bindings.some(
      (entry) => entry.role === "qualification_materialization_completion_receipt"));
    assert.equal(ticketLedgerCount(fixture.root), 1,
      `${hookName} recovery registered more than one qualification ticket`);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

await testTamperedMaterializationPrefixFailsClosed();
await testParentRegistryEvidenceSurvivesRevisionAndRejectsTamper();

process.stdout.write(
  `Stage4 V2 readonly-GPU qualification materialization recovery: ${PREFIX_HOOKS.length} crash prefixes and tamper rejection passed.\n`,
);

async function testTamperedMaterializationPrefixFailsClosed() {
  const cases = [
    ["intent", "afterMaterializationIntentPersisted", null, "ticketNonce"],
    ["payload", "afterPackagePayloadPersisted", "package-payload.json", "status"],
    ["ticket", "afterQualificationTicketPersisted", "pre-release-qualification-ticket.json", "status"],
    ["manifest", "afterPackageManifestPersisted", "package-manifest.json", "status"],
    ["terminal", "afterMaterializationTerminalPersisted", "materialization-terminal.json", "status"],
    ["capsule", "afterMaterializationCapsulePersisted", "task-capsule.json", "schemaVersion"],
    ["journal", "afterMaterializationJournalPersisted", "outer-transaction-journal.json", "operationId"],
    ["event commit", "afterMaterializationEventCommitEvidencePersisted", "materialization-event-commit.json", "status"],
    ["completion receipt", "afterPreRegistryCompletionReceiptPersisted", "materialization-completion-receipt.json", "status"],
    ["dependency manifest", "afterRegistryDependencyManifestPersisted", "registry-dependency-manifest.json", "mode"],
  ];
  for (const [label, hookName, packageFile, field] of cases) {
    const fixture = createFixture();
    try {
      await assert.rejects(
        materializeStage4V2ReadonlyGpuQualification({
          ...fixture.arguments,
          now: new Date("2026-09-01T03:00:00.000Z"),
          _testHooks: {
            onMaterializationPoint(point) {
              if (point === hookName) throw new Error(`injected:tamper:${label}`);
            },
          },
        }),
        new RegExp(`injected:tamper:${label}`, "u"),
      );
      const intentPath = path.join(
        fixture.root,
        ...STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT.split("/"),
        fixture.source.registrySha256,
        "materialization-intent.json",
      );
      const intent = JSON.parse(fs.readFileSync(intentPath, "utf8"));
      const target = packageFile === null
        ? intentPath
        : path.join(fixture.root, ...intent.packageDirectory.split("/"), packageFile);
      const value = JSON.parse(fs.readFileSync(target, "utf8"));
      value[field] = `tampered-${label}`;
      fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      let rejected = false;
      try {
        await materializeStage4V2ReadonlyGpuQualification({
          ...fixture.arguments,
          now: new Date("2026-09-01T08:00:00.000Z"),
        });
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, `${label} tamper was accepted`);
      assert.equal(fixture.registryCommitCount(), 0,
        `${label} tamper reached current registry publication`);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  }

  const fixture = createFixture();
  try {
    await assert.rejects(materializeStage4V2ReadonlyGpuQualification({
      ...fixture.arguments,
      now: new Date("2026-09-01T03:00:00.000Z"),
      _testHooks: {
        onMaterializationPoint(point) {
          if (point === "afterTicketRegistered") throw new Error("injected:ledger-conflict");
        },
      },
    }), /injected:ledger-conflict/u);
    const ledger = new DatabaseSync(path.join(
      fixture.root,
      ...DEFAULT_STAGE4_V2_QUALIFICATION_LEDGER_PATH.split("/"),
    ));
    try {
      ledger.prepare(
        "UPDATE stage4_v2_qualification_tickets SET status='consumed_once'",
      ).run();
    } finally {
      ledger.close();
    }
    await assert.rejects(materializeStage4V2ReadonlyGpuQualification({
      ...fixture.arguments,
      now: new Date("2026-09-01T08:00:00.000Z"),
    }), /re-registration|consumed/u);
    assert.equal(fixture.registryCommitCount(), 0,
      "ledger identity conflict reached current registry publication");
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

async function testParentRegistryEvidenceSurvivesRevisionAndRejectsTamper() {
  const fixture = createFixture();
  try {
    const materialized = await materializeStage4V2ReadonlyGpuQualification({
      ...fixture.arguments,
      now: new Date("2026-09-01T03:00:00.000Z"),
    });
    const payload = read(fixture.root, materialized.packageManifest.path.replace(
      /package-manifest\.json$/u,
      "package-payload.json",
    ));
    const ticket = read(fixture.root, materialized.ticket.path);
    const intent = read(
      fixture.root,
      `${STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT}/${payload.parentRegistry.binding.sha256}/materialization-intent.json`,
    );
    const publicationReceipt = read(
      fixture.root,
      `${STAGE4_V2_QUALIFICATION_MATERIALIZATION_ROOT}/${payload.parentRegistry.binding.sha256}/materialization-published.json`,
    );
    const inputPaths = new Set(ticket.inputEvidence.map((entry) => entry.path));
    assert.equal(inputPaths.has(
      ".runtime/ai-painter/current-execution-registry/current.json"), false,
    "mutable current.json leaked into qualification ticket evidence");
    assert.ok([...inputPaths].some((entry) => entry.endsWith("/transaction.json")),
      "qualification ticket omitted the committed parent registry transaction");
    assert.ok([...inputPaths].some((entry) => entry.endsWith("/current.staged.json")),
      "qualification ticket omitted the immutable parent registry snapshot");
    assert.equal(JSON.stringify(intent).includes(
      ".runtime/ai-painter/current-execution-registry/current.json"), false,
    "mutable current.json leaked into qualification materialization intent");
    assert.equal(JSON.stringify(publicationReceipt).includes(
      ".runtime/ai-painter/current-execution-registry/current.json"), false,
    "mutable current.json leaked into qualification publication receipt");
    assert.deepEqual(intent.parentRegistry.transaction, payload.parentRegistry.transaction,
      "materialization intent did not bind the committed parent transaction");
    assert.deepEqual(intent.parentRegistry.snapshot, payload.parentRegistry.binding,
      "materialization intent did not bind the immutable parent snapshot");

    const visible = fixture.currentVisible();
    fs.writeFileSync(path.join(
      fixture.root,
      ".runtime/ai-painter/current-execution-registry/current.json",
    ), `${JSON.stringify(visible.registry, null, 2)}\n`, "utf8");
    validateStage4V2PreReleaseQualificationTicket({
      projectRoot: fixture.root,
      ticket,
      packagePayload: payload,
      verifyEvidence: true,
    });

    const transactionBinding = ticket.inputEvidence.find(
      (entry) => entry.path.endsWith("/transaction.json"),
    );
    fs.appendFileSync(path.join(fixture.root, ...transactionBinding.path.split("/")), " ");
    assert.throws(() => validateStage4V2PreReleaseQualificationTicket({
      projectRoot: fixture.root,
      ticket,
      packagePayload: payload,
      verifyEvidence: true,
    }), /SHA-256/u);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }

  const stagedFixture = createFixture();
  try {
    const materialized = await materializeStage4V2ReadonlyGpuQualification({
      ...stagedFixture.arguments,
      now: new Date("2026-09-01T03:00:00.000Z"),
    });
    const payload = read(stagedFixture.root, materialized.packageManifest.path.replace(
      /package-manifest\.json$/u,
      "package-payload.json",
    ));
    const ticket = read(stagedFixture.root, materialized.ticket.path);
    const snapshotBinding = ticket.inputEvidence.find(
      (entry) => entry.path.endsWith("/current.staged.json"),
    );
    fs.appendFileSync(path.join(stagedFixture.root, ...snapshotBinding.path.split("/")), " ");
    assert.throws(() => validateStage4V2PreReleaseQualificationTicket({
      projectRoot: stagedFixture.root,
      ticket,
      packagePayload: payload,
      verifyEvidence: true,
    }), /SHA-256/u);
  } finally {
    fs.rmSync(stagedFixture.root, { recursive: true, force: true });
  }
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-qualification-plan-"));
  const writeObject = (logicalPath, value = { status: "fixture" }) => {
    const absolute = path.join(root, ...logicalPath.split("/"));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return bind(root, logicalPath);
  };
  const writeBytes = (logicalPath, value = "fixture\n") => {
    const absolute = path.join(root, ...logicalPath.split("/"));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, value);
    return bind(root, logicalPath);
  };

  for (const logicalPath of [
    "scripts/plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
    "scripts/launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs",
    "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
    "scripts/lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs",
    "scripts/lib/ai-painter-stage4-v2-qualification-lifecycle-v1.mjs",
    "ml/ai-painter/scripts/run_stage4_semantic_transport_v2_readonly_gpu_qualification.py",
    "ml/ai-painter/model-factory.py",
    "ml/ai-painter/successor.py",
    "ml/ai-painter/trainer.py",
    "ml/ai-painter/trainer-support.py",
  ]) writeBytes(logicalPath, `fixture:${logicalPath}\n`);

  const condition = writeObject("data/condition-contract.json");
  const sourceManifest = writeObject("data/source-manifest.json");
  const sourceIndex = writeObject("data/source-index.json");
  const loss = writeObject("data/loss-contract.json");
  const threshold = writeObject("data/review-threshold.json");
  const autoencoderCheckpoint = writeBytes("data/autoencoder.ckpt", "fixture-checkpoint");
  const autoencoderManifest = writeObject("data/autoencoder-source.json");
  const foundation = writeObject("data/foundation-contract.json", {
    assetIdentity: "fixture-autoencoder",
    capabilityReleaseStatus: "not_released",
    lineageInterpretation: { denoiserWeightsMayBeLoaded: false },
    checkpoint: autoencoderCheckpoint,
    sourceManifest: autoencoderManifest,
  });
  const trainImage = writeBytes("data/train-image.bin");
  const trainCondition = writeBytes("data/train-condition.bin");
  const validationImage = writeBytes("data/validation-image.bin");
  const validationCondition = writeBytes("data/validation-condition.bin");
  const dataset = writeObject("data/dataset-release.json", {
    status: "verified_dataset_release",
    releaseScope: { releasedSampleCount: 64 },
    samples: [
      {
        sampleId: "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
        split: "train",
        image: trainImage,
        conditionPack: trainCondition,
      },
      {
        sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
        split: "validation",
        image: validationImage,
        conditionPack: validationCondition,
      },
    ],
  });
  const programBindings = {
    modelFactory: bind(root, "ml/ai-painter/model-factory.py"),
    successorModule: bind(root, "ml/ai-painter/successor.py"),
    trainer: bind(root, "ml/ai-painter/trainer.py"),
    trainerSupport: bind(root, "ml/ai-painter/trainer-support.py"),
  };
  const contract = writeObject("data/v2-parent-contract.json", {
    schemaVersion: "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2",
    contractId: "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2",
    architectureId: STAGE4_V2_CAPABILITY,
    status: "cpu_supported_inactive",
    activationGates: { gpuNow: false, trainingNow: false },
    conditionContract: condition,
    datasetBinding: { ...dataset, sourceManifest, sourceIndex },
    lossContract: loss,
    reviewThresholdContract: threshold,
    foundationAssetBinding: { ...foundation, identity: "fixture-autoencoder" },
    programBindings,
  });
  const cpuReport = writeObject("data/cpu-report.json");
  const sourceAdjudicationTerminal = writeObject("data/source-adjudication-terminal.json");
  const sourceAdjudicationClassification = writeObject("data/source-adjudication-classification.json");
  const cpuTerminal = writeObject(".runtime/source/cpu-terminal.json", {
    schemaVersion: "stage4-v2-cpu-contract-acceptance-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_cpu_contract_acceptance_passed_inactive",
    activationState: "inactive",
    ownerAuthorizationRequired: false,
    safety: { gpuStarted: false, trainingStarted: false },
    cpuAcceptanceReport: cpuReport,
    sourceAdjudication: {
      terminal: sourceAdjudicationTerminal,
      classification: sourceAdjudicationClassification,
    },
    successorContract: contract,
  });
  const capsule = writeObject(".runtime/source/task-capsule.json");
  const registryDocument = {
    schemaVersion: "ai-painter-current-execution-registry-v1",
    registryRevision: 1,
    eventSequence: 1,
    transactionId: "fixture-current-transaction",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: "fixture-cpu-package",
    runId: "fixture-cpu-run",
    taskId: "plan_stage4_v2_readonly_gpu_qualification",
    taskKind: "cpu_readonly_gpu_qualification_planning",
    nextMachineAction: "plan:ai-painter-stage4-v2-readonly-gpu-qualification",
    lifecycleStage: "cpu_contract_verified",
    executionState: "package_materialized",
    activeExecution: null,
    taskCapsule: capsule,
    terminalEvidence: cpuTerminal,
  };
  const currentBinding = writeObject(
    ".runtime/ai-painter/current-execution-registry/current.json",
    registryDocument,
  );
  const currentStaged = writeObject(
    ".runtime/ai-painter/current-execution-registry/transactions/fixture-current-transaction/current.staged.json",
    registryDocument,
  );
  writeObject(
    ".runtime/ai-painter/current-execution-registry/transactions/fixture-current-transaction/transaction.json",
    {
      schemaVersion: "ai-painter-current-execution-registry-transaction-v1",
      transactionId: "fixture-current-transaction",
      status: "committed",
      registryRevision: 1,
      currentSha256: currentBinding.sha256,
      currentStaged,
    },
  );
  let visible = {
    ok: true,
    registrySha256: currentBinding.sha256,
    registry: registryDocument,
    currentTaskTerminal: read(root, cpuTerminal.path),
  };
  const events = new Map();
  let registryCommits = 0;
  const programEventWriter = (event) => {
    if (!events.has(event.id)) events.set(event.id, structuredClone(event));
    else assert.deepEqual(events.get(event.id), event,
      "materialization event changed across recovery");
    return {
      event,
      ledger: { path: ".runtime/fixture/events.jsonl", sha256: "1".repeat(64) },
      latest: { path: ".runtime/fixture/latest.json", sha256: "2".repeat(64) },
      catalog: {
        ledgerArtifact: { path: ".runtime/fixture/events.jsonl", sha256: "1".repeat(64) },
        latestArtifact: { path: ".runtime/fixture/latest.json", sha256: "2".repeat(64) },
      },
    };
  };
  const registryWriter = async (input) => {
    registryCommits += 1;
    const outer = read(root, input.dependencyManifest.outerJournal.path);
    assert.equal(outer.state, "event_committed");
    assert.equal(outer.operationId, input.dependencyManifest.outerJournal.operationId);
    assert.equal(bind(root, input.dependencyManifest.outerJournal.path).sha256,
      input.dependencyManifest.outerJournal.sha256);
    const terminalEvidence = bind(root, input.terminalEvidencePath);
    const taskCapsule = bind(root, input.taskCapsulePath);
    visible = {
      ok: true,
      registrySha256: "b".repeat(64),
      registry: {
        ...input,
        registryRevision: 2,
        activeExecution: null,
        terminalEvidence,
        taskCapsule,
      },
      currentTaskTerminal: read(root, input.terminalEvidencePath),
    };
    return visible;
  };
  const protector = {
    scheme: "fixture_copy_machine_protector_v1",
    protect: (bytes) => Buffer.from(bytes),
    unprotect: (bytes) => Buffer.from(bytes),
  };
  return {
    root,
    source: visible,
    arguments: {
      projectRoot: root,
      machineKeyProtector: protector,
      currentRegistryReader: async () => visible,
      registryWriter,
      programEventWriter,
    },
    registryCommitCount: () => registryCommits,
    uniqueProgramEventCount: () => events.size,
    currentVisible: () => visible,
  };
}

function ticketLedgerCount(root) {
  const db = new DatabaseSync(path.join(root, ...DEFAULT_STAGE4_V2_QUALIFICATION_LEDGER_PATH.split("/")));
  try {
    return Number(db.prepare(
      "SELECT COUNT(*) AS count FROM stage4_v2_qualification_tickets",
    ).get().count);
  } finally {
    db.close();
  }
}

function bind(root, logicalPath) {
  const absolute = path.join(root, ...logicalPath.split("/"));
  return {
    path: logicalPath,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex"),
    byteSize: fs.statSync(absolute).size,
  };
}

function read(root, logicalPath) {
  return JSON.parse(fs.readFileSync(path.join(root, ...logicalPath.split("/")), "utf8"));
}
