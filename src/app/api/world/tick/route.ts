import { NextResponse } from "next/server"

import { runAndPersistOneRuntimeTick } from "@/world/runtime/world-runtime-gateway"
import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store"

export async function POST() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Runtime world has not been created yet. Create a world before ticking it.",
        readStatus: readResult.status,
        tags: [
          "world_runtime_tick_api",
          "runtime_save_required",
          ...readResult.tags,
        ],
      },
      { status: 409 }
    )
  }

  const result = await runAndPersistOneRuntimeTick({ now: Date.now() })

  return NextResponse.json(
    {
      ok: result.persisted,
      worldId: result.nextSaveRecord.worldId,
      ownerId: result.nextSaveRecord.ownerId,
      previousTick: result.previousSaveRecord.tick,
      tick: result.nextSaveRecord.tick,
      persisted: result.persisted,
      audit: result.audit,
      messages: result.messages,
      tags: ["world_runtime_tick_api", ...result.tags],
    },
    { status: result.persisted ? 200 : 500 }
  )
}
