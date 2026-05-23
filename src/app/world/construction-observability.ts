/**
 * 当前文件职责：把管家建设执行结果整理为 /world 可验收的只读审计模型。
 */

import type { MapDiff } from "@/world/map-state/home-map-state-schema"
import type { AiPetWorldMvpPipelineResult } from "@/world/mvp-core/mvp-core-schema"

export type ConstructionAuditTone = "passed" | "warning" | "follow_up"

export type MvpWorldConstructionAuditMetric = {
  id: string
  label: string
  value: string
  description: string
  tone: ConstructionAuditTone
}

export type MvpWorldConstructionAuditBoundaryItem = {
  id: string
  title: string
  statusLabel: string
  description: string
  tone: ConstructionAuditTone
}

export type MvpWorldConstructionAuditDiffItem = {
  id: string
  operation: MapDiff["operation"] | "rejected"
  placementId: string
  label: string
  reason: string
  statusLabel: string
  tone: ConstructionAuditTone
}

export type MvpWorldConstructionAuditResourceItem = {
  id: string
  label: string
  value: string
  description: string
  tone: ConstructionAuditTone
}

export type MvpWorldConstructionObservability = {
  summary: string
  selectedPlanLabel: string
  acceptedAddCount: number
  acceptedUpdateCount: number
  rejectedCount: number
  resourceTransactionCount: number
  acceptedPlacementLabels: string[]
  metrics: MvpWorldConstructionAuditMetric[]
  boundaryItems: MvpWorldConstructionAuditBoundaryItem[]
  diffItems: MvpWorldConstructionAuditDiffItem[]
  resourceItems: MvpWorldConstructionAuditResourceItem[]
  logItems: string[]
  pPhoneMessages: Array<{
    title: string
    body: string
  }>
  tags: string[]
}

export function buildConstructionObservability(
  result: AiPetWorldMvpPipelineResult
): MvpWorldConstructionObservability {
  const audit = result.runtimeTick.constructionResult.fullPipelineAudit
  const protocol =
    result.runtimeTick.constructionResult.runtimeCycleResult
      .worldLoopProtocolResult
  const acceptedDiffIds = new Set(audit.acceptedDiffIds)
  const acceptedDiffs = result.nextHomeMapState.mapDiffs.filter((diff) =>
    acceptedDiffIds.has(diff.id)
  )
  const acceptedAddDiffs = acceptedDiffs.filter(
    (diff) => diff.operation === "add"
  )
  const acceptedUpdateDiffs = acceptedDiffs.filter(
    (diff) => diff.operation === "update"
  )
  const acceptedPlacementLabels = acceptedAddDiffs.flatMap((diff) =>
    diff.placement?.label ? [diff.placement.label] : []
  )
  const resourceTransactionCount =
    result.nextHomeMapState.resources.recentTransactions?.length ?? 0
  const selectedPlanLabel = protocol.selectedPlan
    ? `${protocol.selectedPlan.title}（${protocol.selectedPlan.id}）`
    : audit.selectedPlanId ?? "未选择"
  const addedLabel =
    acceptedPlacementLabels.length > 0
      ? acceptedPlacementLabels.join("、")
      : "暂无新增建设对象"
  const summary = [
    `当前计划：${selectedPlanLabel}`,
    `SafeApply 接受新增 ${acceptedAddDiffs.length} 条、更新 ${acceptedUpdateDiffs.length} 条。`,
    `拒绝 ${audit.rejectedDiffIds.length} 条。`,
    `资源交易记录 ${resourceTransactionCount} 条。`,
    `新增对象：${addedLabel}。`,
  ].join(" ")

  return {
    summary,
    selectedPlanLabel,
    acceptedAddCount: acceptedAddDiffs.length,
    acceptedUpdateCount: acceptedUpdateDiffs.length,
    rejectedCount: audit.rejectedDiffIds.length,
    resourceTransactionCount,
    acceptedPlacementLabels,
    metrics: buildMetrics({
      acceptedAddCount: acceptedAddDiffs.length,
      acceptedUpdateCount: acceptedUpdateDiffs.length,
      rejectedCount: audit.rejectedDiffIds.length,
      resourceTransactionCount,
      selectedPlanLabel,
    }),
    boundaryItems: buildBoundaryItems({
      acceptedAddCount: acceptedAddDiffs.length,
      rejectedCount: audit.rejectedDiffIds.length,
    }),
    diffItems: buildDiffItems({
      acceptedDiffs,
      rejectedDiffIds: audit.rejectedDiffIds,
    }),
    resourceItems: buildResourceItems(result),
    logItems: [
      `管家建设：当前选择 ${selectedPlanLabel}。`,
      `MapDiff 类型：新增 ${acceptedAddDiffs.length} 条，更新 ${acceptedUpdateDiffs.length} 条，拒绝 ${audit.rejectedDiffIds.length} 条。`,
      `资源连接：本轮记录 ${resourceTransactionCount} 条资源交易，建设事实必须经过资源与 SafeApply。`,
      `建设结果：${addedLabel}。`,
      `边界审计：自然资源归世界，住所/照护/储物/安静生活区归管家建设链路。`,
      `红线审计：伙伴、宠物床、孵化器、胚胎仍保持后置，不作为默认世界事实写入。`,
    ],
    pPhoneMessages: [
      {
        title: "管家建设审计",
        body: summary,
      },
      {
        title: "世界 / 管家边界",
        body: "世界只提供自然地貌、资源与可观察环境；管家建设必须经过计划、资源交易、MapDiff 和 SafeApply 后才进入家园状态。",
      },
      {
        title: "MVP 红线确认",
        body: "当前链路不默认生成宠物、宠物床、孵化器或胚胎，伴生生命仍是后置候选。",
      },
    ],
    tags: [
      "construction_observability_model",
      "butler_construction_audit_visible",
      "map_diff_add_update_rejected_visible",
      "resource_boundary_visible",
      "no_default_companion_entry",
    ],
  }
}

