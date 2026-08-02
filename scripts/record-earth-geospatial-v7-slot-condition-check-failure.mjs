import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/earth-geospatial-v7-slot-condition-check-failures"
const slotId = argumentValue("--v7-slot-id")
const conditionRunId = argumentValue("--condition-run-id")
const failureCode = argumentValue("--failure-code")
const errorMessage = argumentValue("--error-message")
const failedCommand = argumentValue("--failed-command")

assert(/^v7-capacity-slot-\d{3}$/.test(slotId ?? ""), "--v7-slot-id is required")
assert(conditionRunId?.includes(slotId), "--condition-run-id must match --v7-slot-id")
assert(failureCode, "--failure-code is required")
assert(errorMessage, "--error-message is required")
assert(failedCommand, "--failed-command is required")

const conditionRunPath = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-v7-mvp-slot-condition-runs",
  conditionRunId,
  "complete-map-condition-run.json",
)
assert(fs.existsSync(conditionRunPath), "condition run manifest is missing")
const conditionRun = readJson(conditionRunPath)
assert(conditionRun.runId === conditionRunId, "condition run identity mismatch")
assert(conditionRun.v7SlotId === slotId, "condition run slot identity mismatch")

const checkerPath = path.join(ROOT, "scripts", "check-earth-geospatial-complete-map-conditions.mjs")
const createdAtUtc = new Date().toISOString()
const runId = `earth-geospatial-v7-slot-condition-check-failure-${slotId}-${createdAtUtc.replace(/[:.]/g, "-")}`
const failure = {
  schemaVersion: "earth-geospatial-v7-slot-condition-check-failure-v1",
  runId,
  status: "failed_recorded",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  slotId,
  conditionRunId,
  conditionId: conditionRun.conditionId,
  conditionRunPath: projectPath(conditionRunPath),
  conditionRunSha256: sha256File(conditionRunPath),
  checkerPath: projectPath(checkerPath),
  checkerSha256: sha256File(checkerPath),
  failedCommand,
  processExitCode: 1,
  failureCode,
  errorName: "TypeError",
  errorMessage,
  diagnosisBoundary: {
    existingConditionEvidenceModified: false,
    checkerModified: false,
    businessLogicModified: false,
    reviewThresholdModified: false,
  },
  nextAction: "rebuild_same_slot_with_current_route_and_water_naturalness_evidence_then_recheck",
  imageGenerationStarted: false,
  rgbCreated: false,
  gpuTrainingStarted: false,
  runtimeStarted: false,
  worldPageChanged: false,
  automaticStorage: true,
}
const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "failure.json",
  record: failure,
  latest: {
    slotId,
    conditionRunId,
    conditionId: conditionRun.conditionId,
    failureCode,
  },
})
const event = appendAiPainterProgramEvent({
  action: "record_earth_geospatial_v7_slot_condition_check_failure",
  runId,
  kind: "step_failed",
  status: "failed",
  title: "V7 slot condition independent check failed before completion",
  titleZh: "V7 槽位条件独立检查在完成前失败",
  detail: `slotId=${slotId}; conditionRunId=${conditionRunId}; failureCode=${failureCode}; error=${errorMessage}`,
  detailZh: `槽位=${slotId}；条件运行=${conditionRunId}；失败码=${failureCode}；错误=${errorMessage}`,
  script: "scripts/record-earth-geospatial-v7-slot-condition-check-failure.mjs",
  currentStep: "condition_independent_check_failure_recorded",
  error: errorMessage,
  errorZh: errorMessage,
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: slotId,
  evidencePath: written.runPath,
  nextAction: failure.nextAction,
  nextActionZh: "使用当前道路与水体自然性证据重新构建同一槽位，然后重新检查",
})

console.log(JSON.stringify({
  status: failure.status,
  runId,
  slotId,
  conditionRunId,
  conditionId: conditionRun.conditionId,
  failureCode,
  failurePath: written.runPath,
  ledgerEventId: event.id,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
}, null, 2))

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}
function readJson(value) {
  return JSON.parse(fs.readFileSync(value, "utf8"))
}
function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}
