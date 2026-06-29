import type {
  FullZiweiChartSummary,
  FullZiweiChartStarCounts,
  FullZiweiPalace,
  ZiweiNatalFoundation
} from "../contracts"
import { createEmptyPalaceStarGroups } from "./palace-star-groups"

export function buildFullZiweiChartSummary(params: {
  foundation: ZiweiNatalFoundation
  palaces: FullZiweiPalace[]
}): FullZiweiChartSummary {
  const categorySet = new Set<string>()
  let totalStarCount = 0
  const starCountsByCategory = Object.fromEntries(
    Object.keys(createEmptyPalaceStarGroups()).map((category) => [category, 0])
  ) as FullZiweiChartStarCounts

  params.palaces.forEach((palace) => {
    Object.entries(palace.stars).forEach(([category, stars]) => {
      if (stars.length > 0) {
        categorySet.add(category)
        totalStarCount += stars.length
        starCountsByCategory[category as keyof FullZiweiChartStarCounts] +=
          stars.length
      }
    })
  })

  return {
    lifePalace: params.foundation.lifePalace,
    bodyPalace: params.foundation.bodyPalace,
    elementGate: params.foundation.elementGate,
    totalStarCount,
    starCountsByCategory,
    enabledCategories: Array.from(categorySet)
  }
}
