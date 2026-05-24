/**
 * 当前文件职责：把世界事实转换为主世界只读产品化视觉投影。
 */

import type { ConstructionPlan } from "@/world/construction/construction-schema"
import type {
  HomeMapState,
  HomeZone,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import type {
  FormalVisualDeliveryModel,
  FormalVisualHouseStyleSummary,
  FormalVisualMapItem,
  FormalVisualResourceSummary,
  FormalVisualResourceTone,
} from "./formal-visual-schema"

export function buildFormalVisualDeliveryModel(input: {
  homeMapState: HomeMapState
  selectedPlan: ConstructionPlan | null
  acceptedDiffCount: number
  rejectedDiffCount: number
  warnings: string[]
}): FormalVisualDeliveryModel {
  const housePreference =
    input.selectedPlan?.houseStyle ?? input.homeMapState.houseStyle ?? null

  return {
    version: "formal_visual_delivery_v0",
    worldId: input.homeMapState.worldId,
    overview: {
      title: "家园正在被管家整理",
      subtitle: "所有画面都来自世界状态，只读展示当前结果和原因。",
      phaseLabel:
        input.homeMapState.mapDiffs.length > 0
          ? "家园已开始自主建设"
          : "第一片家园已建立",
      mapSize: input.homeMapState.mapSize,
      worldObjectCount: input.homeMapState.placements.length,
      mapDiffCount: input.homeMapState.mapDiffs.length,
      companionLabel: "伙伴入口后置等待",
    },
    zones: input.homeMapState.zones.map(toZoneSummary),
    mapItems: input.homeMapState.placements
      .filter((placement) => placement.layer !== "actor")
      .map((placement) =>
        toMapItem({
          placement,
          zones: input.homeMapState.zones,
        })
      ),
    resources: buildResourceSummaries(input.homeMapState),
    construction: {
      title: input.selectedPlan?.title ?? "管家继续观察家园",
      statusLabel: input.selectedPlan
        ? toConstructionStatusLabel(input.selectedPlan.status)
        : "等待合适时机",
      targetLabel: input.selectedPlan
        ? toZoneLabel(input.selectedPlan.targetZoneType)
        : "全局观察",
      explanation: buildConstructionExplanation(input.selectedPlan),
      acceptedDiffCount: input.acceptedDiffCount,
      rejectedDiffCount: input.rejectedDiffCount,
    },
    houseStyle: housePreference
      ? buildHouseStyleSummary(housePreference)
      : null,
    sourceChain: [
      "home_map_state",
      "resource_pool_state",
      "construction_plan",
      "house_preference",
      "map_diff",
    ],
    warnings: input.warnings,
    tags: [
      "formal_visual_delivery_model",
      "read_only_projection",
      "home_map_state_projection",
      "no_world_fact_generation",
      "no_default_adoption_entry",
    ],
  }
}

function toZoneSummary(zone: HomeZone) {
  return {
    id: zone.id,
    label: toZoneLabel(zone.type),
    zoneType: zone.type,
    x: zone.bounds.x,
    y: zone.bounds.y,
    width: zone.bounds.width,
    height: zone.bounds.height,
  }
}

function toMapItem(input: {
  placement: MapPlacement
  zones: HomeZone[]
}): FormalVisualMapItem {
  const zone = input.zones.find((item) =>
    input.placement.x >= item.bounds.x &&
    input.placement.x <= item.bounds.x + item.bounds.width &&
    input.placement.y >= item.bounds.y &&
    input.placement.y <= item.bounds.y + item.bounds.height
  )

  return {
    id: input.placement.id,
    label: input.placement.label,
    x: input.placement.x,
    y: input.placement.y,
    layer: input.placement.layer,
    zoneType: zone?.type,
    visualTone: toVisualTone(input.placement),
    opacity: input.placement.alpha,
  }
}

function buildResourceSummaries(
  homeMapState: HomeMapState
): FormalVisualResourceSummary[] {
  const pool = homeMapState.resources.resourcePoolState
  const fallback = homeMapState.resources
  const resourceEntries = [
    ["groundHealth", "土地状态"],
    ["naturalGrowth", "自然生长"],
    ["materialReadiness", "材料准备"],
    ["careReadiness", "照护准备"],
    ["spacePressure", "空间压力"],
  ] as const

  return resourceEntries.map(([key, label]) => {
    const resource = pool?.resources[key]
    const current = roundVisualNumber(resource?.current ?? fallback[key])
    const min = resource?.min ?? 0
    const max = resource?.max ?? 100
    const regenPerTick = resource?.regenPerTick ?? 0
    const tone = toResourceTone({ key, current, min, max })

    return {
      key,
      label,
      current,
      min,
      max: roundVisualNumber(max),
      regenPerTick: roundVisualNumber(regenPerTick),
      tone,
      explanation: buildResourceExplanation({
        label,
        tone,
        regenPerTick,
      }),
    }
  })
}

function buildHouseStyleSummary(
  houseStyle: NonNullable<ConstructionPlan["houseStyle"]>
): FormalVisualHouseStyleSummary {
  return {
    title: toHouseArchetypeLabel(houseStyle.archetype),
    archetype: houseStyle.archetype,
    materialLabel: toMaterialLabel(houseStyle.materialPreference),
    spatialLabel: [
      toFootprintLabel(houseStyle.spatialPreference.footprint),
      toPrivacyLabel(houseStyle.spatialPreference.privacy),
      toLayoutFlowLabel(houseStyle.spatialPreference.layoutFlow),
    ].join(" / "),
    scaleLabel:
      houseStyle.scalePreference === "expandable"
        ? "可扩展"
        : houseStyle.scalePreference === "moderate"
          ? "稳步扩展"
          : "保守小规模",
    explanation: buildHouseStyleExplanation(houseStyle),
  }
}

function buildConstructionExplanation(
  plan: ConstructionPlan | null
): string {
  if (!plan) {
    return "管家会依据资源、空间、地貌和当前建设阶段判断下一步。"
  }

  return [
    `管家正在优先处理${toZoneLabel(plan.targetZoneType)}。`,
    `这一步会结合当前资源状态、地貌维护压力和管家的建设偏好推进。`,
    plan.status === "paused"
      ? "资源不足时会等待，不会凭空建造。"
      : "通过资源交易和地图变化记录进入世界状态。",
  ].join("")
}

function buildHouseStyleExplanation(
  houseStyle: NonNullable<ConstructionPlan["houseStyle"]>
): string {
  const resourceText =
    houseStyle.resourcePosture === "abundant"
      ? "资源较充足，房屋可以保留扩展余地。"
      : houseStyle.resourcePosture === "stable"
        ? "资源稳定，房屋会稳步推进。"
        : "资源偏紧，房屋会先保持小规模。"

  return [
    `管家偏向${toHouseArchetypeLabel(houseStyle.archetype)}。`,
    `材料会优先使用${toMaterialLabel(houseStyle.materialPreference)}。`,
    resourceText,
  ].join("")
}

function toVisualTone(placement: MapPlacement): FormalVisualMapItem["visualTone"] {
  if (placement.layer === "path") return "path"
  if (placement.layer === "nature" || placement.layer === "edge") return "nature"
  if (placement.layer === "facility") return "care"
  if (placement.layer === "structure") return "home"
  if (placement.layer === "atmosphere") return "atmosphere"

  return "work"
}

function toResourceTone(input: {
  key: string
  current: number
  min: number
  max: number
}): FormalVisualResourceTone {
  const ratio = (input.current - input.min) / Math.max(1, input.max - input.min)

  if (input.key === "spacePressure") {
    return ratio > 0.62 ? "pressure" : ratio > 0.36 ? "steady" : "strong"
  }
  if (ratio >= 0.68) return "strong"
  if (ratio >= 0.38) return "steady"

  return "low"
}

function buildResourceExplanation(input: {
  label: string
  tone: FormalVisualResourceTone
  regenPerTick: number
}): string {
  const toneText = {
    low: "需要管家保守推进",
    steady: "可以支撑小步建设",
    strong: "状态充足，适合扩展",
    pressure: "压力偏高，需要先整理空间",
  } satisfies Record<FormalVisualResourceTone, string>

  return `${input.label}${toneText[input.tone]}，每轮恢复 ${input.regenPerTick.toFixed(2)}。`
}

function roundVisualNumber(value: number): number {
  return Math.round(value * 10) / 10
}

function toZoneLabel(zoneType: HomeZone["type"]): string {
  const labels = {
    visual_center: "家园中心",
    entry_area: "入口",
    initial_care: "照护点",
    temporary_shelter: "临时住所",
    quiet_living: "安静生活区",
    storage_tools: "工具储备区",
    natural_boundary: "自然边界",
  } satisfies Record<HomeZone["type"], string>

  return labels[zoneType]
}

function toConstructionStatusLabel(
  status: ConstructionPlan["status"]
): string {
  const labels = {
    planned: "已计划",
    active: "正在推进",
    paused: "等待资源",
    completed: "已完成",
  } satisfies Record<ConstructionPlan["status"], string>

  return labels[status]
}

function toHouseArchetypeLabel(
  archetype: NonNullable<ConstructionPlan["houseStyle"]>["archetype"]
): string {
  const labels = {
    ordered_compact_cabin: "有序紧凑小屋",
    warm_care_cottage: "温暖照护屋",
    protective_courtyard: "守护庭院屋",
    quiet_retreat_house: "安静退居屋",
    aesthetic_garden_home: "花园美学屋",
    adaptive_modular_home: "自适应模块屋",
  } satisfies Record<
    NonNullable<ConstructionPlan["houseStyle"]>["archetype"],
    string
  >

  return labels[archetype]
}

function toMaterialLabel(
  material: NonNullable<ConstructionPlan["houseStyle"]>["materialPreference"]
): string {
  const labels = {
    balanced_natural_mix: "自然混合材料",
    wood_and_leaf: "木材与叶影",
    stone_and_shade: "石材与遮阴",
    water_softened_clay: "水润黏土",
    lightweight_modular: "轻量模块材料",
  } satisfies Record<
    NonNullable<ConstructionPlan["houseStyle"]>["materialPreference"],
    string
  >

  return labels[material]
}

function toFootprintLabel(
  footprint: NonNullable<ConstructionPlan["houseStyle"]>["spatialPreference"]["footprint"]
): string {
  if (footprint === "expandable") return "可扩展占地"
  if (footprint === "balanced") return "均衡占地"

  return "紧凑占地"
}

function toPrivacyLabel(
  privacy: NonNullable<ConstructionPlan["houseStyle"]>["spatialPreference"]["privacy"]
): string {
  if (privacy === "protected") return "保护性强"
  if (privacy === "buffered") return "有缓冲"

  return "开放"
}

function toLayoutFlowLabel(
  layoutFlow: NonNullable<ConstructionPlan["houseStyle"]>["spatialPreference"]["layoutFlow"]
): string {
  if (layoutFlow === "ordered") return "秩序流线"
  if (layoutFlow === "clustered") return "聚合流线"
  if (layoutFlow === "adaptive") return "可调整流线"

  return "柔和流线"
}
