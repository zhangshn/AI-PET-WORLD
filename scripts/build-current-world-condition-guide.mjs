import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { appendAiPainterProgramEvent, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const taskArg = argumentValue("--task")
const conditionArg = argumentValue("--condition-pack")
const latest = taskArg ? null : readJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const taskPath = resolveProjectPath(taskArg ?? latest.taskPath)
const task = readJson(taskPath)
const taskDir = path.dirname(taskPath)
const conditionPackPath = resolveProjectPath(conditionArg ?? path.join(taskDir, "compiled-conditions", "condition-pack.json"))
const conditionPack = readJson(conditionPackPath)
const width = conditionPack.canvas.width
const height = conditionPack.canvas.height
const channelMap = new Map(conditionPack.channels.map((channel) => [channel.id, channel]))
const fullWorldContract = task.worldFrameContract ?? task.directorPlan?.worldFrameContract ?? null
if (task.v7SlotBinding?.slotId && /^v7-capacity-slot-(14[6-9]|1[5-9][0-9]|20[0-9])$/.test(task.v7SlotBinding.slotId)) {
  assert(fullWorldContract?.contractVersion === "complete-rectangular-world-and-future-dynamic-readiness-v2", "Thailand rebuild64 task is missing the full-world contract")
  assert(fullWorldContract.frameCoverage?.continuousWorldSurfaceMustFillRectangleEdgeToEdge === true, "Thailand rebuild64 task does not require full rectangular world coverage")
  assert(channelMap.get("terrain_grass")?.statistics?.nonZeroCount === width * height, "terrain_grass must provide an in-world surface for every canvas pixel")
}
const colors = {
  terrain_grass: [102, 155, 72],
  terrain_water: [43, 112, 156],
  terrain_shoreline: [130, 116, 76],
  terrain_path_ground: [181, 137, 76],
  terrain_mud_patch: [120, 88, 62],
  terrain_tall_grass: [69, 128, 52],
  terrain_natural_boundary: [82, 134, 61],
  object_tree: [18, 62, 28],
  object_rock: [111, 111, 105],
  object_vegetation: [54, 106, 45],
}
const ordered = ["terrain_grass", "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "terrain_shoreline", "terrain_water", "terrain_path_ground", "object_vegetation", "object_tree", "object_rock"]
const rgb = Buffer.alloc(width * height * 3, 0)
for (const id of ordered) {
  const channel = channelMap.get(id)
  if (!channel) continue
  const { data, info } = await sharp(resolveProjectPath(channel.path)).raw().toBuffer({ resolveWithObject: true })
  assert(info.width === width && info.height === height && info.channels >= 1, `invalid guide channel: ${id}`)
  const color = colors[id]
  for (let index = 0; index < width * height; index += 1) {
    if (data[index * info.channels] === 0) continue
    const offset = index * 3
    const renderedColor = id === "terrain_natural_boundary"
      ? naturalBoundaryInWorldTextureColor(index, width, color)
      : color
    rgb[offset] = renderedColor[0]
    rgb[offset + 1] = renderedColor[1]
    rgb[offset + 2] = renderedColor[2]
  }
}
const guidePath = path.join(taskDir, "compiled-conditions", "condition-guide.png")
await sharp(rgb, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(guidePath)
const timestamp = new Date().toISOString()
const manifest = {
  schemaVersion: "complete-world-condition-guide-v2",
  guideId: `condition-guide-${conditionPack.conditionPackId}`,
  status: "model_condition_guide_ready",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  worldId: conditionPack.worldId,
  tick: conditionPack.tick,
  worldProfileId: conditionPack.worldProfileId,
  taskId: conditionPack.taskId,
  taskPath: projectPath(taskPath),
  conditionPackId: conditionPack.conditionPackId,
  conditionPackPath: projectPath(conditionPackPath),
  conditionPackSha256: conditionPack.conditionPackSha256,
  guidePath: projectPath(guidePath),
  guideSha256: sha256File(guidePath),
  guideSize: { width, height },
  sourceChannelIds: ordered.filter((id) => channelMap.has(id)),
  fullWorldRenderingContract: fullWorldContract ? {
    contractVersion: fullWorldContract.contractVersion,
    everyPixelIsInWorld: true,
    baseSurfaceChannelId: "terrain_grass",
    baseSurfaceCoverageRatio: 1,
    naturalBoundarySemantic: "dense_in_world_edge_ecology_not_external_background",
    layerOrder: ordered,
    externalBackdropAllowed: false,
    floatingMapOrIslandCutoutAllowed: false,
    solidColorMatteAllowed: false,
  } : null,
  excludedCompatibilityChannelIds: ["focal_area"],
  outputKind: "semantic_condition_guide_not_training_rgb",
  generatesWorldFacts: false,
  trainingTargetEligible: false,
  directWorldDisplayAllowed: false,
  programDrawnFinalArtUsed: false,
  automaticStorage: true,
}
const manifestPath = path.join(taskDir, "compiled-conditions", "condition-guide-manifest.json")
writeJsonAtomic(manifestPath, manifest)
const runId = task.capacitySlot?.slotId
  ? path.basename(path.dirname(taskDir))
  : task.taskId
indexWrittenArtifact(guidePath, runId)
indexWrittenArtifact(manifestPath, runId)
appendAiPainterProgramEvent({
  runId,
  status: "success",
  stage: "current_world_condition_guide_built",
  action: "build_current_world_condition_guide",
  kind: "condition_guide",
  titleZh: "当前完整地图任务的语义条件引导图已由程序生成并保存",
  titleEn: "The semantic condition guide for the current complete-map task was generated and saved by the program",
  summaryZh: "该引导图仅表达23通道语义，不是训练RGB、候选图或正式游戏画面。",
  summaryEn: "This guide expresses only the 23-channel semantics; it is not a training RGB, candidate, or formal game frame.",
  evidence: [projectPath(guidePath), projectPath(manifestPath)],
})
closeStorageCatalog()
console.log(JSON.stringify({ ...manifest, manifestPath: projectPath(manifestPath) }, null, 2))

function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function naturalBoundaryInWorldTextureColor(index, width, baseColor) {
  const x = index % width
  const y = Math.floor(index / width)
  const coarse = (Math.floor(x / 8) + Math.floor(y / 8)) % 2
  const canopyMark = (Math.floor(x / 5) * 3 + Math.floor(y / 5) * 5) % 11 === 0
  if (canopyMark) return [58, 111, 48]
  return coarse
    ? baseColor
    : [Math.min(255, baseColor[0] + 9), Math.min(255, baseColor[1] + 10), Math.min(255, baseColor[2] + 6)]
}
function indexWrittenArtifact(filePath, runId) {
  const stat = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha256File(filePath),
  })
}
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
