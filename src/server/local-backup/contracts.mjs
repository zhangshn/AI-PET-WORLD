import { createHash } from 'node:crypto'

export const schemaVersion = 'local_backup_module_v1'
export const specificationVersion = 'LOCAL-BACKUP-WORK-LEDGER-1.0'
export const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex')
export class ModuleError extends Error {
  constructor(code, status = 409) { super(code); this.status = status }
}
export function need(condition, code, status = 400) { if (!condition) throw new ModuleError(code, status) }
export function fields(value, names) {
  need(value && typeof value === 'object' && !Array.isArray(value), 'invalid_object')
  need(Object.keys(value).length === names.length && names.every(n => Object.hasOwn(value, n)), 'invalid_fields')
}
export function dateKey(value) {
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'invalid_date')
  const parsed = new Date(`${value}T00:00:00Z`)
  need(Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value, 'invalid_date')
  return value
}
export function timestamp(value) {
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value) && Number.isFinite(Date.parse(value)), 'invalid_timestamp')
  dateKey(value.slice(0,10))
  return value
}
export const beijingDate = value => value === null ? null : new Date(Date.parse(timestamp(value)) + 8 * 3600000).toISOString().slice(0, 10)
export function identity(value) {
  need(typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value), 'invalid_identity')
  return value
}
export function parseJournal(value) {
  fields(value, ['date', 'completedText', 'planText', 'backupId', 'expectedRevision'])
  dateKey(value.date)
  for (const key of ['completedText', 'planText']) need(typeof value[key] === 'string' && value[key].length <= 16000 && !value[key].includes('\0'), 'journal_text_limit')
  need(Number.isSafeInteger(value.expectedRevision) && value.expectedRevision >= 0, 'invalid_revision')
  if (value.backupId !== null) identity(value.backupId)
  return value
}
export function pageQuery(search, allowed = [], revision = 0, context = '') {
  need([...search.keys()].every(k => ['limit', 'cursor', ...allowed].includes(k)), 'invalid_query')
  need([...new Set(search.keys())].every(k => search.getAll(k).length === 1), 'duplicate_query')
  const rawLimit = search.get('limit') ?? '20'
  need(/^[1-9]\d?$/.test(rawLimit), 'invalid_limit')
  const limit = Number(rawLimit)
  need(limit <= 50, 'invalid_limit')
  let offset = 0
  const cursor = search.get('cursor')
  if (cursor) {
    need(cursor.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(cursor), 'invalid_cursor')
    let decoded
    try { decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString()) } catch { throw new ModuleError('invalid_cursor', 400) }
    fields(decoded, ['revision', 'context', 'offset'])
    need(decoded.revision === revision && decoded.context === context, 'cursor_revision_conflict', 409)
    need(Number.isSafeInteger(decoded.offset) && decoded.offset >= 0 && decoded.offset <= 1000000, 'invalid_cursor')
    offset = decoded.offset
  }
  return { limit, offset, next: nextOffset => Buffer.from(JSON.stringify({ revision, context, offset: nextOffset })).toString('base64url') }
}
