import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const runtimeFramePath = path.join(root, ".runtime/game-map-runtime-frame/latest-runtime-frame.json");
const dictionaryLatestPath = path.join(root, "data/world-visual-data-dictionary/latest.json");
const outputRoot = path.join(root, ".runtime/world-visual-dictionary-trials");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(resolvePath(filePath), "utf8"));
}

async function writeJson(filePath, value) {
  const absolutePath = resolvePath(filePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(resolvePath(filePath))).digest("hex");
}

function findCompositeImage(runtimeFrameRecord) {
  const imageUrl = runtimeFrameRecord.runtimeFrame?.composition?.compositeOutput?.imageUrl;
  if (!imageUrl) {
    throw new Error("latest RuntimeFrame does not include runtimeFrame.composition.compositeOutput.imageUrl");
  }
  return imageUrl;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

async function imageMetrics(imagePath) {
  const image = sharp(resolvePath(imagePath)).removeAlpha();
  const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const luminance = [];
  const sampledColors = new Set();
  let greenDominant = 0;
  let blueDominant = 0;
  let brownPathLike = 0;
  let sampled = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * channels;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luminance.push(value);
      sampledColors.add(`${r >> 3},${g >> 3},${b >> 3}`);
      if (g > r * 1.12 && g > b * 1.08) greenDominant += 1;
      if (b > r * 1.08 && b > g * 0.9) blueDominant += 1;
      if (r > 95 && g > 70 && b < 110 && Math.abs(r - g) < 85) brownPathLike += 1;
      sampled += 1;
    }
  }

  const mean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  const variance = luminance.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luminance.length;

  return {
    width: metadata.width ?? width,
    height: metadata.height ?? height,
    luminanceMean: round(mean),
    luminanceStdDev: round(Math.sqrt(variance)),
    uniqueColorRatio: round(sampledColors.size / Math.max(1, sampled)),
    greenDominantRatio: round(greenDominant / Math.max(1, sampled)),
    blueDominantRatio: round(blueDominant / Math.max(1, sampled)),
    brownPathLikeRatio: round(brownPathLike / Math.max(1, sampled)),
  };
}

function buildMachineFindings(metrics, runtimeFrameRecord) {
  const findings = [];
  const add = (code, severity, message, target) => {
    findings.push({ code, severity, message, target });
  };

  if (metrics.width < 512 || metrics.height < 384) {
    add("image_resolution_too_small", "hard", "Candidate is below first-map review resolution.", "schema/review-record.md");
  }
  if (metrics.luminanceStdDev < 18) {
    add("full_frame_low_contrast", "medium", "Frame may be too flat to read as a professional game map.", "composition/map-readability.md");
  }
  if (metrics.uniqueColorRatio > 0.28) {
    add("full_frame_noise", "hard", "Frame has very high sampled color variety and may read as noisy texture.", "visual-style/material-density.md");
  }
  if (metrics.greenDominantRatio > 0.68) {
    add("grass_green_noise_field", "hard", "Green material dominates the whole frame and may collapse into grass noise.", "terrain/grass.md");
  }
  if (metrics.blueDominantRatio < 0.08) {
    add("water_land_confusion", "medium", "Water area may not be visually strong enough for map reading.", "composition/map-readability.md");
  }
  if (metrics.brownPathLikeRatio < 0.08) {
    add("no_clear_route", "hard", "Path-like material is too weak for first-glance route reading.", "composition/map-readability.md");
  }
  if (runtimeFrameRecord.canShowInWorld === true) {
    add(
      "machine_pass_owner_review_required",
      "medium",
      "Runtime says world-page ready, but dictionary review still requires owner/professional acceptance.",
      "review/acceptance.md",
    );
  }

  return findings;
}

const runtimeFrameRecord = await readJson(runtimeFramePath);
const dictionaryLatest = await readJson(dictionaryLatestPath);
const dictionary = await readJson(dictionaryLatest.dictionaryPath);
const sourceImagePath = findCompositeImage(runtimeFrameRecord);
const metrics = await imageMetrics(sourceImagePath);
const imageHash = await sha256File(sourceImagePath);
const safeTimestamp = new Date().toISOString().replaceAll(":", "-");
const trialId = `world-visual-dictionary-trial-${runtimeFrameRecord.worldId}-${runtimeFrameRecord.tick}-${safeTimestamp}`;
const trialRoot = path.join(outputRoot, trialId);
const storedImagePath = path.join(trialRoot, "candidate.png");
const reviewRecordPath = path.join(trialRoot, "review-record.json");
const machineFindings = buildMachineFindings(metrics, runtimeFrameRecord);
const hardFindings = machineFindings.filter((item) => item.severity === "hard");

await mkdir(trialRoot, { recursive: true });
await copyFile(resolvePath(sourceImagePath), storedImagePath);

const reviewRecord = {
  schemaVersion: "world-visual-dictionary-trial-review-v1",
  recordId: trialId,
  createdAt: new Date().toISOString(),
  source: "runtime-compositor",
  dictionaryVersionId: dictionary.dictionaryVersionId,
  dictionaryPath: dictionaryLatest.dictionaryPath,
  runtimeFrameRecordId: runtimeFrameRecord.recordId,
  runtimeFramePath: projectPath(runtimeFramePath),
  worldId: runtimeFrameRecord.worldId,
  tick: runtimeFrameRecord.tick,
  sourceImagePath: projectPath(resolvePath(sourceImagePath)),
  storedImagePath: projectPath(storedImagePath),
  imageHash,
  imageMetrics: metrics,
  machineStatus: hardFindings.length > 0 ? "fail" : "pending_owner_review",
  ownerStatus: "pending",
  canPromoteToWorld: false,
  trainingEligibility: hardFindings.length > 0 ? "negative_candidate" : "pending_owner_review",
  failureCodes: machineFindings.map((item) => item.code),
  positiveLabels: [],
  negativeLabels: hardFindings.length > 0 ? ["negative_machine_failed"] : [],
  machineFindings,
  nextFixTargets: Array.from(new Set(machineFindings.map((item) => item.target))).sort(),
  notes: [
    "This is a dictionary-driven trial record, not owner approval.",
    "World page readiness does not equal professional visual acceptance.",
  ],
};

await writeJson(reviewRecordPath, reviewRecord);
await writeJson(path.join(outputRoot, "latest.json"), {
  schemaVersion: "world-visual-dictionary-trial-latest-pointer-v1",
  latestRecordId: trialId,
  latestRecordPath: projectPath(reviewRecordPath),
  latestImagePath: projectPath(storedImagePath),
  dictionaryVersionId: dictionary.dictionaryVersionId,
  machineStatus: reviewRecord.machineStatus,
  ownerStatus: reviewRecord.ownerStatus,
  failureCodes: reviewRecord.failureCodes,
  createdAt: reviewRecord.createdAt,
});

console.log(`World visual dictionary trial review written: ${projectPath(reviewRecordPath)}`);
console.log(`image=${projectPath(storedImagePath)}`);
console.log(`machineStatus=${reviewRecord.machineStatus}`);
console.log(`trainingEligibility=${reviewRecord.trainingEligibility}`);
console.log(`failureCodes=${reviewRecord.failureCodes.join(",")}`);
