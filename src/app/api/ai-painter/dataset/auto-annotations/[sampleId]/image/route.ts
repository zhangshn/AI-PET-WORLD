import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

const DATASET_ROOT = path.join(process.cwd(), "data", "ai-painter-datasets")
const AUTO_SCENE_ROOT = path.join(DATASET_ROOT, "accepted", "dataset_v1", "scene", "world")
const SAMPLE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/u

type JsonObject = Record<string, unknown>

export async function GET(_request: Request, context: { params: Promise<{ sampleId: string }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  const { sampleId } = await context.params
  if (!SAMPLE_ID_PATTERN.test(sampleId)) return new NextResponse(null, { status: 404 })
  try {
    const metadata = await readJson(path.join(AUTO_SCENE_ROOT, sampleId, "metadata.json"))
    const sourceOriginal = isObject(metadata.files) && isObject(metadata.files.sourceOriginal) ? metadata.files.sourceOriginal : null
    const relativePath = sourceOriginal && typeof sourceOriginal.path === "string" ? sourceOriginal.path : ""
    const imagePath = safeDatasetPath(relativePath)
    if (!imagePath) return new NextResponse(null, { status: 404 })
    const image = await readFile(imagePath)
    return new NextResponse(image, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}

async function readJson(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as JsonObject
}

function safeDatasetPath(relativePath: string) {
  if (!relativePath || path.isAbsolute(relativePath)) return null
  const resolved = path.resolve(DATASET_ROOT, relativePath)
  const root = path.resolve(DATASET_ROOT)
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
