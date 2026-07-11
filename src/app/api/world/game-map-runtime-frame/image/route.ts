import { readFile } from "node:fs/promises"
import { join, resolve, sep } from "node:path"

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

  const ownerGate = await readRuntimeFrameOwnerReviewGate(runtimeFrame.runtimeFrameId, compositeOutput.imageSha256)
  if (!ownerGate.canShow) {
    return NextResponse.json(
      {
        ok: false,
        status: "blocked_world_runtime_image_owner_review_required",
        ownerGate,
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

async function readRuntimeFrameOwnerReviewGate(runtimeFrameId: string, imageSha256: string) {
  const ledgerPath = join(
    process.cwd(),
    ".runtime",
    "ai-painter",
    "training-process-ledger",
    "events.jsonl",
  )

  try {
    const raw = await readFile(ledgerPath, "utf8")
    const events = raw
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map(parseLedgerLine)
      .filter((event): event is Record<string, unknown> => {
        return (
          isRecord(event) &&
          event.action === "owner_review_game_map_runtime_frame" &&
          event.archiveId === runtimeFrameId &&
          event.resourceSessionId === imageSha256
        )
      })
    const latestDecision = events.at(-1)
    if (!latestDecision) {
      return {
        status: "pending",
        canShow: false,
        reason: "owner_review_required_before_world_display",
      }
    }
    if (
      latestDecision.status === "success" ||
      latestDecision.status === "passed" ||
      latestDecision.status === "approved"
    ) {
      return {
        status: "passed",
        canShow: true,
        reason: "owner_review_passed",
        decisionTimestamp: stringValue(latestDecision.timestamp),
      }
    }
    return {
      status: "rejected",
      canShow: false,
      reason: stringValue(latestDecision.error) ?? "owner_review_failed_visual_not_final",
      decisionTimestamp: stringValue(latestDecision.timestamp),
    }
  } catch {
    return {
      status: "ledger_unreadable",
      canShow: false,
      reason: "owner_review_ledger_unreadable",
    }
  }
}

function parseLedgerLine(line: string): unknown {
  try {
    return JSON.parse(line) as unknown
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}
