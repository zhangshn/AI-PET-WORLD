import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  recoverCompletedSmokeTrainingExecution,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs";

const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6";
const SHA = "a".repeat(64);
const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-smoke-execute-recovery-"));

try {
  const payload = { packageId: "package-1", runId: "run-1" };
  const consumptionBinding = { path: ".runtime/test/consumption.json", sha256: SHA };
  const activeConfigBinding = { path: ".runtime/test/active-config.json", sha256: SHA };
  const materialization = {
    status: "committed",
    parentAtomicConsumption: consumptionBinding,
    activeConfig: activeConfigBinding,
  };
  const complete = path.join(root, ".runtime", "complete");
  fs.mkdirSync(complete, { recursive: true });
  fs.writeFileSync(path.join(complete, "manifest.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(complete, "progress.json"), `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-progress-v1",
    status: "completed",
    phase: "training_completed",
    packageId: payload.packageId,
    runId: payload.runId,
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    epoch: 30,
    epochTarget: 30,
    optimizerStep: 30,
    optimizerStepTarget: 30,
    percent: 100,
  }, null, 2)}\n`, "utf8");
  let validationCount = 0;
  const recovered = recoverCompletedSmokeTrainingExecution({
    projectRoot: root,
    payload,
    outputRoot: complete,
    consumptionBinding,
    activeConfigBinding,
    materialization,
    manifestValidator: ({ manifestPath }) => {
      validationCount += 1;
      assert.equal(manifestPath, path.join(complete, "manifest.json"));
      // The production validator verifies telemetry, 30 Epoch metrics,
      // Checkpoint, five previews and their byte-exact reproductions.
      return { checkpoint: { path: "checkpoint", sha256: SHA }, previews: Array(5).fill({}) };
    },
  });
  assert.equal(recovered.status, "passed");
  assert.equal(recovered.previewCount, 5);
  assert.equal(validationCount, 1);

  const partial = path.join(root, ".runtime", "partial");
  fs.mkdirSync(partial, { recursive: true });
  fs.writeFileSync(path.join(partial, "progress.json"), "{}\n", "utf8");
  assert.throws(() => recoverCompletedSmokeTrainingExecution({
    projectRoot: root,
    payload,
    outputRoot: partial,
    consumptionBinding,
    activeConfigBinding,
    materialization,
    manifestValidator: () => {
      throw new Error("partial output must not reach manifest validation");
    },
  }), /partial Smoke output has no completed manifest/u);

  const incompleteProgress = path.join(root, ".runtime", "incomplete-progress");
  fs.mkdirSync(incompleteProgress, { recursive: true });
  fs.writeFileSync(path.join(incompleteProgress, "manifest.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(incompleteProgress, "progress.json"), `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-progress-v1",
    status: "running",
    phase: "epoch_completed",
  })}\n`, "utf8");
  assert.throws(() => recoverCompletedSmokeTrainingExecution({
    projectRoot: root,
    payload,
    outputRoot: incompleteProgress,
    consumptionBinding,
    activeConfigBinding,
    materialization,
    manifestValidator: () => ({ checkpoint: {}, previews: Array(5).fill({}) }),
  }), /Expected values to be strictly equal/u);

  process.stdout.write("Stage4 V2 Smoke execute recovery: 1 completed-output recovery + 2 partial-output failures passed.\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
