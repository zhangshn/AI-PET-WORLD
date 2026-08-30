import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export const capabilityLifecycleStoreLogicalPath = ".runtime/ai-console/capabilities/capability-lifecycle-v1.sqlite"
const schemaVersion = "ai_console_capability_lifecycle_store_v1"
const registryIdentity = "ai_console_capability_lifecycle_registry"
const writerIdentity = "ai_console_capability_lifecycle_writer_v1"
const executorIdentity = "ai_console_capability_lifecycle_executor_v1"

export const aiConsoleCapabilityDomains = [
  "visual_world_generation",
  "text_and_language",
  "speech_and_audio",
  "video_generation",
  "multimodal_orchestration",
] as const

export const aiConsoleQualificationGates = [
  "cpu_contract",
  "readonly_gpu",
  "controlled_smoke",
  "formal_stage",
  "independent_regression",
  "machine_release_adjudication",
] as const

const commandTypes = [
  "register_capability_candidate",
  "record_capability_qualification",
  "register_qualified_capability_release",
] as const

const evidenceRequirements: Record<AiConsoleQualificationGateId, string> = {
  cpu_contract: "deterministic_cpu_contract_evidence",
  readonly_gpu: "readonly_gpu_qualification_evidence",
  controlled_smoke: "controlled_smoke_terminal_evidence",
  formal_stage: "formal_stage_terminal_evidence",
  independent_regression: "independent_regression_evidence",
  machine_release_adjudication: "atomic_machine_release_adjudication",
}

export type AiConsoleCapabilityDomain = (typeof aiConsoleCapabilityDomains)[number]
export type AiConsoleQualificationGateId = (typeof aiConsoleQualificationGates)[number]
export type AiConsoleCapabilityCommandType = (typeof commandTypes)[number]
export type AiConsoleCapabilityCandidateStatus = "registered" | "qualifying" | "qualified" | "qualification_failed" | "release_registered"

type CommandBase = {
  commandType: AiConsoleCapabilityCommandType
  expectedRegistryRevision: number
  idempotencyKeySha256: string
  reasonText: string
  actorIdentity: "local_console_operator"
  role: "operator"
  requestedAtUtc: string
}

export type AiConsoleCapabilityCommandInput =
  | (CommandBase & {
      commandType: "register_capability_candidate"
      capabilityDomain: AiConsoleCapabilityDomain
      parentCapabilityVersionId: string | null
      modelIdentity: string
      datasetReleaseIdentity: string
      trainingParadigm: string
    })
  | (CommandBase & {
      commandType: "record_capability_qualification"
      capabilityVersionId: string
      qualificationGateId: AiConsoleQualificationGateId
      qualificationStatus: "passed" | "failed"
      evidenceSha256: string
    })
  | (CommandBase & {
      commandType: "register_qualified_capability_release"
      capabilityVersionId: string
      conditionSchemaId: string
      previousReleaseIdentity: string | null
      rollbackReleaseIdentity: string | null
    })

export type AiConsoleCapabilityCandidateRecord = {
  schemaVersion: "ai_console_capability_candidate_v1"
  registryIdentity: typeof registryIdentity
  capabilityVersionId: string
  candidateSequence: number
  capabilityDomain: AiConsoleCapabilityDomain
  parentCapabilityVersionId: string | null
  modelIdentity: string
  datasetReleaseIdentity: string
  trainingParadigm: string
  qualificationStage: "not_started" | AiConsoleQualificationGateId
  candidateStatus: AiConsoleCapabilityCandidateStatus
  candidateRevision: number
  createdByCommandId: string
  lastCommandId: string
  creationContentSha256: string
  createdAtUtc: string
  updatedAtUtc: string
  integrityStatus: "verified"
  previousCandidateStateSha256: string | null
  candidateRecordSha256: string
}

export type AiConsoleCapabilityQualificationRecord = {
  schemaVersion: "ai_console_capability_qualification_v1"
  registryIdentity: typeof registryIdentity
  qualificationResultId: string
  qualificationSequence: number
  qualificationGateId: AiConsoleQualificationGateId
  capabilityVersionId: string
  gateOrder: number
  qualificationStatus: "passed" | "failed"
  evidenceRequirement: string
  evidenceSha256: string
  failureTerminal: "not_applicable" | "failure_closed"
  commandId: string
  candidateRecordSha256: string
  qualifiedAtUtc: string
  previousQualificationRecordSha256: string | null
  qualificationRecordSha256: string
}

export type AiConsoleCapabilityReleaseRecord = {
  schemaVersion: "ai_console_capability_release_v1"
  registryIdentity: typeof registryIdentity
  capabilityReleaseIdentity: string
  releaseSequence: number
  capabilityDomain: AiConsoleCapabilityDomain
  capabilityVersionId: string
  modelIdentity: string
  datasetReleaseIdentity: string
  conditionSchemaId: string
  qualificationSetSha256: string
  releaseStatus: "registered_inactive"
  previousReleaseIdentity: string | null
  rollbackReleaseIdentity: string | null
  commandId: string
  registeredAtUtc: string
  previousReleaseRecordSha256: string | null
  releaseRecordSha256: string
}

export type AiConsoleCapabilityMigrationAssessmentRecord = {
  schemaVersion: "ai_console_capability_migration_assessment_v1"
  registryIdentity: typeof registryIdentity
  migrationAssessmentId: string
  assessmentSequence: number
  capabilityDomain: AiConsoleCapabilityDomain
  currentMaturityLevel: "L0" | "L1" | "L2" | "L3" | "L4" | "L5"
  targetMaturityLevel: "L0" | "L1" | "L2" | "L3" | "L4" | "L5"
  externalDependency: string
  machineAcceptanceStatus: "passed" | "failed"
  rollbackIdentity: string
  assessedAtUtc: string
  assessmentRecordSha256: string
}

export type AiConsoleCapabilityLifecycleEventRecord = {
  schemaVersion: "ai_console_capability_lifecycle_event_v1"
  registryIdentity: typeof registryIdentity
  lifecycleEventId: string
  eventSequence: number
  commandId: string
  eventType: "candidate_registered" | "qualification_recorded" | "qualified_release_registered"
  subjectType: "candidate" | "qualification" | "release"
  subjectIdentity: string
  capabilityVersionId: string
  sourceCandidateRecordSha256: string | null
  targetCandidateRecordSha256: string
  detailRecordSha256: string
  occurredAtUtc: string
  previousEventRecordSha256: string | null
  eventRecordSha256: string
}

export type AiConsoleCapabilityCommandReceipt = {
  schemaVersion: "ai_console_capability_command_receipt_v1"
  registryIdentity: typeof registryIdentity
  commandId: string
  commandSequence: number
  commandType: AiConsoleCapabilityCommandType
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
    | "candidate_registered"
    | "candidate_already_registered"
    | "qualification_recorded"
    | "qualified_release_registered"
    | "registry_revision_conflict"
    | "parent_candidate_not_found"
    | "parent_candidate_domain_conflict"
    | "candidate_not_found"
    | "candidate_state_conflict"
    | "qualification_gate_order_conflict"
    | "qualification_already_recorded"
    | "release_already_registered"
    | "previous_release_not_found"
    | "rollback_release_not_found"
    | "release_lineage_domain_conflict"
  failureCode: string | null
  eventId: string | null
  requestedAtUtc: string
  finishedAtUtc: string
  executorIdentity: typeof executorIdentity
  previousCommandReceiptSha256: string | null
  commandReceiptSha256: string
}

export type AiConsoleCapabilityLifecycleMetadata = {
  schemaVersion: typeof schemaVersion
  registryIdentity: typeof registryIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof writerIdentity
  storeRevision: number
  registryRevision: number
  candidateCount: number
  qualificationCount: number
  releaseCount: number
  migrationAssessmentCount: number
  commandCount: number
  eventCount: number
  createdAtUtc: string
  updatedAtUtc: string
  headEventRecordSha256: string | null
  headCommandReceiptSha256: string | null
  metadataSha256: string
}

export type AiConsoleCapabilityCommandResult = {
  receipt: AiConsoleCapabilityCommandReceipt
  candidate: AiConsoleCapabilityCandidateRecord | null
  qualification: AiConsoleCapabilityQualificationRecord | null
  release: AiConsoleCapabilityReleaseRecord | null
  event: AiConsoleCapabilityLifecycleEventRecord | null
  replayed: boolean
  httpStatus: 200 | 201 | 409
}

