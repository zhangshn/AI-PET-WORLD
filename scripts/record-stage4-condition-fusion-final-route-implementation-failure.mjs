import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const root = process.cwd()
const runId = "20260823-083509992"
const output = path.resolve(root, `.runtime/ai-painter/stage4-condition-fusion-stage0-final-route-adjudications/${runId}`)
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(root, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const target = path.join(output, "failure-report.json")
if (fs.existsSync(target)) throw new Error("failure_report_already_exists")
const now = new Date().toISOString()
writeJsonAtomic(target, {
  schemaVersion: "stage4-condition-fusion-final-route-implementation-failure-v1",
  status: "cpu_implementation_failed_closed",
  errorCode: "historical_failed_closed_status_alias_not_normalized",
  error: "The ten historical package states use scoped statuses ending in _failed_closed; the implementation incorrectly required the literal failed_closed.",
  effect: "CPU route execution stopped before lineage or continuation-plan compilation.",
  authorizationConsumption: bind(path.resolve(root, ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-condition-fusion-stage0-final-route-20260823-083509992/consumption.json")),
  checkpointWeightsRead: false, ownerPrivateKeyRead: false, gpuStarted: false, trainingStarted: false,
  retryUsingConsumedAuthorizationAllowed: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
appendAiPainterProgramEvent({ id: `stage4-condition-fusion-final-route-implementation-failure-${runId}`, timestamp: now, action: "stage4_condition_fusion_final_route_implementation", runId, kind: "cpu_implementation_failure", status: "failed", title: "Final-route governance status normalization failed", titleZh: "最终路线治理状态归一化实施失败", detailZh: "十份历史包均已按模块状态失败关闭，但程序错误要求字面值failed_closed；CPU执行停止，未启动GPU或训练，已消费授权不复用。", evidencePath: rel(target), evidenceSha256: sha(target), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "cpu_implementation_failed_closed", failureReport: bind(target), gpuStarted: false, trainingStarted: false }, null, 2))
