import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })

  const relativePath = request.nextUrl.searchParams.get("path")
  const file = resolveTrainingImageFile(relativePath)
  if (!file) return new NextResponse(null, { status: 403 })

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

function resolveTrainingImageFile(relativePath: string | null) {
  if (!relativePath) return null
  const normalizedRelativePath = relativePath.replace(/\\/g, "/")
  if (!normalizedRelativePath.startsWith(".runtime/")) return null
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(normalizedRelativePath).toLowerCase())) return null

  const workspaceRoot = process.cwd()
  const absolutePath = path.resolve(workspaceRoot, normalizedRelativePath)
  const allowed = trainingImageRoots(workspaceRoot).some((root) => {
    const absoluteRoot = path.resolve(root)
    return absolutePath === absoluteRoot || absolutePath.startsWith(`${absoluteRoot}${path.sep}`)
  })
  return allowed ? absolutePath : null
}

function trainingImageRoots(workspaceRoot: string) {
  return [
    path.resolve(/* turbopackIgnore: true */ workspaceRoot, ".runtime", "ai-painter"),
    path.resolve(/* turbopackIgnore: true */ workspaceRoot, ".runtime", "game-map-material-slot-inference-runs"),
    path.resolve(/* turbopackIgnore: true */ workspaceRoot, ".runtime", "game-map-runtime-compositor"),
    path.resolve(/* turbopackIgnore: true */ workspaceRoot, ".runtime", "game-map-runtime-frame-candidates"),
  ]
}
