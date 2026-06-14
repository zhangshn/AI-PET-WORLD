import { readFile } from "node:fs/promises"
import path from "node:path"

const SAFE_ID = /^[a-z0-9_-]+$/

export async function GET(_request: Request, context: { params: Promise<{ sampleId: string }> }) {
  const { sampleId } = await context.params
  if (!SAFE_ID.test(sampleId)) return new Response(null, { status: 400 })
  const imagePath = path.join(process.cwd(), "data", "ai-painter-quality", "vj-b2", "samples", sampleId, "sprite.png")
  try {
    return new Response(await readFile(imagePath), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
