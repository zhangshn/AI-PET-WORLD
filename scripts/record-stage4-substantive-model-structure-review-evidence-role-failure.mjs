import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const AUTHORIZATION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-substantive-model-structure-review-20260822-172647827/authorization.json"
const AUTHORIZATION_SHA256 = "152c4998bb36e701c04c3757114248c04480d0cf83a50340b4a72b88b7c8a983"
const CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-substantive-model-structure-review-20260822-172647827/consumption.json"
const OUTPUT = ".runtime/ai-painter/stage4-substantive-model-structure-reviews/20260822-172647827"
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const writeTextAtomic = (target, content) => {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const descriptor = fs.openSync(temp, "wx")
  try { fs.writeFileSync(descriptor, content, "utf8"); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }
  fs.renameSync(temp, target)
}

const authorizationPath = path.resolve(ROOT, AUTHORIZATION)
const consumptionPath = path.resolve(ROOT, CONSUMPTION)
const output = path.resolve(ROOT, OUTPUT)
assert.equal(sha(authorizationPath), AUTHORIZATION_SHA256, "authorization_sha_changed")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.requestId, consumption.requestId)
assert.equal(consumption.status, "cpu_readonly_structure_review_authorization_atomically_consumed")
assert.equal(authorization.outputNamespace, OUTPUT)
assert.equal(fs.existsSync(output), false, "failed_output_namespace_unexpectedly_exists")
const gpuReport = read(path.resolve(ROOT, authorization.sourceEvidence.multisampleGpuReport.path))
assert.equal(Object.hasOwn(gpuReport, "conditionReachability"), false, "failure_cause_no_longer_reproduces")

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = {
  report: path.join(output, "failure-report.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-substantive-model-structure-review-evidence-role-failure-report-v1",
  status: "cpu_structure_review_failed_closed",
  errorCode: "multisample_condition_reachability_evidence_role_mismatch",
  message: "The checker fixture placed conditionReachability in the GPU report, but the immutable real evidence stores it in the multisample analysis report. The runner therefore rejected undefined evidence after consuming the one-time CPU authorization.",
  impact: {
    substantiveDecisionFormed: false,
    architectureContractGenerated: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  },
  correctionBoundary: {
    bindMultisampleAnalysisAsIndependentEvidenceRole: true,
    validateConditionReachabilityFromAnalysisOnly: true,
    keepGpuCapacityEvidenceInGpuReport: true,
    reuseAuthorizationAllowed: false,
    automaticRetryAllowed: false,
  },
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  gpuReport: authorization.sourceEvidence.multisampleGpuReport,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBefore = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4实质模型结构CPU审查执行因多样本条件可达性证据字段角色绑定错误失败关闭，未形成结构裁决；下一业务门为有界修正证据角色并使用全新一次性CPU授权重审")
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-substantive-model-structure-review-failure-plan-sync-v1", status: "unique_plan_synchronized", planPath: relative(planPath), beforeSha256: planBefore, afterSha256: sha(planPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-substantive-model-structure-review-failure-terminal-v1",
  status: "stage4_substantive_model_structure_review_evidence_role_failed_closed",
  errorCode: "multisample_condition_reachability_evidence_role_mismatch",
  failureReport: bind(files.report),
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  planSync: bind(files.planSync),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  automaticRetryStarted: false,
  nextLegalAction: "new_cpu_authorization_after_multisample_analysis_evidence_role_binding_correction",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  currentStage: "Stage4 substantive model structure review evidence role failure",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal),
  failure: bind(files.report),
  nextLegalAction: "correct_evidence_role_then_new_cpu_authorization",
  recordedAtUtc: now,
})
for (const target of Object.values(files)) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_substantive_model_structure_review_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-substantive-model-structure-review-failure-${authorization.runId}`,
  timestamp: now,
  action: "stage4_substantive_model_structure_review",
  runId: authorization.runId,
  kind: "cpu_readonly_structure_review",
  status: "failed",
  title: "Stage4 structure review failed on evidence role mismatch",
  titleZh: "Stage4模型结构审查因证据字段角色绑定错误失败关闭",
  detailZh: "一次性CPU授权已消费；conditionReachability实际属于多样本分析报告而非GPU报告。未读取Checkpoint、未启动GPU或训练，未形成结构裁决。",
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: read(files.terminal).status, terminal: bind(files.terminal), failureReport: bind(files.report), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
