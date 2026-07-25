import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const TASK_ROOT = path.join(ROOT, ".runtime", "ai-painter", "world-visual-generation-task-packages")
const explicitTaskPath = argumentValue("--task")
const explicitManifestPath = argumentValue("--task-manifest")
const latestTask = explicitManifestPath
  ? readRequiredJson(resolveProjectPath(explicitManifestPath))
  : readRequiredJson(path.join(TASK_ROOT, "latest.json"))
const taskPath = resolveProjectPath(explicitTaskPath ?? latestTask.taskPath)
const task = readRequiredJson(taskPath)
const taskDir = path.dirname(taskPath)
const outputDir = path.join(taskDir, "compiled-conditions")
const channelDir = path.join(outputDir, "channels")
const manifestPath = path.join(outputDir, "manifest.json")
const conditionPackPath = path.join(outputDir, "condition-pack.json")
const timestamp = new Date().toISOString()

assert(task.schemaVersion === "runtime-frame-generation-task-v1", "unsupported task package schema")
assert(task.taskId === latestTask.taskId, "task identity does not match latest pointer")
assert(task.dictionaryVersionId === latestTask.dictionaryVersionId, "dictionary identity mismatch")
assert(task.worldId === latestTask.worldId && task.tick === latestTask.tick, "world identity mismatch")
assert(task.outputSize?.frameScope === "complete_runtime_frame", "condition compiler requires a complete map task")
assert(Number.isInteger(task.outputSize?.width) && Number.isInteger(task.outputSize?.height), "invalid output size")
assert(task.sourceBindings?.visualFactManifestPath, "visual fact manifest binding missing")

const visualFactPath = resolveProjectPath(task.sourceBindings.visualFactManifestPath)
const visualFactBytes = fs.readFileSync(visualFactPath)
const visualFacts = JSON.parse(visualFactBytes.toString("utf8"))
assert(visualFacts.manifestId === task.sourceBindings.visualFactManifestId, "visual fact manifest identity mismatch")
assert(visualFacts.worldId === task.worldId && visualFacts.tick === task.tick, "visual fact world identity mismatch")
assert(visualFacts.passed === true, "visual fact manifest did not pass")
assert((visualFacts.forbiddenLeakIds ?? []).length === 0, "visual fact manifest contains forbidden leaks")
assert(visualFacts.manifestSha256 === task.sourceBindings.visualFactManifestSha256, "visual fact manifest hash mismatch")
const visualFactCanonical = { ...visualFacts }
delete visualFactCanonical.manifestSha256
assert(
  sha256(Buffer.from(JSON.stringify(visualFactCanonical))) === task.sourceBindings.visualFactManifestSha256,
  "visual fact manifest canonical hash mismatch",
)

const width = task.outputSize.width
const height = task.outputSize.height
const terrainRegions = task.spatialLayers?.terrainRegions ?? []
const walkableRegions = task.spatialLayers?.walkableRegions ?? []
const collisionRegions = task.spatialLayers?.collisionRegions ?? []
const objectFootprints = task.spatialLayers?.objectFootprints ?? []
assert(terrainRegions.length > 0, "terrain regions missing")
assert(walkableRegions.length > 0, "walkable regions missing")
assert(collisionRegions.length > 0, "collision regions missing")
assert(objectFootprints.length > 0, "object footprints missing")

fs.mkdirSync(channelDir, { recursive: true })

const terrainKinds = ["grass", "water", "path_ground", "shoreline", "natural_boundary", "mud_patch", "tall_grass"]
const binaryMasks = new Map()
for (const kind of terrainKinds) {
  binaryMasks.set(`terrain_${normalizeName(kind)}`, rasterizePolygons(
    terrainRegions.filter((region) => region.kind === kind),
    width,
    height,
  ))
}
binaryMasks.set("walkable", rasterizePolygons(walkableRegions, width, height))
binaryMasks.set("collision", rasterizePolygons(collisionRegions, width, height))
binaryMasks.set("object_footprints", rasterizeFootprints(objectFootprints, width, height))
binaryMasks.set("object_tree", rasterizeFootprints(objectFootprints.filter((item) => item.kind === "tree"), width, height))
binaryMasks.set("object_rock", rasterizeFootprints(objectFootprints.filter((item) => item.kind === "rock"), width, height))
binaryMasks.set("object_vegetation", rasterizeFootprints(
  objectFootprints.filter((item) => !["tree", "rock"].includes(item.kind)),
  width,
  height,
))

