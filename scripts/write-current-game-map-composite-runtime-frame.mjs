import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
import { enrichTrainingProcessLedgerEvent } from "./lib/ai-painter-training-ledger-event-analysis.mjs"
import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"

const runtimeFrameRoot = path.resolve(process.argv[2] ?? ".runtime/game-map-runtime-frame")
const materialPackPathArg = process.argv[3] ? path.resolve(process.argv[3]) : null
const compositorOutputRoot = path.resolve(
  process.argv[4] ?? ".runtime/game-map-runtime-compositor",
)
const outputRoot = path.resolve(process.argv[5] ?? runtimeFrameRoot)
const compileOutputDir = path.resolve(".runtime/check-game-map-frame-composite-writer")
const sourceDir = "src/world/game-map-frame"
const approvedPackRoot = path.resolve(".runtime/game-map-approved-material-packs")
const ledgerDir = path.resolve(".runtime/ai-painter/training-process-ledger")
const ledgerPath = path.join(ledgerDir, "events.jsonl")
const latestLedgerPath = path.join(ledgerDir, "latest.json")
let resolvedMaterialPackPathForReport = materialPackPathArg

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeReport(report) {
  try {
    appendCompositeRuntimeFrameLedgerEvent(report)
  } catch (error) {
    report.ledgerWriteError = error instanceof Error ? error.message : String(error)
  }
  console.log(JSON.stringify(report, null, 2))
}

function readLedgerEvents() {
  if (!fs.existsSync(ledgerPath)) return []
  return fs
    .readFileSync(ledgerPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function buildLedgerSummary(events) {
  const summary = {
    total: events.length,
    running: 0,
    success: 0,
    failed: 0,
    error: 0,
    blocked: 0,
    info: 0,
    lastEvent: events.at(-1) ?? null,
  }
  for (const event of events) {
    if (Object.prototype.hasOwnProperty.call(summary, event.status)) {
      summary[event.status] += 1
    }
  }
  return summary
}

function readFormalVisualJudgeSummary(formalVisualJudgePath) {
  if (!formalVisualJudgePath || !fs.existsSync(formalVisualJudgePath)) {
    return null
  }
  const report = readJson(formalVisualJudgePath)
  return {
    status: report.status ?? null,
    passed: report.passed === true,
    issueCodes: Array.isArray(report.issues)
      ? report.issues.map((issue) => issue.code).filter(Boolean)
      : [],
    metrics: report.metrics ?? null,
  }
}

function appendCompositeRuntimeFrameLedgerEvent(report) {
  const timestamp = new Date().toISOString()
  const isSuccess = report.ok === true
  const formalSummary = readFormalVisualJudgeSummary(report.formalVisualJudgePath)
  const blockedReasons = Array.isArray(report.blockedReasons)
    ? report.blockedReasons
    : []
  const issueCodes = formalSummary?.issueCodes ?? []
  const status = isSuccess ? "success" : report.status === "failed" ? "error" : "failed"
  const runId = `game-map-composite-runtime-frame-${timestamp.replace(/[:.]/g, "-")}`
  const detailParts = [
    `status=${report.status}`,
    report.runtimeFrameId ? `runtimeFrameId=${report.runtimeFrameId}` : null,
    report.outputPath ? `outputPath=${report.outputPath}` : null,
    report.formalVisualJudgePath ? `formalVisualJudgePath=${report.formalVisualJudgePath}` : null,
    blockedReasons.length > 0 ? `blockedReasons=${blockedReasons.join(",")}` : null,
    issueCodes.length > 0 ? `formalIssues=${issueCodes.join(",")}` : null,
  ].filter(Boolean)
  const detailZhParts = [
    `状态=${report.status}`,
    report.runtimeFrameId ? `RuntimeFrame=${report.runtimeFrameId}` : null,
    report.outputPath ? `图片路径=${report.outputPath}` : null,
    report.formalVisualJudgePath ? `机器评审报告=${report.formalVisualJudgePath}` : null,
    blockedReasons.length > 0 ? `阻断原因=${blockedReasons.join(",")}` : null,
    issueCodes.length > 0 ? `机器评审失败码=${issueCodes.join(",")}` : null,
  ].filter(Boolean)

  const event = enrichTrainingProcessLedgerEvent({
    id: randomUUID(),
    timestamp,
    action: "write_game_map_composite_runtime_frame",
    runId,
    kind: isSuccess ? "step_completed" : "step_failed",
    status,
    title: isSuccess
      ? "Composite RuntimeFrame was written by the program"
      : "Composite RuntimeFrame was blocked by the program",
    titleZh: isSuccess
      ? "程序自动写入完整 RuntimeFrame"
      : "程序自动阻断完整 RuntimeFrame",
    detail: detailParts.join(" / "),
    detailZh: detailZhParts.join(" / "),
    script: "scripts/write-current-game-map-composite-runtime-frame.mjs",
    currentStep: report.status,
    error: isSuccess ? null : [...blockedReasons, ...issueCodes].join(","),
    errorZh: isSuccess ? null : `完整地图未达到机器评审或合成门槛：${[...blockedReasons, ...issueCodes].join(",")}`,
    resourceSessionId: report.runtimeFrameId ?? null,
    archiveId: report.recordPath ?? report.outputPath ?? null,
    evidencePath: report.formalVisualJudgePath ?? report.outputPath ?? report.recordPath ?? null,
  })

  fs.mkdirSync(ledgerDir, { recursive: true })
  fs.appendFileSync(ledgerPath, JSON.stringify(event) + "\n", "utf8")
  const events = readLedgerEvents()
  fs.writeFileSync(
    latestLedgerPath,
    JSON.stringify(
      {
        schemaVersion: "ai-painter-training-process-ledger-v1",
        updatedAt: events.at(-1)?.timestamp ?? null,
        events: events.slice(-80).reverse(),
        summary: buildLedgerSummary(events),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  )
  refreshAutoVisualJudgeLearning(event)
}

function refreshAutoVisualJudgeLearning(event) {
  try {
    refreshGameMapAutoVisualJudgeLearning({
      trigger: "composite_runtime_frame_ledger_event",
      triggerEventId: event.id,
    })
  } catch (error) {
    console.warn(
      `[auto-visual-judge-learning] refresh failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
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

function collectFiles(root, fileName) {
  if (!fs.existsSync(root)) return []
  const result = []
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(fullPath)
      if (entry.isFile() && entry.name === fileName) result.push(fullPath)
    }
  }
  return result.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
}

function findLatestApprovedPackPath() {
  return collectFiles(approvedPackRoot, "approved-material-pack.json")[0] ?? null
}

async function main() {
  const materialPackPath = materialPackPathArg ?? findLatestApprovedPackPath()
  resolvedMaterialPackPathForReport = materialPackPath
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
    materialPackPath: resolvedMaterialPackPathForReport,
    compositorOutputRoot,
    outputRoot,
    tags: ["game_map_composite_runtime_frame_write", "failed"],
  })
  process.exit(1)
})
