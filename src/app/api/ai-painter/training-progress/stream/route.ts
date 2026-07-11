import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const encoder = new TextEncoder()
const pollIntervalMs = 3000

export async function GET(request: NextRequest) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const stream = new ReadableStream({
    start(controller) {
      async function push() {
        if (stopped) return
        try {
          const progressUrl = new URL("/api/ai-painter/training-progress", request.nextUrl.origin)
          progressUrl.searchParams.set("view", "summary")
          const response = await fetch(progressUrl, {
            cache: "no-store",
            signal: request.signal,
          })
          const payload = await response.text()
          if (stopped) return
          controller.enqueue(encoder.encode(`event: progress\ndata: ${payload}\n\n`))
        } catch (error) {
          if (stopped || request.signal.aborted) return
          const message = error instanceof Error ? error.message : "unknown_progress_stream_error"
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                status: "progress_stream_error",
                error: message,
                updatedAt: new Date().toISOString(),
              })}\n\n`,
            ),
          )
        }
      }

      async function pushAndSchedule() {
        await push()
        if (!stopped) timer = setTimeout(() => void pushAndSchedule(), pollIntervalMs)
      }

      void pushAndSchedule()
      request.signal.addEventListener("abort", () => {
        stopped = true
        if (timer) clearTimeout(timer)
        try {
          controller.close()
        } catch {
          // The browser may already have closed the connection.
        }
      })
    },
    cancel() {
      stopped = true
      if (timer) clearTimeout(timer)
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  })
}
