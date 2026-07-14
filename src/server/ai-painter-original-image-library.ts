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
  classification?: Record<string, unknown>
  reviews?: Record<string, unknown>
  createdAtUtc?: string
  createdAtAsiaShanghai?: string
  updatedAtUtc?: string
  updatedAtAsiaShanghai?: string
  relativeDirectory: string
  recordPath: string
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