export type AiConsoleCapabilityLifecycleRead =
  | {
      status: "connected"
      metadata: AiConsoleCapabilityLifecycleMetadata
      candidates: readonly AiConsoleCapabilityCandidateRecord[]
      qualifications: readonly AiConsoleCapabilityQualificationRecord[]
      releases: readonly AiConsoleCapabilityReleaseRecord[]
      migrationAssessments: readonly AiConsoleCapabilityMigrationAssessmentRecord[]
      events: readonly AiConsoleCapabilityLifecycleEventRecord[]
      receipts: readonly AiConsoleCapabilityCommandReceipt[]
      evidenceReferences: readonly string[]
    }
  | {
      status: "not_connected" | "unknown_or_stale"
      reasonCode: string
      evidenceReferences: readonly string[]
    }

export function isAiConsoleCapabilityLifecycleStoreInitialized(): boolean {
  return existsSync(getStorePath())
}

export function initializeAiConsoleCapabilityLifecycleStore(): AiConsoleCapabilityLifecycleMetadata {
  const database = openWritableStore()
  try { return readAndVerifyMetadata(database) } finally { database.close() }
}

export function executeAiConsoleCapabilityCommand(input: AiConsoleCapabilityCommandInput): AiConsoleCapabilityCommandResult {
  validateCommandInput(input)
  const normalized = normalizedCommandInput(input)
  const inputSha256 = sha256Text(JSON.stringify(normalized))
  const commandId = sha256Text(`${input.actorIdentity}\n${input.commandType}\n${input.idempotencyKeySha256}`)
  const database = openWritableStore()

  try {
    const existingReceiptRow = database.prepare("SELECT record_json FROM command_receipts WHERE command_id = ?").get(commandId)
    if (existingReceiptRow) {
      const receipt = parseRecord<AiConsoleCapabilityCommandReceipt>(existingReceiptRow, "record_json")
      verifyReceipt(receipt, receipt.commandSequence, receipt.previousCommandReceiptSha256)
      if (receipt.inputSha256 !== inputSha256) throw new Error("ai_console_capability_command_idempotency_conflict")
      return {
        receipt,
        candidate: receipt.targetIdentity ? readCandidateByIdentity(database, "capabilityVersionId" in input ? input.capabilityVersionId : receipt.targetIdentity) : null,
        qualification: receipt.eventId ? readQualificationByCommand(database, receipt.commandId) : null,
        release: receipt.eventId ? readReleaseByCommand(database, receipt.commandId) : null,
        event: receipt.eventId ? readEventByIdentity(database, receipt.eventId) : null,
        replayed: true,
        httpStatus: 200,
      }
    }

    const metadata = readAndVerifyMetadata(database)
    const finishedAtUtc = new Date().toISOString()
    let candidate: AiConsoleCapabilityCandidateRecord | null = null
    let qualification: AiConsoleCapabilityQualificationRecord | null = null
    let release: AiConsoleCapabilityReleaseRecord | null = null
    let event: AiConsoleCapabilityLifecycleEventRecord | null = null
    let candidateCreationBlob: Uint8Array | null = null
    let targetIdentity: string | null = null
    let resultingRegistryRevision = metadata.registryRevision
    let resultTerminalId: AiConsoleCapabilityCommandReceipt["resultTerminalId"]
    let failureCode: string | null = null

    if (input.expectedRegistryRevision !== metadata.registryRevision) {
      resultTerminalId = "registry_revision_conflict"
      failureCode = "ai_console_capability_registry_revision_conflict"
    } else if (input.commandType === "register_capability_candidate") {
      const parent = input.parentCapabilityVersionId ? readCandidateByIdentity(database, input.parentCapabilityVersionId) : null
      if (input.parentCapabilityVersionId && !parent) {
        resultTerminalId = "parent_candidate_not_found"
        failureCode = "ai_console_parent_capability_candidate_not_found"
      } else if (parent && parent.capabilityDomain !== input.capabilityDomain) {
        resultTerminalId = "parent_candidate_domain_conflict"
        failureCode = "ai_console_parent_capability_domain_conflict"
      } else {
        const creationPayload = {
          schemaVersion: "ai_console_capability_candidate_creation_v1",
          capabilityDomain: input.capabilityDomain,
          parentCapabilityVersionId: input.parentCapabilityVersionId,
          modelIdentity: input.modelIdentity,
          datasetReleaseIdentity: input.datasetReleaseIdentity,
          trainingParadigm: input.trainingParadigm,
        }
        const contentText = JSON.stringify(creationPayload)
        const contentSha256 = sha256Text(contentText)
        candidateCreationBlob = Buffer.from(contentText, "utf8")
        const capabilityVersionId = sha256Text(`ai_console_capability_candidate_v1\n${contentSha256}`)
        targetIdentity = capabilityVersionId
        const duplicateCandidate = readCandidateByIdentity(database, capabilityVersionId)
        if (duplicateCandidate) {
          candidate = duplicateCandidate
          resultTerminalId = "candidate_already_registered"
          failureCode = "ai_console_capability_candidate_already_registered"
        } else {
          candidate = createCandidateRecord({
            capabilityVersionId,
            candidateSequence: metadata.candidateCount + 1,
            capabilityDomain: input.capabilityDomain,
            parentCapabilityVersionId: input.parentCapabilityVersionId,
            modelIdentity: input.modelIdentity,
            datasetReleaseIdentity: input.datasetReleaseIdentity,
            trainingParadigm: input.trainingParadigm,
            commandId,
            creationContentSha256: contentSha256,
            occurredAtUtc: finishedAtUtc,
          })
          resultingRegistryRevision += 1
          event = createEvent({
            eventSequence: metadata.eventCount + 1,
            commandId,
            eventType: "candidate_registered",
            subjectType: "candidate",
            subjectIdentity: capabilityVersionId,
            candidate,
            sourceCandidateRecordSha256: null,
            detailRecordSha256: candidate.candidateRecordSha256,
            occurredAtUtc: finishedAtUtc,
            previousEventRecordSha256: metadata.headEventRecordSha256,
          })
          resultTerminalId = "candidate_registered"
        }
      }
    } else if (input.commandType === "record_capability_qualification") {
      targetIdentity = input.capabilityVersionId
      const existingCandidate = readCandidateByIdentity(database, input.capabilityVersionId)
      const existingQualifications = existingCandidate ? readQualificationsForCandidate(database, input.capabilityVersionId) : []
      const expectedGate = aiConsoleQualificationGates[existingQualifications.length]
      if (!existingCandidate) {
        resultTerminalId = "candidate_not_found"
        failureCode = "ai_console_capability_candidate_not_found"
      } else if (!["registered", "qualifying"].includes(existingCandidate.candidateStatus)) {
        candidate = existingCandidate
        resultTerminalId = "candidate_state_conflict"
        failureCode = "ai_console_capability_candidate_not_qualifiable"
      } else if (existingQualifications.some((record) => record.qualificationGateId === input.qualificationGateId)) {
        candidate = existingCandidate
        resultTerminalId = "qualification_already_recorded"
        failureCode = "ai_console_capability_qualification_already_recorded"
      } else if (expectedGate !== input.qualificationGateId || existingQualifications.some((record) => record.qualificationStatus !== "passed")) {
        candidate = existingCandidate
        resultTerminalId = "qualification_gate_order_conflict"
        failureCode = "ai_console_capability_qualification_gate_order_conflict"
      } else {
        const sourceCandidateRecordSha256 = existingCandidate.candidateRecordSha256
        candidate = updateCandidateRecord(existingCandidate, {
          commandId,
          qualificationStage: input.qualificationGateId,
          candidateStatus: input.qualificationStatus === "failed"
            ? "qualification_failed"
            : input.qualificationGateId === aiConsoleQualificationGates.at(-1) ? "qualified" : "qualifying",
          occurredAtUtc: finishedAtUtc,
        })
        qualification = createQualificationRecord({
          qualificationSequence: metadata.qualificationCount + 1,
          commandId,
          input,
          candidate,
          occurredAtUtc: finishedAtUtc,
          previousQualificationRecordSha256: readLastQualificationSha256(database),
        })
        targetIdentity = qualification.qualificationResultId
        resultingRegistryRevision += 1
        event = createEvent({
          eventSequence: metadata.eventCount + 1,
          commandId,
          eventType: "qualification_recorded",
          subjectType: "qualification",
          subjectIdentity: qualification.qualificationResultId,
          candidate,
          sourceCandidateRecordSha256,
          detailRecordSha256: qualification.qualificationRecordSha256,
          occurredAtUtc: finishedAtUtc,
          previousEventRecordSha256: metadata.headEventRecordSha256,
        })
        resultTerminalId = "qualification_recorded"
      }
    } else {
      targetIdentity = input.capabilityVersionId
      const existingCandidate = readCandidateByIdentity(database, input.capabilityVersionId)
      const qualifications = existingCandidate ? readQualificationsForCandidate(database, input.capabilityVersionId) : []
      const existingRelease = readReleaseByCandidate(database, input.capabilityVersionId)
      const previousRelease = input.previousReleaseIdentity ? readReleaseByIdentity(database, input.previousReleaseIdentity) : null
      const rollbackRelease = input.rollbackReleaseIdentity ? readReleaseByIdentity(database, input.rollbackReleaseIdentity) : null
      if (!existingCandidate) {
        resultTerminalId = "candidate_not_found"
        failureCode = "ai_console_capability_candidate_not_found"
      } else if (existingRelease) {
        candidate = existingCandidate
        release = existingRelease
        resultTerminalId = "release_already_registered"
        failureCode = "ai_console_capability_release_already_registered"
      } else if (existingCandidate.candidateStatus !== "qualified" || !qualificationSetIsComplete(qualifications)) {
        candidate = existingCandidate
        resultTerminalId = "candidate_state_conflict"
        failureCode = "ai_console_capability_candidate_not_qualified"
      } else if (input.previousReleaseIdentity && !previousRelease) {
        candidate = existingCandidate
        resultTerminalId = "previous_release_not_found"
        failureCode = "ai_console_previous_capability_release_not_found"
      } else if (input.rollbackReleaseIdentity && !rollbackRelease) {
        candidate = existingCandidate
        resultTerminalId = "rollback_release_not_found"
        failureCode = "ai_console_rollback_capability_release_not_found"
      } else if ([previousRelease, rollbackRelease].some((record) => record && record.capabilityDomain !== existingCandidate.capabilityDomain)) {
        candidate = existingCandidate
        resultTerminalId = "release_lineage_domain_conflict"
        failureCode = "ai_console_capability_release_lineage_domain_conflict"
      } else {
        const sourceCandidateRecordSha256 = existingCandidate.candidateRecordSha256
        candidate = updateCandidateRecord(existingCandidate, {
          commandId,
          qualificationStage: existingCandidate.qualificationStage,
          candidateStatus: "release_registered",
          occurredAtUtc: finishedAtUtc,
        })
        release = createReleaseRecord({
          releaseSequence: metadata.releaseCount + 1,
          commandId,
          input,
          candidate,
          qualifications,
          occurredAtUtc: finishedAtUtc,
          previousReleaseRecordSha256: readLastReleaseSha256(database),
        })
        targetIdentity = release.capabilityReleaseIdentity
        resultingRegistryRevision += 1
        event = createEvent({
          eventSequence: metadata.eventCount + 1,
          commandId,
          eventType: "qualified_release_registered",
          subjectType: "release",
          subjectIdentity: release.capabilityReleaseIdentity,
          candidate,
          sourceCandidateRecordSha256,
          detailRecordSha256: release.releaseRecordSha256,
          occurredAtUtc: finishedAtUtc,
          previousEventRecordSha256: metadata.headEventRecordSha256,
        })
        resultTerminalId = "qualified_release_registered"
      }
    }

    const succeeded = Boolean(event)
    const unsignedReceipt: Omit<AiConsoleCapabilityCommandReceipt, "commandReceiptSha256"> = {
      schemaVersion: "ai_console_capability_command_receipt_v1",
      registryIdentity,
      commandId,
      commandSequence: metadata.commandCount + 1,
      commandType: input.commandType,
      actorIdentity: "local_console_operator",
      role: "operator",
      targetIdentity,
      expectedRegistryRevision: input.expectedRegistryRevision,
      resultingRegistryRevision,
      idempotencyKeySha256: input.idempotencyKeySha256,
      inputSha256,
      reasonText: input.reasonText,
      validationStatus: succeeded ? "accepted" : "rejected",
      executionStatus: succeeded ? "succeeded" : "rejected",
      resultTerminalId,
      failureCode,
      eventId: event?.lifecycleEventId ?? null,
      requestedAtUtc: input.requestedAtUtc,
      finishedAtUtc,
      executorIdentity,
      previousCommandReceiptSha256: metadata.headCommandReceiptSha256,
    }
    const receipt: AiConsoleCapabilityCommandReceipt = { ...unsignedReceipt, commandReceiptSha256: sha256Record(unsignedReceipt) }

    database.exec("BEGIN IMMEDIATE")
    try {
      if (event && candidate) {
        if (input.commandType === "register_capability_candidate") insertCandidate(database, candidate, candidateCreationBlob as Uint8Array)
        else updateCandidate(database, candidate)
        if (qualification) insertQualification(database, qualification)
        if (release) insertRelease(database, release)
        insertEvent(database, event)
      }
      insertReceipt(database, receipt)
      updateMetadata(database, metadata, receipt, event, Boolean(input.commandType === "register_capability_candidate" && event), Boolean(qualification && event), Boolean(release && event))
      database.exec("COMMIT")
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }

    return { receipt, candidate, qualification, release, event, replayed: false, httpStatus: succeeded ? 201 : 409 }
  } finally {
    database.close()
  }
}

