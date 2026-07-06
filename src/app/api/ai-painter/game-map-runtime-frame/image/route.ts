import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const latestPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    ".runtime",
    "game-map-runtime-frame-candidates",
    "latest-runtime-frame.json",
  )

  try {
    const record = JSON.parse(await readFile(latestPath, "utf8")) as {
      runtimeFrame?: {
        composition?: {
          compositeOutput?: {
            imageUrl?: string
            imageFormat?: string
          } | null
        }
      }
    }
    const imagePath = record.runtimeFrame?.composition?.compositeOutput?.imageUrl
    if (!imagePath) {
      return NextResponse.json({ ok: false, error: "game_map_runtime_image_missing" }, { status: 404 })
    }

    const bytes = await readFile(path.resolve(imagePath))
    return new NextResponse(bytes, {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: "game_map_runtime_image_unreadable" }, { status: 404 })
  }
}
