import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ROOT = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-cold-start", "conditional-rgb-generation-requests")
const POINTER_PATH = path.join(REQUEST_ROOT, "latest.json")
const failureCode = argumentValue("--failure-code")
const failureMessage = argumentValue("--failure-message")
const attemptedRoute = argumentValue("--attempted-route")
const explicitRequestId = argumentValue("--request-id")
assert(failureCode && failureMessage && attemptedRoute, "usage: npm run record:ai-assisted-conditional-rgb-generation-failure -- --failure-code <code> --failure-message <message> --attempted-route <route>")
assert(/^[a-z0-9][a-z0-9_-]{2,95}$/.test(failureCode), "failure-code is invalid")
if (explicitRequestId) assert(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,159}$/.test(explicitRequestId), "request-id is invalid")

const pointer = readJson(POINTER_PATH)
const requestPath = explicitRequestId
  ? path.join(REQUEST_ROOT, explicitRequestId, "request.json")
  : resolveProjectPath(pointer.requestPath)
assert(fs.existsSync(requestPath), `request does not exist: ${explicitRequestId ?? pointer.requestPath}`)
const request = readJson(requestPath)
if (explicitRequestId) assert(request.requestId === explicitRequestId, "request identity mismatch")
assert(request.status === "ready_for_openai_assisted_generation" || request.status === "generation_failed_retryable", `request cannot accept a generation-attempt failure: ${request.status}`)

const timestamp = new Date().toISOString()
const attemptId = `${request.requestId}-attempt-${timestamp.replace(/[:.]/g, "-")}`
const attemptPath = path.join(path.dirname(requestPath), "generation-attempts", `${attemptId}.json`)
const attempt = {
  schemaVersion: "ai-assisted-conditional-rgb-generation-attempt-v1",
  attemptId,
  requestId: request.requestId,
  outputRecordId: request.outputRecordId,
  status: "generation_failed_retryable",
  failureCode,
  failureMessage,
  attemptedRoute,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  promptEvidencePath: request.promptEvidencePath,
  conditionPackPath: request.conditionPackPath,
  generatedImageCreated: false,
  generatedImagePath: null,
  generatedImageSha256: null,
  secretStored: false,
  automaticStorage: true,
  finalGameMapSuccess: false,
  canEnterWorld: false,
}
writeJsonAtomic(attemptPath, attempt)

const ledgerEvent = appendAiPainterProgramEvent({
  action: "record_ai_assisted_conditional_rgb_generation_failure",
  runId: request.requestId,
  kind: "step_failed",
  status: "failed",
  title: "AI-assisted conditional RGB generation attempt failed",
  titleZh: "AI 辅助条件 RGB 生成尝试失败",
  detail: `failureCode=${failureCode}; attemptedRoute=${attemptedRoute}; generatedImageCreated=false`,
  detailZh: `失败码=${failureCode}；尝试路线=${attemptedRoute}；未生成图片`,
  script: "scripts/record-ai-assisted-conditional-rgb-generation-failure.mjs",
  currentStep: "cold_start_rgb_generation",
  error: failureCode,
  errorZh: failureMessage,
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: request.outputRecordId,
  evidencePath: projectPath(attemptPath),
  nextAction: "retry_with_owner_approved_generation_route",
  nextActionZh: "使用项目所有者批准的生成路线重试，并保留本次失败记录。",
})

const updatedRequest = {
  ...request,
  status: "generation_failed_retryable",
  updatedAtUtc: timestamp,
  updatedAtAsiaShanghai: attempt.createdAtAsiaShanghai,
  latestGenerationAttemptPath: projectPath(attemptPath),
  generationAttemptPaths: [...(request.generationAttemptPaths ?? []), projectPath(attemptPath)],
  lastGenerationFailureCode: failureCode,
  generatedImagePath: null,
  generatedImageSha256: null,
  automaticStorage: true,
}
writeJsonAtomic(requestPath, updatedRequest)
writeJsonAtomic(POINTER_PATH, {
  ...pointer,
  status: updatedRequest.status,
  updatedAtUtc: timestamp,
  requestPath: projectPath(requestPath),
  latestGenerationAttemptPath: projectPath(attemptPath),
  lastGenerationFailureCode: failureCode,
  ledgerEventId: ledgerEvent.id,
})

console.log(JSON.stringify({
  status: updatedRequest.status,
  requestId: request.requestId,
  outputRecordId: request.outputRecordId,
  failureCode,
  attemptedRoute,
  attemptPath: projectPath(attemptPath),
  ledgerEventId: ledgerEvent.id,
  generatedImageCreated: false,
  secretStored: false,
  automaticStorage: true,
}, null, 2))

function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`); return resolved }
function assert(condition, message) { if (!condition) throw new Error(message) }
