import { readTrainingArtifact } from '@/server/ai-console/training-history-store.mjs'
import { guardHistoryRequest, historyFailure, historyHeaders } from '@/server/ai-console/training-history-http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{ runId: string; artifactId: string }> }) {
  const rejected = guardHistoryRequest(request)
  if (rejected) return rejected
  try {
    const { runId, artifactId } = await context.params
    const result = await readTrainingArtifact(runId, artifactId)
    if (result.bytes) return new Response(new Uint8Array(result.bytes), { headers: { ...historyHeaders, 'Content-Type': result.contentType } })
    return Response.json(result.json, { headers: historyHeaders })
  } catch (error) { return historyFailure(error) }
}
