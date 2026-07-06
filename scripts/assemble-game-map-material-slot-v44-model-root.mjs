import fs from "node:fs"
import path from "node:path"

const baseModelRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/natural-home-local-detail-v43-clean-grass-overfit-training"
)
const repairModelRoot = path.resolve(
  process.argv[3] ?? ".runtime/ai-painter/natural-home-local-detail-v44-material-slot-repair-training"
)
const outputRoot = path.resolve(
  process.argv[4] ?? ".runtime/ai-painter/natural-home-local-detail-v44-material-slot-repair-combined"
)
const repairedCategoryArg = process.argv[5]

const repairedCategories = repairedCategoryArg
  ? repairedCategoryArg.split(",").map((value) => value.trim()).filter(Boolean)
  : ["grass", "road", "rock_object"]

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`missing source directory: ${source}`)
  }
  fs.cpSync(source, target, { recursive: true, force: true })
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8")
}

function main() {
  if (!fs.existsSync(baseModelRoot)) {
    throw new Error(`base model root missing: ${baseModelRoot}`)
  }
  if (!fs.existsSync(repairModelRoot)) {
    throw new Error(`repair model root missing: ${repairModelRoot}`)
  }
  fs.rmSync(outputRoot, { recursive: true, force: true })
  copyDirectory(baseModelRoot, outputRoot)

  const repaired = []
  for (const category of repairedCategories) {
    const source = path.join(repairModelRoot, category)
    const best = path.join(source, "best.pt")
    if (!fs.existsSync(best)) {
      throw new Error(`missing repaired checkpoint for ${category}: ${best}`)
    }
    copyDirectory(source, path.join(outputRoot, category))
    const summaryPath = path.join(source, "training-summary.json")
    repaired.push({
      category,
      source,
      checkpoint: best,
      summary: fs.existsSync(summaryPath) ? readJson(summaryPath) : null,
    })
  }

  const manifest = {
    schemaVersion: "game-map-material-slot-combined-model-root-v1",
    status: "completed",
    stageId: "P7-V44-material-slot-repair-combined-model-root",
    createdAt: new Date().toISOString(),
    baseModelRoot,
    repairModelRoot,
    outputRoot,
    repairedCategories,
    repaired,
    sourcePolicy: "copy_existing_local_checkpoints_and_overlay_repaired_categories",
    notProgramDrawing: true,
    notWorldRuntimeFrame: true,
    tags: [
      "local_model_checkpoint_root",
      "material_slot_repair",
      "requires_material_quality_judge",
      "not_world_page_runtime",
    ],
  }
  writeJson(path.join(outputRoot, "combined-model-root-manifest.json"), manifest)
  console.log(JSON.stringify(manifest, null, 2))
}

main()
