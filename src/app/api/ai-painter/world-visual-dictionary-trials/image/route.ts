import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const root = process.cwd()
const trialsRoot = path.join(root, ".runtime", "world-visual-dictionary-trials")

export async function GET(request: NextRequest) {
  const recordId = request.nextUrl.searchParams.get("recordId")
  const latest = await readJson(path.join(trialsRoot, "latest.json"))
  const effectiveRecordId = recordId && recordId !== "latest" ? recordId : latest?.latestRecordId
  if (!effectiveRecordId || !isSafeRecordId(effectiveRecordId)) {
    return new NextResponse("Missing trial record image", { status: 404 })
  }

  const record = await readJson(path.join(trialsRoot, effectiveRecordId, "review-record.json"))
  const imagePath = resolveSafeProjectPath(record?.storedImagePath)
  if (!imagePath) return new NextResponse("Missing trial record image", { status: 404 })

  try {
    const image = await readFile(imagePath)
    return new NextResponse(image, {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
      },
    })
  } catch {
    return new NextResponse("Missing trial record image", { status: 404 })
  }
}

function isSafeRecordId(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value)
}

function resolveSafeProjectPath(value: unknown) {
  if (typeof value !== "string") return null
  const absolutePath = path.isAbsolute(value) ? value : path.join(root, value)
  const normalized = path.normalize(absolutePath)
  if (!normalized.startsWith(root) || !normalized.includes(`${path.sep}.runtime${path.sep}world-visual-dictionary-trials${path.sep}`)) {
    return null
  }
  return normalized
}

async function readJson(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"))
  } catch {
    return null
  }
}
