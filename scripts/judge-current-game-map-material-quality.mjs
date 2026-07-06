import fs from "node:fs"
import path from "node:path"

import sharp from "sharp"

const inferenceRoot = path.resolve(
  process.argv[2] ?? ".runtime/game-map-material-slot-inference-runs"
)
const outputFileName = "material-quality-report.json"

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8")
}

function findLatestInferenceReport(root) {
  if (!fs.existsSync(root)) return null
  const stack = [root]
  const matches = []
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.name === "latest.json" && isMaterialSlotInferenceReport(fullPath)) {
        matches.push(fullPath)
      }
    }
  }
  matches.sort()
  return matches.at(-1) ?? null
}

function isMaterialSlotInferenceReport(filePath) {
  try {
    const report = readJson(filePath)
    return (
      report?.status === "material_slot_inference_completed" &&
      typeof report.materialDir === "string" &&
      Array.isArray(report.tags) &&
      report.tags.includes("game_map_material_slot_inference") &&
      report.tags.includes("completed")
    )
  } catch {
    return false
  }
}

async function inspectImage(imagePath) {
  const image = sharp(imagePath, { failOn: "error" }).ensureAlpha()
  const metadata = await image.metadata()
  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixelCount = info.width * info.height
  let lumaSum = 0
  let lumaSqSum = 0
  let rSum = 0
  let gSum = 0
  let bSum = 0
  let alphaVisible = 0
  const palette = new Set()
  const lumas = new Float64Array(pixelCount)

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * info.channels
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const a = data[offset + 3]
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    lumas[index] = luma
    lumaSum += luma
    lumaSqSum += luma * luma
    rSum += r
    gSum += g
    bSum += b
    if (a > 12) alphaVisible += 1
    palette.add(`${r >> 4}:${g >> 4}:${b >> 4}`)
  }

  let edgeSum = 0
  let edgeSamples = 0
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const current = lumas[y * info.width + x]
      if (x + 1 < info.width) {
        edgeSum += Math.abs(current - lumas[y * info.width + x + 1])
        edgeSamples += 1
      }
      if (y + 1 < info.height) {
        edgeSum += Math.abs(current - lumas[(y + 1) * info.width + x])
        edgeSamples += 1
      }
    }
  }

  const lumaMean = lumaSum / pixelCount / 255
  const lumaVariance = lumaSqSum / pixelCount - (lumaSum / pixelCount) ** 2
  const lumaStd = Math.sqrt(Math.max(0, lumaVariance)) / 255
  const edgeDensity = edgeSamples > 0 ? edgeSum / edgeSamples / 255 : 0
  const gridMetrics = measureGridArtifactMetrics(lumas, info.width, info.height)
  const repetitiveTextureMetrics = measureRepetitiveTextureMetrics(lumas, info.width, info.height)
  const borderMetrics = measureBorderContrastMetrics(lumas, info.width, info.height)
  const denseTextureArtifact = edgeDensity > 0.055 && lumaStd > 0.075
  const flatTextureArtifact = lumaStd < 0.026 && edgeDensity < 0.009

  return {
    width: metadata.width ?? info.width,
    height: metadata.height ?? info.height,
    format: metadata.format ?? "unknown",
    bytes: fs.statSync(imagePath).size,
    lumaMean: round(lumaMean),
    lumaStd: round(lumaStd),
    edgeDensity: round(edgeDensity),
    materialGridArtifact: gridMetrics.gridArtifactSuspected,
    gridMetrics,
    repetitiveTextureArtifact: repetitiveTextureMetrics.repetitiveTextureSuspected,
    repetitiveTextureMetrics,
    denseTextureArtifact,
    flatTextureArtifact,
    brightBorderArtifact: borderMetrics.brightBorderArtifactSuspected,
    borderMetrics,
    alphaCoverage: round(alphaVisible / pixelCount),
    quantizedColorCount: palette.size,
    averageRgb: {
      r: round(rSum / pixelCount / 255),
      g: round(gSum / pixelCount / 255),
      b: round(bSum / pixelCount / 255),
    },
  }
}

