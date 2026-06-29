import type {
  BranchPalace,
  FullZiweiChart,
  FullZiweiDynamicFlow,
  ZiweiDynamicFlowType,
  ZiweiPlacedStar
} from "../contracts"
import { getZiweiDynamicFlowWeight } from "../knowledge/dynamicWeights"

import { buildDynamicPalaceMaps } from "./dynamic-palace-maps"

export function buildDynamicFlow(params: {
  chart: FullZiweiChart
  type: ZiweiDynamicFlowType
  palace: BranchPalace
  isActive: boolean
  inactiveReason?: string
}): FullZiweiDynamicFlow {
  const {
    dynamicBranchToSectorMap,
    dynamicSectorToBranchMap
  } = buildDynamicPalaceMaps(params.palace)

  return {
    type: params.type,
    palace: params.palace,
    sectorName: dynamicBranchToSectorMap[params.palace],
    dynamicBranchToSectorMap,
    dynamicSectorToBranchMap,
    stars: getStarsByBranch(params.chart, params.palace),
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
