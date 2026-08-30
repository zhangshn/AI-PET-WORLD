import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export const taskRegistryStoreLogicalPath = ".runtime/ai-console/tasks/task-registry-v1.sqlite"
const schemaVersion = "ai_console_task_registry_store_v1"
const registryIdentity = "ai_console_task_registry"
const writerIdentity = "ai_console_task_registry_writer_v1"
const executorIdentity = "ai_console_task_registry_executor_v1"
const capabilityDomains = [
  "visual_world_generation",
  "text_and_language",
  "speech_and_audio",
  "video_generation",
  "multimodal_orchestration",
] as const
const commandTypes = ["create_registered_task", "set_queued_task_priority", "cancel_unstarted_task"] as const

export type AiConsoleTaskRegistryCapabilityDomain = (typeof capabilityDomains)[number]
export type AiConsoleTaskRegistryCommandType = (typeof commandTypes)[number]

type CommandBase = {
  commandType: AiConsoleTaskRegistryCommandType
  expectedRegistryRevision: number
  idempotencyKeySha256: string
  reasonText: string
  actorIdentity: "local_console_operator"
  role: "operator"
  requestedAtUtc: string
}

export type AiConsoleTaskRegistryCommandInput =
  | (CommandBase & {
      commandType: "create_registered_task"
      taskGoal: string
      capabilityDomain: AiConsoleTaskRegistryCapabilityDomain
      priority: number
    })
  | (CommandBase & {
      commandType: "set_queued_task_priority"
      taskId: string
      priority: number
    })
  | (CommandBase & {
      commandType: "cancel_unstarted_task"
      taskId: string
    })

export type AiConsoleTaskRegistryTaskRecord = {
  schemaVersion: "ai_console_task_registry_task_v1"
  registryIdentity: typeof registryIdentity
  taskId: string
  taskSequence: number
  queueItemId: string
  taskGoal: string
  taskGoalSha256: string
  capabilityDomain: AiConsoleTaskRegistryCapabilityDomain
  priority: number
  lifecycleStatus: "queued" | "cancelled"
  queuedAtUtc: string
  cancelledAtUtc: string | null
  taskRevision: number
  createdByCommandId: string
  lastCommandId: string
  creationContentSha256: string
  updatedAtUtc: string
  integrityStatus: "verified"
  previousTaskStateSha256: string | null
  taskRecordSha256: string
}

export type AiConsoleTaskRegistryEventRecord = {
  schemaVersion: "ai_console_task_registry_event_v1"
  registryIdentity: typeof registryIdentity
  taskEventId: string
  eventSequence: number
  commandId: string
  taskId: string
  eventType: "task_registered" | "task_priority_updated" | "task_cancelled"
  sourceLifecycleStatus: "queued" | null
  targetLifecycleStatus: "queued" | "cancelled"
  sourcePriority: number | null
  targetPriority: number
  sourceTaskRecordSha256: string | null
  targetTaskRecordSha256: string
  occurredAtUtc: string
  previousEventRecordSha256: string | null
  eventRecordSha256: string
}

export type AiConsoleTaskRegistryCommandReceipt = {
  schemaVersion: "ai_console_task_registry_command_receipt_v1"
  registryIdentity: typeof registryIdentity
  commandId: string
  commandSequence: number
  commandType: AiConsoleTaskRegistryCommandType
  actorIdentity: "local_console_operator"
  role: "operator"
  targetTaskId: string | null
  expectedRegistryRevision: number
  resultingRegistryRevision: number
  idempotencyKeySha256: string
  inputSha256: string
  reasonText: string
  validationStatus: "accepted" | "rejected"
  executionStatus: "succeeded" | "rejected"
  resultTerminalId: "task_registered" | "task_priority_updated" | "task_cancelled" | "registry_revision_conflict" | "task_not_found" | "task_state_conflict"
  failureCode: string | null
  eventId: string | null
  requestedAtUtc: string
  finishedAtUtc: string
  executorIdentity: typeof executorIdentity
  previousCommandReceiptSha256: string | null
  commandReceiptSha256: string
}

export type AiConsoleTaskRegistryMetadata = {
  schemaVersion: typeof schemaVersion
  registryIdentity: typeof registryIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof writerIdentity
  storeRevision: number
  registryRevision: number
  taskCount: number
  commandCount: number
  eventCount: number
  createdAtUtc: string
  updatedAtUtc: string
  headEventRecordSha256: string | null
  headCommandReceiptSha256: string | null
  metadataSha256: string
}

export type AiConsoleTaskRegistryCommandResult = {
  receipt: AiConsoleTaskRegistryCommandReceipt
  task: AiConsoleTaskRegistryTaskRecord | null
  event: AiConsoleTaskRegistryEventRecord | null
  replayed: boolean
  httpStatus: 200 | 201 | 409
}

export type AiConsoleTaskRegistryRead =
  | {
      status: "connected"
      metadata: AiConsoleTaskRegistryMetadata
      tasks: readonly AiConsoleTaskRegistryTaskRecord[]
      events: readonly AiConsoleTaskRegistryEventRecord[]
      receipts: readonly AiConsoleTaskRegistryCommandReceipt[]
      evidenceReferences: readonly string[]
    }
  | {
      status: "not_connected" | "unknown_or_stale"
      reasonCode: string
      evidenceReferences: readonly string[]
    }

type StoredTaskRecord = AiConsoleTaskRegistryTaskRecord & { creationContentBlob: Uint8Array }

export function isAiConsoleTaskRegistryStoreInitialized(): boolean {
  return existsSync(getStorePath())
}

export function initializeAiConsoleTaskRegistryStore(): AiConsoleTaskRegistryMetadata {
  const database = openWritableStore()
  try {
    return readAndVerifyMetadata(database)
  } finally {
    database.close()
  }
}

