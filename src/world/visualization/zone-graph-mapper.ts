/**
 * 当前文件职责：把家园区域转换为关系图摘要。
 */

import type { ConstructionPlan } from "@/world/construction/construction-schema"
import type {
  HomeMapState,
  HomeZone,
  HomeZoneType,
} from "@/world/map-state/home-map-state-schema"

import type { ZoneGraphSummary } from "./world-visualization-schema"

const CORE_ZONE_TYPES: HomeZoneType[] = [
  "entry_area",
  "initial_care",
  "temporary_shelter",
  "quiet_living",
  "storage_tools",
]

const ZONE_LABELS: Record<HomeZoneType, string> = {
  visual_center: "核心活动范围",
  entry_area: "初始入口区",
  initial_care: "初始照护区",
  temporary_shelter: "临时住所区",
  quiet_living: "安静生活区",
  storage_tools: "储物工具区",
  natural_boundary: "自然边界区",
}

const ZONE_ROLES: Record<HomeZoneType, string> = {
  visual_center: "承载主要生活关系",
  entry_area: "进入家园后的第一落点",
  initial_care: "基础照护与管理的中心",
  temporary_shelter: "初期可依靠的住所",
  quiet_living: "恢复秩序和安全感的安静区域",
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
        from: "entry_area",
        to: "initial_care",
        label: "入口连接照护",
      },
      {
        from: "initial_care",
        to: "temporary_shelter",
        label: "照护与住所连接",
      },
      {
        from: "initial_care",
        to: "quiet_living",
        label: "照护连接生活区",
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
    return zoneType === "entry_area" || zoneType === "initial_care"
      ? "active"
      : "quiet"
  }

  if (constructionPlan.targetZoneType !== zoneType) {
    return zoneType === "initial_care" ? "active" : "quiet"
  }

  if (constructionPlan.currentStage === "completed") return "completed"
  return "under_construction"
}
