import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const datasetRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/natural-home-v120-complete-game-world-frame-source-dataset",
)
const expectedStageId = process.argv[3] ?? "natural-home-v120-complete-game-world-frame-source-dataset"
const expectedCount = Number(process.argv[4] ?? 12)

const maskChannels = [
  "grass",
  "water_body",
  "shoreline",
  "road_center",
  "road_edge",
  "tree_trunk",
  "tree_crown",
  "rock",
  "shelter_foundation",
  "shelter_wall",
  "shelter_roof",
  "construction_material",
  "walkable",
  "depth",
]

const requiredTags = new Set([
  "complete_natural_home_mvp",
  "primary_world_view",
  "runtime_frame_source",
  "complete_game_world_frame_source",
  "full_view_not_crop",
])

const requiredAnchors = new Set([
  "world_entry",
  "primary_path",
  "natural_boundary",
  "water_feature",
  "exploration_area",
  "visual_center",
  "home_or_work_center",
])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function hasAll(values, required) {
  const set = new Set(values)
  return [...required].every((value) => set.has(value))
}

async function pngSize(filePath) {
  const metadata = await sharp(filePath).metadata()
  return { width: metadata.width, height: metadata.height, format: metadata.format }
}

function listIndex(split) {
  const data = readJson(path.join(datasetRoot, "indexes", `${split}.json`))
  assert(data.schemaVersion === "dataset-index-v1", `${split} index schema mismatch`)
  assert(data.split === split, `${split} index split mismatch`)
  assert(Array.isArray(data.sampleIds), `${split} sampleIds missing`)
  return data.sampleIds
}

const manifest = readJson(path.join(datasetRoot, "dataset-manifest.json"))
assert(manifest.schemaVersion === "natural-home-v120-complete-game-world-frame-source-dataset-v1", "unexpected manifest schema")
assert(manifest.stageId === expectedStageId, "unexpected stageId")
assert(manifest.status === "completed", "manifest status must be completed")
assert(manifest.selectedSampleCount === expectedCount, `expected ${expectedCount} samples`)
assert(manifest.policy?.displayAllowed === false, "V120 dataset must not be display allowed")
assert(manifest.policy?.canPromoteToWorld === false, "V120 dataset must not promote to world")
assert(manifest.sourcePolicy?.completeGameWorldFrameSource === true, "V120 source must be complete game-world frame source")
assert(manifest.sourcePolicy?.requiresModelGeneration === false, "V120 source must not require model generation")
assert(manifest.sourcePolicy?.notApprovedFrame === true, "V120 source must not be ApprovedFrame")
assert(manifest.sourcePolicy?.notRuntimeFrame === true, "V120 source must not be RuntimeFrame")

const trainIds = listIndex("train")
const validationIds = listIndex("validation")
const sampleIds = [...trainIds, ...validationIds]
assert(sampleIds.length === expectedCount, "train/validation count mismatch")
assert(new Set(sampleIds).size === sampleIds.length, "sample ids must be unique")

const sceneRoot = path.join(datasetRoot, "accepted", "dataset_v0", "scene", "world")
for (const sampleId of sampleIds) {
  const sampleDir = path.join(sceneRoot, sampleId)
  const targetPath = path.join(sampleDir, "target.png")
  const sourcePath = path.join(sampleDir, "source-original.png")
  const blueprintPath = path.join(sampleDir, "blueprint.v1.json")
  const metadataPath = path.join(sampleDir, "metadata.json")

  assert(fs.existsSync(targetPath), `missing target: ${sampleId}`)
  assert(fs.existsSync(sourcePath), `missing source-original: ${sampleId}`)
  assert(fs.existsSync(blueprintPath), `missing blueprint: ${sampleId}`)
  assert(fs.existsSync(metadataPath), `missing metadata: ${sampleId}`)

  const targetSize = await pngSize(targetPath)
  assert(targetSize.format === "png", `target must be png: ${sampleId}`)
  assert(targetSize.width === 256 && targetSize.height === 192, `target size must be 256x192: ${sampleId}`)

  const sourceSize = await pngSize(sourcePath)
  assert(sourceSize.format === "png", `source-original must be png: ${sampleId}`)
  assert(sourceSize.width / sourceSize.height > 1.32 && sourceSize.width / sourceSize.height < 1.34, `source-original must be 4:3: ${sampleId}`)

  const blueprint = readJson(blueprintPath)
  assert(blueprint.schemaVersion === "world-blueprint-v1", `invalid blueprint schema: ${sampleId}`)
  assert(blueprint.gameWorldFrameIntent?.scope === "complete_natural_home_mvp", `missing complete scope: ${sampleId}`)
  assert(blueprint.gameWorldFrameIntent?.frameRole === "primary_world_view", `missing primary world role: ${sampleId}`)
  assert(blueprint.gameWorldFrameIntent?.runtimeFrameSource === true, `missing runtime frame source intent: ${sampleId}`)
  assert(hasAll(blueprint.gameWorldFrameIntent?.tags ?? [], requiredTags), `missing complete frame tags: ${sampleId}`)
  assert(hasAll(blueprint.gameWorldFrameIntent?.anchors ?? [], requiredAnchors), `missing complete frame anchors: ${sampleId}`)
  assert(blueprint.sourcePolicy?.completeWorldConditionSource === true, `missing complete condition policy: ${sampleId}`)
  assert(blueprint.sourcePolicy?.completeGameWorldFrameSource === true, `missing complete game-world source policy: ${sampleId}`)
  assert(blueprint.sourcePolicy?.requiresModelGeneration === false, `V120 source must not require model generation: ${sampleId}`)
  assert(blueprint.sourcePolicy?.displayAllowed === false, `source must not be display allowed: ${sampleId}`)
  assert(blueprint.sourcePolicy?.canPromoteToWorld === false, `source must not promote to world: ${sampleId}`)

  const types = new Set((blueprint.structures ?? []).map((item) => item?.type).filter(Boolean))
  for (const requiredType of ["grass", "road_center", "road_edge", "walkable", "tree_crown", "rock", "depth"]) {
    assert(types.has(requiredType), `missing required structure ${requiredType}: ${sampleId}`)
  }
  assert(types.has("shelter_foundation") || types.has("construction_material"), `missing home/work center structures: ${sampleId}`)

  for (const channel of maskChannels) {
    const maskPath = path.join(sampleDir, "masks_v1", `${channel}.png`)
    assert(fs.existsSync(maskPath), `missing mask ${channel}: ${sampleId}`)
    const maskSize = await pngSize(maskPath)
    assert(maskSize.width === 256 && maskSize.height === 192, `mask size mismatch ${channel}: ${sampleId}`)
  }

  const metadata = readJson(metadataPath)
  assert(metadata.sourcePolicy?.notApprovedFrame === true, `metadata must state not ApprovedFrame: ${sampleId}`)
  assert(metadata.sourcePolicy?.notRuntimeFrame === true, `metadata must state not RuntimeFrame: ${sampleId}`)
}

console.log(`V120 complete frame source dataset check passed: ${sampleIds.length} samples.`)