export function executeAiConsoleTaskRegistryCommand(
  input: AiConsoleTaskRegistryCommandInput,
): AiConsoleTaskRegistryCommandResult {
  validateCommandInput(input)
  const normalizedInput = normalizedCommandInput(input)
  const inputSha256 = sha256Text(JSON.stringify(normalizedInput))
  const commandId = sha256Text(`${input.actorIdentity}\n${input.commandType}\n${input.idempotencyKeySha256}`)
  const database = openWritableStore()

  try {
    const existingRow = database.prepare(`${receiptSelectSql} WHERE command_id = ?`).get(commandId)
    if (existingRow) {
      const receipt = receiptFromRow(existingRow)
      verifyReceipt(receipt, receipt.commandSequence, receipt.previousCommandReceiptSha256)
      if (receipt.inputSha256 !== inputSha256) throw new Error("ai_console_task_command_idempotency_conflict")
      const event = receipt.eventId ? readEventById(database, receipt.eventId) : null
      const task = receipt.targetTaskId ? readTaskById(database, receipt.targetTaskId) : null
      return { receipt, event, task, replayed: true, httpStatus: 200 }
    }

    const metadata = readAndVerifyMetadata(database)
    const finishedAtUtc = new Date().toISOString()
    let task: AiConsoleTaskRegistryTaskRecord | null = null
    let event: AiConsoleTaskRegistryEventRecord | null = null
    let validationStatus: AiConsoleTaskRegistryCommandReceipt["validationStatus"] = "accepted"
    let executionStatus: AiConsoleTaskRegistryCommandReceipt["executionStatus"] = "succeeded"
    let resultTerminalId: AiConsoleTaskRegistryCommandReceipt["resultTerminalId"]
    let failureCode: string | null = null
    let targetTaskId: string | null = "taskId" in input ? input.taskId : null
    let resultingRegistryRevision = metadata.registryRevision
    let creationContentBlob: Uint8Array | null = null

    if (input.expectedRegistryRevision !== metadata.registryRevision) {
      validationStatus = "rejected"
      executionStatus = "rejected"
      resultTerminalId = "registry_revision_conflict"
      failureCode = "ai_console_task_registry_revision_conflict"
    } else if (input.commandType === "create_registered_task") {
      const creationPayload = {
        schemaVersion: "ai_console_task_creation_payload_v1",
        commandId,
        taskGoal: input.taskGoal,
        capabilityDomain: input.capabilityDomain,
        priority: input.priority,
        queuedAtUtc: input.requestedAtUtc,
      } as const
      const creationContentText = JSON.stringify(creationPayload)
      const creationContentSha256 = sha256Text(creationContentText)
      targetTaskId = sha256Text(`ai_console_registered_task_v1\n${creationContentSha256}`)
      creationContentBlob = Buffer.from(creationContentText, "utf8")
      resultingRegistryRevision += 1
      task = createTaskRecord({
        taskId: targetTaskId,
        taskSequence: metadata.taskCount + 1,
        taskGoal: input.taskGoal,
        capabilityDomain: input.capabilityDomain,
        priority: input.priority,
        queuedAtUtc: input.requestedAtUtc,
        commandId,
        creationContentSha256,
        registryRevision: resultingRegistryRevision,
        occurredAtUtc: finishedAtUtc,
      })
      event = createTaskEvent({
        eventSequence: metadata.eventCount + 1,
        commandId,
        task,
        eventType: "task_registered",
        sourceLifecycleStatus: null,
        sourcePriority: null,
        sourceTaskRecordSha256: null,
        occurredAtUtc: finishedAtUtc,
        previousEventRecordSha256: metadata.headEventRecordSha256,
      })
      resultTerminalId = "task_registered"
    } else {
      const existingTask = readTaskById(database, input.taskId)
      if (!existingTask) {
        validationStatus = "rejected"
        executionStatus = "rejected"
        resultTerminalId = "task_not_found"
        failureCode = "ai_console_task_not_found"
      } else if (existingTask.lifecycleStatus !== "queued") {
        validationStatus = "rejected"
        executionStatus = "rejected"
        resultTerminalId = "task_state_conflict"
        failureCode = "ai_console_task_not_queued"
        task = existingTask
      } else {
        resultingRegistryRevision += 1
        if (input.commandType === "set_queued_task_priority") {
          task = updateTaskRecord(existingTask, {
            commandId,
            priority: input.priority,
            lifecycleStatus: "queued",
            cancelledAtUtc: null,
            registryRevision: resultingRegistryRevision,
            occurredAtUtc: finishedAtUtc,
          })
          event = createTaskEvent({
            eventSequence: metadata.eventCount + 1,
            commandId,
            task,
            eventType: "task_priority_updated",
            sourceLifecycleStatus: existingTask.lifecycleStatus,
            sourcePriority: existingTask.priority,
            sourceTaskRecordSha256: existingTask.taskRecordSha256,
            occurredAtUtc: finishedAtUtc,
            previousEventRecordSha256: metadata.headEventRecordSha256,
          })
          resultTerminalId = "task_priority_updated"
        } else {
          task = updateTaskRecord(existingTask, {
            commandId,
            priority: existingTask.priority,
            lifecycleStatus: "cancelled",
            cancelledAtUtc: finishedAtUtc,
            registryRevision: resultingRegistryRevision,
            occurredAtUtc: finishedAtUtc,
          })
          event = createTaskEvent({
            eventSequence: metadata.eventCount + 1,
            commandId,
            task,
            eventType: "task_cancelled",
            sourceLifecycleStatus: existingTask.lifecycleStatus,
            sourcePriority: existingTask.priority,
            sourceTaskRecordSha256: existingTask.taskRecordSha256,
            occurredAtUtc: finishedAtUtc,
            previousEventRecordSha256: metadata.headEventRecordSha256,
          })
          resultTerminalId = "task_cancelled"
        }
      }
    }

    const unsignedReceipt: Omit<AiConsoleTaskRegistryCommandReceipt, "commandReceiptSha256"> = {
      schemaVersion: "ai_console_task_registry_command_receipt_v1",
      registryIdentity,
      commandId,
      commandSequence: metadata.commandCount + 1,
      commandType: input.commandType,
      actorIdentity: "local_console_operator",
      role: "operator",
      targetTaskId,
      expectedRegistryRevision: input.expectedRegistryRevision,
      resultingRegistryRevision,
      idempotencyKeySha256: input.idempotencyKeySha256,
      inputSha256,
      reasonText: input.reasonText,
      validationStatus,
      executionStatus,
      resultTerminalId,
      failureCode,
      eventId: event?.taskEventId ?? null,
      requestedAtUtc: input.requestedAtUtc,
      finishedAtUtc,
      executorIdentity,
      previousCommandReceiptSha256: metadata.headCommandReceiptSha256,
    }
    const receipt: AiConsoleTaskRegistryCommandReceipt = {
      ...unsignedReceipt,
      commandReceiptSha256: sha256Text(JSON.stringify(unsignedReceipt)),
    }

    database.exec("BEGIN IMMEDIATE")
    try {
      if (task && event) {
        if (input.commandType === "create_registered_task") insertTask(database, task, creationContentBlob as Uint8Array)
        else updateTask(database, task)
        insertEvent(database, event)
      }
      insertReceipt(database, receipt)
      updateMetadata(database, metadata, receipt, event, input.commandType === "create_registered_task" && Boolean(event))
      database.exec("COMMIT")
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }

    return { receipt, task, event, replayed: false, httpStatus: executionStatus === "succeeded" ? 201 : 409 }
  } finally {
    database.close()
  }
}

