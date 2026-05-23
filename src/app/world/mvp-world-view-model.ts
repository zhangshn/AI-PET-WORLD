/**
 * 当前文件职责：把 MVP pipeline result 转换为 /world 只读 ViewModel。
 */

import type { FormalVisualModel } from "@/world/formal-visual-model/formal-visual-model-gateway"
import { auditFormalVisualDeliveryModel } from "@/world/formal-visual-model/formal-visual-audit"
import { buildFormalVisualDeliveryModel } from "@/world/formal-visual-model/formal-visual-builder"
import type { FormalVisualDeliveryModel } from "@/world/formal-visual-model/formal-visual-schema"
import type { AiPetWorldMvpPipelineResult } from "@/world/mvp-core/mvp-core-schema"

export type MvpWorldLifeEventSummary = {
  title: string
  statusLabel: string
  readinessLabel: string
  readinessScore: number
  recommendedNextStepLabel: string
  candidateLabel: string
  candidateReason: string
  decisionLabel: string
  decisionReason: string
  nextCheckHint: string
  resourceReasons: string[]
  worldReasons: string[]
  blockers: Array<{
    severityLabel: string
    sourceLabel: string
    reason: string
    tone: "info" | "warning" | "blocking"
  }>
}

export type MvpWorldViewModel = {
  worldSummary: string
  butlerSummary: string
  constructionSummary: string
  logItems: string[]
  pPhoneMessages: Array<{
    title: string
    body: string
  }>
  auditSummary: string
  formalVisualModel: FormalVisualModel | null
  formalVisualDeliveryModel: FormalVisualDeliveryModel
  lifeEventSummary: MvpWorldLifeEventSummary
  atmosphereLabel: string
  currentWorldPhaseLabel: string
  companionStatusLabel: string
  tags: string[]
}

export function buildMvpWorldViewModel(
  result: AiPetWorldMvpPipelineResult
): MvpWorldViewModel {
  const selectedPlanId =
    result.runtimeTick.constructionResult.fullPipelineAudit.selectedPlanId
  const acceptedDiffCount =
    result.runtimeTick.constructionResult.fullPipelineAudit.acceptedDiffIds
      .length
  const rejectedDiffCount =
    result.runtimeTick.constructionResult.fullPipelineAudit.rejectedDiffIds
      .length
  const protocol =
    result.runtimeTick.constructionResult.runtimeCycleResult
      .worldLoopProtocolResult
  const formalVisualDeliveryModel = buildFormalVisualDeliveryModel({
    homeMapState: result.nextHomeMapState,
    selectedPlan: protocol.selectedPlan,
    acceptedDiffCount,
    rejectedDiffCount,
    warnings: result.audit.warnings,
  })
  const formalVisualDeliveryAudit = auditFormalVisualDeliveryModel(
    formalVisualDeliveryModel
  )
  const lifeEventSummary = buildLifeEventSummary(result)

  return {
    worldSummary: [
      `世界 ${result.nextHomeMapState.worldId}`,
      `Owner ${result.nextHomeMapState.ownerId}`,
      `${result.nextHomeMapState.placements.length} 个世界对象`,
      `${result.nextHomeMapState.mapDiffs.length} 条 MapDiff`,
    ].join(" / "),
    butlerSummary: [
      result.butlerProfile.displayName,
      `说明语气：${result.butlerProfile.explanationTone}`,
      `生活节律：${result.butlerProfile.lifeRhythmBias}`,
    ].join(" / "),
    constructionSummary: [
      `计划：${selectedPlanId ?? "未选择"}`,
      `已接受 diff：${acceptedDiffCount}`,
      `已拒绝 diff：${rejectedDiffCount}`,
    ].join(" / "),
    logItems: [
      `世界运行：当前有 ${result.nextHomeMapState.placements.length} 个可观察对象。`,
      `建设链路：接受 ${acceptedDiffCount} 条 MapDiff，拒绝 ${rejectedDiffCount} 条。`,
      `视觉刷新：${result.visualRefresh.reason}`,
      `生命事件：${lifeEventSummary.readinessLabel} / ${lifeEventSummary.candidateLabel}`,
      `伴生生命：${lifeEventSummary.decisionLabel}，${lifeEventSummary.nextCheckHint}`,
    ],
    pPhoneMessages: result.pPhoneData.messages.map((message) => ({
      title: message.title,
      body: message.body,
    })),
    auditSummary:
      result.audit.warnings.length === 0 &&
      formalVisualDeliveryAudit.warnings.length === 0
        ? "主世界投影审计通过。"
        : `主世界投影警告：${[
            ...result.audit.warnings,
            ...formalVisualDeliveryAudit.warnings,
          ].join("；")}`,
    formalVisualModel: result.formalVisualRefresh.formalVisualModel,
    formalVisualDeliveryModel,
    lifeEventSummary,
    atmosphereLabel: "温暖、安静、自然",
    currentWorldPhaseLabel:
      result.nextHomeMapState.mapDiffs.length > 0
        ? "家园正在运行"
        : "第一片家园已建立",
    companionStatusLabel: lifeEventSummary.statusLabel,
    tags: [
      "mvp_world_view_model",
      "readonly_projection",
      "no_world_fact_generation",
      "life_event_visible_summary",
      ...result.tags,
    ],
  }
}

