import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const CAPACITY_LATEST_PATH = ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
const FRAMEWORK_AUDIT_LATEST_PATH = ".runtime/ai-painter/earth-geospatial-v7-capacity-146-209-complete-framework-audits/latest.json"
const LIBRARY_INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const REGISTRY_PATH = "data/ai-painter/system-governance/thailand-rebuild64-sequence-registry-v1.json"
const OUTPUT_ROOT = ".runtime/ai-painter/thailand-rebuild64-sequence-registry-runs"
const NEW_REFERENCE_RECORD_ID = "ai-cold-start-v7-v7-capacity-slot-198-grassland-forest-transition-v3"
const SERIES_ID = "thailand-rebuild64-20260731"
const OWNER_COMMAND_REF = "owner-command-recode-new-thailand-64-from-01-20260731"

const entranceBySlot = [
  "south", "west", "east", "south", "north", "west", "north", "west",
  "north", "east", "west", "east", "west", "south", "south", "north",
  "west", "west", "south", "north", "north", "south", "south", "south",
  "east", "west", "north", "north", "west", "south", "east", "west",
  "west", "south", "north", "east", "east", "west", "west", "north",
  "north", "north", "east", "north", "east", "east", "south", "west",
  "west", "north", "west", "north", "north", "west", "south", "north",
  "west", "west", "north", "north", "north", "west", "east", "south",
]
const entranceZh = {
  north: "\u5317\u4fa7\u5165\u53e3",
  south: "\u5357\u4fa7\u5165\u53e3",
  east: "\u4e1c\u4fa7\u5165\u53e3",
  west: "\u897f\u4fa7\u5165\u53e3",
}

assert(entranceBySlot.length === 64, "entrance mapping must contain 64 entries")
const capacityLatest = readJson(CAPACITY_LATEST_PATH)
const gapList = readJson(capacityLatest.gapListPath)
const plannedSlots = gapList.plannedSlots ?? []
assert(plannedSlots.length === 64, `expected 64 planned slots, found ${plannedSlots.length}`)

const frameworkAuditLatest = readJson(FRAMEWORK_AUDIT_LATEST_PATH)
const frameworkAudit = readJson(frameworkAuditLatest.runPath)
assert(frameworkAudit.summary?.rebuildRequiredPackageCount === 63, "63-package rebuild audit is not current")
assert(frameworkAudit.summary?.new198ReferencePassed === true, "new slot-198 reference did not pass the framework audit")
const rebuildRequiredSlots = new Set(
  (frameworkAudit.targetResults ?? [])
    .filter((entry) => entry.status === "rebuild_required_under_current_complete_framework_standard")
    .map((entry) => entry.slotId),
)

const index = readJson(LIBRARY_INDEX_PATH)
const newReference = (index.records ?? []).find((entry) => entry.recordId === NEW_REFERENCE_RECORD_ID)
assert(newReference, "new slot-198 V3 record is missing")
assert(newReference.status !== "rejected", "new slot-198 V3 cannot be coded as a success-lane work item after rejection")

const timestamp = new Date().toISOString()
const runId = `thailand-rebuild64-sequence-registry-${timestamp.replace(/[:.]/g, "-")}`
const entries = plannedSlots.map((slot, indexPosition) => {
  const expectedSlotNumber = 146 + indexPosition
  const slotNumber = Number(/(\d{3})$/.exec(slot.slotId ?? "")?.[1])
  assert(slotNumber === expectedSlotNumber, `capacity slot order mismatch at position ${indexPosition + 1}`)
  const sequenceNumber = indexPosition + 1
  const sequenceCode = String(sequenceNumber).padStart(2, "0")
  const isReference = slotNumber === 198
  if (isReference) assert(!rebuildRequiredSlots.has(slot.slotId), "new 198 reference is incorrectly marked for rebuild")
  else assert(rebuildRequiredSlots.has(slot.slotId), `${slot.slotId} is missing from the 63-package rebuild audit`)
  return {
    sequenceNumber,
    sequenceCode,
    sequenceLabel: `\u65b064\u7ec4\u7b2c${sequenceCode}\u5f20`,
    workItemId: `thailand-rebuild64-${sequenceCode}`,
    legacyCapacitySlotId: slot.slotId,
    legacyCapacitySlotNumber: slotNumber,
    split: slot.split,
    regionalLandscapeType: slot.regionalLandscapeType,
    monsoonSeason: slot.monsoonSeason,
    waterCondition: [190, 194].includes(slotNumber) ? "inland_hydrology" : "no_water",
    entranceDirection: entranceBySlot[indexPosition],
    entranceDirectionZh: entranceZh[entranceBySlot[indexPosition]],
    measurementWindowId: slot.measurementWindowId,
    measurementFingerprint: slot.measurementFingerprints?.direct ?? null,
    sourceScope: slot.sourceScope,
    currentBuildStatus: isReference
      ? "reference_rgb_machine_passed_waiting_owner_review"
      : "complete_composition_condition_and_rgb_rebuild_required",
    currentRecordId: isReference ? NEW_REFERENCE_RECORD_ID : null,
    oldRgbMayBePositiveTrainingData: false,
  }
})

