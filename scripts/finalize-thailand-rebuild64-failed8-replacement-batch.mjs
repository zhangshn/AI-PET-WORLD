import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SERIES_ID = "thailand-rebuild64-20260731"
const AUTHORIZATION_ID = "owner-authorized-thailand-rebuild64-failed8-rgb-replacements-20260801"
const CONTRACT_PATH = "data/ai-painter/system-governance/thailand-rebuild64-failed8-rgb-replacement-contract-v1.json"
const OUTPUT_ROOT = ".runtime/ai-painter/thailand-rebuild64-failed8-replacement-finalizations"
const TARGETS = [
  ["23", "v7-capacity-slot-168", "ai-cold-start-v7-v7-capacity-slot-168-dry-dipterocarp-woodland-v2", "ai-cold-start-v7-v7-capacity-slot-168-dry-dipterocarp-woodland-v3", "conditional-rgb-168-2026-08-01T07-27-05-686Z"],
  ["33", "v7-capacity-slot-178", "ai-cold-start-v7-v7-capacity-slot-178-forested-low-mountain-v2", "ai-cold-start-v7-v7-capacity-slot-178-forested-low-mountain-v3", "conditional-rgb-178-2026-08-01T07-27-26-360Z"],
  ["39", "v7-capacity-slot-184", "ai-cold-start-v7-v7-capacity-slot-184-seasonal-evergreen-semi-evergreen-forest-v2", "ai-cold-start-v7-v7-capacity-slot-184-seasonal-evergreen-semi-evergreen-forest-v3", "conditional-rgb-184-2026-08-01T07-27-32-807Z"],
  ["43", "v7-capacity-slot-188", "ai-cold-start-v7-v7-capacity-slot-188-grassland-forest-transition-v2", "ai-cold-start-v7-v7-capacity-slot-188-grassland-forest-transition-v3", "conditional-rgb-188-2026-08-01T07-27-39-363Z"],
  ["45", "v7-capacity-slot-190", "ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v2", "ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v3", "conditional-rgb-190-2026-08-01T07-27-46-598Z"],
  ["47", "v7-capacity-slot-192", "ai-cold-start-v7-v7-capacity-slot-192-forested-low-mountain-v2", "ai-cold-start-v7-v7-capacity-slot-192-forested-low-mountain-v3", "conditional-rgb-192-2026-08-01T07-27-53-591Z"],
  ["49", "v7-capacity-slot-194", "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v2", "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v3", "conditional-rgb-194-2026-08-01T07-28-01-149Z"],
  ["55", "v7-capacity-slot-200", "ai-cold-start-v7-v7-capacity-slot-200-forested-low-mountain-v1", "ai-cold-start-v7-v7-capacity-slot-200-forested-low-mountain-v2", "conditional-rgb-200-2026-08-01T07-28-08-611Z"],
]

const contract = readJson(CONTRACT_PATH)
assert(contract.status === "active_owner_authorized", "failed8 replacement contract is not active")
const index = readJson("data/world-samples/original-image-library/natural-home-v1/index.json")
const records = index.records.filter((record) => record.rebuild64Sequence?.seriesId === SERIES_ID)
const byId = new Map(records.map((record) => [record.recordId, record]))
const sequenceAudits = []

for (let sequenceNumber = 1; sequenceNumber <= 64; sequenceNumber += 1) {
  const matches = records.filter((record) => record.rebuild64Sequence.sequenceNumber === sequenceNumber)
  const eligible = matches.filter((record) => record.status === "ai_assisted_cold_start_eligible" && record.reviews?.ownerReviewStatus === "owner_approved")
  assert(eligible.length === 1, `sequence ${sequenceNumber}: expected exactly one active eligible record`)
  sequenceAudits.push({ sequenceCode: String(sequenceNumber).padStart(2, "0"), activeRecordId: eligible[0].recordId })
}

