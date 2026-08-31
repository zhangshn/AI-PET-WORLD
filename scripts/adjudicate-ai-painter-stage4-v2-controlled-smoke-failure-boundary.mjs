import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import {
  bindAbsolute,
  readBoundJson,
  readJsonObject,
  resolveProjectPath,
  STAGE4_V2_CAPABILITY,
  writeExclusiveJson,
} from "./lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  commitStage4V2ExternalRegistryDependencies,
} from "./lib/ai-painter-stage4-v2-external-registry-dependency-v1.mjs";
import {
  persistStage4V2LifecyclePublication,
} from "./lib/ai-painter-stage4-v2-lifecycle-publication-v1.mjs";
import { FAILURE_ACTION } from "./run-ai-painter-stage4-v2-controlled-smoke.mjs";

const OUTPUT_ROOT = ".runtime/ai-painter/stage4-v2-controlled-smoke-failure-adjudications";
const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  adjudicateStage4V2ControlledSmokeFailureBoundary({ projectRoot: process.cwd() }).then(
    (result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
  ).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function adjudicateStage4V2ControlledSmokeFailureBoundary({
  projectRoot = process.cwd(), now = new Date(), _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  const current = await readCurrentExecutionRegistry(root);
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
  assert.equal(current.registry.capabilityVersion, STAGE4_V2_CAPABILITY);
  if (current.registry.taskId === "stage4_v2_controlled_smoke_failure_boundary_adjudicated") {
    assert.equal(current.currentTaskTerminal.schemaVersion,
      "ai-painter-stage4-v2-controlled-smoke-failure-boundary-terminal-v1");
    return Object.freeze({
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-failure-boundary-result-v1",
      status: current.currentTaskTerminal.status,
      terminal: current.registry.terminalEvidence,
      registryRevision: current.registry.registryRevision,
      recoveredCommittedResult: true,
      trainingStarted: false,
      ownerAuthorizationRequired: false,
    });
  }
  assert.equal(current.registry.nextMachineAction, FAILURE_ACTION);
  const terminal = current.currentTaskTerminal;
  assert.equal(terminal.schemaVersion, "ai-painter-stage4-v2-controlled-smoke-terminal-v1");
  assert.equal(terminal.executionState, "failed_closed");
  const smokeFinalization = terminal.smokeFinalization
    ? readBoundJson(root, terminal.smokeFinalization) : null;
  const causal = smokeFinalization?.causalAdjudication
    ? readBoundJson(root, smokeFinalization.causalAdjudication) : null;
  const genericTerminal = readBoundJson(root, terminal.autonomousClosedLoopTerminal);
  const genericFailureKind = terminal.failureKind
    ?? genericTerminal.finalResult?.failureKind
    ?? (causal?.decision === "controlled_smoke_real_visual_failure" ? "visual" : "evidence");
  assert.ok(["visual", "infrastructure", "program", "evidence", "business", "policy_boundary"]
    .includes(genericFailureKind), "controlled-Smoke failure kind is invalid");
  const decision = genericFailureKind === "visual"
    ? "controlled_smoke_visual_responsibility_boundary_confirmed"
    : genericFailureKind === "infrastructure"
      ? "controlled_smoke_infrastructure_boundary_confirmed"
      : genericFailureKind === "program"
        ? "controlled_smoke_program_boundary_confirmed"
        : genericFailureKind === "business"
          ? "controlled_smoke_business_boundary_confirmed"
          : genericFailureKind === "policy_boundary"
            ? "controlled_smoke_policy_boundary_confirmed"
            : "controlled_smoke_evidence_boundary_confirmed";
  const outputDirectory = resolveProjectPath(root, `${OUTPUT_ROOT}/${terminal.runId}`);
  const intentPath = path.join(outputDirectory, "adjudication-intent.json");
  let intent;
  if (fs.existsSync(intentPath)) intent = readJsonObject(intentPath);
  else {
    intent = {
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-failure-adjudication-intent-v1",
      status: "prepared",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId: terminal.packageId,
      runId: terminal.runId,
      sourceTerminal: current.registry.terminalEvidence,
      recordedAtUtc: now.toISOString(),
    };
    writeExclusiveJson(intentPath, intent);
  }
  assert.deepEqual(intent.sourceTerminal, current.registry.terminalEvidence,
    "failure adjudication intent belongs to another terminal");
  const result = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-failure-boundary-terminal-v1",
    executionState: "completed",
    status: decision,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: terminal.packageId,
    runId: terminal.runId,
    sourceTerminal: current.registry.terminalEvidence,
    sourceSmokeFinalization: terminal.smokeFinalization,
    sourceCausalAdjudication: smokeFinalization?.causalAdjudication ?? null,
    sourceClosedLoopFailureKind: genericFailureKind,
    sourceClosedLoopFailureCode: terminal.failureCode
      ?? genericTerminal.finalResult?.failureCode
      ?? genericTerminal.failureCode,
    responsibilityBoundary: causal?.responsibilityBoundary ?? "program_or_evidence_boundary",
    automaticRetryAllowed: false,
    thresholdMutationAllowed: false,
    historicalDenoiserReuseAllowed: false,
    ownerAuthorizationRequired: false,
    nextMachineAction: null,
    recordedAtUtc: intent.recordedAtUtc,
  };
  const target = path.join(outputDirectory, "terminal.json");
  writeOrVerifyJson(target, result);
  const resultBinding = bindAbsolute(root, target);
  const lifecycleResult = rejectFailedSmokeCapability(
    root, resultBinding, result.recordedAtUtc,
  );
  const lifecyclePublication = persistStage4V2LifecyclePublication({
    projectRoot: root,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    expectedState: "rejected",
    expectedEvidenceStatus: "failed",
    sourceTerminalBinding: resultBinding,
    lifecycleResult,
    receiptPath: path.join(outputDirectory, "lifecycle-publication.json"),
    requireLifecycleTerminal: true,
    _testHooks,
  });
  const capsule = {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${terminal.runId}-smoke-failure-adjudicated`,
    generatedFrom: "program_saved_evidence", readOnly: true,
    module: { id: "ai-painter-stage4-v2", nameZh: "AI Painter Stage4 V2" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: result.status },
    candidateTerminal: { runId: terminal.runId, status: result.status, recordedAtUtc: result.recordedAtUtc },
    latestBlocker: { code: result.responsibilityBoundary, summaryZh: "受控Smoke失败边界已由本地程序确定；本路线未自动重试。" },
    nextAllowedAction: null,
    forbiddenActions: ["automatic_smoke_retry", "reuse_failed_checkpoint", "lower_machine_review_threshold"],
    taskIdentity: { modelId: STAGE4_V2_CAPABILITY, runId: terminal.runId },
    latestTerminal: resultBinding,
    evidence: [current.registry.terminalEvidence, resultBinding].map((binding, index) => ({ kind: `smoke_failure_adjudication_evidence_${index + 1}`, ...binding, sha256Verified: true })),
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true },
  };
  const capsulePath = path.join(outputDirectory, "task-capsule.json");
  writeOrVerifyJson(capsulePath, capsule);
  const capsuleBinding = bindAbsolute(root, capsulePath);
  const externalDependencies = commitStage4V2ExternalRegistryDependencies({
    projectRoot: root,
    journalPath: path.join(outputDirectory,
      "registry-dependency-journal.json"),
    journalSchemaVersion:
      "ai-painter-stage4-v2-controlled-smoke-failure-registry-dependency-journal-v1",
    operationId: `stage4-v2-smoke-failure-adjudication-${terminal.runId}`,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: terminal.packageId,
    runId: terminal.runId,
    recordedAtUtc: result.recordedAtUtc,
    bindings: [
      { role: "controlled_smoke_failure_source_terminal", ...current.registry.terminalEvidence },
      { role: "controlled_smoke_failure_adjudication_terminal", ...resultBinding },
      { role: "controlled_smoke_failure_adjudication_capsule", ...capsuleBinding },
      {
        role: "controlled_smoke_rejected_lifecycle_publication_state",
        ...lifecyclePublication.receiptBinding,
      },
      {
        role: "controlled_smoke_rejected_lifecycle_evidence",
        ...lifecyclePublication.evidenceBinding,
      },
      {
        role: "controlled_smoke_rejected_lifecycle_terminal",
        ...lifecyclePublication.lifecycleTerminalBinding,
      },
    ],
    eventInput: {
      id: `stage4-v2-smoke-failure-adjudicated-${terminal.runId}`,
      timestamp: result.recordedAtUtc,
      action: "stage4_v2_controlled_smoke_failure_boundary_adjudicated",
      runId: terminal.runId,
      kind: "cpu_readonly_adjudication",
      status: "success",
      title: "Stage4 V2受控Smoke失败边界已裁决",
      titleZh: "Stage4 V2受控Smoke失败边界已裁决",
      detailZh: "本地程序已仅依据同包既有证据完成责任边界裁决；未重试训练、未降低阈值。",
      evidencePath: resultBinding.path,
      evidenceSha256: resultBinding.sha256,
      fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    },
    _testHooks,
  });
  const registryCommit = await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: terminal.packageId,
    taskId: "stage4_v2_controlled_smoke_failure_boundary_adjudicated",
    taskKind: "cpu_readonly_adjudication",
    taskGoal: "Preserve the deterministic Stage4 V2 controlled-Smoke failure boundary without automatic retry.",
    priority: 1,
    queueStatus: "completed",
    nextMachineAction: null,
    queuedAtUtc: result.recordedAtUtc,
    runId: terminal.runId,
    lifecycleStage: "rejected",
    executionState: "completed",
    activity: "stage4_v2_controlled_smoke_failure_boundary_adjudicated",
    taskCapsulePath: capsuleBinding.path,
    terminalEvidencePath: resultBinding.path,
    activeExecution: null,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
    dependencyManifest: externalDependencies.dependencyManifest,
  });
  return Object.freeze({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-failure-boundary-result-v1",
    status: result.status,
    terminal: resultBinding,
    lifecyclePublication: lifecyclePublication.receiptBinding,
    registryRevision: registryCommit.registry.registryRevision,
    trainingStarted: false,
    ownerAuthorizationRequired: false,
  });
}

function rejectFailedSmokeCapability(root, resultBinding, recordedAtUtc) {
  const statePath = resolveProjectPath(root,
    `.runtime/ai-painter/capability-lifecycle/${STAGE4_V2_CAPABILITY}/state.json`,
    { mustExist: true, kind: "file" });
  const state = readJsonObject(statePath);
  if (state.state === "readonly_gpu_qualified") {
    return advanceCapabilityLifecycle({
      root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      targetState: "rejected",
      evidence: {
        schemaVersion: "ai-painter-capability-stage-evidence-v1",
        capabilityVersion: STAGE4_V2_CAPABILITY,
        targetState: "rejected",
        status: "failed",
        bindings: [resultBinding],
      },
      recordedAtUtc,
    });
  }
  assert.equal(state.state, "rejected", `unexpected failed-Smoke lifecycle state: ${state.state}`);
  assert.ok(state.latestEvidence?.path, "rejected lifecycle evidence is missing");
  const evidencePath = path.join(path.dirname(statePath), state.latestEvidence.path);
  const evidence = readJsonObject(evidencePath);
  assert.ok(evidence.bindings.some((binding) => binding.path === resultBinding.path
    && binding.sha256 === resultBinding.sha256),
  "rejected lifecycle binds another controlled-Smoke failure terminal");
  return state;
}

function writeOrVerifyJson(target, value) {
  if (!fs.existsSync(target)) {
    writeExclusiveJson(target, value);
    return;
  }
  assert.deepEqual(readJsonObject(target), value,
    `immutable failure-adjudication evidence conflicts: ${target}`);
}
