import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  buildGateInvocationForMock,
  buildRegistryAdvanceForMock,
  buildRunPathsForMock,
  decideGateRecoveryForMock,
  parseArgumentsForMock,
  updateUniquePlanForFailure,
  updateUniquePlanForSuccess,
  validateGateEnvelopeForMock,
  validateRevision44SourceForMock,
  validateRunId,
} from "../run-ai-painter-stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-qualification.mjs"

const SHA = "a".repeat(64)
const REGISTRY_SHA = "b".repeat(64)
const PLAN_SHA = "c".repeat(64)
const OLD_FAILED_RUN = "full-backbone-spatial-affine-readonly-gpu-20260829-022348295-bd7c317d"
const CORRECTION_RUN = "stage4-wddm-resource-classification-20260829024500123-1234abcd"
const NEW_RUN = "full-backbone-spatial-affine-readonly-gpu-20260829-024600123-8765dcba"
const SOURCE_PATH = `.runtime/ai-painter/stage4-windows-wddm-resource-preflight-failure-classifications/${CORRECTION_RUN}/phase-terminal.json`
const CURRENT_TASK = "qualify_stage4_full_backbone_spatial_affine_readonly_gpu_after_wddm_correction"

test("CLI requires one exact future correction-terminal path and SHA binding", () => {
  const accepted = parseArgumentsForMock([
    "--expected-registry-sha256",
    REGISTRY_SHA,
    "--correction-terminal-path",
    SOURCE_PATH,
    "--correction-terminal-sha256",
    SHA,
    "--expected-plan-sha256",
    PLAN_SHA,
  ])
  assert.deepEqual(accepted, {
    path: SOURCE_PATH,
    sha256: SHA,
    registrySha256: REGISTRY_SHA,
    planSha256: PLAN_SHA,
  })
  assert.throws(() => parseArgumentsForMock([]))
  assert.throws(() => parseArgumentsForMock([
    "--correction-terminal-path",
    SOURCE_PATH,
  ]))
  assert.throws(() => parseArgumentsForMock([
    "--expected-registry-sha256",
    REGISTRY_SHA,
    "--correction-terminal-path",
    `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-formal-failures/${OLD_FAILED_RUN}/phase-terminal.json`,
    "--correction-terminal-sha256",
    SHA,
    "--expected-plan-sha256",
    PLAN_SHA,
  ]))
  assert.throws(() => parseArgumentsForMock([
    "--expected-registry-sha256",
    REGISTRY_SHA,
    "--correction-terminal-path",
    SOURCE_PATH,
    "--correction-terminal-sha256",
    "not-a-sha",
    "--expected-plan-sha256",
    PLAN_SHA,
  ]))
  assert.throws(() => parseArgumentsForMock([
    "--expected-registry-sha256",
    REGISTRY_SHA,
    "--correction-terminal-path",
    SOURCE_PATH,
    "--correction-terminal-sha256",
    SHA,
    "--expected-plan-sha256",
    PLAN_SHA,
    "--unknown",
    "value",
  ]))
})

test("only registry revision 44 with the post-correction qualification task is accepted", () => {
  const fixture = revision44Fixture()
  assert.equal(validateRevision44SourceForMock(fixture), true)

  for (const revision of [42, 43, 45]) {
    const changed = structuredClone(fixture)
    changed.registry.registryRevision = revision
    changed.registry.eventSequence = revision
    assert.throws(() => validateRevision44SourceForMock(changed))
  }

  const wrongTask = structuredClone(fixture)
  wrongTask.registry.taskId = "classify_stage4_full_backbone_spatial_affine_readonly_gpu_failure"
  assert.throws(() => validateRevision44SourceForMock(wrongTask))

  const wrongKind = structuredClone(fixture)
  wrongKind.registry.taskKind = "readonly_gpu_failure_classification"
  assert.throws(() => validateRevision44SourceForMock(wrongKind))

  const wrongSourceHash = structuredClone(fixture)
  wrongSourceHash.sourceBinding.sha256 = "c".repeat(64)
  assert.throws(() => validateRevision44SourceForMock(wrongSourceHash))
})

