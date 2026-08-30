import { executeAiConsoleCapabilityLifecycleCommand, parseAiConsoleCapabilityCommandInput } from "@/server/ai-console-control/capability-command-service"
import { capabilityLifecycleStoreLogicalPath, readAiConsoleCapabilityLifecycleStore } from "@/server/ai-console-control/capability-lifecycle-store"
import { verifyLocalControlRead, verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"

export const dynamic = "force-dynamic"

export function GET(request: Request) {
  const localRead = verifyLocalControlRead(request)
  if (!localRead.ok) return capabilityCommandError(localRead.errorCode, localRead.status)
  const storeRead = readAiConsoleCapabilityLifecycleStore()
  if (storeRead.status !== "connected") return capabilityCommandError(storeRead.reasonCode, storeRead.status === "not_connected" ? 503 : 409)
  return Response.json({
    ok: true,
    schemaVersion: "ai_console_capability_command_service_v1",
    serviceStatus: "ready",
    executorIdentity: "ai_console_capability_lifecycle_executor_v1",
    executionBoundary: "new_ai_console_capability_registry_only",
    supportedCommandTypes: ["register_capability_candidate", "record_capability_qualification", "register_qualified_capability_release"],
    registryRevision: storeRead.metadata.registryRevision,
    storeRevision: storeRead.metadata.storeRevision,
    candidateCount: storeRead.metadata.candidateCount,
    qualificationCount: storeRead.metadata.qualificationCount,
    releaseCount: storeRead.metadata.releaseCount,
    candidates: storeRead.candidates.map((candidate) => ({
      capabilityVersionId: candidate.capabilityVersionId,
      capabilityDomain: candidate.capabilityDomain,
      modelIdentity: candidate.modelIdentity,
      datasetReleaseIdentity: candidate.datasetReleaseIdentity,
      qualificationStage: candidate.qualificationStage,
      candidateStatus: candidate.candidateStatus,
      candidateRevision: candidate.candidateRevision,
    })),
    releases: storeRead.releases.map((release) => ({
      capabilityReleaseIdentity: release.capabilityReleaseIdentity,
      capabilityDomain: release.capabilityDomain,
      capabilityVersionId: release.capabilityVersionId,
      releaseStatus: release.releaseStatus,
    })),
    storeLogicalPath: capabilityLifecycleStoreLogicalPath,
  }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const verification = verifyLocalOperatorMutation(request)
  if (!verification.ok) return capabilityCommandError(verification.errorCode, verification.status)
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > 12288) return capabilityCommandError("capability_command_body_too_large", 413)
  const rawBody = await request.text()
  if (rawBody.length > 12288) return capabilityCommandError("capability_command_body_too_large", 413)
  let parsed: unknown
  try { parsed = JSON.parse(rawBody) } catch { return capabilityCommandError("capability_command_body_invalid_json", 400) }
  const parsedInput = parseAiConsoleCapabilityCommandInput(parsed)
  if (!parsedInput.ok) return capabilityCommandError(parsedInput.errorCode, 400)
  try {
    const result = executeAiConsoleCapabilityLifecycleCommand(parsedInput.input, verification.session)
    return Response.json({
      ok: result.receipt.executionStatus === "succeeded",
      schemaVersion: "ai_console_capability_command_service_v1",
      replayed: result.replayed,
      integrityStatus: "verified",
      storeLogicalPath: capabilityLifecycleStoreLogicalPath,
      receipt: result.receipt,
      candidate: result.candidate,
      qualification: result.qualification,
      release: result.release,
      event: result.event,
    }, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "ai_console_capability_command_failed"
    return capabilityCommandError(errorCode, errorCode === "ai_console_capability_command_idempotency_conflict" ? 409 : 500)
  }
}

function capabilityCommandError(errorCode: string, status: number) {
  return Response.json({ ok: false, schemaVersion: "ai_console_capability_command_service_v1", errorCode }, { status, headers: { "Cache-Control": "no-store" } })
}
