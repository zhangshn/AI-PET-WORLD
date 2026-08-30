import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  buildFailureRegistryAdvanceForMock,
  buildRegistryAdvanceForMock,
  buildRunPathsForMock,
  decideCorruptGateRecoveryForMock,
  decideGateRunningRecoveryForMock,
  matchRecoveredProcessRecordsForMock,
  readRecoveryEvidenceForMock,
  updateUniquePlan,
  updateUniquePlanForQualificationFailure,
  validateGateResultEnvelope,
  validateQualificationEvidencePayload,
  validateRunId,
} from "../run-ai-painter-stage4-full-backbone-spatial-affine-readonly-gpu-qualification.mjs"

const RUN_ID = "full-backbone-spatial-affine-readonly-gpu-20260829-123456789-1234abcd"
const OLD_RUN_ID = "full-backbone-spatial-affine-readonly-gpu-20260829-012345678-deadbeef"
const SHA = "a".repeat(64)
const TRAIN_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
const VALIDATION_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"

test("run identity and recovery paths remain bound to the journal runId", () => {
  assert.equal(validateRunId(RUN_ID), RUN_ID)
  assert.throws(() => validateRunId("full-backbone-spatial-affine-readonly-gpu-free-choice"))
  const current = buildRunPathsForMock(RUN_ID)
  const recovered = buildRunPathsForMock(OLD_RUN_ID)
  assert.match(recovered.transactionRoot, new RegExp(`${OLD_RUN_ID}$`, "u"))
  assert.match(recovered.failureOutputRoot, new RegExp(`${OLD_RUN_ID}$`, "u"))
  assert.match(recovered.gateAttemptRoot, new RegExp(`${OLD_RUN_ID}$`, "u"))
  assert.notDeepEqual(recovered, current)
  assert.equal(Object.values(recovered).every((value) => !value.includes(RUN_ID)), true)
})

test("gate envelope accepts only the fixed completed or failed-closed identity", () => {
  const completed = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1",
    executionState: "completed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_completed",
    runId: RUN_ID,
    outputNamespace: `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${RUN_ID}`,
    attemptTerminal: binding("attempt.json"),
    gpuQualificationTerminal: binding("terminal.json"),
    gpuDiagnosticReport: binding("report.json"),
    ownerAuthorizationRequired: false,
  }
  assert.equal(validateGateResultEnvelope(completed, RUN_ID), completed)
  assert.throws(() => validateGateResultEnvelope({ ...completed, ownerAuthorizationRequired: true }, RUN_ID))
  assert.throws(() => validateGateResultEnvelope({ ...completed, runId: OLD_RUN_ID }, RUN_ID))
  assert.throws(() => validateGateResultEnvelope({ ...completed, outputNamespace: "cross-run" }, RUN_ID))

  const failed = {
    schemaVersion: completed.schemaVersion,
    executionState: "failed_closed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_failed",
    runId: RUN_ID,
    failedStep: "cuda_preflight",
    error: "mock failure",
    attemptTerminal: binding("attempt-failed.json"),
    failureReport: binding("failure.json"),
    ownerAuthorizationRequired: false,
  }
  assert.equal(validateGateResultEnvelope(failed, RUN_ID), failed)
  assert.throws(() => validateGateResultEnvelope({ ...failed, gpuQualificationTerminal: binding("forbidden.json") }, RUN_ID))
})

test("preflight orphan gate without execution claim remains in progress and is never relaunched", () => {
  const probes = []
  const decision = decideGateRunningRecoveryForMock({
    runId: RUN_ID,
    outputNamespace: `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${RUN_ID}`,
    executionClaim: null,
    executionClaimBinding: null,
    executionStarted: null,
    executionStartedBinding: null,
    claimConsumption: null,
    gateProgram: binding("gate.py"),
    runnerProgram: binding("runner.py"),
    processProbe: (candidate) => {
      probes.push(candidate)
      return candidate.role === "gate" && candidate.processId === null ? "active" : "dead"
    },
  })
  assert.equal(decision.status, "in_progress")
  assert.equal(decision.activeRole, "gate")
  assert.equal(decision.newRunAllowed, false)
  assert.equal(decision.shouldWriteInterruptedFailure, false)
  assert.equal(probes.length, 1)
})

