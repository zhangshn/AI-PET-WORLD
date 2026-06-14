import { readFile } from "node:fs/promises"
import path from "node:path"

const SAFE_ID = /^[a-zA-Z0-9_-]+$/

export async function GET(_request: Request, context: { params: Promise<{ assetId: string; view: string }> }) {
  const { assetId, view } = await context.params
  if (!SAFE_ID.test(assetId)) return new Response(null, { status: 400 })

  const fileParts = resolveView(view)
  if (!fileParts) return new Response(null, { status: 404 })

  const accepted = path.join(process.cwd(), "data", "ai-painter-assets", "accepted", assetId, ...fileParts)
  const candidate = path.join(process.cwd(), "data", "ai-painter-assets", "candidates", assetId, ...fileParts)
  const engineering = path.join(process.cwd(), "data", "ai-painter-assets", "engineering", assetId, ...fileParts)
  try {
    const image = await readFirst(accepted, candidate, engineering)
    return new Response(image, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}

function resolveView(view: string) {
  if (view === "sprite") return ["sprite.png"]
  if (!view.startsWith("mask-")) return null
  const channel = view.slice(5)
  return SAFE_ID.test(channel) ? ["masks", `${channel}.png`] : null
}

async function readFirst(primary: string, secondary: string, fallback: string) {
  try {
    return await readFile(primary)
  } catch {
    try {
      return await readFile(secondary)
    } catch {
      return readFile(fallback)
    }
  }
}
