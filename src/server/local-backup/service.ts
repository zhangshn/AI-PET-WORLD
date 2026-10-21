import fs from 'node:fs'
import path from 'node:path'
import { createStore } from './store.mjs'
import { createWorkProducers } from './work-producers.mjs'
import { ModuleError, need, schemaVersion } from './contracts.mjs'
import { verifyLocalControlRead, verifyLocalOperatorMutation } from '@/server/ai-console-control/operator-session'

export function store() {
  const runtime = path.resolve(process.cwd(), '.runtime')
  const expected = path.resolve(process.env.AI_PET_WORLD_DATA_ROOT ?? (process.platform === 'win32' ? 'D:/AI-PET-WORLD-DATA' : '.ai-pet-world-data'), 'hot/runtime')
  need(fs.existsSync(runtime) && fs.realpathSync(runtime).toLowerCase() === fs.realpathSync(expected).toLowerCase(), 'runtime_mapping_conflict', 409)
  return createStore(path.join(expected, 'local-backup'))
}
export function respond(value: object, status = 200) {
  return Response.json({ schemaVersion, observedAtUtc: new Date().toISOString(), ...value }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
export async function handle(request: Request, operation: () => unknown | Promise<unknown>, mutation = false) {
  const auth = mutation ? verifyLocalOperatorMutation(request) : verifyLocalControlRead(request)
  if (!auth.ok) return respond({ dataStatus: 'not_connected', reasonCode: auth.errorCode }, 403)
  try {
    const result = await operation() as { dataStatus?: string }
    return respond(result, result.dataStatus === 'not_connected' ? 503 : 200)
  }
  catch (error) {
    const known = error instanceof ModuleError
    const status = known ? error.status : 503
    return respond({ dataStatus: status === 503 ? 'not_connected' : 'unknown_or_stale', reasonCode: known ? error.message : 'local_backup_service_unavailable' }, status)
  }
}
export function noQuery(request: Request, allowed: string[] = []) {
  const s = new URL(request.url).searchParams
  need([...s.keys()].every(k => allowed.includes(k) && s.getAll(k).length === 1), 'invalid_query')
  return s
}
export async function body(request: Request) {
  const length = request.headers.get('content-length')
  if (length !== null) need(/^\d+$/.test(length) && Number(length) <= 65536, 'body_too_large', 413)
  need(request.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'json_required')
  const reader = request.body?.getReader()
  if (!reader) throw new ModuleError('body_required', 400)
  const parts: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break
      size += value.byteLength; need(size <= 65536, 'body_too_large', 413); parts.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')) } catch { throw new ModuleError('invalid_json', 400) }
}
// Queries only: constructing this context never starts an observer or writes.
// Use the current query factory after Next hot reload. A long-lived writer
// context can retain an older ledger closure; GET must not reuse that closure.
export const ledger = () => createWorkProducers().ledgerForStore(store())
