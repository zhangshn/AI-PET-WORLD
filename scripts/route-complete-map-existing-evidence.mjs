import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dictionaryPointerPath = path.join(root, "data/world-visual-data-dictionary/latest.json");
const outputRoot = path.join(root, "data/world-samples/routed-existing-evidence/natural-home-complete-map-v0.2");
const latestPath = path.join(root, "data/world-samples/routed-existing-evidence/latest-natural-home-complete-map.json");

const sourceRoots = {
  worldVisualCandidates: path.join(root, "data/world-visual-candidates"),
  ownerRejectedFrames: path.join(root, "data/world-rejected-frames"),
  runtimeFrameRecords: path.join(root, ".runtime/game-map-runtime-frame"),
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
    .slice(0, 180);
}

async function walkFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await walkFiles(filePath));
      if (entry.isFile()) files.push(filePath);
    }
    return files;
  } catch {
    return [];
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function collectImageRefs(value, refs = new Set()) {
  if (!value) return refs;
  if (typeof value === "string" && /\.(png|jpg|jpeg)$/i.test(value)) {
    refs.add(value.replaceAll("\\", "/"));
    return refs;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageRefs(item, refs);
    return refs;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectImageRefs(item, refs);
  }
  return refs;
}

function candidateTransitionTasks(candidate) {
  const channels = new Set(candidate.conditionChannels ?? []);
  const tasks = [];
  if (channels.has("grass") && (channels.has("road_center") || channels.has("road_edge"))) {
    tasks.push({
      transitionId: "grass_to_path",
      status: "crop_required",
      reason: "Candidate has grass and road condition channels. Needs crop extraction before training.",
    });
  }
  if (channels.has("grass") && (channels.has("water_body") || channels.has("shoreline"))) {
    tasks.push({
      transitionId: "grass_to_water",
      status: "crop_required",
      reason: "Candidate has grass, water, or shoreline channels. Needs crop extraction before training.",
    });
  }
  if (channels.has("grass") && (channels.has("tree_trunk") || channels.has("tree_crown") || channels.has("rock"))) {
    tasks.push({
      transitionId: "object_to_ground",
      status: "crop_required",
      reason: "Candidate has object and grass channels. Needs contact-region crop extraction before training.",
    });
  }
  return tasks;
}

const dictionaryPointer = await readJson(dictionaryPointerPath);
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

const pendingCandidates = [];
const negativeEvidence = [];
const runtimeEvidence = [];
const transitionTasks = [];

const candidateMetaFiles = (await walkFiles(sourceRoots.worldVisualCandidates)).filter((file) =>
  file.endsWith("candidate.meta.json"),
);
for (const metaFile of candidateMetaFiles) {
  const meta = await readJson(metaFile);
  if (!meta) continue;
  const outputMeta = await readJson(path.join(path.dirname(metaFile), "output.meta.json"));
  const imagePath = meta.imagePath ?? outputMeta?.outputImagePath ?? path.join(projectPath(path.dirname(metaFile)), "output.image.png");
  const record = {
    schemaVersion: "complete-map-pending-candidate-route-v1",
    routedAt: generatedAt,
    timestampLocal,
    dictionaryVersionId: dictionaryPointer?.dictionaryVersionId ?? null,
    candidateId: meta.candidateId ?? path.basename(path.dirname(metaFile)),
    sourceType: "world_visual_candidate",
    status: "pending_owner_or_machine_review",
    mayTrainAsPositive: false,
    mayTrainAsNegative: false,
    imagePath: String(imagePath).replaceAll("\\", "/"),
    metaPath: projectPath(metaFile),
    outputMetaPath: outputMeta ? projectPath(path.join(path.dirname(metaFile), "output.meta.json")) : null,
    stage: meta.stage ?? null,
    sourceStatus: meta.status ?? outputMeta?.status ?? null,
    conditionChannels: outputMeta?.conditionChannels ?? [],
    requiredNextStep: "review_and_route_to_positive_or_negative",
  };
  pendingCandidates.push(record);
  for (const task of candidateTransitionTasks(record)) {
    transitionTasks.push({
      schemaVersion: "complete-map-transition-crop-task-v1",
      routedAt: generatedAt,
      timestampLocal,
      dictionaryVersionId: record.dictionaryVersionId,
      sourceCandidateId: record.candidateId,
      sourceImagePath: record.imagePath,
      sourceMetaPath: record.metaPath,
      ...task,
    });
  }
}

const rejectedJsonFiles = (await walkFiles(sourceRoots.ownerRejectedFrames)).filter((file) => file.endsWith(".json"));
for (const file of rejectedJsonFiles) {
  const data = await readJson(file);
  const evidenceId = safeId(projectPath(file));
  negativeEvidence.push({
    schemaVersion: "complete-map-negative-evidence-route-v1",
    routedAt: generatedAt,
    timestampLocal,
    dictionaryVersionId: dictionaryPointer?.dictionaryVersionId ?? null,
    evidenceId,
    sourceType: "owner_rejected_or_removed_frame_record",
    status: "negative_evidence_requires_image_or_region_binding",
    mayTrainAsPositive: false,
    mayTrainAsNegative: false,
    sourceRecordPath: projectPath(file),
    sourceFrameId: data?.frameId ?? data?.recordId ?? null,
    sourceCandidateId: data?.sourceAiImageCandidateId ?? data?.sourceCandidateId ?? null,
    productionApprovalStatus: data?.productionApprovalStatus ?? null,
    approvedForProduction: data?.approvedForProduction ?? null,
    failureCodes: [
      "professional_readability_failed",
      "rejected_frame_not_routed",
      "failure_region_missing",
      "next_training_target_missing",
    ],
    requiredNextStep: "bind_rejected_image_and_failure_regions",
  });
}

const runtimeJsonFiles = (await walkFiles(sourceRoots.runtimeFrameRecords)).filter((file) => file.endsWith(".json"));
for (const file of runtimeJsonFiles) {
  const data = await readJson(file);
  if (!data) continue;
  const imageRefs = Array.from(collectImageRefs(data));
  runtimeEvidence.push({
    schemaVersion: "complete-map-runtime-frame-evidence-route-v1",
    routedAt: generatedAt,
    timestampLocal,
    dictionaryVersionId: dictionaryPointer?.dictionaryVersionId ?? null,
    runtimeRecordId: data.recordId ?? path.basename(file, ".json"),
    sourceType: "runtime_frame_record",
    status: "runtime_evidence_not_training_label",
    mayTrainAsPositive: false,
    mayTrainAsNegative: false,
    recordPath: projectPath(file),
    imageRefs,
    requiredNextStep: "review_runtime_frame_and_route_to_owner_positive_or_negative",
  });
}

const routes = [
  { name: "pending-candidates", records: pendingCandidates },
  { name: "negative-evidence", records: negativeEvidence },
  { name: "runtime-evidence", records: runtimeEvidence },
  { name: "transition-crop-tasks", records: transitionTasks },
];

await mkdir(outputRoot, { recursive: true });
for (const route of routes) {
  const routeDir = path.join(outputRoot, route.name);
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, "index.json"), `${JSON.stringify({
    schemaVersion: `complete-map-${route.name}-index-v1`,
    generatedAt,
    timestampLocal,
    dictionaryVersionId: dictionaryPointer?.dictionaryVersionId ?? null,
    count: route.records.length,
    records: route.records,
  }, null, 2)}\n`, "utf8");
}

