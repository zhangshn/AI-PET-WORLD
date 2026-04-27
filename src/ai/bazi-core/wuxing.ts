/**
 * 当前文件负责：统计八字三柱/四柱中的五行分布。
 */

import type {
  BaziChart,
  BaziPillar,
  WuXingDistribution,
  WuXingElement,
  WuXingScore,
} from "./bazi-types"

export const WUXING_ELEMENTS: WuXingElement[] = [
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
]

export function createEmptyWuXingScore(): WuXingScore {
  return {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  }
}

function addPillarScore(score: WuXingScore, pillar: BaziPillar) {
  score[pillar.stemElement] += 1
  score[pillar.branchElement] += 1
}

export function collectUsedPillars(chart: BaziChart): BaziPillar[] {
  const pillars = [
    chart.yearPillar,
    chart.monthPillar,
    chart.dayPillar,
  ]

  if (chart.hourPillar) {
    pillars.push(chart.hourPillar)
  }

  return pillars
}

export function calculateWuXingScore(chart: BaziChart): WuXingScore {
  const score = createEmptyWuXingScore()

  for (const pillar of collectUsedPillars(chart)) {
    addPillarScore(score, pillar)
  }

  return score
}

export function normalizeWuXingScore(score: WuXingScore): WuXingDistribution {
  const total = WUXING_ELEMENTS.reduce(
    (sum, element) => sum + score[element],
    0
  )

  if (total <= 0) {
    return {
      wood: 0.2,
      fire: 0.2,
      earth: 0.2,
      metal: 0.2,
      water: 0.2,
    }
  }

  return {
    wood: score.wood / total,
    fire: score.fire / total,
    earth: score.earth / total,
    metal: score.metal / total,
    water: score.water / total,
  }
}

export function getDominantElements(
  distribution: WuXingDistribution
): WuXingElement[] {
  const maxValue = Math.max(
    distribution.wood,
    distribution.fire,
    distribution.earth,
    distribution.metal,
    distribution.water
  )

  return WUXING_ELEMENTS.filter(
    (element) => distribution[element] === maxValue
  )
}