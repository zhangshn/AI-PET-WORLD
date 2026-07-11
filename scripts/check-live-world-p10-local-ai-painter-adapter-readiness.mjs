import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const readinessPath = path.join(root, "data/live-world/visual-generation-dispatches/p10-active-chunks/local-ai-painter-adapter-readiness.json");

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const record = JSON.parse(await readFile(readinessPath, "utf8"));

assert(record.readinessVersion === "live-world-p10-local-ai-painter-adapter-readiness-v1", "Unexpected readiness version.");
assert(record.readinessId === "p10-local-ai-painter-adapter-readiness-0001", "Unexpected readiness id.");
assert(record.adapterCommand === "node scripts/run-live-world-p10-local-ai-painter-adapter.mjs", "Unexpected adapter command.");
assert(record.candidateCount === 9, "P10 adapter readiness must cover 9 active chunk candidates.");
assert(await fileExists(path.join(root, record.adapterScriptPath)), "Adapter script is missing.");
assert(await fileExists(path.join(root, record.inferenceBridgeScriptPath)), "Inference bridge script is missing.");
assert(Array.isArray(record.modelAssets) && record.modelAssets.length >= 4, "Model inventory is incomplete.");
assert(record.modelAssets.some((asset) => asset.exists), "No local AI Painter checkpoint found.");
assert(record.bridgeContract.readsChunkVisualInput === true, "Adapter must read ChunkVisualInput.");
assert(record.bridgeContract.convertsTileAndEntityDataToModelCondition === true, "Bridge must convert ChunkVisualInput into model condition data.");
assert(record.bridgeContract.callsLocalModelRuntime === true, "Bridge must call local model runtime.");
assert(record.bridgeContract.writesCandidateImageOnly === true, "Adapter must only write candidate image output.");
assert(record.bridgeContract.writesApprovedVisuals === false, "Adapter must not write approved visuals.");
assert(record.bridgeContract.writesTrainingSamples === false, "Adapter must not write training samples.");
assert(record.bridgeContract.bypassesRuntimePageGate === false, "Adapter must not bypass runtime page gate.");
assert(record.status === "ready_to_run", `Unexpected readiness status: ${record.status}`);

console.log("P10-B3 local AI Painter adapter readiness check passed.");
console.log(`status=${record.status}`);
console.log(`selectedModelRoot=${record.selectedModelRoot}`);
