import type {
  ZiweiPalaceStarsByCategory,
  ZiweiPlacedStar
} from "../contracts"
import { getZiweiStarDefinition } from "../star-catalog"

export function createEmptyPalaceStarGroups(): ZiweiPalaceStarsByCategory {
  return {
    main: [],
    assistant: [],
    malefic: [],
    transformation: [],
    misc: [],
    lifecycle: [],
    yearly: [],
    monthly: [],
    dailyHourly: []
  }
}

export function groupPalaceStarsByCategory(
  stars: ZiweiPlacedStar[]
): ZiweiPalaceStarsByCategory {
  const groups = createEmptyPalaceStarGroups()

  stars.forEach((star) => {
    if (star.category === "empty") {
      return
    }

    groups[star.category].push(star)
  })

  ;(Object.keys(groups) as Array<keyof ZiweiPalaceStarsByCategory>).forEach((category) => {
    groups[category].sort(comparePlacedStars)
  })

  return groups
}

function comparePlacedStars(
  left: ZiweiPlacedStar,
  right: ZiweiPlacedStar
): number {
  const leftDefinition = getZiweiStarDefinition(left.starId)
  const rightDefinition = getZiweiStarDefinition(right.starId)
  const leftOrder = leftDefinition?.displayOrder ?? Number.MAX_SAFE_INTEGER
  const rightOrder = rightDefinition?.displayOrder ?? Number.MAX_SAFE_INTEGER

  return leftOrder - rightOrder || left.label.localeCompare(right.label)
}
