import { executeAiConsoleReviewAdjudicationRegistryCommand, parseAiConsoleReviewAdjudicationCommandInput } from "@/server/ai-console-control/review-adjudication-command-service"
import { readAiConsoleReviewAdjudicationStore, reviewAdjudicationStoreLogicalPath } from "@/server/ai-console-control/review-adjudication-store"
import { verifyLocalControlRead, verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"

export const dynamic = "force-dynamic"

export function GET(request: Request) {
  const localRead = verifyLocalControlRead(request)
  if (!localRead.ok) return reviewAdjudicationError(localRead.errorCode, localRead.status)
  const store = readAiConsoleReviewAdjudicationStore()
  if (store.status !== "connected") return reviewAdjudicationError(store.reasonCode, store.status === "not_connected" ? 503 : 409)
  return Response.json({
    ok: true,
    schemaVersion: "ai_console_review_adjudication_command_service_v1",
    serviceStatus: "ready",
    executorIdentity: "ai_console_review_adjudication_executor_v1",
    executionBoundary: "new_ai_console_review_adjudication_registry_only",
    decisionBoundary: "server_recomputes_terminal_status_from_frozen_contract",
    supportedCommandTypes: ["register_review_contract", "register_machine_review_observation"],
    registryRevision: store.metadata.registryRevision,
    storeRevision: store.metadata.storeRevision,
    reviewContractCount: store.metadata.reviewContractCount,
    reviewResultCount: store.metadata.reviewResultCount,
    reviewContracts: store.reviewContracts.map((contract) => ({
      reviewContractId: contract.reviewContractId,
      capabilityDomain: contract.capabilityDomain,
      reviewerIdentity: contract.reviewerIdentity,
      reviewerVersion: contract.reviewerVersion,
      metricDefinitionId: contract.metricDefinitionId,
      thresholdOperator: contract.thresholdOperator,
      thresholdValue: contract.thresholdValue,
      thresholdUnit: contract.thresholdUnit,
      failureCode: contract.failureCode,
      contractStatus: contract.contractStatus,
    })),
    reviewResults: store.reviewResults.map((result) => ({
      reviewResultId: result.reviewResultId,
      reviewRunId: result.reviewRunId,
      reviewContractId: result.reviewContractId,
      reviewNodeId: result.reviewNodeId,
      reviewerIdentity: result.reviewerIdentity,
      metricValue: result.metricValue,
      reviewStatus: result.reviewStatus,
      resultTerminalStatus: result.resultTerminalStatus,
    })),
    storeLogicalPath: reviewAdjudicationStoreLogicalPath,
  }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const verification = verifyLocalOperatorMutation(request)
  if (!verification.ok) return reviewAdjudicationError(verification.errorCode, verification.status)
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > 12288) return reviewAdjudicationError("review_adjudication_command_body_too_large", 413)
  const rawBody = await request.text()
  if (rawBody.length > 12288) return reviewAdjudicationError("review_adjudication_command_body_too_large", 413)
  let parsed: unknown
  try { parsed = JSON.parse(rawBody) } catch { return reviewAdjudicationError("review_adjudication_command_body_invalid_json", 400) }
  const parsedInput = parseAiConsoleReviewAdjudicationCommandInput(parsed)
  if (!parsedInput.ok) return reviewAdjudicationError(parsedInput.errorCode, 400)
  try {
    const result = executeAiConsoleReviewAdjudicationRegistryCommand(parsedInput.input, verification.session)
    return Response.json({
      ok: result.receipt.executionStatus === "succeeded",
      schemaVersion: "ai_console_review_adjudication_command_service_v1",
      replayed: result.replayed,
      integrityStatus: "verified",
      storeLogicalPath: reviewAdjudicationStoreLogicalPath,
      receipt: result.receipt,
      reviewContract: result.reviewContract,
      reviewResult: result.reviewResult,
      event: result.event,
    }, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "ai_console_review_adjudication_command_failed"
    return reviewAdjudicationError(errorCode, errorCode === "ai_console_review_command_idempotency_conflict" ? 409 : 500)
  }
}

function reviewAdjudicationError(errorCode: string, status: number) {
  return Response.json({ ok: false, schemaVersion: "ai_console_review_adjudication_command_service_v1", errorCode }, { status, headers: { "Cache-Control": "no-store" } })
}
