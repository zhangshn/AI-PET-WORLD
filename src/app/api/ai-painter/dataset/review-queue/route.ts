import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

const ROOT = path.join(process.cwd(), "data", "ai-painter-datasets", "incoming")

export async function GET() {
  try {
    const entries = await readdir(ROOT, { withFileTypes: true })
    const drafts = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      try {
        const metadata = JSON.parse(
          await readFile(path.join(ROOT, entry.name, "metadata.json"), "utf8")
        ) as { source?: { humanApproved?: boolean }; subtype?: string; notes?: string }
        if (metadata.source?.humanApproved === false) {
          drafts.push({
            sampleId: entry.name,
            subtype: metadata.subtype ?? "",
            notes: metadata.notes ?? "",
            imageUrl: `/api/ai-painter/dataset/review-queue/${encodeURIComponent(entry.name)}/image`,
          })
        }
      } catch { /* Ignore incomplete incoming uploads. */ }
    }
    return NextResponse.json({ ok: true, drafts })
  } catch {
    return NextResponse.json({ ok: true, drafts: [] })
  }
}
