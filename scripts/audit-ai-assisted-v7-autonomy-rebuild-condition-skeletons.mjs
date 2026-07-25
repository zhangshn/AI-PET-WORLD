import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const SOURCE_ROOT = ".runtime/ai-painter/ai-assisted-v7-autonomy-rebuild-data-tasks"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-autonomy-rebuild-condition-skeleton-audits"
const WIDTH = 64
const HEIGHT = 48
const TRANSFORMS = ["identity", "horizontal_mirror", "vertical_mirror", "rotate_180"]
const CHANNEL_BITS = new Map([
  ["terrain_path_ground", 1],
  ["terrain_water", 2],
  ["terrain_natural_boundary", 4],
  ["object_footprints", 8],
  ["terrain_mud_patch", 16],
  ["terrain_tall_grass", 32],
])
const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `ai-assisted-v7-autonomy-rebuild-condition-skeleton-audit-${createdAtUtc.replace(/[:.]/g, "-")}`
const runRoot = path.join(ROOT, OUTPUT_ROOT, runId)

const sourcePointer = readJson(path.join(SOURCE_ROOT, "latest.json"))
const sourceManifest = readJson(sourcePointer.manifestPath)
assert(sourceManifest.status === "all_24_autonomous_world_condition_tasks_ready_rgb_missing", "source rebuild is not ready for skeleton audit")
assert(sourceManifest.rows?.length === 24, `expected 24 source rows, received ${sourceManifest.rows?.length ?? 0}`)

const records = []
for (const row of sourceManifest.rows) {
  const conditionPack = readJson(row.conditionPackPath)
  assert(conditionPack.channels?.length === 23, `condition channel count mismatch: ${row.rebuildId}`)
  const focalArea = conditionPack.channels.find((channel) => channel.id === "focal_area")
  assert(Number(focalArea?.statistics?.nonZeroCount ?? -1) === 0, `focal_area is active: ${row.rebuildId}`)
  records.push({
    rebuildId: row.rebuildId,
    split: row.split,
    worldId: row.worldId,
    regionalLandscapeType: row.regionalLandscapeType,
    monsoonSeason: row.monsoonSeason,
    conditionPackPath: row.conditionPackPath,
    conditionPackSha256: fileSha256(row.conditionPackPath),
    fingerprint: await buildFingerprint(conditionPack, row.rebuildId),
  })
}

const comparisons = []
for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex += 1) {
    const left = records[leftIndex]
    const right = records[rightIndex]
    const variants = TRANSFORMS.map((transform) => {
      const transformed = transformArray(right.fingerprint.bytes, transform)
      return {
        transform,
        equalityRatio: equalityRatio(left.fingerprint.bytes, transformed),
        nonZeroIntersectionOverUnion: nonZeroIntersectionOverUnion(left.fingerprint.bytes, transformed),
      }
    }).sort((a, b) =>
      b.equalityRatio - a.equalityRatio
      || b.nonZeroIntersectionOverUnion - a.nonZeroIntersectionOverUnion)
    const best = variants[0]
    const exactCompositeHashDuplicate = left.fingerprint.sha256 === right.fingerprint.sha256
    const classification = exactCompositeHashDuplicate
      ? "exact_condition_skeleton_duplicate"
      : best.equalityRatio >= 0.985 && best.nonZeroIntersectionOverUnion >= 0.95
        ? "strong_transform_condition_skeleton_duplicate"
        : best.equalityRatio >= 0.94 && best.nonZeroIntersectionOverUnion >= 0.82
          ? "similar_condition_skeleton_requires_attention"
          : "distinct"
    comparisons.push({
      leftRebuildId: left.rebuildId,
      rightRebuildId: right.rebuildId,
      classification,
      bestTransformAppliedToRight: best.transform,
      equalityRatio: best.equalityRatio,
      nonZeroIntersectionOverUnion: best.nonZeroIntersectionOverUnion,
      exactCompositeHashDuplicate,
    })
  }
}

