/**
 * 当前文件负责：提供 AI 数据记录的轻量内存存储。
 */

import type {
  AiDataRecord,
  AiDataRecordKind,
  AiDataSource,
  AiEntityType,
  AiUserVisibleChannel,
} from "./ai-data-types"

export type AiDataRecordFilter = {
  kind?: AiDataRecordKind
  source?: AiDataSource
  entityType?: AiEntityType
  entityId?: string
  userVisibleChannel?: AiUserVisibleChannel
  tag?: string
  after?: string
  before?: string
  limit?: number
}

const DEFAULT_MAX_RECORDS = 500

let maxRecords = DEFAULT_MAX_RECORDS
const records: AiDataRecord[] = []

function isAfter(record: AiDataRecord, after?: string): boolean {
  if (!after) return true

  return record.occurredAt >= after
}

function isBefore(record: AiDataRecord, before?: string): boolean {
  if (!before) return true

  return record.occurredAt <= before
}

function matchesFilter(
  record: AiDataRecord,
  filter: AiDataRecordFilter
): boolean {
  if (filter.kind && record.kind !== filter.kind) return false
  if (filter.source && record.source !== filter.source) return false
  if (filter.entityType && record.entityType !== filter.entityType) return false
  if (filter.entityId && record.entityId !== filter.entityId) return false

  if (
    filter.userVisibleChannel &&
    record.userVisibleChannel !== filter.userVisibleChannel
  ) {
    return false
  }

  if (filter.tag && !record.tags.includes(filter.tag)) return false
  if (!isAfter(record, filter.after)) return false
  if (!isBefore(record, filter.before)) return false

  return true
}

function findRecordIndexById(recordId: string): number {
  return records.findIndex((record) => record.id === recordId)
}

const PROTECTED_RECORD_KINDS: AiDataRecordKind[] = [
  "message",
  "user_feedback",
]

function isProtectedRecord(record: AiDataRecord): boolean {
  return PROTECTED_RECORD_KINDS.includes(record.kind)
}

function trimRecords(): void {
  if (records.length <= maxRecords) return

  const protectedRecords = records.filter(isProtectedRecord)
  const normalRecords = records.filter((record) => !isProtectedRecord(record))

  const protectedLimit = Math.min(
    protectedRecords.length,
    Math.max(80, Math.floor(maxRecords * 0.25))
  )

  const normalLimit = Math.max(0, maxRecords - protectedLimit)

  const nextRecords = [
    ...protectedRecords.slice(0, protectedLimit),
    ...normalRecords.slice(0, normalLimit),
  ]

  records.splice(0, records.length, ...nextRecords)
}

/**
 * 同 ID 记录只保留一份。
 *
 * 说明：
 * - world_event 这类记录可能使用稳定 ID。
 * - message 这类记录也可能通过 recordAiMessageOnce 控制重复。
 * - store 层仍然需要兜底去重，防止热更新或重复流程写入重复数据。
 */
function upsertRecord(record: AiDataRecord): AiDataRecord {
  const existingIndex = findRecordIndexById(record.id)

  if (existingIndex >= 0) {
    records.splice(existingIndex, 1)
  }

  records.unshift(record)
  trimRecords()

  return record
}

export function configureAiDataStore(input: { maxRecords?: number }): void {
  if (typeof input.maxRecords === "number" && input.maxRecords > 0) {
    maxRecords = Math.floor(input.maxRecords)
  }

  trimRecords()
}

export function appendAiDataRecord(record: AiDataRecord): AiDataRecord {
  return upsertRecord(record)
}

export function appendAiDataRecords(nextRecords: AiDataRecord[]): AiDataRecord[] {
  nextRecords.forEach((record) => {
    upsertRecord(record)
  })

  trimRecords()

  return nextRecords
}

export function readAiDataRecords(
  filter: AiDataRecordFilter = {}
): AiDataRecord[] {
  const matchedRecords = records.filter((record) => matchesFilter(record, filter))

  if (typeof filter.limit === "number" && filter.limit > 0) {
    return matchedRecords.slice(0, Math.floor(filter.limit))
  }

  return matchedRecords
}

export function exportAiDataRecords(): AiDataRecord[] {
  return records.map((record) => ({ ...record }))
}

export function restoreAiDataRecords(nextRecords: AiDataRecord[]): void {
  records.splice(0, records.length)

  nextRecords.forEach((record) => {
    upsertRecord(record)
  })

  trimRecords()
}

export function readLatestAiDataRecord(
  filter: AiDataRecordFilter = {}
): AiDataRecord | undefined {
  return readAiDataRecords({
    ...filter,
    limit: 1,
  })[0]
}

export function countAiDataRecords(filter: AiDataRecordFilter = {}): number {
  return records.filter((record) => matchesFilter(record, filter)).length
}

export function hasAiDataRecord(filter: AiDataRecordFilter = {}): boolean {
  return countAiDataRecords(filter) > 0
}

export function clearAiDataRecords(): void {
  records.splice(0, records.length)
}