const manifest = {
  schemaVersion: "complete-map-existing-evidence-routing-manifest-v1",
  manifestId: "natural-home-complete-map-v0.2-existing-evidence",
  generatedAt,
  timestampLocal,
  dictionaryVersionId: dictionaryPointer?.dictionaryVersionId ?? null,
  status: "routed_evidence_not_sufficient_for_training",
  counts: {
    pendingCandidates: pendingCandidates.length,
    negativeEvidence: negativeEvidence.length,
    runtimeEvidence: runtimeEvidence.length,
    transitionCropTasks: transitionTasks.length,
    approvedPositiveSamplesCreated: 0,
  },
  outputRoot: projectPath(outputRoot),
  rules: [
    "No routed pending candidate is a positive sample.",
    "No rejected record is trainable until an image and failure region are bound.",
    "Transition crop tasks are work items, not counted transition samples.",
    "Owner-approved positives remain zero until the project owner approves complete maps.",
  ],
};

await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await mkdir(path.dirname(latestPath), { recursive: true });
await writeFile(latestPath, `${JSON.stringify({
  schemaVersion: "complete-map-existing-evidence-routing-latest-pointer-v1",
  manifestId: manifest.manifestId,
  status: manifest.status,
  generatedAt,
  manifestPath: projectPath(path.join(outputRoot, "manifest.json")),
  counts: manifest.counts,
}, null, 2)}\n`, "utf8");

console.log(`Complete map existing evidence routed: ${projectPath(path.join(outputRoot, "manifest.json"))}`);
console.log(JSON.stringify(manifest.counts, null, 2));
