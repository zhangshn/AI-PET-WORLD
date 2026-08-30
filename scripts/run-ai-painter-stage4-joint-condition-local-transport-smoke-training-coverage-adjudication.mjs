import assert from "node:assert/strict"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import {
  CAPABILITY_VERSION,
  DECISION,
  NEXT_LEGAL_ACTION,
  SOURCE_RUN_ID,
  adjudicateJointTransportSmokeTrainingCoverage,
  deriveJointTransportTwentyFourEpochFullDataScreenContract,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-smoke-training-coverage-adjudication-v1.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const PACKAGE_IDENTITY =
  "joint-condition-local-transport-smoke-package-20260830004449978-5d97fbb9"
const RUN_ID =
  `stage4-joint-condition-local-transport-smoke-coverage-adjudication-${compactUtc()}`
const OUTPUT = inside(
  `.runtime/ai-painter/stage4-joint-condition-local-transport-smoke-training-coverage-adjudications/${RUN_ID}`,
)
const FAILURE_OUTPUT = inside(
  `.runtime/ai-painter/stage4-joint-condition-local-transport-smoke-training-coverage-adjudication-failures/${RUN_ID}`,
)
const SMOKE_ROOT =
  `.runtime/ai-painter/stage4-joint-condition-local-transport-controlled-smokes/${SOURCE_RUN_ID}`

const FILES = Object.freeze({
  terminal: inside(
    `.runtime/ai-painter/autonomous-closed-loop-executions/${PACKAGE_IDENTITY}/phase-terminal.json`,
  ),
  manifest: inside(`${SMOKE_ROOT}/manifest.json`),
  machineReview: inside(`${SMOKE_ROOT}/machine-review-timeline.json`),
  lateStability: inside(`${SMOKE_ROOT}/late-stability-qualification.json`),
  trainingManifest: inside(`${SMOKE_ROOT}/training-output/manifest.json`),
  activeConfig: inside(`${SMOKE_ROOT}/active-config.json`),
  fullDataReferenceManifest: inside(
    ".runtime/ai-painter/stage4-spatial-affine-full-data-screens/spatial-affine-screen-20260828164219346-ad821831/manifest.json",
  ),
  formalStage0Manifest: inside(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/ai-assisted-v7-r5-stage4-full-training-2026-08-05T10-21-08-137Z-stage-0/manifest.json",
  ),
  currentRegistry: inside(
    ".runtime/ai-painter/current-execution-registry/current.json",
  ),
  plan: inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
  library: inside(
    "scripts/lib/ai-painter-stage4-joint-condition-local-transport-smoke-training-coverage-adjudication-v1.mjs",
  ),
  checker: inside(
    "scripts/check-ai-painter-stage4-joint-condition-local-transport-smoke-training-coverage-adjudication.mjs",
  ),
  runner: inside(
    "scripts/run-ai-painter-stage4-joint-condition-local-transport-smoke-training-coverage-adjudication.mjs",
  ),
})

const EXPECTED = Object.freeze({
  terminal: "d26df989acca8f9cb09e405a40c669882ee46b0a36bd1ba618a7c9914b5c11cb",
  manifest: "22a61324062a5e32bf61c87ab2bcf468c3ec713bb21c889aabc45124664fa8b9",
  machineReview: "c225fefb7de8ff1bf0968fb9420bac1049152fa330cbd1d3aa9524c399863545",
  lateStability: "683331f0f679e2e5e5a2dd2edc8132726547f17afac250b3d056d73a21bca383",
  trainingManifest: "39410a05bd121c248afaf2f3b7c297656110f27812ebc8eb0032b6493b8351ee",
  activeConfig: "44c8636e7b0837920b0fb30439e48b0dba8bda52cd562371d1850b869fdb25a8",
  fullDataReferenceManifest: "3de8c98b23d57eeb1cc37b0b843ef1f9d327a2a2957c5ce1b96c7fb9a9b9a0b1",
  formalStage0Manifest: "2dfcfd016734ef7d88e33d6f75b23b9d043df7d075b280827b304e1c89ede5ef",
  currentRegistry: "cb9dc68d2d84f9c4c2b9e7358952d3634af124c0ccff09ac31b0103970196d49",
})

main().catch((error) => {
  recordFailure(error)
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})

async function main() {
  for (const [role, expectedSha256] of Object.entries(EXPECTED)) {
    assert.equal(fs.existsSync(FILES[role]), true, `${role} evidence is missing`)
    assert.equal(sha(FILES[role]), expectedSha256, `${role} SHA-256 mismatch`)
  }
  for (const role of ["library", "checker", "runner", "plan"]) {
    assert.equal(fs.existsSync(FILES[role]), true, `${role} program input is missing`)
  }
  assert.equal(fs.existsSync(OUTPUT), false, "coverage adjudication output reuse is forbidden")

  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, EXPECTED.currentRegistry)
  assert.equal(current.registry.registryRevision, 53)
  assert.equal(current.registry.eventSequence, 53)
  assert.equal(
    current.registry.taskId,
    "compile_and_execute_stage4_joint_condition_local_transport_controlled_smoke",
  )
  assert.equal(
    current.registry.activity,
    "joint_condition_local_transport_controlled_smoke_pending",
  )
  assert.equal(current.registry.activeExecution, null)

  const bindings = Object.fromEntries(
    Object.keys(EXPECTED)
      .filter((role) => role !== "currentRegistry")
      .map((role) => [role, bind(FILES[role])]),
  )
  const evidence = {
    bindingsVerified: true,
    bindings,
    terminal: read(FILES.terminal),
    manifest: read(FILES.manifest),
    machineReview: read(FILES.machineReview),
    lateStability: read(FILES.lateStability),
    trainingManifest: read(FILES.trainingManifest),
    activeConfig: read(FILES.activeConfig),
    fullDataReferenceManifest: read(FILES.fullDataReferenceManifest),
    formalStage0Manifest: read(FILES.formalStage0Manifest),
    executionBoundary: {
      checkpointWeightsRead: false,
      gpuStarted: false,
      trainingStarted: false,
    },
  }
  assert.deepEqual(evidence.manifest.trainingManifest, bindings.trainingManifest)
  assert.deepEqual(evidence.manifest.machineReviewTimeline, bindings.machineReview)
  assert.deepEqual(evidence.manifest.lateStabilityQualification, bindings.lateStability)

  const adjudication = adjudicateJointTransportSmokeTrainingCoverage(evidence)
  assert.equal(adjudication.status, "uniquely_adjudicated")
  assert.equal(adjudication.decision, DECISION)
  assert.equal(adjudication.candidateRejected, false)
  assert.equal(adjudication.sameThirtyStepSmokeRerunAllowed, false)
  assert.equal(adjudication.nextLegalAction, NEXT_LEGAL_ACTION)
  const contract = deriveJointTransportTwentyFourEpochFullDataScreenContract(evidence)
  assert.equal(
    contract.status,
    "cpu_compiled_inactive_not_authorized_for_gpu_or_training",
  )
  assert.equal(contract.activationAuthorized, false)
  assert.equal(Object.values(contract.activationGates).every((value) => value === false), true)

  const checkerExecution = spawnSync(process.execPath, [FILES.checker], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  })
  assert.equal(
    checkerExecution.status,
    0,
    checkerExecution.stderr || checkerExecution.stdout,
  )
  const checker = JSON.parse(checkerExecution.stdout)
  assert.equal(checker.status, "passed")
  assert.equal(checker.positivePassed, checker.positiveTotal)
  assert.equal(checker.negativePassed, checker.negativeTotal)

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.mkdirSync(OUTPUT, { recursive: false })
  const outputs = Object.freeze({
    problem: path.join(OUTPUT, "problem-report.json"),
    audit: path.join(OUTPUT, "training-coverage-audit.json"),
    decision: path.join(OUTPUT, "unique-decision.json"),
    contract: path.join(OUTPUT, "inactive-24-epoch-full-data-screen-contract.json"),
    cpu: path.join(OUTPUT, "cpu-report.json"),
    trainingTerminalProjection: path.join(
      OUTPUT,
      "source-smoke-training-terminal-projection.json",
    ),
    planSync: path.join(OUTPUT, "plan-sync-record.json"),
    terminal: path.join(OUTPUT, "phase-terminal.json"),
    capsule: path.join(OUTPUT, "local-task-capsule.json"),
  })
  const recordedAtUtc = new Date().toISOString()

  writeExclusive(outputs.problem, {
    schemaVersion:
      "stage4-joint-condition-local-transport-smoke-training-coverage-problem-v1",
    status: "controlled_smoke_real_visual_failure_requires_coverage_causal_boundary",
    capabilityVersion: CAPABILITY_VERSION,
    sourceRunId: SOURCE_RUN_ID,
    immutableEvidence: bindings,
    observedVisualResult: {
      machineReviewPassCount: 0,
      machineReviewCount: 5,
      lateStabilityQualified: false,
      preservedAsRealFailureEvidence: true,
    },
    question:
      "Can a one-sample 30-step Smoke with 3% schedule coverage reject the model family?",
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })

  writeExclusive(outputs.audit, {
    schemaVersion:
      "stage4-joint-condition-local-transport-smoke-training-coverage-audit-v1",
    status: "completed",
    capabilityVersion: CAPABILITY_VERSION,
    sourceRunId: SOURCE_RUN_ID,
    checks: adjudication.checks,
    comparison: adjudication.comparison,
    causalBoundary: {
      visualFailureConfirmed: true,
      smokeQualificationFailed: true,
      modelFamilyRejectionSupported: false,
      confounder:
        "training_coverage_is_30_optimizer_steps_on_one_validation_sample_with_no_formal_inference_timestep_overlap",
      fullDataEvidenceRequiredBeforeRejection: true,
    },
    sameThirtyStepSmokeRerunAllowed: false,
    recordedAtUtc,
  })

  writeExclusive(outputs.decision, {
    ...adjudication,
    schemaVersion:
      "stage4-joint-condition-local-transport-smoke-training-coverage-unique-decision-v1",
    status: "uniquely_adjudicated",
    sourceEvidence: bindings,
    fullDataContractActivated: false,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  })

  writeExclusive(outputs.contract, {
    ...contract,
    sourceCoverageDecision: bind(outputs.decision),
    sourceEvidence: bindings,
    futureRunId: null,
    futureOutputNamespace: null,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })

  writeExclusive(outputs.cpu, {
    schemaVersion:
      "stage4-joint-condition-local-transport-smoke-training-coverage-cpu-report-v1",
    status: "passed",
    currentRegistryRevisionVerified: 53,
    currentRegistrySha256Verified: EXPECTED.currentRegistry,
    immutableEvidenceHashesVerified: Object.keys(bindings),
    sourceCrossBindingsVerified: true,
    controlledSmokeCoverageVerified: true,
    fullDataReferenceCoverageVerified: true,
    formalStage0CoverageVerified: true,
    selectedDecision: DECISION,
    candidateRejected: false,
    sameThirtyStepSmokeRerunAllowed: false,
    nextLegalAction: NEXT_LEGAL_ACTION,
    regression: checker,
    executableIdentity: {
      library: bind(FILES.library),
      checker: bind(FILES.checker),
      runner: bind(FILES.runner),
    },
    executionBoundary: {
      checkpointFilesOpened: false,
      checkpointWeightsRead: false,
      gpuStarted: false,
      optimizerCreated: false,
      backwardExecuted: false,
      modelWeightsModified: false,
      trainingStarted: false,
    },
    recordedAtUtc,
  })

  // The generic autonomous terminal is immutable but predates the current
  // registry's `executionState: completed` training-terminal shape.  Preserve
  // it byte-for-byte and create a bound projection instead of rewriting it.
  writeExclusive(outputs.trainingTerminalProjection, {
    schemaVersion:
      "stage4-joint-condition-local-transport-controlled-smoke-training-terminal-projection-v1",
    executionState: "completed",
    status:
      "stage4_joint_condition_local_transport_controlled_smoke_real_visual_failure",
    runId: SOURCE_RUN_ID,
    capabilityVersion: CAPABILITY_VERSION,
    sourceAutonomousTerminal: bindings.terminal,
    manifest: bindings.manifest,
    machineReviewTimeline: bindings.machineReview,
    lateStabilityQualification: bindings.lateStability,
    trainingManifest: bindings.trainingManifest,
    activeConfig: bindings.activeConfig,
    historicalEvidenceModified: false,
    checkpointWeightsRead: false,
    gpuStartedByProjection: false,
    trainingStartedByProjection: false,
    recordedAtUtc,
  })

  const planBeforeSha256 = sha(FILES.plan)
  const nextPlan = updatePlan(fs.readFileSync(FILES.plan, "utf8"), recordedAtUtc)
  const planAfterSha256 = shaText(nextPlan)
  writeExclusive(outputs.planSync, {
    schemaVersion:
      "stage4-joint-condition-local-transport-smoke-training-coverage-plan-sync-v1",
    status: "prepared_for_atomic_projection_after_registry_commit",
    planPath: projectPath(FILES.plan),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    decision: DECISION,
    candidateRejected: false,
    nextLegalAction: NEXT_LEGAL_ACTION,
    fixedProgress: progress(),
    recordedAtUtc,
  })

  writeExclusive(outputs.terminal, {
    schemaVersion:
      "stage4-joint-condition-local-transport-smoke-training-coverage-terminal-v1",
    executionState: "completed",
    status:
      "stage4_joint_condition_local_transport_smoke_training_coverage_adjudicated_full_data_screen_contract_inactive",
    runId: RUN_ID,
    capabilityVersion: CAPABILITY_VERSION,
    sourceSmokeRunId: SOURCE_RUN_ID,
    sourceSmokeTerminal: bindings.terminal,
    sourceSmokeTrainingTerminalProjection: bind(outputs.trainingTerminalProjection),
    problemReport: bind(outputs.problem),
    trainingCoverageAudit: bind(outputs.audit),
    uniqueDecision: bind(outputs.decision),
    inactiveFullDataScreenContract: bind(outputs.contract),
    cpuReport: bind(outputs.cpu),
    planSyncRecord: bind(outputs.planSync),
    decision: DECISION,
    candidateRejected: false,
    sameThirtyStepSmokeRerunAllowed: false,
    nextLegalAction: NEXT_LEGAL_ACTION,
    fixedProgress: progress(),
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  })

  const capsuleEvidence = [
    ...Object.entries(bindings).map(([kind, binding]) => ({
      kind: `source_${kind}`,
      labelZh: `source_${kind}`,
      ...binding,
      expectedSha256: binding.sha256,
      sha256Verified: true,
    })),
    ...Object.entries(outputs)
      .filter(([kind]) => kind !== "capsule")
      .map(([kind, file]) => ({
        kind,
        labelZh: kind,
        ...bind(file),
        expectedSha256: sha(file),
        sha256Verified: true,
      })),
  ]
  writeExclusive(outputs.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${RUN_ID}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "Stage4联合条件局部传输训练覆盖因果裁决",
      status: "full_data_screen_contract_compiled_inactive",
    },
    candidateTerminal: {
      runId: SOURCE_RUN_ID,
      status: "controlled_smoke_real_visual_failure_preserved",
      modelQualificationStatus: "not_qualified",
      modelFamilyRejected: false,
      recordedAtUtc,
    },
    latestBlocker: {
      code: "joint_condition_local_transport_full_data_screen_not_compiled_for_execution",
      summaryZh:
        "30步单样本Smoke覆盖不足以拒绝模型家族；24 Epoch全数据筛查执行合同尚未编译激活。",
    },
    nextAllowedAction: {
      code: NEXT_LEGAL_ACTION,
      labelZh: "编译联合条件局部传输24 Epoch全数据筛查执行合同。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: [
      "rerun_same_30_step_smoke",
      "read_smoke_or_failed_checkpoint_weights",
      "change_model_architecture",
      "change_loss_values_or_weights",
      "change_dataset_or_split",
      "change_review_thresholds",
      "start_gpu_or_training_from_inactive_contract",
    ],
    taskIdentity: {
      modelId: CAPABILITY_VERSION,
      sourceRunId: SOURCE_RUN_ID,
      seed: 20263722,
      nextScreenEpochCount: 24,
      nextScreenOptimizerStepCount: 1152,
    },
    evidence: capsuleEvidence,
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })

  for (const file of Object.values(outputs)) index(file)
  const advanced = await advanceCurrentExecutionRegistry({
    projectRoot: ROOT,
    capabilityVersion: CAPABILITY_VERSION,
    packageId: RUN_ID,
    taskId: NEXT_LEGAL_ACTION,
    taskKind: "full_data_screen_contract_compilation",
    runId: RUN_ID,
    lifecycleStage: "joint_condition_local_transport_smoke_coverage_adjudicated",
    executionState: "completed",
    activity: "joint_condition_local_transport_24_epoch_full_data_screen_contract_pending",
    taskCapsulePath: projectPath(outputs.capsule),
    terminalEvidencePath: projectPath(outputs.terminal),
    latestTrainingTerminal: {
      runId: SOURCE_RUN_ID,
      path: projectPath(outputs.trainingTerminalProjection),
      sha256: sha(outputs.trainingTerminalProjection),
      status:
        "stage4_joint_condition_local_transport_controlled_smoke_real_visual_failure",
      evidence: {
        sourceAutonomousTerminal: bindings.terminal,
        manifest: bindings.manifest,
        machineReviewTimeline: bindings.machineReview,
        lateStabilityQualification: bindings.lateStability,
        trainingManifest: bindings.trainingManifest,
        activeConfig: bindings.activeConfig,
      },
    },
    expectedPreviousRegistryRevision: 53,
    expectedPreviousRegistrySha256: EXPECTED.currentRegistry,
  })

  writeAtomic(FILES.plan, nextPlan)
  assert.equal(sha(FILES.plan), planAfterSha256)
  appendAiPainterProgramEvent({
    id: `stage4-joint-transport-smoke-coverage-adjudication-${RUN_ID}`,
    timestamp: recordedAtUtc,
    action: "stage4_joint_transport_smoke_training_coverage_adjudicated",
    runId: RUN_ID,
    kind: "cpu_readonly_smoke_training_coverage_causal_adjudication",
    status: "success",
    title:
      "Joint-condition local-transport Smoke coverage was insufficient for model-family rejection",
    titleZh: "联合条件局部传输Smoke训练覆盖不足以拒绝模型家族",
    detailZh:
      "Smoke真实视觉失败保留；30步仅覆盖30/1000且与正式推理步0/50重叠，因此禁止原样重跑并转入冻结的24 Epoch全数据筛查合同编译。",
    evidencePath: projectPath(outputs.terminal),
    evidenceSha256: sha(outputs.terminal),
    fixedTotalProgress: progress(),
  })

  process.stdout.write(`${JSON.stringify({
    status:
      "stage4_joint_condition_local_transport_smoke_training_coverage_adjudicated_full_data_screen_contract_inactive",
    runId: RUN_ID,
    decision: DECISION,
    candidateRejected: false,
    sameThirtyStepSmokeRerunAllowed: false,
    nextLegalAction: NEXT_LEGAL_ACTION,
    inactiveFullDataScreenContract: bind(outputs.contract),
    terminal: bind(outputs.terminal),
    currentRegistryRevision: advanced.registry.registryRevision,
    currentRegistrySha256: advanced.registrySha256,
    fixedProgress: progress(),
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
  }, null, 2)}\n`)
}

