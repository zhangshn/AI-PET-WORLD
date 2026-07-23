import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const INDEX_PATH = path.join(LIBRARY_ROOT, "index.json")
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-capacity-contributions"
const EXPECTED_WORLD_PROFILE = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
const EXPECTED_MAP_SCOPE = "complete-natural-home-map"
const EXPECTED_CONDITION_CONTRACT = "complete-map-scope-world-facts-v2"

const recordId = argumentValue("--record-id")
const ownerCommandRef = argumentValue("--owner-command-ref")
assert(recordId && /^[a-z0-9][a-z0-9_-]{1,127}$/.test(recordId), "--record-id is required")
assert(ownerCommandRef, "--owner-command-ref is required")

const recordPath = path.join(LIBRARY_ROOT, "complete-maps", recordId, "record.json")
assert(fs.existsSync(recordPath), `record missing: ${projectPath(recordPath)}`)
const record = readJson(recordPath)

if (record.v7CapacityContribution?.status === "registered") {
  verifyExistingRegistration(record)
  console.log(JSON.stringify({
    status: "v7_capacity_contribution_already_registered",
    recordId,
    capacitySlotId: record.v7CapacityContribution.capacitySlotId,
    split: record.v7CapacityContribution.split,
    contributionPath: record.v7CapacityContribution.contributionPath,
  }, null, 2))
  process.exit(0)
}

validateRecord(record)
const taskPackagePath = resolveProjectPath(record.worldBinding.taskPackagePath)
const taskPackage = readJson(taskPackagePath)
const conditionPackPath = resolveProjectPath(record.worldBinding.conditionPackPath)
const conditionPack = readJson(conditionPackPath)
const machineReviewPath = resolveProjectPath(record.reviews.machineReviewPath)
const machineReview = readJson(machineReviewPath)
const ownerReviewPath = resolveProjectPath(record.reviews.ownerReviewPath)
const ownerReview = readJson(ownerReviewPath)
const scopeAuditPath = path.join(path.dirname(taskPackagePath), "complete-map-scope-audit.json")
const scopeAudit = readJson(scopeAuditPath)
const sourceGapListPath = resolveProjectPath(taskPackage.sourceBindings?.capacityGapListPath)
const sourceGapList = readJson(sourceGapListPath)
const capacitySlot = taskPackage.capacitySlot

validateTaskAndEvidence({
  record,
  taskPackage,
  conditionPack,
  machineReview,
  ownerReview,
  scopeAudit,
  sourceGapList,
  sourceGapListPath,
})
validateUniqueness({ record, taskPackage, capacitySlot })

const timestamp = new Date().toISOString()
const contributionId = `ai-assisted-v7-capacity-contribution-${capacitySlot.slotId}-${timestamp.replace(/[:.]/g, "-")}`
const contribution = {
  schemaVersion: "ai-assisted-v7-capacity-contribution-v1",
  contributionId,
  status: "registered",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  recordId,
  ownerCommandRef,
  capacitySlotId: capacitySlot.slotId,
  split: capacitySlot.split,
  worldProfileId: record.worldBinding.worldProfileId,
  mapScope: record.classification.mapScope,
  regionalLandscapeType: record.classification.regionalLandscapeType,
  monsoonSeason: record.classification.monsoonSeason,
  imagePath: projectPath(path.join(record.relativeDirectory, record.originalImage.path)),
  imageSha256: record.originalImage.sha256,
  taskPackageId: taskPackage.taskId,
  taskPackagePath: record.worldBinding.taskPackagePath,
  taskPackageSha256: fileSha256(taskPackagePath),
  conditionLabel: taskPackage.conditionLabel,
  conditionWorldId: taskPackage.worldId,
  conditionPackId: conditionPack.conditionPackId,
  conditionPackPath: record.worldBinding.conditionPackPath,
  conditionPackFileSha256: fileSha256(conditionPackPath),
  conditionPackCanonicalSha256: conditionPack.conditionPackSha256,
  conditionChannelCount: conditionPack.channels.length,
  completeMapScopeAuditPath: projectPath(scopeAuditPath),
  completeMapScopeAuditSha256: fileSha256(scopeAuditPath),
  machineReviewPath: record.reviews.machineReviewPath,
  machineReviewSha256: fileSha256(machineReviewPath),
  ownerReviewPath: record.reviews.ownerReviewPath,
  ownerReviewSha256: fileSha256(ownerReviewPath),
  sourceCapacityGapListPath: projectPath(sourceGapListPath),
  sourceCapacityGapListSha256: fileSha256(sourceGapListPath),
  sourceCapacityPlanRunId: sourceGapList.runId,
  trainingEligibility: {
    aiAssistedConditionalDenoiser: true,
    independentTraining: false,
    formalCandidate: false,
    runtimeFrame: false,
    worldPage: false,
  },
  automaticStorage: true,
}

