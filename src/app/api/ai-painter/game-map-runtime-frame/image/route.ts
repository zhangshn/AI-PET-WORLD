import { readFile } from "node:fs/promises"
import path, { resolve, sep } from "node:path"
import { NextResponse } from "next/server"

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
    const imageSha256 = record.runtimeFrame?.composition?.compositeOutput?.imageSha256
    const runtimeFrameId = record.runtimeFrame?.runtimeFrameId
    if (!imagePath) {
      return NextResponse.json({ ok: false, error: "game_map_runtime_image_missing" }, { status: 404 })
    }

    const ownerGate = await readRuntimeFrameOwnerReviewGate({ runtimeFrameId, imageSha256 })
    if (ownerGate.status === "rejected") {
      return NextResponse.json(
        {
          ok: false,
          error: "game_map_runtime_image_owner_rejected",
          ownerGate,
        },
        { status: 404 },
      )
    }

    const workspaceRoot = resolve(process.cwd())
    const resolvedImagePath = resolve(imagePath)
    const rootPrefix = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`
    if (!resolvedImagePath.toLowerCase().startsWith(rootPrefix.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "game_map_runtime_image_outside_workspace" }, { status: 403 })
    }

    const bytes = await readFile(resolvedImagePath)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: "game_map_runtime_image_unreadable" }, { status: 404 })
  }
}

async function readRuntimeFrameOwnerReviewGate(input: {
  runtimeFrameId?: string
  imageSha256?: string
}) {
  if (!input.runtimeFrameId || !input.imageSha256) {
    return {
      status: "missing_identity",
      canShow: false,
      reason: "runtime_frame_or_image_identity_missing",
    }
  }

  const ledgerPath = path.join(
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
          event.archiveId === input.runtimeFrameId &&
          event.resourceSessionId === input.imageSha256
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
