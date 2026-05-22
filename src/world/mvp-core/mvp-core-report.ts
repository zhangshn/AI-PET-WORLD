/**
 * 当前文件职责：生成 MVP 核心 debug runner 的人类可读报告。
 */

import type {
  AiPetWorldMvpAudit,
  AiPetWorldMvpPipelineResult,
  AiPetWorldMvpReport,
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

export function buildAiPetWorldMvpReport(
  result: AiPetWorldMvpPipelineResult,
  audit: AiPetWorldMvpAudit
): AiPetWorldMvpReport {
  const sections: MvpCoreReportSection[] = [
    {
      title: "Butler",
      status: result.butlerAudit.warnings.length === 0 ? "ok" : "warning",
      lines: result.butlerReport.messages,
      tags: ["section:butler"],
    },
    {
      title: "Initial World",
      status: result.initialWorld.audit.warnings.length === 0 ? "ok" : "warning",
      lines: result.initialWorld.messages,
      tags: ["section:initial_world"],
    },
    {
      title: "Runtime Tick",
      status: result.runtimeTick.audit.warnings.length === 0 ? "ok" : "warning",
      lines: result.runtimeTick.report.messages,
      tags: ["section:runtime_tick"],
    },
    {
      title: "Persistence / Visual",
      status:
        result.persistence.warnings.length === 0 &&
        result.visualRefresh.warnings.length === 0
          ? "ok"
          : "warning",
      lines: [
        result.persistence.reason,
        result.visualRefresh.reason,
        result.formalVisualRefresh.precheckReason,
      ],
      tags: ["section:persistence_visual"],
    },
    {
      title: "LifeEvent / P-Phone",
      status: "ok",
      lines: [
        `Life candidates: ${result.lifeEventCandidates.length}`,
        `Companion decision candidates: ${result.companionDecisionCandidates.length}`,
        `P-Phone messages: ${result.pPhoneData.messages.length}`,
      ],
      tags: ["section:life_event_pphone"],
    },
    {
      title: "Audit",
      status: audit.warnings.length === 0 ? "ok" : "warning",
      lines:
        audit.warnings.length === 0
          ? ["AI-PET-WORLD MVP pipeline audit has no warnings."]
          : audit.warnings,
      tags: ["section:audit"],
    },
  ]

  return {
    reportId: `ai-pet-world-mvp-report-${normalizeIdToken(audit.stableMvpFingerprint).slice(0, 48)}`,
    worldId: audit.worldId,
    ownerId: audit.ownerId,
    sections,
    messages: sections.flatMap((section) => section.lines),
    tags: [
      "ai_pet_world_mvp_report",
      "full_mvp_sections",
      "not_persisted_fact",
    ],
  }
}

export function summarizeAiPetWorldMvpPipeline(
  result: AiPetWorldMvpPipelineResult
): string[] {
  return [
    `World: ${result.nextHomeMapState.worldId}`,
    `Butler: ${result.butlerProfile.butlerId}`,
    `Placements: ${result.nextHomeMapState.placements.length}`,
    `Accepted diffs: ${result.runtimeTick.constructionResult.fullPipelineAudit.acceptedDiffIds.length}`,
    `P-Phone messages: ${result.pPhoneData.messages.length}`,
    `Warnings: ${result.audit.warnings.length}`,
  ]
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
