/**
 * 当前文件职责：从 MVP 核心 dry-run 结果生成玩家可读展示数据。
 */

import type {
  MvpButlerExplanation,
  MvpCoreDebugRunnerResult,
  MvpPresentationModel,
  MvpPPhoneData,
  MvpWorldLogEntry,
} from "./mvp-core-schema"

export function buildMvpPresentationModel(
  result: MvpCoreDebugRunnerResult
): MvpPresentationModel {
  const worldId = result.audit.worldId
  const ownerId = result.audit.ownerId
  const pPhoneData = buildMvpPPhoneData({
    worldId,
    ownerId,
    result,
  })

  return {
    worldId,
    ownerId,
    report: result.report,
    pPhoneData,
    warnings: result.audit.warnings,
    tags: [
      "mvp_presentation_model",
      "read_only_projection",
      "not_world_fact",
      "not_persistence",
      "not_formal_visual_model",
    ],
  }
}

function buildMvpPPhoneData(input: {
  worldId: string
  ownerId: string
  result: MvpCoreDebugRunnerResult
}): MvpPPhoneData {
  return {
    phoneId: [
      "mvp-phone",
      normalizeIdToken(input.worldId),
      normalizeIdToken(input.result.audit.stableMvpCoreFingerprint).slice(0, 32),
    ].join("-"),
    worldId: input.worldId,
    ownerId: input.ownerId,
    statusLabel: buildPPhoneStatusLabel(input.result),
    primaryActionLabel: buildPrimaryActionLabel(input.result),
    logEntries: buildWorldLogEntries(input.result),
    butlerExplanation: buildButlerExplanation(input.result),
    tags: [
      "mvp_p_phone_data",
      "player_readable_summary",
      "not_world_fact",
      "no_companion_default_entry",
    ],
  }
}

function buildPPhoneStatusLabel(result: MvpCoreDebugRunnerResult): string {
  if (result.audit.warnings.length > 0) {
    return "世界闭环需要检查"
  }
  if (result.constructionBridgeResult.shouldEnterRuntime) {
    return "家园运行链路已准备"
  }

  return "家园正在等待下一次建设机会"
}

function buildPrimaryActionLabel(result: MvpCoreDebugRunnerResult): string {
  if (result.persistenceDryRunResult.canPersist) {
    return "可进入持久化实现"
  }
  if (result.snapshotRefreshRequest.shouldRefreshSnapshot) {
    return "可进入视觉刷新实现"
  }

  return "继续观察世界状态"
}

function buildWorldLogEntries(
  result: MvpCoreDebugRunnerResult
): MvpWorldLogEntry[] {
  const selectedPlanId =
    result.constructionBridgeResult.verticalSliceResult.fullPipelineAudit
      .selectedPlanId
  const acceptedDiffCount =
    result.constructionBridgeResult.verticalSliceResult.fullPipelineAudit
      .acceptedDiffIds.length

  return [
    {
      id: "world-log-construction",
      title: "建设链路",
      body: selectedPlanId
        ? `管家选中了建设计划 ${selectedPlanId}，本轮接受 ${acceptedDiffCount} 个 MapDiff。`
        : "本轮没有选中建设计划，世界保持观察状态。",
      severity: acceptedDiffCount > 0 ? "success" : "info",
      tags: ["world_log", "construction"],
    },
    {
      id: "world-log-persistence",
      title: "持久化 dry-run",
      body: result.persistenceDryRunResult.canPersist
        ? "持久化 dry-run 通过；后续仍需要真实 persistence adapter。"
        : result.persistenceDryRunResult.rejectedReason ??
          "持久化 dry-run 本轮未通过。",
      severity: result.persistenceDryRunResult.canPersist ? "success" : "info",
      tags: ["world_log", "persistence_dry_run"],
    },
    {
      id: "world-log-life-event",
      title: "生命事件后置候选",
      body:
        result.lifeEventResult.lifeEventCandidates[0]?.reason ??
        "当前没有生命事件候选。",
      severity:
        result.lifeEventResult.audit.warnings.length > 0 ? "warning" : "info",
      tags: ["world_log", "life_event_candidate"],
    },
  ]
}

function buildButlerExplanation(
  result: MvpCoreDebugRunnerResult
): MvpButlerExplanation {
  const selectedPlanId =
    result.constructionBridgeResult.verticalSliceResult.fullPipelineAudit
      .selectedPlanId
  const acceptedDiffCount =
    result.constructionBridgeResult.verticalSliceResult.fullPipelineAudit
      .acceptedDiffIds.length

  return {
    explanationId: [
      "butler-explanation",
      normalizeIdToken(result.audit.worldId),
      normalizeIdToken(result.audit.stableMvpCoreFingerprint).slice(0, 32),
    ].join("-"),
    title: "管家观察",
    summary: selectedPlanId
      ? `我会先处理 ${selectedPlanId}，本轮建设变化仍经过 SafeApply 与 dry-run 审计。`
      : "我会继续观察家园资源和空间状态，等待合适的建设机会。",
    nextActionHint:
      acceptedDiffCount > 0
        ? "下一步可以做 UI preview 或真实持久化 adapter。"
        : "下一步应检查资源、阶段或候选计划为什么没有形成可接受变化。",
    tags: [
      "mvp_butler_explanation",
      "player_readable_summary",
      "not_autonomous_dialogue_system",
    ],
  }
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
