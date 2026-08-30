import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export const reviewAdjudicationStoreLogicalPath = ".runtime/ai-console/reviews/review-adjudication-registry-v1.sqlite"
const schemaVersion = "ai_console_review_adjudication_store_v1"
const registryIdentity = "ai_console_review_adjudication_registry"
const writerIdentity = "ai_console_review_adjudication_writer_v1"
const executorIdentity = "ai_console_review_adjudication_executor_v1"

export const aiConsoleReviewCapabilityDomains = [
  "visual_world_generation", "text_and_language", "speech_and_audio", "video_generation", "multimodal_orchestration",
] as const
export const aiConsoleThresholdOperators = ["greater_or_equal", "less_or_equal"] as const
const commandTypes = ["register_review_contract", "register_machine_review_observation"] as const

export type AiConsoleReviewCapabilityDomain = (typeof aiConsoleReviewCapabilityDomains)[number]
export type AiConsoleThresholdOperator = (typeof aiConsoleThresholdOperators)[number]
export type AiConsoleReviewCommandType = (typeof commandTypes)[number]

type CommandBase = {
  commandType: AiConsoleReviewCommandType
  expectedRegistryRevision: number
  idempotencyKeySha256: string
  reasonText: string
  actorIdentity: "local_console_operator"
  role: "operator"
  requestedAtUtc: string
}

export type AiConsoleReviewCommandInput =
  | (CommandBase & {
      commandType: "register_review_contract"
      capabilityDomain: AiConsoleReviewCapabilityDomain
      reviewerIdentity: string
      reviewerVersion: string
      metricDefinitionId: string
      thresholdOperator: AiConsoleThresholdOperator
      thresholdValue: number
      thresholdUnit: string
      evidenceRequirementId: string
      failureCode: string
      previousReviewContractId: string | null
    })
  | (CommandBase & {
      commandType: "register_machine_review_observation"
      reviewContractId: string
      reviewRunId: string
      validationInputIdentity: string
      machineReviewerIdentity: string
      metricValue: number
      affectedScope: string
      evidenceTypeId: string
      evidenceSha256: string
    })

export type AiConsoleReviewContractRecord = {
  schemaVersion: "ai_console_review_contract_v1"
  registryIdentity: typeof registryIdentity
  reviewContractId: string
  contractSequence: number
  capabilityDomain: AiConsoleReviewCapabilityDomain
  reviewerIdentity: string
  reviewerVersion: string
  metricDefinitionId: string
  thresholdOperator: AiConsoleThresholdOperator
  thresholdValue: number
  thresholdUnit: string
  evidenceRequirementId: string
  failureCode: string
  previousReviewContractId: string | null
  contractStatus: "registered_frozen"
  commandId: string
  registeredAtUtc: string
  creationContentSha256: string
  reviewContractRecordSha256: string
}

export type AiConsoleMachineReviewResultRecord = {
  schemaVersion: "ai_console_machine_review_result_v1"
  registryIdentity: typeof registryIdentity
  reviewResultId: string
  resultSequence: number
  reviewRunId: string
  validationInputIdentity: string
  capabilityDomain: AiConsoleReviewCapabilityDomain
  reviewContractId: string
  reviewContractRecordSha256: string
  reviewNodeId: string
  reviewerIdentity: string
  metricDefinitionId: string
  metricValue: number
  thresholdOperator: AiConsoleThresholdOperator
  thresholdValue: number
  thresholdUnit: string
  reviewStatus: "passed" | "failed"
  failureCode: string | null
  affectedScope: string
  evidenceTypeId: string
  evidenceSha256: string
  resultTerminalStatus: "review_passed" | "review_failed_closed"
  commandId: string
  registeredAtUtc: string
  creationContentSha256: string
  reviewResultRecordSha256: string
}

export type AiConsoleReviewAdjudicationEventRecord = {
  schemaVersion: "ai_console_review_adjudication_event_v1"
  registryIdentity: typeof registryIdentity
  adjudicationEventId: string
  eventSequence: number
  commandId: string
  eventType: "review_contract_registered" | "machine_review_result_registered"
  subjectType: "review_contract" | "review_result"
  subjectIdentity: string
  capabilityDomain: AiConsoleReviewCapabilityDomain
  subjectRecordSha256: string
  occurredAtUtc: string
  previousEventRecordSha256: string | null
  eventRecordSha256: string
}

export type AiConsoleReviewCommandReceipt = {
  schemaVersion: "ai_console_review_command_receipt_v1"
  registryIdentity: typeof registryIdentity
  commandId: string
  commandSequence: number
  commandType: AiConsoleReviewCommandType
  actorIdentity: "local_console_operator"
  role: "operator"
  targetIdentity: string | null
  expectedRegistryRevision: number
  resultingRegistryRevision: number
  idempotencyKeySha256: string
  inputSha256: string
  reasonText: string
  validationStatus: "accepted" | "rejected"
  executionStatus: "succeeded" | "rejected"
  resultTerminalId:
    | "review_contract_registered"
    | "review_contract_already_registered"
    | "machine_review_result_registered"
    | "machine_review_result_already_registered"
    | "registry_revision_conflict"
    | "previous_review_contract_not_found"
    | "previous_review_contract_scope_conflict"
    | "review_contract_not_found"
    | "machine_reviewer_identity_conflict"
    | "review_run_contract_already_adjudicated"
  failureCode: string | null
  eventId: string | null
  requestedAtUtc: string
  finishedAtUtc: string
  executorIdentity: typeof executorIdentity
  previousCommandReceiptSha256: string | null
  commandReceiptSha256: string
}

export type AiConsoleReviewAdjudicationMetadata = {
  schemaVersion: typeof schemaVersion
  registryIdentity: typeof registryIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof writerIdentity
  storeRevision: number
  registryRevision: number
  reviewContractCount: number
  reviewResultCount: number
  commandCount: number
  eventCount: number
  createdAtUtc: string
  updatedAtUtc: string
  headEventRecordSha256: string | null
  headCommandReceiptSha256: string | null
  metadataSha256: string
}

export type AiConsoleReviewCommandResult = {
  receipt: AiConsoleReviewCommandReceipt
  reviewContract: AiConsoleReviewContractRecord | null
  reviewResult: AiConsoleMachineReviewResultRecord | null
  event: AiConsoleReviewAdjudicationEventRecord | null
  replayed: boolean
  httpStatus: 200 | 201 | 409
}

export type AiConsoleReviewAdjudicationRead =
  | { status: "connected"; metadata: AiConsoleReviewAdjudicationMetadata; reviewContracts: readonly AiConsoleReviewContractRecord[]; reviewResults: readonly AiConsoleMachineReviewResultRecord[]; events: readonly AiConsoleReviewAdjudicationEventRecord[]; receipts: readonly AiConsoleReviewCommandReceipt[]; evidenceReferences: readonly string[] }
  | { status: "not_connected" | "unknown_or_stale"; reasonCode: string; evidenceReferences: readonly string[] }

type StoredReviewContract = AiConsoleReviewContractRecord & { creationContentBlob: Uint8Array }
type StoredReviewResult = AiConsoleMachineReviewResultRecord & { creationContentBlob: Uint8Array }

export function initializeAiConsoleReviewAdjudicationStore(): AiConsoleReviewAdjudicationMetadata {
  const database = openWritableStore()
  try { return readAndVerifyMetadata(database) } finally { database.close() }
}