test("the retired failed run can be bound only as history and never as the execution source", () => {
  const oldRegistryRun = revision44Fixture()
  oldRegistryRun.registry.runId = OLD_FAILED_RUN
  oldRegistryRun.terminal.runId = OLD_FAILED_RUN
  assert.throws(() => validateRevision44SourceForMock(oldRegistryRun))

  const oldPackage = revision44Fixture()
  oldPackage.registry.packageId = OLD_FAILED_RUN
  assert.throws(() => validateRevision44SourceForMock(oldPackage))

  const oldTerminalPath = revision44Fixture()
  oldTerminalPath.sourceBinding.path = `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-formal-failures/${OLD_FAILED_RUN}/phase-terminal.json`
  oldTerminalPath.registry.terminalEvidence.path = oldTerminalPath.sourceBinding.path
  assert.throws(() => validateRevision44SourceForMock(oldTerminalPath))

  const accepted = revision44Fixture()
  assert.equal(accepted.terminal.sourceRunId, OLD_FAILED_RUN)
  assert.equal(validateRevision44SourceForMock(accepted), true)
})

test("correction terminal must prove classification, correction, no replay, and no GPU work", () => {
  const mutations = [
    (item) => { item.terminal.schemaVersion = "old-terminal" },
    (item) => { item.terminal.status = "classification_only" },
    (item) => { item.terminal.classification = "gpu_failure" },
    (item) => { item.terminal.nextLegalAction = "compile_smoke" },
    (item) => { item.terminal.automaticQualificationReplayAllowed = true },
    (item) => { item.terminal.controlledSmokeAdmissionAllowed = true },
    (item) => { item.terminal.ownerAuthorizationRequired = true },
    (item) => { item.terminal.gpuStarted = true },
    (item) => { item.terminal.outerTransaction.requiredState = "registry_prepared" },
    (item) => { delete item.terminal.outerTransaction.commitMarker },
    (item) => { delete item.terminal.correctionAction },
    (item) => { item.registry.lifecycleStage = "readonly_gpu_qualification_failed_closed" },
  ]
  for (const mutate of mutations) {
    const changed = revision44Fixture()
    mutate(changed)
    assert.throws(() => validateRevision44SourceForMock(changed))
  }
})

test("fresh Gate invocation uses only the new runId and the frozen corrected Gate", () => {
  assert.equal(validateRunId(NEW_RUN), NEW_RUN)
  assert.throws(() => validateRunId(OLD_FAILED_RUN.replace("022348295", "freechoice")))
  const invocation = buildGateInvocationForMock(NEW_RUN)
  assert.equal(path.basename(invocation.command).toLowerCase(), "python.exe")
  assert.equal(path.basename(invocation.args[1]), "execute_stage4_full_backbone_spatial_affine_readonly_gpu_gate.py")
  assert.deepEqual(invocation.args.slice(2), ["--run-id", NEW_RUN])
  assert.equal(invocation.gateSha256, "60ee0cf985528f87e1c1103f94eb31c12f97cb7156d90e5f21e6f3203da29701")
  assert.equal(invocation.automaticRetryAllowed, false)
  assert.equal(invocation.args.includes(SOURCE_PATH), false)
  assert.equal(invocation.args.includes(OLD_FAILED_RUN), false)
  assert.throws(() => buildGateInvocationForMock(OLD_FAILED_RUN))
})

test("fresh run namespaces are isolated from the correction run and retired failed run", () => {
  const paths = buildRunPathsForMock(NEW_RUN)
  assert.equal(Object.values(paths).every((value) => value.includes(NEW_RUN)), true)
  assert.equal(Object.values(paths).every((value) => !value.includes(CORRECTION_RUN)), true)
  assert.equal(Object.values(paths).every((value) => !value.includes(OLD_FAILED_RUN)), true)
  assert.match(paths.gateAttemptRoot, /stage4-full-backbone-spatial-affine-readonly-gpu-attempts/u)
  assert.match(paths.gateOutputRoot, /stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/u)
  assert.match(paths.transactionRoot, /post-wddm-readonly-gpu-transactions/u)
})

