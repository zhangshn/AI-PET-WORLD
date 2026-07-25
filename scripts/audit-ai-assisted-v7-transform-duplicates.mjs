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
const INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-transform-duplicate-audits"
const WIDTH = 64
const HEIGHT = 48
const TRANSFORMS = ["identity", "horizontal_mirror", "vertical_mirror", "rotate_180"]
const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `ai-assisted-v7-transform-duplicate-audit-${createdAtUtc.replace(/[:.]/g, "-")}`
const runRoot = path.join(ROOT, OUTPUT_ROOT, runId)

const index = readJson(INDEX_PATH)
const completeMapRecords = (index.records ?? [])
  .filter((record) => record.categoryId === "complete-maps")
  .map(normalizeRecord)
  .filter((record) => record.imagePath && fs.existsSync(record.imagePath))
const v7Records = completeMapRecords
  .filter((record) => record.capacitySlotId)
  .sort((left, right) => left.capacitySlotId.localeCompare(right.capacitySlotId))

const allImageFingerprints = new Map()
for (const record of completeMapRecords) {
  allImageFingerprints.set(record.recordId, await fingerprint(record.imagePath, { blurSigma: 2 }))
}

const allImageComparisons = compareRecords(completeMapRecords, allImageFingerprints)
const v7ImageComparisons = allImageComparisons.filter((comparison) =>
  comparison.leftCapacitySlotId && comparison.rightCapacitySlotId)

const v7GuideRecords = v7Records.filter((record) => record.guidePath && fs.existsSync(record.guidePath))
const v7GuideFingerprints = new Map()
for (const record of v7GuideRecords) {
  v7GuideFingerprints.set(record.recordId, await fingerprint(record.guidePath, { blurSigma: 0 }))
}
const v7GuideComparisons = compareRecords(v7GuideRecords, v7GuideFingerprints)

const transformDerivedRecords = v7Records.filter((record) => record.transformDerivations.length > 0)
const transformFamilies = buildTransformFamilies(transformDerivedRecords)
const exactHashGroups = groupBy(v7Records, (record) => record.imageSha256)
  .filter((group) => group.items.length > 1)
  .map(serializeGroup)
const likelyVisualDuplicates = v7ImageComparisons
  .filter((comparison) => comparison.classification !== "distinct")
const likelyGuideDuplicates = v7GuideComparisons
  .filter((comparison) => comparison.classification !== "distinct")