export function executeAiConsoleReviewCommand(input: AiConsoleReviewCommandInput): AiConsoleReviewCommandResult {
  validateCommandInput(input)
  const inputSha256 = sha256Text(JSON.stringify(normalizedCommandInput(input)))
  const commandId = sha256Text(`${input.actorIdentity}\n${input.commandType}\n${input.idempotencyKeySha256}`)
  const database = openWritableStore()
  try {
    const existingRow = database.prepare(`${receiptSelectSql} WHERE command_id = ?`).get(commandId)
    if (existingRow) {
      const receipt = receiptFromRow(existingRow)
      if (receipt.inputSha256 !== inputSha256) throw new Error("ai_console_review_command_idempotency_conflict")
      const event = receipt.eventId ? readEventById(database, receipt.eventId) : null
      const reviewContract = receipt.commandType === "register_review_contract" && receipt.targetIdentity ? readContractById(database, receipt.targetIdentity) : null
      const reviewResult = receipt.commandType === "register_machine_review_observation" && receipt.targetIdentity ? readResultById(database, receipt.targetIdentity) : null
      return { receipt, reviewContract, reviewResult, event, replayed: true, httpStatus: 200 }
    }

    const metadata = readAndVerifyMetadata(database)
    const finishedAtUtc = new Date().toISOString()
    let reviewContract: AiConsoleReviewContractRecord | null = null
    let reviewResult: AiConsoleMachineReviewResultRecord | null = null
    let event: AiConsoleReviewAdjudicationEventRecord | null = null
    let targetIdentity: string | null = null
    let resultTerminalId: AiConsoleReviewCommandReceipt["resultTerminalId"]
    let failureCode: string | null = null
    let resultingRegistryRevision = metadata.registryRevision
    let creationContentBlob: Uint8Array | null = null

    if (input.expectedRegistryRevision !== metadata.registryRevision) {
      resultTerminalId = "registry_revision_conflict"
      failureCode = "ai_console_review_registry_revision_conflict"
    } else if (input.commandType === "register_review_contract") {
      const previousContract = input.previousReviewContractId ? readContractById(database, input.previousReviewContractId) : null
      if (input.previousReviewContractId && !previousContract) {
        targetIdentity = input.previousReviewContractId
        resultTerminalId = "previous_review_contract_not_found"
        failureCode = "ai_console_previous_review_contract_not_found"
      } else if (previousContract && (previousContract.capabilityDomain !== input.capabilityDomain || previousContract.metricDefinitionId !== input.metricDefinitionId)) {
        targetIdentity = previousContract.reviewContractId
        reviewContract = previousContract
        resultTerminalId = "previous_review_contract_scope_conflict"
        failureCode = "ai_console_previous_review_contract_scope_conflict"
      } else {
        const content = contractCreationContent(input)
        const contentText = JSON.stringify(content)
        const creationContentSha256 = sha256Text(contentText)
        targetIdentity = sha256Text(`ai_console_review_contract_v1\n${creationContentSha256}`)
        const existingContract = readContractById(database, targetIdentity)
        if (existingContract) {
          reviewContract = existingContract
          resultTerminalId = "review_contract_already_registered"
          failureCode = "ai_console_review_contract_already_registered"
        } else {
          resultingRegistryRevision += 1
          creationContentBlob = Buffer.from(contentText, "utf8")
          reviewContract = createReviewContract({ ...content, reviewContractId: targetIdentity, contractSequence: metadata.reviewContractCount + 1, commandId, registeredAtUtc: finishedAtUtc, creationContentSha256 })
          event = createReviewEvent({ eventSequence: metadata.eventCount + 1, commandId, eventType: "review_contract_registered", subjectType: "review_contract", subjectIdentity: reviewContract.reviewContractId, capabilityDomain: reviewContract.capabilityDomain, subjectRecordSha256: reviewContract.reviewContractRecordSha256, occurredAtUtc: finishedAtUtc, previousEventRecordSha256: metadata.headEventRecordSha256 })
          resultTerminalId = "review_contract_registered"
        }
      }
    } else {
      const contract = readContractById(database, input.reviewContractId)
      if (!contract) {
        targetIdentity = input.reviewContractId
        resultTerminalId = "review_contract_not_found"
        failureCode = "ai_console_review_contract_not_found"
      } else if (contract.reviewerIdentity !== input.machineReviewerIdentity) {
        targetIdentity = contract.reviewContractId
        reviewContract = contract
        resultTerminalId = "machine_reviewer_identity_conflict"
        failureCode = "ai_console_machine_reviewer_identity_conflict"
      } else {
        const reviewStatus = adjudicateMetric(contract.thresholdOperator, input.metricValue, contract.thresholdValue)
        const content = resultCreationContent(input, contract, reviewStatus)
        const contentText = JSON.stringify(content)
        const creationContentSha256 = sha256Text(contentText)
        targetIdentity = sha256Text(`ai_console_machine_review_result_v1\n${creationContentSha256}`)
        const existingResult = readResultById(database, targetIdentity)
        const existingAdjudication = readResultByRunAndContract(database, input.reviewRunId, input.reviewContractId)
        if (existingResult) {
          reviewContract = contract
          reviewResult = existingResult
          resultTerminalId = "machine_review_result_already_registered"
          failureCode = "ai_console_machine_review_result_already_registered"
        } else if (existingAdjudication) {
          reviewContract = contract
          reviewResult = existingAdjudication
          targetIdentity = existingAdjudication.reviewResultId
          resultTerminalId = "review_run_contract_already_adjudicated"
          failureCode = "ai_console_review_run_contract_already_adjudicated"
        } else {
          resultingRegistryRevision += 1
          creationContentBlob = Buffer.from(contentText, "utf8")
          reviewContract = contract
          reviewResult = createReviewResult({ ...content, reviewResultId: targetIdentity, resultSequence: metadata.reviewResultCount + 1, commandId, registeredAtUtc: finishedAtUtc, creationContentSha256 })
          event = createReviewEvent({ eventSequence: metadata.eventCount + 1, commandId, eventType: "machine_review_result_registered", subjectType: "review_result", subjectIdentity: reviewResult.reviewResultId, capabilityDomain: reviewResult.capabilityDomain, subjectRecordSha256: reviewResult.reviewResultRecordSha256, occurredAtUtc: finishedAtUtc, previousEventRecordSha256: metadata.headEventRecordSha256 })
          resultTerminalId = "machine_review_result_registered"
        }
      }
    }

    const succeeded = event !== null
    const unsignedReceipt: Omit<AiConsoleReviewCommandReceipt, "commandReceiptSha256"> = {
      schemaVersion: "ai_console_review_command_receipt_v1", registryIdentity, commandId, commandSequence: metadata.commandCount + 1,
      commandType: input.commandType, actorIdentity: "local_console_operator", role: "operator", targetIdentity,
      expectedRegistryRevision: input.expectedRegistryRevision, resultingRegistryRevision, idempotencyKeySha256: input.idempotencyKeySha256,
      inputSha256, reasonText: input.reasonText, validationStatus: succeeded ? "accepted" : "rejected",
      executionStatus: succeeded ? "succeeded" : "rejected", resultTerminalId, failureCode,
      eventId: event?.adjudicationEventId ?? null, requestedAtUtc: input.requestedAtUtc, finishedAtUtc,
      executorIdentity, previousCommandReceiptSha256: metadata.headCommandReceiptSha256,
    }
    const receipt = { ...unsignedReceipt, commandReceiptSha256: sha256Text(JSON.stringify(unsignedReceipt)) }
    database.exec("BEGIN IMMEDIATE")
    try {
      if (event && input.commandType === "register_review_contract" && reviewContract) insertContract(database, reviewContract, creationContentBlob as Uint8Array)
      if (event && input.commandType === "register_machine_review_observation" && reviewResult) insertResult(database, reviewResult, creationContentBlob as Uint8Array)
      if (event) insertEvent(database, event)
      insertReceipt(database, receipt)
      updateMetadata(database, metadata, receipt, event, input.commandType)
      database.exec("COMMIT")
    } catch (error) { database.exec("ROLLBACK"); throw error }
    return { receipt, reviewContract, reviewResult, event, replayed: false, httpStatus: succeeded ? 201 : 409 }
  } finally { database.close() }
}

