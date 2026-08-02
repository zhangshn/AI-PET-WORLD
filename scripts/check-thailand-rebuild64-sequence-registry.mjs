import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const REGISTRY_PATH = "data/ai-painter/system-governance/thailand-rebuild64-sequence-registry-v1.json"
const LATEST_PATH = ".runtime/ai-painter/thailand-rebuild64-sequence-registry-runs/latest.json"
const LIBRARY_INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const failures = []
const registry = readJson(REGISTRY_PATH)
const latest = readJson(LATEST_PATH)
const index = readJson(LIBRARY_INDEX_PATH)

check(registry.entries?.length === 64, "registry entry count is not 64")
check(registry.numberingContract?.firstCode === "01", "first code is not 01")
check(registry.numberingContract?.lastCode === "64", "last code is not 64")
check(registry.numberingContract?.historicalRecordIdsRenamed === false, "historical record IDs were marked renamed")
check(registry.numberingContract?.historicalFilesDeleted === false, "historical files were marked deleted")
check(new Set(registry.entries?.map((entry) => entry.sequenceCode)).size === 64, "sequence codes are not unique")
check(new Set(registry.entries?.map((entry) => entry.workItemId)).size === 64, "work item IDs are not unique")

for (let indexPosition = 0; indexPosition < (registry.entries ?? []).length; indexPosition += 1) {
  const entry = registry.entries[indexPosition]
  const expectedNumber = indexPosition + 1
  const expectedSlot = 146 + indexPosition
  check(entry.sequenceNumber === expectedNumber, `sequence number mismatch at ${indexPosition}`)
  check(entry.sequenceCode === String(expectedNumber).padStart(2, "0"), `sequence code mismatch at ${indexPosition}`)
  check(entry.legacyCapacitySlotNumber === expectedSlot, `legacy slot number mismatch at ${indexPosition}`)
  check(entry.legacyCapacitySlotId === `v7-capacity-slot-${expectedSlot}`, `legacy slot ID mismatch at ${indexPosition}`)
  check(["north", "south", "east", "west"].includes(entry.entranceDirection), `entrance direction invalid at ${indexPosition}`)
  check(["no_water", "inland_hydrology"].includes(entry.waterCondition), `water condition invalid at ${indexPosition}`)
}

const seriesRecords = (index.records ?? []).filter((entry) => entry.rebuild64Sequence?.seriesId === registry.seriesId)
const activeSeriesRecords = seriesRecords.filter((entry) => entry.status !== "rejected")
const rejectedSeriesRecords = seriesRecords.filter((entry) => entry.status === "rejected")
for (const entry of registry.entries ?? []) {
  const records = seriesRecords.filter((record) => record.rebuild64Sequence?.sequenceCode === entry.sequenceCode)
  const activeRecords = records.filter((record) => record.status !== "rejected")
  check(records.length > 0, `sequence ${entry.sequenceCode} has no preserved record`)
  check(activeRecords.length === 1, `sequence ${entry.sequenceCode} does not have exactly one active record`)
  const activeRecord = activeRecords[0]
  check(activeRecord?.rebuild64Sequence?.legacyCapacitySlotId === entry.legacyCapacitySlotId, `sequence ${entry.sequenceCode} active slot binding mismatch`)
  check(activeRecord?.reviews?.ownerReviewStatus === "owner_approved", `sequence ${entry.sequenceCode} active record is not owner approved`)
  check(activeRecord?.aiAssistedColdStartEligible === true, `sequence ${entry.sequenceCode} active record is not AI-assisted eligible`)
  check(activeRecord?.v7CapacityContribution?.status === "registered", `sequence ${entry.sequenceCode} active record capacity is not registered`)
  for (const rejectedRecord of records.filter((record) => record.status === "rejected")) {
    check(rejectedRecord.rebuild64Sequence?.legacyCapacitySlotId === entry.legacyCapacitySlotId, `sequence ${entry.sequenceCode} rejected history slot binding mismatch`)
    check(rejectedRecord.v7CapacityContribution?.status !== "registered", `sequence ${entry.sequenceCode} rejected history still contributes capacity`)
  }
  if (entry.currentRecordId) {
    const registryReferenceRecord = (index.records ?? []).find((record) => record.recordId === entry.currentRecordId)
    check(Boolean(registryReferenceRecord), `sequence ${entry.sequenceCode} registry reference record is missing`)
    check(registryReferenceRecord?.rebuild64Sequence?.sequenceCode === entry.sequenceCode, `sequence ${entry.sequenceCode} registry reference binding mismatch`)
  }
}
check(activeSeriesRecords.length === 64, "active new64 record count is not 64")
check(new Set(activeSeriesRecords.map((entry) => entry.rebuild64Sequence?.sequenceCode)).size === 64, "active new64 sequence codes are not unique")
const referenceEntry = registry.entries?.find((entry) => entry.sequenceCode === "53")
check(referenceEntry?.legacyCapacitySlotId === "v7-capacity-slot-198", "new code 53 is not mapped to legacy slot 198")
check(latest.registrySha256 === sha256File(resolveProjectPath(REGISTRY_PATH)), "latest registry hash mismatch")

console.log(JSON.stringify({
  ok: failures.length === 0,
  status: failures.length === 0 ? "thailand_rebuild64_sequence_registry_check_passed" : "thailand_rebuild64_sequence_registry_check_failed",
  registryId: registry.registryId,
  seriesId: registry.seriesId,
  entryCount: registry.entries?.length ?? 0,
  firstCode: registry.entries?.[0]?.sequenceCode ?? null,
  lastCode: registry.entries?.at(-1)?.sequenceCode ?? null,
  slot198Code: referenceEntry?.sequenceCode ?? null,
  activeRecordCount: activeSeriesRecords.length,
  ownerApprovedActiveRecordCount: activeSeriesRecords.filter((entry) => entry.reviews?.ownerReviewStatus === "owner_approved").length,
  registeredCapacityCount: activeSeriesRecords.filter((entry) => entry.v7CapacityContribution?.status === "registered").length,
  preservedRejectedVersionCount: rejectedSeriesRecords.length,
  failures,
}, null, 2))
if (failures.length) process.exitCode = 1

function check(condition, message) { if (!condition) failures.push(message) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (!(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`))) throw new Error(`path escapes project: ${value}`)
  if (!fs.existsSync(resolved)) throw new Error(`file is missing: ${value}`)
  return resolved
}
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
