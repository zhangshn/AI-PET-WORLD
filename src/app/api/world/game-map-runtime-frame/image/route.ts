import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { NextResponse, type NextRequest } from "next/server"

import { readLatestGameMapRuntimeFrameRecord } from "@/world/game-map-frame"
import { assertRuntimePath } from "@/world/runtime/runtime-path-security"

export const dynamic = "force-dynamic"

const WORLD_FORMAL_JUDGE_REQUIRED_TAG = "formal_game_map_visual_judge_passed"

export async function GET(request: NextRequest) {
  const worldId = request.nextUrl.searchParams.get("worldId")
  if (!worldId) {
    return NextResponse.json(
      { ok: false, status: "world_id_required_for_runtime_image" },
      { status: 400 },
    )
  }
  const requestedTick = request.nextUrl.searchParams.get("tick")
  const tick = requestedTick === null ? undefined : Number(requestedTick)
  if (requestedTick !== null && (!Number.isInteger(tick) || (tick as number) < 0)) {
    return NextResponse.json({ ok: false, status: "runtime_tick_invalid" }, { status: 400 })
  }
  const recordRead = await readLatestGameMapRuntimeFrameRecord({
    worldId,
    ...(tick === undefined ? {} : { currentTick: tick }),
  })
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

  if (!/^[a-f0-9]{64}$/u.test(compositeOutput.imageSha256)) {
    return NextResponse.json(
      {
        ok: false,
        status: "blocked_world_runtime_image_hash_missing",
      },
      { status: 404 },
    )
  }

  const workspaceRoot = resolve(process.cwd())
  let imagePath: string
  try {
    imagePath = await assertRuntimePath(resolve(compositeOutput.imageUrl), workspaceRoot)
  } catch {
    return NextResponse.json(
      { ok: false, status: "blocked_world_runtime_image_outside_workspace" },
      { status: 403 },
    )
  }

  let bytes: Buffer
  try {
    bytes = await readFile(imagePath)
  } catch {
    return NextResponse.json(
      { ok: false, status: "blocked_world_runtime_image_unreadable" },
      { status: 404 },
    )
  }
  const observedSha256 = createHash("sha256").update(bytes).digest("hex")
  if (observedSha256 !== compositeOutput.imageSha256) {
    return NextResponse.json(
      { ok: false, status: "blocked_world_runtime_image_content_sha_mismatch" },
      { status: 409 },
    )
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": imageContentType(compositeOutput.imageFormat),
      "Cache-Control": "no-store",
      "X-World-Runtime-Image-Sha256": observedSha256,
    },
  })
}

function imageContentType(format: string): string {
  if (format === "webp") return "image/webp"
  if (format === "jpg") return "image/jpeg"
  return "image/png"
}
