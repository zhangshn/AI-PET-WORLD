import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const runtimeIndexPath = path.resolve(process.argv[2] ?? "data/world-runtime/latest-world.json")
const approvedRoot = path.resolve(process.argv[3] ?? "data/world-approved-frames")
const outputRoot = path.resolve(process.argv[4] ?? ".runtime/game-map-runtime-frame")
const compileOutputDir = path.resolve(".runtime/check-game-map-frame-current-pipeline")
const sourceDir = "src/world/game-map-frame"

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeReport(report) {
  console.log(JSON.stringify(report, null, 2))
}

function buildSourceFactIds(saveRecord) {
  const homeMapState = saveRecord.homeMapState ?? {}
  const zones = Array.isArray(homeMapState.zones) ? homeMapState.zones : []
  const placements = Array.isArray(homeMapState.placements) ? homeMapState.placements : []
  const constructionPlans = Array.isArray(homeMapState.constructionPlans)
    ? homeMapState.constructionPlans
    : []
  const mapDiffs = Array.isArray(homeMapState.mapDiffs) ? homeMapState.mapDiffs : []
  const recentEvents = Array.isArray(saveRecord.recentEvents) ? saveRecord.recentEvents : []

  return [
    saveRecord.worldId,
    ...zones.map((zone) => zone.id),
    ...placements.map((placement) => placement.id),
    ...constructionPlans.map((plan) => plan.id),
    ...mapDiffs.map((diff) => diff.id),
    ...recentEvents.map((event) => event.id),
  ].filter((id) => typeof id === "string" && id.trim().length > 0)
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

function readCurrentRuntime() {
  if (!fs.existsSync(runtimeIndexPath)) {
    return {
      status: "blocked_runtime_index_missing",
      runtimeIndex: null,
      runtimeSave: null,
      warnings: [`runtime_index_missing:${runtimeIndexPath}`],
    }
  }

  const runtimeIndex = readJson(runtimeIndexPath)
  const runtimePath = path.resolve(runtimeIndex.path ?? "")
  if (!runtimeIndex.path || !fs.existsSync(runtimePath)) {
    return {
      status: "blocked_runtime_save_missing",
      runtimeIndex,
      runtimeSave: null,
      warnings: [`runtime_save_missing:${runtimePath}`],
    }
  }

  return {
    status: "runtime_found",
    runtimeIndex,
    runtimeSave: readJson(runtimePath),
    warnings: [],
  }
}

function readApprovedFrameRecord(runtimeSave) {
  const approvedIndexPath = path.join(
    approvedRoot,
    runtimeSave.ownerId,
    runtimeSave.worldId,
    "latest-approved-frame.json",
  )

  if (!fs.existsSync(approvedIndexPath)) {
    return {
      status: "blocked_approved_frame_missing",
      approvedIndexPath,
      approvedFrameRecord: null,
      warnings: [`approved_frame_index_missing:${approvedIndexPath}`],
    }
  }

  const approvedIndex = readJson(approvedIndexPath)
  const approvedRecordPath = path.resolve(approvedIndex.path ?? "")
  if (!approvedIndex.path || !fs.existsSync(approvedRecordPath)) {
    return {
      status: "blocked_approved_frame_record_missing",
      approvedIndexPath,
      approvedFrameRecord: null,
      warnings: [`approved_frame_record_missing:${approvedRecordPath}`],
    }
  }

  return {
    status: "approved_frame_found",
    approvedIndexPath,
    approvedFrameRecord: readJson(approvedRecordPath),
    warnings: [],
  }
}

async function main() {
  const runtimeRead = readCurrentRuntime()
  if (!runtimeRead.runtimeSave) {
    writeReport({
      ok: false,
      status: runtimeRead.status,
      runtimeIndexPath,
      outputRoot,
      warnings: runtimeRead.warnings,
      tags: ["game_map_runtime_frame_write", "blocked"],
    })
    return
  }

  const runtimeSave = runtimeRead.runtimeSave
  const sourceFactIds = buildSourceFactIds(runtimeSave)
  const approvedRead = readApprovedFrameRecord(runtimeSave)

  compileGameMapFrameModules()
  const require = createRequire(import.meta.url)
  const approvedSourceModule = require(
    path.join(compileOutputDir, "game-map-approved-frame-source.js"),
  )

  const result = await approvedSourceModule.runCurrentWorldRuntimeFramePipeline({
    saveRecord: runtimeSave,
    sourceFactIds,
    approvedFrameRecord: approvedRead.approvedFrameRecord,
    allowStructuredFallback: true,
    outputRoot,
    createdAt: new Date().toISOString(),
  })

  writeReport({
    ok: result.passed,
    status: result.status,
    ownerId: runtimeSave.ownerId,
    worldId: runtimeSave.worldId,
    tick: runtimeSave.tick,
    sourceFactCount: sourceFactIds.length,
    runtimeFrameId: result.runtimeFrame?.runtimeFrameId ?? null,
    recordPath: result.writeResult?.recordPath ?? null,
    latestPath: result.writeResult?.latestPath ?? null,
    approvedFrameStatus: approvedRead.status,
    blockedReasons: result.blockedReasons,
    warnings: [...approvedRead.warnings, ...(result.writeResult?.warnings ?? [])],
    tags: [
      ...result.tags,
      result.runtimeFrame?.visual?.source === "ai_painter_approved_frame"
        ? "approved_frame_visual_layer_used"
        : "structured_fallback_visual_layer_used",
    ],
  })
}

main().catch((error) => {
  writeReport({
    ok: false,
    status: "failed",
    message: error instanceof Error ? error.message : String(error),
    runtimeIndexPath,
    approvedRoot,
    outputRoot,
    tags: ["game_map_runtime_frame_write", "failed"],
  })
  process.exit(1)
})
