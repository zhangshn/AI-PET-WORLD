import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  ORIGINAL_IMAGE_CATEGORIES,
  ORIGINAL_IMAGE_COLLECTION_ID,
  ORIGINAL_IMAGE_INDEX_SCHEMA_VERSION,
  ORIGINAL_IMAGE_RECORD_SCHEMA_VERSION,
  isSafeOriginalImageId,
} from "./lib/original-image-library-contract.mjs"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", ORIGINAL_IMAGE_COLLECTION_ID)
const manifest = readJson(path.join(LIBRARY_ROOT, "library.json"))
const index = fs.existsSync(path.join(LIBRARY_ROOT, "index.json"))
  ? readJson(path.join(LIBRARY_ROOT, "index.json"))
  : { schemaVersion: ORIGINAL_IMAGE_INDEX_SCHEMA_VERSION, collectionId: ORIGINAL_IMAGE_COLLECTION_ID, records: [] }
const failures = []

check(manifest.schemaVersion === "original-image-library-v1", "library_manifest_schema_invalid")
check(manifest.collectionId === ORIGINAL_IMAGE_COLLECTION_ID, "library_collection_invalid")
check(new Set(manifest.categories?.map((category) => category.id)).size === ORIGINAL_IMAGE_CATEGORIES.size, "library_categories_incomplete")
for (const category of ORIGINAL_IMAGE_CATEGORIES) check(manifest.categories?.some((item) => item.id === category), `library_category_missing:${category}`)
check(index.schemaVersion === ORIGINAL_IMAGE_INDEX_SCHEMA_VERSION, "library_index_schema_invalid")
check(index.collectionId === ORIGINAL_IMAGE_COLLECTION_ID, "library_index_collection_invalid")
check(Array.isArray(index.records), "library_index_records_invalid")

const currentProfilePath = resolveWithinLibrary(manifest.currentWorldProfilePath)
const currentSpeciesCatalogPath = resolveWithinLibrary(manifest.currentSpeciesCatalogPath)
const currentSnapshotPath = resolveWithinLibrary(manifest.provisionalVisualSnapshotPath)
const currentEarthParameterSnapshotPath = resolveWithinLibrary(manifest.currentEarthParameterSnapshotPath)
check(Boolean(currentProfilePath && fs.existsSync(currentProfilePath)), "current_world_profile_missing")
check(Boolean(currentSpeciesCatalogPath && fs.existsSync(currentSpeciesCatalogPath)), "current_species_catalog_missing")
check(Boolean(currentSnapshotPath && fs.existsSync(currentSnapshotPath)), "current_visual_snapshot_missing")
check(Boolean(currentEarthParameterSnapshotPath && fs.existsSync(currentEarthParameterSnapshotPath)), "current_earth_parameter_snapshot_missing")

const currentProfile = currentProfilePath && fs.existsSync(currentProfilePath) ? readJson(currentProfilePath) : null
const currentSpeciesCatalog = currentSpeciesCatalogPath && fs.existsSync(currentSpeciesCatalogPath) ? readJson(currentSpeciesCatalogPath) : null
const currentSnapshot = currentSnapshotPath && fs.existsSync(currentSnapshotPath) ? readJson(currentSnapshotPath) : null
const currentEarthParameterSnapshot = currentEarthParameterSnapshotPath && fs.existsSync(currentEarthParameterSnapshotPath) ? readJson(currentEarthParameterSnapshotPath) : null
const currentWorldProfileId = currentProfile?.worldProfileId ?? null
check(Boolean(currentWorldProfileId), "current_world_profile_id_missing")
check(currentSpeciesCatalog?.worldProfileId === currentWorldProfileId, "current_species_catalog_profile_mismatch")
check(currentSnapshot?.worldProfileId === currentWorldProfileId, "current_visual_snapshot_profile_mismatch")
check(currentEarthParameterSnapshot?.worldProfileId === currentWorldProfileId, "current_earth_parameter_snapshot_profile_mismatch")
check(currentEarthParameterSnapshot?.status === "versioned_ready", "current_earth_parameter_snapshot_not_ready")
const visualSnapshotPaths = Array.isArray(manifest.visualSnapshotPaths) ? manifest.visualSnapshotPaths : []
check(visualSnapshotPaths.length > 0, "visual_snapshot_catalog_missing")
const visualSnapshotIds = new Set()
for (const value of visualSnapshotPaths) {
  const visualSnapshotPath = resolveWithinLibrary(value)
  check(Boolean(visualSnapshotPath && fs.existsSync(visualSnapshotPath)), `visual_snapshot_missing:${value}`)
  if (!visualSnapshotPath || !fs.existsSync(visualSnapshotPath)) continue
  const visualSnapshot = readJson(visualSnapshotPath)
  check(Boolean(visualSnapshot.snapshotId), `visual_snapshot_id_missing:${value}`)
  check(!visualSnapshotIds.has(visualSnapshot.snapshotId), `visual_snapshot_id_duplicate:${visualSnapshot.snapshotId}`)
  visualSnapshotIds.add(visualSnapshot.snapshotId)
  check(visualSnapshot.worldProfileId === currentWorldProfileId, `visual_snapshot_profile_mismatch:${visualSnapshot.snapshotId}`)
  check(visualSnapshot.earthParameterSnapshotId === currentEarthParameterSnapshot?.snapshotId, `visual_snapshot_earth_parameter_mismatch:${visualSnapshot.snapshotId}`)
  check(Boolean(visualSnapshot.environment?.season), `visual_snapshot_season_missing:${visualSnapshot.snapshotId}`)
}
const rawEarthParameterPath = currentEarthParameterSnapshot?.source?.rawResponsePath
  ? resolveWithinLibrary(currentEarthParameterSnapshot.source.rawResponsePath)
  : null
