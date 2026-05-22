/**
 * 当前文件职责：生成建设系统纵向闭环报告。
 */

import type {
  ConstructionFullPipelineAudit,
  ConstructionMemoryPersistenceMockResult,
  ConstructionPipelineReport,
  ConstructionRuntimeCycleResult,
  ConstructionVisualRefreshBridgeResult,
} from "./construction-schema"

export function buildConstructionPipelineReport(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
  fullPipelineAudit: ConstructionFullPipelineAudit
}): ConstructionPipelineReport {
  return {
    reportId: buildReportId(input),
    worldId: input.fullPipelineAudit.worldId,
    ownerId: input.fullPipelineAudit.ownerId,
    status: resolveReportStatus(input),
    selectedPlanId: input.fullPipelineAudit.selectedPlanId,
    acceptedDiffCount: input.fullPipelineAudit.acceptedDiffIds.length,
    rejectedDiffCount: input.fullPipelineAudit.rejectedDiffIds.length,
    changedPlacementCount:
      input.visualRefreshBridgeResult.changedPlacementIds.length,
    shouldPersist: input.fullPipelineAudit.shouldPersist,
    shouldRefresh: input.fullPipelineAudit.shouldRefresh,
    messages: [
      ...input.runtimeCycleResult.messages,
      input.memoryPersistenceMockResult.reason,
      input.visualRefreshBridgeResult.reason,
      ...input.fullPipelineAudit.warnings.map(
        (warning) => `Pipeline audit warning: ${warning}`
      ),
    ],
    tags: [
      "construction_pipeline_report",
      "vertical_slice_report",
      "not_ui_model",
      "not_persisted_fact",
      input.fullPipelineAudit.warnings.length === 0
        ? "pipeline_report_valid"
        : "pipeline_report_warning",
    ],
  }
}

function resolveReportStatus(input: {
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  fullPipelineAudit: ConstructionFullPipelineAudit
}): ConstructionPipelineReport["status"] {
  if (input.fullPipelineAudit.warnings.length > 0) {
    return "blocked_by_audit"
  }

  if (input.memoryPersistenceMockResult.didStore) {
    return "applied_to_memory_mock"
  }

  return "no_changes"
}

function buildReportId(input: {
  fullPipelineAudit: ConstructionFullPipelineAudit
}): string {
  return [
    "construction-pipeline-report",
    normalizeIdToken(input.fullPipelineAudit.worldId),
    normalizeIdToken(input.fullPipelineAudit.stablePipelineFingerprint).slice(0, 48),
  ].join("-")
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
