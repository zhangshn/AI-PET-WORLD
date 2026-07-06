import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()
const archiveLatestPath = path.resolve(".runtime/ai-painter/training-run-archive/latest.json")
const outputRoot = path.resolve(".runtime/ai-painter/game-map-material-slot-next-repair-plan")

const unitToModelCategory = {
  grass_texture: "grass",
  boundary_texture: "tree",
  grass_detail_visual_unit: "grass_object",
  flower_visual_unit: "grass_object",
  shrub_visual_unit: "tree_object",
  water_texture: "water",
  shoreline_texture: "shoreline",
  path_texture: "road",
  tree_visual_unit: "tree_object",
  rock_visual_unit: "rock_object",
}

const categoryPriority = ["road", "water", "shoreline", "grass", "grass_object", "tree", "tree_object", "rock", "rock_object"]

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function resolveProjectFile(value) {
  if (typeof value !== "string" || !value.trim()) return null
  return path.isAbsolute(value) ? value : path.resolve(cwd, value)
}

function projectRelative(filePath) {
  if (!filePath) return null
  const relative = path.relative(cwd, filePath)
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative.replace(/\\/g, "/")
    : filePath
}

function collectTargetSlotRows(materialReport, targetSlots) {
  const rows = Array.isArray(materialReport?.slots) ? materialReport.slots : []
  const bySlotId = new Map(rows.map((row) => [String(row.slotId), row]))
  return targetSlots.map((slotId) => {
    const row = bySlotId.get(slotId) ?? {}
    const unitKind = typeof row.unitKind === "string" ? row.unitKind : inferUnitKindFromSlotId(slotId)
    const modelCategory = unitToModelCategory[unitKind] ?? "unknown"
    return {
      slotId,
      unitKind,
      modelCategory,
      imagePath: typeof row.imagePath === "string" ? projectRelative(row.imagePath) : null,
      metrics: typeof row.metrics === "object" && row.metrics ? row.metrics : null,
    }
  })
}

function inferUnitKindFromSlotId(slotId) {
  if (slotId.includes("path")) return "path_texture"
  if (slotId.includes("water")) return "water_texture"
  if (slotId.includes("shoreline")) return "shoreline_texture"
  if (slotId.includes("grass-detail")) return "grass_detail_visual_unit"
  if (slotId.includes("flower")) return "flower_visual_unit"
  if (slotId.includes("shrub")) return "shrub_visual_unit"
  if (slotId.includes("tree")) return "tree_visual_unit"
  if (slotId.includes("rock")) return "rock_visual_unit"
  return "grass_texture"
}

function uniqueSortedCategories(rows) {
  const categories = [...new Set(rows.map((row) => row.modelCategory).filter((value) => value && value !== "unknown"))]
  return categories.sort((left, right) => categoryPriority.indexOf(left) - categoryPriority.indexOf(right))
}

function main() {
  if (!fs.existsSync(archiveLatestPath)) {
    throw new Error(`training archive latest missing: ${archiveLatestPath}`)
  }

  const archive = readJson(archiveLatestPath)
  const visualDeltaReportPath = resolveProjectFile(archive.visualDeltaReview?.archivedReport)
  const materialReportPath = resolveProjectFile(archive.quality?.archivedMaterialQualityReport)
  if (!visualDeltaReportPath || !fs.existsSync(visualDeltaReportPath)) {
    throw new Error("visual delta review missing from latest training archive")
  }
  if (!materialReportPath || !fs.existsSync(materialReportPath)) {
    throw new Error("material quality report missing from latest training archive")
  }

  const visualDelta = readJson(visualDeltaReportPath)
  const materialReport = readJson(materialReportPath)
  const targetSlots = Array.isArray(visualDelta.nextTrainingPlan?.targetSlots)
    ? visualDelta.nextTrainingPlan.targetSlots.filter((slotId) => typeof slotId === "string" && slotId.length > 0)
    : []
  if (targetSlots.length === 0) {
    throw new Error("visual delta review has no target slots")
  }

  const targetSlotRows = collectTargetSlotRows(materialReport, targetSlots)
  const targetCategories = uniqueSortedCategories(targetSlotRows)
  const createdAt = new Date().toISOString()
  const runId = `game-map-material-slot-v47-visual-delta-${createdAt.replace(/[:.]/g, "-")}`
  const runRoot = path.join(outputRoot, runId)

  const trainingOutputRoot = ".runtime/ai-painter/natural-home-local-detail-v47-visual-delta-repair-training"
  const datasetRoot = ".runtime/ai-painter/game-map-material-slot-v47-visual-delta-dataset"
  const combinedModelRoot = ".runtime/ai-painter/natural-home-local-detail-v47-visual-delta-repair-combined"
  const categoryArg = targetCategories.join(",")

  const plan = {
    schemaVersion: "game-map-material-slot-next-repair-plan-v1",
    status: "ready_for_v47_visual_delta_repair",
    runId,
    createdAt,
    sourceArchiveRunId: archive.runId,
    sourceVisualDeltaReview: projectRelative(visualDeltaReportPath),
    sourceMaterialQualityReport: projectRelative(materialReportPath),
    purpose: "读取最新训练档案的视觉差距复盘，生成下一轮材料槽局部修复训练计划。",
    targetSummary: {
      priorityIssueCount: Array.isArray(visualDelta.priorityIssues) ? visualDelta.priorityIssues.length : 0,
      targetSlotCount: targetSlots.length,
      targetCategories,
    },
    targetSlots: targetSlotRows,
    categoryTrainingPlan: targetCategories.map((category) => ({
      category,
      targetSlotCount: targetSlotRows.filter((row) => row.modelCategory === category).length,
      outputRoot: trainingOutputRoot,
      trainCommand: `npm run train:game-map-material-slot-v47-${category.replace(/_/g, "-")}`,
    })),
    runtimePaths: {
      datasetRoot,
      trainingOutputRoot,
      combinedModelRoot,
    },
    recommendedCommands: [
      "npm run prepare:game-map-material-slot-v47-visual-delta",
      ...targetCategories.map((category) => `npm run train:game-map-material-slot-v47-${category.replace(/_/g, "-")}`),
      "npm run assemble:game-map-material-slot-v47-model-root",
      "npm run run:game-map-material-slot-inference:v47-local",
      "npm run judge:game-map-material-quality",
      "npm run build:game-map-approved-material-pack",
      "npm run write:game-map-composite-runtime-frame",
      "node scripts/run-current-game-map-material-slot-v46-runtime-pipeline.mjs --archive-existing",
      "npm run check:ai-painter-training-run-archive",
    ],
    assembleCommand:
      `node scripts/assemble-game-map-material-slot-v44-model-root.mjs ` +
      `.runtime/ai-painter/natural-home-local-detail-v46-ground-road-repair-combined ` +
      `${trainingOutputRoot} ${combinedModelRoot} ${categoryArg}`,
    acceptance: {
      materialQualityMustPass: true,
      archiveMustIncludeVisualDeltaReview: true,
      ownerReviewRequired: true,
      note: "机器通过仍不等于正式闭合；下一轮输出必须继续进入训练档案和人工复核。",
    },
  }

  writeJson(path.join(runRoot, "next-repair-plan.json"), plan)
  writeJson(path.join(outputRoot, "latest.json"), plan)
  console.log(JSON.stringify(plan, null, 2))
}

main()
