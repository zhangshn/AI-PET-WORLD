import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateCapacityStage0CheckpointVisualIdentity } from "./lib/ai-painter-stage4-capacity-stage0-checkpoint-visual-identity-adjudication.mjs"
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
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-capacity-stage0-checkpoint-visual-identity-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_capacity_stage0_checkpoint_fixed_review_terminal_visual_identity_adjudication")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`); assert.equal(/\.pt$/iu.test(evidence.path), false, `${name}_checkpoint_read_forbidden`) }
const programs = {
  runner: file("scripts/run-stage4-capacity-stage0-checkpoint-visual-identity-adjudication.mjs"),
  checker: file("scripts/check-stage4-capacity-stage0-checkpoint-visual-identity-adjudication.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-capacity-stage0-checkpoint-visual-identity-adjudication.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = file(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")
const check = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)

const consumedAtUtc = new Date().toISOString()
freshJson(consumptionPath, { schemaVersion: "stage4-capacity-stage0-checkpoint-visual-identity-adjudication-consumption-v1", status: "capacity_stage0_checkpoint_visual_identity_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: authorizationArg, authorizationSha256, oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) })
const e = authorization.sourceEvidence
const decision = adjudicateCapacityStage0CheckpointVisualIdentity({
  terminal: read(file(e.terminal.path)), manifest: read(file(e.manifest.path)), review: read(file(e.review.path)), activeConfig: read(file(e.activeConfig.path)), checkpointPreview: e.checkpointPreview,
  failedCheckpointSha256: authorization.failedCheckpointSha256, directExecutionWiringDefectEvidence: false, bestEpochMachineReviewExists: false, capacityInsufficiencyProvenWithoutBestEpochReview: false,
})
assert.equal(decision.selectedCause, "B")
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = { problem: path.join(output, "problem-report.json"), analysis: path.join(output, "causal-analysis-report.json"), decision: path.join(output, "adjudication.json"), cpu: path.join(output, "cpu-report.json"), request: path.join(output, "owner-action-request.json"), terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
writeJsonAtomic(files.problem, { schemaVersion: "stage4-capacity-stage0-checkpoint-visual-identity-problem-report-v1", status: "problem_confirmed", facts: decision.evidence, sourceEvidence: e, failedCheckpointWeightsRead: false, recordedAtUtc: now })
writeJsonAtomic(files.analysis, { ...decision, sourceEvidence: e, recordedAtUtc: now })
writeJsonAtomic(files.decision, { schemaVersion: "stage4-capacity-stage0-checkpoint-visual-identity-decision-v1", ...decision, recordedAtUtc: now })
writeJsonAtomic(files.cpu, { ...cpu, status: "stage4_capacity_stage0_checkpoint_visual_identity_cpu_passed", authorization: bind(authorizationPath), consumption: bind(consumptionPath), selectedCause: "B", checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now })
writeJsonAtomic(files.request, {
  schemaVersion: "stage4-capacity-stage0-best-checkpoint-preview-machine-review-owner-action-request-v1",
  status: "owner_authorization_required_for_one_existing_preview_machine_review",
  requestedAction: "machine_review_existing_immutable_epoch37_checkpoint_bound_preview_once",
  sourceRunId: "20260823-110753367-capacity-stage0", bestEpoch: 37, preview: e.checkpointPreview,
  constraints: { readCheckpointWeights: false, regeneratePreview: false, startGpu: false, startTraining: false, changeThresholds: false, useHistoricalEvidence: false, automaticRetry: false },
  successNextAction: "compare_epoch37_formal_review_with_epoch30_epoch40_and_close_capacity_route", failureNextAction: "close_capacity_route_or_request_project_level_model_decision", recordedAtUtc: now,
})

const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const beforeSha256 = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/mu, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4容量结构Stage 0训练完成但0/6机器审核失败；最佳Epoch 37未包含在固定审核时间线，等待一次既有不可变预览机器审核授权")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = "- Stage4容量结构Stage 0已完成40 Epoch和5760次优化，但固定审核0/6失败关闭；Manifest选择Epoch 37为最佳Checkpoint且其固定预览已字节复现，现有机器审核只覆盖Epoch 1/5/10/20/30/40。CPU只读裁决唯一选择B：最佳Checkpoint与固定视觉审核身份存在缺口；下一步只允许审核既有Epoch 37不可变预览，不得读取Checkpoint、重新生成预览或训练。"
if (!plan.includes(bullet)) plan = plan.replace(anchor, `${bullet}\n\n${anchor}`)
const tempPlan = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(tempPlan, plan, "utf8"); fs.renameSync(tempPlan, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-capacity-stage0-checkpoint-visual-identity-plan-sync-v1", status: "unique_plan_synchronized", planPath: rel(planPath), beforeSha256, afterSha256: sha(planPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, nextLegalAction: "owner_authorize_one_existing_epoch37_preview_machine_review", recordedAtUtc: now })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-capacity-stage0-checkpoint-visual-identity-terminal-v1", status: "best_checkpoint_and_fixed_visual_review_identity_gap_confirmed", selectedCause: "B", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, adjudication: bind(files.decision), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.request), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, nextLegalAction: "owner_authorize_one_existing_epoch37_preview_machine_review", recordedAtUtc: now })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 capacity Stage 0 best-checkpoint visual identity gap", terminal: bind(files.terminal), nextLegalAction: "one_existing_epoch37_preview_machine_review", recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-capacity-stage0-checkpoint-visual-identity-${authorization.runId}`, timestamp: now, action: "stage4_capacity_stage0_checkpoint_visual_identity_adjudication", runId: authorization.runId, kind: "cpu_readonly_causal_adjudication", status: "success", title: "Capacity Stage 0 best-checkpoint review identity gap confirmed", titleZh: "容量结构Stage 0最佳Checkpoint审核身份缺口已确认", detailZh: "裁决B：最佳Epoch 37已有不可变且字节复现一致的预览，但未进入固定机器审核时间线；下一步仅审核该既有预览，不读取Checkpoint、不训练。", evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(files.terminal).status, selectedCause: "B", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(files.terminal), adjudication: bind(files.decision), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.request), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false }, null, 2))
