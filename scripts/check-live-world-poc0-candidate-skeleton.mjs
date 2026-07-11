import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const visualInputPath = path.join(
  root,
  "data/live-world/poc-inputs/poc-0-visual-input.from-chunk-state.json",
);
const candidateId = "poc0-candidate-0001";
const candidateDir = path.join(root, "data/world-visual-candidates", candidateId);
const candidateInputPath = path.join(candidateDir, "input.chunk.json");
const candidateMetaPath = path.join(candidateDir, "candidate.meta.json");
const outputMetaPath = path.join(candidateDir, "output.meta.json");
const outputImagePath = path.join(candidateDir, "output.image.png");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const sourceVisualInput = JSON.parse(await readFile(visualInputPath, "utf8"));
const candidateInput = JSON.parse(await readFile(candidateInputPath, "utf8"));
const candidateMeta = JSON.parse(await readFile(candidateMetaPath, "utf8"));
const outputMeta = JSON.parse(await readFile(outputMetaPath, "utf8"));

assert(candidateInput.inputPayloadHash === sourceVisualInput.inputPayloadHash, "candidate input hash mismatch");
assert(candidateInput.sourceChunkStatePayloadHash === sourceVisualInput.sourceChunkStatePayloadHash, "candidate source chunk state hash mismatch");
assert(candidateMeta.candidateVersion === "live-world-poc0-candidate-skeleton-v1", "invalid candidate version");
assert(candidateMeta.candidateId === candidateId, "candidateId mismatch");
assert(candidateMeta.outputId === "poc0-output-0001", "outputId mismatch");
assert(candidateMeta.inputPayloadHash === sourceVisualInput.inputPayloadHash, "candidate meta input hash mismatch");
assert(candidateMeta.sourceChunkStatePayloadHash === sourceVisualInput.sourceChunkStatePayloadHash, "candidate meta chunk state hash mismatch");
assert(candidateMeta.chunkId === sourceVisualInput.chunkId, "candidate meta chunkId mismatch");
assert(candidateMeta.status === "generation_pending", "candidate skeleton must be generation_pending");
assert(candidateMeta.imageGenerated === false, "candidate skeleton must not mark image as generated");
assert(candidateMeta.metaPath === "data/world-visual-candidates/poc0-candidate-0001/candidate.meta.json", "candidate metaPath mismatch");
assert(candidateMeta.outputMetaPath === "data/world-visual-candidates/poc0-candidate-0001/output.meta.json", "candidate outputMetaPath mismatch");

assert(outputMeta.outputVersion === "live-world-poc0-output-placeholder-v1", "invalid output placeholder version");
assert(outputMeta.outputId === candidateMeta.outputId, "output meta outputId mismatch");
assert(outputMeta.inputPayloadHash === sourceVisualInput.inputPayloadHash, "output meta input hash mismatch");
assert(outputMeta.chunkId === sourceVisualInput.chunkId, "output meta chunkId mismatch");
assert(outputMeta.status === "generation_pending", "output placeholder must be generation_pending");
assert(outputMeta.imageGenerated === false, "output placeholder must not mark image as generated");
assert(outputMeta.generatedAt === null, "output placeholder generatedAt must be null");

assert(!(await fileExists(outputImagePath)), "P1 candidate skeleton must not contain a real output.image.png");

console.log("POC-0 candidate skeleton check passed");
console.log(`candidateId=${candidateMeta.candidateId}`);
console.log(`outputId=${candidateMeta.outputId}`);
console.log(`inputPayloadHash=${candidateMeta.inputPayloadHash}`);