export function readAiConsoleReviewAdjudicationStore(): AiConsoleReviewAdjudicationRead {
  const storePath = getStorePath()
  if (!existsSync(storePath)) return { status: "not_connected", reasonCode: "ai_console_review_adjudication_store_not_initialized", evidenceReferences: [reviewAdjudicationStoreLogicalPath] }
  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(storePath, { open: true, readOnly: true })
    verifyDatabaseIntegrity(database); verifyDatabaseVersion(database); verifyDatabaseSchema(database)
    const metadata = readAndVerifyMetadata(database)
    const contracts = database.prepare(`${contractSelectSql} ORDER BY contract_sequence ASC`).all().map(contractFromRow)
    const results = database.prepare(`${resultSelectSql} ORDER BY result_sequence ASC`).all().map(resultFromRow)
    const events = database.prepare(`${eventSelectSql} ORDER BY event_sequence ASC`).all().map(eventFromRow)
    const receipts = database.prepare(`${receiptSelectSql} ORDER BY command_sequence ASC`).all().map(receiptFromRow)
    verifyStoreRecords(metadata, contracts, results, events, receipts)
    return { status: "connected", metadata, reviewContracts: contracts.map(stripContractBlob), reviewResults: results.map(stripResultBlob), events: [...events].reverse(), receipts: [...receipts].reverse(), evidenceReferences: [reviewAdjudicationStoreLogicalPath, "data/ai-console/schemas/ai-console-review-adjudication-v1.schema.json"] }
  } catch (error) {
    return { status: "unknown_or_stale", reasonCode: error instanceof Error ? error.message : "ai_console_review_adjudication_store_read_failed", evidenceReferences: [reviewAdjudicationStoreLogicalPath] }
  } finally { database?.close() }
}

function contractCreationContent(input: Extract<AiConsoleReviewCommandInput, { commandType: "register_review_contract" }>) {
  return { schemaVersion: "ai_console_review_contract_creation_v1", capabilityDomain: input.capabilityDomain, reviewerIdentity: input.reviewerIdentity, reviewerVersion: input.reviewerVersion, metricDefinitionId: input.metricDefinitionId, thresholdOperator: input.thresholdOperator, thresholdValue: input.thresholdValue, thresholdUnit: input.thresholdUnit, evidenceRequirementId: input.evidenceRequirementId, failureCode: input.failureCode, previousReviewContractId: input.previousReviewContractId } as const
}
function resultCreationContent(input: Extract<AiConsoleReviewCommandInput, { commandType: "register_machine_review_observation" }>, contract: AiConsoleReviewContractRecord, reviewStatus: "passed" | "failed") {
  return { schemaVersion: "ai_console_machine_review_result_creation_v1", reviewRunId: input.reviewRunId, validationInputIdentity: input.validationInputIdentity, capabilityDomain: contract.capabilityDomain, reviewContractId: contract.reviewContractId, reviewContractRecordSha256: contract.reviewContractRecordSha256, reviewNodeId: sha256Text(`ai_console_review_node_v1\n${input.reviewRunId}\n${contract.reviewContractId}`), reviewerIdentity: contract.reviewerIdentity, metricDefinitionId: contract.metricDefinitionId, metricValue: input.metricValue, thresholdOperator: contract.thresholdOperator, thresholdValue: contract.thresholdValue, thresholdUnit: contract.thresholdUnit, reviewStatus, failureCode: reviewStatus === "failed" ? contract.failureCode : null, affectedScope: input.affectedScope, evidenceTypeId: input.evidenceTypeId, evidenceSha256: input.evidenceSha256, resultTerminalStatus: reviewStatus === "passed" ? "review_passed" : "review_failed_closed" } as const
}
function createReviewContract(input: ReturnType<typeof contractCreationContent> & { reviewContractId: string; contractSequence: number; commandId: string; registeredAtUtc: string; creationContentSha256: string }): AiConsoleReviewContractRecord {
  const unsigned: Omit<AiConsoleReviewContractRecord, "reviewContractRecordSha256"> = { schemaVersion: "ai_console_review_contract_v1", registryIdentity, reviewContractId: input.reviewContractId, contractSequence: input.contractSequence, capabilityDomain: input.capabilityDomain, reviewerIdentity: input.reviewerIdentity, reviewerVersion: input.reviewerVersion, metricDefinitionId: input.metricDefinitionId, thresholdOperator: input.thresholdOperator, thresholdValue: input.thresholdValue, thresholdUnit: input.thresholdUnit, evidenceRequirementId: input.evidenceRequirementId, failureCode: input.failureCode, previousReviewContractId: input.previousReviewContractId, contractStatus: "registered_frozen", commandId: input.commandId, registeredAtUtc: input.registeredAtUtc, creationContentSha256: input.creationContentSha256 }
  return { ...unsigned, reviewContractRecordSha256: sha256Text(JSON.stringify(unsigned)) }
}
function createReviewResult(input: ReturnType<typeof resultCreationContent> & { reviewResultId: string; resultSequence: number; commandId: string; registeredAtUtc: string; creationContentSha256: string }): AiConsoleMachineReviewResultRecord {
  const unsigned: Omit<AiConsoleMachineReviewResultRecord, "reviewResultRecordSha256"> = { schemaVersion: "ai_console_machine_review_result_v1", registryIdentity, reviewResultId: input.reviewResultId, resultSequence: input.resultSequence, reviewRunId: input.reviewRunId, validationInputIdentity: input.validationInputIdentity, capabilityDomain: input.capabilityDomain, reviewContractId: input.reviewContractId, reviewContractRecordSha256: input.reviewContractRecordSha256, reviewNodeId: input.reviewNodeId, reviewerIdentity: input.reviewerIdentity, metricDefinitionId: input.metricDefinitionId, metricValue: input.metricValue, thresholdOperator: input.thresholdOperator, thresholdValue: input.thresholdValue, thresholdUnit: input.thresholdUnit, reviewStatus: input.reviewStatus, failureCode: input.failureCode, affectedScope: input.affectedScope, evidenceTypeId: input.evidenceTypeId, evidenceSha256: input.evidenceSha256, resultTerminalStatus: input.resultTerminalStatus, commandId: input.commandId, registeredAtUtc: input.registeredAtUtc, creationContentSha256: input.creationContentSha256 }
  return { ...unsigned, reviewResultRecordSha256: sha256Text(JSON.stringify(unsigned)) }
}
function createReviewEvent(input: Omit<AiConsoleReviewAdjudicationEventRecord, "schemaVersion" | "registryIdentity" | "adjudicationEventId" | "eventRecordSha256">): AiConsoleReviewAdjudicationEventRecord {
  const adjudicationEventId = sha256Text(`ai_console_review_adjudication_event_v1\n${input.commandId}`)
  const unsigned: Omit<AiConsoleReviewAdjudicationEventRecord, "eventRecordSha256"> = { schemaVersion: "ai_console_review_adjudication_event_v1", registryIdentity, adjudicationEventId, ...input }
  return { ...unsigned, eventRecordSha256: sha256Text(JSON.stringify(unsigned)) }
}
function adjudicateMetric(operator: AiConsoleThresholdOperator, metricValue: number, thresholdValue: number): "passed" | "failed" { return (operator === "greater_or_equal" ? metricValue >= thresholdValue : metricValue <= thresholdValue) ? "passed" : "failed" }
function normalizedCommandInput(input: AiConsoleReviewCommandInput): Record<string, unknown> { const { actorIdentity: _a, role: _r, requestedAtUtc: _t, idempotencyKeySha256: _k, ...rest } = input; void _a; void _r; void _t; void _k; return rest }

