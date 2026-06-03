import { NextResponse } from "next/server"

import { serializeCreateWorldInput } from "@/world/creation/world-creation-client-schema"
import { parseCreateWorldInput } from "@/world/creation/world-creation-runtime"
import { createRuntimeWorldFromCreateWorldInput } from "@/world/runtime/world-runtime-gateway"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsedInput = parseCreateWorldInput(
    typeof body === "string" ? body : serializeBody(body)
  )

  if (!parsedInput) {
    return NextResponse.json(
      {
        ok: false,
        message: "Create world failed. Please check the birth input.",
        tags: ["create_world_to_world_flow", "invalid_create_world_input"],
      },
      { status: 400 }
    )
  }

  const result = await createRuntimeWorldFromCreateWorldInput({
    createWorldInput: parsedInput,
  })

  if (!result.persisted) {
    return NextResponse.json(
      {
        ok: false,
        message: "World save did not persist. Please try again later.",
        tags: result.tags,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    worldId: result.saveRecord.worldId,
    ownerId: result.saveRecord.ownerId,
    tick: result.saveRecord.tick,
    message: "World created and persisted.",
    tags: [
      "create_world_to_world_flow",
      "runtime_save_persisted",
      "no_default_pet_fact",
    ],
  })
}

function serializeBody(value: unknown): string | null {
  if (!value || typeof value !== "object") return null

  try {
    return serializeCreateWorldInput(
      value as Parameters<typeof serializeCreateWorldInput>[0]
    )
  } catch {
    return null
  }
}
