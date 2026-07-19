import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_complete_world.py")
const CONFIG = path.join(ROOT, "ml", "ai-painter", "config", "complete-world-ai-assisted-cold-start-v2.json")
const MODEL_ROOT = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-model-ai-assisted-v2")
const modelConfig = readJson(CONFIG)
const datasetPointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = datasetPointer?.manifestPath ? readJson(datasetPointer.manifestPath) : null
const timestamp = new Date().toISOString()
const runId = `ai-assisted-complete-world-training-v2-${timestamp.replace(/[:.]/g, "-")}`
const runDir = path.join(MODEL_ROOT, runId)
const resolutionStage = readResolutionStage(process.argv.slice(2))
const parentCheckpoint = resolutionStage > 0 ? findPreviousStageCheckpoint(resolutionStage) : null

const blockers = []
if (!datasetManifest) blockers.push("ai_assisted_dataset_package_missing")
if (datasetManifest?.canStartAutoencoderWarmup !== true) blockers.push("ai_assisted_autoencoder_dataset_not_ready")
if ((datasetManifest?.autoencoderSampleCount ?? 0) < 1) blockers.push("ai_assisted_autoencoder_samples_missing")
if (datasetManifest?.canStartFormalTraining !== false || datasetManifest?.formalInferenceEligible !== false) blockers.push("ai_assisted_package_formal_boundary_invalid")
if (datasetManifest?.modelConfigId !== modelConfig?.modelId) blockers.push("ai_assisted_dataset_model_config_mismatch")
if (!fs.existsSync(CONFIG)) blockers.push("ai_assisted_model_config_missing")
if (!fs.existsSync(TRAINER)) blockers.push("ai_assisted_training_program_missing")
if (!fs.existsSync(PYTHON)) blockers.push("local_python_runtime_missing")
if (resolutionStage > 0 && !parentCheckpoint) blockers.push("previous_ai_assisted_resolution_checkpoint_missing")

if (blockers.length > 0) {
  const record = {
    schemaVersion: "project-owned-ai-assisted-cold-start-training-block-v2",
    status: "blocked",
    runId,
    timestampUtc: timestamp,
    timestampAsiaShanghai: formatShanghai(timestamp),
    datasetPackageId: datasetManifest?.packageId ?? null,
    blockers,
    thirdPartyWeightsLoaded: false,
    thirdPartyGeneratedTrainingOutputUsed: true,
    checkpointCreated: false,
    automaticStorage: true,
  }
  const blockPath = path.join(MODEL_ROOT, "blocks", `${runId}.json`)
  writeJson(blockPath, record)
  writeJson(path.join(MODEL_ROOT, "blocks", "latest.json"), { ...record, blockPath: projectPath(blockPath) })
  console.error(JSON.stringify(record, null, 2))
  process.exit(1)
}

const pythonArgs = [
  TRAINER,
  "--config", CONFIG,
  "--dataset-package", path.resolve(ROOT, datasetPointer.manifestPath),
  "--output-dir", runDir,
  "--resolution-stage", String(resolutionStage),
]
if (parentCheckpoint) pythonArgs.push("--initial-checkpoint", parentCheckpoint.checkpointPath)

const child = spawnSync(PYTHON, pythonArgs, {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 40 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src") },
})

if (child.status !== 0) {
  const record = {
    schemaVersion: "project-owned-ai-assisted-cold-start-training-failure-v2",
    status: "failed",
    runId,
    timestampUtc: new Date().toISOString(),
    timestampAsiaShanghai: formatShanghai(new Date().toISOString()),
    datasetPackageId: datasetManifest.packageId,
    blockers: ["ai_assisted_training_program_failed"],
    exitCode: child.status,
    signal: child.signal ?? null,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
    progressPath: fs.existsSync(path.join(runDir, "progress.json")) ? projectPath(path.join(runDir, "progress.json")) : null,
    thirdPartyWeightsLoaded: false,
    thirdPartyGeneratedTrainingOutputUsed: true,
    checkpointCreated: false,
    automaticStorage: true,
  }
  const failurePath = path.join(MODEL_ROOT, "failures", `${runId}.json`)
  writeJson(failurePath, record)
  writeJson(path.join(MODEL_ROOT, "failures", "latest.json"), { ...record, failurePath: projectPath(failurePath) })
  console.error(JSON.stringify(record, null, 2))
  process.exit(1)
}

const manifestPath = path.join(runDir, "manifest.json")
const manifest = readJson(manifestPath)
if (manifest?.ownership !== "project_owned_architecture_ai_assisted_cold_start_weights"
  || manifest?.schemaVersion !== modelConfig?.requiredCheckpointProvenance
  || manifest?.modelId !== modelConfig?.modelId
  || manifest?.trainingLane !== "ai_assisted_cold_start"
  || manifest?.upstreamModelIds?.length !== 0
  || manifest?.thirdPartyWeightsLoaded !== false
  || manifest?.thirdPartyGeneratedTrainingOutputUsed !== true
  || manifest?.aiGenerationDependencyDeclared !== true
  || manifest?.formalInferenceEligible !== false
  || manifest?.denoiserTrained !== false) {
  throw new Error("AI-assisted warmup checkpoint provenance failed")
}
writeJson(path.join(MODEL_ROOT, "latest.json"), { ...manifest, manifestPath: projectPath(manifestPath) })
console.log(JSON.stringify({
  status: manifest.status,
  runId,
  checkpointPath: manifest.checkpointPath,
  manifestPath: projectPath(manifestPath),
  formalInferenceEligible: false,
  remainingBlockers: manifest.remainingBlockers,
}, null, 2))

function readResolutionStage(args) {
  const index = args.indexOf("--resolution-stage")
  if (index < 0) return 0
  const value = Number(args[index + 1])
  if (!Number.isInteger(value) || value < 0 || value > 2) throw new Error("--resolution-stage must be 0, 1, or 2")
  return value
}
function findPreviousStageCheckpoint(stageIndex) {
  const expected = modelConfig?.training?.resolutionStages?.[stageIndex - 1]
  if (!expected || !fs.existsSync(MODEL_ROOT)) return null
  return fs.readdirSync(MODEL_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ai-assisted-complete-world-training-v2-"))
    .map((entry) => readJson(path.join(MODEL_ROOT, entry.name, "manifest.json")))
    .filter((manifest) => manifest
      && manifest.status === "autoencoder_warmup_completed_conditioning_blocked"
      && manifest.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
      && manifest.trainingLane === "ai_assisted_cold_start"
      && manifest.modelId === modelConfig?.modelId
      && manifest.datasetPackageId === datasetManifest?.packageId
      && manifest.thirdPartyWeightsLoaded === false
      && manifest.resolutionStage?.width === expected.width
      && manifest.resolutionStage?.height === expected.height
      && fs.existsSync(path.resolve(ROOT, manifest.checkpointPath)))
    .sort((left, right) => String(right.createdAtUtc).localeCompare(String(left.createdAtUtc)))[0] ?? null
}
function readJson(value) { try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) } catch { return null } }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
