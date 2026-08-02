import { readFile } from "node:fs/promises"
import path from "node:path"

const COLLECTION_ROOT = path.join(
  process.cwd(),
  "data",
  "world-samples",
  "original-image-library",
  "natural-home-v1",
)

export type OriginalImageCategory = {
  id: string
  title: string
  description: string
  directoryPattern?: string[]
  hierarchySource?: string
}

export type OriginalImageLibraryManifest = {
  schemaVersion: string
  collectionId: string
  title: string
  status: string
  updatedAt: string
  rootPath: string
  indexPath: string
  currentSpeciesCatalogPath?: string
  recordManifestName: string
  categories: OriginalImageCategory[]
}

export type OriginalImageRecord = {
  schemaVersion?: string
  recordId: string
  collectionId?: string
  categoryId: string
  title: string
  status: string
  originalImage?: {
    path?: string
    fileName?: string
    sha256?: string
    mediaType?: string
    width?: number
    height?: number
  }
  source?: {
    sourceType?: string
    creationMethod?: string
    rightsHolder?: string
    thirdPartyContentUsed?: boolean
    thirdPartyGenerativeModelUsed?: boolean
    copiedFromExistingWork?: boolean
  }
  worldBinding?: Record<string, unknown>
  conditionBinding?: Record<string, unknown> | null
  classification?: Record<string, unknown>
  reviews?: Record<string, unknown>
  trainingEligibility?: string
  independentTrainingEligible?: boolean
  aiAssistedColdStartEligible?: boolean
  blockReasons?: string[]
  autonomousGenerationTrainingOriginal?: {
    contractVersion?: string
    sequenceNumber?: number
    sequenceLabel?: string
    ownerReviewDecision?: string
    ownerCommandRef?: string
    ownerReviewPath?: string
  }
  rebuild64Sequence?: {
    registryId?: string
    seriesId?: string
    sequenceNumber?: number
    sequenceCode?: string
    sequenceLabel?: string
    workItemId?: string
    legacyCapacitySlotId?: string
    ownerCommandRef?: string
  } | null
  createdAtUtc?: string
  createdAtAsiaShanghai?: string
  updatedAtUtc?: string
  updatedAtAsiaShanghai?: string
  relativeDirectory: string
  recordPath: string
}

export const COMPLETE_MAP_ORIGINAL_GROUPS = [
  {
    id: "autonomous-generation-training-originals",
    title: "自主生成训练原图",
    description: "项目所有者已通过、具有独立序号并用于后续本地模型训练的条件绑定 RGB 原图。",
  },
  {
    id: "foundational-complete-map-originals",
    title: "冷启动基础完整地图原图",
    description: "第一版类东南亚自然家园的基础构图、生态类型与像素风格知识原图。",
  },
  {
    id: "condition-paired-history",
    title: "条件配对历史原图",
    description: "在自主生成训练原图新序列建立前，通过审核的世界事实与条件图配对历史记录。",
  },
  {
    id: "failed-records",
    title: "失败与阻断记录",
    description: "审核拒绝图、生成失败和生成前阻断记录；保留图片、失败码、时间戳与证据路径。",
  },
] as const

export type CompleteMapOriginalGroupId = typeof COMPLETE_MAP_ORIGINAL_GROUPS[number]["id"]

export function findCompleteMapOriginalGroup(groupId: string) {
  return COMPLETE_MAP_ORIGINAL_GROUPS.find((group) => group.id === groupId) ?? null
}

export function completeMapOriginalGroupFor(record: OriginalImageRecord): CompleteMapOriginalGroupId {
  if (record.status === "rejected") return "failed-records"
  if (
    isV7CapacityOriginal(record)
    || isAutonomyRebuildOriginal(record)
    || record.autonomousGenerationTrainingOriginal?.sequenceNumber
  ) {
    return "autonomous-generation-training-originals"
  }
  if (record.recordId.startsWith("ai-cold-start-map-")) {
    return "foundational-complete-map-originals"
  }
  return "condition-paired-history"
}

export function isV7CapacityOriginal(record: OriginalImageRecord) {
  return /^ai-cold-start-v7-v7-capacity-slot-\d{3}(?:-|$)/.test(record.recordId)
}

export function isAutonomyRebuildOriginal(record: OriginalImageRecord) {
  return /^ai-cold-start-autonomy-autonomous-world-rebuild-\d{3}(?:-|$)/.test(record.recordId)
}

