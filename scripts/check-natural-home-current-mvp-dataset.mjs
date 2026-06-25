import fs from "node:fs";
import path from "node:path";

const datasetRoot = path.resolve(process.argv[2] ??
  ".runtime/ai-painter/natural-home-v90-current-mvp-natural-only-dataset",
);
const expectedStageId = process.argv[3] ?? "natural-home-v90-current-mvp-natural-only-dataset";
const expectedTrainingTargetSource = process.argv[4] ?? "v89_current_mvp_natural_only_generated_png";
const expectedSampleCount = process.argv[5] ? Number(process.argv[5]) : undefined;
const manifestPath = path.join(datasetRoot, "manifest.json");
const sceneRoot = path.join(datasetRoot, "accepted", "dataset_v0", "scene", "world");
const trainIndexPath = path.join(datasetRoot, "indexes", "train.json");
const validationIndexPath = path.join(datasetRoot, "indexes", "validation.json");

const forbiddenTokens = [
  "shelter",
  "storehouse",
  "canopy",
  "construction",
  "construct",
  "building",
  "house",
  "foundation",
  "wall",
  "roof",
  "material",
  "settlement",
  "refuge",
  "camp",
  "hut",
  "quarry",
  "work_canopy",
  "storehouse_frame",
];

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
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

const manifest = readJson(manifestPath);
const trainIndex = readJson(trainIndexPath);
const validationIndex = readJson(validationIndexPath);
const sampleIds = [...trainIndex.sampleIds, ...validationIndex.sampleIds];

assert(manifest.status === "completed", "dataset manifest must be completed");
assert(manifest.displayAllowed === false, "dataset must not be display allowed");
assert(manifest.canPromoteToWorld === false, "dataset must not promote to world");
assert(
  manifest.stageId === expectedStageId,
  "unexpected stageId",
);
if (expectedSampleCount !== undefined) {
  assert(
    manifest.sampleCount === expectedSampleCount,
    `expected ${expectedSampleCount} samples, got ${manifest.sampleCount}`,
  );
}
assert(
  trainIndex.sampleIds.length + validationIndex.sampleIds.length === manifest.sampleCount,
  "train and validation counts must match manifest sampleCount",
);
assert(validationIndex.sampleIds.length >= 1, "validation index must not be empty");
assert(new Set(sampleIds).size === sampleIds.length, "train/validation sample ids must be unique");

for (const sampleId of sampleIds) {
  const lower = sampleId.toLowerCase();
  for (const token of forbiddenTokens) {
    assert(!lower.includes(token), `sample id contains forbidden token ${token}: ${sampleId}`);
  }

  const sampleDir = path.join(sceneRoot, sampleId);
  assert(exists(sampleDir), `missing sample dir: ${sampleId}`);
  assert(exists(path.join(sampleDir, "target.png")), `missing generated target: ${sampleId}`);
  assert(exists(path.join(sampleDir, "source-target.png")), `missing preserved source target: ${sampleId}`);
  assert(exists(path.join(sampleDir, "blueprint.v1.json")), `missing blueprint: ${sampleId}`);
  assert(exists(path.join(sampleDir, "metadata.json")), `missing metadata: ${sampleId}`);

  const metadata = readJson(path.join(sampleDir, "metadata.json"));
  assert(metadata.displayAllowed === false, `metadata displayAllowed must be false: ${sampleId}`);
  assert(metadata.canPromoteToWorld === false, `metadata canPromoteToWorld must be false: ${sampleId}`);
  assert(
    metadata.stageId === expectedStageId,
    `metadata stageId mismatch: ${sampleId}`,
  );
  assert(
    metadata.trainingTargetSource === expectedTrainingTargetSource,
    `metadata trainingTargetSource mismatch: ${sampleId}`,
  );

  const maskDir = path.join(sampleDir, "masks_v1");
  for (const maskName of requiredMasks) {
    assert(exists(path.join(maskDir, `${maskName}.png`)), `missing mask ${maskName}: ${sampleId}`);
  }
}

console.log(
  `Current MVP dataset check passed: ${trainIndex.sampleIds.length} train, ${validationIndex.sampleIds.length} validation.`,
);