function validateCommandInput(input: AiConsoleReviewCommandInput) {
  if (!isPlainRecord(input) || !commandTypes.includes(input.commandType)) throw new Error("ai_console_review_command_input_invalid")
  const common = ["commandType", "expectedRegistryRevision", "idempotencyKeySha256", "reasonText", "actorIdentity", "role", "requestedAtUtc"]
  const specific = input.commandType === "register_review_contract" ? ["capabilityDomain", "reviewerIdentity", "reviewerVersion", "metricDefinitionId", "thresholdOperator", "thresholdValue", "thresholdUnit", "evidenceRequirementId", "failureCode", "previousReviewContractId"] : ["reviewContractId", "reviewRunId", "validationInputIdentity", "machineReviewerIdentity", "metricValue", "affectedScope", "evidenceTypeId", "evidenceSha256"]
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify([...common, ...specific].sort())) throw new Error("ai_console_review_command_field_set_invalid")
  if (!Number.isInteger(input.expectedRegistryRevision) || input.expectedRegistryRevision < 0 || !isSha256(input.idempotencyKeySha256) || !isBoundedText(input.reasonText, 4, 240) || input.actorIdentity !== "local_console_operator" || input.role !== "operator" || !isUtcTimestamp(input.requestedAtUtc)) throw new Error("ai_console_review_command_common_field_invalid")
  if (input.commandType === "register_review_contract") {
    if (!aiConsoleReviewCapabilityDomains.includes(input.capabilityDomain) || !isRegisteredIdentity(input.reviewerIdentity) || !isRegisteredIdentity(input.reviewerVersion) || !isRegisteredIdentity(input.metricDefinitionId) || !aiConsoleThresholdOperators.includes(input.thresholdOperator) || !isFiniteMetric(input.thresholdValue) || !isRegisteredIdentity(input.thresholdUnit) || !isRegisteredIdentity(input.evidenceRequirementId) || !isFailureCode(input.failureCode) || (input.previousReviewContractId !== null && !isSha256(input.previousReviewContractId))) throw new Error("ai_console_review_contract_input_invalid")
  } else if (!isSha256(input.reviewContractId) || !isRegisteredIdentity(input.reviewRunId) || !isRegisteredIdentity(input.validationInputIdentity) || !isRegisteredIdentity(input.machineReviewerIdentity) || !isFiniteMetric(input.metricValue) || !isRegisteredIdentity(input.affectedScope) || !isRegisteredIdentity(input.evidenceTypeId) || !isSha256(input.evidenceSha256)) throw new Error("ai_console_machine_review_observation_input_invalid")
}

