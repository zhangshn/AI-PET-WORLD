import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const LOCAL_GOVERNANCE_CONTRACT_PATH =
  "data/ai-painter/system-governance/local-ai-responsibility-contract-v1.json"

const ALLOWED_REQUEST_STATUSES = new Set([
  "waiting_owner_authorization",
  "waiting_owner_review",
  "owner_authorized_pending_execution",
  "resolved_owner_authorized",
  "resolved_owner_rejected",
  "cancelled_by_newer_authority",
])

export function readLocalGovernanceContract(root = process.cwd()) {
  const contractPath = path.resolve(root, LOCAL_GOVERNANCE_CONTRACT_PATH)
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"))
  validateLocalGovernanceContract(contract)
  return {
    contract,
    contractPath,
    contractSha256: sha256File(contractPath),
  }
}

export function validateLocalGovernanceContract(contract) {
  assert(contract?.schemaVersion === "ai-painter-local-system-responsibility-contract-v1", "local governance schema mismatch")
  assert(contract?.status === "active", "local governance contract is not active")
  assert(contract?.systemOfRecord?.authority === "local_ai_pet_world_program", "local program must remain the system of record")
  assert(contract?.systemOfRecord?.chatIsFormalEvidence === false, "chat must not be formal evidence")
  assert(contract?.systemOfRecord?.externalAgentMemoryIsFormalEvidence === false, "external agent memory must not be formal evidence")
  assert(contract?.ownerActionRequestContract?.mustBeStoredLocallyBeforeWaiting === true, "owner action requests must be stored locally")
  assert(contract?.ownerActionRequestContract?.mustEmitLocalProgramEvent === true, "owner action requests must emit local events")
  assert(contract?.ownerActionRequestContract?.mustBeIndexedInLocalSqlite === true, "owner action requests must be indexed locally")
  assert(contract?.externalEmployeeBoundary?.currentRole === "bounded_execution_and_verification_employee", "external employee current role mismatch")
  assert(contract?.externalEmployeeBoundary?.targetRole === "verification_employee_only", "external employee target role mismatch")
}

export function normalizeOwnerActionRequest(input, {
  root = process.cwd(),
  recordedAtUtc = new Date().toISOString(),
} = {}) {
  assert(input?.schemaVersion === "ai-painter-owner-action-request-input-v1", "owner action request input schema mismatch")
  assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(input.requestId ?? ""), "owner action request id is invalid")
  assert(ALLOWED_REQUEST_STATUSES.has(input.status), "owner action request status is invalid")
  for (const field of [
    "subsystem",
    "ownerVisibleConclusionZh",
    "localSystemFindingZh",
    "blockingReasonCode",
    "whyCannotProceedZh",
    "minimumRequestedActionZh",
    "ownerFacingMessageZh",
  ]) {
    assert(typeof input[field] === "string" && input[field].trim(), `owner action request field is missing: ${field}`)
  }
  for (const field of ["invariants", "forbiddenActions", "nextActionAfterAuthorization", "evidencePaths"]) {
    assert(Array.isArray(input[field]) && input[field].length > 0, `owner action request list is missing: ${field}`)
  }
  assert(input.taskIdentity && typeof input.taskIdentity === "object", "owner action request task identity is missing")

  const evidence = input.evidencePaths.map((relativePath) => {
    assert(typeof relativePath === "string" && relativePath.trim(), "owner action request evidence path is invalid")
    const absolutePath = resolveInsideRoot(root, relativePath)
    assert(fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(), `owner action request evidence is missing: ${relativePath}`)
    return {
      path: normalizePath(path.relative(root, absolutePath)),
      sha256: sha256File(absolutePath),
      byteSize: fs.statSync(absolutePath).size,
    }
  })

  const { contractSha256 } = readLocalGovernanceContract(root)
  return {
    schemaVersion: "ai-painter-owner-action-request-v1",
    requestId: input.requestId,
    subsystem: input.subsystem,
    status: input.status,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    generatedBy: "local_ai_pet_world_program",
    systemOfRecord: "local_immutable_files_plus_sqlite_index",
    governanceContractPath: LOCAL_GOVERNANCE_CONTRACT_PATH,
    governanceContractSha256: contractSha256,
    taskIdentity: input.taskIdentity,
    ownerVisibleConclusionZh: input.ownerVisibleConclusionZh.trim(),
    localSystemFindingZh: input.localSystemFindingZh.trim(),
    blockingReasonCode: input.blockingReasonCode.trim(),
    whyCannotProceedZh: input.whyCannotProceedZh.trim(),
    minimumRequestedActionZh: input.minimumRequestedActionZh.trim(),
    invariants: [...input.invariants],
    forbiddenActions: [...input.forbiddenActions],
    ownerFacingMessageZh: input.ownerFacingMessageZh.trim(),
    nextActionAfterAuthorization: [...input.nextActionAfterAuthorization],
    evidence,
    ownerDecision: input.ownerDecision ?? null,
    resolution: input.resolution ?? null,
    externalEmployeeBoundary: {
      role: "bounded_execution_and_verification_employee",
      decisionAuthority: false,
      systemOfRecord: false,
      longTermMemoryAuthority: false,
    },
  }
}

export function validateStoredOwnerActionRequest(record, { root = process.cwd() } = {}) {
  assert(record?.schemaVersion === "ai-painter-owner-action-request-v1", "stored owner action request schema mismatch")
  assert(record?.generatedBy === "local_ai_pet_world_program", "owner action request was not generated by the local system")
  assert(record?.systemOfRecord === "local_immutable_files_plus_sqlite_index", "owner action request local system-of-record mismatch")
  assert(ALLOWED_REQUEST_STATUSES.has(record?.status), "stored owner action request status is invalid")
  assert(record?.externalEmployeeBoundary?.decisionAuthority === false, "external employee gained decision authority")
  assert(record?.externalEmployeeBoundary?.systemOfRecord === false, "external employee gained system-of-record authority")
  assert(record?.evidence?.length > 0, "stored owner action request has no evidence")
  for (const evidence of record.evidence) {
    const absolutePath = resolveInsideRoot(root, evidence.path)
    assert(fs.existsSync(absolutePath), `stored owner action request evidence is missing: ${evidence.path}`)
    assert(sha256File(absolutePath) === evidence.sha256, `stored owner action request evidence hash mismatch: ${evidence.path}`)
  }
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

function resolveInsideRoot(root, value) {
  const resolvedRoot = path.resolve(root)
  const absolutePath = path.resolve(resolvedRoot, value)
  assert(absolutePath === resolvedRoot || absolutePath.startsWith(`${resolvedRoot}${path.sep}`), `path escapes project root: ${value}`)
  return absolutePath
}

function normalizePath(value) {
  return value.replaceAll("\\", "/")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
