import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const SAMPLER = path.join(ROOT, "ml", "ai-painter", "scripts", "infer_project_owned_complete_world.py")
const CONFIG_PATH = "ml/ai-painter/config/complete-world-independent-v1.json"
const CHECKPOINT_POINTER = ".runtime/ai-painter/project-owned-complete-world-model/latest.json"
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-inference")
const FAILURE_ROOT = path.join(OUTPUT_ROOT, "failures")
const taskPointer = readJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const task = taskPointer?.taskPath ? readJson(taskPointer.taskPath) : null
const conditionManifestPath = taskPointer?.taskPath
  ? path.join(path.dirname(resolvePath(taskPointer.taskPath)), "compiled-conditions", "manifest.json")
  : null
const conditionManifest = conditionManifestPath ? readJson(conditionManifestPath) : null
const config = readJson(CONFIG_PATH)
const checkpoint = readJson(CHECKPOINT_POINTER)
const timestamp = new Date().toISOString()
const runId = `project-owned-complete-world-inference-${timestamp.replace(/[:.]/g, "-")}`
const runDir = path.join(OUTPUT_ROOT, runId)
const outputImage = path.join(runDir, "candidate.png")
const reportPath = path.join(runDir, "model-report.json")
const manifestPath = path.join(runDir, "manifest.json")
const seed = Number.parseInt(sha256(Buffer.from(`${task?.taskId ?? "missing"}:${conditionManifest?.conditionPackSha256 ?? "missing"}:${timestamp}:project-owned-v1`)).slice(0, 8), 16)

const blockers = []
if (config?.ownership !== "project_owned_independent_weights") blockers.push("project_owned_model_config_invalid")
if (config?.initialization !== "random_initialization_only") blockers.push("independent_initialization_contract_missing")
if (config?.imageSize?.width !== 1024 || config?.imageSize?.height !== 768) blockers.push("high_resolution_pixel_style_output_contract_not_implemented")
if (!Array.isArray(config?.upstreamModelIds) || config.upstreamModelIds.length !== 0) blockers.push("upstream_model_dependency_present")
if (!task || !conditionManifest) blockers.push("current_world_condition_pack_missing")
if (!checkpoint) blockers.push("project_owned_checkpoint_missing")
if (checkpoint && checkpoint.schemaVersion !== "project-owned-complete-world-checkpoint-v1") blockers.push("checkpoint_provenance_invalid")
if (checkpoint && checkpoint.status !== "training_completed") blockers.push("checkpoint_training_not_completed")
if (checkpoint && checkpoint.ownership !== "project_owned_independent_weights") blockers.push("checkpoint_not_independently_owned")
if (checkpoint && (!Array.isArray(checkpoint.upstreamModelIds) || checkpoint.upstreamModelIds.length !== 0)) blockers.push("checkpoint_has_upstream_weights")
if (checkpoint && checkpoint.thirdPartyWeightsLoaded !== false) blockers.push("checkpoint_third_party_weight_status_invalid")
if (checkpoint && checkpoint.thirdPartyGeneratedTrainingOutputUsed !== false) blockers.push("checkpoint_third_party_output_status_invalid")
if (checkpoint?.checkpointPath && (!fs.existsSync(resolvePath(checkpoint.checkpointPath)) || sha256(fs.readFileSync(resolvePath(checkpoint.checkpointPath))) !== checkpoint.checkpointSha256)) blockers.push("checkpoint_file_or_hash_invalid")

if (blockers.length > 0) blockAndExit(blockers)

fs.mkdirSync(runDir, { recursive: false })
const child = spawnSync(PYTHON, [
  SAMPLER,
  "--config", resolvePath(CONFIG_PATH),
  "--checkpoint", resolvePath(checkpoint.checkpointPath),
  "--condition-pack", resolvePath(conditionManifest.conditionPackPath),
  "--output-image", outputImage,
  "--report", reportPath,
  "--seed", String(seed),
], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src") },
})
if (child.status !== 0) blockAndExit(["project_owned_sampler_failed"], child.stderr || child.stdout || `sampler_exit_${child.status}`)