function updatePlan(source, timestamp) {
  let output = source
  output = replaceOnce(
    output,
    /^更新时间：.*$/mu,
    `更新时间：${formatShanghai(timestamp).replace("T", " ").replace("+08:00", " +08:00")}`,
  )
  output = replaceOnce(
    output,
    /^状态：.*$/mu,
    "状态：active-module-plan / AI Painter固定进度3/5（60%）；联合条件局部传输30步Smoke覆盖不足以拒绝模型家族，24 Epoch全数据筛查合同待编译",
  )
  output = replaceOnce(
    output,
    /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；联合条件局部传输30 Epoch单样本Smoke真实视觉失败，但仅30次优化、覆盖30/1000训练timestep且与50个正式推理timestep无重叠，证据不足以拒绝模型家族 | 禁止原样重跑30步Smoke；下一步只编译冻结模型、Loss、数据、阈值和seed的24 Epoch全数据筛查合同，当前未激活GPU或训练 |",
  )
  output = replaceOnce(
    output,
    /## 4\. 最近一次模块终态[\s\S]*?(?=\n## 5\.)/u,
    `## 4. 最近一次模块终态\n\n联合条件局部传输30 Epoch受控Smoke已自然完成并由同一闭环包完成字节复现、五节点正式机器审核、晚期稳定性裁决、Finalization和失败终态。五个预览全部存在道路或对象参考语义失败，Smoke资格未通过；该真实失败证据保持不可变，不降低阈值、不作为训练目标，也不晋级Checkpoint。\n\nCPU只读覆盖裁决进一步确认该Smoke每Epoch仅对固定validation样本194执行一次优化，总计30次优化；训练timestep仅覆盖1000步扩散日程中的30步，范围635–722，与50个正式推理timestep精确重叠0步。对照的既有24 Epoch全数据筛查为1152次优化、覆盖1000/1000并重叠50/50；正式Stage 0为5760次优化。因此当前证据只能否决本次Smoke资格，不能拒绝联合条件局部传输模型家族。\n`,
  )
  output = replaceOnce(
    output,
    /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u,
    `## 5. 当前阻断与后续实施顺序\n\n唯一裁决为\`${DECISION}\`，\`candidateRejected=false\`。禁止原样重跑同一30步单样本Smoke，也禁止读取本次或任何失败Checkpoint权重。\n\n本地程序已生成未激活的24 Epoch全数据筛查设计合同：固定48条train记录每Epoch一次优化，共1152步；固定seed 20263722、1000步完整timestep覆盖、50/50正式推理timestep重叠，并冻结现有联合条件局部传输模型、正式Loss值与权重、64条数据及split、机器审核阈值和Checkpoint边界。当前合同不含future runId或输出命名空间，所有GPU、优化器、反向、权重修改和训练门均为false。\n\n下一步唯一允许动作是\`${NEXT_LEGAL_ACTION}\`，由本地程序另行编译不可复用的正式执行合同并通过CPU正反门；本次裁决本身不得启动GPU或训练。\n`,
  )
  return output
}

