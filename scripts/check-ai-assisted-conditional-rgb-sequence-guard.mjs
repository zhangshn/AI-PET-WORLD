import fs from "node:fs"
import path from "node:path"
import {
  evaluateConditionalRgbGenerationSequence,
  readConditionalRgbGenerationRequests,
} from "./lib/ai-assisted-conditional-rgb-sequence-guard.mjs"

const ROOT = process.cwd()
const REQUEST_ROOT = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-cold-start", "conditional-rgb-generation-requests")
const index = readJson("data/world-samples/original-image-library/natural-home-v1/index.json")
const requests = readConditionalRgbGenerationRequests(REQUEST_ROOT)

const completedGate = evaluateConditionalRgbGenerationSequence({
  sourceRecordId: "ai-cold-start-map-002-inland-river-valley",
  conditionLabel: "legacy-complete-map-002",
  generationContractVersion: "legacy-conditional-world-facts-v1",
  outputRecordBase: "ai-cold-start-condition-pair-002-inland-tropical-river-valley",
  libraryRecords: index.records ?? [],
  generationRequests: requests,
})
assert(!completedGate.allowed, "condition 002 must remain blocked after V4 owner review")
assert(
  [
    "conditional_rgb_generation_blocked_pending_owner_review",
    "conditional_rgb_generation_blocked_condition_already_owner_approved",
  ].includes(completedGate.code),
  `unexpected condition 002 block: ${completedGate.code}`,
)
assert(completedGate.blockingRecordIds.includes("ai-cold-start-condition-pair-002-inland-tropical-river-valley-v4"), "condition 002 V4 blocking record was not identified")

const rejected004Gate = evaluateConditionalRgbGenerationSequence({
  sourceRecordId: "ai-cold-start-map-004-moist-deciduous-teak-forest",
  conditionLabel: "legacy-complete-map-004",
  generationContractVersion: "legacy-conditional-world-facts-v1",
  outputRecordBase: "ai-cold-start-condition-pair-004-moist-deciduous-teak-forest",
  libraryRecords: index.records ?? [],
  generationRequests: requests,
})
assert(!rejected004Gate.allowed, "owner-rejected condition 004 must not retry without a new explicit authorization")
assert(rejected004Gate.code === "conditional_rgb_generation_blocked_repeat_requires_owner_authorization", `unexpected condition 004 block: ${rejected004Gate.code}`)

const completed005Gate = evaluateConditionalRgbGenerationSequence({
  sourceRecordId: "ai-cold-start-map-005-seasonal-evergreen-semi-evergreen-forest",
  conditionLabel: "legacy-complete-map-005",
  generationContractVersion: "legacy-conditional-world-facts-v1",
  outputRecordBase: "ai-cold-start-condition-pair-005-seasonal-evergreen-semi-evergreen-forest",
  libraryRecords: index.records ?? [],
  generationRequests: requests,
})
assert(!completed005Gate.allowed, "condition 005 must remain blocked after V2 owner approval")
const condition005Record = (index.records ?? []).find((record) => record.recordId === "ai-cold-start-condition-pair-005-seasonal-evergreen-semi-evergreen-forest-v2")
const expectedCondition005Code = condition005Record?.reviews?.ownerReviewStatus === "owner_approved"
  ? "conditional_rgb_generation_blocked_condition_already_owner_approved"
  : "conditional_rgb_generation_blocked_repeat_requires_owner_authorization"
assert(completed005Gate.code === expectedCondition005Code, `unexpected condition 005 state: ${completed005Gate.code}`)
assert(completed005Gate.blockingRecordIds.includes("ai-cold-start-condition-pair-005-seasonal-evergreen-semi-evergreen-forest-v2"), "condition 005 V2 blocking record was not identified")

const syntheticRejectedRecord = {
  recordId: "ai-cold-start-condition-pair-900-synthetic-v1",
  createdAtUtc: "2026-01-01T00:00:00.000Z",
  reviews: { ownerReviewStatus: "owner_rejected" },
}
const syntheticRequest = {
  requestId: "conditional-rgb-900-synthetic",
  sourceRecordId: "ai-cold-start-map-900-synthetic",
  conditionLabel: "complete-map-v2-900",
  generationContractVersion: "complete-map-scope-world-facts-v2",
  outputRecordId: syntheticRejectedRecord.recordId,
  status: "generated_intaked_machine_passed_waiting_owner_review",
  createdAtUtc: "2026-01-01T00:00:00.000Z",
}
const repeatGate = evaluateConditionalRgbGenerationSequence({
  sourceRecordId: syntheticRequest.sourceRecordId,
  conditionLabel: syntheticRequest.conditionLabel,
  generationContractVersion: syntheticRequest.generationContractVersion,
  outputRecordBase: "ai-cold-start-condition-pair-900-synthetic",
  libraryRecords: [syntheticRejectedRecord],
  generationRequests: [syntheticRequest],
})
assert(!repeatGate.allowed && repeatGate.code === "conditional_rgb_generation_blocked_repeat_requires_owner_authorization", "rejected condition repeated without owner authorization")

