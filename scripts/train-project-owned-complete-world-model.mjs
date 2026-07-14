import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_project_owned_complete_world.py")
const CONFIG = path.join(ROOT, "ml", "ai-painter", "config", "complete-world-independent-v1.json")
const MODEL_ROOT = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-model")
const datasetPointer = readJson("data/world-samples/dataset-packages/latest.json")
const datasetManifest = datasetPointer?.manifestPath ? readJson(datasetPointer.manifestPath) : null
const timestamp = new Date().toISOString()
const runId = `project-owned-complete-world-training-${timestamp.replace(/[:.]/g, "-")}`
const runDir = path.join(MODEL_ROOT, runId)

const blockers = []
if (!datasetManifest) blockers.push("independent_dataset_package_missing")
if (datasetManifest?.canStartFormalTraining !== true) blockers.push("independent_dataset_not_training_ready")
if ((datasetManifest?.sampleCount ?? 0) < 1) blockers.push("independent_training_samples_missing")
if (!fs.existsSync(CONFIG)) blockers.push("project_owned_model_config_missing")

if (blockers.length > 0) {
  const record = {
    schemaVersion: "project-owned-complete-world-training-block-v1",
    status: "blocked",
    runId,
    timestampUtc: timestamp,
    timestampAsiaShanghai: formatShanghai(timestamp),
    datasetPackageId: datasetManifest?.packageId ?? null,
    blockers,
    thirdPartyWeightsLoaded: false,
    checkpointCreated: false,
    automaticStorage: true,
  }
  const blockPath = path.join(MODEL_ROOT, "blocks", `${runId}.json`)
  writeJson(blockPath, record)
  writeJson(path.join(MODEL_ROOT, "blocks", "latest.json"), { ...record, blockPath: projectPath(blockPath) })
  console.error(JSON.stringify(record, null, 2))
  process.exit(1)
}

const child = spawnSync(PYTHON, [
  TRAINER,
  "--config", CONFIG,
  "--dataset-package", path.resolve(ROOT, datasetPointer.manifestPath),
  "--output-dir", runDir,
], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src") },
})
if (child.status !== 0) {
  const record = {
    schemaVersion: "project-owned-complete-world-training-failure-v1",
    status: "failed",
    runId,
    timestampUtc: new Date().toISOString(),
    timestampAsiaShanghai: formatShanghai(new Date().toISOString()),
    datasetPackageId: datasetManifest.packageId,
    blockers: ["project_owned_training_program_failed"],
    exitCode: child.status,
    signal: child.signal ?? null,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
    progressPath: fs.existsSync(path.join(runDir, "progress.json"))
      ? projectPath(path.join(runDir, "progress.json"))
      : null,
    thirdPartyWeightsLoaded: false,
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
if (manifest?.ownership !== "project_owned_independent_weights" || manifest?.upstreamModelIds?.length !== 0) {
  throw new Error("trained checkpoint provenance failed")
}
writeJson(path.join(MODEL_ROOT, "latest.json"), { ...manifest, manifestPath: projectPath(manifestPath) })
console.log(JSON.stringify({ status: manifest.status, runId, checkpointPath: manifest.checkpointPath, manifestPath: projectPath(manifestPath) }, null, 2))

function readJson(value) { try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) } catch { return null } }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
