import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const packageId = arg("--package-id")
const recordRunId = arg("--run-id")
assert.match(packageId ?? "", /^stage4-isolated-responsibility-component-gpu-qualification-\d{8}-\d{9}$/)
assert.match(recordRunId ?? "", /^\d{8}-\d{9}$/)
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const roles = [
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
]
const packageManifestPath = absolute(`.runtime/ai-painter/stage4-isolated-responsibility-component-gpu-authorizations/${packageId}/authorization-package.json`)
const packageManifest = JSON.parse(fs.readFileSync(packageManifestPath, "utf8"))
assert.equal(packageManifest.packageId, packageId)
assert.deepEqual(packageManifest.executionOrder, roles)
const results = packageManifest.authorizations.map((authorization, index) => {
  assert.equal(authorization.roleId, roles[index])
  const output = absolute(authorization.outputDirectory)
  const terminalPath = path.join(output, "phase-terminal.json")
  const reportPath = path.join(output, "gpu-report.json")
  const outputIdentityPath = path.join(output, "output-identity.json")
  const consumptionPath = absolute(authorization.consumptionPath)
  for (const target of [terminalPath, reportPath, outputIdentityPath, consumptionPath]) assert.equal(fs.existsSync(target), true)
  const terminal = JSON.parse(fs.readFileSync(terminalPath, "utf8"))
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))
  assert.equal(terminal.status, "isolated_responsibility_component_readonly_gpu_qualification_succeeded")
  assert.equal(report.status, terminal.status)
  assert.equal(report.qualificationPackageId, packageId)
  assert.equal(report.roleId, roles[index])
  assert.equal(report.stateHashes.denoiserUnchanged, true)
  assert.equal(report.stateHashes.autoencoderUnchanged, true)
  assert.equal(report.safety.optimizerCreated, false)
  assert.equal(report.safety.backwardExecuted, false)
  assert.equal(report.safety.modelWeightsModified, false)
  assert.equal(report.safety.checkpointWritten, false)
  assert.equal(report.safety.smokeStarted, false)
  assert.equal(report.safety.trainingStarted, false)
  assert.equal(report.sampleEvidence.every((row) => row.inputGradientFiniteNonZero && row.conditionGradientFiniteNonZero && row.parameterGradientsFinite && row.parameterGradientNonZeroTensorCount > 0 && row.approvedObjectMasksUnchanged), true)
  if (index > 0) {
    assert.equal(report.predecessor.roleId, roles[index - 1])
    assert.equal(report.predecessor.terminalPath, packageManifest.authorizations[index - 1].outputDirectory + "/phase-terminal.json")
  }
  return { roleId: roles[index], terminal: bind(terminalPath), report: bind(reportPath), outputIdentity: bind(outputIdentityPath), cudaTelemetry: bind(path.join(output, "cuda-telemetry.json")), gradientEvidence: bind(path.join(output, "condition-and-gradient-evidence.json")), parameterNamespaceIdentity: bind(path.join(output, "parameter-namespace-identity.json")), modelStateHashes: bind(path.join(output, "model-state-hashes.json")), nativeRgbResourceBoundary: bind(path.join(output, "native-rgb-resource-boundary.json")), consumption: bind(consumptionPath) }
})
const namespaceValues = results.map((result) => JSON.parse(fs.readFileSync(absolute(result.parameterNamespaceIdentity.path), "utf8")).namespace)
assert.equal(new Set(namespaceValues).size, 3)
const output = absolute(`.runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualification-successes/${recordRunId}`)
assert.equal(fs.existsSync(output), false)
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = {
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "controlled-three-component-stage0-smoke-owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "waiting_owner_authorization",
  requestedAction: "compile_controlled_three_component_stage0_smoke_only",
  responsibilityOrder: roles,
  boundQualificationPackage: bind(packageManifestPath),
  boundRoleTerminals: results.map((value) => ({ roleId: value.roleId, terminal: value.terminal })),
  automaticSmokeStartAuthorized: false,
  forbiddenActions: ["create_optimizer", "backward", "modify_weights", "write_checkpoint", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "training"],
  recordedAtUtc: now,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-three-isolated-responsibility-component-readonly-gpu-qualification-terminal-v1",
  status: "stage4_three_isolated_responsibility_component_readonly_gpu_qualification_succeeded",
  qualificationPackage: bind(packageManifestPath),
  executionOrder: roles,
  components: results,
  parameterNamespacesPairwiseDistinct: true,
  samePackagePredecessorLineageVerified: true,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  safety: { optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, checkpointWritten: false, smokeStarted: false, trainingStarted: false },
  nextLegalAction: "compile_controlled_three_component_stage0_smoke_only",
  ownerActionRequest: bind(files.owner),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 three isolated responsibility components readonly GPU qualification passed",
  latestTerminal: bind(files.terminal),
  nextLegalAction: "compile_controlled_three_component_stage0_smoke_only",
  smokeStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
})
const planPath = absolute("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4分阶段完整地图三个责任隔离组件CPU支持及独立只读GPU资格均已通过；尚未编译或启动受控Smoke，未训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true)
const bullet = "- Stage4分阶段完整地图三个责任隔离组件的独立只读GPU资格均已通过：地形、对象、最终视觉三个组件的参数命名空间相互隔离，23通道条件到12通道潜变量的输入与参数梯度有限非零；对象掩码未变化，只有最终组件能够经冻结Autoencoder原生解码完整RGB，三组件及Autoencoder状态前后不变。下一步只允许编译一个受控三组件Stage 0 Smoke合同，不得自动启动Smoke。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(temporary, plan, "utf8")
fs.renameSync(temporary, planPath)
writeJsonAtomic(files.planSync, {
  schemaVersion: "stage4-three-isolated-responsibility-component-gpu-success-plan-sync-v1",
  status: "unique_plan_synchronized",
  planPath: relative(planPath),
  beforeSha256: before,
  afterSha256: sha(planPath),
  terminal: bind(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
for (const target of [packageManifestPath, ...results.flatMap((row) => Object.values(row).filter((value) => value && value.path).map((value) => absolute(value.path))), ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: recordRunId, artifactType: "stage4_isolated_responsibility_component_readonly_gpu_qualification", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-isolated-responsibility-component-gpu-success-${recordRunId}`,
  timestamp: now,
  action: "stage4_three_isolated_responsibility_component_readonly_gpu_qualification",
  runId: recordRunId,
  kind: "readonly_gpu_qualification",
  status: "success",
  title: "Stage4 three isolated responsibility components readonly GPU qualification passed",
  titleZh: "Stage4三个责任隔离组件只读GPU资格通过",
  detailZh: "三个组件依序通过独立参数、条件到达、梯度、前序输出身份和状态冻结验证；未启动Smoke或训练。",
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "stage4_three_isolated_responsibility_component_readonly_gpu_qualification_succeeded", terminal: bind(files.terminal), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule), planSync: bind(files.planSync), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2))
