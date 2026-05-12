/**
 * 当前文件负责：导出像素部件组合规则查询入口。
 */

import { PIXEL_COMPOSITION_RULES } from "./pixel-composition-registry"

import type {
  PixelCompositionKind,
  PixelCompositionRule,
  PixelCompositionTarget,
} from "./pixel-composition-schema"
import type { WorldObjectKind, WorldObjectStyleTag } from "./world-object-schema"

export { PIXEL_COMPOSITION_RULES }

export function getPixelCompositionRuleByKind(
  kind: PixelCompositionKind
): PixelCompositionRule | null {
  return PIXEL_COMPOSITION_RULES.find((rule) => rule.kind === kind) ?? null
}

export function getPixelCompositionRulesByTarget(
  target: PixelCompositionTarget
): PixelCompositionRule[] {
  return PIXEL_COMPOSITION_RULES.filter((rule) => rule.target === target)
}

export function getPixelCompositionRulesByWorldObject(
  kind: WorldObjectKind
): PixelCompositionRule[] {
  return PIXEL_COMPOSITION_RULES.filter((rule) =>
    rule.targetWorldObjects.includes(kind)
  )
}

export function getPixelCompositionRulesByStyleTag(
  styleTag: WorldObjectStyleTag
): PixelCompositionRule[] {
  return PIXEL_COMPOSITION_RULES.filter((rule) =>
    rule.styleTags.includes(styleTag)
  )
}

export function getDefaultPixelCompositionRules(): PixelCompositionRule[] {
  return PIXEL_COMPOSITION_RULES.filter((rule) => rule.defaultEnabled)
}

export type {
  PixelCompositionKind,
  PixelCompositionPartSlot,
  PixelCompositionRule,
  PixelCompositionTarget,
} from "./pixel-composition-schema"