export function readAiConsoleCapabilityLifecycleStore(): AiConsoleCapabilityLifecycleRead {
  const storePath = getStorePath()
  if (!existsSync(storePath)) return { status: "not_connected", reasonCode: "ai_console_capability_lifecycle_store_not_initialized", evidenceReferences: [capabilityLifecycleStoreLogicalPath] }
  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(storePath, { open: true, readOnly: true })
    verifyDatabase(database)
    const metadata = readAndVerifyMetadata(database)
    const storedCandidates = database.prepare("SELECT record_json, creation_content_blob FROM candidates ORDER BY candidate_sequence ASC").all().map((row) => parseStoredCandidate(row))
    const candidates = storedCandidates.map((stored) => stored.record)
    const qualifications = database.prepare("SELECT record_json FROM qualification_results ORDER BY qualification_sequence ASC").all().map((row) => parseRecord<AiConsoleCapabilityQualificationRecord>(row, "record_json"))
    const releases = database.prepare("SELECT record_json FROM releases ORDER BY release_sequence ASC").all().map((row) => parseRecord<AiConsoleCapabilityReleaseRecord>(row, "record_json"))
    const migrationAssessments = database.prepare("SELECT record_json FROM migration_assessments ORDER BY assessment_sequence ASC").all().map((row) => parseRecord<AiConsoleCapabilityMigrationAssessmentRecord>(row, "record_json"))
    const events = database.prepare("SELECT record_json FROM lifecycle_events ORDER BY event_sequence ASC").all().map((row) => parseRecord<AiConsoleCapabilityLifecycleEventRecord>(row, "record_json"))
    const receipts = database.prepare("SELECT record_json FROM command_receipts ORDER BY command_sequence ASC").all().map((row) => parseRecord<AiConsoleCapabilityCommandReceipt>(row, "record_json"))
    verifyStoreRecords(metadata, candidates, qualifications, releases, migrationAssessments, events, receipts)
    storedCandidates.forEach(verifyCandidateCreationContent)
    return {
      status: "connected",
      metadata,
      candidates: [...candidates].reverse(),
      qualifications: [...qualifications].reverse(),
      releases: [...releases].reverse(),
      migrationAssessments: [...migrationAssessments].reverse(),
      events: [...events].reverse(),
      receipts: [...receipts].reverse(),
      evidenceReferences: [capabilityLifecycleStoreLogicalPath, "data/ai-console/schemas/ai-console-capability-lifecycle-v1.schema.json"],
    }
  } catch (error) {
    return { status: "unknown_or_stale", reasonCode: error instanceof Error ? error.message : "ai_console_capability_lifecycle_store_read_failed", evidenceReferences: [capabilityLifecycleStoreLogicalPath] }
  } finally { database?.close() }
}

function createCandidateRecord(input: {
  capabilityVersionId: string
  candidateSequence: number
  capabilityDomain: AiConsoleCapabilityDomain
  parentCapabilityVersionId: string | null
  modelIdentity: string
  datasetReleaseIdentity: string
  trainingParadigm: string
  commandId: string
  creationContentSha256: string
  occurredAtUtc: string
}): AiConsoleCapabilityCandidateRecord {
  const unsigned: Omit<AiConsoleCapabilityCandidateRecord, "candidateRecordSha256"> = {
    schemaVersion: "ai_console_capability_candidate_v1",
    registryIdentity,
    capabilityVersionId: input.capabilityVersionId,
    candidateSequence: input.candidateSequence,
    capabilityDomain: input.capabilityDomain,
    parentCapabilityVersionId: input.parentCapabilityVersionId,
    modelIdentity: input.modelIdentity,
    datasetReleaseIdentity: input.datasetReleaseIdentity,
    trainingParadigm: input.trainingParadigm,
    qualificationStage: "not_started",
    candidateStatus: "registered",
    candidateRevision: 1,
    createdByCommandId: input.commandId,
    lastCommandId: input.commandId,
    creationContentSha256: input.creationContentSha256,
    createdAtUtc: input.occurredAtUtc,
    updatedAtUtc: input.occurredAtUtc,
    integrityStatus: "verified",
    previousCandidateStateSha256: null,
  }
  return { ...unsigned, candidateRecordSha256: sha256Record(unsigned) }
}

