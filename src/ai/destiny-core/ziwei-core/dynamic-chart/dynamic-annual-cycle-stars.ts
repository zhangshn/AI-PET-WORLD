import type {
  BranchPalace,
  FullZiweiChart,
  HeavenlyStem,
  ZiweiDynamicFlowType,
  ZiweiPlacedStar,
  ZiweiStarId
} from "../contracts"
import { moveBranch } from "../shared"
import { getZiweiStarDefinition } from "../star-catalog"
import { getLucunBranch } from "../star-placement/assistant-stars/lucun-tianma"
import {
  BOSHI_SEQUENCE,
  JIANGQIAN_SEQUENCE,
  JIANGXING_START_BY_YEAR_BRANCH,
  SUIQIAN_SEQUENCE
} from "../star-placement/annual-stars"
import {
  getDirectionStep,
  resolveZiweiPlacementDirection
} from "../star-placement/cycle-direction"

export function buildDynamicAnnualCycleStars(params: {
  chart: FullZiweiChart
  flowType: ZiweiDynamicFlowType
  stem: HeavenlyStem
  branch: BranchPalace
}): ZiweiPlacedStar[] {
  if (params.flowType !== "liuNian") {
    return []
  }

  return [
    ...buildDynamicBoshiStars(params),
    ...buildDynamicSuiqianStars(params),
    ...buildDynamicJiangqianStars(params)
  ]
}

function buildDynamicBoshiStars(params: {
  chart: FullZiweiChart
  flowType: ZiweiDynamicFlowType
  stem: HeavenlyStem
}): ZiweiPlacedStar[] {
  const direction = resolveZiweiPlacementDirection({
    yearStem: params.stem,
    gender: params.chart.input.gender
  })
  const step = getDirectionStep(direction)
  const lucunBranch = getLucunBranch(params.stem)

  return BOSHI_SEQUENCE.map((starId, index) => {
    return createDynamicAnnualCycleStar({
      chart: params.chart,
      flowType: params.flowType,
      starId,
      branch: moveBranch(lucunBranch, index * step),
      placementRuleId: `dynamic.${params.flowType}.boshi.lucun-direction`,
      debug: {
        stem: params.stem,
        gender: params.chart.input.gender,
        lucunBranch,
        direction,
        sequenceIndex: index
      }
    })
  })
}

function buildDynamicSuiqianStars(params: {
  chart: FullZiweiChart
  flowType: ZiweiDynamicFlowType
  branch: BranchPalace
}): ZiweiPlacedStar[] {
  return SUIQIAN_SEQUENCE.map((starId, index) => {
    return createDynamicAnnualCycleStar({
      chart: params.chart,
      flowType: params.flowType,
      starId,
      branch: moveBranch(params.branch, index),
      placementRuleId: `dynamic.${params.flowType}.suiqian.year-branch-forward`,
      debug: {
        yearBranch: params.branch,
        startBranch: params.branch,
        sequenceIndex: index
      }
    })
  })
}

function buildDynamicJiangqianStars(params: {
  chart: FullZiweiChart
  flowType: ZiweiDynamicFlowType
  branch: BranchPalace
}): ZiweiPlacedStar[] {
  const startBranch = JIANGXING_START_BY_YEAR_BRANCH[params.branch]

  return JIANGQIAN_SEQUENCE.map((starId, index) => {
    return createDynamicAnnualCycleStar({
      chart: params.chart,
      flowType: params.flowType,
      starId,
      branch: moveBranch(startBranch, index),
      placementRuleId: `dynamic.${params.flowType}.jiangqian.trine-start-forward`,
      debug: {
        yearBranch: params.branch,
        startBranch,
        sequenceIndex: index
      }
    })
  })
}

function createDynamicAnnualCycleStar(params: {
  chart: FullZiweiChart
  flowType: ZiweiDynamicFlowType
  starId: ZiweiStarId
  branch: BranchPalace
  placementRuleId: string
  debug: Record<string, unknown>
}): ZiweiPlacedStar {
  const definition = getZiweiStarDefinition(params.starId)
  const palace = params.chart.palaces.find((item) => {
    return item.branch === params.branch
  })

  if (!definition) {
    throw new Error(`Unknown dynamic annual cycle star id: ${params.starId}`)
  }

  if (!palace) {
    throw new Error(
      `Missing palace for dynamic annual cycle star: ${params.branch}`
    )
  }

  return {
    starId: definition.starId,
    label: definition.label,
    category: definition.category,
    branch: params.branch,
    sectorName: palace.sectorName,
    source: params.flowType,
    placementRuleId: params.placementRuleId,
    debug: {
      ...params.debug,
      flowType: params.flowType
    }
  }
}
