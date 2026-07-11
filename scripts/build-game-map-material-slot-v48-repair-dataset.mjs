import fs from "node:fs"
import path from "node:path"

const baseDatasetRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/game-map-material-slot-v45-repair-dataset",
)
const overlayDatasetRoot = path.resolve(
  process.argv[3] ?? ".runtime/ai-painter/game-map-material-slot-v47-visual-delta-dataset",
)
const outputRoot = path.resolve(
  process.argv[4] ?? ".runtime/ai-painter/game-map-material-slot-v48-quality-focus-dataset",
)
const latestRepairPlanPath = path.resolve(
  ".runtime/ai-painter/game-map-material-slot-next-repair-plan/latest.json",
)
const latestArchivePath = path.resolve(".runtime/ai-painter/training-run-archive/latest.json")

const allCategories = [
  "grass",
  "grass_object",
  "road",
  "rock",
  "rock_object",
  "shoreline",
  "tree",
  "tree_object",
  "water",
]
const overlayCategories = new Set(["grass", "road"])

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`missing dataset source: ${source}`)
  }
  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(source, target, { recursive: true })
}

function countSamples(categoryRoot, split) {
  const indexPath = path.join(categoryRoot, `${split}.json`)
  if (!fs.existsSync(indexPath)) return 0
  const payload = readJson(indexPath)
  return Array.isArray(payload.sampleIds) ? payload.sampleIds.length : 0
}

function main() {
  if (!fs.existsSync(baseDatasetRoot)) {
    throw new Error(`base dataset missing: ${baseDatasetRoot}`)
  }
  if (!fs.existsSync(latestRepairPlanPath)) {
    throw new Error(`latest repair plan missing: ${latestRepairPlanPath}`)
  }
  if (!fs.existsSync(latestArchivePath)) {
    throw new Error(`latest archive missing: ${latestArchivePath}`)
  }

  fs.rmSync(outputRoot, { recursive: true, force: true })
  fs.mkdirSync(outputRoot, { recursive: true })

  const categories = {}
  for (const category of allCategories) {
    const overlaySource = path.join(overlayDatasetRoot, category)
    const baseSource = path.join(baseDatasetRoot, category)
    const source =
      overlayCategories.has(category) && fs.existsSync(overlaySource)
        ? overlaySource
        : baseSource
    const target = path.join(outputRoot, category)
    copyDir(source, target)
    categories[category] = {
      status: "completed",
      sourceDataset: source,
      sourceKind:
        overlayCategories.has(category) && fs.existsSync(overlaySource)
          ? "v47_quality_focus_overlay"
          : "v45_complete_repair_base",
      trainSampleCount: countSamples(target, "train"),
      validationSampleCount: countSamples(target, "validation"),
    }
  }

  const supplementalSource = path.join(overlayDatasetRoot, "_supplemental_sources")
  if (fs.existsSync(supplementalSource)) {
    copyDir(supplementalSource, path.join(outputRoot, "_supplemental_sources"))
  }

  const repairPlan = readJson(latestRepairPlanPath)
  const archive = readJson(latestArchivePath)
  const summary = {
    schemaVersion: "game-map-material-slot-repair-dataset-v1",
    status: "completed",
    stageId: "P7-V48-material-slot-quality-focus-dataset",
    createdAt: new Date().toISOString(),
    sourcePolicy: "same_source_target_png_and_masks_v1_with_latest_failure_feedback",
    notProgramDrawing: true,
    notWorldRuntimeFrame: true,
    outputRoot,
    baseDatasetRoot,
    overlayDatasetRoot,
    categories,
    failureFeedback: {
      sourceArchiveRunId: archive.runId,
      materialPassed: archive.quality?.materialPassed ?? null,
      materialStatus: archive.quality?.materialStatus ?? null,
      formalVisualJudgePassed: archive.quality?.formalVisualJudgePassed ?? null,
      formalVisualJudgeStatus: archive.quality?.formalVisualJudgeStatus ?? null,
      failedSlotCount: Array.isArray(archive.quality?.failedSlots)
        ? archive.quality.failedSlots.length
        : 0,
      repairPlanRunId: repairPlan.runId,
      targetCategories: repairPlan.targetSummary?.targetCategories ?? [],
      targetSlotCount: repairPlan.targetSummary?.targetSlotCount ?? null,
    },
    purpose:
      "Build v48 local-model repair data from stored same-source samples and the latest archived failure feedback. This dataset is training-only and cannot enter /world.",
  }
  writeJson(path.join(outputRoot, "dataset-summary.json"), summary)
  console.log(JSON.stringify(summary, null, 2))
}

main()
