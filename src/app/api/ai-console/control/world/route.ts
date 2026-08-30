import { executeAiConsoleWorldControlRegistryCommand, parseAiConsoleWorldControlCommandInput } from "@/server/ai-console-control/world-control-command-service"
import { readAiConsoleRuntimeReleaseRegistryStore } from "@/server/ai-console-control/runtime-release-registry-store"
import { readAiConsoleWorldControlRegistryStore, worldControlRegistryStoreLogicalPath } from "@/server/ai-console-control/world-control-registry-store"
import { verifyLocalControlRead, verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"

export const dynamic = "force-dynamic"

const schemaVersion = "ai_console_world_control_command_service_v1"
const supportedCommandTypes = [
  "consume_registered_runtime_frame",
  "pause_frame_publish",
  "resume_frame_publish",
  "rollback_runtime_frame",
  "freeze_visual_updates",
] as const

export function GET(request: Request) {
  const localRead = verifyLocalControlRead(request)
  if (!localRead.ok) return worldControlError(localRead.errorCode, localRead.status)
  const store = readAiConsoleWorldControlRegistryStore()
  if (store.status !== "connected") return worldControlError(store.reasonCode, store.status === "not_connected" ? 503 : 409)
  const runtimeReleaseStore = readAiConsoleRuntimeReleaseRegistryStore()
  if (runtimeReleaseStore.status !== "connected") return worldControlError("world_control_runtime_release_registry_unavailable", 409)
  return Response.json({
    ok: true,
    schemaVersion,
    serviceStatus: "ready",
    executorIdentity: "ai_console_world_control_executor_v1",
    executionBoundary: "new_ai_console_only",
    supportedCommandTypes,
    registryRevision: store.metadata.registryRevision,
    storeRevision: store.metadata.storeRevision,
    worldCount: store.metadata.worldCount,
    worldStateCount: store.metadata.worldStateCount,
    commandCount: store.metadata.commandCount,
    eventCount: store.metadata.eventCount,
    currentWorldStates: store.currentWorldStates,
    stateHistory: store.stateHistory,
    events: store.events,
    receipts: store.receipts,
    publications: runtimeReleaseStore.publications.map((publication) => ({
      publishIdentity: publication.publishIdentity,
      runtimeFrameIdentity: publication.runtimeFrameIdentity,
      previousRuntimeFrameIdentity: publication.previousRuntimeFrameIdentity,
      worldId: publication.worldId,
      tick: publication.tick,
      runtimeFrameStatus: publication.runtimeFrameStatus,
    })),
    storeLogicalPath: worldControlRegistryStoreLogicalPath,
  }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const verification = verifyLocalOperatorMutation(request)
  if (!verification.ok) return worldControlError(verification.errorCode, verification.status)
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > 12288) return worldControlError("world_control_command_body_too_large", 413)
  const rawBody = await request.text()
  if (rawBody.length > 12288) return worldControlError("world_control_command_body_too_large", 413)
  let parsed: unknown
  try { parsed = JSON.parse(rawBody) } catch { return worldControlError("world_control_command_body_invalid_json", 400) }
  const parsedInput = parseAiConsoleWorldControlCommandInput(parsed)
  if (!parsedInput.ok) return worldControlError(parsedInput.errorCode, 400)
  try {
    const result = executeAiConsoleWorldControlRegistryCommand(parsedInput.input, verification.session)
    return Response.json({
      ok: result.receipt.executionStatus === "succeeded",
      schemaVersion,
      replayed: result.replayed,
      integrityStatus: "verified",
      executionBoundary: "new_ai_console_only",
      storeLogicalPath: worldControlRegistryStoreLogicalPath,
      receipt: result.receipt,
      worldState: result.worldState,
      event: result.event,
    }, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "ai_console_world_control_command_failed"
    return worldControlError(errorCode, errorCode === "ai_console_world_control_command_idempotency_conflict" ? 409 : 500)
  }
}

function worldControlError(errorCode: string, status: number) {
  return Response.json({ ok: false, schemaVersion, errorCode }, { status, headers: { "Cache-Control": "no-store" } })
}
