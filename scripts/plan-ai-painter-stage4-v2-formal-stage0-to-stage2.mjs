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
  STAGE4_V2_CAPABILITY,
  writeExclusiveJson,
} from "./lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import { FORMAL_PLAN_ACTION } from "./run-ai-painter-stage4-v2-controlled-smoke.mjs";
import {
  commitStage4V2ExternalRegistryDependencies,
} from "./lib/ai-painter-stage4-v2-external-registry-dependency-v1.mjs";

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
  const sourceTerminal = current.currentTaskTerminal;
  assert.equal(sourceTerminal.schemaVersion, "ai-painter-stage4-v2-controlled-smoke-terminal-v1");
  assert.equal(sourceTerminal.status, "stage4_v2_controlled_smoke_passed");
  const smokeFinalization = readBoundJson(root, sourceTerminal.smokeFinalization);
  assert.equal(smokeFinalization.status, "stage4_v2_controlled_smoke_passed");
  const plan = {
    schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-v1",
    status: "materialized_not_executed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
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
    nextMachineAction: null,
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
    nextAllowedAction: null,
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
    nextMachineAction: null,
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

function writeOrVerifyJson(target, value) {
  if (!fs.existsSync(target)) {
    writeExclusiveJson(target, value);
    return;
  }
  assert.deepEqual(readJsonObject(target), value,
    `immutable formal-plan evidence conflicts: ${target}`);
}