const modelReport = readJson(reportPath)
const imageBytes = fs.readFileSync(outputImage)
const metadata = await sharp(imageBytes, { failOn: "error" }).metadata()
const imageSha256 = sha256(imageBytes)
if (metadata.width !== 1024 || metadata.height !== 768 || metadata.channels !== 3) throw new Error("project-owned candidate image contract failed")
if (modelReport?.ownership !== "project_owned_independent_weights" || modelReport?.upstreamModelIds?.length !== 0) throw new Error("project-owned inference report provenance failed")
if (modelReport.outputImageSha256 !== imageSha256) throw new Error("project-owned candidate hash mismatch")

const manifest = {
  schemaVersion: "complete-world-visual-inference-manifest-v1",
  status: "completed_candidate_generated",
  runId,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  taskId: task.taskId,
  worldId: task.worldId,
  tick: task.tick,
  dictionaryVersionId: task.dictionaryVersionId,
  conditionPackId: conditionManifest.conditionPackId,
  conditionPackSha256: conditionManifest.conditionPackSha256,
  modelVersion: config.modelId,
  modelCheckpointPath: checkpoint.checkpointPath,
  modelCheckpointSha256: checkpoint.checkpointSha256,
  ownership: "project_owned_independent_weights",
  initialization: "random_initialization_only",
  upstreamModelIds: [],
  thirdPartyWeightsLoaded: false,
  thirdPartyGeneratedTrainingOutputUsed: false,
  seed,
  outputSource: "fresh_local_model_inference",
  outputImagePath: projectPath(outputImage),
  outputImageSha256: imageSha256,
  outputSize: { width: metadata.width, height: metadata.height },
  visualContract: { style: "high_resolution_pixel_style", nativeWidth: 1024, nativeHeight: 768, lowResolutionUpscaleAllowed: false },
  reusedExistingImage: false,
  targetImageUsed: false,
  programDrawnRgbUsed: false,
  canEnterWorld: false,
  requiresMachineReview: true,
  requiresOwnerReview: true,
  modelReportPath: projectPath(reportPath),
  automaticStorage: true,
}
writeJson(manifestPath, manifest)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), { ...manifest, manifestPath: projectPath(manifestPath) })
console.log(JSON.stringify({ status: manifest.status, runId, outputImagePath: manifest.outputImagePath, outputImageSha256: imageSha256, manifestPath: projectPath(manifestPath) }, null, 2))

function blockAndExit(reasons, detail = null) {
  const failureId = `project-owned-inference-blocked-${timestamp.replace(/[:.]/g, "-")}`
  const failure = {
    schemaVersion: "project-owned-complete-world-inference-block-v1",
    status: "blocked",
    failureId,
    timestampUtc: timestamp,
    timestampAsiaShanghai: formatShanghai(timestamp),
    taskId: task?.taskId ?? null,
    modelConfigPath: CONFIG_PATH,
    checkpointPointer: CHECKPOINT_POINTER,
    blockers: reasons,
    detail,
    thirdPartyWeightsLoaded: false,
    candidateGenerated: false,
    automaticStorage: true,
  }
  const failurePath = path.join(FAILURE_ROOT, `${failureId}.json`)
  writeJson(failurePath, failure)
  writeJson(path.join(FAILURE_ROOT, "latest.json"), { ...failure, failurePath: projectPath(failurePath) })
  console.error(JSON.stringify(failure, null, 2))
  process.exit(1)
}

function readJson(value) { try { return JSON.parse(fs.readFileSync(resolvePath(value), "utf8")) } catch { return null } }
function resolvePath(value) { const resolved = path.resolve(ROOT, value); if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes root: ${value}`); return resolved }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