function judgeSlot(slot, metrics) {
  const issues = []

  if (metrics.width < 12 || metrics.height < 12) {
    issues.push("material_too_small")
  }
  if (metrics.bytes < 800) {
    issues.push("material_file_too_small")
  }
  if (metrics.lumaMean < 0.18) {
    issues.push("material_too_dark")
  }
  if (metrics.lumaMean > 0.86) {
    issues.push("material_too_bright")
  }
  if (metrics.lumaStd < minContrast(slot.unitKind)) {
    issues.push("material_contrast_too_low")
  }
  if (metrics.edgeDensity < minEdgeDensity(slot.unitKind)) {
    issues.push("material_edge_density_too_low")
  }
  if (metrics.quantizedColorCount < minPaletteCount(slot.unitKind)) {
    issues.push("material_palette_too_poor")
  }
  if (isLargeRegionMaterial(slot.unitKind, metrics) && metrics.materialGridArtifact) {
    issues.push("material_grid_artifact_suspected")
  }
  if (isLargeRegionMaterial(slot.unitKind, metrics) && metrics.repetitiveTextureArtifact) {
    issues.push("material_repetitive_texture_suspected")
  }
  if (isLargeNaturalGroundTexture(slot.unitKind, metrics) && metrics.denseTextureArtifact) {
    issues.push("material_dense_texture_suspected")
  }
  if (isLargeNaturalGroundTexture(slot.unitKind, metrics) && metrics.flatTextureArtifact) {
    issues.push("material_flat_texture_suspected")
  }
  if (isLargeRegionMaterial(slot.unitKind, metrics) && metrics.brightBorderArtifact) {
    issues.push("material_bright_border_suspected")
  }
  if (isObjectVisualUnit(slot.unitKind) && metrics.alphaCoverage < minObjectAlphaCoverage(slot.unitKind)) {
    issues.push("object_material_alpha_coverage_too_low")
  }
  if (isObjectVisualUnit(slot.unitKind) && metrics.alphaCoverage > maxObjectAlphaCoverage(slot.unitKind)) {
    issues.push("object_material_alpha_coverage_too_high")
  }

  const { r, g, b } = metrics.averageRgb
  if (slot.unitKind === "grass_texture" && isForestLikeGrassTexture(metrics)) {
    issues.push("grass_forest_canopy_texture_suspected")
  }
  if (slot.unitKind === "water_texture" && !(b > r + 0.05 && b > g * 0.75)) {
    issues.push("water_color_identity_weak")
  }
  if (
    (slot.unitKind === "grass_texture" ||
      slot.unitKind === "boundary_texture" ||
      slot.unitKind === "tree_visual_unit" ||
      slot.unitKind === "shrub_visual_unit" ||
      slot.unitKind === "grass_detail_visual_unit") &&
    !(g >= r * 0.92 && g >= b * 0.85)
  ) {
    issues.push("green_natural_identity_weak")
  }
  if (slot.unitKind === "path_texture" && !(r >= b * 1.04 && g >= b * 1.02)) {
    issues.push("path_soil_identity_weak")
  }
  if (slot.unitKind === "path_texture" && g > r * 1.04) {
    issues.push("path_green_contamination_suspected")
  }
  if (slot.unitKind === "path_texture" && metrics.denseTextureArtifact) {
    issues.push("path_dense_texture_suspected")
  }
  if (
    slot.unitKind === "rock_visual_unit" &&
    Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)) > 0.22
  ) {
    issues.push("rock_neutral_color_identity_weak")
  }

  return {
    passed: issues.length === 0,
    issues,
  }
}

function minContrast(unitKind) {
  if (unitKind === "flower_visual_unit") return 0.045
  if (unitKind.endsWith("_visual_unit")) return 0.052
  return 0.06
}

function minEdgeDensity(unitKind) {
  if (unitKind === "water_texture") return 0.012
  if (unitKind === "path_texture") return 0.014
  if (unitKind.endsWith("_visual_unit")) return 0.016
  return 0.015
}

function minPaletteCount(unitKind) {
  if (unitKind === "flower_visual_unit") return 6
  if (unitKind.endsWith("_visual_unit")) return 8
  return 10
}

function isObjectVisualUnit(unitKind) {
  return unitKind.endsWith("_visual_unit")
}

function minObjectAlphaCoverage(unitKind) {
  if (unitKind === "rock_visual_unit") return 0.08
  if (unitKind === "flower_visual_unit") return 0.04
  return 0.12
}

function maxObjectAlphaCoverage(unitKind) {
  if (unitKind === "tree_visual_unit") return 0.86
  return 0.9
}

function isLargeRegionMaterial(unitKind, metrics) {
  const isRegionTexture = [
    "grass_texture",
    "water_texture",
    "shoreline_texture",
    "boundary_texture",
    "path_texture",
  ].includes(unitKind)
  if (!isRegionTexture) return false
  return metrics.width >= 128 && metrics.height >= 128
}

function isLargeNaturalGroundTexture(unitKind, metrics) {
  if (unitKind !== "grass_texture" && unitKind !== "boundary_texture") return false
  return metrics.width >= 128 && metrics.height >= 128
}

function isForestLikeGrassTexture(metrics) {
  const { r, g, b } = metrics.averageRgb
  const blueTooLowForOpenGrass = b < 0.06
  const contrastTooHighForOpenGrass = metrics.lumaStd > 0.16
  const overlyCanopyGreen = g > r * 1.75 && blueTooLowForOpenGrass
  const darkCanopyPatch = metrics.lumaMean < 0.31 && contrastTooHighForOpenGrass
  return overlyCanopyGreen || darkCanopyPatch
}

