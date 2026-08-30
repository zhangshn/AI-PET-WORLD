import { sampleAiConsoleLiveObservability } from "@/server/ai-console-observability/local-observability"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const snapshot = await sampleAiConsoleLiveObservability()
    return Response.json({ ok: true, ...snapshot }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return Response.json({
      ok: false,
      schemaVersion: "ai_console_live_observability_v2",
      errorCode: "ai_console_live_observability_probe_failed",
    }, {
      status: 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }
}
