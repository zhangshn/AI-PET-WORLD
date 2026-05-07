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

function trimRecords(): void {
  if (records.length <= maxRecords) return

  records.splice(maxRecords)
}

export function configureAiDataStore(input: { maxRecords?: number }): void {
  if (typeof input.maxRecords === "number" && input.maxRecords > 0) {
    maxRecords = Math.floor(input.maxRecords)
  }

  trimRecords()
}

export function appendAiDataRecord(record: AiDataRecord): AiDataRecord {
  records.unshift(record)
  trimRecords()

  return record
}

export function appendAiDataRecords(nextRecords: AiDataRecord[]): AiDataRecord[] {
  nextRecords.forEach((record) => {
    records.unshift(record)
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

export function clearAiDataRecords(): void {
  records.splice(0, records.length)
}