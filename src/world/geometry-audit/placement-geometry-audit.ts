/**
 * Current file responsibility: build batch placement geometry and rule audit reports.
 */

import {
  buildEntityGeometryFromPlacement,
  checkPlacementWorldRule,
} from "@/world/geometry-adapters/geometry-adapter-gateway"
import type { MapPlacement, HomeMapState } from "@/world/map-state/home-map-state-schema"

import type {
  PlacementGeometryAuditItem,
  PlacementGeometryAuditReport,
  PlacementGeometryAuditSummary,
} from "./placement-geometry-audit-schema"

export type BuildPlacementGeometryAuditReportInput = {
  homeMapState: HomeMapState
  checkedAt?: number
}

export function buildPlacementGeometryAuditReport(
  input: BuildPlacementGeometryAuditReportInput
): PlacementGeometryAuditReport {
  const items = input.homeMapState.placements.map((placement) =>
    buildPlacementGeometryAuditItem(placement)
  )

  return {
    worldId: input.homeMapState.worldId,
    checkedAt: input.checkedAt ?? Date.now(),
    summary: buildPlacementGeometryAuditSummary(items),
    items,
  }
}

function buildPlacementGeometryAuditItem(
  placement: MapPlacement
): PlacementGeometryAuditItem {
  try {
    const geometry = buildEntityGeometryFromPlacement({ placement })
    const ruleCheck = checkPlacementWorldRule({ placement })

    return {
      placementId: placement.id,
      label: placement.label,
      layer: placement.layer,
      assetId: placement.assetId,
      geometryBuilt: true,
      hasFootprint: Boolean(geometry.footprint),
      hasCollision: Boolean(geometry.collision),
      hasSupport: Boolean(geometry.support),
      hasInfluence: Boolean(geometry.influence),
      objectType: ruleCheck.objectType,
      ruleAccepted: ruleCheck.accepted,
      ruleReason: ruleCheck.reason,
      ruleMessage: ruleCheck.message,
      tags: geometry.tags,
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? `placement 几何审计失败：${error.message}`
        : "placement 几何审计失败：未知错误。"

    return {
      placementId: placement.id,
      label: placement.label,
      layer: placement.layer,
      assetId: placement.assetId,
      geometryBuilt: false,
      hasFootprint: false,
      hasCollision: false,
      hasSupport: false,
      hasInfluence: false,
      objectType: null,
      ruleAccepted: false,
      ruleReason: "unknown_rule",
      ruleMessage: message,
      tags: placement.tags,
    }
  }
}

function buildPlacementGeometryAuditSummary(
  items: PlacementGeometryAuditItem[]
): PlacementGeometryAuditSummary {
  return {
    totalPlacements: items.length,
    geometryBuiltCount: countBy(items, (item) => item.geometryBuilt),
    ruleMappedCount: countBy(items, (item) => item.objectType !== null),
    acceptedCount: countBy(items, (item) => item.ruleAccepted),
    rejectedCount: countBy(items, (item) => !item.ruleAccepted),
    unmappedCount: countBy(items, (item) => item.objectType === null),
    collisionGeometryCount: countBy(items, (item) => item.hasCollision),
    supportGeometryCount: countBy(items, (item) => item.hasSupport),
    influenceGeometryCount: countBy(items, (item) => item.hasInfluence),
  }
}

function countBy<TItem>(
  items: TItem[],
  predicate: (item: TItem) => boolean
): number {
  return items.reduce(
    (count, item) => (predicate(item) ? count + 1 : count),
    0
  )
}
