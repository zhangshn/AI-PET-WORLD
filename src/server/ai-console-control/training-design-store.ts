import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export const trainingDesignStoreLogicalPath = ".runtime/ai-console/training/training-design-registry-v1.sqlite"
const schemaVersion = "ai_console_training_design_store_v1"
const registryIdentity = "ai_console_training_design_registry"
const writerIdentity = "ai_console_training_design_writer_v1"
const executorIdentity = "ai_console_training_design_executor_v1"

export const aiConsoleTrainingCapabilityDomains = [
  "visual_world_generation",
  "text_and_language",
  "speech_and_audio",
  "video_generation",
  "multimodal_orchestration",
] as const

const commandTypes = ["register_model_structure", "register_training_plan"] as const

export type AiConsoleTrainingCapabilityDomain = (typeof aiConsoleTrainingCapabilityDomains)[number]
export type AiConsoleTrainingDesignCommandType = (typeof commandTypes)[number]

type CommandBase = {
  commandType: AiConsoleTrainingDesignCommandType
  expectedRegistryRevision: number
  idempotencyKeySha256: string
  reasonText: string
  actorIdentity: "local_console_operator"
  role: "operator"
  requestedAtUtc: string
}

export type AiConsoleTrainingDesignCommandInput =
  | (CommandBase & {
      commandType: "register_model_structure"
      capabilityDomain: AiConsoleTrainingCapabilityDomain
      modelFamily: string
      architectureDefinitionSha256: string
      sourceCodeSha256: string
      inputConditionSchemaId: string
      outputSchemaId: string
      parameterCount: number
    })
  | (CommandBase & {
      commandType: "register_training_plan"
      capabilityDomain: AiConsoleTrainingCapabilityDomain
      modelStructureId: string
      datasetReleaseIdentity: string
      splitIdentity: string
      randomSeed: number
      nativeResolution: string
      epochBudget: number
      parentTerminalRule: string
      optimizerConfigSha256: string
      resourceProfileIdentity: string
    })

export type AiConsoleModelStructureRecord = {
  schemaVersion: "ai_console_model_structure_v1"
  registryIdentity: typeof registryIdentity
  modelStructureId: string
  modelSequence: number
  capabilityDomain: AiConsoleTrainingCapabilityDomain
  modelFamily: string
  architectureDefinitionSha256: string
  sourceCodeSha256: string
  inputConditionSchemaId: string
  outputSchemaId: string
  parameterCount: number
  modelStructureStatus: "registered"
  commandId: string
  registeredAtUtc: string
  creationContentSha256: string
  modelStructureRecordSha256: string
}

export type AiConsoleTrainingPlanRecord = {
  schemaVersion: "ai_console_training_plan_v1"
  registryIdentity: typeof registryIdentity
  trainingPlanId: string
  planSequence: number
  capabilityDomain: AiConsoleTrainingCapabilityDomain
  modelStructureId: string
  modelStructureRecordSha256: string
  datasetReleaseIdentity: string
  splitIdentity: string
  randomSeed: number
  nativeResolution: string
  epochBudget: number
  parentTerminalRule: string
  optimizerConfigSha256: string
  resourceProfileIdentity: string
  planStatus: "registered_inactive"
  commandId: string
  registeredAtUtc: string
  creationContentSha256: string
  trainingPlanRecordSha256: string
}

export type AiConsoleTrainingDesignEventRecord = {
  schemaVersion: "ai_console_training_design_event_v1"
  registryIdentity: typeof registryIdentity
  designEventId: string
  eventSequence: number
  commandId: string
  eventType: "model_structure_registered" | "training_plan_registered"
  subjectType: "model_structure" | "training_plan"
  subjectIdentity: string
  capabilityDomain: AiConsoleTrainingCapabilityDomain
  subjectRecordSha256: string
  occurredAtUtc: string
  previousEventRecordSha256: string | null
  eventRecordSha256: string
}

export type AiConsoleTrainingDesignCommandReceipt = {
  schemaVersion: "ai_console_training_design_command_receipt_v1"
  registryIdentity: typeof registryIdentity
  commandId: string
  commandSequence: number
  commandType: AiConsoleTrainingDesignCommandType
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
    | "model_structure_registered"
    | "model_structure_already_registered"
    | "training_plan_registered"
    | "training_plan_already_registered"
    | "registry_revision_conflict"
    | "model_structure_not_found"
    | "model_structure_domain_conflict"
  failureCode: string | null
  eventId: string | null
  requestedAtUtc: string
  finishedAtUtc: string
  executorIdentity: typeof executorIdentity
  previousCommandReceiptSha256: string | null
  commandReceiptSha256: string
}

export type AiConsoleTrainingDesignMetadata = {
  schemaVersion: typeof schemaVersion
  registryIdentity: typeof registryIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof writerIdentity
  storeRevision: number
  registryRevision: number
  modelStructureCount: number
  trainingPlanCount: number
  commandCount: number
  eventCount: number
  createdAtUtc: string
  updatedAtUtc: string
  headEventRecordSha256: string | null
  headCommandReceiptSha256: string | null
  metadataSha256: string
}

export type AiConsoleTrainingDesignCommandResult = {
  receipt: AiConsoleTrainingDesignCommandReceipt
  modelStructure: AiConsoleModelStructureRecord | null
  trainingPlan: AiConsoleTrainingPlanRecord | null
  event: AiConsoleTrainingDesignEventRecord | null
  replayed: boolean
  httpStatus: 200 | 201 | 409
}

export type AiConsoleTrainingDesignRead =
  | {
      status: "connected"
      metadata: AiConsoleTrainingDesignMetadata
      modelStructures: readonly AiConsoleModelStructureRecord[]
      trainingPlans: readonly AiConsoleTrainingPlanRecord[]
      events: readonly AiConsoleTrainingDesignEventRecord[]
      receipts: readonly AiConsoleTrainingDesignCommandReceipt[]
      evidenceReferences: readonly string[]
    }
  | { status: "not_connected" | "unknown_or_stale"; reasonCode: string; evidenceReferences: readonly string[] }

type StoredModelStructure = AiConsoleModelStructureRecord & { creationContentBlob: Uint8Array }
type StoredTrainingPlan = AiConsoleTrainingPlanRecord & { creationContentBlob: Uint8Array }

export function isAiConsoleTrainingDesignStoreInitialized(): boolean {
  return existsSync(getStorePath())
}

export function initializeAiConsoleTrainingDesignStore(): AiConsoleTrainingDesignMetadata {
  const database = openWritableStore()
  try { return readAndVerifyMetadata(database) } finally { database.close() }
}

