import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, context: { params: Promise<{ resultId: string }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  const { resultId } = await context.params
  const file = resolveArchivedImageFile(resultId)
  if (!file) return new NextResponse(null, { status: 403 })

  try {
    const image = await readFile(/* turbopackIgnore: true */ file)
    return new NextResponse(image, { headers: { "content-type": "image/png", "cache-control": "no-store" } })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}

function resolveArchivedImageFile(resultId: string) {
  if (!/^[a-z0-9_-]+$/.test(resultId)) return null
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    ".runtime",
    "ai-painter",
    "generated-results",
    "images",
    `${resultId}.png`,
  )
}
