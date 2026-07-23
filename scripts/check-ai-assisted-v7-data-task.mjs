import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { closeStorageCatalog, openStorageCatalog } from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const requestedSlotId = argumentValue("--slot-id")
const EXPECTED_PROFILE_ID = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"

const latestPath = resolveProjectPath(".runtime/ai-painter/ai-assisted-v7-data-tasks/latest.json")
const pointer = readJson(latestPath)
const expectedSlotId = requestedSlotId ?? pointer.capacitySlotId
assert(/^v7-capacity-slot-\d{3}$/.test(expectedSlotId), "expected V7 capacity slot ID is invalid")
const latest = requestedSlotId ? findLatestTaskForSlot(expectedSlotId) : pointer
assert(latest, `V7 task does not exist for ${expectedSlotId}`)
assert(latest.capacitySlotId === expectedSlotId, `selected V7 task does not belong to ${expectedSlotId}`)
assert(latest.imageGenerationStarted === false, "V7 task unexpectedly started image generation")
assert(latest.gpuTrainingStarted === false, "V7 task unexpectedly started GPU training")

const manifestPath = resolveProjectPath(latest.manifestPath)
verifyHash(manifestPath, latest.manifestSha256, "V7 task manifest hash mismatch")
const manifest = readJson(manifestPath)
const row = manifest.row
assert(row.capacitySlotId === expectedSlotId, "V7 task slot identity mismatch")
verifyHash(resolveProjectPath(manifest.capacityGapListPath), manifest.capacityGapListSha256, "V7 capacity gap-list hash mismatch")
const gapList = readJson(resolveProjectPath(manifest.capacityGapListPath))
const plannedSlot = gapList.plannedSlots?.find((entry) => entry.slotId === expectedSlotId)
assert(plannedSlot, `V7 capacity slot is missing from the bound gap list: ${expectedSlotId}`)
assert(row.regionalLandscapeType === plannedSlot.regionalLandscapeType, "V7 task landscape identity mismatch")
assert(row.monsoonSeason === plannedSlot.monsoonSeason, "V7 task season identity mismatch")
assert(row.split === plannedSlot.split, "V7 task split identity mismatch")
assert(row.coverageRole === plannedSlot.coverageRole, "V7 task coverage role mismatch")
const coverage = readJson(resolveProjectPath("data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json"))
const snapshotEntry = coverage.availableVisualSnapshots?.find((entry) => entry.season === plannedSlot.monsoonSeason)
assert(snapshotEntry, `approved environment snapshot is missing for ${plannedSlot.monsoonSeason}`)
assert(row.environmentSnapshotId === snapshotEntry.snapshotId, "V7 task transition snapshot mismatch")
assert(row.channelCount === 23, "V7 task must contain exactly 23 channels")
assert(row.completeMapScopePassed === true, "V7 task did not pass complete-map scope")
assert(row.pairedRgbCount === 0, "V7 task unexpectedly has an RGB pair")
assert(row.imageGenerationAuthorized === true, "V7 task is missing continuous batch image-generation authorization")
assert(row.gpuTrainingAuthorized === false, "V7 task unexpectedly authorizes GPU training")
assert(row.continuousBatchAuthorizationId === "owner-authorized-v7-remaining-104-continuous-batch-20260723", "V7 task continuous batch authorization mismatch")
assert(manifest.continuousBatchAuthorization?.executionMode === "sequential_one_active_generation_request", "V7 task is not strictly sequential")
assert(manifest.continuousBatchAuthorization?.ownerApprovalAutomatic === false, "V7 task must not auto-approve owner review")
assert(manifest.continuousBatchAuthorization?.gpuTrainingAutomatic === false, "V7 task must not auto-start GPU training")
assert(manifest.imageGenerationStarted === false, "V7 manifest unexpectedly started image generation")
assert(manifest.gpuTrainingStarted === false, "V7 manifest unexpectedly started GPU training")
assert(manifest.automaticStorage === true, "V7 task automatic storage is not enabled")

for (const [filePath, expectedHash, label] of [
  [row.blueprintPath, row.blueprintSha256, "world-fact blueprint"],
  [row.directorOutputPath, row.directorOutputSha256, "world-director output"],
  [row.taskPackagePath, row.taskPackageSha256, "task package"],
  [row.conditionPackPath, row.conditionPackFileSha256, "23-channel condition pack file"],
  [row.completeMapScopeAuditPath, row.completeMapScopeAuditSha256, "complete-map scope audit"],
]) verifyHash(resolveProjectPath(filePath), expectedHash, `${label} hash mismatch`)

const blueprint = readJson(resolveProjectPath(row.blueprintPath))
const task = readJson(resolveProjectPath(row.taskPackagePath))
const conditionPack = readJson(resolveProjectPath(row.conditionPackPath))
const scopeAudit = readJson(resolveProjectPath(row.completeMapScopeAuditPath))