export function executeAiConsoleTrainingDesignCommand(input: AiConsoleTrainingDesignCommandInput): AiConsoleTrainingDesignCommandResult {
  validateCommandInput(input)
  const normalizedInput = normalizedCommandInput(input)
  const inputSha256 = sha256Text(JSON.stringify(normalizedInput))
  const commandId = sha256Text(`${input.actorIdentity}\n${input.commandType}\n${input.idempotencyKeySha256}`)
  const database = openWritableStore()

  try {
    const existingRow = database.prepare(`${receiptSelectSql} WHERE command_id = ?`).get(commandId)
    if (existingRow) {
      const receipt = receiptFromRow(existingRow)
      if (receipt.inputSha256 !== inputSha256) throw new Error("ai_console_training_design_command_idempotency_conflict")
      const event = receipt.eventId ? readEventById(database, receipt.eventId) : null
      const modelStructure = receipt.commandType === "register_model_structure" && receipt.targetIdentity ? readModelById(database, receipt.targetIdentity) : null
      const trainingPlan = receipt.commandType === "register_training_plan" && receipt.targetIdentity ? readPlanById(database, receipt.targetIdentity) : null
      return { receipt, modelStructure, trainingPlan, event, replayed: true, httpStatus: 200 }
    }

    const metadata = readAndVerifyMetadata(database)
    const finishedAtUtc = new Date().toISOString()
    let modelStructure: AiConsoleModelStructureRecord | null = null
    let trainingPlan: AiConsoleTrainingPlanRecord | null = null
    let event: AiConsoleTrainingDesignEventRecord | null = null
    let targetIdentity: string | null = null
    let resultTerminalId: AiConsoleTrainingDesignCommandReceipt["resultTerminalId"]
    let failureCode: string | null = null
    let resultingRegistryRevision = metadata.registryRevision
    let creationContentBlob: Uint8Array | null = null

    if (input.expectedRegistryRevision !== metadata.registryRevision) {
      resultTerminalId = "registry_revision_conflict"
      failureCode = "ai_console_training_design_registry_revision_conflict"
    } else if (input.commandType === "register_model_structure") {
      const content = modelCreationContent(input)
      const contentText = JSON.stringify(content)
      const creationContentSha256 = sha256Text(contentText)
      targetIdentity = sha256Text(`ai_console_model_structure_v1\n${creationContentSha256}`)
      const existingModel = readModelById(database, targetIdentity)
      if (existingModel) {
        modelStructure = existingModel
        resultTerminalId = "model_structure_already_registered"
        failureCode = "ai_console_model_structure_already_registered"
      } else {
        resultingRegistryRevision += 1
        creationContentBlob = Buffer.from(contentText, "utf8")
        modelStructure = createModelStructure({
          ...content,
          modelStructureId: targetIdentity,
          modelSequence: metadata.modelStructureCount + 1,
          commandId,
          registeredAtUtc: finishedAtUtc,
          creationContentSha256,
        })
        event = createDesignEvent({
          eventSequence: metadata.eventCount + 1,
          commandId,
          eventType: "model_structure_registered",
          subjectType: "model_structure",
          subjectIdentity: modelStructure.modelStructureId,
          capabilityDomain: modelStructure.capabilityDomain,
          subjectRecordSha256: modelStructure.modelStructureRecordSha256,
          occurredAtUtc: finishedAtUtc,
          previousEventRecordSha256: metadata.headEventRecordSha256,
        })
        resultTerminalId = "model_structure_registered"
      }
    } else {
      const parentModel = readModelById(database, input.modelStructureId)
      if (!parentModel) {
        targetIdentity = input.modelStructureId
        resultTerminalId = "model_structure_not_found"
        failureCode = "ai_console_training_plan_model_structure_not_found"
      } else if (parentModel.capabilityDomain !== input.capabilityDomain) {
        targetIdentity = input.modelStructureId
        modelStructure = parentModel
        resultTerminalId = "model_structure_domain_conflict"
        failureCode = "ai_console_training_plan_model_domain_conflict"
      } else {
        const content = planCreationContent(input, parentModel.modelStructureRecordSha256)
        const contentText = JSON.stringify(content)
        const creationContentSha256 = sha256Text(contentText)
        targetIdentity = sha256Text(`ai_console_training_plan_v1\n${creationContentSha256}`)
        const existingPlan = readPlanById(database, targetIdentity)
        if (existingPlan) {
          modelStructure = parentModel
          trainingPlan = existingPlan
          resultTerminalId = "training_plan_already_registered"
          failureCode = "ai_console_training_plan_already_registered"
        } else {
          resultingRegistryRevision += 1
          creationContentBlob = Buffer.from(contentText, "utf8")
          modelStructure = parentModel
          trainingPlan = createTrainingPlan({
            ...content,
            trainingPlanId: targetIdentity,
            planSequence: metadata.trainingPlanCount + 1,
            commandId,
            registeredAtUtc: finishedAtUtc,
            creationContentSha256,
          })
          event = createDesignEvent({
            eventSequence: metadata.eventCount + 1,
            commandId,
            eventType: "training_plan_registered",
            subjectType: "training_plan",
            subjectIdentity: trainingPlan.trainingPlanId,
            capabilityDomain: trainingPlan.capabilityDomain,
            subjectRecordSha256: trainingPlan.trainingPlanRecordSha256,
            occurredAtUtc: finishedAtUtc,
            previousEventRecordSha256: metadata.headEventRecordSha256,
          })
          resultTerminalId = "training_plan_registered"
        }
      }
    }

    const succeeded = event !== null
    const unsignedReceipt: Omit<AiConsoleTrainingDesignCommandReceipt, "commandReceiptSha256"> = {
      schemaVersion: "ai_console_training_design_command_receipt_v1",
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
      eventId: event?.designEventId ?? null,
      requestedAtUtc: input.requestedAtUtc,
      finishedAtUtc,
      executorIdentity,
      previousCommandReceiptSha256: metadata.headCommandReceiptSha256,
    }
    const receipt = { ...unsignedReceipt, commandReceiptSha256: sha256Text(JSON.stringify(unsignedReceipt)) }

    database.exec("BEGIN IMMEDIATE")
    try {
      if (event && modelStructure && input.commandType === "register_model_structure") insertModel(database, modelStructure, creationContentBlob as Uint8Array)
      if (event && trainingPlan && input.commandType === "register_training_plan") insertPlan(database, trainingPlan, creationContentBlob as Uint8Array)
      if (event) insertEvent(database, event)
      insertReceipt(database, receipt)
      updateMetadata(database, metadata, receipt, event, input.commandType)
      database.exec("COMMIT")
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }
    return { receipt, modelStructure, trainingPlan, event, replayed: false, httpStatus: succeeded ? 201 : 409 }
  } finally {
    database.close()
  }
}