test("dead consumed runner is closed without replay or a replacement run", () => {
  const gateProgram = binding("gate.py")
  const runnerProgram = binding("runner.py")
  const claimBinding = binding("execution-claim.json")
  const startedBinding = binding("execution-started.json")
  const claim = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-execution-claim-v1",
    status: "claimed_once",
    runId: RUN_ID,
    outputNamespace: `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${RUN_ID}`,
    launcher: gateProgram,
    launcherProcessId: 41001,
    gpuRunner: runnerProgram,
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
  }
  const started = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-execution-started-v1",
    status: "runner_claimed_not_replayable",
    runId: RUN_ID,
    outputNamespace: claim.outputNamespace,
    bindings: { executionClaim: claimBinding },
    gpuRunner: runnerProgram,
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
  }
  const consumption = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-execution-claim-consumption-v1",
    status: "consumed_once",
    runId: RUN_ID,
    outputNamespace: claim.outputNamespace,
    executionClaim: startedBinding,
    consumerProgram: runnerProgram,
    processId: 41002,
  }
  const probed = []
  const decision = decideGateRunningRecoveryForMock({
    runId: RUN_ID,
    outputNamespace: claim.outputNamespace,
    executionClaim: claim,
    executionClaimBinding: claimBinding,
    executionStarted: started,
    executionStartedBinding: startedBinding,
    claimConsumption: consumption,
    gateProgram,
    runnerProgram,
    processProbe: (candidate) => {
      probed.push(candidate.processId)
      return "dead"
    },
  })
  assert.deepEqual(probed, [41001, 41002])
  assert.equal(decision.status, "interrupted_failed_closed")
  assert.equal(decision.automaticRetryAllowed, false)
  assert.equal(decision.newRunAllowed, false)
  assert.equal(decision.shouldWriteInterruptedFailure, true)

  const replayed = structuredClone(consumption)
  replayed.status = "available"
  assert.throws(() => decideGateRunningRecoveryForMock({
    runId: RUN_ID,
    outputNamespace: claim.outputNamespace,
    executionClaim: claim,
    executionClaimBinding: claimBinding,
    executionStarted: started,
    executionStartedBinding: startedBinding,
    claimConsumption: replayed,
    gateProgram,
    runnerProgram,
    processProbe: () => "dead",
  }))
})

test("consumed runner uses its runner command contract and remains in progress while active", () => {
  const fixture = gateRecoveryFixture()
  const probed = []
  const decision = decideGateRunningRecoveryForMock({
    ...fixture,
    processProbe: (candidate) => {
      probed.push(candidate)
      return candidate.role === "runner" ? "active" : "dead"
    },
  })
  assert.deepEqual(probed.map(({ role }) => role), ["gate", "runner"])
  assert.equal(decision.status, "in_progress")
  assert.equal(decision.activeRole, "runner")
  assert.equal(decision.processId, 42002)
  assert.equal(decision.processProbeState, "active")
  assert.equal(decision.newRunAllowed, false)
})

test("started runner before claim consumption is discovered by full command-line scan", () => {
  const fixture = gateRecoveryFixture()
  fixture.claimConsumption = null
  const probed = []
  const decision = decideGateRunningRecoveryForMock({
    ...fixture,
    processProbe: (candidate) => {
      probed.push(candidate)
      return candidate.role === "runner" && candidate.processId === null ? "active" : "dead"
    },
  })
  assert.deepEqual(probed.map(({ role, processId }) => [role, processId]), [
    ["gate", 42001],
    ["runner", null],
  ])
  assert.equal(decision.status, "in_progress")
  assert.equal(decision.activeRole, "runner")
  assert.equal(decision.processId, null)
  assert.equal(decision.shouldWriteInterruptedFailure, false)
})

