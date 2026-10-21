import { readAiPainterCurrentExecutionSnapshot } from "@/server/ai-console/ai-painter-current-execution-projection"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.size !== 0) {
    return Response.json({
      ok: false,
      dataStatus: "unknown_or_stale",
      reasonCode: "current_execution_parameters_invalid",
    }, {
      status: 400,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }
  const snapshot = await readAiPainterCurrentExecutionSnapshot()
  return Response.json(snapshot, {
    status: snapshot.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
