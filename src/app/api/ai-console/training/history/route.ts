import { listTrainingHistory } from '@/server/ai-console/training-history-store.mjs'
import { guardHistoryRequest, historyFailure, historyHeaders } from '@/server/ai-console/training-history-http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const rejected = guardHistoryRequest(request, ['cursor', 'limit'])
  if (rejected) return rejected
  try {
    const params = new URL(request.url).searchParams
    const result = await listTrainingHistory({ cursor: params.get('cursor'), limit: params.has('limit') ? Number(params.get('limit')) : 20 })
    return Response.json(result, { status: result.dataStatus === 'unknown_or_stale' ? 409 : 200, headers: historyHeaders })
  } catch (error) { return historyFailure(error) }
}