function buildLifeEventSummary(
  result: AiPetWorldMvpPipelineResult
): MvpWorldLifeEventSummary {
  const candidate = result.lifeEventCandidates[0]
  const decision = result.companionDecisionCandidates[0]
  const readiness = candidate?.readiness ?? decision?.readiness
  const readinessScore = readiness?.score ?? 0
  const blockers = candidate?.blockers ?? decision?.blockers ?? []
  const resourceReasons =
    candidate?.resourceReasons ?? readiness?.resourceReadiness.reasons ?? []
  const worldReasons =
    candidate?.worldReasons ?? readiness?.worldReadiness.reasons ?? []

  return {
    title: "伴生生命入口",
    statusLabel: readiness
      ? toReadinessLabel(readiness.status)
      : "后置等待",
    readinessLabel: readiness
      ? `${toReadinessLabel(readiness.status)}｜${readiness.score}/100`
      : "尚未计算准备度",
    readinessScore,
    recommendedNextStepLabel: readiness
      ? toRecommendedNextStepLabel(readiness.recommendedNextStep)
      : "继续等待",
    candidateLabel: candidate
      ? toLifeEventKindLabel(candidate.kind)
      : "暂无事件",
    candidateReason:
      candidate?.reason ?? "当前没有生命事件候选，世界会继续观察。",
    decisionLabel: decision
      ? toCompanionDecisionLabel(decision.kind)
      : "暂无决策",
    decisionReason:
      decision?.reason ?? "管家会继续观察资源、空间和建设状态。",
    nextCheckHint:
      decision?.nextCheckHint ?? "等待下一次世界 Tick 后重新评估。",
    resourceReasons,
    worldReasons,
    blockers: blockers.map((blocker) => ({
      severityLabel: toBlockerSeverityLabel(blocker.severity),
      sourceLabel: toBlockerSourceLabel(blocker.source),
      reason: blocker.reason,
      tone: blocker.severity,
    })),
  }
}

function toReadinessLabel(status: string): string {
  const labels: Record<string, string> = {
    not_ready: "尚未准备好",
    preparing: "准备中",
    observable: "可以观察",
    eligible_later: "未来可记录机会",
  }

  return labels[status] ?? "后置等待"
}

function toRecommendedNextStepLabel(step: string): string {
  const labels: Record<string, string> = {
    wait: "继续等待",
    prepare_resources: "优先准备资源与空间",
    continue_construction: "继续推进家园建设",
    observe_world: "观察世界稳定性",
    record_future_opportunity: "记录未来机会",
  }

  return labels[step] ?? "继续等待"
}

function toLifeEventKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    no_event: "暂无事件",
    observe_world_ready: "世界可观察",
    companion_opportunity_later: "未来伴生机会",
    construction_dependency_not_ready: "建设条件未满足",
  }

  return labels[kind] ?? "生命事件候选"
}

function toCompanionDecisionLabel(kind: string): string {
  const labels: Record<string, string> = {
    no_companion_decision: "暂无决策",
    wait_and_observe: "等待观察",
    prepare_world_first: "先准备世界",
    eligible_later: "未来可评估",
  }

  return labels[kind] ?? "后置等待"
}

function toBlockerSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    info: "提示",
    warning: "提醒",
    blocking: "阻塞",
  }

  return labels[severity] ?? "提示"
}

function toBlockerSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    resource: "资源",
    space: "空间",
    construction: "建设",
    world_stability: "世界稳定",
    safety_boundary: "安全边界",
    audit: "审计",
  }

  return labels[source] ?? "世界状态"
}