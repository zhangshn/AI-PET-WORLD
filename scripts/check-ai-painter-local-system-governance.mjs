import fs from "node:fs"
import path from "node:path"
import {
  readLocalGovernanceContract,
  validateStoredOwnerActionRequest,
} from "./lib/ai-painter-local-governance.mjs"
import {
  closeStorageCatalog,
  openStorageCatalog,
} from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const LATEST_PATH = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests", "latest.json")
const REQUIRED_DOCUMENT_TEXT = [
  "已发布能力版本内由本地程序自主执行生成、验证、审核、发布或失败关闭",
  "Codex只作为受控执行与检查员工",
  "owner-action-request",
]

const { contract, contractSha256 } = readLocalGovernanceContract(ROOT)
assert(fs.existsSync(LATEST_PATH), "owner action request latest pointer is missing")
const latest = readJson(LATEST_PATH)
assert(latest.generatedBy === "local_ai_pet_world_program", "latest owner action request was not generated locally")
assert(latest.externalEmployeeDecisionAuthority === false, "external employee gained decision authority")
const requestPath = path.resolve(ROOT, latest.runPath)
assert(requestPath.startsWith(`${ROOT}${path.sep}`), "latest owner action request escapes project root")
const latestRequest = readJson(requestPath)
validateStoredOwnerActionRequest(latestRequest, { root: ROOT })
assert(latestRequest.requestId === latest.requestId, "latest owner action request id mismatch")
assert(latestRequest.externalEmployeeBoundary?.decisionAuthority === false, "latest request grants decision authority to external employee")
assert(latestRequest.evidence.length > 0, "latest owner action request evidence is empty")

const slot149ResolutionPath = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  "owner-action-request-slot-149-owner-visual-review-resolution-20260730",
  "request.json",
)
assert(fs.existsSync(slot149ResolutionPath), "slot-149 owner review resolution is missing")
const request = readJson(slot149ResolutionPath)
validateStoredOwnerActionRequest(request, { root: ROOT })

assert(request.requestId === "owner-action-request-slot-149-owner-visual-review-resolution-20260730", "slot-149 owner review resolution id mismatch")
assert(request.status === "resolved_owner_authorized", "slot-149 owner review resolution status mismatch")
assert(request.ownerDecision?.commandRef === "owner-approved-v7-capacity-slot-149-complete-pass-20260730", "slot-149 owner command reference mismatch")
assert(request.resolution?.machineReviewPassed === true, "slot-149 machine review resolution is missing")
assert(request.resolution?.ownerReviewRecorded === true, "slot-149 owner review resolution is missing")
assert(request.resolution?.capacityContributionRegistered === true, "slot-149 capacity registration resolution is missing")
assert(request.resolution?.capacityContributionCheckPassed === true, "slot-149 capacity check resolution is missing")
assert(request.resolution?.newRgbCreatedAfterReview === false, "slot-149 resolution created a new RGB")
assert(request.resolution?.gpuTrainingStarted === false, "slot-149 resolution started GPU training")
assert(request.ownerFacingMessageZh.includes("当前合规RGB容量为4/64"), "slot-149 resolved capacity message is missing")
assert(request.ownerFacingMessageZh.includes("没有进入slot-150"), "slot-149 resolved stop boundary is missing")

const slot149WaitingPath = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  "owner-action-request-slot-149-owner-visual-review-20260730",
  "request.json",
)
assert(fs.existsSync(slot149WaitingPath), "slot-149 waiting owner review request is missing")
const slot149WaitingRequest = readJson(slot149WaitingPath)
validateStoredOwnerActionRequest(slot149WaitingRequest, { root: ROOT })
assert(slot149WaitingRequest.status === "waiting_owner_review", "slot-149 immutable waiting request was modified")
assert(slot149WaitingRequest.ownerFacingMessageZh.includes("145张全历史RGB构图比较无重复命中"), "slot-149 retained machine result is missing")

const slot148WaitingPath = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  "owner-action-request-slot-148-owner-visual-review-20260730",
  "request.json",
)
assert(fs.existsSync(slot148WaitingPath), "slot-148 waiting owner review request is missing")
const slot148WaitingRequest = readJson(slot148WaitingPath)
validateStoredOwnerActionRequest(slot148WaitingRequest, { root: ROOT })
assert(slot148WaitingRequest.status === "waiting_owner_review", "slot-148 immutable waiting request was modified")
assert(slot148WaitingRequest.ownerFacingMessageZh.includes("144张全历史RGB构图比较无重复命中"), "slot-148 retained machine result is missing")