function measureGridArtifactMetrics(lumas, width, height) {
  const verticalDeltas = []
  for (let x = 1; x < width; x += 1) {
    verticalDeltas.push(measureVerticalDelta(lumas, width, height, x))
  }
  const horizontalDeltas = []
  for (let y = 1; y < height; y += 1) {
    horizontalDeltas.push(measureHorizontalDelta(lumas, width, height, y))
  }

  const averageVerticalSeamDelta = average(verticalDeltas) / 255
  const averageHorizontalSeamDelta = average(horizontalDeltas) / 255
  const maxVerticalGridSeamDelta = max(
    gridLines(width).map((x) => measureVerticalDelta(lumas, width, height, x))
  ) / 255
  const maxHorizontalGridSeamDelta = max(
    gridLines(height).map((y) => measureHorizontalDelta(lumas, width, height, y))
  ) / 255
  const maxVerticalGridSeamRatio = ratio(
    maxVerticalGridSeamDelta,
    averageVerticalSeamDelta
  )
  const maxHorizontalGridSeamRatio = ratio(
    maxHorizontalGridSeamDelta,
    averageHorizontalSeamDelta
  )
  const gridArtifactSuspected =
    (maxVerticalGridSeamDelta >= 0.065 && maxVerticalGridSeamRatio >= 2.1) ||
    (maxHorizontalGridSeamDelta >= 0.065 && maxHorizontalGridSeamRatio >= 2.1)

  return {
    averageVerticalSeamDelta: round(averageVerticalSeamDelta),
    averageHorizontalSeamDelta: round(averageHorizontalSeamDelta),
    maxVerticalGridSeamDelta: round(maxVerticalGridSeamDelta),
    maxHorizontalGridSeamDelta: round(maxHorizontalGridSeamDelta),
    maxVerticalGridSeamRatio: round(maxVerticalGridSeamRatio),
    maxHorizontalGridSeamRatio: round(maxHorizontalGridSeamRatio),
    gridArtifactSuspected,
  }
}

function measureRepetitiveTextureMetrics(lumas, width, height) {
  const shifts = [8, 16, 24, 32, 48, 64].filter(
    (shift) => shift < width / 2 && shift < height / 2
  )
  const horizontalShiftDeltas = shifts.map((shift) =>
    measureShiftDelta(lumas, width, height, shift, 0)
  )
  const verticalShiftDeltas = shifts.map((shift) =>
    measureShiftDelta(lumas, width, height, 0, shift)
  )
  const minHorizontalShiftDelta = min(horizontalShiftDeltas)
  const minVerticalShiftDelta = min(verticalShiftDeltas)
  const repetitiveTextureSuspected =
    minHorizontalShiftDelta <= 0.012 && minVerticalShiftDelta <= 0.014

  return {
    minHorizontalShiftDelta: round(minHorizontalShiftDelta),
    minVerticalShiftDelta: round(minVerticalShiftDelta),
    repetitiveTextureSuspected,
  }
}

function measureBorderContrastMetrics(lumas, width, height) {
  const border = Math.max(2, Math.min(8, Math.floor(Math.min(width, height) / 24)))
  const borderValues = []
  const innerValues = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = lumas[y * width + x] / 255
      if (x < border || y < border || x >= width - border || y >= height - border) {
        borderValues.push(value)
      } else if (
        x >= border * 3 &&
        y >= border * 3 &&
        x < width - border * 3 &&
        y < height - border * 3
      ) {
        innerValues.push(value)
      }
    }
  }
  const borderMean = average(borderValues)
  const innerMean = average(innerValues)
  const borderToInnerDelta = borderMean - innerMean
  const brightBorderArtifactSuspected = borderToInnerDelta >= 0.075
  return {
    borderWidth: border,
    borderMean: round(borderMean),
    innerMean: round(innerMean),
    borderToInnerDelta: round(borderToInnerDelta),
    brightBorderArtifactSuspected,
  }
}

function measureShiftDelta(lumas, width, height, shiftX, shiftY) {
  let total = 0
  let count = 0
  const step = 3
  for (let y = 0; y + shiftY < height; y += step) {
    for (let x = 0; x + shiftX < width; x += step) {
      total += Math.abs(
        lumas[y * width + x] - lumas[(y + shiftY) * width + x + shiftX]
      )
      count += 1
    }
  }
  return count > 0 ? total / count / 255 : 1
}

function measureVerticalDelta(lumas, width, height, x) {
  let total = 0
  for (let y = 0; y < height; y += 1) {
    total += Math.abs(lumas[y * width + x] - lumas[y * width + x - 1])
  }
  return total / height
}