assert(blueprint.capacitySlotId === expectedSlotId, "world facts are bound to the wrong V7 slot")
assert(blueprint.worldProfileId === EXPECTED_PROFILE_ID, "world facts use the wrong world profile")
assert(blueprint.canvas?.width === 1024 && blueprint.canvas?.height === 768, "world facts do not use native 1024x768")
assert(blueprint.canvas?.frameScope === "complete_runtime_frame", "world facts are not complete-map scope")
assert(blueprint.sourceImageGeometryRead === false, "world facts read historical RGB geometry")
assert(blueprint.existingRgbMayBeBoundAsTarget === false, "world facts allow an existing RGB target")
assert(blueprint.uniqueWorldSeed === row.uniqueWorldSeed, "unique world seed mismatch")
assert(blueprint.uniqueLayoutVariant === row.uniqueLayoutVariant, "unique layout variant mismatch")
assert(task.capacitySlot?.slotId === expectedSlotId, "task package slot identity mismatch")
assert(task.inferenceGate?.canRunCompleteVisualInference === false, "task package incorrectly opens visual inference")
assert(conditionPack.channels?.length === 23, "condition pack does not contain 23 channels")
assert(new Set(conditionPack.channels.map((entry) => entry.id)).size === 23, "condition pack channel IDs are not unique")
const canonicalConditionPack = structuredClone(conditionPack)
delete canonicalConditionPack.conditionPackSha256
assert(sha256(Buffer.from(JSON.stringify(canonicalConditionPack))) === row.conditionPackCanonicalSha256, "condition pack canonical hash mismatch")
assert(conditionPack.conditionPackSha256 === row.conditionPackCanonicalSha256, "condition pack self-signature mismatch")
assert(scopeAudit.passed === true && scopeAudit.status === "complete_map_scope_passed", "scope audit is not passed")
assert(scopeAudit.generatedImageCreated === false, "scope audit unexpectedly created an image")
assert(scopeAudit.computeStarted === false, "scope audit unexpectedly started generation compute")

const runRoot = path.dirname(manifestPath)
const runFiles = listFilesRecursive(runRoot)
const database = openStorageCatalog()
const indexedArtifact = database.prepare("SELECT logical_path, sha256 FROM artifacts WHERE logical_path = ? AND run_id = ?")
for (const filePath of runFiles) {
  const row = indexedArtifact.get(projectPath(filePath), manifest.runId)
  assert(row, `V7 run artifact is missing from SQLite: ${projectPath(filePath)}`)
  assert(row.sha256 === sha256(fs.readFileSync(filePath)), `V7 SQLite artifact hash mismatch: ${projectPath(filePath)}`)
}
const programEvents = database.prepare(`
  SELECT title_zh, event_json
  FROM program_events
  WHERE run_id = ? AND action = 'prepare_v7_capacity_slot_task' AND status = 'success'
`).all(manifest.runId)
assert(programEvents.length === 1, "V7 task must have exactly one successful automatic program event")
const programEvent = JSON.parse(programEvents[0].event_json)
assert(Boolean(programEvents[0].title_zh), "V7 task program event is missing its Chinese title")
assert(Boolean(programEvent.titleEn), "V7 task program event is missing its English title")
assert(programEvent.evidence?.includes(row.conditionPackPath), "V7 task program event is missing condition-pack evidence")
closeStorageCatalog()

console.log(JSON.stringify({
  status: "passed",
  runId: manifest.runId,
  capacitySlotId: row.capacitySlotId,
  regionalLandscapeType: row.regionalLandscapeType,
  monsoonSeason: row.monsoonSeason,
  environmentSnapshotId: row.environmentSnapshotId,
  channelCount: row.channelCount,
  completeMapScopePassed: row.completeMapScopePassed,
  pairedRgbCount: row.pairedRgbCount,
  sqliteArtifactCount: runFiles.length,
  bilingualProgramEventCount: programEvents.length,
  imageGenerationStarted: manifest.imageGenerationStarted,
  gpuTrainingStarted: manifest.gpuTrainingStarted,
}, null, 2))

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function verifyHash(filePath, expectedHash, message) {
  assert(fs.existsSync(filePath), `required evidence missing: ${projectPath(filePath)}`)
  assert(sha256(fs.readFileSync(filePath)) === expectedHash, message)
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  assert(fs.existsSync(resolved), `required path missing: ${value}`)
  return resolved
}

function projectPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/")
}

function listFilesRecursive(root) {
  const files = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...listFilesRecursive(resolved))
    else if (entry.isFile()) files.push(resolved)
  }
  return files
}

function findLatestTaskForSlot(slotId) {
  const taskRoot = resolveProjectPath(".runtime/ai-painter/ai-assisted-v7-data-tasks")
  const candidates = listFilesRecursive(taskRoot)
    .filter((filePath) => path.basename(filePath) === "manifest.json")
    .map((filePath) => {
      try { return { filePath, manifest: readJson(filePath) } }
      catch { return null }
    })
    .filter((entry) => entry?.manifest?.row?.capacitySlotId === slotId && entry.manifest.status !== "failed_before_rgb_generation")
    .sort((left, right) => String(right.manifest.createdAt ?? "").localeCompare(String(left.manifest.createdAt ?? "")))
  const selected = candidates[0]
  if (!selected) return null
  return {
    capacitySlotId: slotId,
    imageGenerationStarted: selected.manifest.imageGenerationStarted,
    gpuTrainingStarted: selected.manifest.gpuTrainingStarted,
    manifestPath: projectPath(selected.filePath),
    manifestSha256: sha256(fs.readFileSync(selected.filePath)),
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
