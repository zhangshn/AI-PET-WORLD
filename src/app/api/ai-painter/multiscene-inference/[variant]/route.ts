import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const variants = {
  base: ["multiscene-inference", "scene-world-11-e0e7975b.png"],
  gan: ["multiscene-gan-inference", "scene-world-11-e0e7975b.png"],
  "structural-v2": ["structural-v2-inference", "scene-world-11-e0e7975b.png"],
} as const

export async function GET(_request: NextRequest, context: { params: Promise<{ variant: string }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  const { variant } = await context.params
  const parts = variants[variant as keyof typeof variants]
  if (!parts) return new NextResponse(null, { status: 404 })
  try {
    const image = await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "ai-painter", ...parts))
    return new NextResponse(image, { headers: { "content-type": "image/png", "cache-control": "no-store" } })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