function measureHorizontalDelta(lumas, width, height, y) {
  let total = 0
  for (let x = 0; x < width; x += 1) {
    total += Math.abs(lumas[y * width + x] - lumas[(y - 1) * width + x])
  }
  return total / width
}

function gridLines(size) {
  const lines = []
  for (let value = 64; value < size; value += 64) {
    lines.push(value)
  }
  return lines
}

function average(values) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function max(values) {
  return values.length === 0 ? 0 : Math.max(...values)
}

function min(values) {
  return values.length === 0 ? 1 : Math.min(...values)
}

function ratio(value, baseline) {
  return baseline <= 0 ? 0 : value / baseline
}

function issueSummary(slots) {
  const counts = new Map()
  for (const slot of slots) {
    for (const issue of slot.issues) {
      counts.set(issue, (counts.get(issue) ?? 0) + 1)
    }
  }
  return Object.fromEntries([...counts.entries()].sort())
}

function round(value) {
  return Math.round(value * 10000) / 10000
}

async function main() {
  const latestReportPath = findLatestInferenceReport(inferenceRoot)
  if (!latestReportPath) {
    const report = {
      schemaVersion: "game-map-material-quality-report-v1",
      status: "blocked_inference_run_missing",
      passed: false,
      generatedAt: new Date().toISOString(),
      inferenceRoot,
      blockedReasons: ["material_slot_inference_report_missing"],
      tags: ["game_map_material_quality_judge", "blocked"],
    }
    console.log(JSON.stringify(report, null, 2))
    process.exitCode = 1
    return
  }

  const inferenceReport = readJson(latestReportPath)
  const runRoot = path.dirname(latestReportPath)
  const expectedPath = path.join(runRoot, "expected-material-outputs.json")
  const expected = readJson(expectedPath)
  const materialDir = path.resolve(inferenceReport.materialDir ?? expected.materialDir)
  const slots = []

  for (const required of expected.requiredFiles) {
    const imagePath = path.resolve(required.outputPath ?? path.join(materialDir, required.outputFileName))
    if (!fs.existsSync(imagePath)) {
      slots.push({
        slotId: required.slotId,
        unitKind: required.unitKind,
        imagePath,
        passed: false,
        issues: ["material_output_missing"],
        metrics: null,
      })
      continue
    }
    const metrics = await inspectImage(imagePath)
    const judgment = judgeSlot(required, metrics)
    slots.push({
      slotId: required.slotId,
      unitKind: required.unitKind,
      imagePath,
      passed: judgment.passed,
      issues: judgment.issues,
      metrics,
    })
  }

  const failedSlots = slots.filter((slot) => !slot.passed)
  const report = {
    schemaVersion: "game-map-material-quality-report-v1",
    status:
      failedSlots.length === 0
        ? "game_map_material_quality_passed"
        : "game_map_material_quality_failed",
    passed: failedSlots.length === 0,
    generatedAt: new Date().toISOString(),
    runId: inferenceReport.runId ?? expected.runId,
    worldId: inferenceReport.worldId ?? expected.worldId,
    tick: inferenceReport.tick ?? expected.tick,
    materialDir,
    sourceInferenceReportPath: latestReportPath,
    expectedOutputsPath: expectedPath,
    summary: {
      slotCount: slots.length,
      passedCount: slots.length - failedSlots.length,
      failedCount: failedSlots.length,
      issueCounts: issueSummary(slots),
    },
    slots,
    blockedReasons:
      failedSlots.length === 0
        ? []
        : ["material_visual_quality_failed", "composite_visual_quality_must_not_enter_world"],
    tags:
      failedSlots.length === 0
        ? [
            "game_map_material_quality_judge",
            "material_visual_quality_passed",
            "ready_for_visual_judge_reviewed_material_pack",
          ]
        : [
            "game_map_material_quality_judge",
            "material_visual_quality_failed",
            "not_world_page_runtime",
          ],
  }

  const reportPath = path.join(runRoot, outputFileName)
  writeJson(reportPath, report)
  writeJson(path.join(runRoot, "latest-material-quality-report.json"), {
    schemaVersion: "game-map-material-quality-latest-v1",
    path: reportPath,
    status: report.status,
    passed: report.passed,
    generatedAt: report.generatedAt,
    runId: report.runId,
    worldId: report.worldId,
    tick: report.tick,
    summary: report.summary,
    tags: report.tags,
  })
  console.log(JSON.stringify(report, null, 2))
  if (!report.passed) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const report = {
    schemaVersion: "game-map-material-quality-report-v1",
    status: "failed",
    passed: false,
    generatedAt: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    blockedReasons: ["material_quality_judge_failed"],
    tags: ["game_map_material_quality_judge", "failed"],
  }
  console.log(JSON.stringify(report, null, 2))
  process.exit(1)
})