const report = {
  schemaVersion: "ai-assisted-v7-transform-duplicate-audit-v1",
  runId,
  status: transformDerivedRecords.length > 0 || likelyVisualDuplicates.length > 0
    ? "blocked_pending_owner_duplicate_reclassification"
    : "passed_no_transform_or_similarity_issue_detected",
  createdAtUtc,
  createdAtAsiaShanghai,
  scope: {
    completeMapRecordsWithReadableImages: completeMapRecords.length,
    v7RecordsWithReadableImages: v7Records.length,
    v7RecordsWithReadableConditionGuides: v7GuideRecords.length,
    historicalFilesModified: 0,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
  method: {
    sourceCodeEvidence: {
      blueprintBuilderPath: "scripts/build-ai-assisted-conditional-world-fact-blueprints.mjs",
      transformIndexExpression: "(slotNumber - 4) % 8",
      mirroredExpression: "transformIndex % 2 === 1",
      coordinateExpression: "mirrored ? 1 - x : x",
    },
    semanticEvidence: "task-package strings ending in _complete_map_transform_<0..7>",
    imageEvidence: "SHA-256 plus 64x48 blurred luminance and gradient comparison under identity, horizontal mirror, vertical mirror, and 180-degree rotation",
    guideEvidence: "the same four-way comparison over persisted V7 condition-guide images",
    thresholdMeaning: "strong and likely matches are audit candidates, not automatic historical deletion or owner-review reversal",
  },
  summary: {
    exactV7ImageHashDuplicateGroups: exactHashGroups.length,
    transformDerivedV7RecordCount: transformDerivedRecords.length,
    transformDerivedOwnerAcceptedCount: transformDerivedRecords.filter((record) => record.status === "ai_assisted_cold_start_eligible").length,
    transformFamilyCount: transformFamilies.length,
    strongOrLikelyV7ImagePairCount: likelyVisualDuplicates.length,
    strongOrLikelyV7GuidePairCount: likelyGuideDuplicates.length,
    capacityEligibilityDecision: "pending_owner_reclassification",
    currentBatchMayResume: false,
    v7GpuTrainingMayStart: false,
  },
  transformDerivedRecords: transformDerivedRecords.map(serializeRecord),
  transformFamilies,
  exactHashGroups,
  likelyVisualDuplicates,
  likelyGuideDuplicates,
  nearestV7ImagePairs: v7ImageComparisons.slice(0, 80),
  nearestV7GuidePairs: v7GuideComparisons.slice(0, 80),
  requiredNextAction: {
    zh: "项目所有者先审核同骨架与镜像派生清单，再决定哪些记录保留为历史、哪些暂停容量贡献。不得自动删除、改写或恢复批量出图。",
    en: "The project owner must review the shared-skeleton and mirror-derived list before deciding which records remain historical evidence and which capacity contributions are suspended. Do not delete, rewrite, or resume batch generation automatically.",
  },
}

const reportPath = path.join(runRoot, "report.json")
const latestPath = path.join(ROOT, OUTPUT_ROOT, "latest.json")
writeIndexedJson(reportPath, report)
writeIndexedJson(latestPath, {
  schemaVersion: "ai-assisted-v7-transform-duplicate-audit-latest-v1",
  runId,
  status: report.status,
  updatedAtUtc: createdAtUtc,
  updatedAtAsiaShanghai: createdAtAsiaShanghai,
  reportPath: projectPath(reportPath),
  reportSha256: fileSha256(reportPath),
  ...report.summary,
})

appendAiPainterProgramEvent({
  runId,
  status: report.status.startsWith("blocked_") ? "blocked" : "success",
  stage: "ai_assisted_v7_transform_duplicate_audit",
  action: "audit_v7_transform_and_mirror_duplicates",
  kind: "v7_data_quality_audit",
  titleZh: "程序完成 V7 镜像、旋转、近似与同骨架重复审计",
  titleEn: "The program completed the V7 mirror, rotation, similarity, and shared-skeleton duplicate audit",
  summaryZh: `审计 ${v7Records.length} 条V7图像；发现 ${transformDerivedRecords.length} 条任务由 complete_map_transform 派生，其中 ${report.summary.transformDerivedOwnerAcceptedCount} 条此前已通过owner审核。历史文件未修改，批次和V7训练继续阻断。`,
  summaryEn: `The audit inspected ${v7Records.length} V7 images and found ${transformDerivedRecords.length} tasks derived through complete_map_transform, including ${report.summary.transformDerivedOwnerAcceptedCount} previously owner-approved records. Historical files were not modified; the batch and V7 training remain blocked.`,
  errorCode: report.status.startsWith("blocked_") ? "v7_transform_derived_duplicate_risk_requires_owner_reclassification" : null,
  evidence: [projectPath(reportPath), projectPath(latestPath)],
})

closeStorageCatalog()
console.log(JSON.stringify({
  status: report.status,
  runId,
  reportPath: projectPath(reportPath),
  ...report.summary,
}, null, 2))

function normalizeRecord(record) {
  const recordDirectory = record.relativeDirectory
    ? resolveProjectPath(record.relativeDirectory)
    : record.recordPath
      ? path.dirname(resolveProjectPath(record.recordPath))
      : null
  const imagePath = recordDirectory && record.originalImage?.path
    ? path.resolve(recordDirectory, record.originalImage.path)
    : null
  const taskPackagePath = record.conditionBinding?.taskPackagePath
    ? resolveProjectPath(record.conditionBinding.taskPackagePath)
    : null
  const guidePath = record.conditionBinding?.guidePath
    ? resolveProjectPath(record.conditionBinding.guidePath)
    : null
  const taskPackage = taskPackagePath && fs.existsSync(taskPackagePath) ? readJson(taskPackagePath) : null
  const transformDerivations = collectTransformDerivations(taskPackage)
  return {
    recordId: record.recordId,
    title: record.title,
    status: record.status,
    capacitySlotId: record.v7CapacityContribution?.capacitySlotId
      ?? record.recordId.match(/v7-capacity-slot-\d+/)?.[0]
      ?? null,
    regionalLandscapeType: record.classification?.regionalLandscapeType ?? null,
    monsoonSeason: record.classification?.monsoonSeason ?? null,
    imagePath,
    imageLogicalPath: imagePath ? projectPath(imagePath) : null,
    imageSha256: record.originalImage?.sha256 ?? (imagePath && fs.existsSync(imagePath) ? fileSha256(imagePath) : null),
    taskPackagePath: taskPackagePath ? projectPath(taskPackagePath) : null,
    guidePath,
    guideLogicalPath: guidePath ? projectPath(guidePath) : null,
    transformDerivations,
  }
}

function collectTransformDerivations(value) {
  const matches = []
  walk(value, (text) => {
    const match = text.match(/(.+)_complete_map_transform_(\d+)\b/)
    if (!match) return
    matches.push({
      semanticValue: text,
      family: match[1],
      transformIndex: Number(match[2]),
      mirrorDerivedByBuilder: Number(match[2]) % 2 === 1,
    })
  })
  return uniqueBy(matches, (entry) => `${entry.family}::${entry.transformIndex}`)
}

function walk(value, onString) {
  if (typeof value === "string") {
    onString(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, onString)
    return
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walk(item, onString)
  }
}

async function fingerprint(imagePath, { blurSigma }) {
  const bytes = fs.readFileSync(imagePath)
  let pipeline = sharp(bytes, { failOn: "error" })
    .greyscale()
    .resize(WIDTH, HEIGHT, { fit: "fill" })
  if (blurSigma > 0) pipeline = pipeline.blur(blurSigma)
  const luminance = Uint8Array.from(await pipeline.raw().toBuffer())
  return {
    sha256: sha256(bytes),
    luminance,
    gradient: gradientMap(luminance),
  }
}

function compareRecords(records, fingerprints) {
  const comparisons = []
  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex += 1) {
      const left = records[leftIndex]
      const right = records[rightIndex]
      const leftFingerprint = fingerprints.get(left.recordId)
      const rightFingerprint = fingerprints.get(right.recordId)
      if (!leftFingerprint || !rightFingerprint) continue
      const variants = TRANSFORMS.map((transform) => {
        const luminance = transformArray(rightFingerprint.luminance, transform)
        const gradient = transformArray(rightFingerprint.gradient, transform)
        return {
          transform,
          luminanceMae: meanAbsoluteDifference(leftFingerprint.luminance, luminance),
          luminanceCorrelation: correlation(leftFingerprint.luminance, luminance),
          gradientMae: meanAbsoluteDifference(leftFingerprint.gradient, gradient),
          gradientCorrelation: correlation(leftFingerprint.gradient, gradient),
        }
      }).sort((a, b) =>
        b.gradientCorrelation - a.gradientCorrelation
        || b.luminanceCorrelation - a.luminanceCorrelation
        || a.luminanceMae - b.luminanceMae)
      const best = variants[0]
      const exactHashDuplicate = leftFingerprint.sha256 === rightFingerprint.sha256
      const classification = exactHashDuplicate
        ? "exact_hash_duplicate"
        : best.luminanceCorrelation >= 0.995 && best.gradientCorrelation >= 0.98 && best.luminanceMae <= 6
          ? "strong_transform_duplicate"
          : best.luminanceCorrelation >= 0.97 && best.gradientCorrelation >= 0.9 && best.luminanceMae <= 18
            ? "likely_transform_or_shared_composition"
            : "distinct"
      comparisons.push({
        leftRecordId: left.recordId,
        leftCapacitySlotId: left.capacitySlotId,
        rightRecordId: right.recordId,
        rightCapacitySlotId: right.capacitySlotId,
        exactHashDuplicate,
        classification,
        bestTransformAppliedToRight: best.transform,
        luminanceMae: best.luminanceMae,
        luminanceCorrelation: best.luminanceCorrelation,
        gradientMae: best.gradientMae,
        gradientCorrelation: best.gradientCorrelation,
      })
    }
  }
  return comparisons.sort((left, right) =>
    severity(left.classification) - severity(right.classification)
    || right.gradientCorrelation - left.gradientCorrelation
    || right.luminanceCorrelation - left.luminanceCorrelation
    || left.luminanceMae - right.luminanceMae)
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

