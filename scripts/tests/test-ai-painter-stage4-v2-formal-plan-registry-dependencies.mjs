import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repositoryRoot = process.cwd();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(),
  "stage4-v2-formal-plan-dependencies-"));
const fixedAt = "2026-09-01T04:00:00.000Z";
const capabilityVersion =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const packageId = "stage4-v2-controlled-smoke-formal-fixture";
const runId = "stage4-v2-controlled-smoke-formal-fixture-run";

try {
  const evidenceRoot = path.join(fixtureRoot, ".runtime", "fixture-evidence");
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const finalizationPath = path.join(evidenceRoot, "smoke-finalization.json");
  fs.writeFileSync(finalizationPath, `${JSON.stringify({
    schemaVersion: "fixture-smoke-finalization-v1",
    status: "stage4_v2_controlled_smoke_passed",
  }, null, 2)}\n`, "utf8");
  const finalizationBinding = bind(fixtureRoot, finalizationPath);
  const sourceTerminalPath = path.join(evidenceRoot, "smoke-terminal.json");
  const sourceTerminal = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_controlled_smoke_passed",
    packageId,
    runId,
    smokeFinalization: finalizationBinding,
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
