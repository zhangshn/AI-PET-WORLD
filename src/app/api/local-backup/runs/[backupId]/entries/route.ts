import { handle, store } from '@/server/local-backup/service'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{ backupId: string }> }) {
  return handle(request, async () => { const { backupId } = await context.params; return { dataStatus: 'connected', ...store().entries(backupId, new URL(request.url).searchParams) } })
}
