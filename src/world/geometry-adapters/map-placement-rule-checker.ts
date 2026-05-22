/**
 * 当前文件职责：将地图 placement 接入世界对象规则校验。
 */

import { checkWorldObjectRule } from "@/world/core-rules/world-rule-gateway"
import type {
  WorldObjectType,
  WorldRuleCheckReason,
  WorldSurfaceType,
} from "@/world/core-rules/world-rule-gateway"
import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import { inferSurfaceTypeFromPlacement } from "./map-placement-surface-adapter"

export type CheckPlacementWorldRuleInput = {
  placement: MapPlacement
  surfaceType?: WorldSurfaceType
  supportSurfaceType?: WorldSurfaceType
  hasCollision?: boolean
  isOutOfBounds?: boolean
}

export type CheckPlacementWorldRuleResult = {
  placementId: string
  objectType: WorldObjectType | null
  accepted: boolean
  reason: WorldRuleCheckReason
  message: string
}

const SUPPORT_INFERRED_LAYERS = new Set<MapPlacement["layer"]>([
  "structure",
  "facility",
  "actor",
])

export function inferWorldObjectTypeFromPlacement(
  placement: MapPlacement
): WorldObjectType | null {
  const normalizedTags = placement.tags.map((tag) => tag.toLowerCase())
  const normalizedAssetId = placement.assetId.toLowerCase()

  if (hasTag(normalizedTags, "tree") || normalizedAssetId.includes("tree")) {
    return "tree"
  }

  if (hasTag(normalizedTags, "flower") || normalizedAssetId.includes("flower")) {
    return "flower"
  }

  if (hasTag(normalizedTags, "fish")) {
    return "fish"
  }

  if (hasTag(normalizedTags, "foundation")) {
    return "house_foundation"
  }

  if (placement.layer === "path") {
    return "road"
  }

  if (hasTag(normalizedTags, "bridge")) {
    return "bridge"
  }

  if (hasTag(normalizedTags, "food_bowl") || normalizedAssetId.includes("bowl")) {
    return "food_bowl"
  }

  return null
}

export function checkPlacementWorldRule(
  input: CheckPlacementWorldRuleInput
): CheckPlacementWorldRuleResult {
  const objectType = inferWorldObjectTypeFromPlacement(input.placement)

  if (!objectType) {
    return {
      placementId: input.placement.id,
      objectType,
      accepted: true,
      reason: "allowed",
      message: "当前 placement 暂无世界规则映射，已跳过规则校验。",
    }
  }

  const surfaceType = inferRuleSurfaceType(input, objectType)
  const supportSurfaceType = inferRuleSupportSurfaceType(input, objectType)
  const checkResult = checkWorldObjectRule({
    objectType,
    surfaceType,
    supportSurfaceType,
    hasCollision: input.hasCollision,
    isOutOfBounds: input.isOutOfBounds,
  })

  return {
    placementId: input.placement.id,
    objectType,
    accepted: checkResult.accepted,
    reason: checkResult.reason,
    message: checkResult.message,
  }
}

function hasTag(tags: string[], expectedTag: string): boolean {
  return tags.includes(expectedTag)
}

function inferRuleSurfaceType(
  input: CheckPlacementWorldRuleInput,
  objectType: WorldObjectType
): WorldSurfaceType {
  if (input.surfaceType) {
    return input.surfaceType
  }

  if (objectType === "house_foundation") {
    return "grass"
  }

  return inferSurfaceTypeFromPlacement(input.placement)
}

function inferRuleSupportSurfaceType(
  input: CheckPlacementWorldRuleInput,
  objectType: WorldObjectType
): WorldSurfaceType | undefined {
  if (input.supportSurfaceType) {
    return input.supportSurfaceType
  }

  if (objectType === "house_foundation") {
    return "grass"
  }

  if (SUPPORT_INFERRED_LAYERS.has(input.placement.layer)) {
    return inferSurfaceTypeFromPlacement(input.placement)
  }

  return undefined
}