export function readAiConsoleTrainingDesignStore(): AiConsoleTrainingDesignRead {
  const storePath = getStorePath()
  if (!existsSync(storePath)) return { status: "not_connected", reasonCode: "ai_console_training_design_store_not_initialized", evidenceReferences: [trainingDesignStoreLogicalPath] }
  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(storePath, { open: true, readOnly: true })
    verifyDatabaseIntegrity(database)
    verifyDatabaseVersion(database)
    verifyDatabaseSchema(database)
    const metadata = readAndVerifyMetadata(database)
    const models = database.prepare(`${modelSelectSql} ORDER BY model_sequence ASC`).all().map(modelFromRow)
    const plans = database.prepare(`${planSelectSql} ORDER BY plan_sequence ASC`).all().map(planFromRow)
    const events = database.prepare(`${eventSelectSql} ORDER BY event_sequence ASC`).all().map(eventFromRow)
    const receipts = database.prepare(`${receiptSelectSql} ORDER BY command_sequence ASC`).all().map(receiptFromRow)
    verifyStoreRecords(metadata, models, plans, events, receipts)
    return {
      status: "connected",
      metadata,
      modelStructures: models.map(stripModelBlob),
      trainingPlans: plans.map(stripPlanBlob),
      events: [...events].reverse(),
      receipts: [...receipts].reverse(),
      evidenceReferences: [trainingDesignStoreLogicalPath, "data/ai-console/schemas/ai-console-training-design-v1.schema.json"],
    }
  } catch (error) {
    return { status: "unknown_or_stale", reasonCode: error instanceof Error ? error.message : "ai_console_training_design_store_read_failed", evidenceReferences: [trainingDesignStoreLogicalPath] }
  } finally { database?.close() }
}

function modelCreationContent(input: Extract<AiConsoleTrainingDesignCommandInput, { commandType: "register_model_structure" }>) {
  return {
    schemaVersion: "ai_console_model_structure_creation_v1",
    capabilityDomain: input.capabilityDomain,
    modelFamily: input.modelFamily,
    architectureDefinitionSha256: input.architectureDefinitionSha256,
    sourceCodeSha256: input.sourceCodeSha256,
    inputConditionSchemaId: input.inputConditionSchemaId,
    outputSchemaId: input.outputSchemaId,
    parameterCount: input.parameterCount,
  } as const
}

function planCreationContent(input: Extract<AiConsoleTrainingDesignCommandInput, { commandType: "register_training_plan" }>, modelStructureRecordSha256: string) {
  return {
    schemaVersion: "ai_console_training_plan_creation_v1",
    capabilityDomain: input.capabilityDomain,
    modelStructureId: input.modelStructureId,
    modelStructureRecordSha256,
    datasetReleaseIdentity: input.datasetReleaseIdentity,
    splitIdentity: input.splitIdentity,
    randomSeed: input.randomSeed,
    nativeResolution: input.nativeResolution,
    epochBudget: input.epochBudget,
    parentTerminalRule: input.parentTerminalRule,
    optimizerConfigSha256: input.optimizerConfigSha256,
    resourceProfileIdentity: input.resourceProfileIdentity,
  } as const
}

function createModelStructure(input: ReturnType<typeof modelCreationContent> & { modelStructureId: string; modelSequence: number; commandId: string; registeredAtUtc: string; creationContentSha256: string }): AiConsoleModelStructureRecord {
  const unsigned: Omit<AiConsoleModelStructureRecord, "modelStructureRecordSha256"> = {
    schemaVersion: "ai_console_model_structure_v1", registryIdentity, modelStructureId: input.modelStructureId,
    modelSequence: input.modelSequence, capabilityDomain: input.capabilityDomain, modelFamily: input.modelFamily,
    architectureDefinitionSha256: input.architectureDefinitionSha256, sourceCodeSha256: input.sourceCodeSha256,
    inputConditionSchemaId: input.inputConditionSchemaId, outputSchemaId: input.outputSchemaId,
    parameterCount: input.parameterCount, modelStructureStatus: "registered", commandId: input.commandId,
    registeredAtUtc: input.registeredAtUtc, creationContentSha256: input.creationContentSha256,
  }
  return { ...unsigned, modelStructureRecordSha256: sha256Text(JSON.stringify(unsigned)) }
}

function createTrainingPlan(input: ReturnType<typeof planCreationContent> & { trainingPlanId: string; planSequence: number; commandId: string; registeredAtUtc: string; creationContentSha256: string }): AiConsoleTrainingPlanRecord {
  const unsigned: Omit<AiConsoleTrainingPlanRecord, "trainingPlanRecordSha256"> = {
    schemaVersion: "ai_console_training_plan_v1", registryIdentity, trainingPlanId: input.trainingPlanId,
    planSequence: input.planSequence, capabilityDomain: input.capabilityDomain, modelStructureId: input.modelStructureId,
    modelStructureRecordSha256: input.modelStructureRecordSha256, datasetReleaseIdentity: input.datasetReleaseIdentity,
    splitIdentity: input.splitIdentity, randomSeed: input.randomSeed, nativeResolution: input.nativeResolution,
    epochBudget: input.epochBudget, parentTerminalRule: input.parentTerminalRule,
    optimizerConfigSha256: input.optimizerConfigSha256, resourceProfileIdentity: input.resourceProfileIdentity,
    planStatus: "registered_inactive", commandId: input.commandId, registeredAtUtc: input.registeredAtUtc,
    creationContentSha256: input.creationContentSha256,
  }
  return { ...unsigned, trainingPlanRecordSha256: sha256Text(JSON.stringify(unsigned)) }
}

function createDesignEvent(input: Omit<AiConsoleTrainingDesignEventRecord, "schemaVersion" | "registryIdentity" | "designEventId" | "eventRecordSha256">): AiConsoleTrainingDesignEventRecord {
  const designEventId = sha256Text(`ai_console_training_design_event_v1\n${input.commandId}`)
  const unsigned: Omit<AiConsoleTrainingDesignEventRecord, "eventRecordSha256"> = { schemaVersion: "ai_console_training_design_event_v1", registryIdentity, designEventId, ...input }
  return { ...unsigned, eventRecordSha256: sha256Text(JSON.stringify(unsigned)) }
}

function normalizedCommandInput(input: AiConsoleTrainingDesignCommandInput): Record<string, unknown> {
  const { actorIdentity: _actor, role: _role, requestedAtUtc: _time, idempotencyKeySha256: _key, ...normalized } = input
  void _actor; void _role; void _time; void _key
  return normalized
}

