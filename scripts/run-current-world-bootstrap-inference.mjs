import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-bootstrap-inference")
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const PYTHON_SCRIPT = path.join(ROOT, "ml", "ai-painter", "scripts", "infer_current_world_bootstrap_complete_map.py")
const STRUCTURE_CHECKPOINT = path.join(ROOT, ".runtime", "ai-painter", "natural-home-v28-structure-guided-training", "best.pt")
const REFINER_CHECKPOINT = path.join(ROOT, ".runtime", "ai-painter", "natural-home-v151-v150-failure-focus-repair-training", "best.pt")
process.on("uncaughtException", persistFatalError)
process.on("unhandledRejection", persistFatalError)
const taskPointer = readRequiredJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const task = readRequiredJson(taskPointer.taskPath)
const conditionManifestPath = path.join(path.dirname(resolveProjectPath(taskPointer.taskPath)), "compiled-conditions", "manifest.json")
const conditionManifest = readRequiredJson(conditionManifestPath)
const conditionPack = readRequiredJson(conditionManifest.conditionPackPath)
const timestamp = new Date().toISOString()
const runId = `bootstrap-complete-map-${task.worldId}-${task.tick}-${timestamp.replace(/[:.]/g, "-")}`
const runDir = path.join(OUTPUT_ROOT, runId)
const outputImagePath = path.join(runDir, "candidate.png")
const modelReportPath = path.join(runDir, "model-report.json")
const manifestPath = path.join(runDir, "manifest.json")
const seed = Number.parseInt(sha256(Buffer.from(`${task.taskId}:${conditionManifest.conditionPackSha256}`)).slice(0, 8), 16)

assert(conditionManifest.status === "compiled_conditions_ready", "compiled conditions are not ready")
assert(conditionManifest.taskId === task.taskId, "condition/task identity mismatch")
assert(conditionManifest.dictionaryVersionId === task.dictionaryVersionId, "condition/task dictionary mismatch")
assert(conditionManifest.outputKind === "model_condition_only_no_rgb", "condition boundary mismatch")
assert(conditionManifest.generatesPlayerFacingPixels === false, "compiled conditions must not be player-facing")
assert(conditionPack.bootstrapInferenceGate?.canRunBootstrapInference === true, "bootstrap inference gate is not open")
assert(conditionPack.bootstrapInferenceGate?.canEnterWorld === false, "bootstrap inference must remain outside /world")
assert(fs.existsSync(PYTHON), "AI Painter Python runtime missing")
assert(fs.existsSync(PYTHON_SCRIPT), "bootstrap inference Python script missing")
assert(fs.existsSync(STRUCTURE_CHECKPOINT), "bootstrap structure checkpoint missing")
assert(fs.existsSync(REFINER_CHECKPOINT), "bootstrap RGB refiner checkpoint missing")

fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
fs.mkdirSync(runDir, { recursive: false })
const result = spawnSync(PYTHON, [
  PYTHON_SCRIPT,
  "--condition-pack", resolveProjectPath(conditionManifest.conditionPackPath),
  "--structure-checkpoint", STRUCTURE_CHECKPOINT,
  "--refiner-checkpoint", REFINER_CHECKPOINT,
  "--output-image", outputImagePath,
  "--report", modelReportPath,
  "--seed", String(seed),
], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1" },
})
assert(result.status === 0, `bootstrap inference failed: ${result.stderr || result.stdout}`)

const modelReport = readRequiredJson(modelReportPath)
const outputBytes = fs.readFileSync(outputImagePath)
const metadata = await sharp(outputBytes, { failOn: "error" }).metadata()
const imageSha256 = sha256(outputBytes)
assert(metadata.width === task.outputSize.width && metadata.height === task.outputSize.height, "bootstrap candidate size mismatch")
assert(metadata.channels === 3, "bootstrap candidate must be RGB")
assert(modelReport.outputImageSha256 === imageSha256, "bootstrap model report image hash mismatch")
assert(modelReport.outputSource === "fresh_local_model_inference", "bootstrap output source invalid")
assert(modelReport.reusedExistingImage === false, "bootstrap output reused an existing image")
assert(modelReport.targetImageUsed === false, "bootstrap inference must not use a target image")
assert(modelReport.programDrawnRgbUsed === false, "bootstrap inference must not use program-drawn RGB")

