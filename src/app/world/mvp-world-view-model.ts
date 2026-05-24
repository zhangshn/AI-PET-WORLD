/**
 * 当前文件职责：把 MVP pipeline result 转换为 /world 只读 ViewModel。
 */

import type { FormalVisualModel } from "@/world/formal-visual-model/formal-visual-model-gateway"
import { auditFormalVisualDeliveryModel } from "@/world/formal-visual-model/formal-visual-audit"
import { buildFormalVisualDeliveryModel } from "@/world/formal-visual-model/formal-visual-builder"
import type { FormalVisualDeliveryModel } from "@/world/formal-visual-model/formal-visual-schema"
import type { AiPetWorldMvpPipelineResult } from "@/world/mvp-core/mvp-core-schema"

import {
  buildButlerAutonomyViewModelProbe,
  type MvpWorldButlerAutonomyProbeSummary,
} from "./butler-autonomy-viewmodel-probe"
import {
  buildConstructionObservability,
  type MvpWorldConstructionObservability,
} from "./construction-observability"

export type MvpWorldAdoptionSummary = {
  title: string
  statusLabel: string
  readinessLabel: string
  readinessScore: number
  recommendedNextStepLabel: string
  adoptionOpportunityLabel: string
  adoptionOpportunityReason: string
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

export type MvpWorldDemoChecklistItem = {
  id: string
  title: string
  status: "passed" | "warning"
  description: string
  evidence: string
}

export type MvpWorldAcceptanceItem = {
  id: string
  title: string
  status: "passed" | "follow_up"
  description: string
}

export type MvpWorldViewModel = {
  worldSummary: string
  butlerSummary: string
  constructionSummary: string
  constructionAudit: MvpWorldConstructionObservability
  butlerAutonomyProbe: MvpWorldButlerAutonomyProbeSummary
  logItems: string[]
  pPhoneMessages: Array<{
    title: string
    body: string
  }>
  auditSummary: string
  formalVisualModel: FormalVisualModel | null
  formalVisualDeliveryModel: FormalVisualDeliveryModel
  adoptionSummary: MvpWorldAdoptionSummary
  demoStatusLabel: string
  demoChecklist: MvpWorldDemoChecklistItem[]
  acceptanceStatusLabel: string
  acceptanceItems: MvpWorldAcceptanceItem[]
  atmosphereLabel: string
  currentWorldPhaseLabel: string
  townAdoptionStatusLabel: string
  tags: string[]
}

export function buildMvpWorldViewModel(
  result: AiPetWorldMvpPipelineResult
): MvpWorldViewModel {
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
  const adoptionSummary = buildTownAdoptionPrecheckSummary(result)
  const constructionAudit = buildConstructionObservability(result)
  const butlerAutonomyProbe = buildButlerAutonomyViewModelProbe(result)
  const demoChecklist = [
    ...buildDemoChecklist({
      result,
      acceptedDiffCount,
      rejectedDiffCount,
      adoptionSummary,
    }),
    {
      id: "demo-butler-autonomy-core",
      title: "AI 管家自主意识链路",
      status: butlerAutonomyProbe.checklist.every(
        (item) => item.status === "passed"
      )
        ? "passed"
        : "warning",
      description:
        "管家已经通过 AI 总入口形成灵魂底盘、世界感知、意识状态、动机、目标、主意图、审计和解释。",
      evidence: `${butlerAutonomyProbe.statusLabel}；主意图 ${butlerAutonomyProbe.selectedIntentLabel}。`,
    } satisfies MvpWorldDemoChecklistItem,
  ]
  const acceptanceItems = buildAcceptanceItems({
    demoChecklist,
    adoptionSummary,
    warningCount: result.audit.warnings.length,
  })

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
      `计划：${constructionAudit.selectedPlanLabel}`,
      `新增 diff：${constructionAudit.acceptedAddCount}`,
      `更新 diff：${constructionAudit.acceptedUpdateCount}`,
      `拒绝 diff：${constructionAudit.rejectedCount}`,
    ].join(" / "),
    constructionAudit,
    butlerAutonomyProbe,
    logItems: [
      `世界运行：当前有 ${result.nextHomeMapState.placements.length} 个可观察对象。`,
      `建设链路：接受 ${acceptedDiffCount} 条 MapDiff，拒绝 ${rejectedDiffCount} 条。`,
      `AI 管家：${butlerAutonomyProbe.statusLabel}，主意图 ${butlerAutonomyProbe.selectedIntentLabel}。`,
      ...butlerAutonomyProbe.logItems,
      ...constructionAudit.logItems,
      `视觉刷新：${result.visualRefresh.reason}`,
      `小镇领养观察：${adoptionSummary.readinessLabel} / ${adoptionSummary.adoptionOpportunityLabel}`,
      `领养机会观察：${adoptionSummary.decisionLabel}，${adoptionSummary.nextCheckHint}`,
    ],
    pPhoneMessages: [
      ...result.pPhoneData.messages.map((message) => ({
        title: message.title,
        body: message.body,
      })),
      ...constructionAudit.pPhoneMessages,
      {
        title: "管家自主意识",
        body: butlerAutonomyProbe.explanationBodies[0] ??
          butlerAutonomyProbe.selectedIntentReason,
      },
    ],
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
    adoptionSummary,
    demoStatusLabel: demoChecklist.every((item) => item.status === "passed")
      ? "MVP 演示闭环已形成"
      : "MVP 演示闭环仍有提醒",
    demoChecklist,
    acceptanceStatusLabel: acceptanceItems.every(
      (item) => item.status === "passed"
    )
      ? "MVP 可验收"
      : "MVP 可验收，部分内容进入后续阶段",
    acceptanceItems,
    atmosphereLabel: "温暖、安静、自然",
    currentWorldPhaseLabel:
      result.nextHomeMapState.mapDiffs.length > 0
        ? "家园正在运行"
        : "第一片家园已建立",
    townAdoptionStatusLabel: adoptionSummary.statusLabel,
    tags: [
      "mvp_world_view_model",
      "readonly_projection",
      "no_world_fact_generation",
      "construction_observability_visible",
      "construction_audit_panel_ready",
      "butler_autonomy_probe_attached",
      "town_adoption_precheck_visible_summary",
      ...butlerAutonomyProbe.tags,
      ...constructionAudit.tags,
      ...result.tags,
    ],
  }
}

