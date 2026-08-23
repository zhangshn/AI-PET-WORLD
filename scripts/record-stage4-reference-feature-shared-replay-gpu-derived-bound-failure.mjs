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
const progress = path.join(output, "progress.json")
const consumption = path.join(path.dirname(authorizationPath), "gpu-consumption.json")
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: sha(file) })
const now = new Date().toISOString()
const files = { report: path.join(output, "derived-bound-failure-analysis.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-reference-feature-shared-replay-gpu-derived-bound-failure-analysis-v1",
  status: "dtype_rollout_derived_numerical_equivalence_bound_exceeded_closed",
  failureTerminal: bind(terminal), progress: bind(progress), authorization: bind(authorizationPath), consumption: bind(consumption),
  scoreEvidence: { scanWeightedScore: 0.5216711163520813, rerunWeightedScore: 0.5216504335403442, absoluteDifference: 0.000020682811737060547, relativeDifference: 0.00003964722425441224, derivedTolerance: 0.0000059604644775390625, dtype: "torch.float32", dtypeEpsilon: 1.1920928955078125e-7, rolloutSteps: 50, numericallyEquivalent: false },
  executionPosition: { trainRecordsScanned: 48, lastCompletedGradientClass: "tree", nextFormalGradientClassAtFailure: "rock", validationTrajectoriesCompleted: 0 },
  causalStatus: "requires_cpu_readonly_path_difference_adjudication",
  requiredAdjudication: "Determine whether no-grad full rollout and five-tail-step differentiable rerun use identical seed, sample, model mode, latent, timestep sequence and decoded-RGB computation identity, or whether a real execution-path dependency exceeds the formal dtype-derived bound.",
  safety: { optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, checkpointWritten: false, trainingStarted: false },
  automaticRetryStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 reference-feature shared replay readonly GPU qualification failed at formal derived score-equivalence bound", latestTerminal: bind(terminal), failureAnalysis: bind(files.report), nextLegalAction: "owner_authorize_cpu_readonly_no_grad_vs_differentiable_rollout_identity_adjudication", recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const planPath = path.join(ROOT, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；参考特征共享回放只读GPU资格完成48条train及footprints/tree梯度后，下一正式类别的扫描与可微重算分数差2.068e-5超过dtype×50步派生上限5.960e-6而失败关闭；未训练或修改权重，validation未执行")
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
const fd = fs.openSync(temporary, "wx")
try { fs.writeFileSync(fd, plan, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.renameSync(temporary, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const file of [authorizationPath, consumption, terminal, progress, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: authorization.runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({ id: `stage4-reference-feature-shared-replay-derived-bound-failure-${authorization.runId}`, timestamp: now, action: "stage4_reference_feature_shared_replay_readonly_gpu_qualification", runId: authorization.runId, kind: "readonly_gpu_qualification_failure", status: "failed", title: "Stage4 reference-feature score exceeded derived equivalence bound", titleZh: "Stage4参考特征分数超过正式派生等价边界", detailZh: "48条train及前两类梯度已完成；下一类无梯度扫描与可微重算差2.068e-5，超过dtype×50步派生上限5.960e-6。未训练或修改权重。", evidencePath: rel(terminal), evidenceSha256: sha(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_reference_feature_shared_replay_derived_bound_failure_recorded", terminal: bind(terminal), failureAnalysis: bind(files.report), consumption: bind(consumption), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