const presetHomeSiteFact = visualFacts.visualFacts?.find((fact) => ["visual_center", "home_center"].includes(fact.semanticType))
assert(!presetHomeSiteFact, "preset_home_site_or_construction_clearing_forbidden")
binaryMasks.set("focal_area", Buffer.alloc(width * height, 0))

const channels = []
for (const [id, pixels] of binaryMasks) {
  channels.push(await writeChannel({
    id,
    pixels,
    kind: "binary_mask",
    semantics: binarySemantics(id),
    derivation: "rasterized_from_current_task_geometry",
    sourceRefs: sourceRefsForBinary(id, task),
  }))
}

channels.push(await writeChannel({
  id: "object_instance",
  pixels: rasterizeInstances(objectFootprints, width, height),
  kind: "instance_map",
  semantics: "Stable non-zero value per current object footprint; identity table is stored in condition-pack.json.",
  derivation: "rasterized_from_current_object_footprints",
  sourceRefs: objectFootprints.map((item) => item.objectId),
}))

channels.push(await writeChannel({
  id: "coordinate_x",
  pixels: coordinateChannel(width, height, "x"),
  kind: "continuous_map",
  semantics: "Normalized complete-map horizontal coordinate.",
  derivation: "deterministic_canvas_coordinate",
  sourceRefs: ["spatial-grid/complete-map-canvas-contract"],
}))
channels.push(await writeChannel({
  id: "coordinate_y",
  pixels: coordinateChannel(width, height, "y"),
  kind: "continuous_map",
  semantics: "Normalized complete-map vertical coordinate.",
  derivation: "deterministic_canvas_coordinate",
  sourceRefs: ["spatial-grid/complete-map-canvas-contract"],
}))

const distanceSources = [
  ["signed_distance_path", binaryMasks.get("terrain_path_ground"), "transition/grass-to-path"],
  ["signed_distance_water", binaryMasks.get("terrain_water"), "transition/grass-to-water"],
  ["signed_distance_shoreline", binaryMasks.get("terrain_shoreline"), "transition/grass-to-water"],
  ["signed_distance_object_ground", binaryMasks.get("object_footprints"), "transition/object-to-ground"],
  ["signed_distance_boundary", binaryMasks.get("terrain_natural_boundary"), "composition-recipe/single-map-composition-fields"],
]
for (const [id, mask, dictionaryRef] of distanceSources) {
  assert(mask, `distance source missing: ${id}`)
  channels.push(await writeChannel({
    id,
    pixels: signedDistanceChannel(mask, width, height, 96),
    kind: "continuous_map",
    semantics: "Signed transition proximity encoded with 128 at the boundary, larger values inside and smaller values outside.",
    derivation: "deterministic_chamfer_distance_from_binary_condition",
    sourceRefs: [dictionaryRef],
  }))
}

channels.push(await writeChannel({
  id: "moisture_proximity",
  pixels: proximityChannel(binaryMasks.get("terrain_water"), width, height, 160),
  kind: "continuous_map",
  semantics: "Water-derived moisture proximity for the current single-map ecology condition; it is not a new world fact.",
  derivation: "deterministic_proximity_from_current_water_geometry",
  sourceRefs: ["ecology/single-map-ecology-fields", "transition/grass-to-water"],
}))

const unavailableChannels = [
  unavailable("depth", "current task contains no authoritative depth geometry"),
  unavailable("contact_shadow", "light direction and authoritative shadow footprint are not present in current facts"),
  unavailable("ground_disturbance", "current task contains a semantic requirement but no authoritative disturbance geometry"),
  unavailable("occlusion_order_raster", "occlusion rules exist as vectors but no per-pixel authoritative order exists"),
]

