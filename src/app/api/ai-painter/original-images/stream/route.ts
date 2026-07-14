import { watch, type FSWatcher } from "node:fs"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const encoder = new TextEncoder()

export function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })

  const libraryRoot = path.join(
    process.cwd(),
    "data",
    "world-samples",
    "original-image-library",
    "natural-home-v1",
  )
  let cleanup: () => void = () => undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let watcher: FSWatcher | null = null
      let changeTimer: ReturnType<typeof setTimeout> | null = null

      const send = (event: string, value: Record<string, unknown>) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`))
      }
      const close = () => {
        if (closed) return
        closed = true
        if (changeTimer) clearTimeout(changeTimer)
        watcher?.close()
        try {
          controller.close()
        } catch {
          // The browser may already have closed the stream.
        }
      }

      cleanup = close
      send("ready", { status: "watching_original_image_library" })
      watcher = watch(libraryRoot, { persistent: false }, (_eventType, fileName) => {
        if (fileName?.toString() !== "index.json") return
        if (changeTimer) clearTimeout(changeTimer)
        changeTimer = setTimeout(() => {
          send("library_changed", { updatedAt: new Date().toISOString() })
          changeTimer = null
        }, 100)
      })
      watcher.on("error", close)
      request.signal.addEventListener("abort", close, { once: true })
    },
    cancel() {
      cleanup()
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
