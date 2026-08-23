import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
assert.ok(authorizationArg && authorizationSha, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
assert.equal(shaFile(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-three-class-supervision-identifiability-review-v1")
const consumptionPath = path.join(path.dirname(authorizationPath), "consumption.json")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_was_consumed")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "failure_output_already_exists")
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const report = path.join(output, "failure-report.json")
const terminal = path.join(output, "phase-terminal.json")
const capsule = path.join(output, "local-task-capsule.json")
writeJsonAtomic(report, {
  schemaVersion: "stage4-three-class-supervision-identifiability-failure-report-v1",
  status: "cpu_source_locator_contract_failed_closed",
  errorCode: "reference_feature_replay_bypass_not_proven",
  rootCause: "The immutable trainer contains the expected branch, selected luminance replay call, and terminating continue. The read-only source inspection window was 2600 characters, while continue begins 2709 characters after the branch anchor, so the locator truncated its own evidence.",
  sourceOffsets: { branchAnchor: 626110, selectedLuminanceReplayCall: 627348, terminatingContinue: 628819, replayCallOffset: 1238, continueOffset: 2709, inspectedWindowLength: 2600 },
  impact: "No formal supervision identifiability decision was emitted. The 64-record file audit completed in memory only and was not represented as a passed terminal.",
  authorization: bind(authorizationPath),
  authorizationConsumed: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(terminal, { schemaVersion: "stage4-three-class-supervision-identifiability-terminal-v1", status: "stage4_three_class_supervision_identifiability_cpu_locator_failed_closed", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, failureReport: bind(report), authorization: bind(authorizationPath), authorizationConsumed: false, outputClosed: true, nextLegalAction: "owner_authorize_bounded_cpu_source_locator_fix_and_new_readonly_review", checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 three-class supervision identifiability CPU locator failed closed", latestTerminal: bind(terminal), latestBlocker: "reference_feature_replay_bypass_source_window_truncated", nextLegalAction: "owner_authorize_bounded_cpu_source_locator_fix_and_new_readonly_review", evidence: { failureReport: bind(report), authorization: bind(authorizationPath) }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const target of [authorizationPath, report, terminal, capsule]) { const stat = fs.statSync(target); indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_three_class_supervision_identifiability_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) }) }
appendAiPainterProgramEvent({ id: `stage4-three-class-supervision-identifiability-failure-${authorization.runId}`, timestamp: now, action: "stage4_three_class_supervision_identifiability_review", runId: authorization.runId, kind: "cpu_readonly_design_review", status: "failed", title: "Stage4 supervision source locator failed closed", titleZh: "Stage4监督源码定位窗口失败关闭", detailZh: "正式训练器事实存在，但CPU定位窗口2600字符未覆盖偏移2709处的continue；授权未消费，未读取Checkpoint、未启动GPU或训练。", evidencePath: relative(terminal), evidenceSha256: shaFile(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_three_class_supervision_identifiability_cpu_locator_failed_closed", terminal: bind(terminal), failureReport: bind(report), capsule: bind(capsule), authorizationConsumed: false }, null, 2))
