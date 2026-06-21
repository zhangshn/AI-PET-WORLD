import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const views = { generated: "generated.png", structure: "structure-preview.png" } as const

export async function GET(_request: NextRequest, context: { params: Promise<{ view: string }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  const { view } = await context.params
  const file = views[view as keyof typeof views]
  if (!file) return new NextResponse(null, { status: 404 })
  try {
    const image = await readFile(path.join(process.cwd(), ".runtime", "ai-painter", "structure-guided-inference", file))
    return new NextResponse(image, { headers: { "content-type": "image/png", "cache-control": "no-store" } })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
