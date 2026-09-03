import { NextResponse } from "next/server"

import { runAndPersistOneRuntimeTick } from "@/world/runtime/world-runtime-gateway"
import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"

export async function POST(request: Request) {
  const operatorSession = verifyLocalOperatorMutation(request)
  if (!operatorSession.ok) {
    return NextResponse.json({ ok: false, code: operatorSession.errorCode, message: "需要本机 AI Console 操作会话。" }, { status: operatorSession.status })
  }
  const worldId = new URL(request.url).searchParams.get("worldId")
  if (!worldId) {
    return NextResponse.json({ ok: false, status: "world_id_required" }, { status: 400 })
  }
  const readResult = await readWorldRuntimeSaveRecord({ worldId })

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

  const result = await runAndPersistOneRuntimeTick({ now: Date.now(), worldId })

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
      tags: ["world_runtime_tick_api", `local_operator:${operatorSession.session.actorIdentity}`, ...result.tags],
    },
    { status: result.persisted ? 200 : result.tags.includes("runtime_save_write_conflict") ? 409 : 500 }
  )
}
