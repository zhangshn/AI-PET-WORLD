import { readFile } from "node:fs/promises"
import { resolve, sep } from "node:path"

import { NextResponse, type NextRequest } from "next/server"

import { readLatestGameMapRuntimeFrameRecord } from "@/world/game-map-frame"

export const dynamic = "force-dynamic"

const WORLD_FORMAL_JUDGE_REQUIRED_TAG = "formal_game_map_visual_judge_passed"

export async function GET(request: NextRequest) {
  const recordRead = await readLatestGameMapRuntimeFrameRecord()
  const runtimeFrame = recordRead.record?.runtimeFrame ?? null
  const compositeOutput = runtimeFrame?.composition.compositeOutput ?? null

  if (
    runtimeFrame === null ||
    compositeOutput === null ||
    runtimeFrame.worldPageContract.canShowInWorld !== true ||
    runtimeFrame.composition.compositionStatus.canEnterWorld !== true ||
    !compositeOutput.tags.includes("runtime_compositor_from_ai_visual_units") ||
    !compositeOutput.tags.includes(WORLD_FORMAL_JUDGE_REQUIRED_TAG)
  ) {
    return NextResponse.json(
      {
        ok: false,
        status: "blocked_world_runtime_image_not_ready",
      },
      { status: 404 },
    )
  }

  const requestedSha = request.nextUrl.searchParams.get("sha")
  if (requestedSha !== null && requestedSha !== compositeOutput.imageSha256) {
    return NextResponse.json(
      {
        ok: false,
        status: "blocked_world_runtime_image_sha_mismatch",
      },
      { status: 404 },
    )
  }

  const workspaceRoot = resolve(process.cwd())
  const imagePath = resolve(compositeOutput.imageUrl)
  const rootPrefix = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`
  const normalizedRootPrefix = rootPrefix.toLowerCase()
  const normalizedImagePath = imagePath.toLowerCase()

  if (!normalizedImagePath.startsWith(normalizedRootPrefix)) {
    return NextResponse.json(
      {
        ok: false,
        status: "blocked_world_runtime_image_outside_workspace",
      },
      { status: 403 },
    )
  }

  const bytes = await readFile(imagePath)

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-World-Runtime-Image-Sha256": compositeOutput.imageSha256,
    },
  })
}
