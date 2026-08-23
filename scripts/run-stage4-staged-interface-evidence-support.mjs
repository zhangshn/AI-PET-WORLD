import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  buildEvidenceLineageContract,
  buildInactiveConfig,
  buildPhaseInterfaceContract,
  STAGED_COMPLETE_MAP_PHASES,
  validateEvidenceLineageContract,
  validateInactiveConfig,
  validatePhaseInterfaceContract,
} from "./lib/ai-painter-stage4-staged-interface-evidence-support.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const freshJson = (target, body) => { fs.mkdirSync(path.dirname(target), { recursive: true }); const handle = fs.openSync(target, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }

const authorizationArg = arg("--authorization")
const authorizationSha256 = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = file(authorizationArg)
const consumptionPath = file(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-staged-interface-evidence-support-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_inactive_staged_complete_map_interface_and_evidence_boundary_implementation_only")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
  assert.equal(/\.(pt|pth|ckpt)$/iu.test(evidence.path), false, `${name}_checkpoint_read_forbidden`)
}
const programs = {
  runner: file("scripts/run-stage4-staged-interface-evidence-support.mjs"),
  checker: file("scripts/check-stage4-staged-interface-evidence-support.mjs"),
  supportLibrary: file("scripts/lib/ai-painter-stage4-staged-interface-evidence-support.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = file(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")

const sourceContractPath = file(authorization.sourceEvidence.inactiveBusinessTechnicalContract.path)
const sourceContract = read(sourceContractPath)
assert.equal(sourceContract.schemaVersion, "stage4-staged-complete-map-business-technical-contract-v1")
assert.equal(sourceContract.status, "cpu_supported_inactive")
assert.deepEqual(sourceContract.phases.map(({ id }) => id), STAGED_COMPLETE_MAP_PHASES)
assert.equal(sourceContract.businessInvariants.conditionChannelCount, 23)
assert.deepEqual(sourceContract.businessInvariants.finalOutput, { width: 1024, height: 768, nativeCompleteFrame: true })
assert.equal(sourceContract.businessInvariants.tilePatchOrSpriteAssemblyAllowed, false)
assert.equal(sourceContract.freeParametersAllowed, false)
assert.equal(sourceContract.modelNamesDefined, false)
assert.equal(sourceContract.modelImplemented, false)

const check = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)

const sourceBinding = bind(sourceContractPath)
const interfaceContract = buildPhaseInterfaceContract(sourceBinding)
const lineageContract = buildEvidenceLineageContract(sourceBinding)
const inactiveConfig = buildInactiveConfig(sourceBinding)
validatePhaseInterfaceContract(interfaceContract)
validateEvidenceLineageContract(lineageContract)
validateInactiveConfig(inactiveConfig)

const consumedAtUtc = new Date().toISOString()
freshJson(consumptionPath, {
  schemaVersion: "stage4-staged-interface-evidence-support-consumption-v1",
  status: "stage4_staged_interface_evidence_support_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorizationPath: authorizationArg,
  authorizationSha256,
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
})
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = {
  interfaces: path.join(output, "phase-interface-contract.json"),
  lineage: path.join(output, "evidence-lineage-contract.json"),
  config: path.join(output, "inactive-config.json"),
  audit: path.join(output, "configuration-audit.json"),
  cpu: path.join(output, "cpu-report.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  sync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.interfaces, { ...interfaceContract, recordedAtUtc: now })
writeJsonAtomic(files.lineage, { ...lineageContract, recordedAtUtc: now })
writeJsonAtomic(files.config, { ...inactiveConfig, recordedAtUtc: now })
writeJsonAtomic(files.audit, {
  schemaVersion: "stage4-staged-complete-map-inactive-configuration-audit-v1",
  status: "passed",
  exactPhaseOrder: [...STAGED_COMPLETE_MAP_PHASES],
  sameIdentityFieldsAcrossAllPhases: [...interfaceContract.commonExecutionIdentity.requiredFields],
  conditionChannelCount: 23,
  worldFactsModificationAllowed: false,
  approvedObjectMaskModificationAllowed: false,
  finalOutput: { width: 1024, height: 768, nativeCompleteFrame: true, candidateCount: 1 },
  forbiddenOutputMechanisms: ["tile", "patch", "sprite", "local_image_assembly", "low_resolution_upscale", "rule_program_rendering"],
  generationResponsibilityAndTrainingResolutionTaxonomiesDistinct: true,
  activationGateAllFalse: true,
  checkpointWeightsRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  modelWeightsModified: false,
  smokeStarted: false,
  trainingStarted: false,
  sourceEvidence: authorization.sourceEvidence,
  recordedAtUtc: now,
})
writeJsonAtomic(files.cpu, {
  ...cpu,
  status: "stage4_staged_interface_evidence_support_cpu_passed",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  phaseInterfaceContract: bind(files.interfaces),
  evidenceLineageContract: bind(files.lineage),
  inactiveConfig: bind(files.config),
  configurationAudit: bind(files.audit),
  recordedAtUtc: now,
})
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-staged-complete-map-next-owner-action-request-v1",
  status: "owner_authorization_required",
  requestedAction: "bounded_cpu_readonly_staged_complete_map_architecture_design_only",
  sourceInterfaceContract: bind(files.interfaces),
  sourceEvidenceLineageContract: bind(files.lineage),
  sourceInactiveConfig: bind(files.config),
  allowedNextScope: ["derive_bounded_non_trainable_architecture_responsibilities_from_existing_formal_contracts", "cpu_contract_regression", "evidence_boundary_design"],
  forbiddenNextScope: ["define_free_parameters", "implement_trainable_model", "read_checkpoint", "start_gpu", "create_optimizer", "backward", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "training", "formal_inference", "runtime_frame", "enter_world"],
  recordedAtUtc: now,
})

