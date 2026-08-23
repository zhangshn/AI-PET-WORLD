import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { CAPACITY_ARM, OWNER_ROUTE_OPTIONS, validateCapacityRouteExitEvidence, validateProjectRouteDecisionRequest } from "./lib/ai-painter-stage4-capacity-route-exit-project-route-decision.mjs"
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
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-capacity-route-exit-project-route-decision-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_capacity_route_exit_and_project_level_owner_route_decision_request_only")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`); assert.equal(/\.pt$/iu.test(evidence.path), false, `${name}_checkpoint_read_forbidden`) }
const programs = { runner: file("scripts/run-stage4-capacity-route-exit-project-route-decision.mjs"), checker: file("scripts/check-stage4-capacity-route-exit-project-route-decision.mjs"), decisionLibrary: file("scripts/lib/ai-painter-stage4-capacity-route-exit-project-route-decision.mjs") }
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = file(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")
const check = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
const e = authorization.sourceEvidence
validateCapacityRouteExitEvidence({ reviewTerminal: read(file(e.reviewTerminal.path)), machineReview: read(file(e.machineReview.path)), cpuReport: read(file(e.cpuReport.path)), ownerRequest: read(file(e.ownerRequest.path)), stage0Terminal: read(file(e.stage0Terminal.path)), stage0Manifest: read(file(e.stage0Manifest.path)) })
const consumedAtUtc = new Date().toISOString()
freshJson(consumptionPath, { schemaVersion: "stage4-capacity-route-exit-project-route-decision-consumption-v1", status: "stage4_capacity_route_exit_project_route_decision_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: authorizationArg, authorizationSha256, oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) })
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = { exit: path.join(output, "capacity-route-exit.json"), problem: path.join(output, "project-level-problem-report.json"), owner: path.join(output, "owner-route-decision-request.json"), cpu: path.join(output, "cpu-report.json"), terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
writeJsonAtomic(files.exit, { schemaVersion: "stage4-capacity-structure-route-exit-v1", status: "capacity_structure_route_exited_closed", candidate: CAPACITY_ARM, reason: "The immutable best Epoch 37 preview still fails the frozen west road boundary, tree reference semantics, and vegetation reference semantics audits after the 40-Epoch Stage 0 completed.", rerunAllowed: false, smokeAllowed: false, continuationAllowed: false, failedCheckpointReadAllowed: false, failedCheckpointReuseAllowed: false, automaticCandidateGenerationAllowed: false, recordedAtUtc: now })
writeJsonAtomic(files.problem, { schemaVersion: "stage4-project-level-model-route-problem-report-v1", status: "current_validated_structure_routes_exhausted_owner_route_choice_required", fixedFacts: { stage0EpochsCompleted: 40, optimizerStepsCompleted: 5760, bestEpoch: 37, professionalAestheticPassed: true, waterPassed: true, footprintsPassed: true, rockPassed: true, westRoadBoundaryPassed: false, treePassed: false, treeMaskedLumaCorrelation: 0.0479, vegetationPassed: false, vegetationMaskedLumaCorrelation: 0.0309, frozenMinimumMaskedLumaCorrelation: 0.08, stage1Started: false, stage2Started: false }, forbiddenInference: ["failed_preview_pixels_as_training_target", "review_threshold_as_training_target", "automatic_new_model", "free_hyperparameter_selection"], sourceEvidence: e, recordedAtUtc: now })
const ownerDecision = { schemaVersion: "stage4-project-level-model-route-owner-decision-request-v1", status: "owner_project_level_route_decision_required", exitedCandidate: CAPACITY_ARM, question: "Choose exactly one bounded Stage4 project-level route. No option is preselected and no new model or training may start from this request alone.", options: [...OWNER_ROUTE_OPTIONS], selectedOption: null, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, stage1Started: false, stage2Started: false, automaticExpansionAllowed: false, prohibitedActions: authorization.deniedActions, recordedAtUtc: now }
validateProjectRouteDecisionRequest(ownerDecision)
writeJsonAtomic(files.owner, ownerDecision)
writeJsonAtomic(files.cpu, { ...cpu, status: "stage4_capacity_route_exit_project_route_decision_cpu_passed", authorization: bind(authorizationPath), consumption: bind(consumptionPath), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, modelImplemented: false, recordedAtUtc: now })
const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const beforeSha256 = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/mu, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4容量结构已正式退出，全部已验证结构路线耗尽，等待Owner在暂停、新模型家族只读设计或业务范围/生成范式只读审查中作出项目级选择")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = "- Stage4容量结构最佳Epoch 37既有不可变预览已完成独立冻结审核：专业画面、水体、footprints和rock通过，但道路west边界、tree及vegetation真实失败；容量结构路线正式退出，不得重跑、复用失败Checkpoint或进入Stage 1。当前固定进度保持60%，下一步必须由Owner在四个项目级有界选项中选择，程序不得自动扩展路线。"
if (!plan.includes(bullet)) plan = plan.replace(anchor, `${bullet}\n\n${anchor}`)
const tempPlan = `${planPath}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(tempPlan, plan, "utf8"); fs.renameSync(tempPlan, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-capacity-route-exit-project-route-plan-sync-v1", status: "unique_plan_synchronized", uniqueModulePlan: bind(planPath), beforeSha256, capacityRouteExit: bind(files.exit), ownerDecisionRequest: bind(files.owner), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-capacity-route-exit-project-route-decision-terminal-v1", status: "capacity_structure_route_exited_project_level_owner_decision_required", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, capacityRouteExit: bind(files.exit), projectProblemReport: bind(files.problem), ownerRouteDecisionRequest: bind(files.owner), cpuReport: bind(files.cpu), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, stage1Started: false, stage2Started: false, nextLegalAction: "owner_select_exactly_one_project_level_stage4_route_option", recordedAtUtc: now })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", currentStage: "Stage4 capacity route exited; project-level Owner route decision required", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(files.terminal), nextLegalAction: "owner_select_exactly_one_project_level_stage4_route_option", recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-capacity-route-exit-project-route-decision-${authorization.runId}`, timestamp: now, action: "stage4_capacity_route_exit_project_route_decision", runId: authorization.runId, kind: "cpu_readonly_route_exit_and_owner_decision_request", status: "success", title: "Capacity route exited; Owner route decision required", titleZh: "容量结构路线退出，等待Owner项目级路线选择", detailZh: "Epoch 37冻结审核确认道路west边界、tree和vegetation真实失败；容量路线不得重跑，固定进度保持60%，程序未自动选择新路线。", evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "capacity_structure_route_exited_project_level_owner_decision_required", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(files.terminal), routeExit: bind(files.exit), ownerRouteDecisionRequest: bind(files.owner), cpuReport: bind(files.cpu), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false }, null, 2))
