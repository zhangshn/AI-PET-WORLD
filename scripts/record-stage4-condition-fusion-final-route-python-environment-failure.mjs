import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
const root = process.cwd(); const runId = "20260823-083626057"
const output = path.resolve(root, `.runtime/ai-painter/stage4-condition-fusion-stage0-final-route-adjudications/${runId}`)
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(root, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const target = path.join(output, "failure-report.json"); if (fs.existsSync(target)) throw new Error("failure_report_already_exists")
const now = new Date().toISOString()
writeJsonAtomic(target, { schemaVersion: "stage4-condition-fusion-final-route-python-environment-failure-v1", status: "cpu_implementation_failed_closed", errorCode: "system_python_used_instead_of_project_python", error: "Formal CPU regression invoked the system Python, which does not contain the project numpy dependency.", effect: "CPU route execution stopped before plan compilation; the adjudication result and all training evidence remain unchanged.", authorizationConsumption: bind(path.resolve(root, ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-condition-fusion-stage0-final-route-20260823-083626057/consumption.json")), correctionBoundary: "Use the same project-local Python executable already frozen by the formal Stage runner.", checkpointWeightsRead: false, ownerPrivateKeyRead: false, gpuStarted: false, trainingStarted: false, retryUsingConsumedAuthorizationAllowed: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
appendAiPainterProgramEvent({ id: `stage4-condition-fusion-final-route-python-failure-${runId}`, timestamp: now, action: "stage4_condition_fusion_final_route_implementation", runId, kind: "cpu_implementation_failure", status: "failed", title: "Formal CPU check used wrong Python", titleZh: "正式CPU检查错误使用系统Python", detailZh: "系统Python缺少项目依赖；已失败关闭，改用正式Stage运行器相同的项目Python，GPU和训练均未启动。", evidencePath: rel(target), evidenceSha256: sha(target), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "cpu_implementation_failed_closed", failureReport: bind(target), gpuStarted: false, trainingStarted: false }, null, 2))
