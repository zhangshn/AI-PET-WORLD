import { executeAiConsoleRuntimeReleaseRegistryCommand, parseAiConsoleRuntimeReleaseCommandInput } from "@/server/ai-console-control/runtime-release-command-service"
import { readAiConsoleCapabilityLifecycleStore } from "@/server/ai-console-control/capability-lifecycle-store"
import { readAiConsoleReviewAdjudicationStore } from "@/server/ai-console-control/review-adjudication-store"
import { readAiConsoleRuntimeReleaseRegistryStore, runtimeReleaseRegistryStoreLogicalPath } from "@/server/ai-console-control/runtime-release-registry-store"
import { verifyLocalControlRead, verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"

export const dynamic = "force-dynamic"

export function GET(request: Request) {
  const localRead = verifyLocalControlRead(request)
  if (!localRead.ok) return runtimeReleaseError(localRead.errorCode, localRead.status)
  const store = readAiConsoleRuntimeReleaseRegistryStore()
  if (store.status !== "connected") return runtimeReleaseError(store.reasonCode, store.status === "not_connected" ? 503 : 409)
  const capabilityStore = readAiConsoleCapabilityLifecycleStore()
  const reviewStore = readAiConsoleReviewAdjudicationStore()
  if (capabilityStore.status !== "connected" || reviewStore.status !== "connected") return runtimeReleaseError("runtime_release_source_registry_unavailable", 409)
  const activeByDomain = new Map(store.activations.map((activation) => [activation.capabilityDomain, activation]))
  return Response.json({ ok: true, schemaVersion: "ai_console_runtime_release_command_service_v1", serviceStatus: "ready", executorIdentity: "ai_console_runtime_release_executor_v1", executionBoundary: "new_ai_console_runtime_release_registry_only", supportedCommandTypes: ["activate_qualified_release", "register_runtime_frame_candidate", "publish_reviewed_runtime_frame"], registryRevision: store.metadata.registryRevision, storeRevision: store.metadata.storeRevision, activationCount: store.metadata.activationCount, candidateCount: store.metadata.candidateCount, publicationCount: store.metadata.publicationCount,
    qualifiedReleases: capabilityStore.releases.map((release) => ({ capabilityReleaseIdentity: release.capabilityReleaseIdentity, capabilityDomain: release.capabilityDomain, capabilityVersionId: release.capabilityVersionId, releaseStatus: activeByDomain.get(release.capabilityDomain)?.capabilityReleaseIdentity === release.capabilityReleaseIdentity ? "active" : "registered_inactive", releaseRecordSha256: release.releaseRecordSha256 })),
    activations: store.activations.map((activation) => ({ activationId: activation.activationId, capabilityDomain: activation.capabilityDomain, capabilityReleaseIdentity: activation.capabilityReleaseIdentity, activationStatus: activeByDomain.get(activation.capabilityDomain)?.activationId === activation.activationId ? "active" : "superseded", activatedAtUtc: activation.activatedAtUtc })),
    candidates: store.candidates.map((candidate) => ({ runtimeFrameCandidateIdentity: candidate.runtimeFrameCandidateIdentity, activationId: candidate.activationId, capabilityDomain: candidate.capabilityDomain, capabilityReleaseIdentity: candidate.capabilityReleaseIdentity, worldId: candidate.worldId, tick: candidate.tick, candidateStatus: candidate.candidateStatus })),
    reviewResults: reviewStore.reviewResults.map((result) => ({ reviewResultId: result.reviewResultId, validationInputIdentity: result.validationInputIdentity, capabilityDomain: result.capabilityDomain, reviewStatus: result.reviewStatus })),
    publications: store.publications.map((publication) => ({ publishIdentity: publication.publishIdentity, runtimeFrameIdentity: publication.runtimeFrameIdentity, runtimeFrameCandidateIdentity: publication.runtimeFrameCandidateIdentity, worldId: publication.worldId, tick: publication.tick, runtimeFrameStatus: publication.runtimeFrameStatus })), storeLogicalPath: runtimeReleaseRegistryStoreLogicalPath }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const verification = verifyLocalOperatorMutation(request)
  if (!verification.ok) return runtimeReleaseError(verification.errorCode, verification.status)
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > 12288) return runtimeReleaseError("runtime_release_command_body_too_large", 413)
  const rawBody = await request.text()
  if (rawBody.length > 12288) return runtimeReleaseError("runtime_release_command_body_too_large", 413)
  let parsed: unknown
  try { parsed = JSON.parse(rawBody) } catch { return runtimeReleaseError("runtime_release_command_body_invalid_json", 400) }
  const parsedInput = parseAiConsoleRuntimeReleaseCommandInput(parsed)
  if (!parsedInput.ok) return runtimeReleaseError(parsedInput.errorCode, 400)
  try { const result = executeAiConsoleRuntimeReleaseRegistryCommand(parsedInput.input, verification.session); return Response.json({ ok: result.receipt.executionStatus === "succeeded", schemaVersion: "ai_console_runtime_release_command_service_v1", replayed: result.replayed, integrityStatus: "verified", storeLogicalPath: runtimeReleaseRegistryStoreLogicalPath, receipt: result.receipt, activation: result.activation, candidate: result.candidate, publication: result.publication, event: result.event }, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } }) }
  catch (error) { const errorCode = error instanceof Error ? error.message : "ai_console_runtime_release_command_failed"; return runtimeReleaseError(errorCode, errorCode === "ai_console_runtime_release_command_idempotency_conflict" ? 409 : 500) }
}

function runtimeReleaseError(errorCode: string, status: number) { return Response.json({ ok: false, schemaVersion: "ai_console_runtime_release_command_service_v1", errorCode }, { status, headers: { "Cache-Control": "no-store" } }) }
