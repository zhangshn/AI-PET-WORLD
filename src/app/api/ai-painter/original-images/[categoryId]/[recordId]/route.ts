import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { findOriginalImageRecord, resolveOriginalImageFile } from "@/server/ai-painter-original-image-library"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ categoryId: string; recordId: string }> },
) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  const { categoryId, recordId } = await context.params
  const record = await findOriginalImageRecord(categoryId, recordId)
  const file = record ? resolveOriginalImageFile(record) : null
  if (!file) return new NextResponse(null, { status: 404 })

  try {
    const image = await readFile(/* turbopackIgnore: true */ file)
    return new NextResponse(image, {
      headers: {
        "content-type": CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "no-store",
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