function gradientMap(source) {
  const output = new Uint8Array(source.length)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const center = source[y * WIDTH + x]
      const right = source[y * WIDTH + Math.min(WIDTH - 1, x + 1)]
      const down = source[Math.min(HEIGHT - 1, y + 1) * WIDTH + x]
      output[y * WIDTH + x] = Math.min(255, Math.abs(center - right) + Math.abs(center - down))
    }
  }
  return output
}

function meanAbsoluteDifference(left, right) {
  let total = 0
  for (let index = 0; index < left.length; index += 1) total += Math.abs(left[index] - right[index])
  return Number((total / left.length).toFixed(6))
}

function correlation(left, right) {
  let leftMean = 0
  let rightMean = 0
  for (let index = 0; index < left.length; index += 1) {
    leftMean += left[index]
    rightMean += right[index]
  }
  leftMean /= left.length
  rightMean /= right.length
  let numerator = 0
  let leftVariance = 0
  let rightVariance = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean
    const rightDelta = right[index] - rightMean
    numerator += leftDelta * rightDelta
    leftVariance += leftDelta * leftDelta
    rightVariance += rightDelta * rightDelta
  }
  const denominator = Math.sqrt(leftVariance * rightVariance)
  return Number((denominator === 0 ? 0 : numerator / denominator).toFixed(6))
}