function validateCommandInput(input: AiConsoleTrainingDesignCommandInput) {
  if (!isPlainRecord(input) || !commandTypes.includes(input.commandType)) throw new Error("ai_console_training_design_command_input_invalid")
  const common = ["commandType", "expectedRegistryRevision", "idempotencyKeySha256", "reasonText", "actorIdentity", "role", "requestedAtUtc"]
  const specific = input.commandType === "register_model_structure"
    ? ["capabilityDomain", "modelFamily", "architectureDefinitionSha256", "sourceCodeSha256", "inputConditionSchemaId", "outputSchemaId", "parameterCount"]
    : ["capabilityDomain", "modelStructureId", "datasetReleaseIdentity", "splitIdentity", "randomSeed", "nativeResolution", "epochBudget", "parentTerminalRule", "optimizerConfigSha256", "resourceProfileIdentity"]
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify([...common, ...specific].sort())) throw new Error("ai_console_training_design_command_field_set_invalid")
  if (!Number.isInteger(input.expectedRegistryRevision) || input.expectedRegistryRevision < 0) throw new Error("ai_console_training_design_expected_revision_invalid")
  if (!isSha256(input.idempotencyKeySha256)) throw new Error("ai_console_training_design_idempotency_identity_invalid")
  if (!isBoundedText(input.reasonText, 4, 240) || input.actorIdentity !== "local_console_operator" || input.role !== "operator" || !isUtcTimestamp(input.requestedAtUtc)) throw new Error("ai_console_training_design_command_common_field_invalid")
  if (!aiConsoleTrainingCapabilityDomains.includes(input.capabilityDomain)) throw new Error("ai_console_training_design_capability_domain_invalid")
  if (input.commandType === "register_model_structure") {
    if (!isRegisteredIdentity(input.modelFamily) || !isSha256(input.architectureDefinitionSha256) || !isSha256(input.sourceCodeSha256) || !isRegisteredIdentity(input.inputConditionSchemaId) || !isRegisteredIdentity(input.outputSchemaId)) throw new Error("ai_console_model_structure_contract_invalid")
    if (!Number.isSafeInteger(input.parameterCount) || input.parameterCount < 1) throw new Error("ai_console_model_structure_parameter_count_invalid")
  } else {
    if (!isSha256(input.modelStructureId) || !isRegisteredIdentity(input.datasetReleaseIdentity) || !isRegisteredIdentity(input.splitIdentity) || !isRegisteredIdentity(input.parentTerminalRule) || !isSha256(input.optimizerConfigSha256) || !isRegisteredIdentity(input.resourceProfileIdentity)) throw new Error("ai_console_training_plan_contract_invalid")
    if (!Number.isSafeInteger(input.randomSeed) || input.randomSeed < 0 || input.randomSeed > 2147483647) throw new Error("ai_console_training_plan_seed_invalid")
    if (!/^\d{2,5}x\d{2,5}$/u.test(input.nativeResolution)) throw new Error("ai_console_training_plan_resolution_invalid")
    if (!Number.isInteger(input.epochBudget) || input.epochBudget < 1 || input.epochBudget > 1000000) throw new Error("ai_console_training_plan_epoch_budget_invalid")
  }
}

