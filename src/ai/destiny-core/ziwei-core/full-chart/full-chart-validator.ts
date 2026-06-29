import type { FullZiweiChart, ZiweiPalaceStarsByCategory } from "../contracts"

import { PHYSICAL_BRANCH_ORDER } from "../shared"

export function validateFullZiweiChart(chart: FullZiweiChart): string[] {
  const warnings: string[] = []

  if (chart.palaces.length !== 12) {
    warnings.push(`Expected 12 palaces, got ${chart.palaces.length}.`)
  }

  const palaceBranches = new Set(chart.palaces.map((palace) => palace.branch))
  PHYSICAL_BRANCH_ORDER.forEach((branch) => {
    if (!palaceBranches.has(branch)) {
      warnings.push(`Missing palace branch: ${branch}.`)
    }
  })

  const mainStars = chart.palaces.flatMap((palace) => palace.stars.main)
  if (mainStars.length !== 14) {
    warnings.push(`Expected 14 main stars, got ${mainStars.length}.`)
  }

  const categories: Array<keyof ZiweiPalaceStarsByCategory> = [
    "main",
    "assistant",
    "malefic",
    "transformation",
    "misc",
    "lifecycle",
    "yearly",
    "monthly",
    "dailyHourly"
  ]

  chart.palaces.forEach((palace) => {
    categories.forEach((category) => {
      if (!Array.isArray(palace.stars[category])) {
        warnings.push(`Palace ${palace.branch} missing ${category} group.`)
      }
    })
  })

  return warnings
}
