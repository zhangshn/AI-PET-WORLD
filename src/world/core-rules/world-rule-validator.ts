/**
 * 当前文件职责：校验世界对象是否满足基础规则。
 */

import { WORLD_OBJECT_RULES } from "./world-rule-registry"
import type {
  WorldObjectRule,
  WorldRuleCheckInput,
  WorldRuleCheckResult,
} from "./world-rule-schema"

export function checkWorldObjectRule(
  input: WorldRuleCheckInput
): WorldRuleCheckResult {
  const rule: WorldObjectRule | undefined = WORLD_OBJECT_RULES[input.objectType]

  if (!rule) {
    return {
      accepted: false,
      reason: "unknown_rule",
      message: `未找到 ${input.objectType} 的世界规则。`,
    }
  }

  if (input.isOutOfBounds) {
    return {
      accepted: false,
      reason: "out_of_bounds",
      message: "当前位置超出世界边界，无法放置。",
    }
  }

  if (input.hasCollision) {
    return {
      accepted: false,
      reason: "collision_blocked",
      message: "当前位置发生碰撞，无法放置。",
    }
  }

  if (rule.deniedSurfaces?.includes(input.surfaceType)) {
    return {
      accepted: false,
      reason: "surface_not_allowed",
      message: buildDeniedSurfaceMessage(rule, input),
    }
  }

  if (!rule.allowedSurfaces.includes(input.surfaceType)) {
    return {
      accepted: false,
      reason: "surface_not_allowed",
      message: buildAllowedSurfaceMessage(rule, input),
    }
  }

  if (rule.requiresSupport && !input.supportSurfaceType) {
    return {
      accepted: false,
      reason: "support_required",
      message: buildSupportRequiredMessage(rule),
    }
  }

  if (
    rule.requiresSupport &&
    input.supportSurfaceType &&
    !rule.supportSurfaces?.includes(input.supportSurfaceType)
  ) {
    return {
      accepted: false,
      reason: "support_missing",
      message: buildSupportMissingMessage(rule, input),
    }
  }

  return {
    accepted: true,
    reason: "allowed",
    message: "当前世界规则允许此对象放置。",
  }
}

function buildDeniedSurfaceMessage(
  rule: WorldObjectRule,
  input: WorldRuleCheckInput
): string {
  if (rule.objectType === "tree" && input.surfaceType === "water") {
    return "树不能生成在水域上。"
  }

  if (rule.objectType === "flower" && input.surfaceType === "water") {
    return "花不能生成在水域上。"
  }

  if (rule.objectType === "house_foundation" && input.surfaceType === "water") {
    return "房屋地基不能建在水域上。"
  }

  return `${rule.objectType} 不能放置在 ${input.surfaceType} 地表上。`
}

function buildAllowedSurfaceMessage(
  rule: WorldObjectRule,
  input: WorldRuleCheckInput
): string {
  if (rule.objectType === "fish") {
    return "鱼只能生活在水域中。"
  }

  return `${rule.objectType} 不允许放置在 ${input.surfaceType} 地表上。`
}

function buildSupportRequiredMessage(rule: WorldObjectRule): string {
  if (rule.objectType === "house_foundation") {
    return "房屋地基需要可承重地面。"
  }

  return `${rule.objectType} 需要可承重地面。`
}

function buildSupportMissingMessage(
  rule: WorldObjectRule,
  input: WorldRuleCheckInput
): string {
  if (rule.objectType === "house_foundation") {
    return "房屋地基需要 soil、grass 或 stone 作为承重地面。"
  }

  return `${rule.objectType} 不能由 ${input.supportSurfaceType} 承重。`
}