function openWritableStore(): DatabaseSync {
  const storePath = getStorePath()
  mkdirSync(path.dirname(storePath), { recursive: true })
  const database = new DatabaseSync(storePath)
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;")
  database.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version TEXT NOT NULL, registry_identity TEXT NOT NULL,
      source_boundary TEXT NOT NULL, writer_identity TEXT NOT NULL, store_revision INTEGER NOT NULL CHECK (store_revision >= 0),
      registry_revision INTEGER NOT NULL CHECK (registry_revision >= 0), model_structure_count INTEGER NOT NULL CHECK (model_structure_count >= 0),
      training_plan_count INTEGER NOT NULL CHECK (training_plan_count >= 0), command_count INTEGER NOT NULL CHECK (command_count >= 0),
      event_count INTEGER NOT NULL CHECK (event_count >= 0), created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL,
      head_event_record_sha256 TEXT, head_command_receipt_sha256 TEXT, metadata_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS model_structures (
      model_structure_id TEXT PRIMARY KEY, model_sequence INTEGER NOT NULL UNIQUE CHECK (model_sequence >= 1), capability_domain TEXT NOT NULL,
      model_family TEXT NOT NULL, architecture_definition_sha256 TEXT NOT NULL, source_code_sha256 TEXT NOT NULL,
      input_condition_schema_id TEXT NOT NULL, output_schema_id TEXT NOT NULL, parameter_count INTEGER NOT NULL CHECK (parameter_count >= 1),
      model_structure_status TEXT NOT NULL, command_id TEXT NOT NULL UNIQUE, registered_at_utc TEXT NOT NULL,
      creation_content_sha256 TEXT NOT NULL, creation_content_blob BLOB NOT NULL, model_structure_record_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_plans (
      training_plan_id TEXT PRIMARY KEY, plan_sequence INTEGER NOT NULL UNIQUE CHECK (plan_sequence >= 1), capability_domain TEXT NOT NULL,
      model_structure_id TEXT NOT NULL, model_structure_record_sha256 TEXT NOT NULL, dataset_release_identity TEXT NOT NULL,
      split_identity TEXT NOT NULL, random_seed INTEGER NOT NULL CHECK (random_seed >= 0), native_resolution TEXT NOT NULL,
      epoch_budget INTEGER NOT NULL CHECK (epoch_budget >= 1), parent_terminal_rule TEXT NOT NULL, optimizer_config_sha256 TEXT NOT NULL,
      resource_profile_identity TEXT NOT NULL, plan_status TEXT NOT NULL, command_id TEXT NOT NULL UNIQUE,
      registered_at_utc TEXT NOT NULL, creation_content_sha256 TEXT NOT NULL, creation_content_blob BLOB NOT NULL,
      training_plan_record_sha256 TEXT NOT NULL, FOREIGN KEY (model_structure_id) REFERENCES model_structures(model_structure_id)
    );
    CREATE TABLE IF NOT EXISTS design_events (
      design_event_id TEXT PRIMARY KEY, event_sequence INTEGER NOT NULL UNIQUE CHECK (event_sequence >= 1), command_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL, subject_type TEXT NOT NULL, subject_identity TEXT NOT NULL, capability_domain TEXT NOT NULL,
      subject_record_sha256 TEXT NOT NULL, occurred_at_utc TEXT NOT NULL, previous_event_record_sha256 TEXT, event_record_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS command_receipts (
      command_id TEXT PRIMARY KEY, command_sequence INTEGER NOT NULL UNIQUE CHECK (command_sequence >= 1), command_type TEXT NOT NULL,
      actor_identity TEXT NOT NULL, role TEXT NOT NULL, target_identity TEXT, expected_registry_revision INTEGER NOT NULL,
      resulting_registry_revision INTEGER NOT NULL, idempotency_key_sha256 TEXT NOT NULL, input_sha256 TEXT NOT NULL, reason_text TEXT NOT NULL,
      validation_status TEXT NOT NULL, execution_status TEXT NOT NULL, result_terminal_id TEXT NOT NULL, failure_code TEXT, event_id TEXT,
      requested_at_utc TEXT NOT NULL, finished_at_utc TEXT NOT NULL, executor_identity TEXT NOT NULL,
      previous_command_receipt_sha256 TEXT, command_receipt_sha256 TEXT NOT NULL
    );
  `)
  verifyDatabaseSchema(database)
  const count = Number((database.prepare("SELECT COUNT(*) AS count FROM metadata").get() as { count: number }).count)
  if (count === 0) insertInitialMetadata(database)
  if (count > 1) throw new Error("ai_console_training_design_metadata_cardinality_invalid")
  database.exec("PRAGMA user_version = 1")
  return database
}

function insertInitialMetadata(database: DatabaseSync) {
  const createdAtUtc = new Date().toISOString()
  const unsigned: Omit<AiConsoleTrainingDesignMetadata, "metadataSha256"> = {
    schemaVersion, registryIdentity, sourceBoundary: "new_ai_console_only", writerIdentity,
    storeRevision: 0, registryRevision: 0, modelStructureCount: 0, trainingPlanCount: 0, commandCount: 0, eventCount: 0,
    createdAtUtc, updatedAtUtc: createdAtUtc, headEventRecordSha256: null, headCommandReceiptSha256: null,
  }
  const metadata = { ...unsigned, metadataSha256: sha256Text(JSON.stringify(unsigned)) }
  database.prepare("INSERT INTO metadata VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    metadata.schemaVersion, metadata.registryIdentity, metadata.sourceBoundary, metadata.writerIdentity, metadata.storeRevision,
    metadata.registryRevision, metadata.modelStructureCount, metadata.trainingPlanCount, metadata.commandCount, metadata.eventCount,
    metadata.createdAtUtc, metadata.updatedAtUtc, metadata.headEventRecordSha256, metadata.headCommandReceiptSha256, metadata.metadataSha256,
  )
}

function insertModel(database: DatabaseSync, record: AiConsoleModelStructureRecord, blob: Uint8Array) {
  database.prepare("INSERT INTO model_structures VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    record.modelStructureId, record.modelSequence, record.capabilityDomain, record.modelFamily, record.architectureDefinitionSha256,
    record.sourceCodeSha256, record.inputConditionSchemaId, record.outputSchemaId, record.parameterCount, record.modelStructureStatus,
    record.commandId, record.registeredAtUtc, record.creationContentSha256, blob, record.modelStructureRecordSha256,
  )
}

function insertPlan(database: DatabaseSync, record: AiConsoleTrainingPlanRecord, blob: Uint8Array) {
  database.prepare("INSERT INTO training_plans VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    record.trainingPlanId, record.planSequence, record.capabilityDomain, record.modelStructureId, record.modelStructureRecordSha256,
    record.datasetReleaseIdentity, record.splitIdentity, record.randomSeed, record.nativeResolution, record.epochBudget,
    record.parentTerminalRule, record.optimizerConfigSha256, record.resourceProfileIdentity, record.planStatus, record.commandId,
    record.registeredAtUtc, record.creationContentSha256, blob, record.trainingPlanRecordSha256,
  )
}

function insertEvent(database: DatabaseSync, event: AiConsoleTrainingDesignEventRecord) {
  database.prepare("INSERT INTO design_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    event.designEventId, event.eventSequence, event.commandId, event.eventType, event.subjectType, event.subjectIdentity,
    event.capabilityDomain, event.subjectRecordSha256, event.occurredAtUtc, event.previousEventRecordSha256, event.eventRecordSha256,
  )
}

function insertReceipt(database: DatabaseSync, receipt: AiConsoleTrainingDesignCommandReceipt) {
  database.prepare("INSERT INTO command_receipts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    receipt.commandId, receipt.commandSequence, receipt.commandType, receipt.actorIdentity, receipt.role, receipt.targetIdentity,
    receipt.expectedRegistryRevision, receipt.resultingRegistryRevision, receipt.idempotencyKeySha256, receipt.inputSha256,
    receipt.reasonText, receipt.validationStatus, receipt.executionStatus, receipt.resultTerminalId, receipt.failureCode, receipt.eventId,
    receipt.requestedAtUtc, receipt.finishedAtUtc, receipt.executorIdentity, receipt.previousCommandReceiptSha256, receipt.commandReceiptSha256,
  )
}

function updateMetadata(database: DatabaseSync, metadata: AiConsoleTrainingDesignMetadata, receipt: AiConsoleTrainingDesignCommandReceipt, event: AiConsoleTrainingDesignEventRecord | null, commandType: AiConsoleTrainingDesignCommandType) {
  const modelCreated = Boolean(event && commandType === "register_model_structure")
  const planCreated = Boolean(event && commandType === "register_training_plan")
  const unsigned: Omit<AiConsoleTrainingDesignMetadata, "metadataSha256"> = {
    schemaVersion, registryIdentity, sourceBoundary: "new_ai_console_only", writerIdentity,
    storeRevision: metadata.storeRevision + 1, registryRevision: receipt.resultingRegistryRevision,
    modelStructureCount: metadata.modelStructureCount + (modelCreated ? 1 : 0), trainingPlanCount: metadata.trainingPlanCount + (planCreated ? 1 : 0),
    commandCount: metadata.commandCount + 1, eventCount: metadata.eventCount + (event ? 1 : 0), createdAtUtc: metadata.createdAtUtc,
    updatedAtUtc: receipt.finishedAtUtc, headEventRecordSha256: event?.eventRecordSha256 ?? metadata.headEventRecordSha256,
    headCommandReceiptSha256: receipt.commandReceiptSha256,
  }
  const metadataSha256 = sha256Text(JSON.stringify(unsigned))
  const result = database.prepare(`UPDATE metadata SET store_revision = ?, registry_revision = ?, model_structure_count = ?,
    training_plan_count = ?, command_count = ?, event_count = ?, updated_at_utc = ?, head_event_record_sha256 = ?,
    head_command_receipt_sha256 = ?, metadata_sha256 = ? WHERE singleton = 1 AND store_revision = ?`).run(
    unsigned.storeRevision, unsigned.registryRevision, unsigned.modelStructureCount, unsigned.trainingPlanCount,
    unsigned.commandCount, unsigned.eventCount, unsigned.updatedAtUtc, unsigned.headEventRecordSha256,
    unsigned.headCommandReceiptSha256, metadataSha256, metadata.storeRevision,
  )
  if (Number(result.changes) !== 1) throw new Error("ai_console_training_design_metadata_revision_conflict")
}

function readAndVerifyMetadata(database: DatabaseSync): AiConsoleTrainingDesignMetadata {
  const rows = database.prepare("SELECT * FROM metadata").all()
  if (rows.length !== 1) throw new Error("ai_console_training_design_metadata_cardinality_invalid")
  const row = rows[0] as Record<string, unknown>
  const metadata: AiConsoleTrainingDesignMetadata = {
    schemaVersion: String(row.schema_version) as typeof schemaVersion, registryIdentity: String(row.registry_identity) as typeof registryIdentity,
    sourceBoundary: String(row.source_boundary) as "new_ai_console_only", writerIdentity: String(row.writer_identity) as typeof writerIdentity,
    storeRevision: Number(row.store_revision), registryRevision: Number(row.registry_revision), modelStructureCount: Number(row.model_structure_count),
    trainingPlanCount: Number(row.training_plan_count), commandCount: Number(row.command_count), eventCount: Number(row.event_count),
    createdAtUtc: String(row.created_at_utc), updatedAtUtc: String(row.updated_at_utc),
    headEventRecordSha256: row.head_event_record_sha256 === null ? null : String(row.head_event_record_sha256),
    headCommandReceiptSha256: row.head_command_receipt_sha256 === null ? null : String(row.head_command_receipt_sha256), metadataSha256: String(row.metadata_sha256),
  }
  if (metadata.schemaVersion !== schemaVersion || metadata.registryIdentity !== registryIdentity || metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== writerIdentity) throw new Error("ai_console_training_design_metadata_identity_invalid")
  for (const value of [metadata.storeRevision, metadata.registryRevision, metadata.modelStructureCount, metadata.trainingPlanCount, metadata.commandCount, metadata.eventCount]) if (!Number.isInteger(value) || value < 0) throw new Error("ai_console_training_design_metadata_count_invalid")
  if (metadata.storeRevision !== metadata.commandCount || metadata.registryRevision !== metadata.eventCount || metadata.registryRevision !== metadata.modelStructureCount + metadata.trainingPlanCount) throw new Error("ai_console_training_design_metadata_relation_invalid")
  if (!isUtcTimestamp(metadata.createdAtUtc) || !isUtcTimestamp(metadata.updatedAtUtc)) throw new Error("ai_console_training_design_metadata_time_invalid")
  if ((metadata.headEventRecordSha256 !== null && !isSha256(metadata.headEventRecordSha256)) || (metadata.headCommandReceiptSha256 !== null && !isSha256(metadata.headCommandReceiptSha256))) throw new Error("ai_console_training_design_metadata_head_invalid")
  const { metadataSha256, ...unsigned } = metadata
  if (!isSha256(metadataSha256) || sha256Text(JSON.stringify(unsigned)) !== metadataSha256) throw new Error("ai_console_training_design_metadata_sha256_mismatch")
  return metadata
}

function verifyStoreRecords(metadata: AiConsoleTrainingDesignMetadata, models: readonly StoredModelStructure[], plans: readonly StoredTrainingPlan[], events: readonly AiConsoleTrainingDesignEventRecord[], receipts: readonly AiConsoleTrainingDesignCommandReceipt[]) {
  if (models.length !== metadata.modelStructureCount || plans.length !== metadata.trainingPlanCount || events.length !== metadata.eventCount || receipts.length !== metadata.commandCount) throw new Error("ai_console_training_design_record_count_mismatch")
  let previousReceipt: string | null = null
  receipts.forEach((receipt, index) => { verifyReceipt(receipt, index + 1, previousReceipt); previousReceipt = receipt.commandReceiptSha256 })
  if (previousReceipt !== metadata.headCommandReceiptSha256) throw new Error("ai_console_training_design_receipt_head_mismatch")
  let previousEvent: string | null = null
  events.forEach((event, index) => { verifyEvent(event, index + 1, previousEvent); previousEvent = event.eventRecordSha256 })
  if (previousEvent !== metadata.headEventRecordSha256) throw new Error("ai_console_training_design_event_head_mismatch")
  models.forEach((record, index) => verifyModel(record, index + 1))
  plans.forEach((record, index) => verifyPlan(record, index + 1, models))
  for (const event of events) {
    const receipt = receipts.find((candidate) => candidate.commandId === event.commandId)
    if (!receipt || receipt.eventId !== event.designEventId || receipt.executionStatus !== "succeeded") throw new Error("ai_console_training_design_event_receipt_binding_invalid")
  }
}

function verifyModel(record: StoredModelStructure, sequence: number) {
  if (record.schemaVersion !== "ai_console_model_structure_v1" || record.registryIdentity !== registryIdentity || record.modelSequence !== sequence || record.modelStructureStatus !== "registered") throw new Error("ai_console_model_structure_identity_invalid")
  if (!aiConsoleTrainingCapabilityDomains.includes(record.capabilityDomain) || !isRegisteredIdentity(record.modelFamily) || !isSha256(record.architectureDefinitionSha256) || !isSha256(record.sourceCodeSha256) || !isRegisteredIdentity(record.inputConditionSchemaId) || !isRegisteredIdentity(record.outputSchemaId) || !Number.isSafeInteger(record.parameterCount) || record.parameterCount < 1 || !isSha256(record.commandId) || !isUtcTimestamp(record.registeredAtUtc)) throw new Error("ai_console_model_structure_value_invalid")
  const creationText = Buffer.from(record.creationContentBlob).toString("utf8")
  if (sha256Text(creationText) !== record.creationContentSha256 || record.modelStructureId !== sha256Text(`ai_console_model_structure_v1\n${record.creationContentSha256}`)) throw new Error("ai_console_model_structure_content_invalid")
  const { modelStructureRecordSha256, creationContentBlob: _blob, ...unsigned } = record; void _blob
  if (!isSha256(modelStructureRecordSha256) || sha256Text(JSON.stringify(unsigned)) !== modelStructureRecordSha256) throw new Error("ai_console_model_structure_record_sha256_mismatch")
}

function verifyPlan(record: StoredTrainingPlan, sequence: number, models: readonly StoredModelStructure[]) {
  if (record.schemaVersion !== "ai_console_training_plan_v1" || record.registryIdentity !== registryIdentity || record.planSequence !== sequence || record.planStatus !== "registered_inactive") throw new Error("ai_console_training_plan_identity_invalid")
  const parent = models.find((model) => model.modelStructureId === record.modelStructureId)
  if (!parent || parent.capabilityDomain !== record.capabilityDomain || parent.modelStructureRecordSha256 !== record.modelStructureRecordSha256) throw new Error("ai_console_training_plan_model_binding_invalid")
  if (!isRegisteredIdentity(record.datasetReleaseIdentity) || !isRegisteredIdentity(record.splitIdentity) || !Number.isSafeInteger(record.randomSeed) || !/^\d{2,5}x\d{2,5}$/u.test(record.nativeResolution) || !Number.isInteger(record.epochBudget) || !isRegisteredIdentity(record.parentTerminalRule) || !isSha256(record.optimizerConfigSha256) || !isRegisteredIdentity(record.resourceProfileIdentity) || !isSha256(record.commandId) || !isUtcTimestamp(record.registeredAtUtc)) throw new Error("ai_console_training_plan_value_invalid")
  const creationText = Buffer.from(record.creationContentBlob).toString("utf8")
  if (sha256Text(creationText) !== record.creationContentSha256 || record.trainingPlanId !== sha256Text(`ai_console_training_plan_v1\n${record.creationContentSha256}`)) throw new Error("ai_console_training_plan_content_invalid")
  const { trainingPlanRecordSha256, creationContentBlob: _blob, ...unsigned } = record; void _blob
  if (!isSha256(trainingPlanRecordSha256) || sha256Text(JSON.stringify(unsigned)) !== trainingPlanRecordSha256) throw new Error("ai_console_training_plan_record_sha256_mismatch")
}

function verifyEvent(event: AiConsoleTrainingDesignEventRecord, sequence: number, previous: string | null) {
  if (event.schemaVersion !== "ai_console_training_design_event_v1" || event.registryIdentity !== registryIdentity || event.eventSequence !== sequence || event.previousEventRecordSha256 !== previous || event.designEventId !== sha256Text(`ai_console_training_design_event_v1\n${event.commandId}`)) throw new Error("ai_console_training_design_event_chain_invalid")
  if (!isSha256(event.commandId) || !isSha256(event.subjectIdentity) || !isSha256(event.subjectRecordSha256) || !aiConsoleTrainingCapabilityDomains.includes(event.capabilityDomain) || !isUtcTimestamp(event.occurredAtUtc)) throw new Error("ai_console_training_design_event_value_invalid")
  const { eventRecordSha256, ...unsigned } = event
  if (!isSha256(eventRecordSha256) || sha256Text(JSON.stringify(unsigned)) !== eventRecordSha256) throw new Error("ai_console_training_design_event_sha256_mismatch")
}

function verifyReceipt(receipt: AiConsoleTrainingDesignCommandReceipt, sequence: number, previous: string | null) {
  if (receipt.schemaVersion !== "ai_console_training_design_command_receipt_v1" || receipt.registryIdentity !== registryIdentity || receipt.commandSequence !== sequence || receipt.previousCommandReceiptSha256 !== previous) throw new Error("ai_console_training_design_receipt_chain_invalid")
  if (!commandTypes.includes(receipt.commandType) || receipt.actorIdentity !== "local_console_operator" || receipt.role !== "operator" || receipt.executorIdentity !== executorIdentity || !isSha256(receipt.commandId) || !isSha256(receipt.idempotencyKeySha256) || !isSha256(receipt.inputSha256)) throw new Error("ai_console_training_design_receipt_identity_invalid")
  if (!Number.isInteger(receipt.expectedRegistryRevision) || !Number.isInteger(receipt.resultingRegistryRevision) || !isBoundedText(receipt.reasonText, 4, 240) || !isUtcTimestamp(receipt.requestedAtUtc) || !isUtcTimestamp(receipt.finishedAtUtc)) throw new Error("ai_console_training_design_receipt_value_invalid")
  if (receipt.executionStatus === "succeeded") {
    if (receipt.validationStatus !== "accepted" || receipt.failureCode !== null || !isSha256(receipt.eventId) || !isSha256(receipt.targetIdentity)) throw new Error("ai_console_training_design_receipt_success_invalid")
  } else if (receipt.validationStatus !== "rejected" || !receipt.failureCode || receipt.eventId !== null) throw new Error("ai_console_training_design_receipt_rejection_invalid")
  const { commandReceiptSha256, ...unsigned } = receipt
  if (!isSha256(commandReceiptSha256) || sha256Text(JSON.stringify(unsigned)) !== commandReceiptSha256) throw new Error("ai_console_training_design_receipt_sha256_mismatch")
}

function modelFromRow(value: unknown): StoredModelStructure {
  const row = value as Record<string, unknown>
  if (!(row.creation_content_blob instanceof Uint8Array)) throw new Error("ai_console_model_structure_blob_invalid")
  return { schemaVersion: "ai_console_model_structure_v1", registryIdentity, modelStructureId: String(row.model_structure_id), modelSequence: Number(row.model_sequence), capabilityDomain: String(row.capability_domain) as AiConsoleTrainingCapabilityDomain, modelFamily: String(row.model_family), architectureDefinitionSha256: String(row.architecture_definition_sha256), sourceCodeSha256: String(row.source_code_sha256), inputConditionSchemaId: String(row.input_condition_schema_id), outputSchemaId: String(row.output_schema_id), parameterCount: Number(row.parameter_count), modelStructureStatus: String(row.model_structure_status) as "registered", commandId: String(row.command_id), registeredAtUtc: String(row.registered_at_utc), creationContentSha256: String(row.creation_content_sha256), modelStructureRecordSha256: String(row.model_structure_record_sha256), creationContentBlob: row.creation_content_blob }
}

function planFromRow(value: unknown): StoredTrainingPlan {
  const row = value as Record<string, unknown>
  if (!(row.creation_content_blob instanceof Uint8Array)) throw new Error("ai_console_training_plan_blob_invalid")
  return { schemaVersion: "ai_console_training_plan_v1", registryIdentity, trainingPlanId: String(row.training_plan_id), planSequence: Number(row.plan_sequence), capabilityDomain: String(row.capability_domain) as AiConsoleTrainingCapabilityDomain, modelStructureId: String(row.model_structure_id), modelStructureRecordSha256: String(row.model_structure_record_sha256), datasetReleaseIdentity: String(row.dataset_release_identity), splitIdentity: String(row.split_identity), randomSeed: Number(row.random_seed), nativeResolution: String(row.native_resolution), epochBudget: Number(row.epoch_budget), parentTerminalRule: String(row.parent_terminal_rule), optimizerConfigSha256: String(row.optimizer_config_sha256), resourceProfileIdentity: String(row.resource_profile_identity), planStatus: String(row.plan_status) as "registered_inactive", commandId: String(row.command_id), registeredAtUtc: String(row.registered_at_utc), creationContentSha256: String(row.creation_content_sha256), trainingPlanRecordSha256: String(row.training_plan_record_sha256), creationContentBlob: row.creation_content_blob }
}

function eventFromRow(value: unknown): AiConsoleTrainingDesignEventRecord {
  const row = value as Record<string, unknown>
  return { schemaVersion: "ai_console_training_design_event_v1", registryIdentity, designEventId: String(row.design_event_id), eventSequence: Number(row.event_sequence), commandId: String(row.command_id), eventType: String(row.event_type) as AiConsoleTrainingDesignEventRecord["eventType"], subjectType: String(row.subject_type) as AiConsoleTrainingDesignEventRecord["subjectType"], subjectIdentity: String(row.subject_identity), capabilityDomain: String(row.capability_domain) as AiConsoleTrainingCapabilityDomain, subjectRecordSha256: String(row.subject_record_sha256), occurredAtUtc: String(row.occurred_at_utc), previousEventRecordSha256: row.previous_event_record_sha256 === null ? null : String(row.previous_event_record_sha256), eventRecordSha256: String(row.event_record_sha256) }
}

function receiptFromRow(value: unknown): AiConsoleTrainingDesignCommandReceipt {
  const row = value as Record<string, unknown>
  return { schemaVersion: "ai_console_training_design_command_receipt_v1", registryIdentity, commandId: String(row.command_id), commandSequence: Number(row.command_sequence), commandType: String(row.command_type) as AiConsoleTrainingDesignCommandType, actorIdentity: String(row.actor_identity) as "local_console_operator", role: String(row.role) as "operator", targetIdentity: row.target_identity === null ? null : String(row.target_identity), expectedRegistryRevision: Number(row.expected_registry_revision), resultingRegistryRevision: Number(row.resulting_registry_revision), idempotencyKeySha256: String(row.idempotency_key_sha256), inputSha256: String(row.input_sha256), reasonText: String(row.reason_text), validationStatus: String(row.validation_status) as "accepted" | "rejected", executionStatus: String(row.execution_status) as "succeeded" | "rejected", resultTerminalId: String(row.result_terminal_id) as AiConsoleTrainingDesignCommandReceipt["resultTerminalId"], failureCode: row.failure_code === null ? null : String(row.failure_code), eventId: row.event_id === null ? null : String(row.event_id), requestedAtUtc: String(row.requested_at_utc), finishedAtUtc: String(row.finished_at_utc), executorIdentity: String(row.executor_identity) as typeof executorIdentity, previousCommandReceiptSha256: row.previous_command_receipt_sha256 === null ? null : String(row.previous_command_receipt_sha256), commandReceiptSha256: String(row.command_receipt_sha256) }
}

function readModelById(database: DatabaseSync, identity: string): AiConsoleModelStructureRecord | null {
  const row = database.prepare(`${modelSelectSql} WHERE model_structure_id = ?`).get(identity)
  return row ? stripModelBlob(modelFromRow(row)) : null
}
function readPlanById(database: DatabaseSync, identity: string): AiConsoleTrainingPlanRecord | null {
  const row = database.prepare(`${planSelectSql} WHERE training_plan_id = ?`).get(identity)
  return row ? stripPlanBlob(planFromRow(row)) : null
}
function readEventById(database: DatabaseSync, identity: string): AiConsoleTrainingDesignEventRecord | null {
  const row = database.prepare(`${eventSelectSql} WHERE design_event_id = ?`).get(identity)
  return row ? eventFromRow(row) : null
}
function stripModelBlob(record: StoredModelStructure): AiConsoleModelStructureRecord { const { creationContentBlob: _blob, ...rest } = record; void _blob; return rest }
function stripPlanBlob(record: StoredTrainingPlan): AiConsoleTrainingPlanRecord { const { creationContentBlob: _blob, ...rest } = record; void _blob; return rest }

function verifyDatabaseSchema(database: DatabaseSync) {
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(tables) !== JSON.stringify(["command_receipts", "design_events", "metadata", "model_structures", "training_plans"])) throw new Error("ai_console_training_design_table_set_invalid")
  verifyColumnSet(database, "metadata", ["singleton", "schema_version", "registry_identity", "source_boundary", "writer_identity", "store_revision", "registry_revision", "model_structure_count", "training_plan_count", "command_count", "event_count", "created_at_utc", "updated_at_utc", "head_event_record_sha256", "head_command_receipt_sha256", "metadata_sha256"])
  verifyColumnSet(database, "model_structures", ["model_structure_id", "model_sequence", "capability_domain", "model_family", "architecture_definition_sha256", "source_code_sha256", "input_condition_schema_id", "output_schema_id", "parameter_count", "model_structure_status", "command_id", "registered_at_utc", "creation_content_sha256", "creation_content_blob", "model_structure_record_sha256"])
  verifyColumnSet(database, "training_plans", ["training_plan_id", "plan_sequence", "capability_domain", "model_structure_id", "model_structure_record_sha256", "dataset_release_identity", "split_identity", "random_seed", "native_resolution", "epoch_budget", "parent_terminal_rule", "optimizer_config_sha256", "resource_profile_identity", "plan_status", "command_id", "registered_at_utc", "creation_content_sha256", "creation_content_blob", "training_plan_record_sha256"])
  verifyColumnSet(database, "design_events", ["design_event_id", "event_sequence", "command_id", "event_type", "subject_type", "subject_identity", "capability_domain", "subject_record_sha256", "occurred_at_utc", "previous_event_record_sha256", "event_record_sha256"])
  verifyColumnSet(database, "command_receipts", ["command_id", "command_sequence", "command_type", "actor_identity", "role", "target_identity", "expected_registry_revision", "resulting_registry_revision", "idempotency_key_sha256", "input_sha256", "reason_text", "validation_status", "execution_status", "result_terminal_id", "failure_code", "event_id", "requested_at_utc", "finished_at_utc", "executor_identity", "previous_command_receipt_sha256", "command_receipt_sha256"])
}
function verifyColumnSet(database: DatabaseSync, tableName: string, expected: readonly string[]) { const columns = database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String((row as { name: unknown }).name)); if (JSON.stringify(columns) !== JSON.stringify(expected)) throw new Error(`ai_console_training_design_column_set_invalid:${tableName}`) }
function verifyDatabaseIntegrity(database: DatabaseSync) { const result = database.prepare("PRAGMA integrity_check").get() as Record<string, unknown>; if (!result || !Object.values(result).includes("ok")) throw new Error("ai_console_training_design_sqlite_integrity_failure") }
function verifyDatabaseVersion(database: DatabaseSync) { const result = database.prepare("PRAGMA user_version").get() as Record<string, unknown>; if (!result || !Object.values(result).includes(1)) throw new Error("ai_console_training_design_sqlite_version_invalid") }

function getStorePath(): string { return path.join(process.cwd(), ...trainingDesignStoreLogicalPath.split("/")) }
function sha256Text(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex") }
function isSha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function isUtcTimestamp(value: unknown): value is string { return typeof value === "string" && value.endsWith("Z") && !Number.isNaN(Date.parse(value)) }
function isRegisteredIdentity(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value) }
function isBoundedText(value: unknown, minimum: number, maximum: number): value is string { return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value) }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }

const modelSelectSql = `SELECT model_structure_id, model_sequence, capability_domain, model_family, architecture_definition_sha256,
  source_code_sha256, input_condition_schema_id, output_schema_id, parameter_count, model_structure_status, command_id,
  registered_at_utc, creation_content_sha256, creation_content_blob, model_structure_record_sha256 FROM model_structures`
const planSelectSql = `SELECT training_plan_id, plan_sequence, capability_domain, model_structure_id, model_structure_record_sha256,
  dataset_release_identity, split_identity, random_seed, native_resolution, epoch_budget, parent_terminal_rule,
  optimizer_config_sha256, resource_profile_identity, plan_status, command_id, registered_at_utc, creation_content_sha256,
  creation_content_blob, training_plan_record_sha256 FROM training_plans`
const eventSelectSql = `SELECT design_event_id, event_sequence, command_id, event_type, subject_type, subject_identity,
  capability_domain, subject_record_sha256, occurred_at_utc, previous_event_record_sha256, event_record_sha256 FROM design_events`
const receiptSelectSql = `SELECT command_id, command_sequence, command_type, actor_identity, role, target_identity,
  expected_registry_revision, resulting_registry_revision, idempotency_key_sha256, input_sha256, reason_text,
  validation_status, execution_status, result_terminal_id, failure_code, event_id, requested_at_utc, finished_at_utc,
  executor_identity, previous_command_receipt_sha256, command_receipt_sha256 FROM command_receipts`
