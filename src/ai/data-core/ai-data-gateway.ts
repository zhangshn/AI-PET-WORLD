/**
 * 当前文件负责：提供 AI 数据层统一记录入口。
 */

import type {
  AiDataBaseRecord,
  AiDataRecord,
  AiDecisionRecord,
  AiMessageRecord,
  AiStateSnapshotRecord,
  AiUserFeedbackRecord,
  AiWorldEventRecord,
} from "./ai-data-types"

import {
  appendAiDataRecord,
  appendAiDataRecords,
  clearAiDataRecords,
  configureAiDataStore,
  countAiDataRecords,
  exportAiDataRecords,
  readAiDataRecords,
  readLatestAiDataRecord,
  restoreAiDataRecords,
  type AiDataRecordFilter,
} from "./ai-data-store"

export type CreateAiBaseRecordInput = Omit<
  AiDataBaseRecord,
  "id" | "kind" | "occurredAt"
> & {
  id?: string
  occurredAt?: string
}

export type CreateAiDecisionRecordInput = CreateAiBaseRecordInput &
  Omit<AiDecisionRecord, keyof AiDataBaseRecord | "kind">

export type CreateAiWorldEventRecordInput = CreateAiBaseRecordInput &
  Omit<AiWorldEventRecord, keyof AiDataBaseRecord | "kind">

export type CreateAiMessageRecordInput = CreateAiBaseRecordInput &
  Omit<AiMessageRecord, keyof AiDataBaseRecord | "kind">

export type CreateAiStateSnapshotRecordInput = CreateAiBaseRecordInput &
  Omit<AiStateSnapshotRecord, keyof AiDataBaseRecord | "kind">

export type CreateAiUserFeedbackRecordInput = CreateAiBaseRecordInput &
  Omit<AiUserFeedbackRecord, keyof AiDataBaseRecord | "kind">

let recordSequence = 0

function createAiDataRecordId(kind: AiDataRecord["kind"]): string {
  recordSequence += 1

  return `ai-${kind}-${Date.now()}-${recordSequence}`
}

function buildBaseRecord(
  kind: AiDataRecord["kind"],
  input: CreateAiBaseRecordInput
): AiDataBaseRecord {
  return {
    id: input.id ?? createAiDataRecordId(kind),
    kind,
    source: input.source,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    entityType: input.entityType,
    entityId: input.entityId,
    importance: input.importance,
    userVisibleChannel: input.userVisibleChannel,
    summary: input.summary,
    tags: input.tags,
  }
}

function isSameMessageRecord(
  record: AiDataRecord,
  messageId: string
): record is AiMessageRecord {
  return record.kind === "message" && record.messageId === messageId
}

export function hasAiDataRecord(filter: AiDataRecordFilter = {}): boolean {
  return countAiDataRecords(filter) > 0
}

export function recordAiDecision(
  input: CreateAiDecisionRecordInput
): AiDecisionRecord {
  const record: AiDecisionRecord = {
    ...buildBaseRecord("decision", input),
    kind: "decision",
    beforeState: input.beforeState,
    afterState: input.afterState,
    candidates: input.candidates,
    selectedCandidateId: input.selectedCandidateId,
    reason: input.reason,
  }

  return appendAiDataRecord(record) as AiDecisionRecord
}

export function recordAiWorldEvent(
  input: CreateAiWorldEventRecordInput
): AiWorldEventRecord {
  const record: AiWorldEventRecord = {
    ...buildBaseRecord("world_event", input),
    kind: "world_event",
    eventType: input.eventType,
    eventId: input.eventId,
    visibility: input.visibility,
    payload: input.payload,
  }

  return appendAiDataRecord(record) as AiWorldEventRecord
}

export function recordAiMessage(
  input: CreateAiMessageRecordInput
): AiMessageRecord {
  const record: AiMessageRecord = {
    ...buildBaseRecord("message", input),
    kind: "message",
    messageId: input.messageId,
    messageChannel: input.messageChannel,
    messageText: input.messageText,
    triggerReason: input.triggerReason,
    sourceEventId: input.sourceEventId,
    wasReadByUser: input.wasReadByUser,
  }

  return appendAiDataRecord(record) as AiMessageRecord
}

export function recordAiMessageOnce(
  input: CreateAiMessageRecordInput
): AiMessageRecord | undefined {
  const existingRecord = readAiDataRecords({
    kind: "message",
    limit: 200,
  }).find((record) => isSameMessageRecord(record, input.messageId))

  if (existingRecord) {
    return existingRecord
  }

  return recordAiMessage(input)
}

export function recordAiStateSnapshot(
  input: CreateAiStateSnapshotRecordInput
): AiStateSnapshotRecord {
  const record: AiStateSnapshotRecord = {
    ...buildBaseRecord("state_snapshot", input),
    kind: "state_snapshot",
    snapshot: input.snapshot,
  }

  return appendAiDataRecord(record) as AiStateSnapshotRecord
}

export function recordAiUserFeedback(
  input: CreateAiUserFeedbackRecordInput
): AiUserFeedbackRecord {
  const record: AiUserFeedbackRecord = {
    ...buildBaseRecord("user_feedback", input),
    kind: "user_feedback",
    feedbackType: input.feedbackType,
    targetId: input.targetId,
    feedbackValue: input.feedbackValue,
  }

  return appendAiDataRecord(record) as AiUserFeedbackRecord
}

export function recordAiDataBatch(records: AiDataRecord[]): AiDataRecord[] {
  return appendAiDataRecords(records)
}

export function getAiDataRecords(
  filter: AiDataRecordFilter = {}
): AiDataRecord[] {
  return readAiDataRecords(filter)
}

export function exportAiDataSnapshot(): AiDataRecord[] {
  return exportAiDataRecords()
}

export function restoreAiDataSnapshot(records: AiDataRecord[]): void {
  restoreAiDataRecords(records)
}

export function getLatestAiDataRecord(
  filter: AiDataRecordFilter = {}
): AiDataRecord | undefined {
  return readLatestAiDataRecord(filter)
}

export function getAiDataRecordCount(filter: AiDataRecordFilter = {}): number {
  return countAiDataRecords(filter)
}

export function resetAiDataRecords(): void {
  clearAiDataRecords()
}

export function setupAiDataStore(input: { maxRecords?: number }): void {
  configureAiDataStore(input)
}