const conditionPack = {
  schemaVersion: "complete-world-visual-condition-pack-v1",
  compilerVersion: "visual-condition-compiler-v1",
  conditionPackId: `visual-conditions-${task.taskId}`,
  createdAt: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  status: "compiled_conditions_ready",
  outputKind: "model_condition_only_no_rgb",
  changesWorldFacts: false,
  generatesPlayerFacingPixels: false,
  taskId: task.taskId,
  taskSha256: task.taskSha256,
  dictionaryVersionId: task.dictionaryVersionId,
  worldId: task.worldId,
  ownerId: task.ownerId,
  tick: task.tick,
  worldProfileId: task.worldProfileId,
  earthParameterSnapshotId: task.earthParameterSnapshotId,
  visualFactManifestId: visualFacts.manifestId,
  visualFactManifestSha256: task.sourceBindings.visualFactManifestSha256,
  sourceBindings: {
    taskPackagePath: projectPath(taskPath),
    taskManifestPath: latestTask.manifestPath,
    directorOutputPath: latestTask.directorPath,
    visualFactManifestPath: task.sourceBindings.visualFactManifestPath,
    dictionaryPath: task.sourceBindings.dictionaryPath,
    datasetPackagePath: task.sourceBindings.datasetPackagePath,
    datasetPackageId: task.sourceBindings.datasetPackageId,
    runtimeFramePath: task.sourceBindings.runtimeFramePath,
    runtimeFrameId: task.sourceBindings.runtimeFrameId,
    structureId: task.sourceBindings.structureId,
  },
  canvas: { width, height, coordinateSpace: "task_output_pixels", frameScope: "complete_runtime_frame" },
  channels,
  unavailableChannels,
  objectInstanceTable: objectFootprints.map((item, index) => ({
    value: instanceValue(index),
    objectId: item.objectId,
    kind: item.kind,
    footprint: item.footprint,
    blocksMovement: item.blocksMovement,
  })),
  categoricalConditions: {
    sceneIntent: task.directorPlan.sceneIntent,
    compositionPlan: task.directorPlan.compositionPlan,
    terrainPlan: task.directorPlan.terrainPlan,
    ecologyPlan: task.directorPlan.singleMapEcologyPlan,
    materialPlan: task.directorPlan.singleMapMaterialPlan,
    artDirectionPlan: task.directorPlan.artDirectionPlan,
    renderLayerPlan: task.directorPlan.renderLayerRecipePlan,
    visualStyle: task.visualStyle,
    forbiddenContent: task.forbiddenContent,
  },
  failureConstraints: task.previousFailures.map((failure) => ({
    code: failure.code,
    source: failure.source,
    nextFixTarget: failure.nextFixTarget,
    evidenceTimestamp: failure.evidenceTimestamp,
  })),
  inferenceGate: {
    sourceTaskStatus: task.status,
    sourceInferenceGate: task.inferenceGate,
    compilerPassed: true,
    canRunCompleteVisualInference: task.inferenceGate?.canRunCompleteVisualInference === true,
    reasons: task.inferenceGate?.reasons ?? [],
  },
  bootstrapInferenceGate: task.bootstrapInferenceGate,
}

const packCanonical = JSON.stringify(conditionPack)
conditionPack.conditionPackSha256 = sha256(Buffer.from(packCanonical))
writeJson(conditionPackPath, conditionPack)

const manifest = {
  schemaVersion: "complete-world-visual-condition-manifest-v1",
  compilerVersion: conditionPack.compilerVersion,
  conditionPackId: conditionPack.conditionPackId,
  conditionPackSha256: conditionPack.conditionPackSha256,
  status: conditionPack.status,
  outputKind: conditionPack.outputKind,
  createdAt: timestamp,
  createdAtAsiaShanghai: conditionPack.createdAtAsiaShanghai,
  taskId: task.taskId,
  taskSha256: task.taskSha256,
  dictionaryVersionId: task.dictionaryVersionId,
  worldId: task.worldId,
  ownerId: task.ownerId,
  tick: task.tick,
  worldProfileId: task.worldProfileId,
  earthParameterSnapshotId: task.earthParameterSnapshotId,
  visualFactManifestId: visualFacts.manifestId,
  canvas: conditionPack.canvas,
  channelCount: channels.length,
  unavailableChannelCount: unavailableChannels.length,
  conditionPackPath: projectPath(conditionPackPath),
  channelRoot: projectPath(channelDir),
  automaticStorage: true,
  inferenceEligible: conditionPack.inferenceGate.canRunCompleteVisualInference,
  inferenceBlockers: conditionPack.inferenceGate.reasons,
  generatesPlayerFacingPixels: false,
}
writeJson(manifestPath, manifest)

console.log(JSON.stringify({ ...manifest, manifestPath: projectPath(manifestPath) }, null, 2))

