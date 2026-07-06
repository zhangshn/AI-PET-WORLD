import fs from "node:fs"
import path from "node:path"

const datasetRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/natural-home-v118-complete-world-blueprint-dataset",
)
const expectedStageId = process.argv[3] ?? "natural-home-v118-complete-world-blueprint-dataset"
const minSampleCount = Number(process.argv[4] ?? 120)

const blockedSourceTokens = [
  "crop",
  "partial",
  "patch",
  "tile",
  "sprite",
  "diagnostic",
  "local-detail",
  "local_detail",
  "tight",
  "close",
  "corner",
]

const forbiddenTypes = new Set([
  "shelter_foundation",
  "shelter_wall",
  "shelter_roof",
  "construction_material",
  "building",
  "facility",
  "butler",
  "character",
  "animal",
  "insect",
])

const requiredTags = new Set([
  "complete_natural_home_mvp",
  "primary_world_view",
  "runtime_frame_source",
])

const requiredAnchors = new Set([
  "world_entry",
  "primary_path",
  "natural_boundary",
  "water_feature",
  "exploration_area",
  "visual_center",
])

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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function listJsonIds(indexName) {
  const data = readJson(path.join(datasetRoot, "indexes", `${indexName}.json`))
  assert(data.schemaVersion === "dataset-index-v1", `${indexName} index schema mismatch`)
  assert(data.split === indexName, `${indexName} index split mismatch`)
  assert(Array.isArray(data.sampleIds), `${indexName} sampleIds missing`)
  return data.sampleIds
}

function hasAll(values, required) {
  const set = new Set(values)
  return [...required].every((value) => set.has(value))
}

const manifest = readJson(path.join(datasetRoot, "dataset-manifest.json"))
assert(manifest.schemaVersion === "natural-home-v118-complete-world-dataset-v1", "unexpected manifest schema")
assert(manifest.stageId === expectedStageId, "unexpected stageId")
assert(manifest.status === "completed", "manifest status must be completed")
assert(manifest.policy?.displayAllowed === false, "dataset must not be display allowed")
assert(manifest.policy?.canPromoteToWorld === false, "dataset must not promote to world")

const trainIds = listJsonIds("train")
const validationIds = listJsonIds("validation")
const allIds = [...trainIds, ...validationIds]
assert(allIds.length >= minSampleCount, `expected at least ${minSampleCount} samples`)
assert(new Set(allIds).size === allIds.length, "train/validation ids must be unique")
assert(manifest.selectedSampleCount === allIds.length, "manifest sample count mismatch")

const sceneRoot = path.join(datasetRoot, "accepted", "dataset_v0", "scene", "world")
for (const sampleId of allIds) {
  const lowered = sampleId.toLowerCase()
  assert(lowered.startsWith("natural-home-scene_"), `sample must be natural-home scene: ${sampleId}`)
  for (const token of blockedSourceTokens) {
    assert(!lowered.includes(token), `blocked source token ${token}: ${sampleId}`)
  }

  const sampleDir = path.join(sceneRoot, sampleId)
  assert(fs.existsSync(path.join(sampleDir, "target.png")), `missing target: ${sampleId}`)
  assert(fs.existsSync(path.join(sampleDir, "blueprint.v1.json")), `missing blueprint: ${sampleId}`)
  const blueprint = readJson(path.join(sampleDir, "blueprint.v1.json"))
  assert(blueprint.schemaVersion === "world-blueprint-v1", `invalid blueprint schema: ${sampleId}`)
  assert(blueprint.gameWorldFrameIntent?.scope === "complete_natural_home_mvp", `missing complete scope: ${sampleId}`)
  assert(blueprint.gameWorldFrameIntent?.frameRole === "primary_world_view", `missing primary world role: ${sampleId}`)
  assert(blueprint.gameWorldFrameIntent?.runtimeFrameSource === true, `missing runtimeFrameSource: ${sampleId}`)
  assert(hasAll(blueprint.gameWorldFrameIntent?.tags ?? [], requiredTags), `missing intent tags: ${sampleId}`)
  assert(hasAll(blueprint.gameWorldFrameIntent?.anchors ?? [], requiredAnchors), `missing anchors: ${sampleId}`)
  assert(blueprint.runtimeFrameIntent?.scope === "complete_natural_home_mvp", `missing runtime intent: ${sampleId}`)
  assert(blueprint.sourcePolicy?.completeWorldConditionSource === true, `missing complete condition source policy: ${sampleId}`)
  assert(blueprint.sourcePolicy?.completeGameWorldFrameSource === false, `V118 source must not claim finished game-world frame source: ${sampleId}`)
  assert(blueprint.sourcePolicy?.requiresModelGeneration === true, `V118 source must require model generation: ${sampleId}`)

  const types = new Set((blueprint.structures ?? []).map((item) => item?.type).filter(Boolean))
  for (const type of types) {
    assert(!forbiddenTypes.has(type), `forbidden type ${type}: ${sampleId}`)
  }
  for (const channel of maskChannels) {
    assert(fs.existsSync(path.join(sampleDir, "masks_v1", `${channel}.png`)), `missing mask ${channel}: ${sampleId}`)
  }
}

console.log(
  `V118 complete-world dataset check passed: ${allIds.length} samples, train ${trainIds.length}, validation ${validationIds.length}.`,
)
