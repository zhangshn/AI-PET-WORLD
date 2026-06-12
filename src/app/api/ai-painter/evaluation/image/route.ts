import { readFile } from "node:fs/promises"
import path from "node:path"

const EVALUATION_ROOT = path.resolve(process.cwd(), ".runtime", "ai-painter", "evaluation-v0")

export async function GET() {
  try {
    const report = JSON.parse(
      await readFile(path.join(EVALUATION_ROOT, "evaluation.json"), "utf8")
    ) as { samples?: Array<{ output?: string }> }
    const output = report.samples?.[0]?.output
    if (!output) return new Response(null, { status: 404 })
    const imagePath = path.resolve(output)
    if (!imagePath.startsWith(`${EVALUATION_ROOT}${path.sep}`)) {
      return new Response(null, { status: 403 })
    }
    return new Response(await readFile(imagePath), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
