import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  normalizeOwnerActionRequest,
  sha256File,
} from "./lib/ai-painter-local-governance.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/owner-action-requests"
const inputPath = argumentValue("--input")
if (!inputPath) throw new Error("--input is required")

const absoluteInputPath = resolveInsideRoot(inputPath)
const input = JSON.parse(fs.readFileSync(absoluteInputPath, "utf8"))
const record = normalizeOwnerActionRequest(input, { root: ROOT })
const runId = record.requestId

appendAiPainterProgramEvent({
  action: "record_ai_painter_owner_action_request",
  runId,
  kind: "owner_action_request_recording_started",
  status: "running",
  title: "Local AI Painter owner action request recording started",
  titleZh: "本地 AI Painter 项目所有者动作请求记录已开始",
  detail: `requestId=${record.requestId}; status=${record.status}; blocker=${record.blockingReasonCode}`,
  detailZh: `请求ID=${record.requestId}；状态=${record.status}；阻断=${record.blockingReasonCode}`,
  script: projectPath(import.meta.filename),
  currentStep: "persist_local_owner_action_request",
  evidencePath: projectPath(absoluteInputPath),
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "request.json",
  record,
  latest: {
    requestId: record.requestId,
    subsystem: record.subsystem,
    blockingReasonCode: record.blockingReasonCode,
    ownerFacingMessageZh: record.ownerFacingMessageZh,
    generatedBy: record.generatedBy,
    externalEmployeeDecisionAuthority: false,
  },
})

const requestSha256 = sha256File(path.resolve(ROOT, stored.runPath))
appendAiPainterProgramEvent({
  action: "record_ai_painter_owner_action_request",
  runId,
  kind: "owner_action_request_recorded",
  status: "success",
  title: "Local AI Painter owner action request recorded",
  titleZh: "本地 AI Painter 项目所有者动作请求已记录",
  detail: `requestId=${record.requestId}; status=${record.status}; localSystemOfRecord=true; externalEmployeeDecisionAuthority=false`,
  detailZh: record.ownerFacingMessageZh,
  script: projectPath(import.meta.filename),
  currentStep: record.status,
  evidencePath: stored.runPath,
  nextAction: record.nextActionAfterAuthorization.join(","),
  nextActionZh: record.minimumRequestedActionZh,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  status: record.status,
  requestId: record.requestId,
  requestPath: stored.runPath,
  requestSha256,
  localSystemOfRecord: true,
  externalEmployeeDecisionAuthority: false,
}, null, 2))

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function resolveInsideRoot(value) {
  const absolutePath = path.resolve(ROOT, value)
  if (!(absolutePath === ROOT || absolutePath.startsWith(`${ROOT}${path.sep}`))) {
    throw new Error(`path escapes project root: ${value}`)
  }
  return absolutePath
}