function buildTownAdoptionPrecheckSummary(
  result: AiPetWorldMvpPipelineResult
): MvpWorldAdoptionSummary {
  const observation = result.adoptionOpportunityObservations[0]
  const decision = result.butlerAdoptionIntents[0]
  const readiness = observation?.readiness ?? decision?.readiness
  const readinessScore = readiness?.score ?? 0
  const blockers = observation?.blockers ?? decision?.blockers ?? []
  const resourceReasons =
    observation?.resourceReasons ?? readiness?.resourceReadiness.reasons ?? []
  const worldReasons =
    observation?.worldReasons ?? readiness?.worldReadiness.reasons ?? []

  return {
    title: "小镇领养观察",
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
    adoptionOpportunityLabel: observation
      ? toAdoptionOpportunityKindLabel(observation.kind)
      : "暂无事件",
    adoptionOpportunityReason:
      observation?.reason ?? "当前没有领养机会观察，世界会继续观察。",
    decisionLabel: decision
      ? toButlerAdoptionIntentLabel(decision.kind)
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
    visit: "未来可记录机会",
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

function toAdoptionOpportunityKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    no_event: "暂无事件",
    observe_world_ready: "世界可观察",
    adoption_opportunity_later: "未来领养机会",
    construction_dependency_not_ready: "建设条件未满足",
  }

  return labels[kind] ?? "领养机会观察"
}

