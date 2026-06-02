/**
 * 当前文件负责：根据生命人格档案里的建设偏置判断家园成长方向。
 */

import type { GenderAwareBehaviorBias } from "@/ai/ai-system-gateway"
import type { HomeEvolutionFocus } from "@/types/home"

export function resolveEvolutionFocus(
  bias?: GenderAwareBehaviorBias | null
): HomeEvolutionFocus {
  if (!bias) return "balanced"

  const building = bias.buildingBias

  const entries: Array<[HomeEvolutionFocus, number]> = [
    ["expansion", building.expansionPreference],
    ["stability", building.stabilityPreference],
    ["comfort", building.comfortPreference],
    ["order", building.orderPreference],
    ["adaptive", building.adaptabilityPreference],
  ]

  const [focus, score] = entries.sort((a, b) => b[1] - a[1])[0]

  return score >= 60 ? focus : "balanced"
}