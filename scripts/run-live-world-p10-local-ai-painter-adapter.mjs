import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const now = "2026-07-06T00:00:00.000Z";

const requiredEnv = [
  "LIVE_WORLD_CANDIDATE_ID",
  "LIVE_WORLD_CHUNK_ID",
  "LIVE_WORLD_INPUT_PATH",
  "LIVE_WORLD_OUTPUT_IMAGE_PATH",
  "LIVE_WORLD_OUTPUT_META_PATH",
  "LIVE_WORLD_CANDIDATE_ROOT",
];

const defaultModelRoot = ".runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-training";
const defaultCheckpointPath = `${defaultModelRoot}/best.pt`;

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

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runCommand(command, env) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
    child.on("error", (error) => {
      resolve({ exitCode: -1, stdout, stderr: error.message });
    });
  });
}

function validateChunkVisualInput(input) {
  const issues = [];
  if (!input || typeof input !== "object") {
    return ["ChunkVisualInput is not an object."];
  }
  if (!input.chunkId) issues.push("chunkId is missing.");
  if (!input.terrainMask) issues.push("terrainMask is missing.");
  if (!Array.isArray(input.entityMap)) issues.push("entityMap must be an array.");
  if (!input.visualConstraints) issues.push("visualConstraints is missing.");
  if (!input.collisionProjection && !input.collisionMask) issues.push("collisionProjection or collisionMask is missing.");
  return issues;
}

const missingEnv = requiredEnv.filter((name) => !process.env[name]?.trim());
if (missingEnv.length > 0) {
  console.error(`Missing required env: ${missingEnv.join(", ")}`);
  process.exit(2);
}

const candidateId = process.env.LIVE_WORLD_CANDIDATE_ID;
const chunkId = process.env.LIVE_WORLD_CHUNK_ID;
const inputPath = resolveProjectPath(process.env.LIVE_WORLD_INPUT_PATH);
const outputImagePath = resolveProjectPath(process.env.LIVE_WORLD_OUTPUT_IMAGE_PATH);
const outputMetaPath = resolveProjectPath(process.env.LIVE_WORLD_OUTPUT_META_PATH);
const candidateRoot = resolveProjectPath(process.env.LIVE_WORLD_CANDIDATE_ROOT);

const modelRoot = process.env.LIVE_WORLD_AI_PAINTER_MODEL_ROOT?.trim() || defaultModelRoot;
const checkpointPath = process.env.LIVE_WORLD_AI_PAINTER_CHECKPOINT_PATH?.trim() || defaultCheckpointPath;
const innerInferenceCommand = process.env.LIVE_WORLD_AI_PAINTER_INFERENCE_COMMAND?.trim() || null;

const input = JSON.parse(await readFile(inputPath, "utf8"));
const inputIssues = validateChunkVisualInput(input);
const modelExists = await fileExists(resolveProjectPath(checkpointPath));

const blockedMeta = {
  metaVersion: "live-world-p10-local-ai-painter-adapter-output-v1",
  candidateId,
  chunkId,
  status: "blocked_missing_live_world_inference_bridge",
  imageGenerated: false,
  outputImagePath: projectPath(outputImagePath),
  outputImageHash: null,
  adapter: {
    adapterCommand: "node scripts/run-live-world-p10-local-ai-painter-adapter.mjs",
    candidateRoot: projectPath(candidateRoot),
    inputPath: projectPath(inputPath),
    modelRoot,
    checkpointPath,
    modelCheckpointExists: modelExists,
    innerInferenceCommandConfigured: Boolean(innerInferenceCommand),
  },
  blockedReasons: [
    ...inputIssues,
    modelExists ? null : `Model checkpoint is missing: ${checkpointPath}`,
    innerInferenceCommand ? null : "LIVE_WORLD_AI_PAINTER_INFERENCE_COMMAND is not configured.",
    "Current natural-home generation scripts do not directly consume live-world ChunkVisualInput yet.",
  ].filter(Boolean),
  requiredBridge: [
    "Read ChunkVisualInput terrainMask, entityMap, collisionProjection, neighborContext and visualConstraints.",
    "Convert them into the mask or condition format expected by the selected local model.",
    "Run the selected local model checkpoint.",
    "Write only output.image.png and output.meta.json under the candidate directory.",
  ],
  forbiddenSideEffects: {
    writesApprovedVisuals: false,
    writesTrainingSamples: false,
    bypassesRuntimePageGate: false,
  },
  createdAt: now,
};

if (inputIssues.length > 0 || !modelExists || !innerInferenceCommand) {
  await writeJson(outputMetaPath, blockedMeta);
  await writeJson(path.join(candidateRoot, "adapter.blocked.json"), blockedMeta);
  console.error(blockedMeta.blockedReasons.join(" "));
  process.exit(2);
}

const result = await runCommand(innerInferenceCommand, {
  LIVE_WORLD_AI_PAINTER_MODEL_ROOT: modelRoot,
  LIVE_WORLD_AI_PAINTER_CHECKPOINT_PATH: checkpointPath,
  LIVE_WORLD_CANDIDATE_ID: candidateId,
  LIVE_WORLD_CHUNK_ID: chunkId,
  LIVE_WORLD_INPUT_PATH: projectPath(inputPath),
  LIVE_WORLD_OUTPUT_IMAGE_PATH: projectPath(outputImagePath),
  LIVE_WORLD_OUTPUT_META_PATH: projectPath(outputMetaPath),
  LIVE_WORLD_CANDIDATE_ROOT: projectPath(candidateRoot),
});

if (result.exitCode !== 0) {
  await writeJson(outputMetaPath, {
    ...blockedMeta,
    status: "failed_inner_inference_command",
    blockedReasons: [
      `Inner inference command exited with code ${result.exitCode}.`,
      result.stderr.trim(),
    ].filter(Boolean),
  });
}

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.exitCode ?? 1);