const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: contributionId,
  fileName: "contribution.json",
  record: contribution,
  latest: {
    recordId,
    capacitySlotId: capacitySlot.slotId,
    split: capacitySlot.split,
  },
})
const contributionSha256 = fileSha256(written.runPath)
const updatedRecord = {
  ...record,
  conditionBinding: {
    ...record.conditionBinding,
    status: "formal_conditional_training_eligible_owner_approved_v7_capacity_registered",
    formalConditionalTrainingEligible: true,
  },
  v7CapacityContribution: {
    status: "registered",
    contributionId,
    capacitySlotId: capacitySlot.slotId,
    split: capacitySlot.split,
    contributionPath: written.runPath,
    contributionSha256,
    registeredAtUtc: timestamp,
    registeredAtAsiaShanghai: formatShanghai(timestamp),
    ownerCommandRef,
  },
  updatedAtUtc: timestamp,
  updatedAtAsiaShanghai: formatShanghai(timestamp),
}
writeJsonAtomic(recordPath, updatedRecord)
updateLibraryIndex(updatedRecord)
indexWrittenArtifact(recordPath, contributionId)
indexWrittenArtifact(INDEX_PATH, contributionId)

appendAiPainterProgramEvent({
  action: "register_ai_assisted_v7_capacity_contribution",
  runId: contributionId,
  kind: "step_completed",
  status: "success",
  title: "V7 condition-RGB capacity contribution registered",
  titleZh: "V7 条件与 RGB 容量贡献已登记",
  detail: `${recordId} now contributes ${capacitySlot.slotId} (${capacitySlot.split}) to the approved 128-map V7 capacity.` ,
  detailZh: `${recordId} 已按 ${capacitySlot.slotId}（${capacitySlot.split}）计入 V7 已批准的 128 张容量。`,
  script: "scripts/register-ai-assisted-v7-capacity-contribution.mjs",
  currentStep: "v7_capacity_contribution_registered",
  evidencePath: written.runPath,
  evidence: [written.runPath, projectPath(recordPath), projectPath(INDEX_PATH)],
})

console.log(JSON.stringify({
  status: "v7_capacity_contribution_registered",
  recordId,
  capacitySlotId: capacitySlot.slotId,
  split: capacitySlot.split,
  contributionPath: written.runPath,
  contributionSha256,
  imageGenerated: false,
  gpuTrainingStarted: false,
}, null, 2))

