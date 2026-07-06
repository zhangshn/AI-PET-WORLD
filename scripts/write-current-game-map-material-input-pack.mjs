import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const requestRoot = path.resolve(process.argv[2] ?? ".runtime/game-map-material-generation-requests")
const outputRoot = path.resolve(process.argv[3] ?? ".runtime/game-map-material-input-packs")
const compileOutputDir = path.resolve(".runtime/check-game-map-frame-material-input-pack")
const sourceDir = "src/world/game-map-frame"

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeReport(report) {
  console.log(JSON.stringify(report, null, 2))
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

function findLatestRequestIndex(root) {
  if (!fs.existsSync(root)) return null
  const stack = [root]
  const matches = []
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.name === "latest-material-generation-request.json") {
        matches.push(fullPath)
      }
    }
  }
  matches.sort()
  return matches.at(-1) ?? null
}

async function main() {
  const latestIndexPath = findLatestRequestIndex(requestRoot)
  if (!latestIndexPath) {
    writeReport({
      ok: false,
      status: "blocked_material_generation_request_missing",
      requestRoot,
      outputRoot,
      blockedReasons: ["latest_material_generation_request_missing"],
      tags: ["material_input_pack_write", "blocked"],
    })
    return
  }

  const latestIndex = readJson(latestIndexPath)
  const requestPath = path.resolve(latestIndex.path ?? "")
  if (!latestIndex.path || !fs.existsSync(requestPath)) {
    writeReport({
      ok: false,
      status: "blocked_material_generation_request_file_missing",
      latestIndexPath,
      requestPath,
      outputRoot,
      blockedReasons: ["material_generation_request_file_missing"],
      tags: ["material_input_pack_write", "blocked"],
    })
    return
  }

  compileGameMapFrameModules()
  const require = createRequire(import.meta.url)
  const materialInputPackModule = require(
    path.join(compileOutputDir, "game-map-material-input-pack.js"),
  )
  const request = readJson(requestPath)
  const result = await materialInputPackModule.buildGameMapMaterialInputPack({
    request,
    outputRoot,
    createdAt: new Date().toISOString(),
  })

  writeReport({
    ok: result.passed,
    status: result.passed ? "material_input_pack_written" : "blocked_material_input_pack",
    latestIndexPath,
    requestPath,
    requestId: request.requestId ?? null,
    worldId: request.worldId ?? null,
    tick: request.tick ?? null,
    packId: result.pack?.packId ?? null,
    packPath: result.packPath,
    slotCount: result.pack?.slots.length ?? 0,
    outputRoot,
    blockedReasons: result.blockedReasons,
    tags: result.passed
      ? ["material_input_pack_write", "written", "ready_for_local_model_slot_inference"]
      : ["material_input_pack_write", "blocked"],
  })
}

main().catch((error) => {
  writeReport({
    ok: false,
    status: "failed",
    message: error instanceof Error ? error.message : String(error),
    requestRoot,
    outputRoot,
    tags: ["material_input_pack_write", "failed"],
  })
  process.exit(1)
})
