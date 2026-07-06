import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const runtimeFrameRoot = path.resolve(process.argv[2] ?? ".runtime/game-map-runtime-frame")
const outputRoot = path.resolve(process.argv[3] ?? ".runtime/game-map-material-generation-requests")
const compileOutputDir = path.resolve(".runtime/check-game-map-frame-material-request-writer")
const sourceDir = "src/world/game-map-frame"

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeReport(report) {
  console.log(JSON.stringify(report, null, 2))
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

async function main() {
  const latestRuntimeFramePath = path.join(runtimeFrameRoot, "latest-runtime-frame.json")
  if (!fs.existsSync(latestRuntimeFramePath)) {
    writeReport({
      ok: false,
      status: "blocked_runtime_frame_missing",
      runtimeFrameRoot,
      outputRoot,
      blockedReasons: ["latest_runtime_frame_missing"],
      tags: ["material_generation_request_write", "blocked"],
    })
    return
  }

  compileGameMapFrameModules()
  const require = createRequire(import.meta.url)
  const requestModule = require(
    path.join(compileOutputDir, "game-map-material-generation-request.js"),
  )

  const latestRecord = readJson(latestRuntimeFramePath)
  const runtimeFrame = getRuntimeFrameFromLatestRecord(latestRecord)
  if (!runtimeFrame?.composition) {
    writeReport({
      ok: false,
      status: "blocked_runtime_frame_composition_missing",
      runtimeFrameRoot,
      outputRoot,
      runtimeFrameId: runtimeFrame?.runtimeFrameId ?? null,
      blockedReasons: ["runtime_frame_composition_missing"],
      tags: ["material_generation_request_write", "blocked"],
    })
    return
  }

  const result = await requestModule.writeGameMapMaterialGenerationRequest({
    manifest: runtimeFrame.composition,
    outputRoot,
    createdAt: new Date().toISOString(),
  })

  writeReport({
    ok: result.passed,
    status: result.passed
      ? "material_generation_request_written"
      : "blocked_material_generation_request",
    runtimeFrameId: runtimeFrame.runtimeFrameId ?? null,
    worldId: runtimeFrame.worldId,
    tick: runtimeFrame.tick,
    requestId: result.request?.requestId ?? null,
    taskCount: result.request?.tasks.length ?? 0,
    requestPath: result.requestPath,
    outputRoot,
    blockedReasons: result.blockedReasons,
    tags: result.passed
      ? ["material_generation_request_write", "written"]
      : ["material_generation_request_write", "blocked"],
  })
}

main().catch((error) => {
  writeReport({
    ok: false,
    status: "failed",
    message: error instanceof Error ? error.message : String(error),
    runtimeFrameRoot,
    outputRoot,
    tags: ["material_generation_request_write", "failed"],
  })
  process.exit(1)
})
