import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  adjudicateStagedArchitecture,
  buildInactiveStagedArchitectureContract,
  STAGED_ARCHITECTURE_DECISIONS,
  validateInactiveStagedArchitectureContract,
} from "./lib/ai-painter-stage4-staged-architecture-design.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const freshJson = (target, body) => { fs.mkdirSync(path.dirname(target), { recursive: true }); const handle = fs.openSync(target, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
const authorizationArg = arg("--authorization"), authorizationSha256 = arg("--authorization-sha256"), consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = file(authorizationArg), consumptionPath = file(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-staged-architecture-design-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_staged_complete_map_architecture_design_only")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
for (const group of [authorization.sourceEvidence, authorization.componentEvidence]) for (const [name, evidence] of Object.entries(group)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`); assert.equal(/\.(pt|pth|ckpt)$/iu.test(evidence.path), false, `${name}_checkpoint_forbidden`) }
const programs = { runner: file("scripts/run-stage4-staged-architecture-design.mjs"), checker: file("scripts/check-stage4-staged-architecture-design.mjs"), decisionLibrary: file("scripts/lib/ai-painter-stage4-staged-architecture-design.mjs") }
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = file(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")
const check = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
const e = authorization.sourceEvidence, c = authorization.componentEvidence
const input = {
  interfaceContract: read(file(e.interfaceContract.path)),
  lineageContract: read(file(e.lineageContract.path)),
  inactiveConfig: read(file(e.inactiveConfig.path)),
  configurationAudit: read(file(e.configurationAudit.path)),
  gatewayText: fs.readFileSync(file(c.gateway.path), "utf8"),
  conditionBuilderText: fs.readFileSync(file(c.conditionBuilder.path), "utf8"),
  factManifestBuilderText: fs.readFileSync(file(c.factManifestBuilder.path), "utf8"),
  modelText: fs.readFileSync(file(c.completeWorldModel.path), "utf8"),
  internalCandidateGeneratorText: fs.readFileSync(file(c.internalCandidateGenerator.path), "utf8"),
  structureFactRouteTerminal: read(file(c.structureFactRouteTerminal.path)),
  semanticRendererRouteTerminal: read(file(c.semanticRendererRouteTerminal.path)),
  uniquePlanText: fs.readFileSync(file(c.uniquePlan.path), "utf8"),
}
const result = adjudicateStagedArchitecture(input)
assert.equal(result.selectedDecision, STAGED_ARCHITECTURE_DECISIONS.B)
const sourceBindings = { interfaceContract: e.interfaceContract, evidenceLineageContract: e.lineageContract, inactiveConfig: e.inactiveConfig, componentEvidence: authorization.componentEvidence }
const inactiveArchitectureContract = buildInactiveStagedArchitectureContract(sourceBindings, result)
validateInactiveStagedArchitectureContract(inactiveArchitectureContract)
const consumedAtUtc = new Date().toISOString()
freshJson(consumptionPath, { schemaVersion: "stage4-staged-architecture-design-consumption-v1", status: "stage4_staged_architecture_design_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: authorizationArg, authorizationSha256, oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) })
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = {
  problem: path.join(output, "problem-report.json"),
  inventory: path.join(output, "existing-component-inventory-audit.json"),
  design: path.join(output, "architecture-design-report.json"),
  decision: path.join(output, "adjudication.json"),
  contract: path.join(output, "inactive-architecture-contract.json"),
  cpu: path.join(output, "cpu-report.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  sync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.problem, { schemaVersion: "stage4-staged-architecture-problem-report-v1", status: "staged_responsibility_interfaces_exist_but_independent_trainable_realization_units_do_not", fixedFacts: { approvedDataCount: 64, split: { train: 48, validation: 8, challenge: 4, regression: 4 }, conditionChannelCount: 23, autoencoderFrozen: true, stage0Stage1Stage2RemainTrainingResolutionStages: true, finalNativeCompleteMap: { width: 1024, height: 768 }, historicStructureFactRouteFailedClosed: true, historicSemanticRendererRouteExited: true }, sourceEvidence: authorization.sourceEvidence, recordedAtUtc: now })
writeJsonAtomic(files.inventory, { schemaVersion: "stage4-existing-component-inventory-audit-v1", status: "completed", components: [
  { responsibility: "authoritative_world_structure_binding", reusable: [c.gateway, c.factManifestBuilder, c.conditionBuilder], sufficiency: "partial_read_only_adapter_support", gaps: ["regionId", "factHash", "manifest_path_sha256", "condition_pack_path_sha256", "independent_success_terminal"] },
  { responsibility: "terrain_route_hydrology_spatial_realization", reusable: [c.terrainPlanBuilder, c.completeWorldModel, c.trainer], sufficiency: "utility_and_historic_internal_branch_only", gaps: ["independent_trainable_spatial_realization", "full_frame_spatial_artifact", "independent_success_terminal"], historicalRoute: c.structureFactRouteTerminal },
  { responsibility: "per_class_object_semantic_realization", reusable: [c.completeWorldModel, c.trainer], sufficiency: "historic_internal_readouts_only", gaps: ["independent_trainable_object_semantic_realization", "mask_preserving_full_frame_artifact", "independent_success_terminal"], historicalRoute: c.semanticRendererRouteTerminal },
  { responsibility: "global_visual_harmonization_and_native_complete_rgb_decode", reusable: [c.completeWorldModel, c.internalCandidateGenerator], sufficiency: "frozen_decode_and_review_boundary_only", gaps: ["independent_trainable_global_harmonization", "native_1024x768_generation_without_upscale", "independent_success_terminal"], runtimeConflict: "current_candidate_generator_resizes_selected_source_to_1024x768_with_nearest" },
], existingComponentsMayBeExecutionSource: false, existingComponentsMayBeReadOnlyDesignEvidence: true, recordedAtUtc: now })
writeJsonAtomic(files.design, { schemaVersion: "stage4-staged-complete-map-architecture-design-report-v1", status: "bounded_new_trainable_component_family_design_required", selectedDecision: result.selectedDecision, decisionCode: result.decisionCode, provenFacts: result.provenFacts, rationale: result.rationale, phaseDesign: inactiveArchitectureContract.phases, noModelNameGenerated: true, noStructureDimensionSelected: true, noFreeParameterSelected: true, implementationAuthorized: false, resourceQualificationAuthorized: false, recordedAtUtc: now })
writeJsonAtomic(files.decision, { schemaVersion: "stage4-staged-architecture-adjudication-v1", status: result.selectedDecision, selectedDecision: result.selectedDecision, decisionCode: result.decisionCode, rationale: result.rationale, alternativesRejected: { [STAGED_ARCHITECTURE_DECISIONS.A]: "independent spatial, object-semantic, and native-final-RGB execution units are absent and historic internal routes are exited", [STAGED_ARCHITECTURE_DECISIONS.C]: "resource qualification is downstream of the missing bounded component-family design", [STAGED_ARCHITECTURE_DECISIONS.D]: "source structure and immutable historic route evidence directly prove the execution-unit gaps" }, recordedAtUtc: now })
writeJsonAtomic(files.contract, { ...inactiveArchitectureContract, recordedAtUtc: now })
writeJsonAtomic(files.cpu, { ...cpu, status: "stage4_staged_architecture_design_cpu_passed", authorization: bind(authorizationPath), consumption: bind(consumptionPath), problemReport: bind(files.problem), componentInventoryAudit: bind(files.inventory), architectureDesignReport: bind(files.design), adjudication: bind(files.decision), inactiveArchitectureContract: bind(files.contract), recordedAtUtc: now })
writeJsonAtomic(files.owner, { schemaVersion: "stage4-bounded-trainable-component-family-design-owner-action-request-v1", status: "owner_authorization_required", requestedAction: "bounded_cpu_readonly_trainable_component_family_design_only", sourceDecision: bind(files.decision), sourceArchitectureContract: bind(files.contract), allowedNextScope: ["derive_component_responsibility_boundaries_from_the_four_phase_contract", "derive_structure_only_from_existing_23_channel_12_latent_and_resolution_contracts", "cpu_positive_negative_contract_regression", "future_qualification_sequence_design"], forbiddenNextScope: ["implement_model", "choose_free_model_name", "choose_free_dimension", "choose_free_parameter", "change_data", "change_loss", "read_checkpoint", "start_gpu", "create_optimizer", "backward", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "training", "formal_inference", "runtime_frame", "enter_world"], recordedAtUtc: now })
const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const beforeSha256 = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/mu, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4分阶段完整地图架构CPU只读审查裁决为需有界新训练组件家族设计，现有权威输入组件仅作适配器和证据；未实施模型或训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = "- Stage4分阶段完整地图架构CPU只读设计已完成：现有WorldFacts、VisualFactManifest和条件包构建器可保留为权威输入适配器；地形空间、对象语义和原生最终RGB三个责任阶段缺少独立可训练执行单元及成功终态，历史结构事实与语义渲染路线已失败关闭/退出，现有运行时候选还存在源图缩放。唯一裁决B：下一步只允许有界新训练组件家族CPU设计，不得直接实施或训练。"
if (!plan.includes(bullet)) plan = plan.replace(anchor, `${bullet}\n\n${anchor}`)
const tempPlan = `${planPath}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(tempPlan, plan, "utf8"); fs.renameSync(tempPlan, planPath)
writeJsonAtomic(files.sync, { schemaVersion: "stage4-staged-architecture-design-plan-sync-v1", status: "unique_plan_synchronized", uniqueModulePlan: bind(planPath), beforeSha256, selectedDecision: result.selectedDecision, architectureContract: bind(files.contract), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-staged-architecture-design-terminal-v1", status: "stage4_bounded_new_trainable_component_family_design_required_closed", selectedDecision: result.selectedDecision, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, problemReport: bind(files.problem), componentInventoryAudit: bind(files.inventory), architectureDesignReport: bind(files.design), adjudication: bind(files.decision), inactiveArchitectureContract: bind(files.contract), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.owner), checkpointWeightsRead: false, modelModified: false, lossModified: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, smokeStarted: false, trainingStarted: false, nextLegalAction: "owner_authorize_bounded_cpu_readonly_trainable_component_family_design_only", recordedAtUtc: now })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", currentStage: "Stage4 staged architecture requires bounded new trainable component-family design", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(files.terminal), nextLegalAction: "owner_authorize_bounded_cpu_readonly_trainable_component_family_design_only", recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-staged-architecture-design-${authorization.runId}`, timestamp: now, action: "stage4_staged_complete_map_architecture_design", runId: authorization.runId, kind: "cpu_readonly_staged_architecture_adjudication", status: "success", title: "Bounded trainable component-family design required", titleZh: "Stage4分阶段架构裁决为需要有界新训练组件家族设计", detailZh: "保留既有权威输入适配器；地形空间、对象语义和原生最终RGB缺少独立执行单元。本轮未实施模型或训练。", evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_bounded_new_trainable_component_family_design_required_closed", selectedDecision: result.selectedDecision, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(files.terminal), problemReport: bind(files.problem), componentInventoryAudit: bind(files.inventory), architectureDesignReport: bind(files.design), adjudication: bind(files.decision), inactiveArchitectureContract: bind(files.contract), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.owner), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, modelImplemented: false }, null, 2))

