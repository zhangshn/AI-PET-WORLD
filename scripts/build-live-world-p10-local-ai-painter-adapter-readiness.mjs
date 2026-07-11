import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const now = "2026-07-06T00:00:00.000Z";
const readinessId = "p10-local-ai-painter-adapter-readiness-0001";

const dispatchPath = path.join(root, "data/live-world/visual-generation-dispatches/p10-active-chunks/ai-painter-dispatch.json");
const adapterScriptPath = "scripts/run-live-world-p10-local-ai-painter-adapter.mjs";
const inferenceBridgeScriptPath = "ml/ai-painter/scripts/infer_live_world_chunk_visual.py";
const readinessPath = path.join(root, "data/live-world/visual-generation-dispatches/p10-active-chunks/local-ai-painter-adapter-readiness.json");
const latestPath = path.join(root, "data/live-world/visual-generation-dispatches/latest-local-ai-painter-adapter-readiness.json");

const modelAssets = [
  {
    modelId: "natural-home-v28-structure-guided",
    modelRoot: ".runtime/ai-painter/natural-home-v28-structure-guided-training",
    checkpointPath: ".runtime/ai-painter/natural-home-v28-structure-guided-training/best.pt",
    role: "structure_checkpoint",
  },
  {
    modelId: "natural-home-v89-quality-allowlist",
    modelRoot: ".runtime/ai-painter/natural-home-v89-quality-allowlist-training",
    checkpointPath: ".runtime/ai-painter/natural-home-v89-quality-allowlist-training/best.pt",
    role: "rgb_refiner_checkpoint",
  },
  {
    modelId: "natural-home-v91-current-mvp-quality-ready",
    modelRoot: ".runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-training",
    checkpointPath: ".runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-training/best.pt",
    role: "current_mvp_checkpoint",
  },
  {
    modelId: "natural-home-v110-v109-formal-passed-distillation",
    modelRoot: ".runtime/ai-painter/natural-home-v110-v109-formal-passed-distillation-training",
    checkpointPath: ".runtime/ai-painter/natural-home-v110-v109-formal-passed-distillation-training/best.pt",
    role: "formal_world_checkpoint",
  },
];

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  if (!await fileExists(filePath)) return null;
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const dispatch = await readJsonIfExists(dispatchPath);
const adapterScriptExists = await fileExists(resolveProjectPath(adapterScriptPath));
const inferenceBridgeScriptExists = await fileExists(resolveProjectPath(inferenceBridgeScriptPath));
const modelAssetsWithExists = [];
for (const asset of modelAssets) {
  modelAssetsWithExists.push({
    ...asset,
    exists: await fileExists(resolveProjectPath(asset.checkpointPath)),
  });
}

const candidateCount = dispatch?.entries?.length ?? 0;
const selectedAsset = modelAssetsWithExists.find((asset) => asset.modelId === "natural-home-v91-current-mvp-quality-ready" && asset.exists)
  ?? modelAssetsWithExists.find((asset) => asset.exists)
  ?? null;

const missingReasons = [];
if (!dispatch) missingReasons.push("P10 dispatch record is missing.");
if (!adapterScriptExists) missingReasons.push("Local AI Painter adapter script is missing.");
if (!inferenceBridgeScriptExists) missingReasons.push("Live-world inference bridge script is missing.");
if (!selectedAsset) missingReasons.push("No local AI Painter checkpoint was found.");

const status = !dispatch
  ? "blocked_missing_dispatch"
  : !adapterScriptExists
    ? "blocked_missing_adapter_script"
    : !selectedAsset
      ? "blocked_missing_model_assets"
      : inferenceBridgeScriptExists
        ? "ready_to_run"
        : "blocked_missing_live_world_inference_bridge";

const record = {
  readinessVersion: "live-world-p10-local-ai-painter-adapter-readiness-v1",
  readinessId,
  dispatchId: dispatch?.dispatchId ?? null,
  status,
  adapterCommand: "node scripts/run-live-world-p10-local-ai-painter-adapter.mjs",
  adapterScriptPath,
  inferenceBridgeScriptPath,
  recommendedInnerInferenceCommand: "ml\\ai-painter\\.venv\\Scripts\\python.exe ml\\ai-painter\\scripts\\infer_live_world_chunk_visual.py",
  candidateCount,
  modelAssets: modelAssetsWithExists,
  selectedModelRoot: selectedAsset?.modelRoot ?? null,
  selectedCheckpointPath: selectedAsset?.checkpointPath ?? null,
  missingReasons,
  commandProtocol: {
    outerCommandEnv: "LIVE_WORLD_AI_PAINTER_COMMAND",
    innerInferenceCommandEnv: "LIVE_WORLD_AI_PAINTER_INFERENCE_COMMAND",
    requiredCandidateEnv: [
      "LIVE_WORLD_CANDIDATE_ID",
      "LIVE_WORLD_CHUNK_ID",
      "LIVE_WORLD_INPUT_PATH",
      "LIVE_WORLD_OUTPUT_IMAGE_PATH",
      "LIVE_WORLD_OUTPUT_META_PATH",
      "LIVE_WORLD_CANDIDATE_ROOT",
    ],
    outputFiles: [
      "output.image.png",
      "output.meta.json",
      "adapter.blocked.json",
    ],
  },
  bridgeContract: {
    readsChunkVisualInput: true,
    convertsTileAndEntityDataToModelCondition: inferenceBridgeScriptExists,
    callsLocalModelRuntime: inferenceBridgeScriptExists,
    writesCandidateImageOnly: true,
    writesApprovedVisuals: false,
    writesTrainingSamples: false,
    bypassesRuntimePageGate: false,
  },
  nextActions: [
    "Configure LIVE_WORLD_AI_PAINTER_COMMAND to the local adapter.",
    "Configure LIVE_WORLD_AI_PAINTER_INFERENCE_COMMAND to the real bridge.",
    "Run the P10 command runner and keep generated images in candidate directories only.",
  ],
  createdAt: now,
};

await writeJson(readinessPath, record);
await writeJson(latestPath, {
  readinessId,
  status,
  readinessPath: projectPath(readinessPath),
  candidateCount,
  selectedModelRoot: record.selectedModelRoot,
  selectedCheckpointPath: record.selectedCheckpointPath,
  createdAt: now,
});

console.log(`Wrote ${projectPath(readinessPath)}`);
console.log(`readinessId=${readinessId}`);
console.log(`status=${status}`);
console.log(`candidateCount=${candidateCount}`);
