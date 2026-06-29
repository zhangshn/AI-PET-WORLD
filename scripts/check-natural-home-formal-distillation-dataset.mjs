import fs from "node:fs";
import path from "node:path";

const datasetRoot = path.resolve(process.argv[2]);
const expectedStageId = process.argv[3];
const expectedTrainingTargetSource = process.argv[4];
const expectedMinimumSampleCount = Number(process.argv[5] ?? 8);

const manifestPath = path.join(datasetRoot, "manifest.json");
const trainIndexPath = path.join(datasetRoot, "indexes", "train.json");
const validationIndexPath = path.join(datasetRoot, "indexes", "validation.json");
const sceneRoot = path.join(datasetRoot, "accepted", "dataset_v0", "scene", "world");
const forbiddenActiveChannels = new Set([
  "shelter_foundation",
  "shelter_wall",
  "shelter_roof",
  "construction_material",
]);
const requiredMasks = [
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
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

assert(datasetRoot && expectedStageId && expectedTrainingTargetSource, "usage: node check... <datasetRoot> <stageId> <trainingTargetSource> [minSampleCount]");

const manifest = readJson(manifestPath);
const trainIndex = readJson(trainIndexPath);
const validationIndex = readJson(validationIndexPath);
const sampleIds = [...trainIndex.sampleIds, ...validationIndex.sampleIds];

assert(manifest.status === "completed", "dataset manifest must be completed");
assert(manifest.displayAllowed === false, "dataset must not be display allowed");
assert(manifest.canPromoteToWorld === false, "dataset must not promote to world");
assert(manifest.stageId === expectedStageId, "unexpected stageId");
assert(manifest.sampleCount >= expectedMinimumSampleCount, "not enough formal distillation samples");
assert(manifest.sampleCount === sampleIds.length, "index counts must match manifest sampleCount");
assert(new Set(sampleIds).size === sampleIds.length, "train/validation sample ids must be unique");

for (const sampleId of sampleIds) {
  const sampleDir = path.join(sceneRoot, sampleId);
  assert(fs.existsSync(path.join(sampleDir, "target.png")), `missing generated target: ${sampleId}`);
  assert(fs.existsSync(path.join(sampleDir, "source-target.png")), `missing preserved source target: ${sampleId}`);
  assert(fs.existsSync(path.join(sampleDir, "blueprint.v1.json")), `missing blueprint: ${sampleId}`);
  assert(fs.existsSync(path.join(sampleDir, "metadata.json")), `missing metadata: ${sampleId}`);

  const metadata = readJson(path.join(sampleDir, "metadata.json"));
  assert(metadata.displayAllowed === false, `metadata displayAllowed must be false: ${sampleId}`);
  assert(metadata.canPromoteToWorld === false, `metadata canPromoteToWorld must be false: ${sampleId}`);
  assert(metadata.stageId === expectedStageId, `metadata stageId mismatch: ${sampleId}`);
  assert(
    metadata.trainingTargetSource === expectedTrainingTargetSource,
    `metadata trainingTargetSource mismatch: ${sampleId}`,
  );

  const blueprint = readJson(path.join(sampleDir, "blueprint.v1.json"));
  const blueprintText = JSON.stringify(blueprint).toLowerCase();
  for (const token of forbiddenActiveChannels) {
    assert(!blueprintText.includes(`"${token}"`), `forbidden active channel in blueprint ${token}: ${sampleId}`);
  }

  const maskDir = path.join(sampleDir, "masks_v1");
  for (const maskName of requiredMasks) {
    assert(fs.existsSync(path.join(maskDir, `${maskName}.png`)), `missing mask ${maskName}: ${sampleId}`);
  }
}

console.log(
  `Formal distillation dataset check passed: ${trainIndex.sampleIds.length} train, ${validationIndex.sampleIds.length} validation.`,
);