export function readAiConsoleTaskRegistryStore(): AiConsoleTaskRegistryRead {
  const storePath = getStorePath()
  if (!existsSync(storePath)) {
    return { status: "not_connected", reasonCode: "ai_console_task_registry_store_not_initialized", evidenceReferences: [taskRegistryStoreLogicalPath] }
  }
  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(storePath, { open: true, readOnly: true })
    verifyDatabaseIntegrity(database)
    verifyDatabaseVersion(database)
    verifyDatabaseSchema(database)
    const metadata = readAndVerifyMetadata(database)
    const storedTasks = database.prepare(`${taskSelectSql} ORDER BY task_sequence ASC`).all().map(taskFromRow)
    const events = database.prepare(`${eventSelectSql} ORDER BY event_sequence ASC`).all().map(eventFromRow)
    const receipts = database.prepare(`${receiptSelectSql} ORDER BY command_sequence ASC`).all().map(receiptFromRow)
    verifyStoreRecords(metadata, storedTasks, events, receipts)
    return {
      status: "connected",
      metadata,
      tasks: storedTasks.map(stripCreationContentBlob),
      events: [...events].reverse(),
      receipts: [...receipts].reverse(),
      evidenceReferences: [taskRegistryStoreLogicalPath, "data/ai-console/schemas/ai-console-task-registry-v1.schema.json"],
    }
  } catch (error) {
    return {
      status: "unknown_or_stale",
      reasonCode: error instanceof Error ? error.message : "ai_console_task_registry_store_read_failed",
      evidenceReferences: [taskRegistryStoreLogicalPath],
    }
  } finally {
    database?.close()
  }
}

function createTaskRecord(input: {
  taskId: string
  taskSequence: number
  taskGoal: string
  capabilityDomain: AiConsoleTaskRegistryCapabilityDomain
  priority: number
  queuedAtUtc: string
  commandId: string
  creationContentSha256: string
  registryRevision: number
  occurredAtUtc: string
}): AiConsoleTaskRegistryTaskRecord {
  const unsigned: Omit<AiConsoleTaskRegistryTaskRecord, "taskRecordSha256"> = {
    schemaVersion: "ai_console_task_registry_task_v1",
    registryIdentity,
    taskId: input.taskId,
    taskSequence: input.taskSequence,
    queueItemId: sha256Text(`ai_console_task_queue_item_v1\n${input.taskId}`),
    taskGoal: input.taskGoal,
    taskGoalSha256: sha256Text(input.taskGoal),
    capabilityDomain: input.capabilityDomain,
    priority: input.priority,
    lifecycleStatus: "queued",
    queuedAtUtc: input.queuedAtUtc,
    cancelledAtUtc: null,
    taskRevision: 1,
    createdByCommandId: input.commandId,
    lastCommandId: input.commandId,
    creationContentSha256: input.creationContentSha256,
    updatedAtUtc: input.occurredAtUtc,
    integrityStatus: "verified",
    previousTaskStateSha256: null,
  }
  return { ...unsigned, taskRecordSha256: sha256Text(JSON.stringify(unsigned)) }
}

function updateTaskRecord(existing: AiConsoleTaskRegistryTaskRecord, input: {
  commandId: string
  priority: number
  lifecycleStatus: "queued" | "cancelled"
  cancelledAtUtc: string | null
  registryRevision: number
  occurredAtUtc: string
}): AiConsoleTaskRegistryTaskRecord {
  void input.registryRevision
  const { taskRecordSha256: previousTaskStateSha256, ...previousUnsigned } = existing
  void previousUnsigned
  const unsigned: Omit<AiConsoleTaskRegistryTaskRecord, "taskRecordSha256"> = {
    ...existing,
    priority: input.priority,
    lifecycleStatus: input.lifecycleStatus,
    cancelledAtUtc: input.cancelledAtUtc,
    taskRevision: existing.taskRevision + 1,
    lastCommandId: input.commandId,
    updatedAtUtc: input.occurredAtUtc,
    previousTaskStateSha256,
  }
  delete (unsigned as Partial<AiConsoleTaskRegistryTaskRecord>).taskRecordSha256
  return { ...unsigned, taskRecordSha256: sha256Text(JSON.stringify(unsigned)) }
}

function createTaskEvent(input: {
  eventSequence: number
  commandId: string
  task: AiConsoleTaskRegistryTaskRecord
  eventType: AiConsoleTaskRegistryEventRecord["eventType"]
  sourceLifecycleStatus: "queued" | null
  sourcePriority: number | null
  sourceTaskRecordSha256: string | null
  occurredAtUtc: string
  previousEventRecordSha256: string | null
}): AiConsoleTaskRegistryEventRecord {
  const taskEventId = sha256Text(`ai_console_task_registry_event_v1\n${input.commandId}`)
  const unsigned: Omit<AiConsoleTaskRegistryEventRecord, "eventRecordSha256"> = {
    schemaVersion: "ai_console_task_registry_event_v1",
    registryIdentity,
    taskEventId,
    eventSequence: input.eventSequence,
    commandId: input.commandId,
    taskId: input.task.taskId,
    eventType: input.eventType,
    sourceLifecycleStatus: input.sourceLifecycleStatus,
    targetLifecycleStatus: input.task.lifecycleStatus,
    sourcePriority: input.sourcePriority,
    targetPriority: input.task.priority,
    sourceTaskRecordSha256: input.sourceTaskRecordSha256,
    targetTaskRecordSha256: input.task.taskRecordSha256,
    occurredAtUtc: input.occurredAtUtc,
    previousEventRecordSha256: input.previousEventRecordSha256,
  }
  return { ...unsigned, eventRecordSha256: sha256Text(JSON.stringify(unsigned)) }
}

function normalizedCommandInput(input: AiConsoleTaskRegistryCommandInput): Record<string, unknown> {
  if (input.commandType === "create_registered_task") {
    return {
      commandType: input.commandType,
      taskGoal: input.taskGoal,
      capabilityDomain: input.capabilityDomain,
      priority: input.priority,
      expectedRegistryRevision: input.expectedRegistryRevision,
      reasonText: input.reasonText,
    }
  }
  if (input.commandType === "set_queued_task_priority") {
    return { commandType: input.commandType, taskId: input.taskId, priority: input.priority, expectedRegistryRevision: input.expectedRegistryRevision, reasonText: input.reasonText }
  }
  return { commandType: input.commandType, taskId: input.taskId, expectedRegistryRevision: input.expectedRegistryRevision, reasonText: input.reasonText }
}

function validateCommandInput(input: AiConsoleTaskRegistryCommandInput) {
  if (!isPlainRecord(input) || !commandTypes.includes(input.commandType)) throw new Error("ai_console_task_command_input_invalid")
  const commonFields = ["commandType", "expectedRegistryRevision", "idempotencyKeySha256", "reasonText", "actorIdentity", "role", "requestedAtUtc"]
  const specificFields = input.commandType === "create_registered_task" ? ["taskGoal", "capabilityDomain", "priority"] : input.commandType === "set_queued_task_priority" ? ["taskId", "priority"] : ["taskId"]
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify([...commonFields, ...specificFields].sort())) throw new Error("ai_console_task_command_field_set_invalid")
  if (!Number.isInteger(input.expectedRegistryRevision) || input.expectedRegistryRevision < 0) throw new Error("ai_console_task_command_expected_revision_invalid")
  if (!isSha256(input.idempotencyKeySha256)) throw new Error("ai_console_task_command_idempotency_identity_invalid")
  if (!isBoundedText(input.reasonText, 4, 240)) throw new Error("ai_console_task_command_reason_invalid")
  if (input.actorIdentity !== "local_console_operator" || input.role !== "operator") throw new Error("ai_console_task_command_actor_invalid")
  if (!isUtcTimestamp(input.requestedAtUtc)) throw new Error("ai_console_task_command_time_invalid")
  if (input.commandType === "create_registered_task") {
    if (!isBoundedText(input.taskGoal, 4, 2000)) throw new Error("ai_console_task_goal_invalid")
    if (!capabilityDomains.includes(input.capabilityDomain)) throw new Error("ai_console_task_capability_domain_invalid")
    validatePriority(input.priority)
  } else {
    if (!isSha256(input.taskId)) throw new Error("ai_console_task_identity_invalid")
    if (input.commandType === "set_queued_task_priority") validatePriority(input.priority)
  }
}

function validatePriority(priority: number) {
  if (!Number.isInteger(priority) || priority < 1 || priority > 9) throw new Error("ai_console_task_priority_invalid")
}

function openWritableStore(): DatabaseSync {
  const storePath = getStorePath()
  mkdirSync(path.dirname(storePath), { recursive: true })
  const database = new DatabaseSync(storePath)
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;")
  database.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version TEXT NOT NULL,
      registry_identity TEXT NOT NULL, source_boundary TEXT NOT NULL, writer_identity TEXT NOT NULL,
      store_revision INTEGER NOT NULL CHECK (store_revision >= 0), registry_revision INTEGER NOT NULL CHECK (registry_revision >= 0),
      task_count INTEGER NOT NULL CHECK (task_count >= 0), command_count INTEGER NOT NULL CHECK (command_count >= 0),
      event_count INTEGER NOT NULL CHECK (event_count >= 0), created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL,
      head_event_record_sha256 TEXT, head_command_receipt_sha256 TEXT, metadata_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY, task_sequence INTEGER NOT NULL UNIQUE CHECK (task_sequence >= 1), queue_item_id TEXT NOT NULL UNIQUE,
      task_goal TEXT NOT NULL, task_goal_sha256 TEXT NOT NULL, capability_domain TEXT NOT NULL, priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 9),
      lifecycle_status TEXT NOT NULL, queued_at_utc TEXT NOT NULL, cancelled_at_utc TEXT, task_revision INTEGER NOT NULL CHECK (task_revision >= 1),
      created_by_command_id TEXT NOT NULL UNIQUE, last_command_id TEXT NOT NULL, creation_content_sha256 TEXT NOT NULL,
      creation_content_blob BLOB NOT NULL, updated_at_utc TEXT NOT NULL, previous_task_state_sha256 TEXT, task_record_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_events (
      task_event_id TEXT PRIMARY KEY, event_sequence INTEGER NOT NULL UNIQUE CHECK (event_sequence >= 1), command_id TEXT NOT NULL UNIQUE,
      task_id TEXT NOT NULL, event_type TEXT NOT NULL, source_lifecycle_status TEXT, target_lifecycle_status TEXT NOT NULL,
      source_priority INTEGER, target_priority INTEGER NOT NULL, source_task_record_sha256 TEXT, target_task_record_sha256 TEXT NOT NULL,
      occurred_at_utc TEXT NOT NULL, previous_event_record_sha256 TEXT, event_record_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_command_receipts (
      command_id TEXT PRIMARY KEY, command_sequence INTEGER NOT NULL UNIQUE CHECK (command_sequence >= 1), command_type TEXT NOT NULL,
      actor_identity TEXT NOT NULL, role TEXT NOT NULL, target_task_id TEXT, expected_registry_revision INTEGER NOT NULL,
      resulting_registry_revision INTEGER NOT NULL, idempotency_key_sha256 TEXT NOT NULL, input_sha256 TEXT NOT NULL, reason_text TEXT NOT NULL,
      validation_status TEXT NOT NULL, execution_status TEXT NOT NULL, result_terminal_id TEXT NOT NULL, failure_code TEXT, event_id TEXT,
      requested_at_utc TEXT NOT NULL, finished_at_utc TEXT NOT NULL, executor_identity TEXT NOT NULL,
      previous_command_receipt_sha256 TEXT, command_receipt_sha256 TEXT NOT NULL
    );
  `)
  verifyDatabaseSchema(database)
  const count = Number((database.prepare("SELECT COUNT(*) AS count FROM metadata").get() as { count: number }).count)
  if (count === 0) insertInitialMetadata(database)
  if (count > 1) throw new Error("ai_console_task_registry_metadata_cardinality_invalid")
  database.exec("PRAGMA user_version = 1")
  return database
}

function insertInitialMetadata(database: DatabaseSync) {
  const createdAtUtc = new Date().toISOString()
  const unsigned: Omit<AiConsoleTaskRegistryMetadata, "metadataSha256"> = {
    schemaVersion, registryIdentity, sourceBoundary: "new_ai_console_only", writerIdentity,
    storeRevision: 0, registryRevision: 0, taskCount: 0, commandCount: 0, eventCount: 0,
    createdAtUtc, updatedAtUtc: createdAtUtc, headEventRecordSha256: null, headCommandReceiptSha256: null,
  }
  const metadata = { ...unsigned, metadataSha256: sha256Text(JSON.stringify(unsigned)) }
  database.prepare("INSERT INTO metadata VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    metadata.schemaVersion, metadata.registryIdentity, metadata.sourceBoundary, metadata.writerIdentity,
    metadata.storeRevision, metadata.registryRevision, metadata.taskCount, metadata.commandCount, metadata.eventCount,
    metadata.createdAtUtc, metadata.updatedAtUtc, metadata.headEventRecordSha256, metadata.headCommandReceiptSha256, metadata.metadataSha256,
  )
}

function insertTask(database: DatabaseSync, task: AiConsoleTaskRegistryTaskRecord, contentBlob: Uint8Array) {
  database.prepare(`INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    task.taskId, task.taskSequence, task.queueItemId, task.taskGoal, task.taskGoalSha256, task.capabilityDomain,
    task.priority, task.lifecycleStatus, task.queuedAtUtc, task.cancelledAtUtc, task.taskRevision,
    task.createdByCommandId, task.lastCommandId, task.creationContentSha256, contentBlob, task.updatedAtUtc,
    task.previousTaskStateSha256, task.taskRecordSha256,
  )
}

