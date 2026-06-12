import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

const SAMPLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u

export async function GET(request: Request, context: { params: Promise<{ sampleId: string }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  const { sampleId } = await context.params
  if (!SAMPLE_ID_PATTERN.test(sampleId)) return new NextResponse(null, { status: 404 })
  const wantsOriginal = new URL(request.url).searchParams.get("original") === "1"
  const original = path.join(process.cwd(), "data", "ai-painter-datasets", "incoming", sampleId, "target.png")
  const normalized = path.join(process.cwd(), "data", "ai-painter-datasets", "accepted", "dataset_v0", "scene", "world", sampleId, "target.png")
  try {
    const image = wantsOriginal ? await readOriginalOrNormalized(original, normalized) : await readFile(normalized)
    return new NextResponse(image, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}

async function readOriginalOrNormalized(original: string, normalized: string) {
  try { return await readFile(original) } catch { return readFile(normalized) }
}
