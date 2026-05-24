/**
 * 当前文件职责：审计主世界只读视觉投影是否越界生成事实。
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import type {
  FormalVisualDeliveryAudit,
  FormalVisualDeliveryModel,
} from "./formal-visual-schema"

const FORBIDDEN_VISUAL_DELIVERY_TOKENS = [
  "pet_arrival",
  "pet_rest",
  "pet-near-arrival-point",
  "pet-bed",
  "pet_actor",
  "incubator",
  "embryo",
  "hatching",
  "incubating",
]

export function auditFormalVisualDeliveryModel(
  model: FormalVisualDeliveryModel
): FormalVisualDeliveryAudit {
  const warnings = [
    ...auditRequiredSections(model),
    ...auditForbiddenTokens(model),
  ]

  return {
    auditId: `formal-visual-delivery-audit:${model.worldId}`,
    passed: warnings.length === 0,
    warnings,
    tags: [
      "formal_visual_delivery_audit",
      warnings.length === 0
        ? "formal_visual_delivery_valid"
        : "formal_visual_delivery_warning",
      "read_only_projection",
    ],
  }
}

function auditRequiredSections(model: FormalVisualDeliveryModel): string[] {
  const warnings: string[] = []

  if (model.mapItems.length === 0) warnings.push("主世界地图缺少可展示对象。")
  if (model.zones.length === 0) warnings.push("主世界缺少区域摘要。")
  if (model.resources.length === 0) warnings.push("主世界缺少资源状态。")
  if (!model.construction.explanation.trim()) {
    warnings.push("主世界缺少管家建设解释。")
  }
  if (!model.houseStyle) warnings.push("主世界缺少房屋偏好展示。")

  return warnings
}

function auditForbiddenTokens(model: FormalVisualDeliveryModel): string[] {
  const serialized = JSON.stringify(model).toLowerCase()

  return FORBIDDEN_VISUAL_DELIVERY_TOKENS.flatMap((token) =>
    serialized.includes(token)
      ? [`FormalVisualDeliveryModel contains forbidden token: ${token}.`]
      : []
  )
}