type OriginalImageLibraryIndex = {
  schemaVersion?: string
  collectionId?: string
  updatedAt?: string
  records?: OriginalImageRecord[]
}

export type OriginalImageSpecies = {
  speciesId: string
  nameZh: string
  scientificName: string
  plantKind: string
  ecologicalRole?: string[]
  lifecycleProfileId: string
}

export type OriginalImageSpeciesCatalog = {
  catalogId: string
  status: string
  worldProfileId: string
  regionBasis: string
  species: OriginalImageSpecies[]
}

export async function readOriginalImageLibrary() {
  const manifestPath = path.join(COLLECTION_ROOT, "library.json")
  return JSON.parse(await readFile(manifestPath, "utf8")) as OriginalImageLibraryManifest
}

export async function readOriginalImageSpeciesCatalog() {
  const manifest = await readOriginalImageLibrary()
  const configuredPath = manifest.currentSpeciesCatalogPath
  if (!configuredPath) throw new Error("original image library current species catalog is not configured")
  const catalogPath = path.resolve(process.cwd(), configuredPath)
  if (catalogPath !== COLLECTION_ROOT && !catalogPath.startsWith(`${COLLECTION_ROOT}${path.sep}`)) {
    throw new Error("original image library current species catalog escapes collection root")
  }
  return JSON.parse(await readFile(catalogPath, "utf8")) as OriginalImageSpeciesCatalog
}

export async function listOriginalImageRecords(categoryId?: string) {
  const manifest = await readOriginalImageLibrary()
  const allowedCategories = new Set(manifest.categories.map((category) => category.id))
  if (categoryId && !allowedCategories.has(categoryId)) return []

  const index = await readOriginalImageIndex()
  const records = (index.records ?? []).filter((record) =>
    allowedCategories.has(record.categoryId) && (!categoryId || record.categoryId === categoryId),
  )

  records.sort((left, right) => recordTimestamp(right).localeCompare(recordTimestamp(left)))
  return records
}

export async function findOriginalImageRecord(categoryId: string, recordId: string) {
  if (!isSafeId(categoryId) || !isSafeId(recordId)) return null
  const records = await listOriginalImageRecords(categoryId)
  const indexed = records.find((record) => record.recordId === recordId)
  if (!indexed || !indexed.recordPath) return null

  const recordPath = path.resolve(process.cwd(), indexed.recordPath)
  if (recordPath !== COLLECTION_ROOT && !recordPath.startsWith(`${COLLECTION_ROOT}${path.sep}`)) return null
  try {
    const stored = JSON.parse(await readFile(recordPath, "utf8")) as Omit<OriginalImageRecord, "relativeDirectory" | "recordPath">
    if (stored.recordId !== recordId || stored.categoryId !== categoryId) return null
    const relativeDirectory = path.relative(process.cwd(), path.dirname(recordPath)).replaceAll("\\", "/")
    return { ...stored, relativeDirectory, recordPath: indexed.recordPath }
  } catch {
    return null
  }
}

export function resolveOriginalImageFile(record: OriginalImageRecord) {
  const relativeImagePath = record.originalImage?.path
  if (!relativeImagePath) return null

  const recordDirectory = path.resolve(process.cwd(), record.relativeDirectory)
  const imagePath = path.resolve(recordDirectory, relativeImagePath)
  if (imagePath !== recordDirectory && !imagePath.startsWith(`${recordDirectory}${path.sep}`)) return null
  if (!new Set([".png", ".jpg", ".jpeg", ".webp"]).has(path.extname(imagePath).toLowerCase())) return null
  return imagePath
}

export function originalImageProjectPath(record: OriginalImageRecord) {
  const relativeImagePath = record.originalImage?.path
  return relativeImagePath
    ? path.posix.join(record.relativeDirectory.replaceAll("\\", "/"), relativeImagePath.replaceAll("\\", "/"))
    : "--"
}

async function readOriginalImageIndex(): Promise<OriginalImageLibraryIndex> {
  try {
    return JSON.parse(await readFile(path.join(COLLECTION_ROOT, "index.json"), "utf8")) as OriginalImageLibraryIndex
  } catch {
    return { records: [] }
  }
}

function recordTimestamp(record: OriginalImageRecord) {
  return record.updatedAtUtc ?? record.createdAtUtc ?? record.updatedAtAsiaShanghai ?? record.createdAtAsiaShanghai ?? ""
}

function isSafeId(value: string) {
  return /^[a-z0-9][a-z0-9_-]*$/.test(value)
}
