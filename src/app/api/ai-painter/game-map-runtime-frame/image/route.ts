import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

import { assertRuntimePath } from "@/world/runtime/runtime-path-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const latestPaths = [
    path.join(
      /* turbopackIgnore: true */ process.cwd(),
      ".runtime",
      "game-map-runtime-frame",
      "latest-runtime-frame.json",
    ),
    path.join(
      /* turbopackIgnore: true */ process.cwd(),
      ".runtime",
      "game-map-runtime-frame-candidates",
      "latest-runtime-frame.json",
    ),
  ]

  try {
    const record = JSON.parse(await readFirstExistingFile(latestPaths)) as {
      runtimeFrame?: {
        runtimeFrameId?: string
        composition?: {
          compositeOutput?: {
            imageUrl?: string
            imageFormat?: string
            imageSha256?: string
          } | null
        }
      }
      canShowInWorld?: boolean
    }
    const imagePath = record.runtimeFrame?.composition?.compositeOutput?.imageUrl
    if (!imagePath) {
      return NextResponse.json({ ok: false, error: "game_map_runtime_image_missing" }, { status: 404 })
    }

    const imageSha256 = record.runtimeFrame?.composition?.compositeOutput?.imageSha256
    if (typeof imageSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(imageSha256)) {
      return NextResponse.json({ ok: false, error: "game_map_runtime_image_hash_missing" }, { status: 404 })
    }

    const workspaceRoot = path.resolve(process.cwd())
    let resolvedImagePath: string
    try {
      resolvedImagePath = await assertRuntimePath(path.resolve(imagePath), workspaceRoot)
    } catch {
      return NextResponse.json({ ok: false, error: "game_map_runtime_image_outside_workspace" }, { status: 403 })
    }

    const bytes = await readFile(resolvedImagePath)
    const observedSha256 = createHash("sha256").update(bytes).digest("hex")
    if (observedSha256 !== imageSha256) {
      return NextResponse.json({ ok: false, error: "game_map_runtime_image_content_sha_mismatch" }, { status: 409 })
    }
    const imageFormat = record.runtimeFrame?.composition?.compositeOutput?.imageFormat
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": imageContentType(imageFormat),
        "cache-control": "no-store",
        "x-world-runtime-image-sha256": observedSha256,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: "game_map_runtime_image_unreadable" }, { status: 404 })
  }
}

function imageContentType(format: string | undefined): string {
  if (format === "webp") return "image/webp"
  if (format === "jpg") return "image/jpeg"
  return "image/png"
}

async function readFirstExistingFile(files: string[]) {
  let lastError: unknown = null
  for (const file of files) {
    try {
      return await readFile(file, "utf8")
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}