test("an indeterminate OS process probe keeps the existing gate transaction running", () => {
  const decision = decideGateRunningRecoveryForMock({
    runId: RUN_ID,
    outputNamespace: `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${RUN_ID}`,
    executionClaim: null,
    executionClaimBinding: null,
    executionStarted: null,
    executionStartedBinding: null,
    claimConsumption: null,
    gateProgram: binding("gate.py"),
    runnerProgram: binding("runner.py"),
    processProbe: () => "indeterminate",
  })
  assert.equal(decision.status, "in_progress")
  assert.equal(decision.processProbeState, "indeterminate")
  assert.equal(decision.newRunAllowed, false)
  assert.equal(decision.shouldWriteInterruptedFailure, false)
})

test("structured process records are matched per process and never concatenated", () => {
  const options = {
    processId: null,
    programPath: "F:/ai-pet-world/ml/ai-painter/scripts/gate.py",
    runId: RUN_ID,
    role: "gate",
  }
  const splitAcrossProcesses = [
    { ProcessId: 1, CommandLine: "python F:/ai-pet-world/ml/ai-painter/scripts/gate.py" },
    { ProcessId: 2, CommandLine: `python unrelated.py --run-id ${RUN_ID}` },
  ]
  assert.equal(matchRecoveredProcessRecordsForMock(splitAcrossProcesses, options), "dead")
  assert.equal(matchRecoveredProcessRecordsForMock([
    ...splitAcrossProcesses,
    { ProcessId: 3, CommandLine: `python ${options.programPath} --run-id ${RUN_ID}` },
  ], options), "active")
  assert.equal(matchRecoveredProcessRecordsForMock([
    { ProcessId: 3, CommandLine: null },
  ], { ...options, processId: 3 }), "indeterminate")

  const runnerOptions = {
    processId: 4,
    programPath: "F:/ai-pet-world/ml/ai-painter/scripts/runner.py",
    runId: RUN_ID,
    role: "runner",
  }
  assert.equal(matchRecoveredProcessRecordsForMock([{
    ProcessId: 4,
    CommandLine: `python ${runnerOptions.programPath} --config active.json --execution-claim claim.json --output-dir .runtime/${RUN_ID}`,
  }], runnerOptions), "active")
})