function updateCandidateRecord(existing: AiConsoleCapabilityCandidateRecord, input: {
  commandId: string
  qualificationStage: AiConsoleCapabilityCandidateRecord["qualificationStage"]
  candidateStatus: AiConsoleCapabilityCandidateStatus
  occurredAtUtc: string
}): AiConsoleCapabilityCandidateRecord {
  const { candidateRecordSha256: previousCandidateStateSha256, ...unsignedExisting } = existing
  const unsigned: Omit<AiConsoleCapabilityCandidateRecord, "candidateRecordSha256"> = {
    ...unsignedExisting,
    qualificationStage: input.qualificationStage,
    candidateStatus: input.candidateStatus,
    candidateRevision: existing.candidateRevision + 1,
    lastCommandId: input.commandId,
    updatedAtUtc: input.occurredAtUtc,
    previousCandidateStateSha256,
  }
  return { ...unsigned, candidateRecordSha256: sha256Record(unsigned) }
}

function createQualificationRecord(input: {
  qualificationSequence: number
  commandId: string
  input: Extract<AiConsoleCapabilityCommandInput, { commandType: "record_capability_qualification" }>
  candidate: AiConsoleCapabilityCandidateRecord
  occurredAtUtc: string
  previousQualificationRecordSha256: string | null
}): AiConsoleCapabilityQualificationRecord {
  const gateOrder = aiConsoleQualificationGates.indexOf(input.input.qualificationGateId) + 1
  const qualificationResultId = sha256Text(`ai_console_capability_qualification_v1\n${input.commandId}`)
  const unsigned: Omit<AiConsoleCapabilityQualificationRecord, "qualificationRecordSha256"> = {
    schemaVersion: "ai_console_capability_qualification_v1",
    registryIdentity,
    qualificationResultId,
    qualificationSequence: input.qualificationSequence,
    qualificationGateId: input.input.qualificationGateId,
    capabilityVersionId: input.input.capabilityVersionId,
    gateOrder,
    qualificationStatus: input.input.qualificationStatus,
    evidenceRequirement: evidenceRequirements[input.input.qualificationGateId],
    evidenceSha256: input.input.evidenceSha256,
    failureTerminal: input.input.qualificationStatus === "failed" ? "failure_closed" : "not_applicable",
    commandId: input.commandId,
    candidateRecordSha256: input.candidate.candidateRecordSha256,
    qualifiedAtUtc: input.occurredAtUtc,
    previousQualificationRecordSha256: input.previousQualificationRecordSha256,
  }
  return { ...unsigned, qualificationRecordSha256: sha256Record(unsigned) }
}

function createReleaseRecord(input: {
  releaseSequence: number
  commandId: string
  input: Extract<AiConsoleCapabilityCommandInput, { commandType: "register_qualified_capability_release" }>
  candidate: AiConsoleCapabilityCandidateRecord
  qualifications: readonly AiConsoleCapabilityQualificationRecord[]
  occurredAtUtc: string
  previousReleaseRecordSha256: string | null
}): AiConsoleCapabilityReleaseRecord {
  const qualificationSetSha256 = sha256Record(input.qualifications.map((record) => ({ qualificationResultId: record.qualificationResultId, qualificationRecordSha256: record.qualificationRecordSha256 })))
  const capabilityReleaseIdentity = sha256Text(`ai_console_capability_release_v1\n${input.candidate.capabilityVersionId}\n${input.input.conditionSchemaId}\n${qualificationSetSha256}`)
  const unsigned: Omit<AiConsoleCapabilityReleaseRecord, "releaseRecordSha256"> = {
    schemaVersion: "ai_console_capability_release_v1",
    registryIdentity,
    capabilityReleaseIdentity,
    releaseSequence: input.releaseSequence,
    capabilityDomain: input.candidate.capabilityDomain,
    capabilityVersionId: input.candidate.capabilityVersionId,
    modelIdentity: input.candidate.modelIdentity,
    datasetReleaseIdentity: input.candidate.datasetReleaseIdentity,
    conditionSchemaId: input.input.conditionSchemaId,
    qualificationSetSha256,
    releaseStatus: "registered_inactive",
    previousReleaseIdentity: input.input.previousReleaseIdentity,
    rollbackReleaseIdentity: input.input.rollbackReleaseIdentity,
    commandId: input.commandId,
    registeredAtUtc: input.occurredAtUtc,
    previousReleaseRecordSha256: input.previousReleaseRecordSha256,
  }
  return { ...unsigned, releaseRecordSha256: sha256Record(unsigned) }
}

function createEvent(input: {
  eventSequence: number
  commandId: string
  eventType: AiConsoleCapabilityLifecycleEventRecord["eventType"]
  subjectType: AiConsoleCapabilityLifecycleEventRecord["subjectType"]
  subjectIdentity: string
  candidate: AiConsoleCapabilityCandidateRecord
  sourceCandidateRecordSha256: string | null
  detailRecordSha256: string
  occurredAtUtc: string
  previousEventRecordSha256: string | null
}): AiConsoleCapabilityLifecycleEventRecord {
  const lifecycleEventId = sha256Text(`ai_console_capability_lifecycle_event_v1\n${input.commandId}`)
  const unsigned: Omit<AiConsoleCapabilityLifecycleEventRecord, "eventRecordSha256"> = {
    schemaVersion: "ai_console_capability_lifecycle_event_v1",
    registryIdentity,
    lifecycleEventId,
    eventSequence: input.eventSequence,
    commandId: input.commandId,
    eventType: input.eventType,
    subjectType: input.subjectType,
    subjectIdentity: input.subjectIdentity,
    capabilityVersionId: input.candidate.capabilityVersionId,
    sourceCandidateRecordSha256: input.sourceCandidateRecordSha256,
    targetCandidateRecordSha256: input.candidate.candidateRecordSha256,
    detailRecordSha256: input.detailRecordSha256,
    occurredAtUtc: input.occurredAtUtc,
    previousEventRecordSha256: input.previousEventRecordSha256,
  }
  return { ...unsigned, eventRecordSha256: sha256Record(unsigned) }
}

