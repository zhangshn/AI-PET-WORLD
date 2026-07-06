import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const runtimeFrameRoot = path.resolve(process.argv[2] ?? ".runtime/game-map-runtime-frame")
const materialPackPath = process.argv[3] ? path.resolve(process.argv[3]) : null
const compositorOutputRoot = path.resolve(
  process.argv[4] ?? ".runtime/game-map-runtime-compositor",
)
const outputRoot = path.resolve(process.argv[5] ?? runtimeFrameRoot)
const compileOutputDir = path.resolve(".runtime/check-game-map-frame-composite-writer")
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

function uniqueTags(tags) {
  return Array.from(new Set(tags.filter((tag) => typeof tag === "string" && tag.length > 0)))
}

function buildBlockedRuntimeFrame(runtimeFrame, blockedReasons) {
  const blockedFrame = JSON.parse(JSON.stringify(runtimeFrame))
  const reasons = uniqueTags([
    "composite_output_missing",
    ...(Array.isArray(blockedReasons) ? blockedReasons : []),
  ])

  blockedFrame.worldPageContract = {
    ...blockedFrame.worldPageContract,
    canShowInWorld: false,
  }
  blockedFrame.composition = {
    ...blockedFrame.composition,
    compositeOutput: null,
    compositionStatus: {
      ...(blockedFrame.composition?.compositionStatus ?? {}),
      canEnterWorld: false,
      blockedReasons: reasons,
    },
    tags: uniqueTags([
      ...((blockedFrame.composition?.tags ?? []).filter(
        (tag) =>
          tag !== "world_ready_composite_manifest" &&
          tag !== "composite_runtime_image_bound",
      )),
      "runtime_composite_blocked",
      "world_page_blocked_until_formal_visual_judge",
    ]),
  }
  blockedFrame.tags = uniqueTags([
    ...((blockedFrame.tags ?? []).filter(
      (tag) =>
        tag !== "game_map_runtime_frame_world_ready" &&
        tag !== "p7_9_complete_game_map_runtime_frame",
    )),
    "world_page_blocked_until_formal_visual_judge",
    "runtime_composite_blocked",
  ])

  return blockedFrame
}

