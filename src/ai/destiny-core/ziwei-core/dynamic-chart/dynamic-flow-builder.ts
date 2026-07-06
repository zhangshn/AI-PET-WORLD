import type {
  BranchPalace,
  FullZiweiChart,
  FullZiweiDynamicTransformation,
  FullZiweiDynamicFlow,
  HeavenlyStem,
  ZiweiDynamicStemSource,
  ZiweiDynamicFlowType,
  ZiweiPlacedStar
} from "../contracts"
import { getZiweiDynamicFlowWeight } from "../knowledge/dynamicWeights"
import { getZiweiStarDefinition } from "../star-catalog"
import { NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM } from "../star-placement/transformations"

import { buildDynamicPalaceMaps } from "./dynamic-palace-maps"
import { buildDynamicAnnualCycleStars } from "./dynamic-annual-cycle-stars"
import { buildDynamicFlowingStars } from "./dynamic-flow-stars"

export function buildDynamicFlow(params: {
  chart: FullZiweiChart
  type: ZiweiDynamicFlowType
  palace: BranchPalace
  stem: HeavenlyStem
  stemSource: ZiweiDynamicStemSource
  isActive: boolean
  inactiveReason?: string
}): FullZiweiDynamicFlow {
  const {
    dynamicBranchToSectorMap,
    dynamicSectorToBranchMap
  } = buildDynamicPalaceMaps(params.palace)
  const flowingStars = buildDynamicFlowingStars({
    chart: params.chart,
    flowType: params.type,
    stem: params.stem,
    branch: params.palace
  })
  const annualCycleStars = buildDynamicAnnualCycleStars({
    chart: params.chart,
    flowType: params.type,
    stem: params.stem,
    branch: params.palace
  })

  return {
    type: params.type,
    palace: params.palace,
    sectorName: dynamicBranchToSectorMap[params.palace],
    stem: params.stem,
    stemSource: params.stemSource,
    dynamicBranchToSectorMap,
    dynamicSectorToBranchMap,
    stars: getStarsByBranch(params.chart, params.palace),
    flowingStars,
    annualCycleStars,
    transformations: buildDynamicTransformations({
      chart: params.chart,
      flowType: params.type,
      stem: params.stem
    }),
    influence: params.isActive
      ? getZiweiDynamicFlowWeight(params.type)
      : 0,
    isActive: params.isActive,
    inactiveReason: params.inactiveReason
  }
}

function getStarsByBranch(
  chart: FullZiweiChart,
  palace: BranchPalace
): ZiweiPlacedStar[] {
  const match = chart.palaces.find((item) => item.branch === palace)

  if (!match) {
    return []
  }

  return Object.values(match.stars).flat()
}

function buildDynamicTransformations(params: {
  chart: FullZiweiChart
  flowType: ZiweiDynamicFlowType
  stem: HeavenlyStem
}): FullZiweiDynamicTransformation[] {
  const rules = NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM[params.stem]
  const placedStars = params.chart.palaces.flatMap((palace) => {
    return Object.values(palace.stars).flat()
  })

  return rules.map((rule) => {
    const transformationDefinition = getZiweiStarDefinition(
      rule.transformationStarId
    )
    const targetStar = placedStars.find((star) => {
      return star.starId === rule.targetStarId
    })

    if (!transformationDefinition) {
      throw new Error(
        `Unknown dynamic transformation star id: ${rule.transformationStarId}`
      )
    }

    if (!targetStar) {
      throw new Error(
        `Missing dynamic transformation target star: ${rule.targetStarId}`
      )
    }

    return {
      transformationStarId: transformationDefinition.starId,
      transformationLabel: transformationDefinition.label,
      targetStarId: targetStar.starId,
      targetStarLabel: targetStar.label,
      branch: targetStar.branch,
      sectorName: targetStar.sectorName,
      placementRuleId: `transformation.dynamic.${params.flowType}-stem`
    }
  })
}