const registry = {
  schemaVersion: "thailand-rebuild64-sequence-registry-v1",
  registryId: "thailand-rebuild64-sequence-registry-v1",
  seriesId: SERIES_ID,
  status: "active_new64_success_lane_numbered_01_through_64",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  ownerCommandRef: OWNER_COMMAND_REF,
  sourceCapacityPlanRunId: capacityLatest.runId,
  sourceCapacityGapListPath: capacityLatest.gapListPath,
  sourceFrameworkAuditRunId: frameworkAudit.runId,
  sourceFrameworkAuditPath: frameworkAuditLatest.runPath,
  numberingContract: {
    firstCode: "01",
    lastCode: "64",
    codeWidth: 2,
    mappingRule: "sequenceNumber = legacyCapacitySlotNumber - 145",
    historicalRecordIdsRenamed: false,
    historicalDirectoriesMoved: false,
    historicalFilesDeleted: false,
    legacySlotIdRole: "source_traceability_only",
    newSequenceCodeRole: "canonical_new64_work_order_and_display_code",
  },
  counts: {
    total: entries.length,
    referenceReady: entries.filter((entry) => entry.currentRecordId).length,
    rebuildRequired: entries.filter((entry) => entry.currentBuildStatus.includes("rebuild_required")).length,
  },
  entries,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
  automaticStorage: true,
}

writeJsonAtomic(REGISTRY_PATH, registry)
bindCurrentNewReference(registry)
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "sequence-registry-run.json",
  record: {
    ...registry,
    canonicalRegistryPath: REGISTRY_PATH,
    canonicalRegistrySha256: sha256File(resolveProjectPath(REGISTRY_PATH)),
  },
  latest: {
    runId,
    status: registry.status,
    registryId: registry.registryId,
    seriesId: SERIES_ID,
    registryPath: REGISTRY_PATH,
    registrySha256: sha256File(resolveProjectPath(REGISTRY_PATH)),
    firstCode: "01",
    lastCode: "64",
    entryCount: entries.length,
    newReferenceCode: "53",
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
})

appendAiPainterProgramEvent({
  timestamp,
  action: "build_thailand_rebuild64_sequence_registry",
  runId,
  kind: "owner_authorized_new64_sequence_recode",
  status: "success",
  title: "Thailand rebuild64 success lane was recoded from 01 through 64",
  titleZh: "\u6cf0\u56fd\u65b064\u7ec4\u6210\u529f\u901a\u9053\u5df2\u4ece01\u91cd\u65b0\u7f16\u7801\u81f364",
  detail: `entries=64; first=01; last=64; legacySlot198=newCode53; historicalIdsRenamed=false; deleted=0`,
  detailZh: "\u7f16\u7801\u6570=64\uff1b\u9996\u7f16\u7801=01\uff1b\u672b\u7f16\u7801=64\uff1b\u539f\u69fd\u4f4d198\u5bf9\u5e94\u65b0\u7f16\u780153\uff1b\u5386\u53f2ID\u4e0d\u6539\u540d\uff1b\u5220\u9664=0",
  script: "scripts/build-thailand-rebuild64-sequence-registry.mjs",
  currentStep: "new64_sequence_registry_active",
  evidencePath: stored.runPath,
  evidence: [REGISTRY_PATH, stored.runPath],
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  status: registry.status,
  registryPath: REGISTRY_PATH,
  registrySha256: sha256File(resolveProjectPath(REGISTRY_PATH)),
  runPath: stored.runPath,
  counts: registry.counts,
  mapping: { first: "146 -> 01", reference: "198 -> 53", last: "209 -> 64" },
  historicalFilesDeleted: false,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
}, null, 2))

function bindCurrentNewReference(value) {
  const binding = value.entries.find((entry) => entry.currentRecordId === NEW_REFERENCE_RECORD_ID)
  assert(binding?.sequenceCode === "53", "new slot-198 V3 sequence binding must be 53")
  const currentIndex = readJson(LIBRARY_INDEX_PATH)
  const indexEntry = currentIndex.records.find((entry) => entry.recordId === NEW_REFERENCE_RECORD_ID)
  assert(indexEntry, "new slot-198 V3 index entry is missing")
  const recordPath = resolveProjectPath(indexEntry.recordPath)
  const record = readJson(recordPath)
  const metadata = sequenceMetadata(value, binding)
  writeJsonAtomic(recordPath, { ...record, rebuild64Sequence: metadata })
  writeJsonAtomic(LIBRARY_INDEX_PATH, {
    ...currentIndex,
    updatedAt: timestamp,
    records: currentIndex.records.map((entry) => entry.recordId === NEW_REFERENCE_RECORD_ID
      ? { ...entry, rebuild64Sequence: metadata, updatedAtUtc: timestamp, updatedAtAsiaShanghai: formatShanghai(timestamp) }
      : entry),
  })
}

function sequenceMetadata(value, entry) {
  return {
    registryId: value.registryId,
    seriesId: value.seriesId,
    sequenceNumber: entry.sequenceNumber,
    sequenceCode: entry.sequenceCode,
    sequenceLabel: entry.sequenceLabel,
    workItemId: entry.workItemId,
    legacyCapacitySlotId: entry.legacyCapacitySlotId,
    ownerCommandRef: OWNER_COMMAND_REF,
  }
}

function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  assert(fs.existsSync(resolved), `file is missing: ${value}`)
  return resolved
}
function writeJsonAtomic(value, body) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved.startsWith(`${ROOT}${path.sep}`), `write path escapes project: ${value}`)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  const temporary = `${resolved}.${process.pid}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(body, null, 2)}\n`)
  fs.renameSync(temporary, resolved)
}
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }
