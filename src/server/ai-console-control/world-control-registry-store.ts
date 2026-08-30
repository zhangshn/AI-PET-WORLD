import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import {
  readAiConsoleRuntimeReleaseRegistryStore,
  type AiConsoleRuntimeFramePublicationRecord,
} from "./runtime-release-registry-store"

export const worldControlRegistryStoreLogicalPath = ".runtime/ai-console/runtime/world-control-registry-v1.sqlite"
const schemaVersion = "ai_console_world_control_registry_store_v1"
const registryIdentity = "ai_console_world_control_registry"
const writerIdentity = "ai_console_world_control_registry_writer_v1"
const executorIdentity = "ai_console_world_control_executor_v1"
const commandTypes = [
  "consume_registered_runtime_frame",
  "pause_frame_publish",
  "resume_frame_publish",
  "rollback_runtime_frame",
  "freeze_visual_updates",
] as const

export type AiConsoleWorldControlCommandType = (typeof commandTypes)[number]

type CommandBase = {
  commandType: AiConsoleWorldControlCommandType
  expectedRegistryRevision: number
  expectedWorldRevision: number
  idempotencyKeySha256: string
  reasonText: string
  actorIdentity: "local_console_operator"
  role: "operator"
  requestedAtUtc: string
}

export type AiConsoleWorldControlCommandInput =
  | (CommandBase & { commandType: "consume_registered_runtime_frame"; runtimeFrameIdentity: string })
  | (CommandBase & { commandType: "pause_frame_publish"; worldId: string })
  | (CommandBase & { commandType: "resume_frame_publish"; worldId: string })
  | (CommandBase & { commandType: "rollback_runtime_frame"; worldId: string; targetRuntimeFrameIdentity: string })
  | (CommandBase & { commandType: "freeze_visual_updates"; worldId: string })

export type AiConsoleWorldControlStateRecord = {
  schemaVersion: "ai_console_world_control_state_v1"
  registryIdentity: typeof registryIdentity
  worldStateRevisionId: string
  stateSequence: number
  worldId: string
  worldRevision: number
  activeRuntimeFrameIdentity: string
  activePublishIdentity: string
  activePublicationRecordSha256: string
  activeFrameTick: number
  consumptionStatus: "consumed"
  publishControlStatus: "publishing" | "paused"
  visualUpdateStatus: "enabled" | "frozen"
  transitionType: AiConsoleWorldControlCommandType
  sourceWorldStateRevisionId: string | null
  rollbackFromRuntimeFrameIdentity: string | null
  rollbackTargetRuntimeFrameIdentity: string | null
  commandId: string
  recordedAtUtc: string
  creationContentSha256: string
  worldStateRecordSha256: string
}

export type AiConsoleWorldControlEventRecord = {
  schemaVersion: "ai_console_world_control_event_v1"
  registryIdentity: typeof registryIdentity
  worldControlEventId: string
  eventSequence: number
  commandId: string
  eventType: AiConsoleWorldControlCommandType
  worldId: string
  sourceWorldStateRevisionId: string | null
  targetWorldStateRevisionId: string
  targetWorldRevision: number
  targetWorldStateRecordSha256: string
  occurredAtUtc: string
  previousEventRecordSha256: string | null
  eventRecordSha256: string
}

export type AiConsoleWorldControlCommandReceipt = {
  schemaVersion: "ai_console_world_control_command_receipt_v1"
  registryIdentity: typeof registryIdentity
  commandId: string
  commandSequence: number
  commandType: AiConsoleWorldControlCommandType
  actorIdentity: "local_console_operator"
  role: "operator"
  targetIdentity: string | null
  expectedRegistryRevision: number
  resultingRegistryRevision: number
  expectedWorldRevision: number
  resultingWorldRevision: number | null
  idempotencyKeySha256: string
  inputSha256: string
  reasonText: string
  validationStatus: "accepted" | "rejected"
  executionStatus: "succeeded" | "rejected"
  resultTerminalId: string
  failureCode: string | null
  eventId: string | null
  requestedAtUtc: string
  finishedAtUtc: string
  executorIdentity: typeof executorIdentity
  previousCommandReceiptSha256: string | null
  commandReceiptSha256: string
}

export type AiConsoleWorldControlMetadata = {
  schemaVersion: typeof schemaVersion
  registryIdentity: typeof registryIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof writerIdentity
  storeRevision: number
  registryRevision: number
  worldCount: number
  worldStateCount: number
  commandCount: number
  eventCount: number
  createdAtUtc: string
  updatedAtUtc: string
  headEventRecordSha256: string | null
  headCommandReceiptSha256: string | null
  metadataSha256: string
}

export type AiConsoleWorldControlCommandResult = {
  receipt: AiConsoleWorldControlCommandReceipt
  worldState: AiConsoleWorldControlStateRecord | null
  event: AiConsoleWorldControlEventRecord | null
  replayed: boolean
  httpStatus: 200 | 201 | 409
}

export type AiConsoleWorldControlRead =
  | {
      status: "connected"
      metadata: AiConsoleWorldControlMetadata
      currentWorldStates: readonly AiConsoleWorldControlStateRecord[]
      stateHistory: readonly AiConsoleWorldControlStateRecord[]
      events: readonly AiConsoleWorldControlEventRecord[]
      receipts: readonly AiConsoleWorldControlCommandReceipt[]
      evidenceReferences: readonly string[]
    }
  | { status: "not_connected" | "unknown_or_stale"; reasonCode: string; evidenceReferences: readonly string[] }

type StoredWorldState = AiConsoleWorldControlStateRecord & { creationContentBlob: Uint8Array }

export function initializeAiConsoleWorldControlRegistryStore(): AiConsoleWorldControlMetadata {
  const database = openWritableStore()
  try {
    return readAndVerifyMetadata(database)
  } finally {
    database.close()
  }
}

export function executeAiConsoleWorldControlCommand(
  input: AiConsoleWorldControlCommandInput,
): AiConsoleWorldControlCommandResult {
  validateCommandInput(input)
  const inputSha256 = sha256(JSON.stringify(normalizedCommandInput(input)))
  const commandId = sha256(`${input.actorIdentity}\n${input.commandType}\n${input.idempotencyKeySha256}`)
  const releaseStore = readAiConsoleRuntimeReleaseRegistryStore()
  if (releaseStore.status !== "connected") {
    throw new Error(`ai_console_world_control_runtime_release_source_${releaseStore.status}`)
  }

  const database = openWritableStore()
  try {
    const existingRow = database.prepare(`${receiptSelectSql} WHERE command_id = ?`).get(commandId)
    if (existingRow) {
      const receipt = receiptFromRow(existingRow)
      if (receipt.inputSha256 !== inputSha256) {
        throw new Error("ai_console_world_control_command_idempotency_conflict")
      }
      return {
        receipt,
        worldState: receipt.targetIdentity ? readStateById(database, receipt.targetIdentity) : null,
        event: receipt.eventId ? readEventById(database, receipt.eventId) : null,
        replayed: true,
        httpStatus: 200,
      }
    }

    const metadata = readAndVerifyMetadata(database)
    const finishedAtUtc = new Date().toISOString()
    let worldState: AiConsoleWorldControlStateRecord | null = null
    let event: AiConsoleWorldControlEventRecord | null = null
    let targetIdentity: string | null = null
    let resultTerminalId = "world_control_command_rejected"
    let failureCode: string | null = null
    let resultingRegistryRevision = metadata.registryRevision
    let resultingWorldRevision: number | null = null
    let creationContentBlob: Uint8Array | null = null

    if (input.expectedRegistryRevision !== metadata.registryRevision) {
      resultTerminalId = "registry_revision_conflict"
      failureCode = "ai_console_world_control_registry_revision_conflict"
    } else if (input.commandType === "consume_registered_runtime_frame") {
      const publication = releaseStore.publications.find(
        (item) => item.runtimeFrameIdentity === input.runtimeFrameIdentity,
      ) ?? null
      if (!publication || publication.runtimeFrameStatus !== "registered_formal_unconsumed") {
        targetIdentity = input.runtimeFrameIdentity
        resultTerminalId = "runtime_frame_publication_not_found"
        failureCode = "ai_console_world_control_runtime_frame_publication_not_found"
      } else {
        const current = readLatestStateForWorld(database, publication.worldId)
        const worldFailure = validateWorldRevision(current, input.expectedWorldRevision)
        if (worldFailure) {
          targetIdentity = current?.worldStateRevisionId ?? publication.worldId
          resultTerminalId = "world_revision_conflict"
          failureCode = worldFailure
        } else if (current?.publishControlStatus === "paused") {
          targetIdentity = current.worldStateRevisionId
          resultTerminalId = "frame_publish_paused"
          failureCode = "ai_console_world_control_frame_publish_paused"
        } else if (current?.visualUpdateStatus === "frozen") {
          targetIdentity = current.worldStateRevisionId
          resultTerminalId = "visual_updates_frozen"
          failureCode = "ai_console_world_control_visual_updates_frozen"
        } else if (current?.activeRuntimeFrameIdentity === publication.runtimeFrameIdentity) {
          targetIdentity = current.worldStateRevisionId
          resultTerminalId = "runtime_frame_already_consumed"
          failureCode = "ai_console_world_control_runtime_frame_already_consumed"
        } else if ((publication.previousRuntimeFrameIdentity ?? null) !== (current?.activeRuntimeFrameIdentity ?? null)) {
          targetIdentity = publication.runtimeFrameIdentity
          resultTerminalId = "runtime_frame_lineage_conflict"
          failureCode = "ai_console_world_control_runtime_frame_lineage_conflict"
        } else if (current && publication.tick <= current.activeFrameTick) {
          targetIdentity = publication.runtimeFrameIdentity
          resultTerminalId = "runtime_frame_tick_not_forward"
          failureCode = "ai_console_world_control_runtime_frame_tick_not_forward"
        } else {
          const next = createWorldState({
            metadata,
            current,
            publication,
            input,
            commandId,
            recordedAtUtc: finishedAtUtc,
            publishControlStatus: current?.publishControlStatus ?? "publishing",
            visualUpdateStatus: current?.visualUpdateStatus ?? "enabled",
          })
          worldState = next.record
          creationContentBlob = next.creationContentBlob
          resultingRegistryRevision += 1
          resultingWorldRevision = worldState.worldRevision
          targetIdentity = worldState.worldStateRevisionId
          resultTerminalId = "runtime_frame_consumed"
        }
      }
    } else {
      const current = readLatestStateForWorld(database, input.worldId)
      const worldFailure = validateWorldRevision(current, input.expectedWorldRevision)
      if (worldFailure) {
        targetIdentity = current?.worldStateRevisionId ?? input.worldId
        resultTerminalId = current ? "world_revision_conflict" : "world_state_not_found"
        failureCode = current ? worldFailure : "ai_console_world_control_world_state_not_found"
      } else if (!current) {
        targetIdentity = input.worldId
        resultTerminalId = "world_state_not_found"
        failureCode = "ai_console_world_control_world_state_not_found"
      } else if (input.commandType === "pause_frame_publish" && current.publishControlStatus === "paused") {
        targetIdentity = current.worldStateRevisionId
        resultTerminalId = "frame_publish_already_paused"
        failureCode = "ai_console_world_control_frame_publish_already_paused"
      } else if (input.commandType === "resume_frame_publish" && current.publishControlStatus !== "paused") {
        targetIdentity = current.worldStateRevisionId
        resultTerminalId = "frame_publish_not_paused"
        failureCode = "ai_console_world_control_frame_publish_not_paused"
      } else if (input.commandType === "resume_frame_publish" && current.visualUpdateStatus === "frozen") {
        targetIdentity = current.worldStateRevisionId
        resultTerminalId = "visual_updates_frozen"
        failureCode = "ai_console_world_control_visual_updates_frozen"
      } else if (input.commandType === "freeze_visual_updates" && current.visualUpdateStatus === "frozen") {
        targetIdentity = current.worldStateRevisionId
        resultTerminalId = "visual_updates_already_frozen"
        failureCode = "ai_console_world_control_visual_updates_already_frozen"
      } else {
        let publication = releaseStore.publications.find(
          (item) => item.runtimeFrameIdentity === current.activeRuntimeFrameIdentity,
        ) ?? null
        let rollbackFromRuntimeFrameIdentity: string | null = null
        let rollbackTargetRuntimeFrameIdentity: string | null = null
        let publishControlStatus = current.publishControlStatus
        let visualUpdateStatus = current.visualUpdateStatus

        if (input.commandType === "pause_frame_publish") {
          publishControlStatus = "paused"
          resultTerminalId = "frame_publish_paused"
        } else if (input.commandType === "resume_frame_publish") {
          publishControlStatus = "publishing"
          resultTerminalId = "frame_publish_resumed"
        } else if (input.commandType === "freeze_visual_updates") {
          visualUpdateStatus = "frozen"
          resultTerminalId = "visual_updates_frozen"
        } else {
          if (current.publishControlStatus !== "paused") {
            targetIdentity = current.worldStateRevisionId
            resultTerminalId = "rollback_requires_publish_pause"
            failureCode = "ai_console_world_control_rollback_requires_publish_pause"
          } else {
            const targetPublication = releaseStore.publications.find(
              (item) => item.runtimeFrameIdentity === input.targetRuntimeFrameIdentity,
            ) ?? null
            if (!targetPublication || targetPublication.worldId !== current.worldId) {
              targetIdentity = input.targetRuntimeFrameIdentity
              resultTerminalId = "rollback_target_not_found"
              failureCode = "ai_console_world_control_rollback_target_not_found"
            } else if (targetPublication.runtimeFrameIdentity === current.activeRuntimeFrameIdentity) {
              targetIdentity = current.worldStateRevisionId
              resultTerminalId = "rollback_target_is_current"
              failureCode = "ai_console_world_control_rollback_target_is_current"
            } else if (!isPublicationAncestor(
              releaseStore.publications,
              current.activeRuntimeFrameIdentity,
              targetPublication.runtimeFrameIdentity,
            )) {
              targetIdentity = targetPublication.runtimeFrameIdentity
              resultTerminalId = "rollback_target_not_in_lineage"
              failureCode = "ai_console_world_control_rollback_target_not_in_lineage"
            } else {
              rollbackFromRuntimeFrameIdentity = current.activeRuntimeFrameIdentity
              rollbackTargetRuntimeFrameIdentity = targetPublication.runtimeFrameIdentity
              publication = targetPublication
              resultTerminalId = "runtime_frame_rolled_back"
            }
          }
        }

        if (!failureCode && publication) {
          const next = createWorldState({
            metadata,
            current,
            publication,
            input,
            commandId,
            recordedAtUtc: finishedAtUtc,
            publishControlStatus,
            visualUpdateStatus,
            rollbackFromRuntimeFrameIdentity,
            rollbackTargetRuntimeFrameIdentity,
          })
          worldState = next.record
          creationContentBlob = next.creationContentBlob
          resultingRegistryRevision += 1
          resultingWorldRevision = worldState.worldRevision
          targetIdentity = worldState.worldStateRevisionId
        }
      }
    }

    if (worldState) {
      event = createEvent({
        eventSequence: metadata.eventCount + 1,
        commandId,
        eventType: input.commandType,
        worldId: worldState.worldId,
        sourceWorldStateRevisionId: worldState.sourceWorldStateRevisionId,
        targetWorldStateRevisionId: worldState.worldStateRevisionId,
        targetWorldRevision: worldState.worldRevision,
        targetWorldStateRecordSha256: worldState.worldStateRecordSha256,
        occurredAtUtc: finishedAtUtc,
        previousEventRecordSha256: metadata.headEventRecordSha256,
      })
    }

    const succeeded = worldState !== null && event !== null
    const unsignedReceipt: Omit<AiConsoleWorldControlCommandReceipt, "commandReceiptSha256"> = {
      schemaVersion: "ai_console_world_control_command_receipt_v1",
      registryIdentity,
      commandId,
      commandSequence: metadata.commandCount + 1,
      commandType: input.commandType,
      actorIdentity: "local_console_operator",
      role: "operator",
      targetIdentity,
      expectedRegistryRevision: input.expectedRegistryRevision,
      resultingRegistryRevision,
      expectedWorldRevision: input.expectedWorldRevision,
      resultingWorldRevision,
      idempotencyKeySha256: input.idempotencyKeySha256,
      inputSha256,
      reasonText: input.reasonText,
      validationStatus: succeeded ? "accepted" : "rejected",
      executionStatus: succeeded ? "succeeded" : "rejected",
      resultTerminalId,
      failureCode,
      eventId: event?.worldControlEventId ?? null,
      requestedAtUtc: input.requestedAtUtc,
      finishedAtUtc,
      executorIdentity,
      previousCommandReceiptSha256: metadata.headCommandReceiptSha256,
    }
    const receipt = {
      ...unsignedReceipt,
      commandReceiptSha256: sha256(JSON.stringify(unsignedReceipt)),
    }

    database.exec("BEGIN IMMEDIATE")
    try {
      if (worldState && event && creationContentBlob) {
        insertWorldState(database, worldState, creationContentBlob)
        insertEvent(database, event)
      }
      insertReceipt(database, receipt)
      updateMetadata(database, metadata, receipt, worldState, event)
      database.exec("COMMIT")
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }

    return {
      receipt,
      worldState,
      event,
      replayed: false,
      httpStatus: succeeded ? 201 : 409,
    }
  } finally {
    database.close()
  }
}

export function readAiConsoleWorldControlRegistryStore(): AiConsoleWorldControlRead {
  const storePath = getStorePath()
  if (!existsSync(storePath)) {
    return {
      status: "not_connected",
      reasonCode: "ai_console_world_control_registry_not_initialized",
      evidenceReferences: [worldControlRegistryStoreLogicalPath],
    }
  }

  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(storePath, { open: true, readOnly: true })
    verifyDatabase(database)
    const metadata = readAndVerifyMetadata(database)
    const states = database.prepare(`${stateSelectSql} ORDER BY state_sequence`).all().map(stateFromRow)
    const events = database.prepare(`${eventSelectSql} ORDER BY event_sequence`).all().map(eventFromRow)
    const receipts = database.prepare(`${receiptSelectSql} ORDER BY command_sequence`).all().map(receiptFromRow)
    const releaseStore = readAiConsoleRuntimeReleaseRegistryStore()
    if (releaseStore.status !== "connected") {
      throw new Error("ai_console_world_control_runtime_release_source_unavailable")
    }
    verifyRecords(metadata, states, events, receipts, releaseStore.publications)
    const currentByWorld = new Map<string, AiConsoleWorldControlStateRecord>()
    for (const state of states) currentByWorld.set(state.worldId, stripBlob(state))
    return {
      status: "connected",
      metadata,
      currentWorldStates: [...currentByWorld.values()],
      stateHistory: [...states].reverse().map(stripBlob),
      events: [...events].reverse(),
      receipts: [...receipts].reverse(),
      evidenceReferences: [
        worldControlRegistryStoreLogicalPath,
        ".runtime/ai-console/runtime/runtime-release-registry-v1.sqlite",
        "data/ai-console/schemas/ai-console-world-control-registry-v1.schema.json",
      ],
    }
  } catch (error) {
    return {
      status: "unknown_or_stale",
      reasonCode: error instanceof Error ? error.message : "ai_console_world_control_registry_read_failed",
      evidenceReferences: [worldControlRegistryStoreLogicalPath],
    }
  } finally {
    database?.close()
  }
}

function createWorldState(input: {
  metadata: AiConsoleWorldControlMetadata
  current: AiConsoleWorldControlStateRecord | null
  publication: AiConsoleRuntimeFramePublicationRecord
  input: AiConsoleWorldControlCommandInput
  commandId: string
  recordedAtUtc: string
  publishControlStatus: AiConsoleWorldControlStateRecord["publishControlStatus"]
  visualUpdateStatus: AiConsoleWorldControlStateRecord["visualUpdateStatus"]
  rollbackFromRuntimeFrameIdentity?: string | null
  rollbackTargetRuntimeFrameIdentity?: string | null
}) {
  const transitionContent = {
    worldId: input.publication.worldId,
    worldRevision: (input.current?.worldRevision ?? 0) + 1,
    activeRuntimeFrameIdentity: input.publication.runtimeFrameIdentity,
    activePublishIdentity: input.publication.publishIdentity,
    activePublicationRecordSha256: input.publication.publicationRecordSha256,
    activeFrameTick: input.publication.tick,
    consumptionStatus: "consumed" as const,
    publishControlStatus: input.publishControlStatus,
    visualUpdateStatus: input.visualUpdateStatus,
    transitionType: input.input.commandType,
    sourceWorldStateRevisionId: input.current?.worldStateRevisionId ?? null,
    rollbackFromRuntimeFrameIdentity: input.rollbackFromRuntimeFrameIdentity ?? null,
    rollbackTargetRuntimeFrameIdentity: input.rollbackTargetRuntimeFrameIdentity ?? null,
  }
  const creationContent = {
    schemaVersion: "ai_console_world_control_state_creation_v1",
    ...transitionContent,
  }
  const creationContentText = JSON.stringify(creationContent)
  const creationContentSha256 = sha256(creationContentText)
  const worldStateRevisionId = sha256(
    `ai_console_world_control_state_v1\n${input.commandId}\n${creationContentSha256}`,
  )
  const unsigned: Omit<AiConsoleWorldControlStateRecord, "worldStateRecordSha256"> = {
    schemaVersion: "ai_console_world_control_state_v1",
    registryIdentity,
    worldStateRevisionId,
    stateSequence: input.metadata.worldStateCount + 1,
    ...transitionContent,
    commandId: input.commandId,
    recordedAtUtc: input.recordedAtUtc,
    creationContentSha256,
  }
  return {
    record: {
      ...unsigned,
      worldStateRecordSha256: sha256(JSON.stringify(unsigned)),
    },
    creationContentBlob: Buffer.from(creationContentText, "utf8"),
  }
}

function createEvent(
  input: Omit<AiConsoleWorldControlEventRecord, "schemaVersion" | "registryIdentity" | "worldControlEventId" | "eventRecordSha256">,
): AiConsoleWorldControlEventRecord {
  const worldControlEventId = sha256(`ai_console_world_control_event_v1\n${input.commandId}`)
  const unsigned: Omit<AiConsoleWorldControlEventRecord, "eventRecordSha256"> = {
    schemaVersion: "ai_console_world_control_event_v1",
    registryIdentity,
    worldControlEventId,
    ...input,
  }
  return { ...unsigned, eventRecordSha256: sha256(JSON.stringify(unsigned)) }
}

function validateWorldRevision(
  current: AiConsoleWorldControlStateRecord | null,
  expectedWorldRevision: number,
): string | null {
  return (current?.worldRevision ?? 0) === expectedWorldRevision
    ? null
    : "ai_console_world_control_world_revision_conflict"
}

function isPublicationAncestor(
  publications: readonly AiConsoleRuntimeFramePublicationRecord[],
  sourceRuntimeFrameIdentity: string,
  targetRuntimeFrameIdentity: string,
): boolean {
  const byIdentity = new Map(publications.map((publication) => [publication.runtimeFrameIdentity, publication]))
  let cursor = byIdentity.get(sourceRuntimeFrameIdentity)?.previousRuntimeFrameIdentity ?? null
  const visited = new Set<string>()
  while (cursor) {
    if (cursor === targetRuntimeFrameIdentity) return true
    if (visited.has(cursor)) return false
    visited.add(cursor)
    cursor = byIdentity.get(cursor)?.previousRuntimeFrameIdentity ?? null
  }
  return false
}

function validateCommandInput(input: AiConsoleWorldControlCommandInput) {
  if (!isPlainRecord(input) || !commandTypes.includes(input.commandType)) {
    throw new Error("ai_console_world_control_command_input_invalid")
  }
  const common = [
    "commandType", "expectedRegistryRevision", "expectedWorldRevision", "idempotencyKeySha256",
    "reasonText", "actorIdentity", "role", "requestedAtUtc",
  ]
  const specific = input.commandType === "consume_registered_runtime_frame"
    ? ["runtimeFrameIdentity"]
    : input.commandType === "rollback_runtime_frame"
      ? ["worldId", "targetRuntimeFrameIdentity"]
      : ["worldId"]
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify([...common, ...specific].sort())) {
    throw new Error("ai_console_world_control_command_field_set_invalid")
  }
  if (!Number.isInteger(input.expectedRegistryRevision) || input.expectedRegistryRevision < 0
    || !Number.isInteger(input.expectedWorldRevision) || input.expectedWorldRevision < 0
    || !isSha256(input.idempotencyKeySha256) || !isText(input.reasonText, 4, 240)
    || input.actorIdentity !== "local_console_operator" || input.role !== "operator" || !isUtc(input.requestedAtUtc)) {
    throw new Error("ai_console_world_control_command_common_field_invalid")
  }
  if (input.commandType === "consume_registered_runtime_frame" && !isSha256(input.runtimeFrameIdentity)) {
    throw new Error("ai_console_world_control_runtime_frame_identity_invalid")
  }
  if (input.commandType !== "consume_registered_runtime_frame" && !isIdentity(input.worldId)) {
    throw new Error("ai_console_world_control_world_identity_invalid")
  }
  if (input.commandType === "rollback_runtime_frame" && !isSha256(input.targetRuntimeFrameIdentity)) {
    throw new Error("ai_console_world_control_rollback_target_invalid")
  }
}

function normalizedCommandInput(input: AiConsoleWorldControlCommandInput) {
  const {
    actorIdentity: _actorIdentity,
    role: _role,
    requestedAtUtc: _requestedAtUtc,
    idempotencyKeySha256: _idempotencyKeySha256,
    ...rest
  } = input
  void _actorIdentity
  void _role
  void _requestedAtUtc
  void _idempotencyKeySha256
  return rest
}

function openWritableStore() {
  const storePath = getStorePath()
  mkdirSync(path.dirname(storePath), { recursive: true })
  const database = new DatabaseSync(storePath)
  database.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;")
  database.exec(`
CREATE TABLE IF NOT EXISTS metadata (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1), schema_version TEXT NOT NULL, registry_identity TEXT NOT NULL,
  source_boundary TEXT NOT NULL, writer_identity TEXT NOT NULL, store_revision INTEGER NOT NULL,
  registry_revision INTEGER NOT NULL, world_count INTEGER NOT NULL, world_state_count INTEGER NOT NULL,
  command_count INTEGER NOT NULL, event_count INTEGER NOT NULL, created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL, head_event_record_sha256 TEXT, head_command_receipt_sha256 TEXT,
  metadata_sha256 TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS world_state_revisions (
  world_state_revision_id TEXT PRIMARY KEY, state_sequence INTEGER NOT NULL UNIQUE, world_id TEXT NOT NULL,
  world_revision INTEGER NOT NULL, active_runtime_frame_identity TEXT NOT NULL, active_publish_identity TEXT NOT NULL,
  active_publication_record_sha256 TEXT NOT NULL, active_frame_tick INTEGER NOT NULL, consumption_status TEXT NOT NULL,
  publish_control_status TEXT NOT NULL, visual_update_status TEXT NOT NULL, transition_type TEXT NOT NULL,
  source_world_state_revision_id TEXT, rollback_from_runtime_frame_identity TEXT,
  rollback_target_runtime_frame_identity TEXT, command_id TEXT NOT NULL UNIQUE, recorded_at_utc TEXT NOT NULL,
  creation_content_sha256 TEXT NOT NULL, creation_content_blob BLOB NOT NULL, world_state_record_sha256 TEXT NOT NULL,
  UNIQUE(world_id, world_revision),
  FOREIGN KEY(source_world_state_revision_id) REFERENCES world_state_revisions(world_state_revision_id)
);
CREATE TABLE IF NOT EXISTS world_control_events (
  world_control_event_id TEXT PRIMARY KEY, event_sequence INTEGER NOT NULL UNIQUE, command_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL, world_id TEXT NOT NULL, source_world_state_revision_id TEXT,
  target_world_state_revision_id TEXT NOT NULL, target_world_revision INTEGER NOT NULL,
  target_world_state_record_sha256 TEXT NOT NULL, occurred_at_utc TEXT NOT NULL,
  previous_event_record_sha256 TEXT, event_record_sha256 TEXT NOT NULL,
  FOREIGN KEY(target_world_state_revision_id) REFERENCES world_state_revisions(world_state_revision_id)
);
CREATE TABLE IF NOT EXISTS command_receipts (
  command_id TEXT PRIMARY KEY, command_sequence INTEGER NOT NULL UNIQUE, command_type TEXT NOT NULL,
  actor_identity TEXT NOT NULL, role TEXT NOT NULL, target_identity TEXT, expected_registry_revision INTEGER NOT NULL,
  resulting_registry_revision INTEGER NOT NULL, expected_world_revision INTEGER NOT NULL,
  resulting_world_revision INTEGER, idempotency_key_sha256 TEXT NOT NULL, input_sha256 TEXT NOT NULL,
  reason_text TEXT NOT NULL, validation_status TEXT NOT NULL, execution_status TEXT NOT NULL,
  result_terminal_id TEXT NOT NULL, failure_code TEXT, event_id TEXT, requested_at_utc TEXT NOT NULL,
  finished_at_utc TEXT NOT NULL, executor_identity TEXT NOT NULL, previous_command_receipt_sha256 TEXT,
  command_receipt_sha256 TEXT NOT NULL
);`)
  const count = Number((database.prepare("SELECT COUNT(*) count FROM metadata").get() as { count: number }).count)
  if (count === 0) insertInitialMetadata(database)
  if (count > 1) throw new Error("ai_console_world_control_metadata_cardinality_invalid")
  database.exec("PRAGMA user_version=1")
  verifyDatabase(database)
  return database
}

function insertInitialMetadata(database: DatabaseSync) {
  const createdAtUtc = new Date().toISOString()
  const unsigned: Omit<AiConsoleWorldControlMetadata, "metadataSha256"> = {
    schemaVersion,
    registryIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    storeRevision: 0,
    registryRevision: 0,
    worldCount: 0,
    worldStateCount: 0,
    commandCount: 0,
    eventCount: 0,
    createdAtUtc,
    updatedAtUtc: createdAtUtc,
    headEventRecordSha256: null,
    headCommandReceiptSha256: null,
  }
  const metadata = { ...unsigned, metadataSha256: sha256(JSON.stringify(unsigned)) }
  database.prepare("INSERT INTO metadata VALUES(1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    metadata.schemaVersion, metadata.registryIdentity, metadata.sourceBoundary, metadata.writerIdentity,
    metadata.storeRevision, metadata.registryRevision, metadata.worldCount, metadata.worldStateCount,
    metadata.commandCount, metadata.eventCount, metadata.createdAtUtc, metadata.updatedAtUtc,
    metadata.headEventRecordSha256, metadata.headCommandReceiptSha256, metadata.metadataSha256,
  )
}

function insertWorldState(database: DatabaseSync, record: AiConsoleWorldControlStateRecord, blob: Uint8Array) {
  database.prepare("INSERT INTO world_state_revisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    record.worldStateRevisionId, record.stateSequence, record.worldId, record.worldRevision,
    record.activeRuntimeFrameIdentity, record.activePublishIdentity, record.activePublicationRecordSha256,
    record.activeFrameTick, record.consumptionStatus, record.publishControlStatus, record.visualUpdateStatus,
    record.transitionType, record.sourceWorldStateRevisionId, record.rollbackFromRuntimeFrameIdentity,
    record.rollbackTargetRuntimeFrameIdentity, record.commandId, record.recordedAtUtc,
    record.creationContentSha256, blob, record.worldStateRecordSha256,
  )
}

function insertEvent(database: DatabaseSync, event: AiConsoleWorldControlEventRecord) {
  database.prepare("INSERT INTO world_control_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(
    event.worldControlEventId, event.eventSequence, event.commandId, event.eventType, event.worldId,
    event.sourceWorldStateRevisionId, event.targetWorldStateRevisionId, event.targetWorldRevision,
    event.targetWorldStateRecordSha256, event.occurredAtUtc, event.previousEventRecordSha256,
    event.eventRecordSha256,
  )
}

function insertReceipt(database: DatabaseSync, receipt: AiConsoleWorldControlCommandReceipt) {
  database.prepare("INSERT INTO command_receipts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    receipt.commandId, receipt.commandSequence, receipt.commandType, receipt.actorIdentity, receipt.role,
    receipt.targetIdentity, receipt.expectedRegistryRevision, receipt.resultingRegistryRevision,
    receipt.expectedWorldRevision, receipt.resultingWorldRevision, receipt.idempotencyKeySha256,
    receipt.inputSha256, receipt.reasonText, receipt.validationStatus, receipt.executionStatus,
    receipt.resultTerminalId, receipt.failureCode, receipt.eventId, receipt.requestedAtUtc, receipt.finishedAtUtc,
    receipt.executorIdentity, receipt.previousCommandReceiptSha256, receipt.commandReceiptSha256,
  )
}

function updateMetadata(
  database: DatabaseSync,
  metadata: AiConsoleWorldControlMetadata,
  receipt: AiConsoleWorldControlCommandReceipt,
  worldState: AiConsoleWorldControlStateRecord | null,
  event: AiConsoleWorldControlEventRecord | null,
) {
  const isFirstWorldState = worldState?.worldRevision === 1
  const unsigned: Omit<AiConsoleWorldControlMetadata, "metadataSha256"> = {
    schemaVersion,
    registryIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    storeRevision: metadata.storeRevision + 1,
    registryRevision: receipt.resultingRegistryRevision,
    worldCount: metadata.worldCount + (isFirstWorldState ? 1 : 0),
    worldStateCount: metadata.worldStateCount + (worldState ? 1 : 0),
    commandCount: metadata.commandCount + 1,
    eventCount: metadata.eventCount + (event ? 1 : 0),
    createdAtUtc: metadata.createdAtUtc,
    updatedAtUtc: receipt.finishedAtUtc,
    headEventRecordSha256: event?.eventRecordSha256 ?? metadata.headEventRecordSha256,
    headCommandReceiptSha256: receipt.commandReceiptSha256,
  }
  const next = { ...unsigned, metadataSha256: sha256(JSON.stringify(unsigned)) }
  database.prepare(`UPDATE metadata SET
    store_revision=?, registry_revision=?, world_count=?, world_state_count=?, command_count=?, event_count=?,
    updated_at_utc=?, head_event_record_sha256=?, head_command_receipt_sha256=?, metadata_sha256=? WHERE singleton=1`).run(
    next.storeRevision, next.registryRevision, next.worldCount, next.worldStateCount, next.commandCount,
    next.eventCount, next.updatedAtUtc, next.headEventRecordSha256, next.headCommandReceiptSha256,
    next.metadataSha256,
  )
}

const stateSelectSql = `SELECT world_state_revision_id,state_sequence,world_id,world_revision,
  active_runtime_frame_identity,active_publish_identity,active_publication_record_sha256,active_frame_tick,
  consumption_status,publish_control_status,visual_update_status,transition_type,source_world_state_revision_id,
  rollback_from_runtime_frame_identity,rollback_target_runtime_frame_identity,command_id,recorded_at_utc,
  creation_content_sha256,creation_content_blob,world_state_record_sha256 FROM world_state_revisions`
const eventSelectSql = `SELECT world_control_event_id,event_sequence,command_id,event_type,world_id,
  source_world_state_revision_id,target_world_state_revision_id,target_world_revision,
  target_world_state_record_sha256,occurred_at_utc,previous_event_record_sha256,event_record_sha256
  FROM world_control_events`
const receiptSelectSql = `SELECT command_id,command_sequence,command_type,actor_identity,role,target_identity,
  expected_registry_revision,resulting_registry_revision,expected_world_revision,resulting_world_revision,
  idempotency_key_sha256,input_sha256,reason_text,validation_status,execution_status,result_terminal_id,
  failure_code,event_id,requested_at_utc,finished_at_utc,executor_identity,previous_command_receipt_sha256,
  command_receipt_sha256 FROM command_receipts`

function stateFromRow(value: unknown): StoredWorldState {
  const row = value as Record<string, unknown>
  return {
    schemaVersion: "ai_console_world_control_state_v1",
    registryIdentity,
    worldStateRevisionId: String(row.world_state_revision_id),
    stateSequence: Number(row.state_sequence),
    worldId: String(row.world_id),
    worldRevision: Number(row.world_revision),
    activeRuntimeFrameIdentity: String(row.active_runtime_frame_identity),
    activePublishIdentity: String(row.active_publish_identity),
    activePublicationRecordSha256: String(row.active_publication_record_sha256),
    activeFrameTick: Number(row.active_frame_tick),
    consumptionStatus: "consumed",
    publishControlStatus: String(row.publish_control_status) as "publishing" | "paused",
    visualUpdateStatus: String(row.visual_update_status) as "enabled" | "frozen",
    transitionType: String(row.transition_type) as AiConsoleWorldControlCommandType,
    sourceWorldStateRevisionId: row.source_world_state_revision_id === null ? null : String(row.source_world_state_revision_id),
    rollbackFromRuntimeFrameIdentity: row.rollback_from_runtime_frame_identity === null ? null : String(row.rollback_from_runtime_frame_identity),
    rollbackTargetRuntimeFrameIdentity: row.rollback_target_runtime_frame_identity === null ? null : String(row.rollback_target_runtime_frame_identity),
    commandId: String(row.command_id),
    recordedAtUtc: String(row.recorded_at_utc),
    creationContentSha256: String(row.creation_content_sha256),
    creationContentBlob: row.creation_content_blob as Uint8Array,
    worldStateRecordSha256: String(row.world_state_record_sha256),
  }
}

function eventFromRow(value: unknown): AiConsoleWorldControlEventRecord {
  const row = value as Record<string, unknown>
  return {
    schemaVersion: "ai_console_world_control_event_v1",
    registryIdentity,
    worldControlEventId: String(row.world_control_event_id),
    eventSequence: Number(row.event_sequence),
    commandId: String(row.command_id),
    eventType: String(row.event_type) as AiConsoleWorldControlCommandType,
    worldId: String(row.world_id),
    sourceWorldStateRevisionId: row.source_world_state_revision_id === null ? null : String(row.source_world_state_revision_id),
    targetWorldStateRevisionId: String(row.target_world_state_revision_id),
    targetWorldRevision: Number(row.target_world_revision),
    targetWorldStateRecordSha256: String(row.target_world_state_record_sha256),
    occurredAtUtc: String(row.occurred_at_utc),
    previousEventRecordSha256: row.previous_event_record_sha256 === null ? null : String(row.previous_event_record_sha256),
    eventRecordSha256: String(row.event_record_sha256),
  }
}

function receiptFromRow(value: unknown): AiConsoleWorldControlCommandReceipt {
  const row = value as Record<string, unknown>
  return {
    schemaVersion: "ai_console_world_control_command_receipt_v1",
    registryIdentity,
    commandId: String(row.command_id),
    commandSequence: Number(row.command_sequence),
    commandType: String(row.command_type) as AiConsoleWorldControlCommandType,
    actorIdentity: "local_console_operator",
    role: "operator",
    targetIdentity: row.target_identity === null ? null : String(row.target_identity),
    expectedRegistryRevision: Number(row.expected_registry_revision),
    resultingRegistryRevision: Number(row.resulting_registry_revision),
    expectedWorldRevision: Number(row.expected_world_revision),
    resultingWorldRevision: row.resulting_world_revision === null ? null : Number(row.resulting_world_revision),
    idempotencyKeySha256: String(row.idempotency_key_sha256),
    inputSha256: String(row.input_sha256),
    reasonText: String(row.reason_text),
    validationStatus: String(row.validation_status) as "accepted" | "rejected",
    executionStatus: String(row.execution_status) as "succeeded" | "rejected",
    resultTerminalId: String(row.result_terminal_id),
    failureCode: row.failure_code === null ? null : String(row.failure_code),
    eventId: row.event_id === null ? null : String(row.event_id),
    requestedAtUtc: String(row.requested_at_utc),
    finishedAtUtc: String(row.finished_at_utc),
    executorIdentity,
    previousCommandReceiptSha256: row.previous_command_receipt_sha256 === null ? null : String(row.previous_command_receipt_sha256),
    commandReceiptSha256: String(row.command_receipt_sha256),
  }
}

function readAndVerifyMetadata(database: DatabaseSync): AiConsoleWorldControlMetadata {
  const row = database.prepare("SELECT * FROM metadata WHERE singleton=1").get() as Record<string, unknown> | undefined
  if (!row) throw new Error("ai_console_world_control_metadata_missing")
  const metadata: AiConsoleWorldControlMetadata = {
    schemaVersion: String(row.schema_version) as typeof schemaVersion,
    registryIdentity: String(row.registry_identity) as typeof registryIdentity,
    sourceBoundary: String(row.source_boundary) as "new_ai_console_only",
    writerIdentity: String(row.writer_identity) as typeof writerIdentity,
    storeRevision: Number(row.store_revision),
    registryRevision: Number(row.registry_revision),
    worldCount: Number(row.world_count),
    worldStateCount: Number(row.world_state_count),
    commandCount: Number(row.command_count),
    eventCount: Number(row.event_count),
    createdAtUtc: String(row.created_at_utc),
    updatedAtUtc: String(row.updated_at_utc),
    headEventRecordSha256: row.head_event_record_sha256 === null ? null : String(row.head_event_record_sha256),
    headCommandReceiptSha256: row.head_command_receipt_sha256 === null ? null : String(row.head_command_receipt_sha256),
    metadataSha256: String(row.metadata_sha256),
  }
  const { metadataSha256, ...unsigned } = metadata
  if (metadata.schemaVersion !== schemaVersion || metadata.registryIdentity !== registryIdentity
    || metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== writerIdentity
    || sha256(JSON.stringify(unsigned)) !== metadataSha256) {
    throw new Error("ai_console_world_control_metadata_invalid")
  }
  return metadata
}

function readLatestStateForWorld(database: DatabaseSync, worldId: string) {
  const row = database.prepare(`${stateSelectSql} WHERE world_id=? ORDER BY world_revision DESC LIMIT 1`).get(worldId)
  return row ? stripBlob(stateFromRow(row)) : null
}

function readStateById(database: DatabaseSync, identity: string) {
  const row = database.prepare(`${stateSelectSql} WHERE world_state_revision_id=?`).get(identity)
  return row ? stripBlob(stateFromRow(row)) : null
}

function readEventById(database: DatabaseSync, identity: string) {
  const row = database.prepare(`${eventSelectSql} WHERE world_control_event_id=?`).get(identity)
  return row ? eventFromRow(row) : null
}

function stripBlob<T extends { creationContentBlob?: Uint8Array }>(record: T): Omit<T, "creationContentBlob"> {
  const { creationContentBlob: _blob, ...value } = record
  void _blob
  return value
}

const expectedTableColumns = {
  metadata: ["singleton", "schema_version", "registry_identity", "source_boundary", "writer_identity", "store_revision", "registry_revision", "world_count", "world_state_count", "command_count", "event_count", "created_at_utc", "updated_at_utc", "head_event_record_sha256", "head_command_receipt_sha256", "metadata_sha256"],
  world_state_revisions: ["world_state_revision_id", "state_sequence", "world_id", "world_revision", "active_runtime_frame_identity", "active_publish_identity", "active_publication_record_sha256", "active_frame_tick", "consumption_status", "publish_control_status", "visual_update_status", "transition_type", "source_world_state_revision_id", "rollback_from_runtime_frame_identity", "rollback_target_runtime_frame_identity", "command_id", "recorded_at_utc", "creation_content_sha256", "creation_content_blob", "world_state_record_sha256"],
  world_control_events: ["world_control_event_id", "event_sequence", "command_id", "event_type", "world_id", "source_world_state_revision_id", "target_world_state_revision_id", "target_world_revision", "target_world_state_record_sha256", "occurred_at_utc", "previous_event_record_sha256", "event_record_sha256"],
  command_receipts: ["command_id", "command_sequence", "command_type", "actor_identity", "role", "target_identity", "expected_registry_revision", "resulting_registry_revision", "expected_world_revision", "resulting_world_revision", "idempotency_key_sha256", "input_sha256", "reason_text", "validation_status", "execution_status", "result_terminal_id", "failure_code", "event_id", "requested_at_utc", "finished_at_utc", "executor_identity", "previous_command_receipt_sha256", "command_receipt_sha256"],
} as const

function verifyDatabase(database: DatabaseSync) {
  const integrity = database.prepare("PRAGMA integrity_check").get()
  if (!integrity || !Object.values(integrity).includes("ok")) {
    throw new Error("ai_console_world_control_sqlite_integrity_failed")
  }
  const userVersion = Number((database.prepare("PRAGMA user_version").get() as Record<string, unknown>).user_version)
  if (userVersion !== 1) throw new Error("ai_console_world_control_store_version_invalid")
  const tables = (database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((row) => row.name)
  const expectedTables = Object.keys(expectedTableColumns).sort()
  if (JSON.stringify(tables) !== JSON.stringify(expectedTables)) {
    throw new Error("ai_console_world_control_table_set_invalid")
  }
  for (const [table, columns] of Object.entries(expectedTableColumns)) {
    const actual = (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name)
    if (JSON.stringify(actual) !== JSON.stringify(columns)) {
      throw new Error(`ai_console_world_control_table_columns_invalid:${table}`)
    }
  }
}

function verifyRecords(
  metadata: AiConsoleWorldControlMetadata,
  states: StoredWorldState[],
  events: AiConsoleWorldControlEventRecord[],
  receipts: AiConsoleWorldControlCommandReceipt[],
  publications: readonly AiConsoleRuntimeFramePublicationRecord[],
) {
  const distinctWorlds = new Set(states.map((state) => state.worldId)).size
  if (states.length !== metadata.worldStateCount || events.length !== metadata.eventCount
    || receipts.length !== metadata.commandCount || metadata.registryRevision !== states.length
    || metadata.storeRevision !== receipts.length || metadata.worldCount !== distinctWorlds) {
    throw new Error("ai_console_world_control_metadata_count_mismatch")
  }
  const publicationByIdentity = new Map(publications.map((publication) => [publication.runtimeFrameIdentity, publication]))
  const previousByWorld = new Map<string, AiConsoleWorldControlStateRecord>()
  for (const [index, stored] of states.entries()) {
    if (stored.stateSequence !== index + 1) throw new Error("ai_console_world_control_state_sequence_invalid")
    const blob = Buffer.from(stored.creationContentBlob).toString("utf8")
    if (sha256(blob) !== stored.creationContentSha256) throw new Error("ai_console_world_control_state_blob_invalid")
    const { creationContentBlob: _blob, worldStateRecordSha256, ...unsigned } = stored
    void _blob
    if (sha256(JSON.stringify(unsigned)) !== worldStateRecordSha256) {
      throw new Error("ai_console_world_control_state_sha256_mismatch")
    }
    const previous = previousByWorld.get(stored.worldId) ?? null
    if (stored.worldRevision !== (previous?.worldRevision ?? 0) + 1
      || stored.sourceWorldStateRevisionId !== (previous?.worldStateRevisionId ?? null)) {
      throw new Error("ai_console_world_control_world_revision_chain_invalid")
    }
    const publication = publicationByIdentity.get(stored.activeRuntimeFrameIdentity)
    if (!publication || publication.worldId !== stored.worldId || publication.publishIdentity !== stored.activePublishIdentity
      || publication.publicationRecordSha256 !== stored.activePublicationRecordSha256
      || publication.tick !== stored.activeFrameTick || publication.runtimeFrameStatus !== "registered_formal_unconsumed") {
      throw new Error("ai_console_world_control_publication_binding_invalid")
    }
    verifyTransition(previous, stored, publications)
    previousByWorld.set(stored.worldId, stripBlob(stored))
  }

  let previousEventSha256: string | null = null
  for (const [index, event] of events.entries()) {
    if (event.eventSequence !== index + 1 || event.previousEventRecordSha256 !== previousEventSha256) {
      throw new Error("ai_console_world_control_event_chain_invalid")
    }
    const { eventRecordSha256, ...unsigned } = event
    if (sha256(JSON.stringify(unsigned)) !== eventRecordSha256
      || !states.some((state) => state.worldStateRevisionId === event.targetWorldStateRevisionId
        && state.worldStateRecordSha256 === event.targetWorldStateRecordSha256)) {
      throw new Error("ai_console_world_control_event_binding_invalid")
    }
    previousEventSha256 = event.eventRecordSha256
  }

  let previousReceiptSha256: string | null = null
  for (const [index, receipt] of receipts.entries()) {
    if (receipt.commandSequence !== index + 1 || receipt.previousCommandReceiptSha256 !== previousReceiptSha256) {
      throw new Error("ai_console_world_control_receipt_chain_invalid")
    }
    const { commandReceiptSha256, ...unsigned } = receipt
    if (sha256(JSON.stringify(unsigned)) !== commandReceiptSha256) {
      throw new Error("ai_console_world_control_receipt_sha256_mismatch")
    }
    previousReceiptSha256 = receipt.commandReceiptSha256
  }
  if (metadata.headEventRecordSha256 !== previousEventSha256
    || metadata.headCommandReceiptSha256 !== previousReceiptSha256) {
    throw new Error("ai_console_world_control_head_mismatch")
  }
}

function verifyTransition(
  previous: AiConsoleWorldControlStateRecord | null,
  current: AiConsoleWorldControlStateRecord,
  publications: readonly AiConsoleRuntimeFramePublicationRecord[],
) {
  if (current.consumptionStatus !== "consumed") {
    throw new Error("ai_console_world_control_consumption_status_invalid")
  }
  if (current.transitionType === "consume_registered_runtime_frame") {
    const publication = publications.find((item) => item.runtimeFrameIdentity === current.activeRuntimeFrameIdentity)
    if (!publication || (publication.previousRuntimeFrameIdentity ?? null) !== (previous?.activeRuntimeFrameIdentity ?? null)
      || current.rollbackFromRuntimeFrameIdentity !== null || current.rollbackTargetRuntimeFrameIdentity !== null) {
      throw new Error("ai_console_world_control_consumption_transition_invalid")
    }
    if (previous && (current.publishControlStatus !== previous.publishControlStatus
      || current.visualUpdateStatus !== previous.visualUpdateStatus)) {
      throw new Error("ai_console_world_control_consumption_gate_state_invalid")
    }
    return
  }
  if (!previous || current.worldId !== previous.worldId) {
    throw new Error("ai_console_world_control_transition_source_missing")
  }
  if (current.transitionType === "rollback_runtime_frame") {
    if (current.rollbackFromRuntimeFrameIdentity !== previous.activeRuntimeFrameIdentity
      || current.rollbackTargetRuntimeFrameIdentity !== current.activeRuntimeFrameIdentity
      || previous.publishControlStatus !== "paused" || current.publishControlStatus !== "paused"
      || current.visualUpdateStatus !== previous.visualUpdateStatus
      || !isPublicationAncestor(publications, previous.activeRuntimeFrameIdentity, current.activeRuntimeFrameIdentity)) {
      throw new Error("ai_console_world_control_rollback_transition_invalid")
    }
    return
  }
  if (current.activeRuntimeFrameIdentity !== previous.activeRuntimeFrameIdentity
    || current.activePublishIdentity !== previous.activePublishIdentity
    || current.activePublicationRecordSha256 !== previous.activePublicationRecordSha256
    || current.activeFrameTick !== previous.activeFrameTick
    || current.rollbackFromRuntimeFrameIdentity !== null || current.rollbackTargetRuntimeFrameIdentity !== null) {
    throw new Error("ai_console_world_control_non_frame_transition_invalid")
  }
  if (current.transitionType === "pause_frame_publish"
    && !(previous.publishControlStatus === "publishing" && current.publishControlStatus === "paused"
      && current.visualUpdateStatus === previous.visualUpdateStatus)) {
    throw new Error("ai_console_world_control_pause_transition_invalid")
  }
  if (current.transitionType === "resume_frame_publish"
    && !(previous.publishControlStatus === "paused" && current.publishControlStatus === "publishing"
      && previous.visualUpdateStatus === "enabled" && current.visualUpdateStatus === "enabled")) {
    throw new Error("ai_console_world_control_resume_transition_invalid")
  }
  if (current.transitionType === "freeze_visual_updates"
    && !(previous.visualUpdateStatus === "enabled" && current.visualUpdateStatus === "frozen"
      && current.publishControlStatus === previous.publishControlStatus)) {
    throw new Error("ai_console_world_control_freeze_transition_invalid")
  }
}

function getStorePath() {
  return path.join(process.cwd(), ...worldControlRegistryStoreLogicalPath.split("/"))
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value)
}

function isText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value === value.trim() && value.length >= minimum
    && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value)
}

function isUtc(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