function openWritableStore(): DatabaseSync {
  const storePath = getStorePath()
  mkdirSync(path.dirname(storePath), { recursive: true })
  const database = new DatabaseSync(storePath)
  database.exec("PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA user_version = 1;")
  database.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      singleton INTEGER PRIMARY KEY CHECK(singleton = 1), schema_version TEXT NOT NULL, registry_identity TEXT NOT NULL,
      source_boundary TEXT NOT NULL, writer_identity TEXT NOT NULL, store_revision INTEGER NOT NULL, registry_revision INTEGER NOT NULL,
      candidate_count INTEGER NOT NULL, qualification_count INTEGER NOT NULL, release_count INTEGER NOT NULL,
      migration_assessment_count INTEGER NOT NULL, command_count INTEGER NOT NULL, event_count INTEGER NOT NULL,
      created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL, head_event_record_sha256 TEXT,
      head_command_receipt_sha256 TEXT, metadata_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS candidates (
      capability_version_id TEXT PRIMARY KEY, candidate_sequence INTEGER NOT NULL UNIQUE, capability_domain TEXT NOT NULL,
      candidate_status TEXT NOT NULL, qualification_stage TEXT NOT NULL, record_json TEXT NOT NULL,
      creation_content_blob BLOB NOT NULL, candidate_record_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qualification_results (
      qualification_result_id TEXT PRIMARY KEY, qualification_sequence INTEGER NOT NULL UNIQUE, capability_version_id TEXT NOT NULL,
      qualification_gate_id TEXT NOT NULL, gate_order INTEGER NOT NULL, qualification_status TEXT NOT NULL,
      command_id TEXT NOT NULL UNIQUE, record_json TEXT NOT NULL, qualification_record_sha256 TEXT NOT NULL,
      UNIQUE(capability_version_id, qualification_gate_id)
    );
    CREATE TABLE IF NOT EXISTS releases (
      capability_release_identity TEXT PRIMARY KEY, release_sequence INTEGER NOT NULL UNIQUE, capability_domain TEXT NOT NULL,
      capability_version_id TEXT NOT NULL UNIQUE, release_status TEXT NOT NULL, command_id TEXT NOT NULL UNIQUE,
      record_json TEXT NOT NULL, release_record_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS migration_assessments (
      migration_assessment_id TEXT PRIMARY KEY, assessment_sequence INTEGER NOT NULL UNIQUE, capability_domain TEXT NOT NULL,
      record_json TEXT NOT NULL, assessment_record_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lifecycle_events (
      lifecycle_event_id TEXT PRIMARY KEY, event_sequence INTEGER NOT NULL UNIQUE, command_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL, subject_identity TEXT NOT NULL, record_json TEXT NOT NULL, event_record_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS command_receipts (
      command_id TEXT PRIMARY KEY, command_sequence INTEGER NOT NULL UNIQUE, command_type TEXT NOT NULL,
      execution_status TEXT NOT NULL, target_identity TEXT, record_json TEXT NOT NULL, command_receipt_sha256 TEXT NOT NULL
    );
  `)
  const row = database.prepare("SELECT COUNT(*) AS count FROM metadata").get() as { count: number }
  if (Number(row.count) === 0) insertInitialMetadata(database)
  return database
}

function insertInitialMetadata(database: DatabaseSync) {
  const now = new Date().toISOString()
  const unsigned: Omit<AiConsoleCapabilityLifecycleMetadata, "metadataSha256"> = {
    schemaVersion,
    registryIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    storeRevision: 0,
    registryRevision: 0,
    candidateCount: 0,
    qualificationCount: 0,
    releaseCount: 0,
    migrationAssessmentCount: 0,
    commandCount: 0,
    eventCount: 0,
    createdAtUtc: now,
    updatedAtUtc: now,
    headEventRecordSha256: null,
    headCommandReceiptSha256: null,
  }
  database.prepare(`INSERT INTO metadata VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    unsigned.schemaVersion, unsigned.registryIdentity, unsigned.sourceBoundary, unsigned.writerIdentity,
    unsigned.storeRevision, unsigned.registryRevision, unsigned.candidateCount, unsigned.qualificationCount,
    unsigned.releaseCount, unsigned.migrationAssessmentCount, unsigned.commandCount, unsigned.eventCount,
    unsigned.createdAtUtc, unsigned.updatedAtUtc, unsigned.headEventRecordSha256, unsigned.headCommandReceiptSha256,
    sha256Record(unsigned),
  )
}

function insertCandidate(database: DatabaseSync, candidate: AiConsoleCapabilityCandidateRecord, creationBlob: Uint8Array) {
  database.prepare("INSERT INTO candidates VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    candidate.capabilityVersionId, candidate.candidateSequence, candidate.capabilityDomain, candidate.candidateStatus,
    candidate.qualificationStage, JSON.stringify(candidate), creationBlob, candidate.candidateRecordSha256,
  )
}

function updateCandidate(database: DatabaseSync, candidate: AiConsoleCapabilityCandidateRecord) {
  const result = database.prepare("UPDATE candidates SET candidate_status = ?, qualification_stage = ?, record_json = ?, candidate_record_sha256 = ? WHERE capability_version_id = ?").run(
    candidate.candidateStatus, candidate.qualificationStage, JSON.stringify(candidate), candidate.candidateRecordSha256, candidate.capabilityVersionId,
  )
  if (Number(result.changes) !== 1) throw new Error("ai_console_capability_candidate_update_conflict")
}

function insertQualification(database: DatabaseSync, record: AiConsoleCapabilityQualificationRecord) {
  database.prepare("INSERT INTO qualification_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    record.qualificationResultId, record.qualificationSequence, record.capabilityVersionId, record.qualificationGateId,
    record.gateOrder, record.qualificationStatus, record.commandId, JSON.stringify(record), record.qualificationRecordSha256,
  )
}

function insertRelease(database: DatabaseSync, record: AiConsoleCapabilityReleaseRecord) {
  database.prepare("INSERT INTO releases VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    record.capabilityReleaseIdentity, record.releaseSequence, record.capabilityDomain, record.capabilityVersionId,
    record.releaseStatus, record.commandId, JSON.stringify(record), record.releaseRecordSha256,
  )
}

function insertEvent(database: DatabaseSync, record: AiConsoleCapabilityLifecycleEventRecord) {
  database.prepare("INSERT INTO lifecycle_events VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    record.lifecycleEventId, record.eventSequence, record.commandId, record.eventType, record.subjectIdentity,
    JSON.stringify(record), record.eventRecordSha256,
  )
}

function insertReceipt(database: DatabaseSync, record: AiConsoleCapabilityCommandReceipt) {
  database.prepare("INSERT INTO command_receipts VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    record.commandId, record.commandSequence, record.commandType, record.executionStatus, record.targetIdentity,
    JSON.stringify(record), record.commandReceiptSha256,
  )
}

function updateMetadata(
  database: DatabaseSync,
  metadata: AiConsoleCapabilityLifecycleMetadata,
  receipt: AiConsoleCapabilityCommandReceipt,
  event: AiConsoleCapabilityLifecycleEventRecord | null,
  candidateAdded: boolean,
  qualificationAdded: boolean,
  releaseAdded: boolean,
) {
  const { metadataSha256: _previousMetadataSha256, ...previousMetadata } = metadata
  void _previousMetadataSha256
  const unsigned: Omit<AiConsoleCapabilityLifecycleMetadata, "metadataSha256"> = {
    ...previousMetadata,
    storeRevision: metadata.storeRevision + 1,
    registryRevision: event ? metadata.registryRevision + 1 : metadata.registryRevision,
    candidateCount: metadata.candidateCount + (candidateAdded ? 1 : 0),
    qualificationCount: metadata.qualificationCount + (qualificationAdded ? 1 : 0),
    releaseCount: metadata.releaseCount + (releaseAdded ? 1 : 0),
    commandCount: metadata.commandCount + 1,
    eventCount: metadata.eventCount + (event ? 1 : 0),
    updatedAtUtc: receipt.finishedAtUtc,
    headEventRecordSha256: event?.eventRecordSha256 ?? metadata.headEventRecordSha256,
    headCommandReceiptSha256: receipt.commandReceiptSha256,
  }
  const result = database.prepare(`UPDATE metadata SET store_revision = ?, registry_revision = ?, candidate_count = ?,
    qualification_count = ?, release_count = ?, migration_assessment_count = ?, command_count = ?, event_count = ?,
    updated_at_utc = ?, head_event_record_sha256 = ?, head_command_receipt_sha256 = ?, metadata_sha256 = ?
    WHERE singleton = 1 AND store_revision = ?`).run(
    unsigned.storeRevision, unsigned.registryRevision, unsigned.candidateCount, unsigned.qualificationCount,
    unsigned.releaseCount, unsigned.migrationAssessmentCount, unsigned.commandCount, unsigned.eventCount,
    unsigned.updatedAtUtc, unsigned.headEventRecordSha256, unsigned.headCommandReceiptSha256, sha256Record(unsigned), metadata.storeRevision,
  )
  if (Number(result.changes) !== 1) throw new Error("ai_console_capability_registry_metadata_revision_conflict")
}

function readAndVerifyMetadata(database: DatabaseSync): AiConsoleCapabilityLifecycleMetadata {
  const rows = database.prepare("SELECT * FROM metadata").all()
  if (rows.length !== 1) throw new Error("ai_console_capability_registry_metadata_cardinality_invalid")
  const row = rows[0] as Record<string, unknown>
  const metadata: AiConsoleCapabilityLifecycleMetadata = {
    schemaVersion: String(row.schema_version) as typeof schemaVersion,
    registryIdentity: String(row.registry_identity) as typeof registryIdentity,
    sourceBoundary: String(row.source_boundary) as "new_ai_console_only",
    writerIdentity: String(row.writer_identity) as typeof writerIdentity,
    storeRevision: Number(row.store_revision),
    registryRevision: Number(row.registry_revision),
    candidateCount: Number(row.candidate_count),
    qualificationCount: Number(row.qualification_count),
    releaseCount: Number(row.release_count),
    migrationAssessmentCount: Number(row.migration_assessment_count),
    commandCount: Number(row.command_count),
    eventCount: Number(row.event_count),
    createdAtUtc: String(row.created_at_utc),
    updatedAtUtc: String(row.updated_at_utc),
    headEventRecordSha256: row.head_event_record_sha256 === null ? null : String(row.head_event_record_sha256),
    headCommandReceiptSha256: row.head_command_receipt_sha256 === null ? null : String(row.head_command_receipt_sha256),
    metadataSha256: String(row.metadata_sha256),
  }
  if (metadata.schemaVersion !== schemaVersion || metadata.registryIdentity !== registryIdentity || metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== writerIdentity) throw new Error("ai_console_capability_registry_metadata_identity_invalid")
  for (const value of [metadata.storeRevision, metadata.registryRevision, metadata.candidateCount, metadata.qualificationCount, metadata.releaseCount, metadata.migrationAssessmentCount, metadata.commandCount, metadata.eventCount]) if (!Number.isInteger(value) || value < 0) throw new Error("ai_console_capability_registry_metadata_count_invalid")
  if (metadata.storeRevision !== metadata.commandCount || metadata.registryRevision !== metadata.eventCount) throw new Error("ai_console_capability_registry_metadata_revision_relation_invalid")
  if (!isUtcTimestamp(metadata.createdAtUtc) || !isUtcTimestamp(metadata.updatedAtUtc)) throw new Error("ai_console_capability_registry_metadata_time_invalid")
  if (metadata.headEventRecordSha256 !== null && !isSha256(metadata.headEventRecordSha256)) throw new Error("ai_console_capability_registry_event_head_invalid")
  if (metadata.headCommandReceiptSha256 !== null && !isSha256(metadata.headCommandReceiptSha256)) throw new Error("ai_console_capability_registry_receipt_head_invalid")
  const { metadataSha256, ...unsigned } = metadata
  if (!isSha256(metadataSha256) || sha256Record(unsigned) !== metadataSha256) throw new Error("ai_console_capability_registry_metadata_sha256_mismatch")
  return metadata
}

function verifyStoreRecords(
  metadata: AiConsoleCapabilityLifecycleMetadata,
  candidates: readonly AiConsoleCapabilityCandidateRecord[],
  qualifications: readonly AiConsoleCapabilityQualificationRecord[],
  releases: readonly AiConsoleCapabilityReleaseRecord[],
  migrationAssessments: readonly AiConsoleCapabilityMigrationAssessmentRecord[],
  events: readonly AiConsoleCapabilityLifecycleEventRecord[],
  receipts: readonly AiConsoleCapabilityCommandReceipt[],
) {
  if (candidates.length !== metadata.candidateCount || qualifications.length !== metadata.qualificationCount || releases.length !== metadata.releaseCount || migrationAssessments.length !== metadata.migrationAssessmentCount || events.length !== metadata.eventCount || receipts.length !== metadata.commandCount) throw new Error("ai_console_capability_registry_record_count_mismatch")
  candidates.forEach((record, index) => verifyCandidate(record, index + 1))
  let previousQualification: string | null = null
  qualifications.forEach((record, index) => { verifyQualification(record, index + 1, previousQualification); previousQualification = record.qualificationRecordSha256 })
  let previousRelease: string | null = null
  releases.forEach((record, index) => { verifyRelease(record, index + 1, previousRelease); previousRelease = record.releaseRecordSha256 })
  migrationAssessments.forEach((record, index) => verifyMigrationAssessment(record, index + 1))
  let previousEvent: string | null = null
  events.forEach((record, index) => { verifyEvent(record, index + 1, previousEvent); previousEvent = record.eventRecordSha256 })
  let previousReceipt: string | null = null
  receipts.forEach((record, index) => { verifyReceipt(record, index + 1, previousReceipt); previousReceipt = record.commandReceiptSha256 })
  if (previousEvent !== metadata.headEventRecordSha256 || previousReceipt !== metadata.headCommandReceiptSha256) throw new Error("ai_console_capability_registry_chain_head_mismatch")
  for (const qualification of qualifications) if (!candidates.some((candidate) => candidate.capabilityVersionId === qualification.capabilityVersionId)) throw new Error("ai_console_capability_qualification_candidate_binding_invalid")
  for (const candidate of candidates) {
    const candidateQualifications = qualifications.filter((record) => record.capabilityVersionId === candidate.capabilityVersionId).sort((a, b) => a.gateOrder - b.gateOrder)
    const candidateRelease = releases.find((record) => record.capabilityVersionId === candidate.capabilityVersionId)
    const candidateEvents = events.filter((record) => record.capabilityVersionId === candidate.capabilityVersionId)
    if (candidateQualifications.some((record, index) => record.gateOrder !== index + 1 || record.qualificationGateId !== aiConsoleQualificationGates[index] || (index < candidateQualifications.length - 1 && record.qualificationStatus !== "passed"))) throw new Error("ai_console_capability_candidate_qualification_sequence_invalid")
    const lastQualification = candidateQualifications.at(-1)
    const expectedStatus: AiConsoleCapabilityCandidateStatus = candidateRelease
      ? "release_registered"
      : lastQualification?.qualificationStatus === "failed"
        ? "qualification_failed"
        : candidateQualifications.length === aiConsoleQualificationGates.length
          ? "qualified"
          : candidateQualifications.length > 0 ? "qualifying" : "registered"
    const expectedStage = lastQualification?.qualificationGateId ?? "not_started"
    if (candidate.candidateStatus !== expectedStatus || candidate.qualificationStage !== expectedStage || candidate.candidateRevision !== 1 + candidateQualifications.length + (candidateRelease ? 1 : 0)) throw new Error("ai_console_capability_candidate_current_state_invalid")
    if (candidateEvents.length !== candidate.candidateRevision || candidateEvents[0]?.eventType !== "candidate_registered" || candidateEvents[0]?.sourceCandidateRecordSha256 !== null) throw new Error("ai_console_capability_candidate_event_count_invalid")
    for (let index = 1; index < candidateEvents.length; index += 1) if (candidateEvents[index].sourceCandidateRecordSha256 !== candidateEvents[index - 1].targetCandidateRecordSha256) throw new Error("ai_console_capability_candidate_state_chain_invalid")
    if (candidateEvents.at(-1)?.targetCandidateRecordSha256 !== candidate.candidateRecordSha256) throw new Error("ai_console_capability_candidate_state_head_mismatch")
  }
  for (const release of releases) {
    const candidate = candidates.find((record) => record.capabilityVersionId === release.capabilityVersionId)
    const candidateQualifications = qualifications.filter((record) => record.capabilityVersionId === release.capabilityVersionId)
    if (!candidate || candidate.candidateStatus !== "release_registered" || !qualificationSetIsComplete(candidateQualifications)) throw new Error("ai_console_capability_release_candidate_binding_invalid")
  }
  for (const event of events) {
    const receipt = receipts.find((record) => record.commandId === event.commandId)
    if (!receipt || receipt.eventId !== event.lifecycleEventId || receipt.executionStatus !== "succeeded") throw new Error("ai_console_capability_event_receipt_binding_invalid")
  }
}

function verifyCandidate(record: AiConsoleCapabilityCandidateRecord, expectedSequence: number) {
  if (record.schemaVersion !== "ai_console_capability_candidate_v1" || record.registryIdentity !== registryIdentity || record.candidateSequence !== expectedSequence) throw new Error("ai_console_capability_candidate_identity_invalid")
  if (!isSha256(record.capabilityVersionId) || !isSha256(record.createdByCommandId) || !isSha256(record.lastCommandId) || !isSha256(record.creationContentSha256)) throw new Error("ai_console_capability_candidate_binding_invalid")
  if (!aiConsoleCapabilityDomains.includes(record.capabilityDomain) || !["registered", "qualifying", "qualified", "qualification_failed", "release_registered"].includes(record.candidateStatus)) throw new Error("ai_console_capability_candidate_enum_invalid")
  if (record.qualificationStage !== "not_started" && !aiConsoleQualificationGates.includes(record.qualificationStage)) throw new Error("ai_console_capability_candidate_stage_invalid")
  if (record.parentCapabilityVersionId !== null && !isSha256(record.parentCapabilityVersionId)) throw new Error("ai_console_capability_candidate_parent_invalid")
  for (const identity of [record.modelIdentity, record.datasetReleaseIdentity, record.trainingParadigm]) if (!isRegisteredIdentity(identity)) throw new Error("ai_console_capability_candidate_asset_identity_invalid")
  if (!Number.isInteger(record.candidateRevision) || record.candidateRevision < 1 || !isUtcTimestamp(record.createdAtUtc) || !isUtcTimestamp(record.updatedAtUtc) || record.integrityStatus !== "verified") throw new Error("ai_console_capability_candidate_value_invalid")
  if (record.previousCandidateStateSha256 !== null && !isSha256(record.previousCandidateStateSha256)) throw new Error("ai_console_capability_candidate_previous_invalid")
  const { candidateRecordSha256, ...unsigned } = record
  if (!isSha256(candidateRecordSha256) || sha256Record(unsigned) !== candidateRecordSha256) throw new Error("ai_console_capability_candidate_sha256_mismatch")
}

function verifyQualification(record: AiConsoleCapabilityQualificationRecord, expectedSequence: number, expectedPrevious: string | null) {
  if (record.schemaVersion !== "ai_console_capability_qualification_v1" || record.registryIdentity !== registryIdentity || record.qualificationSequence !== expectedSequence || record.previousQualificationRecordSha256 !== expectedPrevious) throw new Error("ai_console_capability_qualification_chain_invalid")
  if (!isSha256(record.qualificationResultId) || !isSha256(record.capabilityVersionId) || !isSha256(record.evidenceSha256) || !isSha256(record.commandId) || !isSha256(record.candidateRecordSha256)) throw new Error("ai_console_capability_qualification_binding_invalid")
  if (!aiConsoleQualificationGates.includes(record.qualificationGateId) || record.gateOrder !== aiConsoleQualificationGates.indexOf(record.qualificationGateId) + 1 || evidenceRequirements[record.qualificationGateId] !== record.evidenceRequirement) throw new Error("ai_console_capability_qualification_gate_invalid")
  if (!(["passed", "failed"] as const).includes(record.qualificationStatus) || record.failureTerminal !== (record.qualificationStatus === "failed" ? "failure_closed" : "not_applicable") || !isUtcTimestamp(record.qualifiedAtUtc)) throw new Error("ai_console_capability_qualification_status_invalid")
  const { qualificationRecordSha256, ...unsigned } = record
  if (!isSha256(qualificationRecordSha256) || sha256Record(unsigned) !== qualificationRecordSha256) throw new Error("ai_console_capability_qualification_sha256_mismatch")
}

function verifyRelease(record: AiConsoleCapabilityReleaseRecord, expectedSequence: number, expectedPrevious: string | null) {
  if (record.schemaVersion !== "ai_console_capability_release_v1" || record.registryIdentity !== registryIdentity || record.releaseSequence !== expectedSequence || record.previousReleaseRecordSha256 !== expectedPrevious) throw new Error("ai_console_capability_release_chain_invalid")
  if (![record.capabilityReleaseIdentity, record.capabilityVersionId, record.qualificationSetSha256, record.commandId].every(isSha256)) throw new Error("ai_console_capability_release_binding_invalid")
  if (!aiConsoleCapabilityDomains.includes(record.capabilityDomain) || record.releaseStatus !== "registered_inactive" || !isRegisteredIdentity(record.conditionSchemaId) || !isUtcTimestamp(record.registeredAtUtc)) throw new Error("ai_console_capability_release_value_invalid")
  if ([record.previousReleaseIdentity, record.rollbackReleaseIdentity].some((identity) => identity !== null && !isSha256(identity))) throw new Error("ai_console_capability_release_lineage_invalid")
  const { releaseRecordSha256, ...unsigned } = record
  if (!isSha256(releaseRecordSha256) || sha256Record(unsigned) !== releaseRecordSha256) throw new Error("ai_console_capability_release_sha256_mismatch")
}

function verifyMigrationAssessment(record: AiConsoleCapabilityMigrationAssessmentRecord, expectedSequence: number) {
  if (record.schemaVersion !== "ai_console_capability_migration_assessment_v1" || record.registryIdentity !== registryIdentity || record.assessmentSequence !== expectedSequence || !aiConsoleCapabilityDomains.includes(record.capabilityDomain)) throw new Error("ai_console_capability_migration_assessment_identity_invalid")
  const { assessmentRecordSha256, ...unsigned } = record
  if (!isSha256(record.migrationAssessmentId) || !isSha256(record.rollbackIdentity) || !isUtcTimestamp(record.assessedAtUtc) || !isSha256(assessmentRecordSha256) || sha256Record(unsigned) !== assessmentRecordSha256) throw new Error("ai_console_capability_migration_assessment_invalid")
}

function verifyEvent(record: AiConsoleCapabilityLifecycleEventRecord, expectedSequence: number, expectedPrevious: string | null) {
  if (record.schemaVersion !== "ai_console_capability_lifecycle_event_v1" || record.registryIdentity !== registryIdentity || record.eventSequence !== expectedSequence || record.previousEventRecordSha256 !== expectedPrevious) throw new Error("ai_console_capability_event_chain_invalid")
  if (![record.lifecycleEventId, record.commandId, record.subjectIdentity, record.capabilityVersionId, record.targetCandidateRecordSha256, record.detailRecordSha256].every(isSha256) || (record.sourceCandidateRecordSha256 !== null && !isSha256(record.sourceCandidateRecordSha256))) throw new Error("ai_console_capability_event_binding_invalid")
  if (!isUtcTimestamp(record.occurredAtUtc)) throw new Error("ai_console_capability_event_time_invalid")
  const { eventRecordSha256, ...unsigned } = record
  if (!isSha256(eventRecordSha256) || sha256Record(unsigned) !== eventRecordSha256) throw new Error("ai_console_capability_event_sha256_mismatch")
}

function verifyReceipt(record: AiConsoleCapabilityCommandReceipt, expectedSequence: number, expectedPrevious: string | null) {
  if (record.schemaVersion !== "ai_console_capability_command_receipt_v1" || record.registryIdentity !== registryIdentity || record.commandSequence !== expectedSequence || record.previousCommandReceiptSha256 !== expectedPrevious) throw new Error("ai_console_capability_receipt_chain_invalid")
  if (!commandTypes.includes(record.commandType) || record.actorIdentity !== "local_console_operator" || record.role !== "operator" || record.executorIdentity !== executorIdentity) throw new Error("ai_console_capability_receipt_identity_invalid")
  if (![record.commandId, record.idempotencyKeySha256, record.inputSha256].every(isSha256) || (record.targetIdentity !== null && !isSha256(record.targetIdentity))) throw new Error("ai_console_capability_receipt_binding_invalid")
  if (!Number.isInteger(record.expectedRegistryRevision) || !Number.isInteger(record.resultingRegistryRevision) || record.expectedRegistryRevision < 0 || record.resultingRegistryRevision < 0 || !isBoundedText(record.reasonText, 4, 240) || !isUtcTimestamp(record.requestedAtUtc) || !isUtcTimestamp(record.finishedAtUtc)) throw new Error("ai_console_capability_receipt_value_invalid")
  if (record.executionStatus === "succeeded") {
    if (record.validationStatus !== "accepted" || record.failureCode !== null || record.eventId === null || !isSha256(record.eventId)) throw new Error("ai_console_capability_receipt_success_invalid")
  } else if (record.validationStatus !== "rejected" || !record.failureCode || record.eventId !== null) throw new Error("ai_console_capability_receipt_rejection_invalid")
  const { commandReceiptSha256, ...unsigned } = record
  if (!isSha256(commandReceiptSha256) || sha256Record(unsigned) !== commandReceiptSha256) throw new Error("ai_console_capability_receipt_sha256_mismatch")
}

function verifyDatabase(database: DatabaseSync) {
  const integrity = database.prepare("PRAGMA integrity_check").get() as Record<string, unknown>
  if (!integrity || !Object.values(integrity).includes("ok")) throw new Error("ai_console_capability_registry_sqlite_integrity_failure")
  const version = database.prepare("PRAGMA user_version").get() as Record<string, unknown>
  if (!version || !Object.values(version).includes(1)) throw new Error("ai_console_capability_registry_sqlite_version_invalid")
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String((row as { name: unknown }).name))
  const expected = ["candidates", "command_receipts", "lifecycle_events", "metadata", "migration_assessments", "qualification_results", "releases"]
  if (JSON.stringify(tables) !== JSON.stringify(expected)) throw new Error("ai_console_capability_registry_table_set_invalid")
}

function normalizedCommandInput(input: AiConsoleCapabilityCommandInput): Record<string, unknown> {
  if (input.commandType === "register_capability_candidate") return { commandType: input.commandType, capabilityDomain: input.capabilityDomain, parentCapabilityVersionId: input.parentCapabilityVersionId, modelIdentity: input.modelIdentity, datasetReleaseIdentity: input.datasetReleaseIdentity, trainingParadigm: input.trainingParadigm, expectedRegistryRevision: input.expectedRegistryRevision, reasonText: input.reasonText }
  if (input.commandType === "record_capability_qualification") return { commandType: input.commandType, capabilityVersionId: input.capabilityVersionId, qualificationGateId: input.qualificationGateId, qualificationStatus: input.qualificationStatus, evidenceSha256: input.evidenceSha256, expectedRegistryRevision: input.expectedRegistryRevision, reasonText: input.reasonText }
  return { commandType: input.commandType, capabilityVersionId: input.capabilityVersionId, conditionSchemaId: input.conditionSchemaId, previousReleaseIdentity: input.previousReleaseIdentity, rollbackReleaseIdentity: input.rollbackReleaseIdentity, expectedRegistryRevision: input.expectedRegistryRevision, reasonText: input.reasonText }
}

function validateCommandInput(input: AiConsoleCapabilityCommandInput) {
  if (!isPlainRecord(input) || !commandTypes.includes(input.commandType)) throw new Error("ai_console_capability_command_input_invalid")
  const common = ["commandType", "expectedRegistryRevision", "idempotencyKeySha256", "reasonText", "actorIdentity", "role", "requestedAtUtc"]
  const specific = input.commandType === "register_capability_candidate"
    ? ["capabilityDomain", "parentCapabilityVersionId", "modelIdentity", "datasetReleaseIdentity", "trainingParadigm"]
    : input.commandType === "record_capability_qualification"
      ? ["capabilityVersionId", "qualificationGateId", "qualificationStatus", "evidenceSha256"]
      : ["capabilityVersionId", "conditionSchemaId", "previousReleaseIdentity", "rollbackReleaseIdentity"]
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify([...common, ...specific].sort())) throw new Error("ai_console_capability_command_field_set_invalid")
  if (!Number.isInteger(input.expectedRegistryRevision) || input.expectedRegistryRevision < 0) throw new Error("ai_console_capability_command_expected_revision_invalid")
  if (!isSha256(input.idempotencyKeySha256) || !isBoundedText(input.reasonText, 4, 240) || input.actorIdentity !== "local_console_operator" || input.role !== "operator" || !isUtcTimestamp(input.requestedAtUtc)) throw new Error("ai_console_capability_command_common_field_invalid")
  if (input.commandType === "register_capability_candidate") {
    if (!aiConsoleCapabilityDomains.includes(input.capabilityDomain) || (input.parentCapabilityVersionId !== null && !isSha256(input.parentCapabilityVersionId))) throw new Error("ai_console_capability_candidate_domain_or_parent_invalid")
    if (![input.modelIdentity, input.datasetReleaseIdentity, input.trainingParadigm].every(isRegisteredIdentity)) throw new Error("ai_console_capability_candidate_asset_invalid")
  } else if (input.commandType === "record_capability_qualification") {
    if (!isSha256(input.capabilityVersionId) || !aiConsoleQualificationGates.includes(input.qualificationGateId) || !(["passed", "failed"] as const).includes(input.qualificationStatus) || !isSha256(input.evidenceSha256)) throw new Error("ai_console_capability_qualification_input_invalid")
  } else if (!isSha256(input.capabilityVersionId) || !isRegisteredIdentity(input.conditionSchemaId) || [input.previousReleaseIdentity, input.rollbackReleaseIdentity].some((identity) => identity !== null && !isSha256(identity))) {
    throw new Error("ai_console_capability_release_input_invalid")
  }
}

function qualificationSetIsComplete(records: readonly AiConsoleCapabilityQualificationRecord[]): boolean {
  const ordered = [...records].sort((a, b) => a.gateOrder - b.gateOrder)
  return ordered.length === aiConsoleQualificationGates.length && ordered.every((record, index) => record.qualificationGateId === aiConsoleQualificationGates[index] && record.qualificationStatus === "passed")
}

function readCandidateByIdentity(database: DatabaseSync, identity: string): AiConsoleCapabilityCandidateRecord | null {
  const row = database.prepare("SELECT record_json FROM candidates WHERE capability_version_id = ?").get(identity)
  return row ? parseRecord<AiConsoleCapabilityCandidateRecord>(row, "record_json") : null
}

function readQualificationsForCandidate(database: DatabaseSync, identity: string): AiConsoleCapabilityQualificationRecord[] {
  return database.prepare("SELECT record_json FROM qualification_results WHERE capability_version_id = ? ORDER BY gate_order ASC").all(identity).map((row) => parseRecord<AiConsoleCapabilityQualificationRecord>(row, "record_json"))
}

function readReleaseByCandidate(database: DatabaseSync, identity: string): AiConsoleCapabilityReleaseRecord | null {
  const row = database.prepare("SELECT record_json FROM releases WHERE capability_version_id = ?").get(identity)
  return row ? parseRecord<AiConsoleCapabilityReleaseRecord>(row, "record_json") : null
}

function readReleaseByIdentity(database: DatabaseSync, identity: string): AiConsoleCapabilityReleaseRecord | null {
  const row = database.prepare("SELECT record_json FROM releases WHERE capability_release_identity = ?").get(identity)
  return row ? parseRecord<AiConsoleCapabilityReleaseRecord>(row, "record_json") : null
}

function readQualificationByCommand(database: DatabaseSync, commandId: string): AiConsoleCapabilityQualificationRecord | null {
  const row = database.prepare("SELECT record_json FROM qualification_results WHERE command_id = ?").get(commandId)
  return row ? parseRecord<AiConsoleCapabilityQualificationRecord>(row, "record_json") : null
}

function readReleaseByCommand(database: DatabaseSync, commandId: string): AiConsoleCapabilityReleaseRecord | null {
  const row = database.prepare("SELECT record_json FROM releases WHERE command_id = ?").get(commandId)
  return row ? parseRecord<AiConsoleCapabilityReleaseRecord>(row, "record_json") : null
}

function readEventByIdentity(database: DatabaseSync, identity: string): AiConsoleCapabilityLifecycleEventRecord | null {
  const row = database.prepare("SELECT record_json FROM lifecycle_events WHERE lifecycle_event_id = ?").get(identity)
  return row ? parseRecord<AiConsoleCapabilityLifecycleEventRecord>(row, "record_json") : null
}

function readLastQualificationSha256(database: DatabaseSync): string | null {
  const row = database.prepare("SELECT qualification_record_sha256 FROM qualification_results ORDER BY qualification_sequence DESC LIMIT 1").get() as Record<string, unknown> | undefined
  return row ? String(row.qualification_record_sha256) : null
}

function readLastReleaseSha256(database: DatabaseSync): string | null {
  const row = database.prepare("SELECT release_record_sha256 FROM releases ORDER BY release_sequence DESC LIMIT 1").get() as Record<string, unknown> | undefined
  return row ? String(row.release_record_sha256) : null
}

function parseRecord<T>(value: unknown, field: string): T {
  const row = value as Record<string, unknown>
  if (typeof row?.[field] !== "string") throw new Error("ai_console_capability_registry_record_json_invalid")
  const parsed = JSON.parse(row[field]) as T
  if (!isPlainRecord(parsed)) throw new Error("ai_console_capability_registry_record_shape_invalid")
  return parsed
}

function parseStoredCandidate(value: unknown): { record: AiConsoleCapabilityCandidateRecord; creationContentBlob: Uint8Array } {
  const row = value as Record<string, unknown>
  if (!(row?.creation_content_blob instanceof Uint8Array)) throw new Error("ai_console_capability_candidate_creation_blob_invalid")
  return { record: parseRecord<AiConsoleCapabilityCandidateRecord>(value, "record_json"), creationContentBlob: row.creation_content_blob }
}

function verifyCandidateCreationContent(stored: { record: AiConsoleCapabilityCandidateRecord; creationContentBlob: Uint8Array }) {
  const contentText = Buffer.from(stored.creationContentBlob).toString("utf8")
  if (sha256Text(contentText) !== stored.record.creationContentSha256 || stored.record.capabilityVersionId !== sha256Text(`ai_console_capability_candidate_v1\n${stored.record.creationContentSha256}`)) throw new Error("ai_console_capability_candidate_creation_content_invalid")
  const payload = JSON.parse(contentText) as Record<string, unknown>
  const expectedFields = ["schemaVersion", "capabilityDomain", "parentCapabilityVersionId", "modelIdentity", "datasetReleaseIdentity", "trainingParadigm"]
  if (!isPlainRecord(payload) || JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(expectedFields.sort())) throw new Error("ai_console_capability_candidate_creation_content_shape_invalid")
  if (payload.schemaVersion !== "ai_console_capability_candidate_creation_v1" || payload.capabilityDomain !== stored.record.capabilityDomain || payload.parentCapabilityVersionId !== stored.record.parentCapabilityVersionId || payload.modelIdentity !== stored.record.modelIdentity || payload.datasetReleaseIdentity !== stored.record.datasetReleaseIdentity || payload.trainingParadigm !== stored.record.trainingParadigm) throw new Error("ai_console_capability_candidate_creation_content_binding_invalid")
}

function getStorePath(): string { return path.join(process.cwd(), ...capabilityLifecycleStoreLogicalPath.split("/")) }
function sha256Text(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex") }
function sha256Record(value: unknown): string { return sha256Text(JSON.stringify(value)) }
function isSha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function isUtcTimestamp(value: unknown): value is string { return typeof value === "string" && value.endsWith("Z") && !Number.isNaN(Date.parse(value)) }
function isRegisteredIdentity(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value) }
function isBoundedText(value: unknown, minimum: number, maximum: number): value is string { return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value) }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
