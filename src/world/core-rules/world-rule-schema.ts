/**
 * 当前文件职责：定义世界规则层的对象、地表和校验协议。
 */

export type WorldSurfaceType =
  | "soil"
  | "grass"
  | "water"
  | "sand"
  | "stone"
  | "wood"
  | "constructed_foundation"

export type WorldObjectType =
  | "tree"
  | "flower"
  | "fish"
  | "house_foundation"
  | "road"
  | "bridge"
  | "food_bowl"
  | "care_station"

export type WorldRuleCheckReason =
  | "allowed"
  | "surface_not_allowed"
  | "support_required"
  | "support_missing"
  | "collision_blocked"
  | "out_of_bounds"
  | "unknown_rule"

export type WorldObjectRule = {
  objectType: WorldObjectType
  allowedSurfaces: WorldSurfaceType[]
  deniedSurfaces?: WorldSurfaceType[]
  requiresSupport?: boolean
  supportSurfaces?: WorldSurfaceType[]
  allowWaterOverlap?: boolean
  tags?: string[]
}

export type WorldRuleCheckInput = {
  objectType: WorldObjectType
  surfaceType: WorldSurfaceType
  supportSurfaceType?: WorldSurfaceType
  hasCollision?: boolean
  isOutOfBounds?: boolean
}

export type WorldRuleCheckResult = {
  accepted: boolean
  reason: WorldRuleCheckReason
  message: string
}
