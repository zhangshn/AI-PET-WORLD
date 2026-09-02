import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import { formatShanghai } from "./lib/ai-painter-program-event-store.mjs";
import {
  bindAbsolute,
  readBoundJson,
  readJsonObject,
  resolveProjectPath,
  sha256File,
  STAGE4_V2_CAPABILITY,
  writeExclusiveJson,
} from "./lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  FORMAL_PLAN_ACTION,
  validateOuterFinalizationChain,
} from "./run-ai-painter-stage4-v2-controlled-smoke.mjs";
import {
  commitStage4V2ExternalRegistryDependencies,
} from "./lib/ai-painter-stage4-v2-external-registry-dependency-v1.mjs";

const FORMAL_EXECUTOR_ACTION = "run:ai-painter-stage4-v2-formal-stage0-to-stage2";

const PLAN_ROOT = ".runtime/ai-painter/stage4-v2-formal-stage0-to-stage2-plans";
const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  materializeStage4V2FormalStage0ToStage2Plan({ projectRoot: process.cwd() }).then(
    (result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
  ).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function materializeStage4V2FormalStage0ToStage2Plan({
  projectRoot = process.cwd(),
  now = new Date(),
  currentRegistryReader = readCurrentExecutionRegistry,
  registryAdvancer = advanceCurrentExecutionRegistry,
  dependencyCommitter = commitStage4V2ExternalRegistryDependencies,
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  const current = await currentRegistryReader(root);
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
  assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
  if (current.registry.taskId === "stage4_v2_formal_stage0_to_stage2_plan_completed") {
    assert.equal(current.currentTaskTerminal.schemaVersion,
      "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-terminal-v1");
    return Object.freeze({
      schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-result-v1",
      status: "materialized_not_executed",
      plan: current.currentTaskTerminal.plan,
      terminal: current.registry.terminalEvidence,
      registryRevision: current.registry.registryRevision,
      recoveredCommittedResult: true,
      formalTrainingStarted: false,
      ownerAuthorizationRequired: false,
    });
  }
  assert.equal(current.registry.lifecycleStage, "controlled_smoke_completed");
  assert.equal(current.registry.nextMachineAction, FORMAL_PLAN_ACTION);
  const { sourceTerminal, smokeFinalization } =
    verifyControlledSmokeSuccessHandoff(root, current);
  const plan = {
    schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-v1",
    status: "materialized_not_executed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: current.registry.packageId,
    runId: current.registry.runId,
    parentControlledSmokeTerminal: current.registry.terminalEvidence,
    parentControlledSmokeFinalization: sourceTerminal.smokeFinalization,
    orderedStages: [
      { stage: 0, width: 256, height: 192, epochCount: 40 },
      { stage: 1, width: 512, height: 384, epochCount: 40 },
      { stage: 2, width: 1024, height: 768, epochCount: 40 },
    ],
    closedLoopRequired: true,
    automaticMachineReviewRequired: true,
    automaticCausalAdjudicationRequired: true,
    ownerAuthorizationRequired: false,
    executor: {
      action: FORMAL_EXECUTOR_ACTION,
      status: "registered_not_started",
      requiresStageInputs: true,
    },
    gpuAuthorizationCreated: false,
    trainingStarted: false,
    recordedAtUtc: sourceTerminal.recordedAtUtc,
  };
  const target = resolveProjectPath(root,
    `${PLAN_ROOT}/${current.registry.runId}/formal-plan.json`);
  writeOrVerifyJson(target, plan);
  const planBinding = bindAbsolute(root, target);
  const terminal = {
    schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-terminal-v1",
    executionState: "completed",
    status: "formal_training_closed_loop_plan_materialized_not_executed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: current.registry.packageId,
    runId: current.registry.runId,
    plan: planBinding,
    formalTrainingStarted: false,
    nextMachineAction: FORMAL_EXECUTOR_ACTION,
    ownerAuthorizationRequired: false,
    recordedAtUtc: plan.recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(plan.recordedAtUtc),
  };
  const terminalPath = resolveProjectPath(root,
    `${PLAN_ROOT}/${current.registry.runId}/terminal.json`);
  writeOrVerifyJson(terminalPath, terminal);
  const terminalBinding = bindAbsolute(root, terminalPath);
  const capsule = {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${current.registry.runId}-formal-plan-completed`,
    generatedFrom: "program_saved_evidence", readOnly: true,
    module: { id: "ai-painter-stage4-v2", nameZh: "AI Painter Stage4 V2" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: terminal.status },
    candidateTerminal: { runId: current.registry.runId, status: terminal.status, recordedAtUtc: terminal.recordedAtUtc },
    latestBlocker: { code: "formal_training_not_started_in_controlled_smoke_scope", summaryZh: "正式Stage 0→1→2闭环计划已形成；本次受控Smoke执行范围未启动正式训练。" },
    nextAllowedAction: FORMAL_EXECUTOR_ACTION,
    forbiddenActions: ["start_formal_training_from_smoke_scope", "reuse_smoke_checkpoint_as_formal_parent", "lower_machine_review_threshold"],
    taskIdentity: { modelId: STAGE4_V2_CAPABILITY, runId: current.registry.runId },
    latestTerminal: terminalBinding,
    evidence: [planBinding, terminalBinding].map((binding, index) => ({ kind: `formal_plan_evidence_${index + 1}`, ...binding, sha256Verified: true })),
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true },
  };
  const capsulePath = resolveProjectPath(root,
    `${PLAN_ROOT}/${current.registry.runId}/task-capsule.json`);
  writeOrVerifyJson(capsulePath, capsule);
  const capsuleBinding = bindAbsolute(root, capsulePath);
  const eventInput = {
    id: `stage4-v2-formal-plan-materialized-${current.registry.runId}`,
    timestamp: terminal.recordedAtUtc,
    action: "stage4_v2_formal_stage0_to_stage2_plan_materialized",
    runId: current.registry.runId,
    kind: "formal_training_planning",
    status: "success",
    title: "Stage4 V2正式训练闭环计划已形成",
    titleZh: "Stage4 V2正式训练闭环计划已形成",
    detailZh: "Stage 0→Stage 1→Stage 2顺序与证据闭环已登记；本轮未启动正式训练。",
    evidencePath: terminalBinding.path,
    evidenceSha256: terminalBinding.sha256,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  };
  const externalDependencies = dependencyCommitter({
    projectRoot: root,
    journalPath: resolveProjectPath(root,
      `${PLAN_ROOT}/${current.registry.runId}/registry-dependency-journal.json`),
    journalSchemaVersion:
      "ai-painter-stage4-v2-formal-stage0-to-stage2-registry-dependency-journal-v1",
    operationId: `stage4-v2-formal-plan-${current.registry.runId}`,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: current.registry.packageId,
    runId: current.registry.runId,
    recordedAtUtc: terminal.recordedAtUtc,
    bindings: [
      { role: "formal_stage0_to_stage2_plan", ...planBinding },
      { role: "formal_stage0_to_stage2_plan_terminal", ...terminalBinding },
      { role: "formal_stage0_to_stage2_plan_capsule", ...capsuleBinding },
      { role: "parent_controlled_smoke_terminal", ...current.registry.terminalEvidence },
      { role: "parent_controlled_smoke_finalization", ...sourceTerminal.smokeFinalization },
    ],
    eventInput,
    _testHooks,
  });
  const registryCommit = await registryAdvancer({
    projectRoot: root,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: current.registry.packageId,
    taskId: "stage4_v2_formal_stage0_to_stage2_plan_completed",
    taskKind: "formal_training_planning",
    taskGoal: "Preserve the materialized Stage4 V2 formal Stage 0 through Stage 2 closed-loop plan without starting training in the Smoke scope.",
    priority: 1,
    queueStatus: "completed",
    nextMachineAction: FORMAL_EXECUTOR_ACTION,
    queuedAtUtc: terminal.recordedAtUtc,
    runId: current.registry.runId,
    lifecycleStage: "controlled_smoke_completed",
    executionState: "completed",
    activity: "stage4_v2_formal_plan_materialized_not_executed",
    taskCapsulePath: capsuleBinding.path,
    terminalEvidencePath: terminalBinding.path,
    activeExecution: null,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
    dependencyManifest: externalDependencies.dependencyManifest,
  });
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-result-v1",
    status: plan.status,
    plan: planBinding,
    terminal: terminalBinding,
    registryRevision: registryCommit.registry.registryRevision,
    formalTrainingStarted: false,
    ownerAuthorizationRequired: false,
  });
}

export function verifyControlledSmokeSuccessHandoff(root, current) {
  const sourceTerminal = current.currentTaskTerminal;
  assert.equal(sourceTerminal.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-terminal-v1");
  assert.equal(sourceTerminal.executionState, "completed");
  assert.equal(sourceTerminal.status, "stage4_v2_controlled_smoke_passed");
  assert.equal(sourceTerminal.packageId, current.registry.packageId);
  assert.equal(sourceTerminal.runId, current.registry.runId);
  assert.equal(sourceTerminal.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(sourceTerminal.nextMachineAction, FORMAL_PLAN_ACTION);
  assert.equal(sourceTerminal.ownerAuthorizationRequired, false);
  assert.equal(sourceTerminal.automaticSuccessorAllowed, true);
  assert.equal(sourceTerminal.formalTrainingStarted, false);

  const manifest = readBoundJson(root, sourceTerminal.packageManifest);
  assert.equal(manifest.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-package-manifest-v1");
  assert.equal(manifest.packageId, sourceTerminal.packageId);
  assert.equal(manifest.runId, sourceTerminal.runId);
  assert.equal(manifest.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.deepEqual(manifest.packagePayload, sourceTerminal.packagePayload,
    "controlled-Smoke manifest payload differs from terminal binding");
  assert.deepEqual(manifest.programGraphManifest,
    sourceTerminal.programGraphManifest,
  "controlled-Smoke manifest program graph differs from terminal binding");
  const payload = readBoundJson(root, sourceTerminal.packagePayload);
  assert.equal(payload.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-package-payload-v1");
  assert.equal(payload.packageId, sourceTerminal.packageId);
  assert.equal(payload.runId, sourceTerminal.runId);
  assert.equal(payload.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.deepEqual(payload.programGraphManifest,
    sourceTerminal.programGraphManifest,
  "controlled-Smoke payload program graph differs from terminal binding");
  const graph = readBoundJson(root, sourceTerminal.programGraphManifest);
  assert.equal(graph.schemaVersion, "ai-painter-program-graph-manifest-v1");
  assert.equal(graph.graphId, "stage4-v2-controlled-smoke-program-graph-v1");

  const genericTerminal = readBoundJson(root,
    sourceTerminal.autonomousClosedLoopTerminal);
  const smokeFinalization = validateOuterFinalizationChain({
    root,
    payload,
    genericTerminal,
    smokeFinalizationBinding: sourceTerminal.smokeFinalization,
  });
  assert.equal(smokeFinalization.executionState, "completed");
  assert.equal(smokeFinalization.status, "stage4_v2_controlled_smoke_passed");
  assert.equal(smokeFinalization.capabilityVersion, STAGE4_V2_CAPABILITY);
  const trainingManifest = readBoundJson(root,
    smokeFinalization.trainingManifest);
  assert.equal(trainingManifest.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-training-manifest-v1");
  assert.equal(trainingManifest.status, "training_completed");
  assert.equal(trainingManifest.packageId, payload.packageId);
  assert.equal(trainingManifest.runId, payload.runId);
  assert.equal(trainingManifest.architectureId, STAGE4_V2_CAPABILITY);
  assert.equal(trainingManifest.epochCount, 30);
  assert.deepEqual(trainingManifest.resolution, { width: 256, height: 192 });
  assert.equal(trainingManifest.historicalDenoiserCheckpointRead, false);
  assert.equal(trainingManifest.parentDenoiserCheckpoint, null);
  assert.equal(trainingManifest.modelState?.changedByTraining, true);
  assert.equal(trainingManifest.autoencoderState?.frozen, true);
  assert.equal(trainingManifest.autoencoderState?.beforeSha256,
    trainingManifest.autoencoderState?.afterSha256);
  for (const [label, binding] of [
    ["checkpoint", trainingManifest.checkpoint],
    ["checkpointMetadata", trainingManifest.checkpointMetadata],
    ["metrics", trainingManifest.metrics],
    ["resourceTelemetry", trainingManifest.resourceTelemetry],
    ...((trainingManifest.previews ?? []).map((preview) => [
      `preview_epoch_${preview.epoch}`, preview,
    ])),
  ]) verifyBoundFile(root, binding, `controlled-Smoke ${label}`);

  const review = readBoundJson(root, smokeFinalization.machineReview);
  assert.equal(review.status, "stage4_v2_machine_review_passed");
  assert.equal(review.architectureId, STAGE4_V2_CAPABILITY);
  assert.equal(review.smokeRunId, payload.runId);
  assert.equal(review.reviewNodeCount, 5);
  assert.equal(review.passCount, 5);
  assert.equal(review.failCount, 0);
  const causal = readBoundJson(root, smokeFinalization.causalAdjudication);
  assert.equal(causal.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-causal-adjudication-v1");
  assert.equal(causal.packageId, payload.packageId);
  assert.equal(causal.runId, payload.runId);
  assert.equal(causal.decision, "controlled_smoke_qualified");
  assert.equal(causal.previewPassCount, 5);
  assert.equal(causal.previewFailCount, 0);
  return { sourceTerminal, smokeFinalization, payload, trainingManifest };
}

function verifyBoundFile(root, binding, label) {
  assert.ok(binding?.path && binding?.sha256, `${label} binding is missing`);
  const target = resolveProjectPath(root, binding.path, {
    mustExist: true,
    kind: "file",
  });
  assert.equal(sha256File(target), binding.sha256, `${label} SHA-256 differs`);
}

function writeOrVerifyJson(target, value) {
  if (!fs.existsSync(target)) {
    writeExclusiveJson(target, value);
    return;
  }
  assert.deepEqual(readJsonObject(target), value,
    `immutable formal-plan evidence conflicts: ${target}`);
}