const slot148ResolutionPath = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  "owner-action-request-slot-148-owner-visual-review-resolution-20260730",
  "request.json",
)
assert(fs.existsSync(slot148ResolutionPath), "slot-148 resolved owner review request is missing")
const slot148ResolutionRequest = readJson(slot148ResolutionPath)
validateStoredOwnerActionRequest(slot148ResolutionRequest, { root: ROOT })
assert(slot148ResolutionRequest.status === "resolved_owner_authorized", "slot-148 owner review resolution mismatch")
assert(slot148ResolutionRequest.resolution?.capacityContributionRegistered === true, "slot-148 capacity resolution is missing")

const slot147WaitingPath = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  "owner-action-request-slot-147-owner-visual-review-20260729",
  "request.json",
)
assert(fs.existsSync(slot147WaitingPath), "slot-147 waiting owner review request is missing")
const slot147WaitingRequest = readJson(slot147WaitingPath)
assert(slot147WaitingRequest.status === "waiting_owner_review", "slot-147 immutable waiting request was modified")
assert(slot147WaitingRequest.ownerFacingMessageZh.includes("143张全历史RGB构图比较无重复命中"), "slot-147 retained machine result is missing")

const slot147ResolutionPath = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  "owner-action-request-slot-147-owner-visual-review-resolution-20260730",
  "request.json",
)
assert(fs.existsSync(slot147ResolutionPath), "slot-147 resolved owner review request is missing")
const slot147ResolutionRequest = readJson(slot147ResolutionPath)
validateStoredOwnerActionRequest(slot147ResolutionRequest, { root: ROOT })
assert(slot147ResolutionRequest.status === "resolved_owner_authorized", "slot-147 owner review resolution mismatch")
assert(slot147ResolutionRequest.resolution?.capacityContributionRegistered === true, "slot-147 capacity resolution is missing")

const slot146Path = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  "owner-action-request-slot-146-water-false-positive-20260729",
  "request.json",
)
assert(fs.existsSync(slot146Path), "slot-146 resolved owner action request is missing")
const slot146Request = readJson(slot146Path)
validateStoredOwnerActionRequest(slot146Request, { root: ROOT })
assert(slot146Request.status === "resolved_owner_authorized", "slot-146 owner action request resolution mismatch")
assert(slot146Request.ownerFacingMessageZh.includes("正式程序暂时不能写入owner_approved"), "slot-146 owner-facing gate explanation is missing")
assert(slot146Request.resolution?.machineRereviewPassed === true, "slot-146 machine rereview resolution is missing")
assert(slot146Request.resolution?.capacityContributionRegistered === true, "slot-146 capacity resolution is missing")

const catalog = openStorageCatalog()
const artifact = catalog.prepare(`
  SELECT logical_path, run_id, sha256
  FROM artifacts
  WHERE logical_path = ?
`).get(latest.runPath)
assert(artifact?.run_id === latestRequest.requestId, "owner action request artifact is not indexed by request id")
const indexedEventCount = Number(catalog.prepare(`
  SELECT COUNT(*) AS count
  FROM program_events
  WHERE run_id = ? AND action = 'record_ai_painter_owner_action_request'
`).get(latestRequest.requestId)?.count ?? 0)
assert(indexedEventCount >= 2, "owner action request program events are not indexed")
closeStorageCatalog()

const documentPaths = [
  "AGENTS.md",
  "docs/BUSINESS_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/DOCUMENT_AUTHORITY_INDEX.md",
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
  "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
]
const combinedDocumentText = documentPaths
  .map((relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8"))
  .join("\n")
for (const requiredText of REQUIRED_DOCUMENT_TEXT) {
  assert(combinedDocumentText.includes(requiredText), `local governance documentation text is missing: ${requiredText}`)
}

console.log(JSON.stringify({
  ok: true,
  status: "ai_painter_local_system_governance_check_passed",
  contractId: contract.contractId,
  contractSha256,
  systemOfRecord: contract.systemOfRecord.authority,
  externalEmployeeCurrentRole: contract.externalEmployeeBoundary.currentRole,
  externalEmployeeTargetRole: contract.externalEmployeeBoundary.targetRole,
  ownerActionRequestId: latestRequest.requestId,
  ownerActionRequestStatus: latestRequest.status,
  evidenceCount: latestRequest.evidence.length,
  retainedSlot149WaitingRequestId: slot149WaitingRequest.requestId,
  retainedSlot148WaitingRequestId: slot148WaitingRequest.requestId,
  retainedWaitingRequestId: slot147WaitingRequest.requestId,
  retainedResolvedRequestIds: [
    slot146Request.requestId,
    slot147ResolutionRequest.requestId,
    slot148ResolutionRequest.requestId,
    request.requestId,
  ],
  sqliteArtifactIndexed: true,
  sqliteProgramEventCount: indexedEventCount,
}, null, 2))

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
