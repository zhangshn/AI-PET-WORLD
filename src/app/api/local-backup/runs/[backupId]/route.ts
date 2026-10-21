import { handle, store, noQuery } from '@/server/local-backup/service'
import { need } from '@/server/local-backup/contracts.mjs'
import { projectBackupRecord } from '@/server/local-backup/backup-context'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{ backupId: string }> }) {
  return handle(request, async () => { noQuery(request); const { backupId } = await context.params,currentStore=store(); const record = projectBackupRecord(currentStore,currentStore.run(backupId),backupId); need(record, 'backup_not_found', 404); return { dataStatus: 'partial', record } })
}
