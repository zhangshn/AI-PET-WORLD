import { readFile } from "node:fs/promises"
import path from "node:path"

export async function GET(_: Request, context: { params: Promise<{ sampleId: string }> }) {
  const { sampleId } = await context.params
  if (!/^[a-z0-9-]+$/u.test(sampleId)) return new Response(null, { status: 400 })
  try {
    const file = path.join(process.cwd(), "data", "ai-painter-datasets", "incoming", sampleId, "target.png")
    return new Response(await readFile(file), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
