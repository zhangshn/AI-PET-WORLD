import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

const SAMPLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u

export async function GET(_request: Request, context: { params: Promise<{ sampleId: string }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  const { sampleId } = await context.params
  if (!SAMPLE_ID_PATTERN.test(sampleId)) return new NextResponse(null, { status: 404 })
  const file = path.join(process.cwd(), "data", "ai-painter-datasets", "accepted", "dataset_v0", "scene", "world", sampleId, "target.png")
  try {
    return new NextResponse(await readFile(file), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
