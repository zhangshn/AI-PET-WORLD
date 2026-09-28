import { readTrainingRun, readTrainingRunSection } from '@/server/ai-console/training-history-store.mjs'
import { guardHistoryRequest, historyFailure, historyHeaders } from '@/server/ai-console/training-history-http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const rejected = guardHistoryRequest(request, ['section', 'cursor', 'limit'])
  if (rejected) return rejected
  try {
    const runId = (await context.params).runId
    const params = new URL(request.url).searchParams
    if (!params.has('section') && (params.has('cursor') || params.has('limit'))) return Response.json(
      { dataStatus: 'unknown_or_stale', reasonCode: 'history_section_required' }, { status: 400, headers: historyHeaders })
    const result = params.has('section')
      ? await readTrainingRunSection(runId, { section: params.get('section') ?? '', cursor: params.get('cursor'), limit: params.has('limit') ? Number(params.get('limit')) : 20 })
      : await readTrainingRun(runId)
    return Response.json(result, { headers: historyHeaders })
  }
  catch (error) { return historyFailure(error) }
}