function progress() {
  return { completedStages: 3, totalStages: 5, percent: 60 }
}
function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}
function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}
function shaText(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex")
}
function bind(file) {
  return { path: projectPath(file), sha256: sha(file) }
}
function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  })
}
function writeAtomic(file, value) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporary, value, "utf8")
  fs.renameSync(temporary, file)
}
function replaceOnce(source, pattern, replacement) {
  assert.match(source, pattern)
  const output = source.replace(pattern, replacement)
  assert.notEqual(output, source)
  return output
}
function compactUtc() {
  return new Date().toISOString().replaceAll(/[-:.TZ]/gu, "").slice(0, 17)
}
function inside(relative) {
  assert.equal(path.isAbsolute(relative), false)
  const candidate = path.resolve(ROOT, relative)
  assert.ok(candidate.startsWith(`${path.resolve(ROOT)}${path.sep}`))
  return candidate
}
function index(file) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: RUN_ID,
    artifactType:
      "stage4_joint_condition_local_transport_smoke_training_coverage_adjudication_v1",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
}

function recordFailure(error) {
  try {
    fs.mkdirSync(FAILURE_OUTPUT, { recursive: true })
    const file = path.join(FAILURE_OUTPUT, "failure-report.json")
    if (!fs.existsSync(file)) {
      writeExclusive(file, {
        schemaVersion:
          "stage4-joint-condition-local-transport-smoke-training-coverage-failure-v1",
        executionState: "completed",
        status: "cpu_readonly_training_coverage_adjudication_failed_closed",
        runId: RUN_ID,
        error: error instanceof Error ? error.message : String(error),
        checkpointWeightsRead: false,
        gpuStarted: false,
        trainingStarted: false,
        recordedAtUtc: new Date().toISOString(),
      })
    }
  } catch {}
}