async function writeChannel({ id, pixels, kind, semantics, derivation, sourceRefs }) {
  const filePath = path.join(channelDir, `${id}.png`)
  await sharp(pixels, { raw: { width, height, channels: 1 } })
    .toColourspace("b-w")
    .png({ compressionLevel: 9 })
    .toFile(filePath)
  const bytes = fs.readFileSync(filePath)
  const statistics = channelStatistics(pixels)
  return {
    id,
    kind,
    dtype: "uint8",
    valueRange: [0, 255],
    shape: [1, height, width],
    path: projectPath(filePath),
    sha256: sha256(bytes),
    statistics,
    semantics,
    derivation,
    sourceRefs,
  }
}

function channelStatistics(pixels) {
  let minimum = 255
  let maximum = 0
  let nonZeroCount = 0
  const distinct = new Uint8Array(256)
  let distinctValueCount = 0
  for (const value of pixels) {
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
    if (value !== 0) nonZeroCount += 1
    if (distinct[value] === 0) {
      distinct[value] = 1
      distinctValueCount += 1
    }
  }
  return {
    minimum,
    maximum,
    nonZeroCount,
    nonZeroRatio: Number((nonZeroCount / pixels.length).toFixed(6)),
    distinctValueCount,
  }
}

function rasterizePolygons(records, canvasWidth, canvasHeight) {
  const pixels = Buffer.alloc(canvasWidth * canvasHeight)
  for (const record of records) fillPolygon(pixels, record.polygon ?? [], canvasWidth, canvasHeight, 255)
  return pixels
}

function rasterizeFootprints(records, canvasWidth, canvasHeight) {
  const pixels = Buffer.alloc(canvasWidth * canvasHeight)
  for (const record of records) fillBounds(pixels, record.footprint, canvasWidth, canvasHeight, 255)
  return pixels
}

function rasterizeInstances(records, canvasWidth, canvasHeight) {
  const pixels = Buffer.alloc(canvasWidth * canvasHeight)
  records.forEach((record, index) => fillBounds(pixels, record.footprint, canvasWidth, canvasHeight, instanceValue(index)))
  return pixels
}

function fillPolygon(pixels, polygon, canvasWidth, canvasHeight, value) {
  if (!Array.isArray(polygon) || polygon.length < 3) return
  const minX = clamp(Math.floor(Math.min(...polygon.map((point) => point.x))), 0, canvasWidth - 1)
  const maxX = clamp(Math.ceil(Math.max(...polygon.map((point) => point.x))), 0, canvasWidth - 1)
  const minY = clamp(Math.floor(Math.min(...polygon.map((point) => point.y))), 0, canvasHeight - 1)
  const maxY = clamp(Math.ceil(Math.max(...polygon.map((point) => point.y))), 0, canvasHeight - 1)
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, polygon)) pixels[y * canvasWidth + x] = value
    }
  }
}

function fillBounds(pixels, bounds, canvasWidth, canvasHeight, value) {
  if (!bounds) return
  const left = clamp(Math.floor(bounds.x), 0, canvasWidth)
  const top = clamp(Math.floor(bounds.y), 0, canvasHeight)
  const right = clamp(Math.ceil(bounds.x + bounds.width), 0, canvasWidth)
  const bottom = clamp(Math.ceil(bounds.y + bounds.height), 0, canvasHeight)
  for (let y = top; y < bottom; y += 1) pixels.fill(value, y * canvasWidth + left, y * canvasWidth + right)
}

function pointInPolygon(x, y, polygon) {
  let inside = false
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const a = polygon[current]
    const b = polygon[previous]
    const intersects = (a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

function coordinateChannel(canvasWidth, canvasHeight, axis) {
  const pixels = Buffer.alloc(canvasWidth * canvasHeight)
  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      pixels[y * canvasWidth + x] = Math.round(255 * (axis === "x" ? x / Math.max(1, canvasWidth - 1) : y / Math.max(1, canvasHeight - 1)))
    }
  }
  return pixels
}

