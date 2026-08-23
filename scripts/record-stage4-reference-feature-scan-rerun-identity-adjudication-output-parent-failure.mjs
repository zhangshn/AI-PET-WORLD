import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const runId = "20260822-081109912"
const file = (value) => path.resolve(ROOT, value)
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const authorization = file(`.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-reference-feature-scan-rerun-identity-adjudication-${runId}/authorization.json`)
const consumption = file(`.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-reference-feature-scan-rerun-identity-adjudication-${runId}/consumption.json`)
assert.equal(fs.existsSync(authorization), true, "authorization_missing")
assert.equal(fs.existsSync(consumption), true, "consumption_missing")
assert.equal(JSON.parse(fs.readFileSync(consumption, "utf8")).status, "cpu_readonly_adjudication_authorization_atomically_consumed")
const output = file(`.runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/${runId}`)
assert.equal(fs.existsSync(output), false, "failed_output_must_not_preexist")
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = {
  report: path.join(output, "execution-failure-report.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-reference-feature-scan-rerun-identity-adjudication-execution-failure-v1",
  status: "output_parent_namespace_missing_after_cpu_contract_and_consumption_failed_closed",
  error: { code: "ENOENT", operation: "mkdir", missingParent: ".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications", failedOutputNamespace: `.runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/${runId}` },
  completedBeforeFailure: { sourceBindingsVerified: true, cpuPositivePassed: 5, cpuPositiveTotal: 5, cpuNegativePassed: 9, cpuNegativeTotal: 9, authorizationAtomicallyConsumed: true, formalDecisionWritten: false },
  consumedAuthorization: bind(authorization), consumption: bind(consumption),
  safety: { checkpointWeightsRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, weightsModified: false, trainingStarted: false, automaticGpuRetryStarted: false },
  correction: "The adjudication runner now creates only the registered fixed parent namespace before exclusively creating the fresh runId directory. The consumed authorization remains closed and cannot be reused.",
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-reference-feature-scan-rerun-identity-adjudication-terminal-v1",
  status: "stage4_reference_feature_scan_rerun_identity_adjudication_execution_failed_closed",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  failureReport: bind(files.report), consumedAuthorization: bind(authorization), consumption: bind(consumption),
  formalDecisionFormed: false, automaticRetryStarted: false, gpuStarted: false, trainingStarted: false,
  nextLegalAction: "owner_authorize_new_cpu_readonly_scan_rerun_identity_adjudication_after_output_parent_fix",
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 scan/rerun identity adjudication execution failed before decision write",
  latestTerminal: bind(files.terminal), failureReport: bind(files.report),
  nextLegalAction: "owner_authorize_new_cpu_readonly_scan_rerun_identity_adjudication_after_output_parent_fix",
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_not_changed_execution_failure_only", plan: bind(file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const target of [authorization, consumption, ...Object.values(files)]) { const stat = fs.statSync(target); indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId, artifactType: "stage4_reference_feature_scan_rerun_identity_adjudication_execution_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) }) }
appendAiPainterProgramEvent({ id: `stage4-reference-feature-scan-rerun-identity-adjudication-output-parent-failure-${runId}`, timestamp: now, action: "stage4_reference_feature_scan_rerun_identity_adjudication", runId, kind: "cpu_readonly_adjudication_execution_failure", status: "failed", title: "Stage4 adjudication output parent missing", titleZh: "Stage4裁决输出父目录缺失，执行失败关闭", detailZh: "CPU正向5/5和反向9/9已通过且授权已消费，但正式裁决落盘前因固定父目录不存在而停止；GPU、Checkpoint与训练未启动。", evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: JSON.parse(fs.readFileSync(files.terminal, "utf8")).status, terminal: bind(files.terminal), failureReport: bind(files.report), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