function openWritableStore(): DatabaseSync {
  const storePath = getStorePath(); mkdirSync(path.dirname(storePath), { recursive: true }); const database = new DatabaseSync(storePath)
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;")
  database.exec(`
    CREATE TABLE IF NOT EXISTS metadata (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version TEXT NOT NULL, registry_identity TEXT NOT NULL, source_boundary TEXT NOT NULL, writer_identity TEXT NOT NULL, store_revision INTEGER NOT NULL CHECK (store_revision >= 0), registry_revision INTEGER NOT NULL CHECK (registry_revision >= 0), review_contract_count INTEGER NOT NULL CHECK (review_contract_count >= 0), review_result_count INTEGER NOT NULL CHECK (review_result_count >= 0), command_count INTEGER NOT NULL CHECK (command_count >= 0), event_count INTEGER NOT NULL CHECK (event_count >= 0), created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL, head_event_record_sha256 TEXT, head_command_receipt_sha256 TEXT, metadata_sha256 TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS review_contracts (review_contract_id TEXT PRIMARY KEY, contract_sequence INTEGER NOT NULL UNIQUE CHECK (contract_sequence >= 1), capability_domain TEXT NOT NULL, reviewer_identity TEXT NOT NULL, reviewer_version TEXT NOT NULL, metric_definition_id TEXT NOT NULL, threshold_operator TEXT NOT NULL, threshold_value REAL NOT NULL, threshold_unit TEXT NOT NULL, evidence_requirement_id TEXT NOT NULL, failure_code TEXT NOT NULL, previous_review_contract_id TEXT, contract_status TEXT NOT NULL, command_id TEXT NOT NULL UNIQUE, registered_at_utc TEXT NOT NULL, creation_content_sha256 TEXT NOT NULL, creation_content_blob BLOB NOT NULL, review_contract_record_sha256 TEXT NOT NULL, FOREIGN KEY (previous_review_contract_id) REFERENCES review_contracts(review_contract_id));
    CREATE TABLE IF NOT EXISTS review_results (review_result_id TEXT PRIMARY KEY, result_sequence INTEGER NOT NULL UNIQUE CHECK (result_sequence >= 1), review_run_id TEXT NOT NULL, validation_input_identity TEXT NOT NULL, capability_domain TEXT NOT NULL, review_contract_id TEXT NOT NULL, review_contract_record_sha256 TEXT NOT NULL, review_node_id TEXT NOT NULL, reviewer_identity TEXT NOT NULL, metric_definition_id TEXT NOT NULL, metric_value REAL NOT NULL, threshold_operator TEXT NOT NULL, threshold_value REAL NOT NULL, threshold_unit TEXT NOT NULL, review_status TEXT NOT NULL, failure_code TEXT, affected_scope TEXT NOT NULL, evidence_type_id TEXT NOT NULL, evidence_sha256 TEXT NOT NULL, result_terminal_status TEXT NOT NULL, command_id TEXT NOT NULL UNIQUE, registered_at_utc TEXT NOT NULL, creation_content_sha256 TEXT NOT NULL, creation_content_blob BLOB NOT NULL, review_result_record_sha256 TEXT NOT NULL, UNIQUE (review_run_id, review_contract_id), FOREIGN KEY (review_contract_id) REFERENCES review_contracts(review_contract_id));
    CREATE TABLE IF NOT EXISTS adjudication_events (adjudication_event_id TEXT PRIMARY KEY, event_sequence INTEGER NOT NULL UNIQUE CHECK (event_sequence >= 1), command_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, subject_type TEXT NOT NULL, subject_identity TEXT NOT NULL, capability_domain TEXT NOT NULL, subject_record_sha256 TEXT NOT NULL, occurred_at_utc TEXT NOT NULL, previous_event_record_sha256 TEXT, event_record_sha256 TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS command_receipts (command_id TEXT PRIMARY KEY, command_sequence INTEGER NOT NULL UNIQUE CHECK (command_sequence >= 1), command_type TEXT NOT NULL, actor_identity TEXT NOT NULL, role TEXT NOT NULL, target_identity TEXT, expected_registry_revision INTEGER NOT NULL, resulting_registry_revision INTEGER NOT NULL, idempotency_key_sha256 TEXT NOT NULL, input_sha256 TEXT NOT NULL, reason_text TEXT NOT NULL, validation_status TEXT NOT NULL, execution_status TEXT NOT NULL, result_terminal_id TEXT NOT NULL, failure_code TEXT, event_id TEXT, requested_at_utc TEXT NOT NULL, finished_at_utc TEXT NOT NULL, executor_identity TEXT NOT NULL, previous_command_receipt_sha256 TEXT, command_receipt_sha256 TEXT NOT NULL);
  `)
  verifyDatabaseSchema(database)
  const count = Number((database.prepare("SELECT COUNT(*) AS count FROM metadata").get() as { count: number }).count)
  if (count === 0) insertInitialMetadata(database)
  if (count > 1) throw new Error("ai_console_review_metadata_cardinality_invalid")
  database.exec("PRAGMA user_version = 1")
  return database
}
function insertInitialMetadata(database: DatabaseSync) {
  const createdAtUtc = new Date().toISOString()
  const unsigned: Omit<AiConsoleReviewAdjudicationMetadata, "metadataSha256"> = { schemaVersion, registryIdentity, sourceBoundary: "new_ai_console_only", writerIdentity, storeRevision: 0, registryRevision: 0, reviewContractCount: 0, reviewResultCount: 0, commandCount: 0, eventCount: 0, createdAtUtc, updatedAtUtc: createdAtUtc, headEventRecordSha256: null, headCommandReceiptSha256: null }
  const metadata = { ...unsigned, metadataSha256: sha256Text(JSON.stringify(unsigned)) }
  database.prepare("INSERT INTO metadata VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(metadata.schemaVersion, metadata.registryIdentity, metadata.sourceBoundary, metadata.writerIdentity, metadata.storeRevision, metadata.registryRevision, metadata.reviewContractCount, metadata.reviewResultCount, metadata.commandCount, metadata.eventCount, metadata.createdAtUtc, metadata.updatedAtUtc, metadata.headEventRecordSha256, metadata.headCommandReceiptSha256, metadata.metadataSha256)
}
function insertContract(database: DatabaseSync, r: AiConsoleReviewContractRecord, blob: Uint8Array) { database.prepare("INSERT INTO review_contracts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r.reviewContractId, r.contractSequence, r.capabilityDomain, r.reviewerIdentity, r.reviewerVersion, r.metricDefinitionId, r.thresholdOperator, r.thresholdValue, r.thresholdUnit, r.evidenceRequirementId, r.failureCode, r.previousReviewContractId, r.contractStatus, r.commandId, r.registeredAtUtc, r.creationContentSha256, blob, r.reviewContractRecordSha256) }
function insertResult(database: DatabaseSync, r: AiConsoleMachineReviewResultRecord, blob: Uint8Array) { database.prepare("INSERT INTO review_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r.reviewResultId, r.resultSequence, r.reviewRunId, r.validationInputIdentity, r.capabilityDomain, r.reviewContractId, r.reviewContractRecordSha256, r.reviewNodeId, r.reviewerIdentity, r.metricDefinitionId, r.metricValue, r.thresholdOperator, r.thresholdValue, r.thresholdUnit, r.reviewStatus, r.failureCode, r.affectedScope, r.evidenceTypeId, r.evidenceSha256, r.resultTerminalStatus, r.commandId, r.registeredAtUtc, r.creationContentSha256, blob, r.reviewResultRecordSha256) }
function insertEvent(database: DatabaseSync, e: AiConsoleReviewAdjudicationEventRecord) { database.prepare("INSERT INTO adjudication_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(e.adjudicationEventId, e.eventSequence, e.commandId, e.eventType, e.subjectType, e.subjectIdentity, e.capabilityDomain, e.subjectRecordSha256, e.occurredAtUtc, e.previousEventRecordSha256, e.eventRecordSha256) }
function insertReceipt(database: DatabaseSync, r: AiConsoleReviewCommandReceipt) { database.prepare("INSERT INTO command_receipts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r.commandId, r.commandSequence, r.commandType, r.actorIdentity, r.role, r.targetIdentity, r.expectedRegistryRevision, r.resultingRegistryRevision, r.idempotencyKeySha256, r.inputSha256, r.reasonText, r.validationStatus, r.executionStatus, r.resultTerminalId, r.failureCode, r.eventId, r.requestedAtUtc, r.finishedAtUtc, r.executorIdentity, r.previousCommandReceiptSha256, r.commandReceiptSha256) }
function updateMetadata(database: DatabaseSync, metadata: AiConsoleReviewAdjudicationMetadata, receipt: AiConsoleReviewCommandReceipt, event: AiConsoleReviewAdjudicationEventRecord | null, commandType: AiConsoleReviewCommandType) {
  const unsigned: Omit<AiConsoleReviewAdjudicationMetadata, "metadataSha256"> = { schemaVersion, registryIdentity, sourceBoundary: "new_ai_console_only", writerIdentity, storeRevision: metadata.storeRevision + 1, registryRevision: receipt.resultingRegistryRevision, reviewContractCount: metadata.reviewContractCount + (event && commandType === "register_review_contract" ? 1 : 0), reviewResultCount: metadata.reviewResultCount + (event && commandType === "register_machine_review_observation" ? 1 : 0), commandCount: metadata.commandCount + 1, eventCount: metadata.eventCount + (event ? 1 : 0), createdAtUtc: metadata.createdAtUtc, updatedAtUtc: receipt.finishedAtUtc, headEventRecordSha256: event?.eventRecordSha256 ?? metadata.headEventRecordSha256, headCommandReceiptSha256: receipt.commandReceiptSha256 }
  const metadataSha256 = sha256Text(JSON.stringify(unsigned))
  const result = database.prepare("UPDATE metadata SET store_revision = ?, registry_revision = ?, review_contract_count = ?, review_result_count = ?, command_count = ?, event_count = ?, updated_at_utc = ?, head_event_record_sha256 = ?, head_command_receipt_sha256 = ?, metadata_sha256 = ? WHERE singleton = 1 AND store_revision = ?").run(unsigned.storeRevision, unsigned.registryRevision, unsigned.reviewContractCount, unsigned.reviewResultCount, unsigned.commandCount, unsigned.eventCount, unsigned.updatedAtUtc, unsigned.headEventRecordSha256, unsigned.headCommandReceiptSha256, metadataSha256, metadata.storeRevision)
  if (Number(result.changes) !== 1) throw new Error("ai_console_review_metadata_revision_conflict")
}

function readAndVerifyMetadata(database: DatabaseSync): AiConsoleReviewAdjudicationMetadata {
  const rows = database.prepare("SELECT * FROM metadata").all(); if (rows.length !== 1) throw new Error("ai_console_review_metadata_cardinality_invalid"); const row = rows[0] as Record<string, unknown>
  const metadata: AiConsoleReviewAdjudicationMetadata = { schemaVersion: String(row.schema_version) as typeof schemaVersion, registryIdentity: String(row.registry_identity) as typeof registryIdentity, sourceBoundary: String(row.source_boundary) as "new_ai_console_only", writerIdentity: String(row.writer_identity) as typeof writerIdentity, storeRevision: Number(row.store_revision), registryRevision: Number(row.registry_revision), reviewContractCount: Number(row.review_contract_count), reviewResultCount: Number(row.review_result_count), commandCount: Number(row.command_count), eventCount: Number(row.event_count), createdAtUtc: String(row.created_at_utc), updatedAtUtc: String(row.updated_at_utc), headEventRecordSha256: row.head_event_record_sha256 === null ? null : String(row.head_event_record_sha256), headCommandReceiptSha256: row.head_command_receipt_sha256 === null ? null : String(row.head_command_receipt_sha256), metadataSha256: String(row.metadata_sha256) }
  if (metadata.schemaVersion !== schemaVersion || metadata.registryIdentity !== registryIdentity || metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== writerIdentity) throw new Error("ai_console_review_metadata_identity_invalid")
  for (const v of [metadata.storeRevision, metadata.registryRevision, metadata.reviewContractCount, metadata.reviewResultCount, metadata.commandCount, metadata.eventCount]) if (!Number.isInteger(v) || v < 0) throw new Error("ai_console_review_metadata_count_invalid")
  if (metadata.storeRevision !== metadata.commandCount || metadata.registryRevision !== metadata.eventCount || metadata.registryRevision !== metadata.reviewContractCount + metadata.reviewResultCount) throw new Error("ai_console_review_metadata_relation_invalid")
  if (!isUtcTimestamp(metadata.createdAtUtc) || !isUtcTimestamp(metadata.updatedAtUtc) || (metadata.headEventRecordSha256 !== null && !isSha256(metadata.headEventRecordSha256)) || (metadata.headCommandReceiptSha256 !== null && !isSha256(metadata.headCommandReceiptSha256))) throw new Error("ai_console_review_metadata_value_invalid")
  const { metadataSha256, ...unsigned } = metadata; if (!isSha256(metadataSha256) || sha256Text(JSON.stringify(unsigned)) !== metadataSha256) throw new Error("ai_console_review_metadata_sha256_mismatch")
  return metadata
}
function verifyStoreRecords(metadata: AiConsoleReviewAdjudicationMetadata, contracts: readonly StoredReviewContract[], results: readonly StoredReviewResult[], events: readonly AiConsoleReviewAdjudicationEventRecord[], receipts: readonly AiConsoleReviewCommandReceipt[]) {
  if (contracts.length !== metadata.reviewContractCount || results.length !== metadata.reviewResultCount || events.length !== metadata.eventCount || receipts.length !== metadata.commandCount) throw new Error("ai_console_review_record_count_mismatch")
  let previousReceipt: string | null = null; receipts.forEach((r, i) => { verifyReceipt(r, i + 1, previousReceipt); previousReceipt = r.commandReceiptSha256 }); if (previousReceipt !== metadata.headCommandReceiptSha256) throw new Error("ai_console_review_receipt_head_mismatch")
  let previousEvent: string | null = null; events.forEach((e, i) => { verifyEvent(e, i + 1, previousEvent); previousEvent = e.eventRecordSha256 }); if (previousEvent !== metadata.headEventRecordSha256) throw new Error("ai_console_review_event_head_mismatch")
  contracts.forEach((r, i) => verifyContract(r, i + 1, contracts)); results.forEach((r, i) => verifyResult(r, i + 1, contracts))
  for (const event of events) { const receipt = receipts.find((r) => r.commandId === event.commandId); if (!receipt || receipt.eventId !== event.adjudicationEventId || receipt.executionStatus !== "succeeded") throw new Error("ai_console_review_event_receipt_binding_invalid") }
}
function verifyContract(r: StoredReviewContract, sequence: number, contracts: readonly StoredReviewContract[]) {
  if (r.schemaVersion !== "ai_console_review_contract_v1" || r.registryIdentity !== registryIdentity || r.contractSequence !== sequence || r.contractStatus !== "registered_frozen") throw new Error("ai_console_review_contract_identity_invalid")
  if (!aiConsoleReviewCapabilityDomains.includes(r.capabilityDomain) || !isRegisteredIdentity(r.reviewerIdentity) || !isRegisteredIdentity(r.reviewerVersion) || !isRegisteredIdentity(r.metricDefinitionId) || !aiConsoleThresholdOperators.includes(r.thresholdOperator) || !isFiniteMetric(r.thresholdValue) || !isRegisteredIdentity(r.thresholdUnit) || !isRegisteredIdentity(r.evidenceRequirementId) || !isFailureCode(r.failureCode) || !isSha256(r.commandId) || !isUtcTimestamp(r.registeredAtUtc)) throw new Error("ai_console_review_contract_value_invalid")
  if (r.previousReviewContractId) { const previous = contracts.find((c) => c.reviewContractId === r.previousReviewContractId); if (!previous || previous.contractSequence >= r.contractSequence || previous.capabilityDomain !== r.capabilityDomain || previous.metricDefinitionId !== r.metricDefinitionId) throw new Error("ai_console_review_contract_lineage_invalid") }
  const text = Buffer.from(r.creationContentBlob).toString("utf8"); if (sha256Text(text) !== r.creationContentSha256 || r.reviewContractId !== sha256Text(`ai_console_review_contract_v1\n${r.creationContentSha256}`)) throw new Error("ai_console_review_contract_content_invalid")
  const { reviewContractRecordSha256, creationContentBlob: _b, ...unsigned } = r; void _b; if (!isSha256(reviewContractRecordSha256) || sha256Text(JSON.stringify(unsigned)) !== reviewContractRecordSha256) throw new Error("ai_console_review_contract_record_sha256_mismatch")
}
function verifyResult(r: StoredReviewResult, sequence: number, contracts: readonly StoredReviewContract[]) {
  const contract = contracts.find((c) => c.reviewContractId === r.reviewContractId)
  if (r.schemaVersion !== "ai_console_machine_review_result_v1" || r.registryIdentity !== registryIdentity || r.resultSequence !== sequence || !contract || contract.reviewContractRecordSha256 !== r.reviewContractRecordSha256 || contract.capabilityDomain !== r.capabilityDomain || contract.reviewerIdentity !== r.reviewerIdentity || contract.metricDefinitionId !== r.metricDefinitionId || contract.thresholdOperator !== r.thresholdOperator || contract.thresholdValue !== r.thresholdValue || contract.thresholdUnit !== r.thresholdUnit) throw new Error("ai_console_review_result_contract_binding_invalid")
  const expectedStatus = adjudicateMetric(r.thresholdOperator, r.metricValue, r.thresholdValue)
  if (r.reviewStatus !== expectedStatus || r.failureCode !== (expectedStatus === "failed" ? contract.failureCode : null) || r.resultTerminalStatus !== (expectedStatus === "passed" ? "review_passed" : "review_failed_closed")) throw new Error("ai_console_review_result_adjudication_invalid")
  if (!isRegisteredIdentity(r.reviewRunId) || !isRegisteredIdentity(r.validationInputIdentity) || r.reviewNodeId !== sha256Text(`ai_console_review_node_v1\n${r.reviewRunId}\n${r.reviewContractId}`) || !isFiniteMetric(r.metricValue) || !isRegisteredIdentity(r.affectedScope) || !isRegisteredIdentity(r.evidenceTypeId) || !isSha256(r.evidenceSha256) || !isSha256(r.commandId) || !isUtcTimestamp(r.registeredAtUtc)) throw new Error("ai_console_review_result_value_invalid")
  const text = Buffer.from(r.creationContentBlob).toString("utf8"); if (sha256Text(text) !== r.creationContentSha256 || r.reviewResultId !== sha256Text(`ai_console_machine_review_result_v1\n${r.creationContentSha256}`)) throw new Error("ai_console_review_result_content_invalid")
  const { reviewResultRecordSha256, creationContentBlob: _b, ...unsigned } = r; void _b; if (!isSha256(reviewResultRecordSha256) || sha256Text(JSON.stringify(unsigned)) !== reviewResultRecordSha256) throw new Error("ai_console_review_result_record_sha256_mismatch")
}
function verifyEvent(e: AiConsoleReviewAdjudicationEventRecord, sequence: number, previous: string | null) { if (e.schemaVersion !== "ai_console_review_adjudication_event_v1" || e.registryIdentity !== registryIdentity || e.eventSequence !== sequence || e.previousEventRecordSha256 !== previous || e.adjudicationEventId !== sha256Text(`ai_console_review_adjudication_event_v1\n${e.commandId}`) || !isSha256(e.commandId) || !isSha256(e.subjectIdentity) || !isSha256(e.subjectRecordSha256) || !aiConsoleReviewCapabilityDomains.includes(e.capabilityDomain) || !isUtcTimestamp(e.occurredAtUtc)) throw new Error("ai_console_review_event_chain_invalid"); const { eventRecordSha256, ...unsigned } = e; if (!isSha256(eventRecordSha256) || sha256Text(JSON.stringify(unsigned)) !== eventRecordSha256) throw new Error("ai_console_review_event_sha256_mismatch") }
function verifyReceipt(r: AiConsoleReviewCommandReceipt, sequence: number, previous: string | null) { if (r.schemaVersion !== "ai_console_review_command_receipt_v1" || r.registryIdentity !== registryIdentity || r.commandSequence !== sequence || r.previousCommandReceiptSha256 !== previous || !commandTypes.includes(r.commandType) || r.actorIdentity !== "local_console_operator" || r.role !== "operator" || r.executorIdentity !== executorIdentity || !isSha256(r.commandId) || !isSha256(r.idempotencyKeySha256) || !isSha256(r.inputSha256) || !Number.isInteger(r.expectedRegistryRevision) || !Number.isInteger(r.resultingRegistryRevision) || !isBoundedText(r.reasonText, 4, 240) || !isUtcTimestamp(r.requestedAtUtc) || !isUtcTimestamp(r.finishedAtUtc)) throw new Error("ai_console_review_receipt_identity_invalid"); if (r.executionStatus === "succeeded" ? r.validationStatus !== "accepted" || r.failureCode !== null || !isSha256(r.eventId) || !isSha256(r.targetIdentity) : r.validationStatus !== "rejected" || !r.failureCode || r.eventId !== null) throw new Error("ai_console_review_receipt_terminal_invalid"); const { commandReceiptSha256, ...unsigned } = r; if (!isSha256(commandReceiptSha256) || sha256Text(JSON.stringify(unsigned)) !== commandReceiptSha256) throw new Error("ai_console_review_receipt_sha256_mismatch") }

function contractFromRow(v: unknown): StoredReviewContract { const r = v as Record<string, unknown>; if (!(r.creation_content_blob instanceof Uint8Array)) throw new Error("ai_console_review_contract_blob_invalid"); return { schemaVersion: "ai_console_review_contract_v1", registryIdentity, reviewContractId: String(r.review_contract_id), contractSequence: Number(r.contract_sequence), capabilityDomain: String(r.capability_domain) as AiConsoleReviewCapabilityDomain, reviewerIdentity: String(r.reviewer_identity), reviewerVersion: String(r.reviewer_version), metricDefinitionId: String(r.metric_definition_id), thresholdOperator: String(r.threshold_operator) as AiConsoleThresholdOperator, thresholdValue: Number(r.threshold_value), thresholdUnit: String(r.threshold_unit), evidenceRequirementId: String(r.evidence_requirement_id), failureCode: String(r.failure_code), previousReviewContractId: r.previous_review_contract_id === null ? null : String(r.previous_review_contract_id), contractStatus: String(r.contract_status) as "registered_frozen", commandId: String(r.command_id), registeredAtUtc: String(r.registered_at_utc), creationContentSha256: String(r.creation_content_sha256), reviewContractRecordSha256: String(r.review_contract_record_sha256), creationContentBlob: r.creation_content_blob } }
function resultFromRow(v: unknown): StoredReviewResult { const r = v as Record<string, unknown>; if (!(r.creation_content_blob instanceof Uint8Array)) throw new Error("ai_console_review_result_blob_invalid"); return { schemaVersion: "ai_console_machine_review_result_v1", registryIdentity, reviewResultId: String(r.review_result_id), resultSequence: Number(r.result_sequence), reviewRunId: String(r.review_run_id), validationInputIdentity: String(r.validation_input_identity), capabilityDomain: String(r.capability_domain) as AiConsoleReviewCapabilityDomain, reviewContractId: String(r.review_contract_id), reviewContractRecordSha256: String(r.review_contract_record_sha256), reviewNodeId: String(r.review_node_id), reviewerIdentity: String(r.reviewer_identity), metricDefinitionId: String(r.metric_definition_id), metricValue: Number(r.metric_value), thresholdOperator: String(r.threshold_operator) as AiConsoleThresholdOperator, thresholdValue: Number(r.threshold_value), thresholdUnit: String(r.threshold_unit), reviewStatus: String(r.review_status) as "passed" | "failed", failureCode: r.failure_code === null ? null : String(r.failure_code), affectedScope: String(r.affected_scope), evidenceTypeId: String(r.evidence_type_id), evidenceSha256: String(r.evidence_sha256), resultTerminalStatus: String(r.result_terminal_status) as "review_passed" | "review_failed_closed", commandId: String(r.command_id), registeredAtUtc: String(r.registered_at_utc), creationContentSha256: String(r.creation_content_sha256), reviewResultRecordSha256: String(r.review_result_record_sha256), creationContentBlob: r.creation_content_blob } }
function eventFromRow(v: unknown): AiConsoleReviewAdjudicationEventRecord { const r = v as Record<string, unknown>; return { schemaVersion: "ai_console_review_adjudication_event_v1", registryIdentity, adjudicationEventId: String(r.adjudication_event_id), eventSequence: Number(r.event_sequence), commandId: String(r.command_id), eventType: String(r.event_type) as AiConsoleReviewAdjudicationEventRecord["eventType"], subjectType: String(r.subject_type) as AiConsoleReviewAdjudicationEventRecord["subjectType"], subjectIdentity: String(r.subject_identity), capabilityDomain: String(r.capability_domain) as AiConsoleReviewCapabilityDomain, subjectRecordSha256: String(r.subject_record_sha256), occurredAtUtc: String(r.occurred_at_utc), previousEventRecordSha256: r.previous_event_record_sha256 === null ? null : String(r.previous_event_record_sha256), eventRecordSha256: String(r.event_record_sha256) } }
function receiptFromRow(v: unknown): AiConsoleReviewCommandReceipt { const r = v as Record<string, unknown>; return { schemaVersion: "ai_console_review_command_receipt_v1", registryIdentity, commandId: String(r.command_id), commandSequence: Number(r.command_sequence), commandType: String(r.command_type) as AiConsoleReviewCommandType, actorIdentity: String(r.actor_identity) as "local_console_operator", role: String(r.role) as "operator", targetIdentity: r.target_identity === null ? null : String(r.target_identity), expectedRegistryRevision: Number(r.expected_registry_revision), resultingRegistryRevision: Number(r.resulting_registry_revision), idempotencyKeySha256: String(r.idempotency_key_sha256), inputSha256: String(r.input_sha256), reasonText: String(r.reason_text), validationStatus: String(r.validation_status) as "accepted" | "rejected", executionStatus: String(r.execution_status) as "succeeded" | "rejected", resultTerminalId: String(r.result_terminal_id) as AiConsoleReviewCommandReceipt["resultTerminalId"], failureCode: r.failure_code === null ? null : String(r.failure_code), eventId: r.event_id === null ? null : String(r.event_id), requestedAtUtc: String(r.requested_at_utc), finishedAtUtc: String(r.finished_at_utc), executorIdentity: String(r.executor_identity) as typeof executorIdentity, previousCommandReceiptSha256: r.previous_command_receipt_sha256 === null ? null : String(r.previous_command_receipt_sha256), commandReceiptSha256: String(r.command_receipt_sha256) } }
function readContractById(d: DatabaseSync, id: string): AiConsoleReviewContractRecord | null { const row = d.prepare(`${contractSelectSql} WHERE review_contract_id = ?`).get(id); return row ? stripContractBlob(contractFromRow(row)) : null }
function readResultById(d: DatabaseSync, id: string): AiConsoleMachineReviewResultRecord | null { const row = d.prepare(`${resultSelectSql} WHERE review_result_id = ?`).get(id); return row ? stripResultBlob(resultFromRow(row)) : null }
function readResultByRunAndContract(d: DatabaseSync, run: string, contract: string): AiConsoleMachineReviewResultRecord | null { const row = d.prepare(`${resultSelectSql} WHERE review_run_id = ? AND review_contract_id = ?`).get(run, contract); return row ? stripResultBlob(resultFromRow(row)) : null }
function readEventById(d: DatabaseSync, id: string): AiConsoleReviewAdjudicationEventRecord | null { const row = d.prepare(`${eventSelectSql} WHERE adjudication_event_id = ?`).get(id); return row ? eventFromRow(row) : null }
function stripContractBlob(r: StoredReviewContract): AiConsoleReviewContractRecord { const { creationContentBlob: _b, ...rest } = r; void _b; return rest }
function stripResultBlob(r: StoredReviewResult): AiConsoleMachineReviewResultRecord { const { creationContentBlob: _b, ...rest } = r; void _b; return rest }

function verifyDatabaseSchema(database: DatabaseSync) {
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => String((r as { name: unknown }).name)); if (JSON.stringify(tables) !== JSON.stringify(["adjudication_events", "command_receipts", "metadata", "review_contracts", "review_results"])) throw new Error("ai_console_review_table_set_invalid")
  verifyColumnSet(database, "metadata", ["singleton", "schema_version", "registry_identity", "source_boundary", "writer_identity", "store_revision", "registry_revision", "review_contract_count", "review_result_count", "command_count", "event_count", "created_at_utc", "updated_at_utc", "head_event_record_sha256", "head_command_receipt_sha256", "metadata_sha256"])
  verifyColumnSet(database, "review_contracts", ["review_contract_id", "contract_sequence", "capability_domain", "reviewer_identity", "reviewer_version", "metric_definition_id", "threshold_operator", "threshold_value", "threshold_unit", "evidence_requirement_id", "failure_code", "previous_review_contract_id", "contract_status", "command_id", "registered_at_utc", "creation_content_sha256", "creation_content_blob", "review_contract_record_sha256"])
  verifyColumnSet(database, "review_results", ["review_result_id", "result_sequence", "review_run_id", "validation_input_identity", "capability_domain", "review_contract_id", "review_contract_record_sha256", "review_node_id", "reviewer_identity", "metric_definition_id", "metric_value", "threshold_operator", "threshold_value", "threshold_unit", "review_status", "failure_code", "affected_scope", "evidence_type_id", "evidence_sha256", "result_terminal_status", "command_id", "registered_at_utc", "creation_content_sha256", "creation_content_blob", "review_result_record_sha256"])
  verifyColumnSet(database, "adjudication_events", ["adjudication_event_id", "event_sequence", "command_id", "event_type", "subject_type", "subject_identity", "capability_domain", "subject_record_sha256", "occurred_at_utc", "previous_event_record_sha256", "event_record_sha256"])
  verifyColumnSet(database, "command_receipts", ["command_id", "command_sequence", "command_type", "actor_identity", "role", "target_identity", "expected_registry_revision", "resulting_registry_revision", "idempotency_key_sha256", "input_sha256", "reason_text", "validation_status", "execution_status", "result_terminal_id", "failure_code", "event_id", "requested_at_utc", "finished_at_utc", "executor_identity", "previous_command_receipt_sha256", "command_receipt_sha256"])
}
function verifyColumnSet(d: DatabaseSync, t: string, expected: readonly string[]) { const cols = d.prepare(`PRAGMA table_info(${t})`).all().map((r) => String((r as { name: unknown }).name)); if (JSON.stringify(cols) !== JSON.stringify(expected)) throw new Error(`ai_console_review_column_set_invalid:${t}`) }
function verifyDatabaseIntegrity(d: DatabaseSync) { const r = d.prepare("PRAGMA integrity_check").get() as Record<string, unknown>; if (!r || !Object.values(r).includes("ok")) throw new Error("ai_console_review_sqlite_integrity_failure") }
function verifyDatabaseVersion(d: DatabaseSync) { const r = d.prepare("PRAGMA user_version").get() as Record<string, unknown>; if (!r || !Object.values(r).includes(1)) throw new Error("ai_console_review_sqlite_version_invalid") }
function getStorePath(): string { return path.join(process.cwd(), ...reviewAdjudicationStoreLogicalPath.split("/")) }
function sha256Text(v: string): string { return createHash("sha256").update(v, "utf8").digest("hex") }
function isSha256(v: unknown): v is string { return typeof v === "string" && /^[a-f0-9]{64}$/u.test(v) }
function isUtcTimestamp(v: unknown): v is string { return typeof v === "string" && v.endsWith("Z") && !Number.isNaN(Date.parse(v)) }
function isRegisteredIdentity(v: unknown): v is string { return typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(v) }
function isFailureCode(v: unknown): v is string { return typeof v === "string" && /^[a-z][a-z0-9_]{2,95}$/u.test(v) }
function isFiniteMetric(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v) && !Object.is(v, -0) && Math.abs(v) <= 1e12 }
function isBoundedText(v: unknown, min: number, max: number): v is string { return typeof v === "string" && v === v.trim() && v.length >= min && v.length <= max && !/[\u0000-\u001f\u007f]/u.test(v) }
function isPlainRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null && !Array.isArray(v) }

const contractSelectSql = `SELECT review_contract_id, contract_sequence, capability_domain, reviewer_identity, reviewer_version, metric_definition_id, threshold_operator, threshold_value, threshold_unit, evidence_requirement_id, failure_code, previous_review_contract_id, contract_status, command_id, registered_at_utc, creation_content_sha256, creation_content_blob, review_contract_record_sha256 FROM review_contracts`
const resultSelectSql = `SELECT review_result_id, result_sequence, review_run_id, validation_input_identity, capability_domain, review_contract_id, review_contract_record_sha256, review_node_id, reviewer_identity, metric_definition_id, metric_value, threshold_operator, threshold_value, threshold_unit, review_status, failure_code, affected_scope, evidence_type_id, evidence_sha256, result_terminal_status, command_id, registered_at_utc, creation_content_sha256, creation_content_blob, review_result_record_sha256 FROM review_results`
const eventSelectSql = `SELECT adjudication_event_id, event_sequence, command_id, event_type, subject_type, subject_identity, capability_domain, subject_record_sha256, occurred_at_utc, previous_event_record_sha256, event_record_sha256 FROM adjudication_events`
const receiptSelectSql = `SELECT command_id, command_sequence, command_type, actor_identity, role, target_identity, expected_registry_revision, resulting_registry_revision, idempotency_key_sha256, input_sha256, reason_text, validation_status, execution_status, result_terminal_id, failure_code, event_id, requested_at_utc, finished_at_utc, executor_identity, previous_command_receipt_sha256, command_receipt_sha256 FROM command_receipts`
