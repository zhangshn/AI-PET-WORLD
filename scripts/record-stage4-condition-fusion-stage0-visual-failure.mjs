import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const sourceRoot = path.resolve(ROOT, ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-060300000-condition-fusion-stage0")
const files = {
  terminal: [path.join(sourceRoot, "finalization/phase-terminal.json"), "e3457170d3f2879ab89fb376518d4590c3f40ee7d27d8c3fa2e30171b2c7fef4"],
  manifest: [path.join(sourceRoot, "training-output/manifest.json"), "d733bb8949a7c12bb2e3f98d9ef1b89d49c189e262a9b4ae4ff2032d7c4e8bba"],
  machineReview: [path.join(sourceRoot, "training-output/fixed-preview-reviews.json"), "2e15b3dcc0b8d023823d103b13aa459dbb35870f4883a70df49307ba73f0375a"],
  resourceTelemetry: [path.join(sourceRoot, "resource-telemetry.json"), "0268216785b3a73d3d168431ae59edea34e5eac1716a13618c92c9b22e863782"],
}
for (const [name, [file, expected]] of Object.entries(files)) if (!fs.existsSync(file) || sha(file) !== expected) throw new Error(`${name} identity changed`)
const terminal = read(files.terminal[0]); const manifest = read(files.manifest[0]); const review = read(files.machineReview[0]); const telemetry = read(files.resourceTelemetry[0])
if (terminal.status !== "semantic_mixture_stage4_formal_stage_failed_closed" || review.previewPassCount !== 0 || review.previewFailCount !== 6 || manifest.metrics?.length !== 40) throw new Error("Stage 0 failure facts changed")
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-condition-fusion-stage0-visual-failure-records/${runId}`)
if (fs.existsSync(output)) throw new Error("fresh failure record namespace required")
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const timestamp = new Date().toISOString()
const recordPath = path.join(output, "failure-record.json")
writeJsonAtomic(recordPath, {
  schemaVersion: "stage4-condition-fusion-stage0-visual-failure-record-v1",
  status: "stage4_condition_fusion_stage0_real_visual_failure_recorded_closed",
  candidate: "condition_fusion_only_final_direct_residual_23_64_12",
  completedTraining: { epochs: 40, optimizerSteps: 5760, weightsChanged: manifest.modelStateHashEvidence?.weightsChanged === true },
  machineReview: { previewPassCount: 0, previewFailCount: 6, terminalEpoch: 40, terminalIssueCodes: review.reviews.find(row => row.epoch === 40)?.issueCodes ?? [] },
  checkpoint: { identityOnly: true, sha256: manifest.checkpointSha256, weightRead: false, eligibleForReuseOrPromotion: false },
  resourceTelemetry: { sampleCount: telemetry.sampleCount, peakGpuMemoryBytes: telemetry.peakGpuMemoryBytes, preflightMemoryUsedAsTrainingPeak: telemetry.preflightMemoryUsedAsTrainingPeak },
  sourceEvidence: Object.fromEntries(Object.entries(files).map(([name, [file]]) => [name, bind(file)])),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  stage1Started: false, automaticRetry: false,
  nextLegalAction: "cpu_readonly_condition_fusion_stage0_visual_failure_causal_adjudication",
  recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp),
})
const request = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: `owner-action-request-stage4-condition-fusion-stage0-visual-failure-adjudication-${runId}`,
  subsystem: "ai_painter_stage4_condition_fusion_stage0_visual_failure",
  status: "waiting_owner_authorization",
  taskIdentity: { stage: 4, candidate: "condition_fusion_only_final_direct_residual_23_64_12", failedRunId: terminal.runId },
  ownerVisibleConclusionZh: "条件融合优先结构的全新Stage 0已完成40 Epoch，但六张固定预览机器审核0/6通过，Stage 1未启动。",
  localSystemFindingZh: "训练与资源遥测完整；Epoch 40仍存在道路覆盖/边界及四类对象参考语义不匹配。",
  blockingReasonCode: "condition_fusion_stage0_real_visual_failure",
  whyCannotProceedZh: "当前正式结构尚未通过Stage 0视觉资格，失败Checkpoint不可复用或晋级。",
  minimumRequestedActionZh: "授权一次CPU只读因果裁决，区分条件直达融合是否实际改善、多样本容量残余或Checkpoint/审核身份问题。",
  invariants: ["保留原始64份数据", "不读取失败Checkpoint权重", "不修改Loss或审核阈值", "不自动重跑Stage 0"],
  forbiddenActions: ["read_failed_checkpoint_weights", "reuse_failed_checkpoint", "automatic_retry", "start_gpu", "start_stage1", "start_stage2", "lower_thresholds"],
  ownerFacingMessageZh: "本轮已按真实视觉失败关闭；下一步仅允许CPU只读因果裁决。",
  nextActionAfterAuthorization: ["run_cpu_readonly_condition_fusion_stage0_visual_failure_causal_adjudication"],
  evidencePaths: [project(recordPath), ...Object.values(files).map(([file]) => project(file))],
  ownerDecision: { status: "not_yet_authorized", commandRef: "pending_owner_authorization", scope: "cpu_readonly_causal_adjudication_only" },
}, { root: ROOT, sourceEvidencePath: project(recordPath), script: "scripts/record-stage4-condition-fusion-stage0-visual-failure.mjs" })
const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBefore = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(timestamp).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4条件融合优先结构Stage 0已完成40 Epoch但机器审核0/6通过，真实视觉失败关闭；Stage 1未启动")
const anchor = "### 3.2 当前尚未完成的业务门"
if (!plan.includes(anchor)) throw new Error("unique plan anchor missing")
const bullet = `- Stage4条件融合优先结构Stage 0：40 Epoch与5760次优化完整完成，但六张固定预览机器审核0/6通过，真实视觉失败关闭；未启动Stage 1。证据：\`${project(recordPath)}\`。\n`
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
const planSyncPath = path.join(output, "plan-sync-record.json")
writeJsonAtomic(planSyncPath, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", planSha256Before: planBefore, plan: bind(planPath), failureRecord: bind(recordPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
const capsulePath = path.join(output, "local-task-capsule.json")
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", currentStage: "Stage4 condition fusion formal Stage 0 failed visual qualification", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, latestBlocker: "condition_fusion_stage0_real_visual_failure", nextLegalAction: "cpu_readonly_condition_fusion_stage0_visual_failure_causal_adjudication", failureRecord: bind(recordPath), ownerActionRequest: { path: request.requestPath, sha256: request.requestSha256 }, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
appendAiPainterProgramEvent({ action: "stage4_condition_fusion_stage0_visual_failure_recording", runId, kind: "formal_stage0_visual_failure_closed", status: "failed", title: "Stage4 condition fusion Stage 0 visual failure", titleZh: "Stage4条件融合Stage 0真实视觉失败关闭", detailZh: "40 Epoch与5760次优化完成；六张固定预览0/6通过；Stage 1未启动。", evidencePath: project(recordPath), evidenceSha256: sha(recordPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
for (const file of [recordPath, planSyncPath, capsulePath]) { const stat=fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_condition_fusion_stage0_visual_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
console.log(JSON.stringify({ status: read(recordPath).status, failureRecord: bind(recordPath), ownerActionRequest: request, planSync: bind(planSyncPath), capsule: bind(capsulePath) }, null, 2))

function read(file){return JSON.parse(fs.readFileSync(file,"utf8"))}
function sha(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}
function project(file){return path.relative(ROOT,path.resolve(ROOT,file)).replaceAll("\\","/")}
function bind(file){return{path:project(file),sha256:sha(file)}}
function writeTextAtomic(file,value){const temp=`${file}.${process.pid}.${Date.now()}.tmp`;fs.writeFileSync(temp,value,"utf8");fs.renameSync(temp,file)}