test("Gate envelopes accept only same-run immutable success or failed-closed outputs", () => {
  const success = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1",
    executionState: "completed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_completed",
    runId: NEW_RUN,
    outputNamespace: `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${NEW_RUN}`,
    attemptTerminal: binding(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts/${NEW_RUN}/phase-terminal.json`),
    gpuQualificationTerminal: binding(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${NEW_RUN}/phase-terminal.json`),
    gpuDiagnosticReport: binding(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${NEW_RUN}/gpu-diagnostic-report.json`),
    ownerAuthorizationRequired: false,
  }
  assert.equal(validateGateEnvelopeForMock(success, NEW_RUN), success)
  assert.throws(() => validateGateEnvelopeForMock({ ...success, runId: OLD_FAILED_RUN }, NEW_RUN))
  assert.throws(() => validateGateEnvelopeForMock({ ...success, outputNamespace: "historical" }, NEW_RUN))
  assert.throws(() => validateGateEnvelopeForMock({ ...success, ownerAuthorizationRequired: true }, NEW_RUN))

  const failure = {
    schemaVersion: success.schemaVersion,
    executionState: "failed_closed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_failed",
    runId: NEW_RUN,
    failedStep: "cuda_readonly_qualification",
    error: "mock failure",
    attemptTerminal: binding(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts/${NEW_RUN}/phase-terminal.json`),
    failureReport: binding(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts/${NEW_RUN}/failure-report.json`),
    ownerAuthorizationRequired: false,
  }
  assert.equal(validateGateEnvelopeForMock(failure, NEW_RUN), failure)
  assert.throws(() => validateGateEnvelopeForMock({ ...failure, gpuQualificationTerminal: binding("forbidden.json") }, NEW_RUN))
  const crossRunFailure = structuredClone(failure)
  crossRunFailure.failureReport = binding(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts/${OLD_FAILED_RUN}/failure-report.json`)
  assert.throws(() => validateGateEnvelopeForMock(crossRunFailure, NEW_RUN))
})

test("interrupted Gate recovery never relaunches or creates a replacement run", () => {
  const active = decideGateRecoveryForMock({ terminalExists: false, processState: "active" })
  assert.equal(active.status, "in_progress")
  assert.equal(active.automaticRetryAllowed, false)
  assert.equal(active.newRunAllowed, false)

  const uncertain = decideGateRecoveryForMock({ terminalExists: false, processState: "indeterminate" })
  assert.equal(uncertain.status, "in_progress")
  assert.equal(uncertain.newRunAllowed, false)

  const dead = decideGateRecoveryForMock({ terminalExists: false, processState: "dead" })
  assert.equal(dead.status, "interrupted_failed_closed")
  assert.equal(dead.automaticRetryAllowed, false)
  assert.equal(dead.newRunAllowed, false)

  const terminal = decideGateRecoveryForMock({ terminalExists: true, processState: "dead" })
  assert.equal(terminal.status, "recover_terminal")
  assert.equal(terminal.newRunAllowed, false)
})

test("success advances to Smoke contract compilation while failure advances only to read-only classification", () => {
  const success = buildRegistryAdvanceForMock({
    passed: true,
    runId: NEW_RUN,
    capsulePath: "future/success/capsule.json",
    terminalPath: "future/success/terminal.json",
    previousRegistrySha256: REGISTRY_SHA,
  })
  assert.equal(success.taskId, "compile_stage4_full_backbone_spatial_affine_controlled_smoke_contract")
  assert.equal(success.taskKind, "controlled_smoke_contract_compilation")
  assert.equal(success.executionState, "completed")
  assert.equal(success.expectedPreviousRegistryRevision, 44)

  const failure = buildRegistryAdvanceForMock({
    passed: false,
    runId: NEW_RUN,
    capsulePath: "future/failure/capsule.json",
    terminalPath: "future/failure/terminal.json",
    previousRegistrySha256: REGISTRY_SHA,
  })
  assert.equal(failure.taskId, "classify_stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_failure")
  assert.equal(failure.taskKind, "readonly_gpu_failure_classification")
  assert.equal(failure.executionState, "failed_closed")
  assert.equal(failure.expectedPreviousRegistryRevision, 44)
  assert.notEqual(failure.taskId, success.taskId)
})

test("plan projections preserve 3/5 and never start Smoke, Stage0, or replay", () => {
  const source = planFixture()
  const success = updateUniquePlanForSuccess(source, "2026-08-29T03:00:00.000Z")
  assert.match(success, /3\/5（60%）/u)
  assert.match(success, /受控Smoke合同待编译/u)
  assert.match(success, /旧失败Run未复用/u)
  assert.match(success, /不得直接启动Smoke或Stage 0/u)

  const failure = updateUniquePlanForFailure(source, "2026-08-29T03:00:00.000Z", "cuda_readonly_qualification")
  assert.match(failure, /3\/5（60%）/u)
  assert.match(failure, /本次失败分类待执行/u)
  assert.match(failure, /不得自动重试/u)
  assert.match(failure, /不得复用任一失败Run/u)
  assert.doesNotMatch(failure, /资格通过/u)
})