function updateTask(database: DatabaseSync, task: AiConsoleTaskRegistryTaskRecord) {
  const result = database.prepare(`UPDATE tasks SET priority = ?, lifecycle_status = ?, cancelled_at_utc = ?, task_revision = ?,
    last_command_id = ?, updated_at_utc = ?, previous_task_state_sha256 = ?, task_record_sha256 = ? WHERE task_id = ? AND task_revision = ?`).run(
    task.priority, task.lifecycleStatus, task.cancelledAtUtc, task.taskRevision, task.lastCommandId, task.updatedAtUtc,
    task.previousTaskStateSha256, task.taskRecordSha256, task.taskId, task.taskRevision - 1,
  )
  if (Number(result.changes) !== 1) throw new Error("ai_console_task_record_revision_conflict")
}

function insertEvent(database: DatabaseSync, event: AiConsoleTaskRegistryEventRecord) {
  database.prepare("INSERT INTO task_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    event.taskEventId, event.eventSequence, event.commandId, event.taskId, event.eventType,
    event.sourceLifecycleStatus, event.targetLifecycleStatus, event.sourcePriority, event.targetPriority,
    event.sourceTaskRecordSha256, event.targetTaskRecordSha256, event.occurredAtUtc,
    event.previousEventRecordSha256, event.eventRecordSha256,
  )
}

function insertReceipt(database: DatabaseSync, receipt: AiConsoleTaskRegistryCommandReceipt) {
  database.prepare("INSERT INTO task_command_receipts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    receipt.commandId, receipt.commandSequence, receipt.commandType, receipt.actorIdentity, receipt.role, receipt.targetTaskId,
    receipt.expectedRegistryRevision, receipt.resultingRegistryRevision, receipt.idempotencyKeySha256, receipt.inputSha256,
    receipt.reasonText, receipt.validationStatus, receipt.executionStatus, receipt.resultTerminalId, receipt.failureCode,
    receipt.eventId, receipt.requestedAtUtc, receipt.finishedAtUtc, receipt.executorIdentity,
    receipt.previousCommandReceiptSha256, receipt.commandReceiptSha256,
  )
}

function updateMetadata(database: DatabaseSync, metadata: AiConsoleTaskRegistryMetadata, receipt: AiConsoleTaskRegistryCommandReceipt, event: AiConsoleTaskRegistryEventRecord | null, taskCreated: boolean) {
  const unsigned: Omit<AiConsoleTaskRegistryMetadata, "metadataSha256"> = {
    schemaVersion, registryIdentity, sourceBoundary: "new_ai_console_only", writerIdentity,
    storeRevision: metadata.storeRevision + 1,
    registryRevision: receipt.resultingRegistryRevision,
    taskCount: metadata.taskCount + (taskCreated ? 1 : 0),
    commandCount: metadata.commandCount + 1,
    eventCount: metadata.eventCount + (event ? 1 : 0),
    createdAtUtc: metadata.createdAtUtc,
    updatedAtUtc: receipt.finishedAtUtc,
    headEventRecordSha256: event?.eventRecordSha256 ?? metadata.headEventRecordSha256,
    headCommandReceiptSha256: receipt.commandReceiptSha256,
  }
  const metadataSha256 = sha256Text(JSON.stringify(unsigned))
  const result = database.prepare(`UPDATE metadata SET store_revision = ?, registry_revision = ?, task_count = ?, command_count = ?,
    event_count = ?, updated_at_utc = ?, head_event_record_sha256 = ?, head_command_receipt_sha256 = ?, metadata_sha256 = ?
    WHERE singleton = 1 AND store_revision = ?`).run(
    unsigned.storeRevision, unsigned.registryRevision, unsigned.taskCount, unsigned.commandCount, unsigned.eventCount,
    unsigned.updatedAtUtc, unsigned.headEventRecordSha256, unsigned.headCommandReceiptSha256, metadataSha256, metadata.storeRevision,
  )
  if (Number(result.changes) !== 1) throw new Error("ai_console_task_registry_metadata_revision_conflict")
}