comparisons.sort((left, right) =>
  severity(left.classification) - severity(right.classification)
  || right.equalityRatio - left.equalityRatio
  || right.nonZeroIntersectionOverUnion - left.nonZeroIntersectionOverUnion)

const blockingPairs = comparisons.filter((entry) =>
  entry.classification === "exact_condition_skeleton_duplicate"
  || entry.classification === "strong_transform_condition_skeleton_duplicate")
const attentionPairs = comparisons.filter((entry) =>
  entry.classification === "similar_condition_skeleton_requires_attention")
const report = {
  schemaVersion: "ai-assisted-v7-autonomy-rebuild-condition-skeleton-audit-v1",
  runId,
  status: blockingPairs.length === 0
    ? "passed_no_transform_condition_skeleton_duplicate"
    : "blocked_transform_condition_skeleton_duplicate",
  createdAtUtc,
  createdAtAsiaShanghai,
  sourceRunId: sourceManifest.runId,
  sourceManifestPath: sourcePointer.manifestPath,
  sourceManifestSha256: fileSha256(sourcePointer.manifestPath),
  authorizationRef: sourceManifest.ownerAuthorizationRef,
  method: {
    rasterSize: { width: WIDTH, height: HEIGHT },
    channels: [...CHANNEL_BITS.keys()],
    transforms: TRANSFORMS,
    exactOrStrongPairsBlockRgbGeneration: true,
    attentionPairsDoNotAutomaticallyPassOwnerReview: true,
    sourceRgbRead: false,
    generatedRgbRead: false,
  },
  summary: {
    auditedRecordCount: records.length,
    comparisonCount: comparisons.length,
    exactDuplicatePairCount: comparisons.filter((entry) => entry.classification === "exact_condition_skeleton_duplicate").length,
    strongTransformDuplicatePairCount: comparisons.filter((entry) => entry.classification === "strong_transform_condition_skeleton_duplicate").length,
    attentionPairCount: attentionPairs.length,
    distinctPairCount: comparisons.filter((entry) => entry.classification === "distinct").length,
    focalAreaAllZeroCount: records.length,
    imageGenerationStarted: false,
    imagesGenerated: 0,
    gpuTrainingStarted: false,
  },
  records: records.map((record) => ({
    rebuildId: record.rebuildId,
    split: record.split,
    worldId: record.worldId,
    regionalLandscapeType: record.regionalLandscapeType,
    monsoonSeason: record.monsoonSeason,
    conditionPackPath: record.conditionPackPath,
    conditionPackSha256: record.conditionPackSha256,
    compositeSkeletonSha256: record.fingerprint.sha256,
  })),
  blockingPairs,
  attentionPairs,
  nearestPairs: comparisons.slice(0, 60),
  blockers: blockingPairs.length === 0 ? [] : ["transform_condition_skeleton_duplicate"],
  rgbGenerationEligibleByThisAudit: blockingPairs.length === 0,
  formalTrainingAuthorized: false,
  automaticStorage: true,
}

const reportPath = path.join(runRoot, "report.json")
const latestPath = path.join(ROOT, OUTPUT_ROOT, "latest.json")
writeIndexedJson(reportPath, report)
writeIndexedJson(latestPath, {
  schemaVersion: "ai-assisted-v7-autonomy-rebuild-condition-skeleton-audit-latest-v1",
  runId,
  status: report.status,
  updatedAtUtc: createdAtUtc,
  updatedAtAsiaShanghai: createdAtAsiaShanghai,
  reportPath: projectPath(reportPath),
  reportSha256: fileSha256(reportPath),
  ...report.summary,
  rgbGenerationEligibleByThisAudit: report.rgbGenerationEligibleByThisAudit,
  formalTrainingAuthorized: false,
})