test("truncated recovery JSON preserves raw SHA and uses conservative process decisions", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-recovery-mock-"))
  try {
    const truncated = path.join(directory, "execution-started.json")
    const bytes = Buffer.from('{"schemaVersion":"truncated"', "utf8")
    fs.writeFileSync(truncated, bytes)
    const evidence = readRecoveryEvidenceForMock(truncated)
    assert.equal(evidence.sha256, crypto.createHash("sha256").update(bytes).digest("hex"))
    assert.notEqual(evidence.parseError, null)
    assert.equal(evidence.value, null)

    const common = {
      runId: RUN_ID,
      gateProgram: binding("gate.py"),
      runnerProgram: binding("runner.py"),
      evidenceError: "corrupt_interrupted_evidence",
    }
    const active = decideCorruptGateRecoveryForMock({
      ...common,
      processProbe: ({ role }) => role === "runner" ? "active" : "dead",
    })
    assert.equal(active.status, "in_progress")
    assert.equal(active.shouldWriteInterruptedFailure, false)
    const uncertain = decideCorruptGateRecoveryForMock({
      ...common,
      processProbe: () => "indeterminate",
    })
    assert.equal(uncertain.status, "in_progress")
    assert.equal(uncertain.processProbeState, "indeterminate")
    const dead = decideCorruptGateRecoveryForMock({
      ...common,
      processProbe: () => "dead",
    })
    assert.equal(dead.status, "interrupted_failed_closed")
    assert.equal(dead.failureCode, "corrupt_interrupted_evidence")
    assert.equal(dead.newRunAllowed, false)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test("qualification evidence requires the two fixed samples, all gradients, and no mutable action", () => {
  const { report, bound } = qualificationFixture()
  const accepted = validateQualificationEvidencePayload(report, {
    runId: RUN_ID,
    readBound: (value) => ({ value: bound.get(value.path) }),
  })
  assert.equal(accepted.qualificationSamples.identitySha256, "f72f118c94d16030051dd1a35942ee5981c279dafd47093c046996dbf4a20e23")

  const wrongValidation = structuredClone(report)
  wrongValidation.fixedValidationSampleId = "free-choice"
  assert.throws(() => validateQualificationEvidencePayload(wrongValidation, {
    runId: RUN_ID,
    readBound: (value) => ({ value: bound.get(value.path) }),
  }))

  const ownerEscalation = structuredClone(report)
  ownerEscalation.executionGrant.allowedActions.push("select_bound_sample")
  assert.throws(() => validateQualificationEvidencePayload(ownerEscalation, {
    runId: RUN_ID,
    readBound: (value) => ({ value: bound.get(value.path) }),
  }))

  const zeroGradientBound = new Map(bound)
  const zeroGradient = structuredClone(zeroGradientBound.get("gradient.json"))
  zeroGradient.samples[0].affineParameterGradients[0].nonzero = false
  zeroGradientBound.set("gradient.json", zeroGradient)
  assert.throws(() => validateQualificationEvidencePayload(report, {
    runId: RUN_ID,
    readBound: (value) => ({ value: zeroGradientBound.get(value.path) }),
  }))
})

test("success and failure registry projections have mutually exclusive next actions", () => {
  const success = buildRegistryAdvanceForMock({
    runId: RUN_ID,
    capsulePath: "success/capsule.json",
    terminalPath: "success/terminal.json",
  })
  assert.equal(success.taskId, "compile_stage4_full_backbone_spatial_affine_controlled_smoke_contract")
  assert.equal(success.executionState, "completed")
  const failed = buildFailureRegistryAdvanceForMock({
    runId: OLD_RUN_ID,
    capsulePath: "failed/capsule.json",
    terminalPath: "failed/terminal.json",
  })
  assert.equal(failed.taskId, "classify_stage4_full_backbone_spatial_affine_readonly_gpu_failure")
  assert.equal(failed.executionState, "failed_closed")
  assert.equal(failed.taskKind, "readonly_gpu_failure_classification")
  assert.equal(failed.expectedPreviousRegistryRevision, 42)
})

test("plan projections preserve 60 percent and never admit Smoke after failure", () => {
  const source = [
    "# plan",
    "",
    "更新时间：2026-08-29 08:20:50 +08:00",
    "",
    "状态：old",
    "",
    "| 2 | AI Painter R5 / Stage4 | old | old | old |",
    "",
    "## 5. 当前阻断与后续实施顺序",
    "",
    "old blocker",
    "",
    "## 6. 完成条件与固定边界",
    "",
    "- 当前固定进度只能报告3/5（60%）",
  ].join("\n")
  const success = updateUniquePlan(source, "2026-08-29T02:00:00.000Z")
  assert.match(success, /3\/5（60%）/u)
  assert.match(success, /受控Smoke合同待编译/u)
  const failed = updateUniquePlanForQualificationFailure(
    source,
    "2026-08-29T02:00:00.000Z",
    "cuda_preflight",
  )
  assert.match(failed, /3\/5（60%）/u)
  assert.match(failed, /失败分类待执行/u)
  assert.match(failed, /不得自动重试GPU资格/u)
  assert.doesNotMatch(failed, /资格已通过/u)
})

function qualificationFixture() {
  const qualificationSamples = {
    identitySha256: "f72f118c94d16030051dd1a35942ee5981c279dafd47093c046996dbf4a20e23",
    preboundReadOnlySamples: true,
    freeSelectionAllowed: false,
    selectBoundSampleActionRequired: false,
    firstTrain: { sampleId: TRAIN_ID },
    fixedValidation: { sampleId: VALIDATION_ID },
  }
  const denied = [
    "create_optimizer",
    "execute_backward",
    "mutate_model_weights",
    "write_diagnostic_checkpoint",
    "write_smoke_checkpoint",
    "run_stage0",
    "run_stage1",
    "run_stage2",
    "run_formal_inference",
    "create_runtime_frame",
    "enter_world",
  ]
  const report = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-report-v1",
    status: "passed",
    runId: RUN_ID,
    architectureId: "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
    capabilityVersion: "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
    seed: 20263722,
    resolution: { width: 256, height: 192 },
    conditionChannels: 23,
    latentChannels: 12,
    firstFormalTrainSampleId: TRAIN_ID,
    fixedValidationSampleId: VALIDATION_ID,
    splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
    executionGrant: {
      datasetConstraints: {
        qualificationSamples,
        freeSampleSelectionAllowed: false,
        selectBoundSampleActionRequired: false,
      },
      allowedActions: ["readonly_cuda_forward", "torch_autograd_grad"],
      explicitlyDeniedActions: denied,
    },
    gradientEvidence: binding("gradient.json"),
    modelStateHashes: binding("state.json"),
    cudaTelemetry: binding("telemetry.json"),
    safety: {
      ownerAuthorizationRequired: false,
      optimizerCreated: false,
      backwardExecuted: false,
      weightsModified: false,
      checkpointWritten: false,
      trainingStarted: false,
      runtimeFrameCreated: false,
      enteredWorld: false,
    },
  }
  const sample = (role, sampleId) => ({
    role,
    sampleId,
    conditionGradient: {
      all23ChannelsFiniteNonzero: true,
      perChannelMaximumAbsoluteGradient: Array.from({ length: 23 }, () => 0.01),
    },
    affineParameterTensorCount: 24,
    affineParameterCount: 745472,
    affineParameterObjectIdentityCount: 24,
    affineParameterGradients: Array.from({ length: 24 }, (_, index) => ({
      name: `spatial_affine_${index}`,
      finite: true,
      nonzero: true,
      gammaFiniteNonzero: true,
      betaFiniteNonzero: true,
    })),
    allParameterGradFieldsRemainNone: true,
  })
  const bound = new Map([
    ["gradient.json", {
      status: "passed",
      samples: [
        sample("first_formal_train_record", TRAIN_ID),
        sample("fixed_validation_sample_194", VALIDATION_ID),
      ],
    }],
    ["state.json", {
      denoiserUnchanged: true,
      autoencoderUnchanged: true,
      allParameterGradFieldsRemainNone: true,
    }],
    ["telemetry.json", { status: "completed", peakGpuMemoryBytes: 1024 }],
  ])
  return { report, bound }
}

function gateRecoveryFixture() {
  const gateProgram = binding("gate.py")
  const runnerProgram = binding("runner.py")
  const executionClaimBinding = binding("execution-claim.json")
  const executionStartedBinding = binding("execution-started.json")
  const outputNamespace = `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${RUN_ID}`
  return {
    runId: RUN_ID,
    outputNamespace,
    executionClaimBinding,
    executionStartedBinding,
    gateProgram,
    runnerProgram,
    executionClaim: {
      schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-execution-claim-v1",
      status: "claimed_once",
      runId: RUN_ID,
      outputNamespace,
      launcher: gateProgram,
      launcherProcessId: 42001,
      gpuRunner: runnerProgram,
      ownerAuthorizationRequired: false,
      automaticRetryAllowed: false,
    },
    executionStarted: {
      schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-execution-started-v1",
      status: "runner_claimed_not_replayable",
      runId: RUN_ID,
      outputNamespace,
      bindings: { executionClaim: executionClaimBinding },
      gpuRunner: runnerProgram,
      ownerAuthorizationRequired: false,
      automaticRetryAllowed: false,
    },
    claimConsumption: {
      schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-execution-claim-consumption-v1",
      status: "consumed_once",
      runId: RUN_ID,
      outputNamespace,
      executionClaim: executionStartedBinding,
      consumerProgram: runnerProgram,
      processId: 42002,
    },
  }
}

function binding(path) {
  return { path, sha256: SHA }
}
