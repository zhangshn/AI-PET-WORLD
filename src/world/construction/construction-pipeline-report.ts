import type {
  ConstructionFullPipelineAudit,
  ConstructionMemoryPersistenceMockResult,
  ConstructionPipelineReport,
  ConstructionPipelineReportSection,
  ConstructionRuntimeCycleResult,
  ConstructionPainterRefreshBridgeResult,
} from "./construction-schema"

export function buildConstructionPipelineReport(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  painterRefreshBridgeResult: ConstructionPainterRefreshBridgeResult
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
      input.painterRefreshBridgeResult.changedPlacementIds.length,
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
  painterRefreshBridgeResult: ConstructionPainterRefreshBridgeResult
  fullPipelineAudit: ConstructionFullPipelineAudit
}): ConstructionPipelineReportSection[] {
  return [
    {
      title: "建设执行",
      status: input.runtimeCycleResult.audit.warnings.length === 0 ? "ok" : "warning",
      lines: [
        `执行状态：${input.runtimeCycleResult.audit.warnings.length === 0 ? "通过" : "有警告"}`,
        `已接受 diff：${input.fullPipelineAudit.acceptedDiffIds.length}`,
        `已拒绝 diff：${input.fullPipelineAudit.rejectedDiffIds.length}`,
      ],
      tags: ["section:construction"],
    },
    {
      title: "记忆持久化预演",
      status: input.memoryPersistenceMockResult.didStore
        ? "ok"
        : input.memoryPersistenceMockResult.previewOnly
          ? "skipped"
          : "skipped",
      lines: [
        `模式：${input.memoryPersistenceMockResult.mode}`,
        `是否存储：${String(input.memoryPersistenceMockResult.didStore)}`,
        input.memoryPersistenceMockResult.reason,
      ],
      tags: ["section:memory_persistence_mock"],
    },
    {
      title: "Painter 刷新桥",
      status: input.painterRefreshBridgeResult.shouldRequestRefresh ? "ok" : "skipped",
      lines: [
        `是否请求刷新：${String(
          input.painterRefreshBridgeResult.shouldRequestRefresh
        )}`,
        `变化 placement 数：${input.painterRefreshBridgeResult.changedPlacementIds.length}`,
        input.painterRefreshBridgeResult.reason,
      ],
      tags: ["section:painter_refresh_bridge"],
    },
    {
      title: "审计",
      status: input.fullPipelineAudit.warnings.length === 0 ? "ok" : "warning",
      lines:
        input.fullPipelineAudit.warnings.length === 0
          ? ["完整建设流水线审计没有 warning。"]
          : input.fullPipelineAudit.warnings,
      tags: ["section:audit"],
    },
    {
      title: "下一步",
      status: input.fullPipelineAudit.warnings.length === 0 ? "ok" : "warning",
      lines: [
        input.fullPipelineAudit.warnings.length === 0
          ? "该结果可以进入持久化预演与 Painter 刷新预检查。"
          : "进入产品集成前必须先处理审计 warning。",
      ],
      tags: ["section:next_step"],
    },
  ]
}

function buildReportMessages(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  painterRefreshBridgeResult: ConstructionPainterRefreshBridgeResult
  fullPipelineAudit: ConstructionFullPipelineAudit
}): string[] {
  return [
    ...input.runtimeCycleResult.messages,
    input.memoryPersistenceMockResult.reason,
    input.painterRefreshBridgeResult.reason,
    ...input.fullPipelineAudit.warnings.map(
      (warning) => `流水线审计 warning：${warning}`
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
