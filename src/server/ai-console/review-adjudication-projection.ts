import { createHash } from "node:crypto"
import { readAiConsoleReviewAdjudicationStore, reviewAdjudicationStoreLogicalPath, type AiConsoleMachineReviewResultRecord } from "@/server/ai-console-control/review-adjudication-store"
import { createNotConnectedProjection, createProjection, createUnknownOrStaleProjection, type AiConsoleProjectionResult } from "./projection-contract"

const connectedWorkspaces = ["contracts", "results", "failures"] as const

export function getAiConsoleReviewAdjudicationProjectionAvailability(workspaceSlug: string): "connected" | "not_connected" {
  return connectedWorkspaces.includes(workspaceSlug as (typeof connectedWorkspaces)[number]) ? "connected" : "not_connected"
}

export function queryAiConsoleReviewAdjudicationProjection(workspaceSlug: string): AiConsoleProjectionResult {
  if (!connectedWorkspaces.includes(workspaceSlug as (typeof connectedWorkspaces)[number])) return createNotConnectedProjection("review_adjudication_workspace_not_connected")
  const store = readAiConsoleReviewAdjudicationStore()
  if (store.status !== "connected") {
    if (store.status === "not_connected") return createNotConnectedProjection(store.reasonCode)
    return createUnknownOrStaleProjection({ sourceIdentity: "ai_console_review_adjudication_registry", writerIdentity: "ai_console_review_adjudication_writer_v1", reasonCode: store.reasonCode, evidenceReferences: store.evidenceReferences })
  }
  const records: readonly Record<string, unknown>[] = workspaceSlug === "contracts"
    ? store.reviewContracts
    : workspaceSlug === "results"
      ? store.reviewResults
      : store.reviewResults.filter((result) => result.reviewStatus === "failed").map(toFailureProjection)
  return createProjection({
    sourceIdentity: "ai_console_review_adjudication_registry",
    writerIdentity: store.metadata.writerIdentity,
    observedAtUtc: new Date().toISOString(),
    sourceRevision: store.metadata.registryRevision,
    evidenceReferences: [...new Set([...store.evidenceReferences, reviewAdjudicationStoreLogicalPath])],
    trustStatus: "verified_registry",
    records,
  })
}

function toFailureProjection(result: AiConsoleMachineReviewResultRecord): Record<string, unknown> {
  const content = {
    reviewResultId: result.reviewResultId,
    reviewRunId: result.reviewRunId,
    reviewContractId: result.reviewContractId,
    failureCode: result.failureCode,
    affectedScope: result.affectedScope,
    evidenceSha256: result.evidenceSha256,
  }
  return {
    failureId: sha256(`ai_console_review_failure_projection_v1\n${result.reviewResultId}`),
    ...content,
    failureCategory: "machine_threshold_not_met",
    repairEligibility: "requires_new_validation_input_and_review_run",
    failureRecordSha256: sha256(JSON.stringify(content)),
  }
}

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex") }