function readAndVerifyMetadata(database: DatabaseSync): AiConsoleTaskRegistryMetadata {
  const rows = database.prepare("SELECT * FROM metadata").all()
  if (rows.length !== 1) throw new Error("ai_console_task_registry_metadata_cardinality_invalid")
  const row = rows[0] as Record<string, unknown>
  const metadata: AiConsoleTaskRegistryMetadata = {
    schemaVersion: String(row.schema_version) as typeof schemaVersion,
    registryIdentity: String(row.registry_identity) as typeof registryIdentity,
    sourceBoundary: String(row.source_boundary) as "new_ai_console_only",
    writerIdentity: String(row.writer_identity) as typeof writerIdentity,
    storeRevision: Number(row.store_revision), registryRevision: Number(row.registry_revision), taskCount: Number(row.task_count),
    commandCount: Number(row.command_count), eventCount: Number(row.event_count), createdAtUtc: String(row.created_at_utc),
    updatedAtUtc: String(row.updated_at_utc), headEventRecordSha256: row.head_event_record_sha256 === null ? null : String(row.head_event_record_sha256),
    headCommandReceiptSha256: row.head_command_receipt_sha256 === null ? null : String(row.head_command_receipt_sha256),
    metadataSha256: String(row.metadata_sha256),
  }
  if (metadata.schemaVersion !== schemaVersion || metadata.registryIdentity !== registryIdentity || metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== writerIdentity) throw new Error("ai_console_task_registry_metadata_identity_invalid")
  for (const value of [metadata.storeRevision, metadata.registryRevision, metadata.taskCount, metadata.commandCount, metadata.eventCount]) if (!Number.isInteger(value) || value < 0) throw new Error("ai_console_task_registry_metadata_revision_invalid")
  if (metadata.storeRevision !== metadata.commandCount || metadata.registryRevision !== metadata.eventCount) throw new Error("ai_console_task_registry_metadata_count_relation_invalid")
  if (!isUtcTimestamp(metadata.createdAtUtc) || !isUtcTimestamp(metadata.updatedAtUtc)) throw new Error("ai_console_task_registry_metadata_time_invalid")
  if (metadata.headEventRecordSha256 !== null && !isSha256(metadata.headEventRecordSha256)) throw new Error("ai_console_task_registry_metadata_event_head_invalid")
  if (metadata.headCommandReceiptSha256 !== null && !isSha256(metadata.headCommandReceiptSha256)) throw new Error("ai_console_task_registry_metadata_receipt_head_invalid")
  const { metadataSha256, ...unsigned } = metadata
  if (!isSha256(metadataSha256) || sha256Text(JSON.stringify(unsigned)) !== metadataSha256) throw new Error("ai_console_task_registry_metadata_sha256_mismatch")
  return metadata
}

function verifyStoreRecords(metadata: AiConsoleTaskRegistryMetadata, tasks: readonly StoredTaskRecord[], events: readonly AiConsoleTaskRegistryEventRecord[], receipts: readonly AiConsoleTaskRegistryCommandReceipt[]) {
  if (tasks.length !== metadata.taskCount || events.length !== metadata.eventCount || receipts.length !== metadata.commandCount) throw new Error("ai_console_task_registry_record_count_mismatch")
  let previousReceipt: string | null = null
  receipts.forEach((receipt, index) => { verifyReceipt(receipt, index + 1, previousReceipt); previousReceipt = receipt.commandReceiptSha256 })
  if (previousReceipt !== metadata.headCommandReceiptSha256) throw new Error("ai_console_task_registry_receipt_head_mismatch")
  let previousEvent: string | null = null
  events.forEach((event, index) => { verifyEvent(event, index + 1, previousEvent); previousEvent = event.eventRecordSha256 })
  if (previousEvent !== metadata.headEventRecordSha256) throw new Error("ai_console_task_registry_event_head_mismatch")
  tasks.forEach((task, index) => verifyTask(task, index + 1))
  for (const event of events) {
    const receipt = receipts.find((candidate) => candidate.commandId === event.commandId)
    if (!receipt || receipt.eventId !== event.taskEventId || receipt.executionStatus !== "succeeded") throw new Error("ai_console_task_registry_event_receipt_binding_invalid")
  }
  for (const task of tasks) {
    const taskEvents = events.filter((event) => event.taskId === task.taskId)
    const latest = taskEvents.at(-1)
    if (!latest || latest.targetTaskRecordSha256 !== task.taskRecordSha256 || latest.commandId !== task.lastCommandId || task.taskRevision !== taskEvents.length) throw new Error("ai_console_task_registry_task_event_binding_invalid")
  }
}

function verifyTask(task: StoredTaskRecord, expectedSequence: number) {
  if (task.schemaVersion !== "ai_console_task_registry_task_v1" || task.registryIdentity !== registryIdentity || task.taskSequence !== expectedSequence) throw new Error("ai_console_task_registry_task_identity_invalid")
  if (!isSha256(task.taskId) || !isSha256(task.queueItemId) || !isSha256(task.createdByCommandId) || !isSha256(task.lastCommandId)) throw new Error("ai_console_task_registry_task_binding_invalid")
  if (!capabilityDomains.includes(task.capabilityDomain) || !["queued", "cancelled"].includes(task.lifecycleStatus)) throw new Error("ai_console_task_registry_task_enum_invalid")
  if (!isBoundedText(task.taskGoal, 4, 2000) || task.taskGoalSha256 !== sha256Text(task.taskGoal)) throw new Error("ai_console_task_registry_task_goal_invalid")
  validatePriority(task.priority)
  if (!Number.isInteger(task.taskRevision) || task.taskRevision < 1 || !isUtcTimestamp(task.queuedAtUtc) || !isUtcTimestamp(task.updatedAtUtc)) throw new Error("ai_console_task_registry_task_revision_invalid")
  if ((task.lifecycleStatus === "cancelled") !== (task.cancelledAtUtc !== null) || (task.cancelledAtUtc && !isUtcTimestamp(task.cancelledAtUtc))) throw new Error("ai_console_task_registry_task_terminal_invalid")
  if (task.previousTaskStateSha256 !== null && !isSha256(task.previousTaskStateSha256)) throw new Error("ai_console_task_registry_task_previous_invalid")
  const creationText = Buffer.from(task.creationContentBlob).toString("utf8")
  if (sha256Text(creationText) !== task.creationContentSha256 || task.taskId !== sha256Text(`ai_console_registered_task_v1\n${task.creationContentSha256}`)) throw new Error("ai_console_task_registry_task_content_invalid")
  const { taskRecordSha256, creationContentBlob: _blob, ...unsigned } = task
  void _blob
  if (!isSha256(taskRecordSha256) || sha256Text(JSON.stringify(unsigned)) !== taskRecordSha256) throw new Error("ai_console_task_registry_task_record_sha256_mismatch")
}

