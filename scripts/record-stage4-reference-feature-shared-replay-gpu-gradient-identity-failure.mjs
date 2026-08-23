import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const authorizationPath = path.resolve(ROOT, process.argv[2])
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
const output = path.resolve(ROOT, authorization.outputNamespace)
const terminal = path.join(output, "phase-terminal.json")
const consumption = path.join(path.dirname(authorizationPath), "gpu-consumption.json")
const progress = path.join(output, "progress.json")
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: sha(file) })
const now = new Date().toISOString()
const files = { report: path.join(output, "failure-analysis.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-reference-feature-shared-replay-gpu-gradient-identity-failure-analysis-v1",
  status: "readonly_gpu_gradient_score_identity_comparison_failed_closed",
  failureTerminal: bind(terminal), authorization: bind(authorizationPath), consumption: bind(consumption), progress: bind(progress),
  failedClass: "footprints", selectedSampleId: "ai-cold-start-v7-v7-capacity-slot-162-grassland-forest-transition-v2",
  detachedScanWeightedScore: 0.4099023640155792, differentiableRerunWeightedScore: 0.40990111231803894,
  absoluteDifference: 0.0000012516975402832031,
  gradientEvidence: { finite: true, insideMaskAbsSum: 0.988886296749115, outsideMaskAbsSum: 0.0, denoiserGradientAbsSum: 165.40612679280457 },
  causalBoundary: "The selected class and sample identity remained bound, and all gradient requirements passed. Failure was caused solely by an implementation-only exact floating-point equality assertion between a no-grad detached scan and a differentiable five-tail-step rerun. The authorized contract requires identity consistency and dtype-derived numerical equivalence, not byte equality across different autograd execution paths.",
  impact: { trainScoreScanCompleted: 48, selectedClassGradientChecksCompleted: 0, validationTrajectoriesCompleted: 0, optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, checkpointWritten: false, trainingStarted: false },
  automaticRetryStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 reference-feature shared replay readonly GPU qualification failed at differentiable score identity assertion", latestTerminal: bind(terminal), failureAnalysis: bind(files.report), nextLegalAction: "owner_authorize_cpu_readonly_dtype_derived_numerical_identity_contract_correction", recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const planPath = path.join(ROOT, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；完整Epoch参考特征共享回放只读GPU资格完成48条train扫描后，在footprints可微重算分数的字节级等式断言失败关闭；类别/样本身份及梯度均有效，未训练或修改权重，validation尚未执行")
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
const fd = fs.openSync(temporary, "wx")
try { fs.writeFileSync(fd, plan, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.renameSync(temporary, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const file of [authorizationPath, consumption, terminal, progress, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: authorization.runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({ id: `stage4-reference-feature-shared-replay-gpu-gradient-identity-failure-${authorization.runId}`, timestamp: now, action: "stage4_reference_feature_shared_replay_readonly_gpu_qualification", runId: authorization.runId, kind: "readonly_gpu_qualification_failure", status: "failed", title: "Stage4 reference-feature shared replay GPU score identity assertion failed", titleZh: "Stage4参考特征共享回放GPU分数身份断言失败", detailZh: "48条train扫描完成；footprints身份未变且梯度有限、掩码内非零、掩码外为零，但无梯度扫描与可微重算相差1.25e-6，被错误的浮点完全等式拒绝。未训练或修改权重。", evidencePath: rel(terminal), evidenceSha256: sha(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_reference_feature_shared_replay_gpu_failure_recorded", terminal: bind(terminal), failureAnalysis: bind(files.report), consumption: bind(consumption), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
