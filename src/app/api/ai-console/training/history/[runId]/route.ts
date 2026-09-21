import { readTrainingRun } from '@/server/ai-console/training-history-store.mjs'
import { guardHistoryRequest, historyFailure, historyHeaders } from '@/server/ai-console/training-history-http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const rejected = guardHistoryRequest(request)
  if (rejected) return rejected
  try { return Response.json(await readTrainingRun((await context.params).runId), { headers: historyHeaders }) }
  catch (error) { return historyFailure(error) }
}
