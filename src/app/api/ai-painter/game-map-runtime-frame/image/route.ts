import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

import { assertRuntimePath } from "@/world/runtime/runtime-path-security"
import { readLatestGameMapRuntimeFrameRecord } from "@/world/game-map-frame"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const worldId = new URL(request.url).searchParams.get("worldId")
  if (!worldId) {
    return NextResponse.json({ ok: false, error: "world_id_required_for_runtime_image" }, { status: 400 })
  }
  const recordRead = await readLatestGameMapRuntimeFrameRecord({ worldId })
  const runtimeFrame = recordRead.record?.runtimeFrame
  if (
    recordRead.status !== "found" ||
    !recordRead.record ||
    !runtimeFrame ||
    recordRead.record.canShowInWorld !== true ||
    runtimeFrame.worldPageContract.canShowInWorld !== true ||
    runtimeFrame.composition.compositionStatus.canEnterWorld !== true
  ) {
    return NextResponse.json({ ok: false, error: "game_map_runtime_image_blocked" }, { status: 404 })
  }

  try {
    const imagePath = runtimeFrame.composition.compositeOutput?.imageUrl
    if (!imagePath) {
      return NextResponse.json({ ok: false, error: "game_map_runtime_image_missing" }, { status: 404 })
    }

    const imageSha256 = runtimeFrame.composition.compositeOutput?.imageSha256
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
    const imageFormat = runtimeFrame.composition.compositeOutput?.imageFormat
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
