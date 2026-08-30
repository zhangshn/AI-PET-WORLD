import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-bootstrap-inference")
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const PYTHON_SCRIPT = path.join(ROOT, "ml", "ai-painter", "scripts", "infer_current_world_foundation_complete_map.py")
const SOURCE_MANIFEST = path.join(ROOT, ".runtime", "ai-painter", "local-foundation-models", "manifest.json")
const REVIEW_POINTER = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-machine-reviews", "latest.json")
const taskPointer = readJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const task = readJson(taskPointer.taskPath)
const conditionManifestPath = path.join(path.dirname(resolvePath(taskPointer.taskPath)), "compiled-conditions", "manifest.json")
const conditionManifest = readJson(conditionManifestPath)
const timestamp = new Date().toISOString()
const runId = `foundation-bootstrap-complete-map-${task.worldId}-${task.tick}-${timestamp.replace(/[:.]/g, "-")}`
const runDir = path.join(OUTPUT_ROOT, runId)
const imagePath = path.join(runDir, "candidate.png")
const reportPath = path.join(runDir, "model-report.json")
const manifestPath = path.join(runDir, "manifest.json")
const seed = Number.parseInt(sha256(Buffer.from(`${task.taskId}:${conditionManifest.conditionPackSha256}:${timestamp}:foundation-v10`)).slice(0, 8), 16)
const previousReview = fs.existsSync(REVIEW_POINTER) ? readJson(REVIEW_POINTER) : null
const failureFeedbackPath = previousReview?.candidate?.taskId === task.taskId && previousReview?.reviewPath
  ? resolvePath(previousReview.reviewPath)
  : null

assert(conditionManifest.status === "compiled_conditions_ready", "compiled conditions are not ready")
assert(fs.existsSync(SOURCE_MANIFEST), "local visual foundation is not downloaded")
fs.mkdirSync(runDir, { recursive: false })
const child = spawnSync(PYTHON, [
  PYTHON_SCRIPT,
  "--condition-pack", resolvePath(conditionManifest.conditionPackPath),
  "--task-package", resolvePath(taskPointer.taskPath),
  "--source-manifest", SOURCE_MANIFEST,
  "--output-image", imagePath,
  "--report", reportPath,
  "--seed", String(seed),
  ...(failureFeedbackPath ? ["--failure-feedback", failureFeedbackPath] : []),
], { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: { ...process.env, PYTHONUTF8: "1", HF_HUB_OFFLINE: "1" } })
if (child.status !== 0) {
  const failure = {
    schemaVersion: "complete-world-visual-foundation-inference-failure-v1",
    status: "failed",
    runId,
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    taskId: task.taskId,
    seed,
    failureFeedbackPath: failureFeedbackPath ? projectPath(failureFeedbackPath) : null,
    error: child.stderr || child.stdout || `exit_code_${child.status}`,
    automaticStorage: true,
  }
  writeJson(path.join(runDir, "failure.json"), failure)
  appendLedger(failure, "failed")
  throw new Error(`local foundation inference failed: ${failure.error}`)
}

const modelReport = readJson(reportPath)
const bytes = fs.readFileSync(imagePath)
const metadata = await sharp(bytes, { failOn: "error" }).metadata()
const imageSha256 = sha256(bytes)
assert(metadata.width === 1024 && metadata.height === 768 && metadata.channels === 3, "foundation candidate output contract failed")
assert(modelReport.outputImageSha256 === imageSha256, "foundation candidate hash mismatch")
assert(modelReport.onlineInferenceApiUsed === false && modelReport.localFilesOnly === true, "foundation candidate violated local-only boundary")
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
  modelVersion: modelReport.modelVersion,
  modelCheckpointPath: projectPath(SOURCE_MANIFEST),
  modelCheckpoints: {},
  modelSourceManifestPath: projectPath(SOURCE_MANIFEST),
  modelSourceManifestSha256: modelReport.modelSourceManifestSha256,
  adapterVersion: modelReport.adapterVersion,
  nativeModelOutputSize: modelReport.nativeModelOutputSize,
  reviewOutputResample: modelReport.reviewOutputResample,
  latentInput: { kind: "stable_diffusion_seeded_latent", seed },
  consumedCompiledChannelIds: modelReport.consumedCompiledChannelIds,
  unusedCompiledChannelIds: modelReport.unusedCompiledChannelIds,
  prompt: modelReport.prompt,
  negativePrompt: modelReport.negativePrompt,
  controlImagePath: projectPath(modelReport.controlImagePath),
  controlImageSha256: modelReport.controlImageSha256,
  outputImagePath: projectPath(imagePath),
  outputImageSha256: imageSha256,
  outputSize: { width: metadata.width, height: metadata.height },
  outputSource: "fresh_local_foundation_inference",
  reusedExistingImage: false,
  targetImageUsed: false,
  programDrawnRgbUsed: false,
  onlineInferenceApiUsed: false,
  localFilesOnly: true,
  modelReportPath: projectPath(reportPath),
  nativeOutputImagePath: projectPath(modelReport.nativeOutputImagePath),
  nativeOutputImageSha256: modelReport.nativeOutputImageSha256,
  formalLimitations: modelReport.formalLimitations,
  failureFeedbackInput: failureFeedbackPath
    ? {
        reviewId: previousReview.reviewId,
        reviewPath: projectPath(failureFeedbackPath),
        issueCodes: previousReview.issues.map((issue) => issue.code),
        consumedFailureCodes: modelReport.consumedFailureCodes,
      }
    : null,
  automaticStorage: true,
}
writeJson(manifestPath, manifest)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), { ...manifest, manifestPath: projectPath(manifestPath) })
appendLedger(manifest, "success")
console.log(JSON.stringify({ status: manifest.status, runId, imagePath: manifest.outputImagePath, imageSha256, modelVersion: manifest.modelVersion, onlineInferenceApiUsed: false, manifestPath: projectPath(manifestPath) }, null, 2))

function readJson(value) { return JSON.parse(fs.readFileSync(resolvePath(value), "utf8")) }
function resolvePath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes root: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function appendLedger(value, status) {
  const event = {
    schemaVersion: "ai-painter-training-process-ledger-event-v1",
    timestamp,
    timestampAsiaShanghai: formatShanghai(timestamp),
    status,
    kind: "complete_world_visual_foundation_inference",
    action: "run_current_world_foundation_bootstrap_inference",
    title: status === "success" ? "Local foundation complete-map candidate generated" : "Local foundation complete-map inference failed",
    titleZh: status === "success" ? "本地基础视觉模型已生成完整地图候选" : "本地基础视觉模型完整地图推理失败",
    summary: status === "success" ? `Fresh candidate ${value.runId} was generated and program-saved.` : value.error,
    summaryZh: status === "success" ? `新候选 ${value.runId} 已由程序生成并自动保存。` : value.error,
    archiveId: value.runId,
    resourceSessionId: value.taskId,
    script: "scripts/run-current-world-foundation-bootstrap-inference.mjs",
    evidence: status === "success" ? [projectPath(manifestPath), value.outputImagePath] : [projectPath(path.join(runDir, "failure.json"))],
    error: status === "success" ? null : value.error,
    errorZh: status === "success" ? null : value.error,
  }
  appendAiPainterProgramEvent(event)
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
