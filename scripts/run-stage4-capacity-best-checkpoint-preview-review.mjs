import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { evaluateCapacityBestCheckpointMachineReview, validateCapacityBestCheckpointReviewEvidence } from "./lib/ai-painter-stage4-capacity-best-checkpoint-preview-review.mjs"
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
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-capacity-best-checkpoint-preview-review-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_machine_review_of_existing_immutable_epoch37_checkpoint_bound_preview_only")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`); assert.equal(/\.pt$/iu.test(evidence.path), false, `${name}_checkpoint_read_forbidden`) }
const programs = { runner: file("scripts/run-stage4-capacity-best-checkpoint-preview-review.mjs"), checker: file("scripts/check-stage4-capacity-best-checkpoint-preview-review.mjs"), decisionLibrary: file("scripts/lib/ai-painter-stage4-capacity-best-checkpoint-preview-review.mjs"), normalizer: file("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"), alignmentAuditor: file("scripts/lib/ai-assisted-condition-alignment.mjs"), aestheticAuditor: file("scripts/lib/ai-assisted-professional-aesthetic.mjs") }
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = file(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")
const check = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
const e = authorization.sourceEvidence
const sourceIndex = read(file(e.sourceIndex.path))
const row = validateCapacityBestCheckpointReviewEvidence({ identityTerminal: read(file(e.identityTerminal.path)), identityDecision: read(file(e.identityDecision.path)), identityCpuReport: read(file(e.identityCpuReport.path)), ownerRequest: read(file(e.ownerRequest.path)), manifest: read(file(e.manifest.path)), priorReview: read(file(e.priorReview.path)), sourceIndex, sourcePreview: e.sourcePreview, reproducedPreview: e.reproducedPreview })
assert.equal(row.imagePath, e.referenceRgb.path, "reference_rgb_path_invalid")
assert.equal(row.conditionPackPath, e.conditionPack.path, "condition_pack_path_invalid")

const consumedAtUtc = new Date().toISOString()
freshJson(consumptionPath, { schemaVersion: "stage4-capacity-best-checkpoint-preview-review-consumption-v1", status: "capacity_best_checkpoint_preview_review_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: authorizationArg, authorizationSha256, oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) })
fs.mkdirSync(output, { recursive: true })
const sourcePath = file(e.sourcePreview.path)
const sourceHashBefore = sha(sourcePath)
const normalizedPath = path.join(output, "review-assets", "epoch-037-v7-complete-map-194-seed-20266722-1024x768.png")
const normalized = await normalizePreviewWithWindowsSafeIo({ sourcePath, finalAssetPath: normalizedPath, workRoot: file(".runtime/ai-painter/stage4-capacity-best-checkpoint-review-work"), workId: authorization.runId, epoch: 37 })
const conditionPack = read(file(row.conditionPackPath))
const [aesthetic, alignment] = await Promise.all([
  auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
  auditAiAssistedConditionAlignment({ record: { recordId: `${authorization.runId}-epoch-037`, conditionBinding: { conditionPackPath: row.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: row.classification }, imagePath: normalized.shortOutputPath, referenceImagePath: row.imagePath }),
])
assert.equal(sha(sourcePath), sourceHashBefore, "source_preview_modified")
const verdict = evaluateCapacityBestCheckpointMachineReview({ aesthetic, alignment })
const now = new Date().toISOString()
const files = { report: path.join(output, "machine-review.json"), cpu: path.join(output, "cpu-report.json"), request: path.join(output, "owner-action-request.json"), terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
writeJsonAtomic(files.report, { schemaVersion: "stage4-capacity-best-checkpoint-epoch37-machine-review-v1", status: verdict.status, sourceRunId: "20260823-110753367-capacity-stage0", epoch: 37, sourcePreview: e.sourcePreview, reproducedPreview: e.reproducedPreview, normalizedReviewAsset: bind(normalizedPath), windowsSafeShortPathIo: true, reviewThresholdsChanged: false, passed: verdict.passed, issueCodes: verdict.issueCodes, professionalAesthetic: aesthetic, conditionAlignment: alignment, sourcePreviewModified: false, checkpointWeightsRead: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.cpu, { ...cpu, status: "stage4_capacity_best_checkpoint_preview_review_cpu_passed", authorization: bind(authorizationPath), consumption: bind(consumptionPath), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, sourcePreviewModified: false, recordedAtUtc: now })
writeJsonAtomic(files.request, { schemaVersion: "stage4-capacity-best-checkpoint-review-next-owner-action-request-v1", status: "owner_authorization_required", reviewOutcome: verdict.status, requestedAction: verdict.nextLegalAction, sourceMachineReview: bind(files.report), constraints: { checkpointWeightsRead: false, gpu: false, training: false, previewRegeneration: false, thresholdChange: false, automaticRetry: false }, recordedAtUtc: now })
const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const beforeSha256 = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/mu, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/mu, verdict.passed ? "状态：active-module-plan / AI Painter固定进度3/5（60%）；容量结构Epoch 37最佳Checkpoint既有预览机器审核通过，等待CPU只读Stage 0资格身份最终裁决" : "状态：active-module-plan / AI Painter固定进度3/5（60%）；容量结构Epoch 37最佳Checkpoint既有预览机器审核真实失败，等待容量路线退出与项目级模型路线决策")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = verdict.passed
  ? "- Stage4容量结构Stage 0最佳Epoch 37既有不可变预览已使用冻结正式审核程序独立通过；该结果只补齐最佳Checkpoint审核身份，不自动改写原0/6时间线或启动Stage 1，下一步仅允许CPU只读资格身份最终裁决。"
  : `- Stage4容量结构Stage 0最佳Epoch 37既有不可变预览已使用冻结正式审核程序独立失败，失败项为${verdict.issueCodes.join("、")}；容量路线不得重跑，下一步仅允许路线退出与项目级模型决策。`
if (!plan.includes(bullet)) plan = plan.replace(anchor, `${bullet}\n\n${anchor}`)
const tempPlan = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(tempPlan, plan, "utf8"); fs.renameSync(tempPlan, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-capacity-best-checkpoint-preview-review-plan-sync-v1", status: "unique_plan_synchronized", planPath: rel(planPath), beforeSha256, afterSha256: sha(planPath), reviewOutcome: verdict.status, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, nextLegalAction: verdict.nextLegalAction, recordedAtUtc: now })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-capacity-best-checkpoint-preview-review-terminal-v1", status: verdict.status, passed: verdict.passed, issueCodes: verdict.issueCodes, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, machineReview: bind(files.report), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.request), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, sourcePreviewModified: false, nextLegalAction: verdict.nextLegalAction, recordedAtUtc: now })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 capacity best-checkpoint immutable preview machine review", terminal: bind(files.terminal), nextLegalAction: verdict.nextLegalAction, recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-capacity-best-checkpoint-preview-review-${authorization.runId}`, timestamp: now, action: "stage4_capacity_best_checkpoint_preview_machine_review", runId: authorization.runId, kind: "cpu_machine_review_existing_immutable_preview", status: verdict.passed ? "success" : "failed", title: verdict.passed ? "Capacity Epoch 37 preview passed" : "Capacity Epoch 37 preview failed", titleZh: verdict.passed ? "容量结构Epoch 37最佳预览机器审核通过" : "容量结构Epoch 37最佳预览机器审核失败", detailZh: verdict.passed ? "既有不可变预览通过冻结审核；未读取Checkpoint、未启动训练，等待Stage 0资格身份最终裁决。" : `既有不可变预览真实失败：${verdict.issueCodes.join("、")}；未读取Checkpoint、未启动训练。`, evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: verdict.status, passed: verdict.passed, issueCodes: verdict.issueCodes, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(files.terminal), machineReview: bind(files.report), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.request), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false }, null, 2))