function buildMetrics(input: {
  acceptedAddCount: number
  acceptedUpdateCount: number
  rejectedCount: number
  resourceTransactionCount: number
  selectedPlanLabel: string
}): MvpWorldConstructionAuditMetric[] {
  return [
    {
      id: "selected-plan",
      label: "当前建设计划",
      value: input.selectedPlanLabel,
      description: "本轮由管家链路选择的建设目标。",
      tone: input.selectedPlanLabel === "未选择" ? "warning" : "passed",
    },
    {
      id: "accepted-add",
      label: "新增建设事实",
      value: String(input.acceptedAddCount),
      description: "通过 SafeApply 后进入 HomeMapState.placements 的 add MapDiff。",
      tone: input.acceptedAddCount > 0 ? "passed" : "follow_up",
    },
    {
      id: "accepted-update",
      label: "更新建设事实",
      value: String(input.acceptedUpdateCount),
      description: "通过 SafeApply 后更新已有对象状态的 update MapDiff。",
      tone: "passed",
    },
    {
      id: "rejected-diff",
      label: "拒绝变化",
      value: String(input.rejectedCount),
      description: "被 SafeApply 或审计链路拦下的变化。",
      tone: input.rejectedCount > 0 ? "warning" : "passed",
    },
    {
      id: "resource-transactions",
      label: "资源交易",
      value: String(input.resourceTransactionCount),
      description: "建设不能凭空发生，必须经过资源交易记录。",
      tone: input.resourceTransactionCount > 0 ? "passed" : "follow_up",
    },
  ]
}

function buildBoundaryItems(input: {
  acceptedAddCount: number
  rejectedCount: number
}): MvpWorldConstructionAuditBoundaryItem[] {
  return [
    {
      id: "world-natural-facts",
      title: "世界事实",
      statusLabel: "只负责自然基础",
      description:
        "花草树木、地貌、自然资源和空间压力属于世界自身状态，不直接等同于玩家建设。",
      tone: "passed",
    },
    {
      id: "butler-construction-facts",
      title: "管家建设事实",
      statusLabel: input.acceptedAddCount > 0 ? "已产生建设结果" : "等待建设结果",
      description:
        "临时住所、照护点、储物区和安静生活区必须来自管家计划、资源交易、MapDiff 与 SafeApply。",
      tone: input.acceptedAddCount > 0 ? "passed" : "follow_up",
    },
    {
      id: "safe-apply-gate",
      title: "SafeApply 审计门",
      statusLabel: input.rejectedCount > 0 ? "有拒绝记录" : "当前无拒绝",
      description:
        "建设对象不能由 UI 直接写入；所有变化必须先成为候选，再通过安全审计。",
      tone: input.rejectedCount > 0 ? "warning" : "passed",
    },
    {
      id: "companion-deferred",
      title: "伴生生命后置",
      statusLabel: "保持后置",
      description:
        "宠物、宠物床、孵化器和胚胎不在 MVP 初始世界默认生成。",
      tone: "passed",
    },
  ]
}

function buildDiffItems(input: {
  acceptedDiffs: MapDiff[]
  rejectedDiffIds: string[]
}): MvpWorldConstructionAuditDiffItem[] {
  const acceptedItems = input.acceptedDiffs.map((diff) => ({
    id: diff.id,
    operation: diff.operation,
    placementId: diff.placementId,
    label: diff.placement?.label ?? diff.patch?.label ?? diff.placementId,
    reason: diff.reason,
    statusLabel: "已接受",
    tone: "passed" as const,
  }))
  const rejectedItems = input.rejectedDiffIds.map((diffId) => ({
    id: diffId,
    operation: "rejected" as const,
    placementId: diffId,
    label: diffId,
    reason: "SafeApply 或 ConstructionAudit 拒绝了该候选变化。",
    statusLabel: "已拒绝",
    tone: "warning" as const,
  }))

  return [...acceptedItems, ...rejectedItems]
}

function buildResourceItems(
  result: AiPetWorldMvpPipelineResult
): MvpWorldConstructionAuditResourceItem[] {
  const resources = result.nextHomeMapState.resources

  return [
    {
      id: "material-readiness",
      label: "材料准备",
      value: String(resources.materialReadiness),
      description: "影响管家是否能推进住所、照护点和储物建设。",
      tone: resources.materialReadiness > 0 ? "passed" : "warning",
    },
    {
      id: "care-readiness",
      label: "照护准备",
      value: String(resources.careReadiness),
      description: "影响基础照护点、未来生命接纳与家园稳定性。",
      tone: resources.careReadiness > 0 ? "passed" : "follow_up",
    },
    {
      id: "ground-health",
      label: "土地健康",
      value: String(resources.groundHealth),
      description: "表示世界自然基础是否适合持续建设。",
      tone: resources.groundHealth > 0 ? "passed" : "warning",
    },
    {
      id: "natural-growth",
      label: "自然生长",
      value: String(resources.naturalGrowth),
      description: "世界自身生态资源，不等同于管家建设物。",
      tone: resources.naturalGrowth > 0 ? "passed" : "follow_up",
    },
    {
      id: "space-pressure",
      label: "空间压力",
      value: String(resources.spacePressure),
      description: "空间压力越高，建设和未来生命接纳越需要谨慎。",
      tone: resources.spacePressure > 70 ? "warning" : "passed",
    },
  ]
}