appendAiPainterProgramEvent({
  runId,
  status: blockingPairs.length === 0 ? "success" : "blocked",
  stage: "ai_assisted_v7_autonomy_rebuild_condition_skeleton_audit",
  action: "audit_pre_generation_complete_map_condition_skeletons",
  kind: "v7_data_quality_audit",
  titleZh: blockingPairs.length === 0
    ? "24套自主世界条件骨架通过生成前镜像、旋转和重复审计"
    : "自主世界条件骨架发现镜像、旋转或重复风险，程序已阻断RGB生成",
  titleEn: blockingPairs.length === 0
    ? "All 24 autonomous-world condition skeletons passed the pre-generation transform and duplicate audit"
    : "The program blocked RGB generation after detecting transform or duplicate condition skeletons",
  summaryZh: `程序审计${records.length}套完整地图条件、${comparisons.length}组配对；强阻断${blockingPairs.length}组、需关注${attentionPairs.length}组。未读取RGB、未生成图片、未启动GPU训练。`,
  summaryEn: `The program audited ${records.length} complete-map condition records and ${comparisons.length} pairs. Blocking pairs: ${blockingPairs.length}; attention pairs: ${attentionPairs.length}. No RGB was read or generated and no GPU training started.`,
  errorCode: blockingPairs.length === 0 ? null : "transform_condition_skeleton_duplicate",
  evidence: [projectPath(reportPath), projectPath(latestPath)],
})

closeStorageCatalog()
console.log(JSON.stringify({
  status: report.status,
  runId,
  reportPath: projectPath(reportPath),
  reportSha256: fileSha256(reportPath),
  ...report.summary,
  rgbGenerationEligibleByThisAudit: report.rgbGenerationEligibleByThisAudit,
  formalTrainingAuthorized: false,
}, null, 2))

async function buildFingerprint(conditionPack, rebuildId) {
  const bytes = new Uint8Array(WIDTH * HEIGHT)
  for (const [channelId, bit] of CHANNEL_BITS) {
    const channel = conditionPack.channels.find((entry) => entry.id === channelId)
    assert(channel?.path, `condition channel missing: ${rebuildId}/${channelId}`)
    const resized = await sharp(resolveProjectPath(channel.path), { failOn: "error" })
      .greyscale()
      .resize(WIDTH, HEIGHT, { fit: "fill", kernel: "nearest" })
      .raw()
      .toBuffer()
    for (let index = 0; index < bytes.length; index += 1) {
      if (resized[index] > 0) bytes[index] |= bit
    }
  }
  return { bytes, sha256: sha256(bytes) }
}

function transformArray(source, transform) {
  const output = new Uint8Array(source.length)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const sourceX = transform === "horizontal_mirror" || transform === "rotate_180" ? WIDTH - 1 - x : x
      const sourceY = transform === "vertical_mirror" || transform === "rotate_180" ? HEIGHT - 1 - y : y
      output[y * WIDTH + x] = source[sourceY * WIDTH + sourceX]
    }
  }
  return output
}

function equalityRatio(left, right) {
  let equal = 0
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) equal += 1
  }
  return Number((equal / left.length).toFixed(6))
}

function nonZeroIntersectionOverUnion(left, right) {
  let intersection = 0
  let union = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftActive = left[index] > 0
    const rightActive = right[index] > 0
    if (leftActive || rightActive) union += 1
    if (leftActive && rightActive) intersection += 1
  }
  return Number((union === 0 ? 1 : intersection / union).toFixed(6))
}

function severity(classification) {
  return {
    exact_condition_skeleton_duplicate: 0,
    strong_transform_condition_skeleton_duplicate: 1,
    similar_condition_skeleton_requires_attention: 2,
    distinct: 3,
  }[classification] ?? 4
}

function writeIndexedJson(filePath, body) {
  writeJsonAtomic(filePath, body)
  const stat = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: fileSha256(filePath),
  })
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(filePath), "utf8"))
}

function resolveProjectPath(filePath) {
  const resolved = path.resolve(ROOT, filePath)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`path escapes project: ${filePath}`)
  }
  assert(fs.existsSync(resolved), `file missing: ${filePath}`)
  return resolved
}

function projectPath(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/")
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(resolveProjectPath(filePath)))
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