const manifest = {
  schemaVersion: "complete-world-visual-bootstrap-inference-manifest-v1",
  status: "completed_bootstrap_candidate_generated",
  runId,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  candidateStatus: "pending_machine_review",
  canEnterWorld: false,
  canCountAsPositiveSample: false,
  requiresOwnerReview: true,
  taskId: task.taskId,
  taskSha256: task.taskSha256,
  conditionPackId: conditionManifest.conditionPackId,
  conditionPackSha256: conditionManifest.conditionPackSha256,
  datasetPackageId: task.sourceBindings.datasetPackageId,
  datasetPackageStatus: task.sourceBindings.datasetPackageStatus,
  dictionaryVersionId: task.dictionaryVersionId,
  worldId: task.worldId,
  ownerId: task.ownerId,
  tick: task.tick,
  seed,
  modelVersion: `${modelReport.structureModelVersion}+${modelReport.refinerModelVersion}`,
  modelCheckpointPath: projectPath(REFINER_CHECKPOINT),
  modelCheckpoints: {
    structure: { path: projectPath(STRUCTURE_CHECKPOINT), sha256: modelReport.structureCheckpointSha256 },
    refiner: { path: projectPath(REFINER_CHECKPOINT), sha256: modelReport.refinerCheckpointSha256 },
  },
  adapterVersion: modelReport.adapterVersion,
  nativeModelOutputSize: modelReport.nativeModelOutputSize,
  reviewOutputResample: modelReport.reviewOutputResample,
  latentInput: modelReport.latentInput,
  consumedCompiledChannelIds: modelReport.consumedCompiledChannelIds,
  unusedCompiledChannelIds: modelReport.unusedCompiledChannelIds,
  outputImagePath: projectPath(outputImagePath),
  outputImageSha256: imageSha256,
  outputSize: { width: metadata.width, height: metadata.height },
  outputSource: "fresh_local_model_inference",
  reusedExistingImage: false,
  targetImageUsed: false,
  programDrawnRgbUsed: false,
  modelReportPath: projectPath(modelReportPath),
  nativeOutputImagePath: projectPath(modelReport.nativeOutputImagePath),
  nativeOutputImageSha256: modelReport.nativeOutputImageSha256,
  formalLimitations: modelReport.formalLimitations,
  automaticStorage: true,
}
writeJson(manifestPath, manifest)
const pointer = {
  schemaVersion: "complete-world-visual-bootstrap-inference-latest-v1",
  ...manifest,
  manifestPath: projectPath(manifestPath),
}
writeJson(path.join(OUTPUT_ROOT, "latest.json"), pointer)
appendLedger(manifest)
console.log(JSON.stringify(pointer, null, 2))

function appendLedger(record) {
  const event = {
    schemaVersion: "ai-painter-training-process-ledger-event-v1",
    timestamp: record.createdAtUtc,
    timestampAsiaShanghai: record.createdAtAsiaShanghai,
    status: "success",
    kind: "bootstrap_candidate_generated",
    action: "current_world_bootstrap_complete_map_inference",
    title: "Local model generated a bootstrap complete-map candidate",
    titleZh: "本地小模型已生成 bootstrap 完整地图候选",
    summary: `taskId=${record.taskId}; imageSha256=${record.outputImageSha256}; ownerReviewRequired=true; canEnterWorld=false`,
    summaryZh: `任务=${record.taskId}；图片=${record.outputImageSha256}；需要项目所有者审核；不能进入世界`,
    archiveId: record.runId,
    resourceSessionId: record.outputImageSha256,
    script: "scripts/run-current-world-bootstrap-inference.mjs",
    evidence: [record.outputImagePath, record.modelReportPath, projectPath(manifestPath)],
  }
  appendAiPainterProgramEvent(event)
}

function persistFatalError(error) {
  try {
    const failureTimestamp = new Date().toISOString()
    const failureId = `bootstrap-inference-failure-${failureTimestamp.replace(/[:.]/g, "-")}`
    const failureDir = path.join(OUTPUT_ROOT, "failures", failureId)
    const failurePath = path.join(failureDir, "failure.json")
    const message = error instanceof Error ? error.message : String(error)
    const failure = {
      schemaVersion: "complete-world-visual-bootstrap-inference-failure-v1",
      status: "failed",
      failureId,
      createdAtUtc: failureTimestamp,
      createdAtAsiaShanghai: formatShanghai(failureTimestamp),
      script: "scripts/run-current-world-bootstrap-inference.mjs",
      errorCode: "bootstrap_inference_execution_failed",
      message,
      stack: error instanceof Error ? error.stack : null,
      automaticStorage: true,
    }
    fs.mkdirSync(failureDir, { recursive: true })
    writeJson(failurePath, failure)
    const event = {
      schemaVersion: "ai-painter-training-process-ledger-event-v1",
      timestamp: failure.createdAtUtc,
      timestampAsiaShanghai: failure.createdAtAsiaShanghai,
      status: "failed",
      kind: "bootstrap_inference_failed",
      action: "current_world_bootstrap_complete_map_inference",
      title: "Bootstrap complete-map inference failed",
      titleZh: "Bootstrap 完整地图推理失败",
      summary: message,
      summaryZh: `执行失败：${message}`,
      archiveId: failureId,
      resourceSessionId: null,
      script: failure.script,
      evidence: [projectPath(failurePath)],
    }
    appendAiPainterProgramEvent(event)
    console.error(JSON.stringify(failure, null, 2))
  } catch (persistenceError) {
    console.error(persistenceError)
  }
  process.exit(1)
}

function readRequiredJson(value) {
  try {
    return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
  } catch (error) {
    throw new Error(`required JSON unreadable: ${value} (${error instanceof Error ? error.message : "unknown"})`)
  }
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  return resolved
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function projectPath(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
