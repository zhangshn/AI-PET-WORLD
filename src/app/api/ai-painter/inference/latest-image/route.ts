import { readFile } from "node:fs/promises"
import path from "node:path"

const INFERENCE_ROOT = path.resolve(process.cwd(), ".runtime", "ai-painter", "inference-v0")

export async function GET() {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(INFERENCE_ROOT, "latest.json"), "utf8")
    ) as { output?: string }
    if (!manifest.output) return new Response(null, { status: 404 })
    const imagePath = path.resolve(manifest.output)
    if (!imagePath.startsWith(`${INFERENCE_ROOT}${path.sep}`)) {
      return new Response(null, { status: 403 })
    }
    const image = await readFile(imagePath)
    return new Response(image, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
