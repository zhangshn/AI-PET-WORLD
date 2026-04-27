/**
 * 当前文件负责：根据管家或宠物的最终人格偏置判断家园成长方向。
 */

import type { FinalPersonalityProfile } from "@/ai/gateway"
import type { HomeEvolutionFocus } from "@/types/home"

export function resolveEvolutionFocus(
  profile?: FinalPersonalityProfile | null
): HomeEvolutionFocus {
  if (!profile) return "balanced"

  const building = profile.bias.buildingBias

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