const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const beforeSha256 = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/mu, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4分阶段完整地图四阶段CPU未激活接口与同包前序证据边界已建立，未实施模型或训练；等待有界CPU只读分阶段架构设计授权")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = "- Stage4分阶段完整地图CPU未激活接口建设已完成：四个内部生成责任阶段与Stage 0/1/2训练分辨率阶段严格分离；全链绑定同一worldId、regionId、tick、factHash、VisualFactManifest和23通道条件包，后阶段只接受同包前序成功证据；WorldFacts、批准对象掩码及最终原生1024×768整图边界均保持冻结。本轮未实施模型、未读取Checkpoint、未启动GPU或训练。"
if (!plan.includes(bullet)) plan = plan.replace(anchor, `${bullet}\n\n${anchor}`)
const tempPlan = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(tempPlan, plan, "utf8")
fs.renameSync(tempPlan, planPath)
writeJsonAtomic(files.sync, {
  schemaVersion: "stage4-staged-interface-evidence-support-plan-sync-v1",
  status: "unique_plan_synchronized",
  uniqueModulePlan: bind(planPath),
  beforeSha256,
  phaseInterfaceContract: bind(files.interfaces),
  evidenceLineageContract: bind(files.lineage),
  inactiveConfig: bind(files.config),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-staged-interface-evidence-support-terminal-v1",
  status: "stage4_staged_complete_map_cpu_inactive_interfaces_supported_closed",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  phaseInterfaceContract: bind(files.interfaces),
  evidenceLineageContract: bind(files.lineage),
  inactiveConfig: bind(files.config),
  configurationAudit: bind(files.audit),
  cpuReport: bind(files.cpu),
  ownerActionRequest: bind(files.owner),
  checkpointWeightsRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  modelWeightsModified: false,
  smokeStarted: false,
  trainingStarted: false,
  modelImplemented: false,
  nextLegalAction: "owner_authorize_bounded_cpu_readonly_staged_complete_map_architecture_design_only",
  recordedAtUtc: now,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  currentStage: "Stage4 staged complete-map four-phase CPU inactive interfaces supported",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal),
  nextLegalAction: "owner_authorize_bounded_cpu_readonly_staged_complete_map_architecture_design_only",
  recordedAtUtc: now,
})
appendAiPainterProgramEvent({
  id: `stage4-staged-interface-evidence-support-${authorization.runId}`,
  timestamp: now,
  action: "stage4_staged_complete_map_cpu_inactive_interface_support",
  runId: authorization.runId,
  kind: "cpu_inactive_interface_and_evidence_boundary_implementation",
  status: "success",
  title: "Staged complete-map inactive interfaces supported",
  titleZh: "Stage4分阶段完整地图未激活接口与证据边界已建立",
  detailZh: "四个内部生成责任阶段与Stage 0/1/2训练分辨率阶段已分离；未实施模型、未启动GPU或训练。",
  evidencePath: rel(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: "stage4_staged_complete_map_cpu_inactive_interfaces_supported_closed",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal),
  phaseInterfaceContract: bind(files.interfaces),
  evidenceLineageContract: bind(files.lineage),
  inactiveConfig: bind(files.config),
  configurationAudit: bind(files.audit),
  cpuReport: bind(files.cpu),
  ownerActionRequest: bind(files.owner),
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  modelImplemented: false,
}, null, 2))