const replacements = TARGETS.map(([sequenceCode, slotId, failedRecordId, replacementRecordId, requestId]) => {
  const failed = byId.get(failedRecordId)
  const replacement = byId.get(replacementRecordId)
  assert(failed?.status === "rejected", `${sequenceCode}: old failed record is not preserved as rejected`)
  assert(failed.reviews?.machineReviewStatus === "machine_rejected", `${sequenceCode}: old machine failure evidence changed`)
  assert(replacement?.status === "ai_assisted_cold_start_eligible", `${sequenceCode}: replacement is not eligible`)
  assert(replacement.reviews?.ownerReviewStatus === "owner_approved", `${sequenceCode}: replacement delegated finalization missing`)
  assert(replacement.reviews?.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review", `${sequenceCode}: replacement machine review did not pass`)
  assert(replacement.conditionBinding?.capacitySlotId === slotId, `${sequenceCode}: slot binding mismatch`)
  assert(replacement.aiAssistedColdStart?.ownerAuthorizationRef === AUTHORIZATION_ID, `${sequenceCode}: authorization mismatch`)
  const ownerReview = readJson(replacement.reviews.ownerReviewPath)
  assert(ownerReview.reviewMode === "owner_delegated_machine_hard_gate_batch", `${sequenceCode}: delegated review mode missing`)
  assert(ownerReview.manualVisualInspectionPerformed === false, `${sequenceCode}: manual inspection was incorrectly claimed`)
  const request = readJson(`.runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/${requestId}/request.json`)
  assert(request.status === "generated_intaked_machine_passed_owner_approved", `${sequenceCode}: request did not reach final success`)
  assert(request.automaticRetryAuthorized === false, `${sequenceCode}: second retry was unexpectedly authorized`)
  assert(request.gpuTrainingAuthorized === false, `${sequenceCode}: GPU was unexpectedly authorized`)
  return {
    sequenceCode,
    slotId,
    sourceFailedRecordId: failedRecordId,
    sourceFailedStatus: failed.status,
    replacementRecordId,
    replacementStatus: replacement.status,
    replacementImageSha256: replacement.originalImage.sha256,
    machineReviewStatus: replacement.reviews.machineReviewStatus,
    ownerReviewStatus: replacement.reviews.ownerReviewStatus,
    conditionId: request.conditionLabel,
    requestId,
    requestStatus: request.status,
    pageGroup: "autonomous-generation-training-originals",
    oldPageGroup: "failed-records",
  }
})

const timestamp = new Date().toISOString()
const runId = `thailand-rebuild64-failed8-replacement-finalization-${timestamp.replace(/[:.]/g, "-")}`
const report = {
  schemaVersion: "thailand-rebuild64-failed8-replacement-finalization-v1",
  runId,
  status: "completed_all_eight_replacements_machine_passed_and_classified",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  authorizationId: AUTHORIZATION_ID,
  contractPath: CONTRACT_PATH,
  seriesId: SERIES_ID,
  activeSequenceCount: sequenceAudits.length,
  activeEligibleCount: sequenceAudits.length,
  replacementCount: replacements.length,
  replacementMachinePassedCount: replacements.filter((entry) => entry.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review").length,
  replacementFailedCount: 0,
  pendingOwnerReviewCount: 0,
  oldFailedRecordsPreservedCount: replacements.filter((entry) => entry.sourceFailedStatus === "rejected").length,
  replacements,
  sequenceAudits,
  safeguards: {
    oldFailedRgbUsedAsGenerationReference: false,
    secondRetryStarted: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  },
}

const stored = writeImmutableProgramRun({ root: OUTPUT_ROOT, runId, fileName: "finalization-report.json", record: report, latest: { runId, status: report.status, replacementCount: replacements.length } })
const reportSha256 = sha256File(stored.runPath)
appendAiPainterProgramEvent({
  action: "finalize_thailand_rebuild64_failed8_replacement_batch",
  runId,
  kind: "failed8_replacement_batch_finalized",
  status: "success",
  title: "Thailand rebuild64 failed8 replacement batch finalized",
  titleZh: "泰国新64组8张失败替换批次已完成",
  detail: `active64=64; replacements=8; machinePassed=8; oldFailedPreserved=8; reportSha256=${reportSha256}`,
  detailZh: "当前64个序号各有一个成功记录；8张替换图全部通过机器门禁，旧失败记录全部保留在未通过组。",
  script: projectPath(import.meta.filename),
  currentStep: report.status,
  evidencePath: stored.runPath,
  nextAction: "owner_may_review_success_page; no automatic training or world entry",
  nextActionZh: "项目所有者可在成功组统一审核；不会自动训练或进入世界。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})
console.log(JSON.stringify({ ok: true, reportPath: stored.runPath, reportSha256, ...report }, null, 2))

function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function assert(condition, message) { if (!condition) throw new Error(message) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
