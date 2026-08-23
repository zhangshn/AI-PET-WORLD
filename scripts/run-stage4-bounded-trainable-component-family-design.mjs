import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateComponentFamily, buildComponentFamilyContract, buildEvidenceIsolationContract, buildFutureQualificationSequence, buildParameterSourceAudit, FAMILY_DECISIONS, validateComponentFamilyContract, validateEvidenceIsolationContract, validateParameterSourceAudit } from "./lib/ai-painter-stage4-bounded-trainable-component-family-design.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
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
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-bounded-trainable-component-family-design-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_bounded_trainable_component_family_design_only")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
for (const group of [authorization.sourceEvidence, authorization.supportingEvidence]) for (const [name, evidence] of Object.entries(group)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`); assert.equal(/\.(pt|pth|ckpt)$/iu.test(evidence.path), false, `${name}_checkpoint_forbidden`) }
const programs = { runner: file("scripts/run-stage4-bounded-trainable-component-family-design.mjs"), checker: file("scripts/check-stage4-bounded-trainable-component-family-design.mjs"), decisionLibrary: file("scripts/lib/ai-painter-stage4-bounded-trainable-component-family-design.mjs") }
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = file(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")
const check = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout); assert.equal(cpu.positivePassed, cpu.positiveTotal); assert.equal(cpu.negativePassed, cpu.negativeTotal)
const e = authorization.sourceEvidence, s = authorization.supportingEvidence
const result = adjudicateComponentFamily({ architectureDecision: read(file(e.architectureDecision.path)), architectureContract: read(file(e.inactiveArchitectureContract.path)), gradientInterferenceTerminal: read(file(s.gradientInterferenceTerminal.path)), sharedStage0Terminals: { conflictAware: read(file(s.conflictAwareStage0Terminal.path)), conditionFusion: read(file(s.conditionFusionStage0Terminal.path)), capacity: read(file(s.capacityStage0Terminal.path)) }, autoencoderTerminal: read(file(s.autoencoderTerminal.path)) })
assert.equal(result.selectedDecision, FAMILY_DECISIONS.A)
const familyContract = buildComponentFamilyContract({ architectureDecision: e.architectureDecision, inactiveArchitectureContract: e.inactiveArchitectureContract, supportingEvidence: authorization.supportingEvidence }, result)
const parameterAudit = buildParameterSourceAudit(), evidenceIsolation = buildEvidenceIsolationContract(), qualificationSequence = buildFutureQualificationSequence()
validateComponentFamilyContract(familyContract); validateParameterSourceAudit(parameterAudit); validateEvidenceIsolationContract(evidenceIsolation)
const consumedAtUtc = new Date().toISOString()
freshJson(consumptionPath, { schemaVersion: "stage4-bounded-trainable-component-family-design-consumption-v1", status: "stage4_bounded_trainable_component_family_design_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: authorizationArg, authorizationSha256, oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) })
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = { report: path.join(output, "component-family-design-report.json"), decision: path.join(output, "adjudication.json"), contract: path.join(output, "inactive-component-family-contract.json"), parameters: path.join(output, "parameter-source-audit.json"), isolation: path.join(output, "evidence-isolation-contract.json"), sequence: path.join(output, "future-qualification-sequence.json"), cpu: path.join(output, "cpu-report.json"), owner: path.join(output, "owner-action-request.json"), terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), sync: path.join(output, "plan-sync-record.json") }
writeJsonAtomic(files.report, { schemaVersion: "stage4-bounded-trainable-component-family-design-report-v1", status: result.selectedDecision, selectedDecision: result.selectedDecision, decisionCode: result.decisionCode, rationale: result.rationale, businessConclusion: "Keep authority binding non-trainable; use three responsibility-isolated trainable parameter namespaces with independent outputs and phase terminals; share only immutable evidence and the frozen Autoencoder boundary.", sharedSubstrateRejectedBecause: ["formal_gradient_interference_gap_confirmed", "conflict_aware_stage0_fixed_review_0_of_6", "condition_fusion_stage0_fixed_review_0_of_6", "capacity_stage0_fixed_review_0_of_6"], implementationAuthorized: false, recordedAtUtc: now })
writeJsonAtomic(files.decision, { schemaVersion: "stage4-bounded-trainable-component-family-adjudication-v1", status: result.selectedDecision, selectedDecision: result.selectedDecision, decisionCode: result.decisionCode, alternativesRejected: { [FAMILY_DECISIONS.B]: "shared trainable substrate has no positive multi-sample Stage 0 evidence and repeats the confirmed gradient-interference boundary", [FAMILY_DECISIONS.C]: "component isolation is determined by evidence boundaries before resource qualification", [FAMILY_DECISIONS.D]: "the three Stage 0 failures and gradient diagnosis are sufficient to select isolation" }, recordedAtUtc: now })
writeJsonAtomic(files.contract, { ...familyContract, recordedAtUtc: now })
writeJsonAtomic(files.parameters, { ...parameterAudit, recordedAtUtc: now })
writeJsonAtomic(files.isolation, { ...evidenceIsolation, recordedAtUtc: now })
writeJsonAtomic(files.sequence, { ...qualificationSequence, recordedAtUtc: now })
writeJsonAtomic(files.cpu, { ...cpu, status: "stage4_bounded_trainable_component_family_design_cpu_passed", authorization: bind(authorizationPath), consumption: bind(consumptionPath), designReport: bind(files.report), adjudication: bind(files.decision), inactiveComponentFamilyContract: bind(files.contract), parameterSourceAudit: bind(files.parameters), evidenceIsolationContract: bind(files.isolation), futureQualificationSequence: bind(files.sequence), recordedAtUtc: now })
writeJsonAtomic(files.owner, { schemaVersion: "stage4-isolated-component-family-cpu-implementation-owner-action-request-v1", status: "owner_authorization_required", requestedAction: "cpu_inactive_three_responsibility_component_family_implementation_only", sourceDecision: bind(files.decision), sourceContract: bind(files.contract), parameterSourceAudit: bind(files.parameters), evidenceIsolationContract: bind(files.isolation), allowedNextScope: ["implement_role_enum_and_three_parameter_isolated_cpu_inactive_components", "compile_three_inactive_configs", "exact_parameter_shape_audit", "cpu_positive_negative_regression"], forbiddenNextScope: ["read_checkpoint", "start_gpu", "create_optimizer", "backward", "modify_weights", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "training", "formal_inference", "checkpoint_promotion", "runtime_frame", "enter_world"], recordedAtUtc: now })
const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"), beforeSha256 = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/mu, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4分阶段训练组件家族CPU设计裁决为三个责任隔离组件，权威输入和冻结Autoencoder保持共享只读；未实施模型或训练")
const anchor = "### 3.2 当前尚未完成的业务门"; assert.equal(plan.includes(anchor), true)
const bullet = "- Stage4有界训练组件家族CPU只读设计已完成：唯一裁决A，权威结构绑定保持非训练；地形空间、对象语义、全局视觉与原生RGB分别使用参数隔离、Checkpoint隔离、终态隔离的责任组件，仅共享不可变条件身份和冻结Autoencoder。全部接口尺寸从既有23通道、12通道潜变量、4倍Autoencoder及64/128/256宽度关系派生；未自由命名、未增加Loss、未实施模型或训练。"
if (!plan.includes(bullet)) plan = plan.replace(anchor, `${bullet}\n\n${anchor}`)
const tempPlan = `${planPath}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(tempPlan, plan, "utf8"); fs.renameSync(tempPlan, planPath)
writeJsonAtomic(files.sync, { schemaVersion: "stage4-bounded-trainable-component-family-design-plan-sync-v1", status: "unique_plan_synchronized", uniqueModulePlan: bind(planPath), beforeSha256, selectedDecision: result.selectedDecision, contract: bind(files.contract), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-bounded-trainable-component-family-design-terminal-v1", status: "stage4_three_responsibility_isolated_trainable_components_required_closed", selectedDecision: result.selectedDecision, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, designReport: bind(files.report), adjudication: bind(files.decision), inactiveComponentFamilyContract: bind(files.contract), parameterSourceAudit: bind(files.parameters), evidenceIsolationContract: bind(files.isolation), futureQualificationSequence: bind(files.sequence), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.owner), checkpointWeightsRead: false, modelSourceModified: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, smokeStarted: false, trainingStarted: false, nextLegalAction: "owner_authorize_cpu_inactive_three_responsibility_component_family_implementation_only", recordedAtUtc: now })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", currentStage: "Stage4 three responsibility-isolated trainable components designed but inactive", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(files.terminal), nextLegalAction: "owner_authorize_cpu_inactive_three_responsibility_component_family_implementation_only", recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-bounded-trainable-component-family-design-${authorization.runId}`, timestamp: now, action: "stage4_bounded_trainable_component_family_design", runId: authorization.runId, kind: "cpu_readonly_component_family_design", status: "success", title: "Three responsibility-isolated trainable components required", titleZh: "Stage4裁决为三个责任隔离训练组件", detailZh: "权威输入保持非训练；三个生成责任参数、Checkpoint、终态和输出隔离。本轮未实施模型或训练。", evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_three_responsibility_isolated_trainable_components_required_closed", selectedDecision: result.selectedDecision, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(files.terminal), designReport: bind(files.report), adjudication: bind(files.decision), inactiveComponentFamilyContract: bind(files.contract), parameterSourceAudit: bind(files.parameters), evidenceIsolationContract: bind(files.isolation), futureQualificationSequence: bind(files.sequence), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.owner), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, modelImplemented: false }, null, 2))

