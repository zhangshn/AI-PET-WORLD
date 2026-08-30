import { readAiPainterCurrentExecutionSnapshot } from "@/server/ai-console/ai-painter-current-execution-projection"

export const dynamic = "force-dynamic"

export async function GET() {
  const snapshot = await readAiPainterCurrentExecutionSnapshot()
  return Response.json(snapshot, {
    status: snapshot.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