function signedDistanceChannel(mask, canvasWidth, canvasHeight, radius) {
  const insideDistance = distanceTransform(mask, canvasWidth, canvasHeight, true)
  const outsideDistance = distanceTransform(mask, canvasWidth, canvasHeight, false)
  const pixels = Buffer.alloc(canvasWidth * canvasHeight)
  for (let index = 0; index < pixels.length; index += 1) {
    const signed = mask[index] > 0 ? Math.min(radius, insideDistance[index]) : -Math.min(radius, outsideDistance[index])
    pixels[index] = clamp(Math.round(128 + (signed / radius) * 127), 0, 255)
  }
  return pixels
}

function proximityChannel(mask, canvasWidth, canvasHeight, radius) {
  const distance = distanceTransform(mask, canvasWidth, canvasHeight, false)
  const pixels = Buffer.alloc(canvasWidth * canvasHeight)
  for (let index = 0; index < pixels.length; index += 1) {
    pixels[index] = mask[index] > 0 ? 255 : clamp(Math.round(255 * (1 - Math.min(radius, distance[index]) / radius)), 0, 255)
  }
  return pixels
}

function distanceTransform(mask, canvasWidth, canvasHeight, distanceInside) {
  const size = canvasWidth * canvasHeight
  const distance = new Float32Array(size)
  const infinity = canvasWidth + canvasHeight
  for (let index = 0; index < size; index += 1) {
    const isInside = mask[index] > 0
    distance[index] = isInside === distanceInside ? infinity : 0
  }
  const diagonal = Math.SQRT2
  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      const index = y * canvasWidth + x
      if (distance[index] === 0) continue
      if (x > 0) distance[index] = Math.min(distance[index], distance[index - 1] + 1)
      if (y > 0) distance[index] = Math.min(distance[index], distance[index - canvasWidth] + 1)
      if (x > 0 && y > 0) distance[index] = Math.min(distance[index], distance[index - canvasWidth - 1] + diagonal)
      if (x + 1 < canvasWidth && y > 0) distance[index] = Math.min(distance[index], distance[index - canvasWidth + 1] + diagonal)
    }
  }
  for (let y = canvasHeight - 1; y >= 0; y -= 1) {
    for (let x = canvasWidth - 1; x >= 0; x -= 1) {
      const index = y * canvasWidth + x
      if (distance[index] === 0) continue
      if (x + 1 < canvasWidth) distance[index] = Math.min(distance[index], distance[index + 1] + 1)
      if (y + 1 < canvasHeight) distance[index] = Math.min(distance[index], distance[index + canvasWidth] + 1)
      if (x + 1 < canvasWidth && y + 1 < canvasHeight) distance[index] = Math.min(distance[index], distance[index + canvasWidth + 1] + diagonal)
      if (x > 0 && y + 1 < canvasHeight) distance[index] = Math.min(distance[index], distance[index + canvasWidth - 1] + diagonal)
    }
  }
  return distance
}

function binarySemantics(id) {
  if (id === "focal_area") {
    return "Inactive all-zero compatibility channel. Initial natural-world tasks must not encode a home site, activity center, construction clearing, or route-convergence platform."
  }
  return `Binary complete-map condition for ${id.replaceAll("_", " ")}.`
}

function sourceRefsForBinary(id, currentTask) {
  if (id === "focal_area") return ["owner-locked-initial-world-no-preset-home-site-20260723"]
  if (id.startsWith("object_")) return currentTask.spatialLayers.objectFootprints.map((item) => item.objectId)
  if (id === "walkable") return currentTask.spatialLayers.walkableRegions.map((item) => item.sourceId ?? item.id)
  if (id === "collision") return currentTask.spatialLayers.collisionRegions.map((item) => item.sourceId ?? item.id)
  const kind = id.replace(/^terrain_/, "")
  return currentTask.spatialLayers.terrainRegions.filter((item) => normalizeName(item.kind) === kind).map((item) => item.sourceId ?? item.id)
}

function unavailable(id, reason) {
  return { id, status: "unavailable_authoritative_source_missing", reason, guessedByCompiler: false }
}

function instanceValue(index) {
  return 1 + (index % 254)
}

function normalizeName(value) {
  return String(value).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase()
}

function resolveProjectPath(filePath) {
  const resolved = path.resolve(ROOT, filePath)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${filePath}`)
  return resolved
}

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function readRequiredJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch (error) {
    throw new Error(`required JSON unreadable: ${projectPath(filePath)} (${error instanceof Error ? error.message : "unknown"})`)
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function projectPath(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/")
}

function formatShanghai(isoTimestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(isoTimestamp))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