function toButlerAdoptionIntentLabel(kind: string): string {
  const labels: Record<string, string> = {
    wait: "等待观察",
    ignore: "暂不关注",
    consider: "继续评估",
    visit: "主动了解领养信息",
    adopt: "产生领养意愿",
    reject: "拒绝领养",
  }

  return labels[kind] ?? "等待观察"
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

function buildDemoChecklist(input: {
  result: AiPetWorldMvpPipelineResult
  acceptedDiffCount: number
  rejectedDiffCount: number
  adoptionSummary: MvpWorldAdoptionSummary
}): MvpWorldDemoChecklistItem[] {
  const hasWorldObjects = input.result.nextHomeMapState.placements.length > 0
  const hasZones = input.result.nextHomeMapState.zones.length > 0
  const hasResourceState = Boolean(input.result.nextHomeMapState.resources)
  const hasConstructionPlan =
    input.result.nextHomeMapState.constructionPlans.length > 0
  const hasHouseStyle = Boolean(input.result.nextHomeMapState.houseStyle)
  const hasAdoptionSummary = input.adoptionSummary.readinessScore > 0
  const hasWarnings = input.result.audit.warnings.length > 0
  const acceptedAddCount = input.result.nextHomeMapState.mapDiffs.filter(
    (diff) =>
      diff.operation === "add" &&
      input.result.runtimeTick.constructionResult.fullPipelineAudit.acceptedDiffIds.includes(
        diff.id
      )
  ).length

  return [
    {
      id: "demo-world-generated",
      title: "世界已生成",
      status: hasWorldObjects && hasZones ? "passed" : "warning",
      description: "世界不是空页面，已经生成区域、对象与可观察地图。",
      evidence: `${input.result.nextHomeMapState.zones.length} 个区域，${input.result.nextHomeMapState.placements.length} 个对象。`,
    },
    {
      id: "demo-readonly-visual",
      title: "只读主世界展示",
      status: "passed",
      description: "页面只读取 HomeMapState / FormalVisualModel，不由 UI 生成世界事实。",
      evidence: "HomeMapState -> FormalVisualModel -> /world read-only render。",
    },
    {
      id: "demo-resource-cycle",
      title: "资源状态可见",
      status: hasResourceState ? "passed" : "warning",
      description: "资源已经进入页面展示，并可用于解释建设与小镇领养等待原因。",
      evidence: `材料 ${input.result.nextHomeMapState.resources.materialReadiness}，照护 ${input.result.nextHomeMapState.resources.careReadiness}，空间压力 ${input.result.nextHomeMapState.resources.spacePressure}。`,
    },
    {
      id: "demo-autonomous-construction",
      title: "管家自主建设",
      status: hasConstructionPlan ? "passed" : "warning",
      description: "建设计划来自管家、资源、地貌和世界阶段，不是玩家按钮触发。",
      evidence: `建设计划 ${input.result.nextHomeMapState.constructionPlans.length} 个，新增建设 ${acceptedAddCount} 条，已接受变化 ${input.acceptedDiffCount}，等待确认 ${input.rejectedDiffCount}。`,
    },
    {
      id: "demo-house-style",
      title: "房屋偏好已形成",
      status: hasHouseStyle ? "passed" : "warning",
      description: "房屋风格由管家人格、资源和地貌共同决定，并进入世界状态。",
      evidence: input.result.nextHomeMapState.houseStyle
        ? `当前房屋偏好：${input.result.nextHomeMapState.houseStyle.archetype}。`
        : "当前尚未形成房屋偏好。",
    },
    {
      id: "demo-town-adoption-delayed",
      title: "小镇领养观察",
      status: hasAdoptionSummary ? "passed" : "warning",
      description: "宠物不会默认进入世界；只有管家自主产生领养意愿并通过审计后，才会进入家园。",
      evidence: `${input.adoptionSummary.statusLabel}，准备度 ${input.adoptionSummary.readinessScore}/100。`,
    },
    {
      id: "demo-audit-status",
      title: "审计状态",
      status: hasWarnings ? "warning" : "passed",
      description: "MVP 总链路需要可审计，警告不会被隐藏。",
      evidence: hasWarnings
        ? `${input.result.audit.warnings.length} 条审计提醒。`
        : "当前 MVP 审计无警告。",
    },
  ]
}

function buildAcceptanceItems(input: {
  demoChecklist: MvpWorldDemoChecklistItem[]
  adoptionSummary: MvpWorldAdoptionSummary
  warningCount: number
}): MvpWorldAcceptanceItem[] {
  const demoWarningCount = input.demoChecklist.filter(
    (item) => item.status === "warning"
  ).length

  return [
    {
      id: "acceptance-world-loop",
      title: "世界闭环",
      status: demoWarningCount <= 1 ? "passed" : "follow_up",
      description:
        demoWarningCount <= 1
          ? "世界生成、资源、建设、房屋偏好和小镇领养观察已经形成可演示闭环。"
          : "演示闭环仍有较多提醒，需要先处理关键验收项。",
    },
    {
      id: "acceptance-readonly-ui",
      title: "只读 UI 红线",
      status: "passed",
      description:
        "/world 只展示 HomeMapState / FormalVisualModel 投影，不提供玩家直接建造入口。",
    },
    {
      id: "acceptance-no-direct-adoption",
      title: "小镇领养观察",
      status: "passed",
      description: `当前状态：${input.adoptionSummary.statusLabel}。宠物只有在小镇领养中心可观察信息、管家审查与 SafeApply 通过后，才会成为世界事实。`,
    },
    {
      id: "acceptance-product-demo",
      title: "产品演示可读性",
      status: "passed",
      description:
        "用户可以在一个页面看到家园地图、资源状态、管家建设解释、房屋偏好、小镇领养等待原因和 MVP checklist。",
    },
    {
      id: "acceptance-follow-up-visual",
      title: "视觉精修",
      status: "follow_up",
      description:
        "当前是低保真主世界，像素资产、动效、真实角色表现和更精致地图表现进入 Closed Alpha 前后继续迭代。",
    },
    {
      id: "acceptance-follow-up-life",
      title: "真实宠物事实行为",
      status: "follow_up",
      description:
        "当前只做到小镇领养观察与管家领养意愿预检查，真正宠物入场、行为、关系、记忆和生命周期仍是下一阶段工作。",
    },
    {
      id: "acceptance-audit",
      title: "审计与构建",
      status: input.warningCount === 0 ? "passed" : "follow_up",
      description:
        input.warningCount === 0
          ? "当前 MVP pipeline audit 无警告。"
          : `当前仍有 ${input.warningCount} 条审计提醒，允许进入验收缓冲，但需要记录在最终验收报告中。`,
    },
  ]
}
