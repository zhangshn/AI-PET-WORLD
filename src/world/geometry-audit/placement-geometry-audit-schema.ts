/**
 * Current file responsibility: define placement geometry and rule audit result types.
 */

import type {
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"
import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"
import type {
  WorldObjectType,
  WorldRuleCheckReason,
} from "@/world/core-rules/world-rule-gateway"

export type GeometrySource =
  | "shape_grammar_tree"
  | "shape_grammar_house"
  | "shape_grammar_road"
  | "shape_grammar_generic"
  | "fallback_rectangle"
  | "unknown"

export type PlacementGeometryAuditItem = {
  placementId: string
  label: string
  layer: MapPlacementLayer
  assetId: WorldMapAssetId
  geometrySource: GeometrySource
  geometryBuilt: boolean
  hasFootprint: boolean
  hasCollision: boolean
  hasSupport: boolean
  hasInfluence: boolean
  objectType: WorldObjectType | null
  ruleAccepted: boolean
  ruleReason: WorldRuleCheckReason
  ruleMessage: string
  tags: string[]
}

export type PlacementGeometryAuditSummary = {
  totalPlacements: number
  geometryBuiltCount: number
  ruleMappedCount: number
  acceptedCount: number
  rejectedCount: number
  unmappedCount: number
  collisionGeometryCount: number
  supportGeometryCount: number
  influenceGeometryCount: number
  shapeGrammarCount: number
  fallbackRectangleCount: number
  unknownGeometrySourceCount: number
}

export type PlacementGeometryAuditReport = {
  worldId: string
  checkedAt: number
  summary: PlacementGeometryAuditSummary
  items: PlacementGeometryAuditItem[]
}
