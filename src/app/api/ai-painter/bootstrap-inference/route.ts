import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  try {
    const image = await readFile(path.join(process.cwd(), ".runtime", "ai-painter", "bootstrap-inference", "bootstrap-world-001.png"))
    return new NextResponse(image, { headers: { "content-type": "image/png", "cache-control": "no-store" } })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
