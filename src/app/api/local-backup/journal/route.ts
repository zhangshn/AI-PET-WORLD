import { handle, store, noQuery, body } from '@/server/local-backup/service'
import { need } from '@/server/local-backup/contracts.mjs'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  return handle(request, () => { const s = noQuery(request, ['date']); need(s.has('date'), 'date_required'); return { dataStatus: 'connected', record: store().journal(s.get('date')) } })
}
export function PUT(request: Request) {
  return handle(request, async () => { noQuery(request); return { dataStatus: 'connected', record: store().saveJournal(await body(request)) } }, true)
}
