/**
 * 当前文件职责：定义主世界产品化只读视觉投影协议。
 */

import type { HousePreference } from "@/world/house-style/house-style-schema"
import type {
  HomeMapSize,
  HomeZoneType,
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"

export type FormalVisualDeliveryVersion = "formal_visual_delivery_v0"

export type FormalVisualDeliverySource =
  | "home_map_state"
  | "resource_pool_state"
  | "construction_plan"
  | "house_preference"
  | "map_diff"

export type FormalVisualResourceTone =
  | "low"
  | "steady"
  | "strong"
  | "pressure"

export type FormalVisualMapItem = {
  id: string
  label: string
  x: number
  y: number
  layer: MapPlacementLayer
  zoneType?: HomeZoneType
  visualTone: "home" | "care" | "nature" | "work" | "path" | "atmosphere"
  opacity: number
}

export type FormalVisualZoneSummary = {
  id: string
  label: string
  zoneType: HomeZoneType
  x: number
  y: number
  width: number
  height: number
}

export type FormalVisualResourceSummary = {
  key: string
  label: string
  current: number
  min: number
  max: number
  regenPerTick: number
  tone: FormalVisualResourceTone
  explanation: string
}

export type FormalVisualConstructionSummary = {
  title: string
  statusLabel: string
  targetLabel: string
  explanation: string
  acceptedDiffCount: number
  rejectedDiffCount: number
}

export type FormalVisualHouseStyleSummary = {
  title: string
  archetype: HousePreference["archetype"]
  materialLabel: string
  spatialLabel: string
  scaleLabel: string
  explanation: string
}

export type FormalVisualOverview = {
  title: string
  subtitle: string
  phaseLabel: string
  mapSize: HomeMapSize
  worldObjectCount: number
  mapDiffCount: number
  townAdoptionLabel: string
}

export type FormalVisualDeliveryModel = {
  version: FormalVisualDeliveryVersion
  worldId: string
  overview: FormalVisualOverview
  zones: FormalVisualZoneSummary[]
  mapItems: FormalVisualMapItem[]
  resources: FormalVisualResourceSummary[]
  construction: FormalVisualConstructionSummary
  houseStyle: FormalVisualHouseStyleSummary | null
  sourceChain: FormalVisualDeliverySource[]
  warnings: string[]
  tags: string[]
}

export type FormalVisualDeliveryAudit = {
  auditId: string
  passed: boolean
  warnings: string[]
  tags: string[]
}
