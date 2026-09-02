import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repositoryRoot = process.cwd();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(),
  "stage4-v2-formal-plan-dependencies-"));
// Storage-catalog identities are project-scoped. Use an isolated fixture
// catalog so a retry test cannot collide with a durable event from another
// invocation while still exercising the real SQLite projection.
process.env.AI_PET_WORLD_DATA_ROOT = path.join(fixtureRoot, ".data");
const fixedAt = "2026-09-01T04:00:00.000Z";
const capabilityVersion =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const packageId = "stage4-v2-controlled-smoke-formal-fixture";
const runId = "stage4-v2-controlled-smoke-formal-fixture-run";

try {
  const evidenceRoot = path.join(fixtureRoot, ".runtime", "fixture-evidence");
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const writeEvidence = (name, value) => {
    const target = path.join(evidenceRoot, name);
    fs.writeFileSync(target, typeof value === "string"
      ? value : `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return bind(fixtureRoot, target);
  };
  const programGraph = writeEvidence("program-graph.json", {
    schemaVersion: "ai-painter-program-graph-manifest-v1",
    graphId: "stage4-v2-controlled-smoke-program-graph-v1",
  });
  const payload = writeEvidence("package-payload.json", {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-package-payload-v1",
    packageId,
    runId,
    capabilityVersion,
    outputDirectory: ".runtime/fixture-evidence",
    programGraphManifest: programGraph,
  });
  const packageManifest = writeEvidence("smoke-package-manifest.json", {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-package-manifest-v1",
    packageId,
    runId,
    capabilityVersion,
    packagePayload: payload,
    programGraphManifest: programGraph,
  });
  const resourceTelemetry = writeEvidence("resource-telemetry.json", {
    schemaVersion: "fixture-resource-telemetry-v1",
  });
  const checkpoint = writeEvidence("best-smoke-checkpoint.pt", "fixture-checkpoint");
  const checkpointMetadata = writeEvidence("best-smoke-checkpoint.metadata.json", {
    schemaVersion: "fixture-checkpoint-metadata-v1",
  });
  const metrics = writeEvidence("epoch-metrics.json", {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-epoch-metrics-v1",
  });
  const previews = [1, 5, 10, 20, 30].map((epoch) => ({
    epoch,
    ...writeEvidence(`preview-epoch-${epoch}.png`, `preview-${epoch}`),
  }));
  const trainingManifest = writeEvidence("manifest.json", {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-training-manifest-v1",
    status: "training_completed",
    packageId,
    runId,
    architectureId: capabilityVersion,
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previews,
    checkpoint,
    checkpointMetadata,
    metrics,
    resourceTelemetry,
    historicalDenoiserCheckpointRead: false,
    parentDenoiserCheckpoint: null,
    modelState: { changedByTraining: true },
    autoencoderState: {
      frozen: true,
      beforeSha256: "1".repeat(64),
      afterSha256: "1".repeat(64),
    },
  });
  const machineReview = writeEvidence("machine-review.json", {
    schemaVersion: "ai-painter-stage4-v2-machine-review-result-v1",
    status: "stage4_v2_machine_review_passed",
    architectureId: capabilityVersion,
    smokeRunId: runId,
    reviewNodeCount: 5,
    passCount: 5,
    failCount: 0,
  });
  const reviewExecutionBinding = writeEvidence("review-execution.json", {
    schemaVersion: "fixture-review-execution-v1",
  });
  const reviewPhaseEvidence = writeEvidence("review-phase.json", {
    schemaVersion: "fixture-review-phase-v1",
    result: { machineReview },
  });
  const causalAdjudication = writeEvidence("causal-adjudication.json", {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-causal-adjudication-v1",
    status: "completed_deterministic_adjudication",
    packageId,
    runId,
    decision: "controlled_smoke_qualified",
    previewPassCount: 5,
    previewFailCount: 0,
    sourceMachineReview: machineReview,
    sourceReviewExecutionBinding: reviewExecutionBinding,
    sourceReviewPhaseEvidence: reviewPhaseEvidence,
  });
  const adjudicationPhaseEvidence = writeEvidence("adjudication-phase.json", {
    schemaVersion: "fixture-adjudication-phase-v1",
    result: { adjudication: causalAdjudication },
  });
  const finalizationBinding = writeEvidence("smoke-finalization.json", {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-finalization-v1",
    executionState: "completed",
    status: "stage4_v2_controlled_smoke_passed",
    packageId,
    runId,
    capabilityVersion,
    trainingManifest,
    machineReview,
    reviewExecutionBinding,
    reviewPhaseEvidence,
    causalAdjudication,
    adjudicationPhaseEvidence,
    resourceTelemetry,
  });
  const genericTerminal = writeEvidence("closed-loop-terminal.json", {
    schemaVersion: "ai-painter-autonomous-closed-loop-terminal-v1",
    finalResult: { finalization: finalizationBinding },
  });
  const sourceTerminalPath = path.join(evidenceRoot, "smoke-terminal.json");
  const sourceTerminal = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_controlled_smoke_passed",
    packageId,
    runId,
    capabilityVersion,
    packageManifest,
    packagePayload: payload,
    programGraphManifest: programGraph,
    autonomousClosedLoopTerminal: genericTerminal,
    smokeFinalization: finalizationBinding,
    nextMachineAction: "plan:ai-painter-stage4-v2-formal-stage0-to-stage2",
    ownerAuthorizationRequired: false,
    automaticSuccessorAllowed: true,
    formalTrainingStarted: false,
    recordedAtUtc: fixedAt,
  };
  fs.writeFileSync(sourceTerminalPath,
    `${JSON.stringify(sourceTerminal, null, 2)}\n`, "utf8");
  const sourceTerminalBinding = bind(fixtureRoot, sourceTerminalPath);
  const current = {
    ok: true,
    registrySha256: "a".repeat(64),
    registry: {
      schemaVersion: "ai-painter-current-execution-registry-v1",
      registryRevision: 17,
      capabilityVersion,
      packageId,
      runId,
      lifecycleStage: "controlled_smoke_completed",
      taskId: "materialize_stage4_v2_formal_stage0_to_stage2",
      nextMachineAction: "plan:ai-painter-stage4-v2-formal-stage0-to-stage2",
      terminalEvidence: sourceTerminalBinding,
    },
    currentTaskTerminal: sourceTerminal,
  };

  process.chdir(fixtureRoot);
  const moduleUrl = pathToFileURL(path.join(repositoryRoot,
    "scripts/plan-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs"));
  moduleUrl.searchParams.set("fixture", crypto.randomUUID());
  const { materializeStage4V2FormalStage0ToStage2Plan } = await import(moduleUrl.href);
  let registryAdvanceCount = 0;
  let capturedDependencyManifest = null;
  const common = {
    projectRoot: fixtureRoot,
    now: new Date(fixedAt),
    currentRegistryReader: async () => current,
    registryAdvancer: async (input) => {
      registryAdvanceCount += 1;
      capturedDependencyManifest = input.dependencyManifest;
      return { registry: { registryRevision: 18 } };
    },
  };
  await assert.rejects(
    materializeStage4V2FormalStage0ToStage2Plan({
      ...common,
      _testHooks: {
        afterRegistryDependencyProgramEventCommitted() {
          const error = new Error("injected_post_event_pre_registry_crash");
          error.code = "AI_PAINTER_TEST_CRASH";
          throw error;
        },
      },
    }),
    /injected_post_event_pre_registry_crash/u,
  );
  assert.equal(registryAdvanceCount, 0,
    "registry advanced before its formal program-event dependency committed");
  const recovered = await materializeStage4V2FormalStage0ToStage2Plan(common);
  assert.equal(recovered.status, "materialized_not_executed");
  assert.equal(registryAdvanceCount, 1);
  assert.equal(capturedDependencyManifest.schemaVersion,
    "ai-painter-current-execution-registry-dependency-manifest-v1");
  assert.equal(capturedDependencyManifest.mode, "external");
  assert.equal(capturedDependencyManifest.outerJournal.requiredState,
    "event_committed");
  assert.deepEqual(capturedDependencyManifest.bindings.map(({ role }) => role), [
    "formal_stage0_to_stage2_plan",
    "formal_stage0_to_stage2_plan_terminal",
    "formal_stage0_to_stage2_plan_capsule",
    "parent_controlled_smoke_terminal",
    "parent_controlled_smoke_finalization",
  ]);
  const ledgerPath = path.join(fixtureRoot, ".runtime", "ai-painter",
    "training-process-ledger", "events.jsonl");
  const eventId = `stage4-v2-formal-plan-materialized-${runId}`;
  const matching = fs.readFileSync(ledgerPath, "utf8").trim().split(/\r?\n/u)
    .map((line) => JSON.parse(line)).filter(({ id }) => id === eventId);
  assert.equal(matching.length, 1,
    "post-event recovery duplicated the formal plan program event");
  const journalPath = path.join(fixtureRoot, ".runtime", "ai-painter",
    "stage4-v2-formal-stage0-to-stage2-plans", runId,
    "registry-dependency-journal.json");
  assert.equal(JSON.parse(fs.readFileSync(journalPath, "utf8")).state,
    "event_committed");

  process.stdout.write(`${JSON.stringify({
    status: "passed",
    postEventPreRegistryRecoveryVerified: true,
    exactProgramEventCount: matching.length,
    dependencyMode: capturedDependencyManifest.mode,
    gpuStarted: false,
    trainingStarted: false,
  }, null, 2)}\n`);
} finally {
  // The real event store keeps a process-local SQLite handle. Close it before
  // removing the isolated fixture so Windows does not retain the database
  // directory and turn a passed recovery test into a cleanup failure.
  try {
    const { closeStorageCatalog } = await import(
      "../lib/ai-pet-world-storage-catalog.mjs");
    closeStorageCatalog();
  } catch {
    // Preserve the original assertion/error if the fixture failed before the
    // storage catalog was initialized.
  }
  process.chdir(repositoryRoot);
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(fixtureRoot));
  assert.ok(relative.startsWith("stage4-v2-formal-plan-dependencies-")
    && !relative.includes(".."));
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

function bind(root, file) {
  return {
    path: path.relative(root, file).split(path.sep).join("/"),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    byteSize: fs.statSync(file).size,
  };
}