function buildTransformFamilies(records) {
  const entries = []
  for (const record of records) {
    for (const derivation of record.transformDerivations) {
      entries.push({ key: derivation.family, record, derivation })
    }
  }
  return groupBy(entries, (entry) => entry.key)
    .map((group) => ({
      family: group.key,
      recordCount: group.items.length,
      capacitySlots: group.items.map((entry) => entry.record.capacitySlotId),
      transformIndexes: group.items.map((entry) => entry.derivation.transformIndex),
      mirrorDerivedCapacitySlots: group.items
        .filter((entry) => entry.derivation.mirrorDerivedByBuilder)
        .map((entry) => entry.record.capacitySlotId),
      ownerAcceptedCapacitySlots: group.items
        .filter((entry) => entry.record.status === "ai_assisted_cold_start_eligible")
        .map((entry) => entry.record.capacitySlotId),
    }))
    .sort((left, right) => right.recordCount - left.recordCount || left.family.localeCompare(right.family))
}

function serializeRecord(record) {
  return {
    recordId: record.recordId,
    capacitySlotId: record.capacitySlotId,
    title: record.title,
    status: record.status,
    regionalLandscapeType: record.regionalLandscapeType,
    monsoonSeason: record.monsoonSeason,
    imagePath: record.imageLogicalPath,
    imageSha256: record.imageSha256,
    taskPackagePath: record.taskPackagePath,
    guidePath: record.guideLogicalPath,
    transformDerivations: record.transformDerivations,
  }
}

function groupBy(items, selector) {
  const groups = new Map()
  for (const item of items) {
    const key = selector(item)
    if (!key) continue
    const current = groups.get(key) ?? []
    current.push(item)
    groups.set(key, current)
  }
  return [...groups.entries()].map(([key, values]) => ({ key, items: values }))
}

function serializeGroup(group) {
  return {
    key: group.key,
    recordCount: group.items.length,
    records: group.items.map(serializeRecord),
  }
}

function uniqueBy(items, selector) {
  const seen = new Set()
  return items.filter((item) => {
    const key = selector(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function severity(classification) {
  return {
    exact_hash_duplicate: 0,
    strong_transform_duplicate: 1,
    likely_transform_or_shared_composition: 2,
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