function verifyEvent(event: AiConsoleTaskRegistryEventRecord, expectedSequence: number, expectedPrevious: string | null) {
  if (event.schemaVersion !== "ai_console_task_registry_event_v1" || event.registryIdentity !== registryIdentity || event.eventSequence !== expectedSequence || event.previousEventRecordSha256 !== expectedPrevious) throw new Error("ai_console_task_registry_event_chain_invalid")
  if (event.taskEventId !== sha256Text(`ai_console_task_registry_event_v1\n${event.commandId}`) || !isSha256(event.taskId) || !isSha256(event.targetTaskRecordSha256)) throw new Error("ai_console_task_registry_event_identity_invalid")
  if (!["task_registered", "task_priority_updated", "task_cancelled"].includes(event.eventType) || !isUtcTimestamp(event.occurredAtUtc)) throw new Error("ai_console_task_registry_event_value_invalid")
  const { eventRecordSha256, ...unsigned } = event
  if (!isSha256(eventRecordSha256) || sha256Text(JSON.stringify(unsigned)) !== eventRecordSha256) throw new Error("ai_console_task_registry_event_sha256_mismatch")
}

function verifyReceipt(receipt: AiConsoleTaskRegistryCommandReceipt, expectedSequence: number, expectedPrevious: string | null) {
  if (receipt.schemaVersion !== "ai_console_task_registry_command_receipt_v1" || receipt.registryIdentity !== registryIdentity || receipt.commandSequence !== expectedSequence || receipt.previousCommandReceiptSha256 !== expectedPrevious) throw new Error("ai_console_task_command_receipt_chain_invalid")
  if (!commandTypes.includes(receipt.commandType) || receipt.actorIdentity !== "local_console_operator" || receipt.role !== "operator" || receipt.executorIdentity !== executorIdentity) throw new Error("ai_console_task_command_receipt_identity_invalid")
  if (!isSha256(receipt.commandId) || !isSha256(receipt.idempotencyKeySha256) || !isSha256(receipt.inputSha256) || (receipt.targetTaskId !== null && !isSha256(receipt.targetTaskId))) throw new Error("ai_console_task_command_receipt_binding_invalid")
  if (!Number.isInteger(receipt.expectedRegistryRevision) || !Number.isInteger(receipt.resultingRegistryRevision) || receipt.expectedRegistryRevision < 0 || receipt.resultingRegistryRevision < 0) throw new Error("ai_console_task_command_receipt_revision_invalid")
  if (!isUtcTimestamp(receipt.requestedAtUtc) || !isUtcTimestamp(receipt.finishedAtUtc) || !isBoundedText(receipt.reasonText, 4, 240)) throw new Error("ai_console_task_command_receipt_value_invalid")
  if (receipt.executionStatus === "succeeded") {
    if (receipt.validationStatus !== "accepted" || receipt.failureCode !== null || receipt.eventId === null || !isSha256(receipt.eventId)) throw new Error("ai_console_task_command_receipt_success_invalid")
  } else if (receipt.validationStatus !== "rejected" || !receipt.failureCode || receipt.eventId !== null) throw new Error("ai_console_task_command_receipt_rejection_invalid")
  const { commandReceiptSha256, ...unsigned } = receipt
  if (!isSha256(commandReceiptSha256) || sha256Text(JSON.stringify(unsigned)) !== commandReceiptSha256) throw new Error("ai_console_task_command_receipt_sha256_mismatch")
}

function taskFromRow(value: unknown): StoredTaskRecord {
  const row = value as Record<string, unknown>
  if (!(row.creation_content_blob instanceof Uint8Array)) throw new Error("ai_console_task_registry_creation_blob_invalid")
  return {
    schemaVersion: "ai_console_task_registry_task_v1", registryIdentity, taskId: String(row.task_id), taskSequence: Number(row.task_sequence),
    queueItemId: String(row.queue_item_id), taskGoal: String(row.task_goal), taskGoalSha256: String(row.task_goal_sha256),
    capabilityDomain: String(row.capability_domain) as AiConsoleTaskRegistryCapabilityDomain, priority: Number(row.priority),
    lifecycleStatus: String(row.lifecycle_status) as "queued" | "cancelled", queuedAtUtc: String(row.queued_at_utc),
    cancelledAtUtc: row.cancelled_at_utc === null ? null : String(row.cancelled_at_utc), taskRevision: Number(row.task_revision),
    createdByCommandId: String(row.created_by_command_id), lastCommandId: String(row.last_command_id), creationContentSha256: String(row.creation_content_sha256),
    updatedAtUtc: String(row.updated_at_utc), integrityStatus: "verified", previousTaskStateSha256: row.previous_task_state_sha256 === null ? null : String(row.previous_task_state_sha256),
    taskRecordSha256: String(row.task_record_sha256), creationContentBlob: row.creation_content_blob,
  }
}

function eventFromRow(value: unknown): AiConsoleTaskRegistryEventRecord {
  const row = value as Record<string, unknown>
  return {
    schemaVersion: "ai_console_task_registry_event_v1", registryIdentity, taskEventId: String(row.task_event_id), eventSequence: Number(row.event_sequence),
    commandId: String(row.command_id), taskId: String(row.task_id), eventType: String(row.event_type) as AiConsoleTaskRegistryEventRecord["eventType"],
    sourceLifecycleStatus: row.source_lifecycle_status === null ? null : String(row.source_lifecycle_status) as "queued", targetLifecycleStatus: String(row.target_lifecycle_status) as "queued" | "cancelled",
    sourcePriority: row.source_priority === null ? null : Number(row.source_priority), targetPriority: Number(row.target_priority),
    sourceTaskRecordSha256: row.source_task_record_sha256 === null ? null : String(row.source_task_record_sha256), targetTaskRecordSha256: String(row.target_task_record_sha256),
    occurredAtUtc: String(row.occurred_at_utc), previousEventRecordSha256: row.previous_event_record_sha256 === null ? null : String(row.previous_event_record_sha256), eventRecordSha256: String(row.event_record_sha256),
  }
}

