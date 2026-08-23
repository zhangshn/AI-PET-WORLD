import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const runId = "20260823-045600000"
const output = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudication-failures", runId)
if (fs.existsSync(output)) throw new Error("failure output already exists")
fs.mkdirSync(output, { recursive: true })
const authorization = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-cross-arm-adjudication-20260823-045600000/implementation-authorization.json")
const consumption = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-cross-arm-adjudication-20260823-045600000/implementation-consumption.json")
const now = new Date().toISOString()
const report = path.join(output, "failure-report.json")
const terminal = path.join(output, "phase-terminal.json")
const capsule = path.join(output, "local-task-capsule.json")
writeJsonAtomic(report, { schemaVersion: "stage4-controlled-structure-cross-arm-output-parent-failure-v1", status: "cross_arm_adjudication_output_parent_missing_failed_closed", errorCode: "fixed_parent_namespace_missing", error: "ENOENT while immutably creating the new runId directory because the fixed parent namespace did not exist", effects: { authorizationConsumed: true, adjudicationOutputCreated: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, sourceEvidenceModified: false }, authorization: bind(authorization), consumption: bind(consumption), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(terminal, { schemaVersion: "stage4-controlled-structure-cross-arm-adjudication-failure-terminal-v1", status: "stage4_controlled_structure_cross_arm_adjudication_failed_closed", blocker: "fixed_parent_namespace_missing", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, report: bind(report), automaticRetryStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", currentStage: "Stage4 cross-arm CPU adjudication output parent repair", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, latestBlocker: "fixed_parent_namespace_missing", nextLegalAction: "use_fresh_authorization_and_run_id_after_parent_creation_fix", terminal: bind(terminal), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const file of [report, terminal, capsule]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_controlled_structure_cross_arm_adjudication_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash(file) }) }
appendAiPainterProgramEvent({ id: `stage4-controlled-structure-cross-arm-parent-failure-${runId}`, timestamp: now, action: "stage4_controlled_structure_cross_arm_adjudication", runId, kind: "cpu_readonly_adjudication", status: "failed", title: "Stage4 cross-arm adjudication output parent failure", titleZh: "Stage4跨臂裁决父目录失败", detailZh: "授权已消费但裁决输出未创建；未读取Checkpoint、未启动GPU或训练，必须使用全新授权和runId。", evidencePath: relative(terminal), evidenceSha256: hash(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(terminal).status, terminal: bind(terminal), report: bind(report) }, null, 2))
function relative(value) { return path.relative(ROOT, value).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function hash(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function bind(value) { return { path: relative(value), sha256: hash(value) } }
