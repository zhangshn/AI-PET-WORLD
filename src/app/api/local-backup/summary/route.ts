import { handle, store, noQuery } from '@/server/local-backup/service'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  return handle(request, () => { noQuery(request); return { dataStatus: 'partial', reasonCode: 'inventory_coverage_partial', inventory: store().inventory(), backup: { dataStatus: 'not_connected', reasonCode: 'production_backup_adapter_not_connected', actualBackupExecuted: false, restorabilityStatus: 'unknown' } } })
}