check(Boolean(rawEarthParameterPath && fs.existsSync(rawEarthParameterPath)), "current_earth_parameter_raw_response_missing")
if (rawEarthParameterPath && fs.existsSync(rawEarthParameterPath)) {
  check(sha256(fs.readFileSync(rawEarthParameterPath)) === currentEarthParameterSnapshot.source.rawResponseSha256, "current_earth_parameter_raw_response_hash_mismatch")
}

const knowledgeCatalogPath = resolveWithinLibrary(manifest.parallelVisualKnowledgeCatalogPath)
check(Boolean(knowledgeCatalogPath && fs.existsSync(knowledgeCatalogPath)), "parallel_visual_knowledge_catalog_missing")
let knowledgeCatalog = null
if (knowledgeCatalogPath && fs.existsSync(knowledgeCatalogPath)) {
  knowledgeCatalog = readJson(knowledgeCatalogPath)
  check(knowledgeCatalog.schemaVersion === "parallel-visual-knowledge-catalog-v1", "parallel_visual_knowledge_catalog_schema_invalid")
  check(knowledgeCatalog.acquisitionOrder === "parallel_no_stage_order", "parallel_visual_knowledge_catalog_order_invalid")
  check(knowledgeCatalog.mechanicalImageCompositionAllowed === false, "parallel_visual_knowledge_catalog_composition_rule_invalid")
  const knowledgeCategoryIds = knowledgeCatalog.categories?.map((category) => category.categoryId) ?? []
  check(knowledgeCategoryIds.length === ORIGINAL_IMAGE_CATEGORIES.size, "parallel_visual_knowledge_categories_incomplete")
  check(new Set(knowledgeCategoryIds).size === knowledgeCategoryIds.length, "parallel_visual_knowledge_categories_duplicate")
  for (const category of ORIGINAL_IMAGE_CATEGORIES) check(knowledgeCategoryIds.includes(category), `parallel_visual_knowledge_category_missing:${category}`)

  const dictionaryPath = path.join(ROOT, "data", "world-visual-data-dictionary", `${knowledgeCatalog.dictionaryVersionId}.json`)
  check(fs.existsSync(dictionaryPath), "parallel_visual_knowledge_dictionary_missing")
  if (fs.existsSync(dictionaryPath)) {
    const dictionary = readJson(dictionaryPath)
    const dictionaryEntryIds = new Set(dictionary.entries?.map((entry) => entry.id) ?? [])
    for (const category of knowledgeCatalog.categories ?? []) {
      for (const entryId of category.dictionaryEntryIds ?? []) {
        check(dictionaryEntryIds.has(entryId), `parallel_visual_knowledge_dictionary_entry_missing:${entryId}`)
      }
    }
  }

  const vegetation = knowledgeCatalog.categories?.find((category) => category.categoryId === "vegetation")
  const speciesCatalogPath = vegetation?.speciesCatalogPath ? resolveWithinLibrary(vegetation.speciesCatalogPath) : null
  check(Boolean(speciesCatalogPath && fs.existsSync(speciesCatalogPath)), "parallel_visual_knowledge_species_catalog_missing")
  if (speciesCatalogPath && fs.existsSync(speciesCatalogPath)) {
    const speciesCatalog = readJson(speciesCatalogPath)
    check(speciesCatalog.species?.length === vegetation.speciesCount, "parallel_visual_knowledge_species_count_mismatch")
  }
}

