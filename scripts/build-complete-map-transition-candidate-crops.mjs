import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const taskIndexPath = path.join(
  root,
  "data/world-samples/routed-existing-evidence/natural-home-complete-map-v0.2/transition-crop-tasks/index.json",
);
const outputRoot = path.join(root, "data/world-samples/transition-candidates/natural-home-complete-map-v0.2");
const latestPath = path.join(root, "data/world-samples/transition-candidates/latest-natural-home-complete-map.json");

const transitionMaskMap = {
  grass_to_path: ["grass", "road_center", "road_edge"],
  grass_to_water: ["grass", "water_body", "shoreline"],
  object_to_ground: ["grass", "tree_trunk", "tree_crown", "rock"],
};

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function safeId(value) {
  return String(value)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function maskBounds(maskPath) {
  try {
    const { data, info } = await sharp(maskPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const offset = (y * info.width + x) * info.channels;
        const r = data[offset] ?? 0;
        const g = data[offset + 1] ?? 0;
        const b = data[offset + 2] ?? 0;
        const a = data[offset + 3] ?? 0;
        if (a > 20 && r + g + b > 20) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0 || maxY < 0) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, imageWidth: info.width, imageHeight: info.height };
  } catch {
    return null;
  }
}

function unionBounds(bounds) {
  const valid = bounds.filter(Boolean);
  if (!valid.length) return null;
  const minX = Math.min(...valid.map((item) => item.x));
  const minY = Math.min(...valid.map((item) => item.y));
  const maxX = Math.max(...valid.map((item) => item.x + item.width));
  const maxY = Math.max(...valid.map((item) => item.y + item.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    imageWidth: valid[0].imageWidth,
    imageHeight: valid[0].imageHeight,
  };
}

function expandAndScaleBounds(bounds, sourceMeta, padding = 48) {
  const scaleX = sourceMeta.width / bounds.imageWidth;
  const scaleY = sourceMeta.height / bounds.imageHeight;
  const x = Math.max(0, Math.floor((bounds.x - padding) * scaleX));
  const y = Math.max(0, Math.floor((bounds.y - padding) * scaleY));
  const maxX = Math.min(sourceMeta.width, Math.ceil((bounds.x + bounds.width + padding) * scaleX));
  const maxY = Math.min(sourceMeta.height, Math.ceil((bounds.y + bounds.height + padding) * scaleY));
  return {
    left: x,
    top: y,
    width: Math.max(1, maxX - x),
    height: Math.max(1, maxY - y),
  };
}

const taskIndex = await readJson(taskIndexPath);
const generatedAt = new Date().toISOString();
const timestampLocal =
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T") + "+08:00";

const samples = [];
const skipped = [];

for (const task of taskIndex.records ?? []) {
  const sourceImagePath = path.join(root, task.sourceImagePath);
  const sourceDir = path.dirname(sourceImagePath);
  const maskDir = path.join(sourceDir, "condition-masks");
  const maskNames = transitionMaskMap[task.transitionId] ?? [];
  const bounds = await Promise.all(maskNames.map((name) => maskBounds(path.join(maskDir, `${name}.png`))));
  const cropMaskBounds = unionBounds(bounds);
  if (!cropMaskBounds) {
    skipped.push({
      sourceCandidateId: task.sourceCandidateId,
      transitionId: task.transitionId,
      reason: "missing_or_empty_condition_masks",
      requiredMasks: maskNames,
    });
    continue;
  }

  try {
    const sourceMeta = await sharp(sourceImagePath).metadata();
    if (!sourceMeta.width || !sourceMeta.height) throw new Error("missing_source_image_dimensions");
    const crop = expandAndScaleBounds(cropMaskBounds, { width: sourceMeta.width, height: sourceMeta.height });
    const sampleId = `${safeId(task.sourceCandidateId)}-${safeId(task.transitionId)}`;
    const sampleDir = path.join(outputRoot, task.transitionId, sampleId);
    const cropPath = path.join(sampleDir, "crop.png");
    const labelPath = path.join(sampleDir, "label.json");
    await mkdir(sampleDir, { recursive: true });
    await sharp(sourceImagePath).extract(crop).png().toFile(cropPath);
    const label = {
      schemaVersion: "complete-map-transition-candidate-label-v1",
      sampleId,
      sampleType: "transition_candidate_unreviewed",
      transitionId: task.transitionId,
      status: "candidate_unreviewed",
      mayTrainAsPositive: false,
      mayTrainAsNegative: false,
      generatedAt,
      timestampLocal,
      dictionaryVersionId: task.dictionaryVersionId,
      sourceCandidateId: task.sourceCandidateId,
      sourceImagePath: task.sourceImagePath,
      sourceMetaPath: task.sourceMetaPath,
      cropPath: projectPath(cropPath),
      crop,
      requiredReview: "owner_or_machine_transition_review_before_training_label",
    };
    await writeFile(labelPath, `${JSON.stringify(label, null, 2)}\n`, "utf8");
    samples.push(label);
  } catch (error) {
    skipped.push({
      sourceCandidateId: task.sourceCandidateId,
      transitionId: task.transitionId,
      reason: error instanceof Error ? error.message : "crop_failed",
      requiredMasks: maskNames,
    });
  }
}

const manifest = {
  schemaVersion: "complete-map-transition-candidate-crops-manifest-v1",
  manifestId: "natural-home-complete-map-v0.2-transition-candidates",
  generatedAt,
  timestampLocal,
  dictionaryVersionId: taskIndex.dictionaryVersionId,
  status: "candidate_crops_created_not_training_samples",
  counts: {
    taskCount: taskIndex.records?.length ?? 0,
    cropCount: samples.length,
    skippedCount: skipped.length,
    approvedPositiveSamplesCreated: 0,
    approvedNegativeSamplesCreated: 0,
  },
  samples,
  skipped,
  rules: [
    "Transition candidate crops are not positive samples.",
    "Transition candidate crops are not negative samples.",
    "Each crop needs review before it can enter training labels.",
  ],
};

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await mkdir(path.dirname(latestPath), { recursive: true });
await writeFile(latestPath, `${JSON.stringify({
  schemaVersion: "complete-map-transition-candidate-crops-latest-pointer-v1",
  manifestId: manifest.manifestId,
  status: manifest.status,
  generatedAt,
  manifestPath: projectPath(path.join(outputRoot, "manifest.json")),
  counts: manifest.counts,
}, null, 2)}\n`, "utf8");

console.log(`Complete map transition candidate crops written: ${projectPath(path.join(outputRoot, "manifest.json"))}`);
console.log(JSON.stringify(manifest.counts, null, 2));