const authorizedRetryGate = evaluateConditionalRgbGenerationSequence({
  sourceRecordId: syntheticRequest.sourceRecordId,
  conditionLabel: syntheticRequest.conditionLabel,
  generationContractVersion: syntheticRequest.generationContractVersion,
  outputRecordBase: "ai-cold-start-condition-pair-900-synthetic",
  libraryRecords: [syntheticRejectedRecord],
  generationRequests: [syntheticRequest],
  ownerAuthorizedRetry: true,
  retryReason: "project-owner explicitly requested a corrected retry",
})
assert(authorizedRetryGate.allowed, `explicit owner-authorized retry should be allowed: ${authorizedRetryGate.code}`)

const retryableFailureGate = evaluateConditionalRgbGenerationSequence({
  sourceRecordId: syntheticRequest.sourceRecordId,
  conditionLabel: syntheticRequest.conditionLabel,
  generationContractVersion: syntheticRequest.generationContractVersion,
  outputRecordBase: "ai-cold-start-condition-pair-900-synthetic",
  libraryRecords: [],
  generationRequests: [{ ...syntheticRequest, status: "generation_failed_retryable" }],
  ownerAuthorizedRetry: true,
  retryReason: "project-owner explicitly changed the generation route",
})
assert(retryableFailureGate.allowed, `owner-authorized recovery from a generation failure should be allowed: ${retryableFailureGate.code}`)

const legacyRequestWithSameSource = {
  ...syntheticRequest,
  requestId: "conditional-rgb-900-legacy",
  outputRecordId: "ai-cold-start-condition-pair-900-legacy-v1",
  conditionLabel: "legacy-complete-map-900",
  generationContractVersion: "legacy-conditional-world-facts-v1",
}
const newIdentityGate = evaluateConditionalRgbGenerationSequence({
  sourceRecordId: syntheticRequest.sourceRecordId,
  conditionLabel: "complete-map-v2-900",
  generationContractVersion: "complete-map-scope-world-facts-v2",
  outputRecordBase: "ai-cold-start-condition-pair-900-new-identity",
  libraryRecords: [],
  generationRequests: [legacyRequestWithSameSource],
})
assert(newIdentityGate.allowed, "legacy request with the same sourceRecordId must not block a new generation-contract condition identity")
assert(newIdentityGate.priorRequestCount === 0, "legacy request leaked into the new condition identity")

const previousTaskVersionRequest = {
  ...syntheticRequest,
  requestId: "conditional-rgb-900-previous-task-version",
  taskPackageId: "task-complete-map-v2-900-old",
  conditionPackId: "conditions-complete-map-v2-900-old",
  conditionPackSha256: "old-condition-pack-sha256",
}
const previousTaskVersionRecord = {
  ...syntheticRejectedRecord,
  reviews: { ownerReviewStatus: "owner_approved" },
  conditionBinding: {
    taskId: previousTaskVersionRequest.taskPackageId,
    conditionPackId: previousTaskVersionRequest.conditionPackId,
    conditionPackSha256: previousTaskVersionRequest.conditionPackSha256,
  },
}
const currentTaskVersionGate = evaluateConditionalRgbGenerationSequence({
  sourceRecordId: syntheticRequest.sourceRecordId,
  conditionLabel: syntheticRequest.conditionLabel,
  generationContractVersion: syntheticRequest.generationContractVersion,
  taskId: "task-complete-map-v2-900-current",
  conditionPackId: "conditions-complete-map-v2-900-current",
  conditionPackSha256: "current-condition-pack-sha256",
  outputRecordBase: "ai-cold-start-condition-pair-900-synthetic",
  libraryRecords: [previousTaskVersionRecord],
  generationRequests: [previousTaskVersionRequest],
})
assert(currentTaskVersionGate.allowed, "an owner-approved RGB from an older task/condition version must not block the current formal condition identity")
assert(currentTaskVersionGate.priorRequestCount === 0 && currentTaskVersionGate.priorRecordCount === 0, "older task/condition version leaked into current sequence identity")

const v5Exists = (index.records ?? []).some((record) => record.recordId === "ai-cold-start-condition-pair-002-inland-tropical-river-valley-v5")
assert(!v5Exists, "condition 002 V5 must not exist")
const v3For005Exists = (index.records ?? []).some((record) => record.recordId === "ai-cold-start-condition-pair-005-seasonal-evergreen-semi-evergreen-forest-v3")
assert(!v3For005Exists, "condition 005 V3 must not exist")

console.log(JSON.stringify({
  ok: true,
  status: "ai_assisted_conditional_rgb_sequence_guard_passed",
  currentCondition002: completedGate,
  rejectedCondition004: {
    sourceRecordId: "ai-cold-start-map-004-moist-deciduous-teak-forest",
    allowed: rejected004Gate.allowed,
    code: rejected004Gate.code,
  },
  completedCondition005: {
    sourceRecordId: "ai-cold-start-map-005-seasonal-evergreen-semi-evergreen-forest",
    allowed: completed005Gate.allowed,
    code: completed005Gate.code,
  },
  repeatWithoutOwnerAuthorization: repeatGate.code,
  ownerAuthorizedRetryAllowed: authorizedRetryGate.allowed,
  retryableFailureRecoveryAllowed: retryableFailureGate.allowed,
  legacyHistoryIsolatedFromNewIdentity: newIdentityGate.allowed,
  previousTaskVersionIsolatedFromCurrentIdentity: currentTaskVersionGate.allowed,
  condition002V5Exists: v5Exists,
  condition005V3Exists: v3For005Exists,
}, null, 2))

function readJson(value) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8"))
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}