const seenIds = new Set()
const seenHashes = new Set()
for (const indexed of index.records ?? []) {
  check(isSafeOriginalImageId(indexed.recordId), `invalid_record_id:${indexed.recordId}`)
  check(ORIGINAL_IMAGE_CATEGORIES.has(indexed.categoryId), `invalid_record_category:${indexed.recordId}`)
  check(!seenIds.has(indexed.recordId), `duplicate_record_id:${indexed.recordId}`)
  check(!seenHashes.has(indexed.originalImage?.sha256), `duplicate_image_hash:${indexed.recordId}`)
  seenIds.add(indexed.recordId)
  seenHashes.add(indexed.originalImage?.sha256)

  const recordPath = resolveWithinLibrary(indexed.recordPath)
  if (!recordPath || !fs.existsSync(recordPath)) {
    failures.push(`record_missing:${indexed.recordId}`)
    continue
  }
  const record = readJson(recordPath)
  check(record.schemaVersion === ORIGINAL_IMAGE_RECORD_SCHEMA_VERSION, `record_schema_invalid:${indexed.recordId}`)
  check(record.recordId === indexed.recordId, `record_id_mismatch:${indexed.recordId}`)
  check(record.categoryId === indexed.categoryId, `record_category_mismatch:${indexed.recordId}`)
  check(record.status === indexed.status, `record_status_mismatch:${indexed.recordId}`)
  const recordSnapshotPath = resolveWithinLibrary(record.worldBinding?.snapshotPath)
  check(Boolean(recordSnapshotPath && fs.existsSync(recordSnapshotPath)), `record_visual_snapshot_missing:${indexed.recordId}`)
  if (recordSnapshotPath && fs.existsSync(recordSnapshotPath)) {
    const recordSnapshot = readJson(recordSnapshotPath)
    check(recordSnapshot.snapshotId === record.worldBinding?.snapshotId, `record_visual_snapshot_id_mismatch:${indexed.recordId}`)
    check(recordSnapshot.worldProfileId === record.worldBinding?.worldProfileId, `record_visual_snapshot_profile_mismatch:${indexed.recordId}`)
    if (record.classification?.monsoonSeason) {
      check(record.classification.monsoonSeason === recordSnapshot.environment?.season, `record_visual_snapshot_season_mismatch:${indexed.recordId}`)
    }
  }
  check(indexed.relativeDirectory === projectPath(path.dirname(recordPath)), `record_directory_mismatch:${indexed.recordId}`)
  const imagePath = path.resolve(path.dirname(recordPath), record.originalImage?.path ?? "")
  if (!isWithin(path.dirname(recordPath), imagePath) || !fs.existsSync(imagePath)) {
    failures.push(`record_image_missing:${indexed.recordId}`)
    continue
  }
  const bytes = fs.readFileSync(imagePath)
  check(sha256(bytes) === record.originalImage.sha256, `record_image_hash_mismatch:${indexed.recordId}`)
  try {
    const metadata = await sharp(bytes, { failOn: "error" }).metadata()
    check(metadata.width === record.originalImage.width && metadata.height === record.originalImage.height, `record_image_dimensions_mismatch:${indexed.recordId}`)
    if (record.categoryId === "complete-maps") {
      const dimensionsValid = record.status === "blocked"
        ? metadata.width * 3 === metadata.height * 4
        : metadata.width === 1024 && metadata.height === 768
      check(dimensionsValid, `complete_map_dimensions_invalid:${indexed.recordId}`)
    }
  } catch {
    failures.push(`record_image_decode_failed:${indexed.recordId}`)
  }
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "original_image_library_check_passed" : "original_image_library_check_failed",
  collectionId: ORIGINAL_IMAGE_COLLECTION_ID,
  categoryCount: manifest.categories?.length ?? 0,
  knowledgeCategoryCount: knowledgeCatalog?.categories?.length ?? 0,
  recordCount: index.records?.length ?? 0,
  eligibleOrRegisteredCount: (index.records ?? []).filter((record) => ["eligible", "registered", "ai_assisted_cold_start_eligible"].includes(record.status)).length,
  aiAssistedColdStartIntakeCount: (index.records ?? []).filter((record) => record.status === "ai_assisted_cold_start_intake").length,
  blockedOrRejectedCount: (index.records ?? []).filter((record) => ["blocked", "rejected"].includes(record.status)).length,
  currentWorldProfileId,
  earthParameterSnapshotId: currentEarthParameterSnapshot?.snapshotId ?? null,
  currentProfileRecordCount: (index.records ?? []).filter((record) => record.worldBinding?.worldProfileId === currentWorldProfileId).length,
  legacyProfileRecordCount: (index.records ?? []).filter((record) => record.worldBinding?.worldProfileId !== currentWorldProfileId).length,
  failures,
}
console[failures.length ? "error" : "log"](JSON.stringify(result, null, 2))
process.exit(failures.length ? 1 : 0)

function resolveWithinLibrary(value) {
  if (typeof value !== "string") return null
  const resolved = path.resolve(ROOT, value)
  return isWithin(LIBRARY_ROOT, resolved) ? resolved : null
}

function isWithin(parent, child) {
  const root = path.resolve(parent)
  const target = path.resolve(child)
  return target === root || target.startsWith(`${root}${path.sep}`)
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(value, "utf8"))
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}

function check(condition, failure) {
  if (!condition && !failures.includes(failure)) failures.push(failure)
}
