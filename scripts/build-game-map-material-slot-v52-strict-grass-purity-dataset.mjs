import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const baseDatasetRoot = path.resolve(".runtime/ai-painter/game-map-material-slot-v48-quality-focus-dataset")
const outputRoot = path.resolve(".runtime/ai-painter/game-map-material-slot-v52-strict-grass-purity-dataset")
const pythonExe = path.resolve("ml/ai-painter/.venv/Scripts/python.exe")
const prepareScript = path.resolve("ml/ai-painter/scripts/prepare_game_map_material_slot_repair_dataset.py")
const sourceDatasetRoot = path.resolve(".runtime/ai-painter/natural-home-v45-generalization-dataset")

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function copyBaseDataset() {
  if (!fs.existsSync(baseDatasetRoot)) {
    throw new Error(`base material dataset missing: ${baseDatasetRoot}`)
  }
  fs.rmSync(outputRoot, { recursive: true, force: true })
  fs.cpSync(baseDatasetRoot, outputRoot, { recursive: true })
}

function buildStrictGrassOverlay() {
  const result = spawnSync(
    pythonExe,
    [
      prepareScript,
      "--dataset-root",
      sourceDatasetRoot,
      "--output-root",
      outputRoot,
      "--only-category",
      "grass",
      "--force",
    ],
    { cwd: process.cwd(), stdio: "inherit" }
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`strict grass overlay prepare failed with exit code ${result.status}`)
  }
}

function writeCombinedSummary() {
  const baseSummary = readJson(path.join(baseDatasetRoot, "dataset-summary.json"))
  const strictSummary = readJson(path.join(outputRoot, "dataset-summary.json"))
  const grassSummary = strictSummary.categories?.grass
  if (!grassSummary) {
    throw new Error("strict grass dataset summary missing grass category")
  }
  const categories = {
    ...(baseSummary.categories ?? {}),
    grass: {
      ...grassSummary,
      sourcePolicy: "strict_same_source_grass_only_target_png_and_masks_v1_crop",
      baseCategoryReplacedFrom: path.relative(process.cwd(), baseDatasetRoot).replace(/\\/g, "/"),
    },
  }
  writeJson(path.join(outputRoot, "dataset-summary.json"), {
    schemaVersion: "game-map-material-slot-v52-strict-grass-purity-combined-dataset-v1",
    status: "completed",
    stageId: "P7-V52-strict-grass-purity-combined-dataset",
    createdAt: new Date().toISOString(),
    baseDatasetRoot: path.relative(process.cwd(), baseDatasetRoot).replace(/\\/g, "/"),
    strictGrassSourceDatasetRoot: path.relative(process.cwd(), sourceDatasetRoot).replace(/\\/g, "/"),
    outputRoot: path.relative(process.cwd(), outputRoot).replace(/\\/g, "/"),
    sourcePolicy: "copy_v48_full_material_dataset_then_overlay_v52_strict_grass",
    notProgramDrawing: true,
    notWorldRuntimeFrame: true,
    purpose:
      "Use v48 full material references for non-grass slots while replacing only grass with v52 strict purity samples.",
    categories,
  })
}

copyBaseDataset()
buildStrictGrassOverlay()
writeCombinedSummary()

const summary = readJson(path.join(outputRoot, "dataset-summary.json"))
console.log(JSON.stringify(summary, null, 2))
