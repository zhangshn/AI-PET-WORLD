import fs from "node:fs"
import path from "node:path"

import sharp from "sharp"

const reportPath = process.argv[2] ? path.resolve(process.argv[2]) : null
const outputRoot = path.resolve(process.argv[3] ?? ".runtime/game-map-material-slot-inference-runs")

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8")
}

function safeTimestamp(value) {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")
}

function outputFileNameFromSlot(slot) {
  return `${slot.slotId}.png`
}

function isContrastFailure(slot) {
  return Array.isArray(slot.issues) && slot.issues.includes("material_contrast_too_low")
}

async function copyOrFixSlot(slot, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  const sourcePath = path.resolve(slot.imagePath)
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`material_slot_source_missing:${slot.slotId}`)
  }

  if (!isContrastFailure(slot)) {
    fs.copyFileSync(sourcePath, targetPath)
    return "copied"
  }

  const unitKind = slot.unitKind
  const contrast = unitKind === "water_texture" ? 1.18 : 1.28
  const brightnessOffset = unitKind === "water_texture" ? -10 : -18
  const saturation = unitKind === "rock_visual_unit" ? 1 : 1.08

  await sharp(sourcePath, { failOn: "error" })
    .ensureAlpha()
    .modulate({ saturation })
    .linear(contrast, brightnessOffset)
    .png()
    .toFile(targetPath)

  return "contrast_visual_fix"
}

async function main() {
  if (!reportPath || !fs.existsSync(reportPath)) {
    throw new Error("missing material quality report path")
  }

  const sourceReport = readJson(reportPath)
  if (sourceReport.schemaVersion !== "game-map-material-quality-report-v1") {
    throw new Error("source report must be game-map-material-quality-report-v1")
  }

  const sourceRunRoot = path.dirname(reportPath)
  const sourceExpectedPath = path.resolve(sourceReport.expectedOutputsPath ?? path.join(sourceRunRoot, "expected-material-outputs.json"))
  const sourceExpected = readJson(sourceExpectedPath)
  const fixedAt = new Date().toISOString()
  const runId = `material-slot-visual-fix-${sourceReport.worldId}-${sourceReport.tick}-${safeTimestamp(fixedAt)}`
  const runRoot = path.join(outputRoot, sourceReport.worldId, String(sourceReport.tick), runId)
  const materialDir = path.join(runRoot, "materials")

  const fixedSlots = []
  for (const slot of sourceReport.slots) {
    const outputFileName = outputFileNameFromSlot(slot)
    const outputPath = path.join(materialDir, outputFileName)
    const action = await copyOrFixSlot(slot, outputPath)
    fixedSlots.push({
      slotId: slot.slotId,
      unitKind: slot.unitKind,
      sourceImagePath: slot.imagePath,
      outputFileName,
      outputPath,
      action,
      sourceIssues: slot.issues ?? [],
    })
  }

  const expectedOutputs = {
    ...sourceExpected,
    schemaVersion: "game-map-material-slot-inference-expected-outputs-v1",
    runId,
    materialDir,
    requiredFiles: sourceExpected.requiredFiles.map((required) => {
      const outputFileName = outputFileNameFromSlot(required)
      return {
        ...required,
        outputFileName,
        outputPath: path.join(materialDir, outputFileName),
      }
    }),
    tags: [
      ...(sourceExpected.tags ?? []),
      "game_map_material_slot_visual_fix_contract",
      "not_program_world_render",
      "visual_expression_only",
    ],
  }

  const inferenceReport = {
    schemaVersion: "game-map-material-slot-visual-fix-v1",
    ok: true,
    status: "material_slot_visual_fix_completed",
    runId,
    sourceQualityReportPath: reportPath,
    sourceInferenceReportPath: sourceReport.sourceInferenceReportPath ?? null,
    worldId: sourceReport.worldId,
    tick: sourceReport.tick,
    materialDir,
    slotCount: fixedSlots.length,
    fixedCount: fixedSlots.filter((slot) => slot.action === "contrast_visual_fix").length,
    copiedCount: fixedSlots.filter((slot) => slot.action === "copied").length,
    fixedAt,
    slots: fixedSlots,
    tags: [
      "game_map_material_slot_visual_fix",
      "local_model_output_visual_fix",
      "visual_expression_only",
      "not_world_page_runtime",
      "requires_material_quality_judge",
    ],
  }

  writeJson(path.join(runRoot, "expected-material-outputs.json"), expectedOutputs)
  writeJson(path.join(runRoot, "latest.json"), inferenceReport)
  writeJson(path.join(runRoot, "material-visual-fix-report.json"), inferenceReport)
  console.log(JSON.stringify(inferenceReport, null, 2))
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        ok: false,
        status: "material_slot_visual_fix_failed",
        message: error instanceof Error ? error.message : String(error),
        tags: ["game_map_material_slot_visual_fix", "failed"],
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
