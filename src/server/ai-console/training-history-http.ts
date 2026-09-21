import { verifyLocalControlRead } from '../ai-console-control/operator-session'
import { HistoryError } from './training-history-store.mjs'

export const historyHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
export function guardHistoryRequest(request: Request, allowed: string[] = []) {
  const access = verifyLocalControlRead(request)
  if (!access.ok) return Response.json({ dataStatus: 'unknown_or_stale', reasonCode: access.errorCode }, { status: access.status, headers: historyHeaders })
  const params = new URL(request.url).searchParams
  if ([...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1)) {
    return Response.json({ dataStatus: 'unknown_or_stale', reasonCode: 'history_parameters_invalid' }, { status: 400, headers: historyHeaders })
  }
  return null
}
export function historyFailure(error: unknown) {
  const status = error instanceof HistoryError ? error.status : 503
  const reasonCode = error instanceof HistoryError ? error.message : 'history_source_unreadable'
  return Response.json({ dataStatus: 'unknown_or_stale', reasonCode, records: null, total: null }, { status, headers: historyHeaders })
}