function validateRecord(value) {
  assert(value.recordId === recordId, "record identity mismatch")
  assert(value.categoryId === "complete-maps", "V7 contribution requires a complete-map record")
  assert(value.status === "ai_assisted_cold_start_eligible", "record is not owner-approved AI-assisted training data")
  assert(value.aiAssistedColdStartEligible === true && value.independentTrainingEligible === false, "training lane mismatch")
  assert(value.worldBinding?.worldProfileId === EXPECTED_WORLD_PROFILE, "world profile mismatch")
  assert(value.classification?.mapScope === EXPECTED_MAP_SCOPE, "complete-map scope missing")
  assert(value.originalImage?.width === 1024 && value.originalImage?.height === 768, "image must be native 1024x768")
  assert(value.conditionBinding?.formalConditionalTrainingEligible === true, "formal conditional training eligibility missing")
  assert(value.reviews?.ownerReviewStatus === "owner_approved", "owner review is not approved")
  assert(value.reviews?.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review", "machine review status invalid")
  verifyHash(path.join(value.relativeDirectory, value.originalImage.path), value.originalImage.sha256, "source image hash mismatch")
}

function validateTaskAndEvidence(input) {
  const { record: value, taskPackage, conditionPack, machineReview, ownerReview, scopeAudit, sourceGapList, sourceGapListPath } = input
  const slot = taskPackage.capacitySlot
  assert(taskPackage.generationContractVersion === EXPECTED_CONDITION_CONTRACT, "task condition contract mismatch")
  assert(taskPackage.taskId === value.worldBinding.taskPackageId, "task package identity mismatch")
  assert(taskPackage.worldId === value.worldBinding.worldId, "task world identity mismatch")
  assert(/^v7-complete-map-\d{3}$/.test(taskPackage.conditionLabel ?? ""), "V7 condition label invalid")
  assert(slot?.slotId && /^v7-capacity-slot-\d{3}$/.test(slot.slotId), "V7 capacity slot identity missing")
  assert(["train", "validation", "challenge", "regression"].includes(slot.split), "V7 capacity split invalid")
  assert(slot.mapScope === EXPECTED_MAP_SCOPE && slot.worldProfileId === EXPECTED_WORLD_PROFILE, "capacity slot scope mismatch")
  assert(slot.requiredConditionContract === EXPECTED_CONDITION_CONTRACT, "capacity slot condition contract mismatch")
  assert(slot.regionalLandscapeType === value.classification.regionalLandscapeType, "capacity landscape mismatch")
  assert(slot.monsoonSeason === value.classification.monsoonSeason, "capacity monsoon season mismatch")
  assert(taskPackage.sourceBindings?.capacitySlotId === slot.slotId, "task source capacity slot mismatch")
  verifyHash(sourceGapListPath, taskPackage.sourceBindings.capacityGapListSha256, "source capacity gap-list hash mismatch")
  const plannedSlot = (sourceGapList.plannedSlots ?? []).find((entry) => entry.slotId === slot.slotId)
  assert(plannedSlot && sameJson(plannedSlot, slot), "source capacity slot no longer matches the task snapshot")

  assert(scopeAudit.passed === true && scopeAudit.status === "complete_map_scope_passed", "complete-map scope audit failed")
  assert(scopeAudit.sourceIdentity?.taskId === taskPackage.taskId, "scope audit task identity mismatch")
  assert(scopeAudit.generatedImageCreated === false && scopeAudit.computeStarted === false, "scope audit must remain pre-generation evidence")

  assert(conditionPack.status === "compiled_conditions_ready", "condition pack is not ready")
  assert(conditionPack.taskId === taskPackage.taskId && conditionPack.worldId === taskPackage.worldId, "condition pack identity mismatch")
  assert(conditionPack.conditionPackId === value.worldBinding.conditionPackId, "condition pack id mismatch")
  assert(conditionPack.conditionPackSha256 === value.worldBinding.conditionPackSha256, "condition pack canonical hash mismatch")
  assert(conditionPack.canvas?.width === 1024 && conditionPack.canvas?.height === 768, "condition canvas must be 1024x768")
  assert(conditionPack.canvas?.frameScope === "complete_runtime_frame", "condition frame scope is not complete")
  assert(conditionPack.channels?.length === 23, "condition channel count is not 23")
  for (const channel of conditionPack.channels) verifyHash(channel.path, channel.sha256, `condition channel hash mismatch: ${channel.channelId}`)

  assert(machineReview.passed === true && machineReview.imageSha256 === value.originalImage.sha256, "machine review invalid")
  assert(machineReview.semanticConditionAudit?.passed === true, "semantic condition audit failed")
  assert(machineReview.styleFingerprintAudit?.passed === true, "style fingerprint audit failed")
  assert(machineReview.compositionNoveltyAudit?.passed === true, "composition novelty audit failed")
  assert(ownerReview.decision === "owner_approved" && ownerReview.imageSha256 === value.originalImage.sha256, "owner review invalid")
}

function validateUniqueness({ record: value, taskPackage, capacitySlot }) {
  const index = readJson(INDEX_PATH)
  for (const summary of index.records ?? []) {
    if (summary.recordId === value.recordId || !summary.recordPath || !fs.existsSync(resolveProjectPath(summary.recordPath))) continue
    const other = readJson(summary.recordPath)
    if (other.v7CapacityContribution?.status !== "registered") continue
    assert(other.v7CapacityContribution.capacitySlotId !== capacitySlot.slotId, `capacity slot already registered: ${capacitySlot.slotId}`)
    assert(other.originalImage?.sha256 !== value.originalImage.sha256, "V7 contribution image hash is duplicated")
    assert(other.worldBinding?.worldId !== value.worldBinding.worldId, "V7 contribution world identity is duplicated")
    assert(other.worldBinding?.taskPackageId !== value.worldBinding.taskPackageId, "V7 contribution task identity is duplicated")
    const otherTask = readJson(other.worldBinding.taskPackagePath)
    assert(otherTask.conditionLabel !== taskPackage.conditionLabel, "V7 contribution condition label is duplicated")
  }
}

function verifyExistingRegistration(value) {
  verifyHash(value.v7CapacityContribution.contributionPath, value.v7CapacityContribution.contributionSha256, "existing contribution hash mismatch")
  const contribution = readJson(value.v7CapacityContribution.contributionPath)
  assert(contribution.recordId === value.recordId, "existing contribution record mismatch")
  assert(contribution.capacitySlotId === value.v7CapacityContribution.capacitySlotId, "existing contribution slot mismatch")
  assert(contribution.imageSha256 === value.originalImage.sha256, "existing contribution image mismatch")
}

function updateLibraryIndex(value) {
  const index = readJson(INDEX_PATH)
  const records = (index.records ?? []).map((summary) => summary.recordId === value.recordId ? {
    ...summary,
    title: value.title,
    status: value.status,
    conditionBinding: value.conditionBinding,
    v7CapacityContribution: value.v7CapacityContribution,
    updatedAtUtc: value.updatedAtUtc,
    updatedAtAsiaShanghai: value.updatedAtAsiaShanghai,
  } : summary)
  assert(records.some((summary) => summary.recordId === value.recordId), "library index record missing")
  writeJsonAtomic(INDEX_PATH, { ...index, updatedAt: value.updatedAtUtc, records })
}

function indexWrittenArtifact(filePath, runId) {
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

function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`); return resolved }
function fileSha256(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolveProjectPath(value))).digest("hex") }
function verifyHash(value, expected, message) { const filePath = resolveProjectPath(value); assert(fs.existsSync(filePath), `file missing: ${projectPath(filePath)}`); assert(fileSha256(filePath) === expected, message) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function assert(condition, message) { if (!condition) throw new Error(message) }
