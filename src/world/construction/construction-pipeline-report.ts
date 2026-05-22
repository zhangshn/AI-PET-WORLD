/**
 * 当前文件职责：生成建设系统纵向闭环的人类可读报告。
 */

import type {
  ConstructionFullPipelineAudit,
  ConstructionMemoryPersistenceMockResult,
  ConstructionPipelineReport,
  ConstructionPipelineReportSection,
  ConstructionRuntimeCycleResult,
  ConstructionVisualRefreshBridgeResult,
} from "./construction-schema"

export function buildConstructionPipelineReport(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
  fullPipelineAudit: ConstructionFullPipelineAudit
}): ConstructionPipelineReport {
  const sections = buildReportSections(input)

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
    messages: buildReportMessages(input),
    sections,
    tags: [
      "construction_pipeline_report",
      "vertical_slice_report",
      "human_readable_sections",
      "not_ui_model",
      "not_persisted_fact",
      input.fullPipelineAudit.warnings.length === 0
        ? "pipeline_report_valid"
        : "pipeline_report_warning",
    ],
  }
}

function buildReportSections(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
  fullPipelineAudit: ConstructionFullPipelineAudit
}): ConstructionPipelineReportSection[] {
  return [
    {
      title: "Construction",
      status: input.runtimeCycleResult.audit.warnings.length === 0 ? "ok" : "warning",
      lines: [
        `Selected plan: ${input.fullPipelineAudit.selectedPlanId ?? "none"}`,
        `Accepted diffs: ${input.fullPipelineAudit.acceptedDiffIds.length}`,
        `Rejected diffs: ${input.fullPipelineAudit.rejectedDiffIds.length}`,
      ],
      tags: ["section:construction"],
    },
    {
      title: "Memory Persistence Mock",
      status: input.memoryPersistenceMockResult.didStore
        ? "ok"
        : input.memoryPersistenceMockResult.previewOnly
          ? "skipped"
          : "skipped",
      lines: [
        `Mode: ${input.memoryPersistenceMockResult.mode}`,
        `Did store: ${String(input.memoryPersistenceMockResult.didStore)}`,
        input.memoryPersistenceMockResult.reason,
      ],
      tags: ["section:memory_persistence_mock"],
    },
    {
      title: "Visual Refresh Bridge",
      status: input.visualRefreshBridgeResult.shouldRequestRefresh ? "ok" : "skipped",
      lines: [
        `Should refresh: ${String(
          input.visualRefreshBridgeResult.shouldRequestRefresh
        )}`,
        `Changed placements: ${input.visualRefreshBridgeResult.changedPlacementIds.length}`,
        input.visualRefreshBridgeResult.reason,
      ],
      tags: ["section:visual_refresh_bridge"],
    },
    {
      title: "Audit",
      status: input.fullPipelineAudit.warnings.length === 0 ? "ok" : "warning",
      lines:
        input.fullPipelineAudit.warnings.length === 0
          ? ["Full pipeline audit has no warnings."]
          : input.fullPipelineAudit.warnings,
      tags: ["section:audit"],
    },
    {
      title: "Next Step",
      status: input.fullPipelineAudit.warnings.length === 0 ? "ok" : "warning",
      lines: [
        input.fullPipelineAudit.warnings.length === 0
          ? "This result may proceed to dry-run persistence and snapshot refresh precheck."
          : "Resolve audit warnings before product integration.",
      ],
      tags: ["section:next_step"],
    },
  ]
}

function buildReportMessages(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
  fullPipelineAudit: ConstructionFullPipelineAudit
}): string[] {
  return [
    ...input.runtimeCycleResult.messages,
    input.memoryPersistenceMockResult.reason,
    input.visualRefreshBridgeResult.reason,
    ...input.fullPipelineAudit.warnings.map(
      (warning) => `Pipeline audit warning: ${warning}`
    ),
  ]
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
    normalizeIdToken(input.fullPipelineAudit.stablePipelineFingerprint).slice(
      0,
      48
    ),
  ].join("-")
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
