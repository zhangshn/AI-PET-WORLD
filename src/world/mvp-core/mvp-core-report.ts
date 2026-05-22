/**
 * 当前文件职责：生成 MVP 核心 debug runner 的人类可读报告。
 */

import type {
  MvpCoreAudit,
  MvpCoreDebugRunnerResult,
  MvpCoreReport,
  MvpCoreReportSection,
} from "./mvp-core-schema"

export function buildMvpCoreReport(input: {
  resultWithoutReport: Omit<MvpCoreDebugRunnerResult, "report">
  audit: MvpCoreAudit
}): MvpCoreReport {
  const sections = buildMvpCoreReportSections(input)

  return {
    reportId: [
      "mvp-core-report",
      normalizeIdToken(input.audit.worldId),
      normalizeIdToken(input.audit.stableMvpCoreFingerprint).slice(0, 48),
    ].join("-"),
    worldId: input.audit.worldId,
    ownerId: input.audit.ownerId,
    sections,
    messages: sections.flatMap((section) => section.lines),
    tags: [
      "mvp_core_report",
      "debug_dry_run_only",
      "not_ui_model",
      "not_persisted_fact",
    ],
  }
}

function buildMvpCoreReportSections(input: {
  resultWithoutReport: Omit<MvpCoreDebugRunnerResult, "report">
  audit: MvpCoreAudit
}): MvpCoreReportSection[] {
  const result = input.resultWithoutReport

  return [
    {
      title: "Construction",
      status:
        result.constructionBridgeResult.audit.warnings.length === 0
          ? "ok"
          : "warning",
      lines: result.constructionBridgeResult.report.messages,
      tags: ["section:construction"],
    },
    {
      title: "Runtime Bridge",
      status: result.constructionBridgeResult.shouldEnterRuntime
        ? "ok"
        : "warning",
      lines: [
        `Should enter runtime: ${String(
          result.constructionBridgeResult.shouldEnterRuntime
        )}`,
        `Should persist: ${String(result.constructionBridgeResult.shouldPersist)}`,
        `Should refresh: ${String(result.constructionBridgeResult.shouldRefresh)}`,
      ],
      tags: ["section:runtime_bridge"],
    },
    {
      title: "Persistence Dry Run",
      status: result.persistenceDryRunResult.canPersist ? "ok" : "skipped",
      lines: [
        `Can persist: ${String(result.persistenceDryRunResult.canPersist)}`,
        result.persistenceDryRunResult.rejectedReason ?? "Dry-run persistence is ready.",
      ],
      tags: ["section:persistence_dry_run"],
    },
    {
      title: "Snapshot Refresh",
      status: result.snapshotRefreshRequest.shouldRefreshSnapshot
        ? "ok"
        : "skipped",
      lines: [
        `Should refresh snapshot: ${String(
          result.snapshotRefreshRequest.shouldRefreshSnapshot
        )}`,
        `Should rebuild FormalVisualModel: ${String(
          result.formalVisualRefreshPrecheck.shouldRebuildFormalVisualModel
        )}`,
        result.snapshotRefreshRequest.reason,
      ],
      tags: ["section:snapshot_refresh"],
    },
    {
      title: "LifeEvent / CompanionDecision Candidate",
      status: result.lifeEventResult.audit.warnings.length === 0
        ? "ok"
        : "warning",
      lines: result.lifeEventResult.report.messages,
      tags: ["section:life_event_companion_decision"],
    },
    {
      title: "Warnings",
      status: input.audit.warnings.length === 0 ? "ok" : "warning",
      lines:
        input.audit.warnings.length === 0
          ? ["MVP core debug runner has no warnings."]
          : input.audit.warnings,
      tags: ["section:warnings"],
    },
    {
      title: "Next Step",
      status: input.audit.warnings.length === 0 ? "ok" : "warning",
      lines: [
        input.audit.warnings.length === 0
          ? "Next product step can choose UI preview, real persistence adapter, scheduler, or integration tests."
          : "Resolve audit warnings before product integration.",
      ],
      tags: ["section:next_step"],
    },
  ]
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
