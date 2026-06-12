import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

const SAMPLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u
const CHANNEL_PATTERN = /^[a-z_]+$/u

export async function GET(request: Request, context: { params: Promise<{ sampleId: string }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  const { sampleId } = await context.params
  const channel = new URL(request.url).searchParams.get("channel") ?? ""
  if (!SAMPLE_ID_PATTERN.test(sampleId) || !CHANNEL_PATTERN.test(channel)) return new NextResponse(null, { status: 404 })
  const file = path.join(process.cwd(), "data", "ai-painter-datasets", "accepted", "dataset_v0", "scene", "world", sampleId, "masks_v1", `${channel}.png`)
  try {
    return new NextResponse(await readFile(file), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