test("module import is inert and the direct-execution guard owns main", () => {
  const file = path.resolve("scripts/run-ai-painter-stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-qualification.mjs")
  const source = fs.readFileSync(file, "utf8")
  assert.match(source, /if \(isMain\) \{/u)
  assert.match(source, /EXPECTED_PREVIOUS_REGISTRY_REVISION = 44/u)
  assert.match(source, /automaticRetryAllowed: false/u)
  assert.match(source, /RETIRED_FAILED_RUN_ID/u)
  assert.match(source, /ensureAiPainterProgramEventCommitted/u)
  assert.match(source, /verifyAiPainterProgramEventCommitted/u)
  assert.match(source, /prepareCurrentExecutionRegistryAdvance/u)
  assert.match(source, /finalizePreparedCurrentExecutionRegistryAdvance/u)
  assert.match(source, /recoverPreparedCurrentExecutionRegistryAdvance/u)
  assert.match(source, /transaction-commit-marker\.json/u)
  assert.doesNotMatch(source, /data\/ai-painter\/program-events\.jsonl/u)
  assert.doesNotMatch(source, /function findProgramEvent/u)
  assert.doesNotMatch(source, /--correction-terminal-path",\s*RETIRED_FAILED_RUN_ID/u)
  const states = [
    '"plan_committed"',
    '"event_committed"',
    '"dependencies_committed"',
    '"registry_prepared"',
    '"registry_committed"',
  ].map((state) => source.indexOf(`journal.state === ${state}`))
  assert.equal(states.every((index) => index >= 0), true)
  assert.deepEqual([...states].sort((left, right) => left - right), states)
  assert.match(source, /assert\.equal\(journal\.state, "complete"\)/u)
})

function revision44Fixture() {
  const sourceBinding = {
    path: SOURCE_PATH,
    sha256: SHA,
    registrySha256: REGISTRY_SHA,
    planSha256: PLAN_SHA,
  }
  const registry = {
    registryRevision: 44,
    eventSequence: 44,
    capabilityVersion: "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
    packageId: CORRECTION_RUN,
    taskId: CURRENT_TASK,
    taskKind: "readonly_gpu_qualification",
    runId: CORRECTION_RUN,
    lifecycleStage: "readonly_gpu_qualification_ready_after_wddm_correction",
    executionState: "completed",
    activity: "windows_wddm_resource_preflight_defect_confirmed_and_corrected",
    terminalEvidence: {
      ...sourceBinding,
      status: "stage4_windows_wddm_resource_preflight_failure_classified_and_corrected",
    },
    activeExecution: null,
    supersedes: {
      registryRevision: 43,
      taskId: "classify_stage4_full_backbone_spatial_affine_readonly_gpu_failure",
      runId: OLD_FAILED_RUN,
    },
  }
  const terminal = {
    schemaVersion: "stage4-windows-wddm-resource-preflight-failure-classification-terminal-v1",
    executionState: "completed",
    status: "stage4_windows_wddm_resource_preflight_failure_classified_and_corrected",
    runId: CORRECTION_RUN,
    sourceRunId: OLD_FAILED_RUN,
    classification: "wddm_resource_preflight_process_classification_defect_confirmed_and_corrected",
    failureClassification: binding("classification.json"),
    correctionAction: binding("correction.json"),
    cpuValidation: binding("cpu-validation.json"),
    nextLegalAction: CURRENT_TASK,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticQualificationReplayAllowed: false,
    controlledSmokeAdmissionAllowed: false,
    gpuStarted: false,
    trainingStarted: false,
    outerTransaction: {
      path: `.runtime/ai-painter/stage4-windows-wddm-resource-preflight-failure-classification-transactions/${CORRECTION_RUN}/transaction.json`,
      requiredState: "complete",
      commitMarker: {
        path: `.runtime/ai-painter/stage4-windows-wddm-resource-preflight-failure-classifications/${CORRECTION_RUN}/transaction-commit-marker.json`,
        schemaVersion: "stage4-windows-wddm-resource-preflight-classification-commit-marker-v1",
      },
    },
  }
  return { registry, registrySha256: REGISTRY_SHA, terminal, sourceBinding }
}

function planFixture() {
  return [
    "# plan",
    "",
    "更新时间：2026-08-29 10:24:05 +08:00",
    "",
    "状态：active-module-plan / old",
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
}

function binding(path) {
  return { path, sha256: SHA }
}
