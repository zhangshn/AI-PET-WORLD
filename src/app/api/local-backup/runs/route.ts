import { handle, store, body, noQuery } from '@/server/local-backup/service'
import { productionBackup, projectBackupRecord } from '@/server/local-backup/backup-context'
import { parseBackupRequest } from '@/server/local-backup/backup-contract.mjs'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function GET(request: Request) { return handle(request, () => {const currentStore=store(),page=currentStore.runs(new URL(request.url).searchParams);return{dataStatus:'partial',...page,records:page.records.map((record:Record<string,unknown>)=>projectBackupRecord(currentStore,record)),executorStatus:'not_connected'}}) }
export function POST(request: Request) {
  return handle(request, async () => {
    noQuery(request); const input = parseBackupRequest(await body(request))
    return productionBackup().run(input,{signal:request.signal})
  }, true)
}
