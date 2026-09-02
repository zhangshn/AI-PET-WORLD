import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { executeStage4V2FormalStage0ToStage2 } from "../run-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-formal-executor-"));
try {
  const planPath = path.join(root, "formal-plan.json");
  const plan = buildPlan("formal-executor-blocked-run");
  writeJson(planPath, plan);
  const blocked = await executeStage4V2FormalStage0ToStage2({
    projectRoot: root,
    planPath: "formal-plan.json",
    planSha256: sha256(planPath),
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.blocker, "stage_0_authorization_input_missing");
  assert.equal(blocked.gpuStarted, false);
  assert.equal(blocked.trainingStarted, false);
  assert.ok(fs.existsSync(path.join(root, ".runtime", "ai-painter", "stage4-v2-formal-executions", plan.runId, "phase-terminal.json")));

  const sequencePlanPath = path.join(root, "sequence-plan.json");
  const sequencePlan = buildPlan("formal-executor-sequence-run");
  writeJson(sequencePlanPath, sequencePlan);
  const inputRoot = path.join(root, "inputs");
  fs.mkdirSync(inputRoot);
  const stageInputs = [0, 1, 2].map((stage) => {
    const authorizationPath = path.join(inputRoot, `stage-${stage}.authorization.json`);
    writeJson(authorizationPath, { stage });
    const input = {
      stage,
      packageId: sequencePlan.packageId,
      runId: `formal-executor-stage-${stage}`,
      authorizationPath: path.relative(root, authorizationPath).replaceAll("\\", "/"),
      authorizationSha256: sha256(authorizationPath),
    };
    if (stage > 0) {
      input.parentCheckpointPath = input.authorizationPath;
      input.parentCheckpointSha256 = input.authorizationSha256;
      input.parentTerminalPath = input.authorizationPath;
      input.parentTerminalSha256 = input.authorizationSha256;
    }
    return input;
  });
  const seenStages = [];
  const completed = await executeStage4V2FormalStage0ToStage2({
    projectRoot: root,
    planPath: "sequence-plan.json",
    planSha256: sha256(sequencePlanPath),
    stageInputs,
    commandRunner: async ({ stage }) => {
      seenStages.push(stage.stage);
      return {
        exitCode: 0,
        terminal: {
          status: "semantic_mixture_stage4_formal_stage_completed_closed",
          stage: stage.stage,
        },
      };
    },
  });
  assert.equal(completed.status, "completed");
  assert.deepEqual(seenStages, [0, 1, 2]);
  assert.equal(completed.gpuStarted, true);
  assert.equal(completed.trainingStarted, true);

  process.stdout.write(`${JSON.stringify({
    status: "passed",
    blockedWithoutStageInputs: true,
    orderedStages: seenStages,
    gpuStarted: false,
    trainingStarted: false,
  }, null, 2)}\n`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

function buildPlan(runId) {
  return {
    schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-v1",
    status: "materialized_not_executed",
    capabilityVersion: "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2",
    packageId: "formal-executor-package",
    runId,
    ownerAuthorizationRequired: false,
    orderedStages: [
      { stage: 0, width: 256, height: 192, epochCount: 40 },
      { stage: 1, width: 512, height: 384, epochCount: 40 },
      { stage: 2, width: 1024, height: 768, epochCount: 40 },
    ],
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
