import type {
  FullZiweiChart,
  FullZiweiPalace,
  ZiweiChartContentDetails,
  ZiweiContentDetailInsight,
  ZiweiPlacedStar,
  ZiweiStarCategory
} from "../contracts"

import { getStarContentDetail } from "./content-details"

const CONTENT_DETAIL_CATEGORIES = [
  "main",
  "assistant",
  "malefic",
  "transformation",
  "misc"
] as const satisfies readonly ZiweiStarCategory[]

export function buildZiweiChartContentDetails(
  chart: FullZiweiChart
): ZiweiChartContentDetails {
  const starInsights = chart.palaces.flatMap((palace) => {
    return CONTENT_DETAIL_CATEGORIES.flatMap((category) => {
      return palace.stars[category].flatMap((star) => {
        const insight = buildStarInsight(palace, star)

        return insight ? [insight] : []
      })
    })
  })

  return {
    starInsights,
    personalityTendencies: unique(
      starInsights.map((insight) => insight.personalityTendency)
    ),
    worldBehaviorHints: unique(
      starInsights.map((insight) => insight.worldBehaviorHint)
    ),
    debug: {
      starInsightCount: starInsights.length,
      supportedCategories: [...CONTENT_DETAIL_CATEGORIES]
    }
  }
}

function buildStarInsight(
  palace: FullZiweiPalace,
  star: ZiweiPlacedStar
): ZiweiContentDetailInsight | null {
  const detail = getStarContentDetail(star.starId)

  if (!detail) {
    return null
  }

  return {
    sourceType: "star",
    sourceId: star.starId,
    label: detail.label,
    category: star.category,
    palaceBranch: palace.branch,
    sectorName: palace.sectorName,
    personalityTendency: detail.personalityTendency,
    worldBehaviorHint: detail.worldBehaviorHint,
    tags: detail.coreThemes
  }
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}