async function writeBlockedLatestRuntimeFrame({
  runtimeFrameStoreModule,
  runtimeFrame,
  outputRoot,
  blockedReasons,
}) {
  if (!runtimeFrame?.worldPageContract || !runtimeFrame?.composition) {
    return null
  }

  return await runtimeFrameStoreModule.writeGameMapRuntimeFrameRecord({
    runtimeFrame: buildBlockedRuntimeFrame(runtimeFrame, blockedReasons),
    outputRoot,
    createdAt: new Date().toISOString(),
  })
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
      latestRuntimeFramePath,
      materialPackPath,
      outputRoot,
      blockedReasons: ["latest_runtime_frame_missing"],
      tags: ["game_map_composite_runtime_frame_write", "blocked"],
    })
    return
  }
  if (!materialPackPath || !fs.existsSync(materialPackPath)) {
    writeReport({
      ok: false,
      status: "blocked_material_pack_missing",
      latestRuntimeFramePath,
      materialPackPath,
      outputRoot,
      blockedReasons: ["approved_visual_unit_material_pack_missing"],
      tags: ["game_map_composite_runtime_frame_write", "blocked"],
    })
    return
  }

  compileGameMapFrameModules()
  const require = createRequire(import.meta.url)
  const materialPackModule = require(
    path.join(compileOutputDir, "game-map-approved-visual-unit-material-pack.js"),
  )
  const runtimeCompositorModule = require(
    path.join(compileOutputDir, "game-map-runtime-compositor.js"),
  )
  const runtimeFrameFinalizerModule = require(
    path.join(compileOutputDir, "game-map-runtime-frame-finalizer.js"),
  )
  const runtimeFrameStoreModule = require(
    path.join(compileOutputDir, "game-map-runtime-frame-store.js"),
  )

  const latestRecord = readJson(latestRuntimeFramePath)
  const runtimeFrame = getRuntimeFrameFromLatestRecord(latestRecord)
  if (!runtimeFrame?.composition) {
    writeReport({
      ok: false,
      status: "blocked_runtime_frame_composition_missing",
      latestRuntimeFramePath,
      materialPackPath,
      outputRoot,
      runtimeFrameId: runtimeFrame?.runtimeFrameId ?? null,
      blockedReasons: ["runtime_frame_composition_missing"],
      tags: ["game_map_composite_runtime_frame_write", "blocked"],
    })
    return
  }

  const packLoad = await materialPackModule.loadGameMapApprovedVisualUnitMaterialPack(
    materialPackPath,
  )
  if (!packLoad.passed || !packLoad.pack) {
    writeReport({
      ok: false,
      status: "blocked_material_pack_invalid",
      latestRuntimeFramePath,
      materialPackPath,
      outputRoot,
      blockedReasons: packLoad.blockedReasons,
      tags: ["game_map_composite_runtime_frame_write", "blocked"],
    })
    return
  }

  const materialBinding = materialPackModule.bindGameMapCompositeMaterialsFromPack({
    manifest: runtimeFrame.composition,
    pack: packLoad.pack,
  })
  if (!materialBinding.passed || !materialBinding.manifest) {
    const blockedWrite = await writeBlockedLatestRuntimeFrame({
      runtimeFrameStoreModule,
      runtimeFrame,
      outputRoot,
      blockedReasons: materialBinding.blockedReasons,
    })
    writeReport({
      ok: false,
      status: "blocked_material_binding",
      runtimeFrameId: runtimeFrame.runtimeFrameId ?? null,
      materialPackPath,
      outputRoot,
      blockedReasons: materialBinding.blockedReasons,
      blockedLatestPath: blockedWrite?.latestPath ?? null,
      blockedLatestStatus: blockedWrite?.status ?? null,
      blockedLatestWarnings: blockedWrite?.warnings ?? [],
      tags: ["game_map_composite_runtime_frame_write", "blocked"],
    })
    return
  }

  const compositorResult = await runtimeCompositorModule.composeGameMapRuntimeOutput({
    manifest: materialBinding.manifest,
    outputRoot: compositorOutputRoot,
    composedAt: new Date().toISOString(),
  })
  if (!compositorResult.passed || !compositorResult.manifest) {
    const blockedWrite = await writeBlockedLatestRuntimeFrame({
      runtimeFrameStoreModule,
      runtimeFrame,
      outputRoot,
      blockedReasons: compositorResult.blockedReasons,
    })
    writeReport({
      ok: false,
      status: "blocked_runtime_compositor",
      runtimeFrameId: runtimeFrame.runtimeFrameId ?? null,
      materialPackPath,
      outputRoot,
      outputPath: compositorResult.outputPath,
      auditPath: compositorResult.auditPath,
      formalVisualJudgePath: compositorResult.formalVisualJudgePath,
      blockedReasons: compositorResult.blockedReasons,
      blockedLatestPath: blockedWrite?.latestPath ?? null,
      blockedLatestStatus: blockedWrite?.status ?? null,
      blockedLatestWarnings: blockedWrite?.warnings ?? [],
      tags: ["game_map_composite_runtime_frame_write", "blocked"],
    })
    return
  }

  const finalized = runtimeFrameFinalizerModule.finalizeGameMapRuntimeFrameForWorld({
    runtimeFrame,
    composition: compositorResult.manifest,
  })
  if (!finalized.passed || !finalized.runtimeFrame) {
    const blockedWrite = await writeBlockedLatestRuntimeFrame({
      runtimeFrameStoreModule,
      runtimeFrame,
      outputRoot,
      blockedReasons: finalized.blockedReasons,
    })
    writeReport({
      ok: false,
      status: "blocked_runtime_frame_finalizer",
      runtimeFrameId: runtimeFrame.runtimeFrameId ?? null,
      materialPackPath,
      outputRoot,
      outputPath: compositorResult.outputPath,
      auditPath: compositorResult.auditPath,
      formalVisualJudgePath: compositorResult.formalVisualJudgePath,
      blockedReasons: finalized.blockedReasons,
      blockedLatestPath: blockedWrite?.latestPath ?? null,
      blockedLatestStatus: blockedWrite?.status ?? null,
      blockedLatestWarnings: blockedWrite?.warnings ?? [],
      tags: ["game_map_composite_runtime_frame_write", "blocked"],
    })
    return
  }

  const writeResult = await runtimeFrameStoreModule.writeGameMapRuntimeFrameRecord({
    runtimeFrame: finalized.runtimeFrame,
    outputRoot,
    createdAt: new Date().toISOString(),
  })

  writeReport({
    ok: writeResult.status === "written",
    status:
      writeResult.status === "written"
        ? "composite_runtime_frame_written"
        : "blocked_runtime_frame_write",
    runtimeFrameId: finalized.runtimeFrame.runtimeFrameId,
    worldId: finalized.runtimeFrame.worldId,
    tick: finalized.runtimeFrame.tick,
    materialPackPath,
    outputPath: compositorResult.outputPath,
    auditPath: compositorResult.auditPath,
    formalVisualJudgePath: compositorResult.formalVisualJudgePath,
    recordPath: writeResult.recordPath,
    latestPath: writeResult.latestPath,
    blockedReasons: writeResult.warnings,
    tags:
      writeResult.status === "written"
        ? ["game_map_composite_runtime_frame_write", "written", "world_page_ready"]
        : ["game_map_composite_runtime_frame_write", "blocked"],
  })
}

main().catch((error) => {
  writeReport({
    ok: false,
    status: "failed",
    message: error instanceof Error ? error.message : String(error),
    runtimeFrameRoot,
    materialPackPath,
    compositorOutputRoot,
    outputRoot,
    tags: ["game_map_composite_runtime_frame_write", "failed"],
  })
  process.exit(1)
})
