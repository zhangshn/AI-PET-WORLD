/**
 * 当前文件负责把家园区域转换为关系图摘要。
 */

import type { ConstructionPlan } from "@/world/construction/construction-schema"
import type {
  HomeMapState,
  HomeZone,
  HomeZoneType,
} from "@/world/map-state/home-map-state-schema"

import type { ZoneGraphSummary } from "./world-visualization-schema"

const CORE_ZONE_TYPES: HomeZoneType[] = [
  "pet_arrival",
  "initial_care",
  "temporary_shelter",
  "pet_rest",
  "storage_tools",
]

const ZONE_LABELS: Record<HomeZoneType, string> = {
  visual_center: "核心活动范围",
  pet_arrival: "宠物抵达区",
  initial_care: "初始照护区",
  temporary_shelter: "临时住所区",
  pet_rest: "宠物休息区",
  storage_tools: "储物工具区",
  natural_boundary: "自然边界区",
}

const ZONE_ROLES: Record<HomeZoneType, string> = {
  visual_center: "承载主要生活关系",
  pet_arrival: "宠物进入家园后的第一落点",
  initial_care: "食物、饮水和基础照护的中心",
  temporary_shelter: "管家与宠物初期可依靠的住所",
  pet_rest: "宠物恢复精力和安全感的安静区域",
  storage_tools: "材料、工具和临时资源整理区",
  natural_boundary: "形成外围缓冲与生态边界",
}

export function buildZoneGraphSummary(
  homeMapState: HomeMapState,
  constructionPlan: ConstructionPlan | null
): ZoneGraphSummary {
  const zonesByType = new Map(
    homeMapState.zones.map((zone) => [zone.type, zone])
  )

  return {
    nodes: CORE_ZONE_TYPES.map((zoneType) =>
      buildZoneNode(zonesByType.get(zoneType), zoneType, constructionPlan)
    ),
    edges: [
      {
        from: "pet_arrival",
        to: "initial_care",
        label: "抵达后进入照护",
      },
      {
        from: "initial_care",
        to: "temporary_shelter",
        label: "照护与住所连接",
      },
      {
        from: "initial_care",
        to: "pet_rest",
        label: "宠物需求触发休息区",
      },
      {
        from: "storage_tools",
        to: "temporary_shelter",
        label: "材料支持住所",
      },
    ],
  }
}

function buildZoneNode(
  zone: HomeZone | undefined,
  zoneType: HomeZoneType,
  constructionPlan: ConstructionPlan | null
): ZoneGraphSummary["nodes"][number] {
  return {
    id: zoneType,
    label: zone?.name ?? ZONE_LABELS[zoneType],
    role: zone?.purpose ?? ZONE_ROLES[zoneType],
    status: getZoneStatus(zoneType, constructionPlan),
  }
}

function getZoneStatus(
  zoneType: HomeZoneType,
  constructionPlan: ConstructionPlan | null
): ZoneGraphSummary["nodes"][number]["status"] {
  if (!constructionPlan) {
    return zoneType === "pet_arrival" || zoneType === "initial_care"
      ? "active"
      : "quiet"
  }

  if (constructionPlan.targetZoneType !== zoneType) {
    return zoneType === "initial_care" ? "active" : "quiet"
  }

  if (constructionPlan.currentStage === "completed") return "completed"
  return "under_construction"
}
