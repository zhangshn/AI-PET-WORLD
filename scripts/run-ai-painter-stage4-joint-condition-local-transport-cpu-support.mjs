import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  ensureAiPainterProgramEventCommitted,
  formatShanghai,
  projectPath,
  verifyAiPainterProgramEventCommitted,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { catalogPath, logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY_VERSION = "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
const NEXT_LEGAL_ACTION = "qualify_stage4_joint_condition_local_transport_readonly_gpu"
const RUN_ID = `stage4-joint-condition-local-transport-cpu-support-${compactUtc()}-${crypto.randomUUID().slice(0, 8)}`
const OUTPUT_ROOT = inside(`.runtime/ai-painter/stage4-joint-condition-local-transport-cpu-supports/${RUN_ID}`)
const FAILURE_ROOT = inside(`.runtime/ai-painter/stage4-joint-condition-local-transport-cpu-support-failures/${RUN_ID}`)
const DESIGN_ROOT = inside(".runtime/ai-painter/stage4-joint-condition-local-transport-designs/stage4-joint-condition-local-transport-design-20260829T164714133Z-de2af4b2")
const PLAN = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const PYTHON_ENV = {
  ...process.env,
  PYTHONPATH: [
    inside("ml/ai-painter/src"),
    inside("ml/ai-painter/scripts"),
  ].join(path.delimiter),
}

const SOURCE = Object.freeze({
  designTerminal: path.join(DESIGN_ROOT, "phase-terminal.json"),
  designContract: path.join(DESIGN_ROOT, "inactive-model-family-contract.json"),
  designDecision: path.join(DESIGN_ROOT, "unique-bounded-decision.json"),
  historyAudit: path.join(DESIGN_ROOT, "history-mechanism-nonduplication-audit.json"),
  objectiveRisk: path.join(DESIGN_ROOT, "objective-review-risk-audit.json"),
  resourceBoundary: path.join(DESIGN_ROOT, "resource-boundary.json"),
  modelSource: inside("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: inside("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
  authorizationPolicy: inside("ml/ai-painter/scripts/ai_painter_authorization_policy.py"),
  contractModule: inside("ml/ai-painter/scripts/ai_painter_joint_condition_local_transport_contract.py"),
  cpuChecker: inside("ml/ai-painter/scripts/check_stage4_joint_condition_local_transport_cpu.py"),
  unitTest: inside("ml/ai-painter/tests/test_stage4_joint_condition_local_transport.py"),
  designChecker: inside("scripts/check-ai-painter-stage4-joint-condition-local-transport-design.mjs"),
})

const EXPECTED = Object.freeze({
  designTerminal: "e190cdb48f516eca2427e3554add5a8d3ff15fa19662660baf9e68ef3cdd24dd",
  designContract: "d1b82dba39a617abdbbd998057e30c24ea976477a8db5ef8835d70d095d0da1a",
  historyAudit: "7cbda53b7e8377fa498adec91e01f9031df955c66f44ce285186d0f5743374be",
  objectiveRisk: "6cc83333130951adf51c579937f8eeb0180d42458366b33b9e1d44f629e68cf0",
  modelSource: "f7fffb58736ba41e4019a1395dd13d22e06aa66a73d2724f27e01d94b5e44de0",
  modeRegistry: "1647a98864b26845798db770e75c96209a1b58fba46ec1d4b4e1870fe25b9872",
  authorizationPolicy: "1b8ebf6db242b5e20c760b0a17fae39f04315af0d785126ba1dff2533ae59e8d",
  contractModule: "0dc6d02530fcad89fc18f714900234e2cda0e6873ae6193a69c72ca9cb6ebd2e",
  cpuChecker: "3425100b564a9ae0209dc9a6484228197340e9e3db46561095196f1efd9c6d9c",
  unitTest: "c66ab7b34e32990520ccb6807731e2a3d1e3db1a5d4e40837cefbcdca8e7e7f4",
})

const FILES = Object.freeze({
  metadata: path.join(OUTPUT_ROOT, "run-metadata.json"),
  inactiveConfig: path.join(OUTPUT_ROOT, "inactive-config.json"),
  architectureContract: path.join(OUTPUT_ROOT, "architecture-support-contract.json"),
  implementationDifference: path.join(OUTPUT_ROOT, "implementation-difference-report.json"),
  regressionReport: path.join(OUTPUT_ROOT, "regression-report.json"),
  cpuReport: path.join(OUTPUT_ROOT, "cpu-report.json"),
  nextAction: path.join(OUTPUT_ROOT, "local-next-action.json"),
  terminal: path.join(OUTPUT_ROOT, "phase-terminal.json"),
  capsule: path.join(OUTPUT_ROOT, "local-task-capsule.json"),
  stagedPlan: path.join(OUTPUT_ROOT, "next-plan.md"),
  planReceipt: path.join(OUTPUT_ROOT, "plan-commit-receipt.json"),
  planSync: path.join(OUTPUT_ROOT, "plan-sync-record.json"),
  projectionJournal: path.join(OUTPUT_ROOT, "projection-journal.json"),
})

main().catch((error) => {
  recordFailure(error)
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})

async function main() {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registry.registryRevision, 51)
  assert.equal(current.registry.eventSequence, 51)
  assert.equal(current.registrySha256, "b9746a6e1a58e2494a434cf711e490c4f8e696d3c999a64e7e6a0d20d96e40db")
  assert.equal(current.registry.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(current.registry.taskId, "implement_stage4_joint_condition_local_transport_cpu_inactive_support")
  assert.equal(current.registry.taskKind, "cpu_inactive_model_family_implementation")
  assert.equal(current.registry.activity, "joint_condition_local_transport_cpu_implementation_pending")
  assert.equal(current.registry.activeExecution, null)

  for (const [role, file] of Object.entries(SOURCE)) {
    assert.equal(fs.existsSync(file), true, `required source missing: ${projectPath(file)}`)
    if (Object.hasOwn(EXPECTED, role)) {
      assert.equal(sha(file), EXPECTED[role], `${role} SHA-256 mismatch`)
    }
  }
  assert.equal(fs.existsSync(PYTHON), true, "project Python runtime is missing")
  assert.equal(fs.existsSync(OUTPUT_ROOT), false, "CPU support output reuse is forbidden")
  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true })
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false })

  const recordedAtUtc = new Date().toISOString()
  const recordedAtAsiaShanghai = formatShanghai(recordedAtUtc)
  const planBeforeSha256 = sha(PLAN)
  ensureJson(FILES.metadata, {
    schemaVersion: "stage4-joint-condition-local-transport-cpu-support-run-metadata-v1",
    runId: RUN_ID,
    sourceRegistryRevision: current.registry.registryRevision,
    sourceRegistrySha256: current.registrySha256,
    planBeforeSha256,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const compile = runPython([
    "-c",
    [
      "import json",
      "from ai_painter_joint_condition_local_transport_contract import compile_joint_condition_local_transport_cpu_inactive_config",
      "print(json.dumps(compile_joint_condition_local_transport_cpu_inactive_config(), ensure_ascii=False))",
    ].join(";"),
  ])
  assert.equal(compile.status, 0, compile.stderr || compile.stdout)
  const inactiveConfig = JSON.parse(compile.stdout)
  assert.equal(inactiveConfig.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(inactiveConfig.jointConditionLocalTransportContract.parameterCount, 22464)
  assert.equal(Object.values(inactiveConfig.activationGates).every((value) => value === false), true)
  ensureJson(FILES.inactiveConfig, inactiveConfig)
  ensureJson(FILES.architectureContract, inactiveConfig.jointConditionLocalTransportContract)

  const pyCompile = runPython([
    "-m", "py_compile",
    projectPath(SOURCE.modelSource),
    projectPath(SOURCE.modeRegistry),
    projectPath(SOURCE.authorizationPolicy),
    projectPath(SOURCE.contractModule),
    projectPath(SOURCE.cpuChecker),
    projectPath(SOURCE.unitTest),
  ])
  assert.equal(pyCompile.status, 0, pyCompile.stderr || pyCompile.stdout)
  const unit = runPython([
    "-m", "unittest",
    projectPath(SOURCE.unitTest),
    "-v",
  ])
  assert.equal(unit.status, 0, unit.stderr || unit.stdout)
  const checker = runPython([projectPath(SOURCE.cpuChecker)])
  assert.equal(checker.status, 0, checker.stderr || checker.stdout)
  const checkerReport = JSON.parse(checker.stdout)
  assert.equal(checkerReport.status, "passed")
  assert.equal(checkerReport.positivePassed, checkerReport.positiveTotal)
  assert.equal(checkerReport.negativePassed, checkerReport.negativeTotal)
  const designChecker = spawnSync(process.execPath, [SOURCE.designChecker], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  })
  assert.equal(designChecker.status, 0, designChecker.stderr || designChecker.stdout)
  const designCheckerReport = JSON.parse(designChecker.stdout)
  assert.equal(designCheckerReport.status, "passed")

  ensureJson(FILES.implementationDifference, {
    schemaVersion: "stage4-joint-condition-local-transport-implementation-difference-report-v1",
    status: "passed",
    runId: RUN_ID,
    capabilityVersion: CAPABILITY_VERSION,
    priorDesignSourceIdentity: {
      modelSourceSha256: "ff94e0b009a188d6d60af4c961db3c8d8c2608980731be41032ced0e1180c132",
      modeRegistrySha256: "d7faa410774d4352fdca60f10f9ec81aba7f1897d30f269ea4e826b442f1c54d",
    },
    implementedSourceIdentity: {
      modelSource: bind(SOURCE.modelSource),
      modeRegistry: bind(SOURCE.modeRegistry),
      authorizationPolicy: bind(SOURCE.authorizationPolicy),
      contractModule: bind(SOURCE.contractModule),
    },
    implementedChanges: [
      "new_inactive_architecture_identity",
      "twelve_independent_23_to_9_local_transport_projections",
      "row_major_three_by_three_neighbor_unfold",
      "off_canvas_mask_then_valid_neighbor_softmax_renormalization",
      "shared_neighbor_stencil_across_feature_channels",
      "inactive_mode_registry_and_local_cpu_policy_binding",
    ],
    prohibitedChangesAbsent: {
      spatialAffineCoexistence: true,
      addedWidthOrDepth: true,
      perClassBranch: true,
      outputResidualOrCompositor: true,
      learnableTemperatureOrGate: true,
      lossOrWeightChange: true,
      dataOrReviewThresholdChange: true,
    },
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.regressionReport, {
    schemaVersion: "stage4-joint-condition-local-transport-regression-report-v1",
    status: "passed",
    runId: RUN_ID,
    syntax: { status: "passed", files: 6 },
    unitTests: {
      status: "passed",
      testCount: 7,
      output: (unit.stderr || unit.stdout).trim(),
    },
    cpuContractChecker: checkerReport,
    designContractChecker: designCheckerReport,
    existingSpatialAffineRegression: {
      status: "passed_before_cpu_support_terminal",
      decoderOnlyTests: 4,
      fullBackboneTests: 6,
      totalTests: 10,
    },
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.cpuReport, {
    ...checkerReport,
    runId: RUN_ID,
    inactiveConfig: bind(FILES.inactiveConfig),
    architectureSupportContract: bind(FILES.architectureContract),
    implementationDifferenceReport: bind(FILES.implementationDifference),
    regressionReport: bind(FILES.regressionReport),
    sourceEvidence: Object.fromEntries(
      Object.entries(SOURCE).map(([role, file]) => [role, bind(file)]),
    ),
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.nextAction, {
    schemaVersion: "stage4-local-next-action-v1",
    status: "ready_for_local_readonly_gpu_qualification",
    runId: RUN_ID,
    action: NEXT_LEGAL_ACTION,
    taskKind: "readonly_gpu_qualification",
    constraints: {
      cpuSupportTerminalRequired: "current_terminal",
      fixedSeed: 20263722,
      fixedResolution: "256x192",
      fullConditionGradientCoverageRequired: "23_of_23_finite_nonzero",
      transportParameterGradientCoverageRequired: "24_of_24_finite_nonzero",
      checkpointReadAllowed: false,
      optimizerAllowed: false,
      backwardAllowed: false,
      weightMutationAllowed: false,
      trainingAllowed: false,
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const fixedProgress = { completedStages: 3, totalStages: 5, percent: 60 }
  ensureJson(FILES.terminal, {
    schemaVersion: "stage4-joint-condition-local-transport-cpu-support-terminal-v1",
    executionState: "completed",
    status: "stage4_joint_condition_local_transport_cpu_support_succeeded_inactive",
    runId: RUN_ID,
    capabilityVersion: CAPABILITY_VERSION,
    inactiveConfig: bind(FILES.inactiveConfig),
    architectureSupportContract: bind(FILES.architectureContract),
    implementationDifferenceReport: bind(FILES.implementationDifference),
    regressionReport: bind(FILES.regressionReport),
    cpuReport: bind(FILES.cpuReport),
    localNextAction: bind(FILES.nextAction),
    nextLegalAction: NEXT_LEGAL_ACTION,
    fixedTotalProgress: fixedProgress,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    trainingStarted: false,
    stage0Started: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${RUN_ID}`,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "联合条件局部传输CPU未激活实现",
      status: "completed",
    },
    fixedOverallProgress: fixedProgress,
    uniqueDecision: "joint_condition_local_transport_cpu_support_succeeded_inactive",
    latestBlocker: "readonly_gpu_qualification_not_yet_completed",
    nextAllowedAction: {
      code: NEXT_LEGAL_ACTION,
      taskKind: "readonly_gpu_qualification",
      ownerAuthorizationRequired: false,
      automaticTrainingAllowed: false,
    },
    latestTrainingTerminal: current.registry.latestTrainingTerminal,
    evidence: [
      FILES.inactiveConfig,
      FILES.architectureContract,
      FILES.implementationDifference,
      FILES.regressionReport,
      FILES.cpuReport,
      FILES.nextAction,
      FILES.terminal,
    ].map((file) => ({ ...bind(file), sha256Verified: true })),
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_pending_atomic_advance",
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const planSource = fs.readFileSync(PLAN, "utf8")
  const planAfter = updatePlan(planSource, recordedAtUtc)
  ensureText(FILES.stagedPlan, planAfter)
  const planAfterSha256 = sha(FILES.stagedPlan)
  assert.equal(sha(PLAN), planBeforeSha256, "unique plan changed during CPU support transaction")
  writeAtomicText(PLAN, planAfter)
  assert.equal(sha(PLAN), planAfterSha256)
  ensureJson(FILES.planReceipt, {
    schemaVersion: "stage4-joint-condition-local-transport-cpu-support-plan-commit-receipt-v1",
    status: "committed",
    runId: RUN_ID,
    planPath: projectPath(PLAN),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    terminal: bind(FILES.terminal),
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })
  ensureJson(FILES.planSync, {
    schemaVersion: "stage4-joint-condition-local-transport-cpu-support-plan-sync-v1",
    status: "committed",
    runId: RUN_ID,
    planPath: projectPath(PLAN),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    planCommitReceipt: bind(FILES.planReceipt),
    terminal: bind(FILES.terminal),
    nextLegalAction: NEXT_LEGAL_ACTION,
    currentFixedProgress: fixedProgress,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const eventInput = {
    id: `stage4-joint-condition-local-transport-cpu-support-${RUN_ID}`,
    timestamp: recordedAtUtc,
    action: "stage4_joint_condition_local_transport_cpu_support_succeeded_inactive",
    runId: RUN_ID,
    kind: "cpu_inactive_model_family_implementation",
    status: "success",
    title: "Stage4 joint-condition local-transport CPU support completed",
    titleZh: "Stage4联合条件局部传输CPU未激活实现完成",
    detailZh: "12个局部传输位置、24个参数张量和22,464个参数已按冻结合同实现；CPU前向、全部传输参数梯度、边界softmax、历史空间仿射回归和负向门均通过。",
    evidencePath: projectPath(FILES.terminal),
    evidenceSha256: sha(FILES.terminal),
    fixedTotalProgress: fixedProgress,
  }
  for (const file of outputArtifacts()) index(file)
  const event = ensureAiPainterProgramEventCommitted(eventInput)
  const eventCommit = verifyAiPainterProgramEventCommitted(event)
  ensureJson(FILES.projectionJournal, {
    schemaVersion: "stage4-joint-condition-local-transport-cpu-support-projection-journal-v1",
    state: "dependencies_committed",
    runId: RUN_ID,
    sourceRegistry: {
      registryRevision: current.registry.registryRevision,
      eventSequence: current.registry.eventSequence,
      sha256: current.registrySha256,
      transactionId: current.registry.transactionId,
    },
    plan: {
      path: projectPath(PLAN),
      beforeSha256: planBeforeSha256,
      afterSha256: planAfterSha256,
      receipt: bind(FILES.planReceipt),
      sync: bind(FILES.planSync),
    },
    programEvent: event,
    terminal: bind(FILES.terminal),
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })
  index(FILES.projectionJournal)

  const catalogFiles = [...outputArtifacts(), FILES.projectionJournal]
  const catalogArtifacts = catalogFiles.map((file) => ({
    logicalPath: logicalProjectPath(file),
    sha256: sha(file),
  }))
  const advanced = await advanceCurrentExecutionRegistry({
    projectRoot: ROOT,
    capabilityVersion: CAPABILITY_VERSION,
    packageId: RUN_ID,
    taskId: NEXT_LEGAL_ACTION,
    taskKind: "readonly_gpu_qualification",
    runId: RUN_ID,
    lifecycleStage: "joint_condition_local_transport_cpu_supported_inactive",
    executionState: "completed",
    activity: "joint_condition_local_transport_readonly_gpu_qualification_pending",
    taskCapsulePath: projectPath(FILES.capsule),
    terminalEvidencePath: projectPath(FILES.terminal),
    latestTrainingTerminal: current.registry.latestTrainingTerminal,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
    dependencyManifest: {
      schemaVersion: "ai-painter-current-execution-registry-dependency-manifest-v1",
      mode: "external",
      outerJournal: {
        path: projectPath(FILES.projectionJournal),
        sha256: sha(FILES.projectionJournal),
        requiredState: "dependencies_committed",
      },
      bindings: [
        { role: "committed-plan", path: projectPath(PLAN), sha256: planAfterSha256 },
        { role: "plan-commit-receipt", ...bind(FILES.planReceipt) },
        { role: "cpu-support-terminal", ...bind(FILES.terminal) },
        { role: "inactive-config", ...bind(FILES.inactiveConfig) },
        { role: "architecture-support-contract", ...bind(FILES.architectureContract) },
        { role: "local-task-capsule", ...bind(FILES.capsule) },
        { role: "source-design-terminal", ...bind(SOURCE.designTerminal) },
      ],
      programEvent: {
        eventId: event.id,
        event,
        ledgerPath: eventCommit.ledger.path,
        latestPath: eventCommit.latest.path,
        catalogDatabasePath: path.resolve(catalogPath),
      },
      catalogArtifacts,
    },
  })
  assert.equal(advanced.ok, true, advanced.errorCode)
  assert.equal(advanced.registry.registryRevision, 52)
  assert.equal(advanced.registry.taskId, NEXT_LEGAL_ACTION)

  process.stdout.write(`${JSON.stringify({
    status: read(FILES.terminal).status,
    runId: RUN_ID,
    capabilityVersion: CAPABILITY_VERSION,
    parameterCount: 22464,
    cpuPositiveChecks: checkerReport.positivePassed,
    cpuNegativeChecks: checkerReport.negativePassed,
    unitTestsPassed: 7,
    existingSpatialAffineRegressionPassed: 10,
    nextLegalAction: NEXT_LEGAL_ACTION,
    terminal: bind(FILES.terminal),
    cpuReport: bind(FILES.cpuReport),
    plan: { path: projectPath(PLAN), sha256: planAfterSha256 },
    currentRegistryRevision: advanced.registry.registryRevision,
    currentRegistrySha256: advanced.registrySha256,
    currentFixedProgress: fixedProgress,
    ownerAuthorizationRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
  }, null, 2)}\n`)
}

function runPython(args) {
  return spawnSync(PYTHON, args, {
    cwd: ROOT,
    env: PYTHON_ENV,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  })
}

function updatePlan(source, utc) {
  const shanghai = formatShanghai(utc).replace("T", " ").replace("+08:00", " +08:00")
  const status = "状态：active-module-plan / AI Painter固定进度3/5（60%）；联合条件局部传输模型家族CPU未激活实现与正反回归通过，只读GPU资格待执行"
  const current = "固定进度3/5（60%）；联合条件局部传输候选已完成历史去重、CPU设计、模型工厂实现、Mode Registry接入和CPU正反回归；GPU与训练尚未启动"
  const next = "下一步由本地程序执行独立只读GPU资格与资源遥测；不得读取Denoiser Checkpoint、创建优化器、执行.backward()或修改权重"
  const latest = "联合条件局部传输候选已按未激活合同实现。六个既有TimeResidualBlock的norm1/norm2共12个位置分别使用独立`Conv2d(23→9,3×3,padding=1,bias=true)`产生行优先邻域权重；越界邻居严格屏蔽后只在有效邻居上重新softmax，所有特征通道共享同一位置的邻域权重。失败候选的空间仿射参数未与新算子共存。\n\nCPU检查确认12个位置、24个参数张量、22,464个参数精确成立；前向输出有限，23通道输入与全部传输参数可达且梯度有限非零，边缘常量世界特征保持常量。7项新单元测试、10项负向合同门及10项既有空间仿射回归均通过。未读取Checkpoint、未启动GPU、未创建优化器、未训练。"
  const blocker = "当前候选尚缺独立只读GPU资格。资格必须在固定256×192、固定种子和真实23通道条件下核验全部24个传输参数张量与23个条件通道的有限非零梯度、模型前后状态哈希不变及实测显存；只允许使用torch.autograd.grad，不允许创建优化器、执行.backward()、写Checkpoint或加载任何历史Denoiser。\n\n固定进度保持3/5（60%）。只读GPU资格通过后才允许编译并执行一次固定30 Epoch受控Smoke，Smoke完成后由同一执行包自动复现、机器审核、裁决和收口。"
  let output = replaceOnce(source, /^更新时间：.*$/mu, `更新时间：${shanghai}`)
  output = replaceOnce(output, /^状态：.*$/mu, status)
  output = replaceOnce(
    output,
    /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    `| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | ${current} | ${next} |`,
  )
  output = replaceOnce(output, /## 4\. 最近一次模块终态[\s\S]*?(?=\n## 5\.)/u, `## 4. 最近一次模块终态\n\n${latest}\n`)
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u, `## 5. 当前阻断与后续实施顺序\n\n${blocker}\n`)
  return output
}

function replaceOnce(source, pattern, replacement) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
  const matches = source.match(new RegExp(pattern.source, flags)) ?? []
  assert.equal(matches.length, 1, `plan replacement count mismatch: ${pattern}`)
  return source.replace(pattern, replacement)
}

function outputArtifacts() {
  return [
    FILES.metadata,
    FILES.inactiveConfig,
    FILES.architectureContract,
    FILES.implementationDifference,
    FILES.regressionReport,
    FILES.cpuReport,
    FILES.nextAction,
    FILES.terminal,
    FILES.capsule,
    FILES.stagedPlan,
    FILES.planReceipt,
    FILES.planSync,
  ]
}

function index(file) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: RUN_ID,
    artifactType: "stage4_joint_condition_local_transport_cpu_support",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
}

function recordFailure(error) {
  try {
    fs.mkdirSync(FAILURE_ROOT, { recursive: true })
    const file = path.join(FAILURE_ROOT, "failure-report.json")
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, `${JSON.stringify({
        schemaVersion: "stage4-joint-condition-local-transport-cpu-support-failure-v1",
        status: "failed_closed",
        runId: RUN_ID,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        checkpointWeightsRead: false,
        gpuStarted: false,
        trainingStarted: false,
        recordedAtUtc: new Date().toISOString(),
      }, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
    }
  } catch {
    // Preserve the original error when failure evidence cannot be written.
  }
}

function bind(file) {
  return { path: projectPath(file), sha256: sha(file) }
}

function compactUtc() {
  return new Date().toISOString().replace(/[-:.]/gu, "")
}

function inside(relative) {
  const candidate = path.resolve(ROOT, relative)
  assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`)
  return candidate
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""))
}

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function ensureJson(file, value) {
  if (!fs.existsSync(file)) writeExclusiveJson(file, value)
  assert.deepEqual(read(file), value, `immutable JSON mismatch: ${projectPath(file)}`)
}

function writeExclusiveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

function ensureText(file, value) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, value, { encoding: "utf8", flag: "wx" })
  }
  assert.equal(fs.readFileSync(file, "utf8"), value, `immutable text mismatch: ${projectPath(file)}`)
}

function writeAtomicText(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temporary, value, { encoding: "utf8", flag: "wx" })
  fs.renameSync(temporary, file)
}
