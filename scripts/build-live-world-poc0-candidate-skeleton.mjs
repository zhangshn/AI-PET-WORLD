import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const visualInputPath = path.join(
  root,
  "data/live-world/poc-inputs/poc-0-visual-input.from-chunk-state.json",
);
const candidateId = "poc0-candidate-0001";
const outputId = "poc0-output-0001";
const candidateDir = path.join(root, "data/world-visual-candidates", candidateId);
const candidateInputPath = path.join(candidateDir, "input.chunk.json");
const candidateMetaPath = path.join(candidateDir, "candidate.meta.json");
const outputMetaPath = path.join(candidateDir, "output.meta.json");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

const visualInput = JSON.parse(await readFile(visualInputPath, "utf8"));

const candidateMeta = {
  candidateVersion: "live-world-poc0-candidate-skeleton-v1",
  candidateId,
  outputId,
  inputPayloadHash: visualInput.inputPayloadHash,
  sourceChunkStatePayloadHash: visualInput.sourceChunkStatePayloadHash,
  chunkId: visualInput.chunkId,
  imagePath: projectPath(path.join(candidateDir, "output.image.png")),
  metaPath: projectPath(candidateMetaPath),
  outputMetaPath: projectPath(outputMetaPath),
  status: "generation_pending",
  stage: "P1",
  imageGenerated: false,
  createdAt: "2026-07-06T00:00:00.000Z",
  notes:
    "P1 skeleton only. No image is generated here, and this candidate cannot enter samples before owner review.",
};

const outputMeta = {
  outputId,
  outputVersion: "live-world-poc0-output-placeholder-v1",
  inputPayloadHash: visualInput.inputPayloadHash,
  chunkId: visualInput.chunkId,
  imagePath: candidateMeta.imagePath,
  modelVersion: "not-generated",
  promptVersion: "not-generated",
  generatedAt: null,
  status: "generation_pending",
  imageGenerated: false,
  reason:
    "P1 validates candidate archive shape before connecting AI Painter image generation.",
};

await mkdir(candidateDir, { recursive: true });
await writeFile(candidateInputPath, `${JSON.stringify(visualInput, null, 2)}\n`, "utf8");
await writeFile(candidateMetaPath, `${JSON.stringify(candidateMeta, null, 2)}\n`, "utf8");
await writeFile(outputMetaPath, `${JSON.stringify(outputMeta, null, 2)}\n`, "utf8");

console.log(`Wrote ${projectPath(candidateDir)}`);
console.log(`candidateId=${candidateId}`);
console.log(`outputId=${outputId}`);
console.log(`inputPayloadHash=${visualInput.inputPayloadHash}`);
