import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const runtimeFrameRoot = path.resolve(process.argv[2] ?? ".runtime/game-map-runtime-frame")
const materialDir = process.argv[3] ? path.resolve(process.argv[3]) : null
const outputRoot = path.resolve(process.argv[4] ?? ".runtime/game-map-approved-material-packs")
const compileOutputDir = path.resolve(".runtime/check-game-map-frame-material-pack-builder")
const sourceDir = "src/world/game-map-frame"

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeReport(report) {
  console.log(JSON.stringify(report, null, 2))
}

function writeBlockedReport(report) {
  writeReport(report)
  process.exitCode = 1
}

function getRuntimeFrameFromLatestRecord(record) {
  return record && typeof record === "object" && record.runtimeFrame
    ? record.runtimeFrame
    : record
}

function compileGameMapFrameModules() {
  fs.rmSync(compileOutputDir, { recursive: true, force: true })
  fs.mkdirSync(compileOutputDir, { recursive: true })

  const sourceFiles = fs
    .readdirSync(sourceDir)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => `${sourceDir}/${file}`)

  const compile = spawnSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      ...sourceFiles,
      "--outDir",
      compileOutputDir,
      "--module",
      "commonjs",
      "--target",
      "es2020",
      "--moduleResolution",
      "node",
      "--skipLibCheck",
      "--esModuleInterop",
      "--strict",
      "--noEmit",
      "false",
    ],
    { stdio: "inherit" },
  )

  if (compile.status !== 0) {
    throw new Error("game_map_frame_compile_failed")
  }
}

function collectMaterialFiles(manifest, qualityReport) {
  const reportSlotById = new Map(
    (qualityReport.slots ?? []).map((slot) => [slot.slotId, slot])
  )
  return manifest.visualUnitSlots.map((slot) => {
    const reportSlot = reportSlotById.get(slot.slotId)
    const imagePath =
      typeof reportSlot?.imagePath === "string" ? reportSlot.imagePath : ""
    return {
      slotId: slot.slotId,
      imagePath,
      approvedAssetId: `approved-material-${slot.slotId}`,
      tags: ["approved_ai_painter_visual_unit_material"],
    }
  })
}

function findQualityReport(root) {
  const directReportPath = path.join(root, "material-quality-report.json")
  const parentReportPath = path.join(path.dirname(root), "material-quality-report.json")
  const reportPath = fs.existsSync(directReportPath)
    ? directReportPath
    : fs.existsSync(parentReportPath)
      ? parentReportPath
      : null
  if (!reportPath) return null
  return {
    reportPath,
    report: readJson(reportPath),
  }
}

async function main() {
  const latestRuntimeFramePath = path.join(runtimeFrameRoot, "latest-runtime-frame.json")
  if (!fs.existsSync(latestRuntimeFramePath)) {
    writeBlockedReport({
      ok: false,
      status: "blocked_runtime_frame_missing",
      runtimeFrameRoot,
      materialDir,
      outputRoot,
      blockedReasons: ["latest_runtime_frame_missing"],
      tags: ["approved_material_pack_build", "blocked"],
    })
    return
  }
  if (!materialDir || !fs.existsSync(materialDir)) {
    writeBlockedReport({
      ok: false,
      status: "blocked_material_dir_missing",
      runtimeFrameRoot,
      materialDir,
      outputRoot,
      blockedReasons: ["material_dir_missing"],
      tags: ["approved_material_pack_build", "blocked"],
    })
    return
  }

  compileGameMapFrameModules()
  const require = createRequire(import.meta.url)
  const materialPackBuilder = require(
    path.join(compileOutputDir, "game-map-approved-visual-unit-material-pack-builder.js"),
  )

  const latestRecord = readJson(latestRuntimeFramePath)
  const runtimeFrame = getRuntimeFrameFromLatestRecord(latestRecord)
  if (!runtimeFrame?.composition) {
    writeBlockedReport({
      ok: false,
      status: "blocked_runtime_frame_composition_missing",
      runtimeFrameRoot,
      materialDir,
      outputRoot,
      runtimeFrameId: runtimeFrame?.runtimeFrameId ?? null,
      blockedReasons: ["runtime_frame_composition_missing"],
      tags: ["approved_material_pack_build", "blocked"],
    })
    return
  }

  const manifest = runtimeFrame.composition
  const qualityReportLoad = findQualityReport(materialDir)
  if (!qualityReportLoad) {
    writeBlockedReport({
      ok: false,
      status: "blocked_material_quality_report_missing",
      runtimeFrameId: runtimeFrame.runtimeFrameId ?? null,
      materialDir,
      outputRoot,
      blockedReasons: ["material_quality_report_missing"],
      tags: ["approved_material_pack_build", "blocked"],
    })
    return
  }

  const materialFiles = collectMaterialFiles(manifest, qualityReportLoad.report)
  const missingFiles = materialFiles
    .filter((file) => !fs.existsSync(file.imagePath))
    .map((file) => file.slotId)
  if (missingFiles.length > 0) {
    writeBlockedReport({
      ok: false,
      status: "blocked_material_files_missing",
      runtimeFrameId: runtimeFrame.runtimeFrameId ?? null,
      materialDir,
      outputRoot,
      missingSlotIds: missingFiles,
      blockedReasons: ["material_files_missing", ...missingFiles],
      tags: ["approved_material_pack_build", "blocked"],
    })
    return
  }

  const result = await materialPackBuilder.buildGameMapApprovedMaterialPackFromFiles({
    manifest,
    materialFiles,
    outputRoot,
    reviewer: "visual_judge",
    qualityReport: qualityReportLoad.report,
    reviewedAt: new Date().toISOString(),
    notes: [
      "Built from AI Painter visual unit files that passed material VisualJudge.",
      `Material quality report: ${qualityReportLoad.reportPath}`,
    ],
  })

  const report = {
    ok: result.passed,
    status: result.passed
      ? "approved_material_pack_written"
      : "blocked_material_pack_build",
    runtimeFrameId: runtimeFrame.runtimeFrameId ?? null,
    worldId: runtimeFrame.worldId,
    tick: runtimeFrame.tick,
    materialDir,
    qualityReportPath: qualityReportLoad.reportPath,
    outputRoot,
    packId: result.pack?.packId ?? null,
    packPath: result.packPath,
    materialCount: result.pack?.materials.length ?? 0,
    blockedReasons: result.blockedReasons,
    tags: result.passed
      ? ["approved_material_pack_build", "written", "ready_for_runtime_compositor"]
      : ["approved_material_pack_build", "blocked"],
  }

  if (result.passed) {
    writeReport(report)
  } else {
    writeBlockedReport(report)
  }
}

main().catch((error) => {
  writeReport({
    ok: false,
    status: "failed",
    message: error instanceof Error ? error.message : String(error),
    runtimeFrameRoot,
    materialDir,
    outputRoot,
    tags: ["approved_material_pack_build", "failed"],
  })
  process.exit(1)
})
