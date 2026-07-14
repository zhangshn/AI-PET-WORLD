import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const latestDictionaryPath = path.join(root, "data/world-visual-data-dictionary/latest.json");
const outputRoot = path.join(root, "data/world-samples/dataset-blueprints/natural-home-complete-map-v0.2");
const blueprintPath = path.join(outputRoot, "blueprint.json");
const latestPath = path.join(root, "data/world-samples/dataset-blueprints/latest-natural-home-complete-map.json");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const latestDictionary = await readJson(latestDictionaryPath);
const generatedAt = new Date().toISOString();

const blueprint = {
  schemaVersion: "complete-map-data-expansion-blueprint-v1",
  blueprintId: "natural-home-complete-map-v0.2",
  status: "blocked_missing_owner_approved_positive_frames",
  generatedAt,
  timestampLocal: new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date()).replace(" ", "T") + "+08:00",
  dictionary: {
    dictionaryVersionId: latestDictionary.dictionaryVersionId,
    dictionaryPath: latestDictionary.dictionaryPath,
    entryCount: latestDictionary.summary?.entryCount ?? null,
    registeredFailureCodeCount: latestDictionary.summary?.registeredFailureCodeCount ?? null,
    unregisteredHardFailureCodeCount: latestDictionary.summary?.unregisteredHardFailureCodeCount ?? null,
  },
  sourceDirectories: {
    ownerApprovedCompleteFrames: "data/world-approved-frames",
    ownerRejectedCompleteFrames: "data/world-rejected-frames",
    pendingWorldSamples: "data/world-samples/pending",
    runtimeFrameRecords: ".runtime/game-map-runtime-frame",
    runtimeFrameCandidates: ".runtime/game-map-runtime-frame-candidates",
    materialSlotInferenceRuns: ".runtime/game-map-material-slot-inference-runs",
    trainingArchive: ".runtime/ai-painter/training-run-archive",
    formalSampleRegistry: "data/world-samples/registry",
    immutableDatasetPackages: "data/world-samples/dataset-packages",
  },
  requiredDataByLayer: [
    {
      layer: "world_dictionary",
      required: "dictionary snapshot with terrain, transition, director, review, training, and failure-code registry",
      currentStatus: "available",
      currentVersion: latestDictionary.dictionaryVersionId,
      minimum: { entries: 70, registeredFailureCodes: 300, unregisteredHardFailureCodes: 0 },
    },
    {
      layer: "training_data",
      required: "complete positive maps, complete negative maps, transition crops, object-grounding crops, judge-gap records",
      currentStatus: "blocked_missing_positive",
      minimum: {
        completeMapPositive: 20,
        completeMapNegative: 40,
        grassToPathPositive: 40,
        grassToPathNegative: 40,
        grassToWaterPositive: 40,
        grassToWaterNegative: 40,
        objectToGroundPositive: 30,
        objectToGroundNegative: 30,
        judgeGapRecords: 20,
      },
    },
    {
      layer: "local_model_generation",
      required: "manifest-bound model checkpoint, input structure plan, output image, seed, and generation report",
      currentStatus: "candidate_generation_allowed_but_not_final_approval",
      requiredEvidence: ["checkpoint", "manifest", "input-structure", "output-image", "quality-report"],
    },
    {
      layer: "world_director_constraints",
      required: "complete-map layout, terrain ratio, route intent, water intent, object grounding, negative space",
      currentStatus: "dictionary_defined_needs_runtime_binding",
      requiredEvidence: ["director-plan-snapshot", "dictionary-version", "generation-task-id"],
    },
    {
      layer: "professional_review",
      required: "readability, palette coherence, route readability, land-water readability, artifact suppression",
      currentStatus: "available_as_rules_needs_more_labeled_failures",
      requiredEvidence: ["machine-review-report", "owner-review-record", "failure-codes"],
    },
    {
      layer: "failure_backwrite",
      required: "rejected frame routed to negative samples with failure regions and next training target",
      currentStatus: "partially_available",
      requiredEvidence: ["rejected-frame-id", "image-path", "failure-code", "failure-region", "next-training-target"],
    },
  ],
  transitionRoutes: [
    {
      transitionId: "grass_to_path",
      positiveTarget: 40,
      negativeTarget: 40,
      primaryFailures: ["path_overlay_tape", "path_edge_hard_cut", "grass_to_path_transition_missing"],
      nextTrainingTarget: "transition/grass-to-path",
    },
    {
      transitionId: "grass_to_water",
      positiveTarget: 40,
      negativeTarget: 40,
      primaryFailures: ["shoreline_hard_cut", "water_texture_leaks_to_grass", "grass_to_water_transition_missing"],
      nextTrainingTarget: "transition/grass-to-water",
    },
    {
      transitionId: "object_to_ground",
      positiveTarget: 30,
      negativeTarget: 30,
      primaryFailures: ["floating_object", "sticker_cutout_object", "object_ground_transition_missing"],
      nextTrainingTarget: "transition/object-to-ground",
    },
  ],
  stopRules: [
    "Do not mark generated candidate as approved positive without owner approval.",
    "Do not treat local material-slot images as complete-map positive samples.",
    "Do not train final complete-map model from unlabeled rejected frames.",
    "Do not bypass dictionary, director, review, and failure backwrite snapshots.",
  ],
};

await mkdir(outputRoot, { recursive: true });
await mkdir(path.dirname(latestPath), { recursive: true });
await writeFile(blueprintPath, `${JSON.stringify(blueprint, null, 2)}\n`, "utf8");
await writeFile(latestPath, `${JSON.stringify({
  schemaVersion: "complete-map-data-expansion-blueprint-latest-pointer-v1",
  blueprintId: blueprint.blueprintId,
  status: blueprint.status,
  generatedAt,
  blueprintPath: projectPath(blueprintPath),
  dictionaryVersionId: latestDictionary.dictionaryVersionId,
}, null, 2)}\n`, "utf8");

console.log(`Complete map data expansion blueprint written: ${projectPath(blueprintPath)}`);