function receiptFromRow(value: unknown): AiConsoleTaskRegistryCommandReceipt {
  const row = value as Record<string, unknown>
  return {
    schemaVersion: "ai_console_task_registry_command_receipt_v1", registryIdentity, commandId: String(row.command_id), commandSequence: Number(row.command_sequence),
    commandType: String(row.command_type) as AiConsoleTaskRegistryCommandType, actorIdentity: String(row.actor_identity) as "local_console_operator", role: String(row.role) as "operator",
    targetTaskId: row.target_task_id === null ? null : String(row.target_task_id), expectedRegistryRevision: Number(row.expected_registry_revision), resultingRegistryRevision: Number(row.resulting_registry_revision),
    idempotencyKeySha256: String(row.idempotency_key_sha256), inputSha256: String(row.input_sha256), reasonText: String(row.reason_text),
    validationStatus: String(row.validation_status) as "accepted" | "rejected", executionStatus: String(row.execution_status) as "succeeded" | "rejected",
    resultTerminalId: String(row.result_terminal_id) as AiConsoleTaskRegistryCommandReceipt["resultTerminalId"], failureCode: row.failure_code === null ? null : String(row.failure_code),
    eventId: row.event_id === null ? null : String(row.event_id), requestedAtUtc: String(row.requested_at_utc), finishedAtUtc: String(row.finished_at_utc),
    executorIdentity: String(row.executor_identity) as typeof executorIdentity, previousCommandReceiptSha256: row.previous_command_receipt_sha256 === null ? null : String(row.previous_command_receipt_sha256), commandReceiptSha256: String(row.command_receipt_sha256),
  }
}

function readTaskById(database: DatabaseSync, taskId: string): AiConsoleTaskRegistryTaskRecord | null {
  const row = database.prepare(`${taskSelectSql} WHERE task_id = ?`).get(taskId)
  return row ? stripCreationContentBlob(taskFromRow(row)) : null
}

function readEventById(database: DatabaseSync, eventId: string): AiConsoleTaskRegistryEventRecord | null {
  const row = database.prepare(`${eventSelectSql} WHERE task_event_id = ?`).get(eventId)
  return row ? eventFromRow(row) : null
}

function stripCreationContentBlob(task: StoredTaskRecord): AiConsoleTaskRegistryTaskRecord {
  const { creationContentBlob: _blob, ...record } = task
  void _blob
  return record
}

function verifyDatabaseSchema(database: DatabaseSync) {
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(tables) !== JSON.stringify(["metadata", "task_command_receipts", "task_events", "tasks"])) throw new Error("ai_console_task_registry_table_set_invalid")
  verifyColumnSet(database, "metadata", ["singleton", "schema_version", "registry_identity", "source_boundary", "writer_identity", "store_revision", "registry_revision", "task_count", "command_count", "event_count", "created_at_utc", "updated_at_utc", "head_event_record_sha256", "head_command_receipt_sha256", "metadata_sha256"])
  verifyColumnSet(database, "tasks", ["task_id", "task_sequence", "queue_item_id", "task_goal", "task_goal_sha256", "capability_domain", "priority", "lifecycle_status", "queued_at_utc", "cancelled_at_utc", "task_revision", "created_by_command_id", "last_command_id", "creation_content_sha256", "creation_content_blob", "updated_at_utc", "previous_task_state_sha256", "task_record_sha256"])
  verifyColumnSet(database, "task_events", ["task_event_id", "event_sequence", "command_id", "task_id", "event_type", "source_lifecycle_status", "target_lifecycle_status", "source_priority", "target_priority", "source_task_record_sha256", "target_task_record_sha256", "occurred_at_utc", "previous_event_record_sha256", "event_record_sha256"])
  verifyColumnSet(database, "task_command_receipts", ["command_id", "command_sequence", "command_type", "actor_identity", "role", "target_task_id", "expected_registry_revision", "resulting_registry_revision", "idempotency_key_sha256", "input_sha256", "reason_text", "validation_status", "execution_status", "result_terminal_id", "failure_code", "event_id", "requested_at_utc", "finished_at_utc", "executor_identity", "previous_command_receipt_sha256", "command_receipt_sha256"])
}

function verifyColumnSet(database: DatabaseSync, tableName: string, expected: readonly string[]) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(columns) !== JSON.stringify(expected)) throw new Error(`ai_console_task_registry_column_set_invalid:${tableName}`)
}

function verifyDatabaseIntegrity(database: DatabaseSync) {
  const result = database.prepare("PRAGMA integrity_check").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes("ok")) throw new Error("ai_console_task_registry_sqlite_integrity_failure")
}

function verifyDatabaseVersion(database: DatabaseSync) {
  const result = database.prepare("PRAGMA user_version").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes(1)) throw new Error("ai_console_task_registry_sqlite_version_invalid")
}

function getStorePath(): string { return path.join(process.cwd(), ...taskRegistryStoreLogicalPath.split("/")) }
function sha256Text(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex") }
function isSha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function isUtcTimestamp(value: unknown): value is string { return typeof value === "string" && value.endsWith("Z") && !Number.isNaN(Date.parse(value)) }
function isBoundedText(value: unknown, minimum: number, maximum: number): value is string { return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }

const taskSelectSql = `SELECT task_id, task_sequence, queue_item_id, task_goal, task_goal_sha256, capability_domain, priority,
  lifecycle_status, queued_at_utc, cancelled_at_utc, task_revision, created_by_command_id, last_command_id,
  creation_content_sha256, creation_content_blob, updated_at_utc, previous_task_state_sha256, task_record_sha256 FROM tasks`
const eventSelectSql = `SELECT task_event_id, event_sequence, command_id, task_id, event_type, source_lifecycle_status,
  target_lifecycle_status, source_priority, target_priority, source_task_record_sha256, target_task_record_sha256,
  occurred_at_utc, previous_event_record_sha256, event_record_sha256 FROM task_events`
const receiptSelectSql = `SELECT command_id, command_sequence, command_type, actor_identity, role, target_task_id,
  expected_registry_revision, resulting_registry_revision, idempotency_key_sha256, input_sha256, reason_text,
  validation_status, execution_status, result_terminal_id, failure_code, event_id, requested_at_utc, finished_at_utc,
  executor_identity, previous_command_receipt_sha256, command_receipt_sha256 FROM task_command_receipts`
