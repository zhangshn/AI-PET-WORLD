import type {
  BranchPalace,
  FullZiweiChart,
  HeavenlyStem,
  ZiweiDynamicFlowType,
  ZiweiPlacedStar,
  ZiweiStarId
} from "../contracts"
import { moveBranch } from "../shared"
import {
  ASSISTANT_STAR_IDS,
  getZiweiStarDefinition,
  MALEFIC_STAR_IDS
} from "../star-catalog"
import {
  getLucunBranch,
  getTianmaBranch
} from "../star-placement/assistant-stars/lucun-tianma"
import { getKuiYueBranches } from "../star-placement/assistant-stars/kui-yue"

export function buildDynamicFlowingStars(params: {
  chart: FullZiweiChart
  flowType: ZiweiDynamicFlowType
  stem: HeavenlyStem
  branch: BranchPalace
}): ZiweiPlacedStar[] {
  if (params.flowType === "natal") {
    return []
  }

  const lucunBranch = getLucunBranch(params.stem)
  const kuiYueBranches = getKuiYueBranches(params.stem)
  const tianmaBranch = getTianmaBranch(params.branch)

  return [
    createDynamicFlowingStar({
      chart: params.chart,
      flowType: params.flowType,
      starId: ASSISTANT_STAR_IDS.lucun,
      branch: lucunBranch,
      placementRuleId: `dynamic.${params.flowType}.lucun.flow-stem`,
      debug: {
        stem: params.stem
      }
    }),
    createDynamicFlowingStar({
      chart: params.chart,
      flowType: params.flowType,
      starId: MALEFIC_STAR_IDS.qingyang,
      branch: moveBranch(lucunBranch, 1),
      placementRuleId: `dynamic.${params.flowType}.qingyang.lucun-neighbor`,
      debug: {
        stem: params.stem,
        lucunBranch,
        offsetFromLucun: 1
      }
    }),
    createDynamicFlowingStar({
      chart: params.chart,
      flowType: params.flowType,
      starId: MALEFIC_STAR_IDS.tuoluo,
      branch: moveBranch(lucunBranch, -1),
      placementRuleId: `dynamic.${params.flowType}.tuoluo.lucun-neighbor`,
      debug: {
        stem: params.stem,
        lucunBranch,
        offsetFromLucun: -1
      }
    }),
    createDynamicFlowingStar({
      chart: params.chart,
      flowType: params.flowType,
      starId: ASSISTANT_STAR_IDS.tianma,
      branch: tianmaBranch,
      placementRuleId: `dynamic.${params.flowType}.tianma.flow-branch`,
      debug: {
        branch: params.branch
      }
    }),
    createDynamicFlowingStar({
      chart: params.chart,
      flowType: params.flowType,
      starId: ASSISTANT_STAR_IDS.tiankui,
      branch: kuiYueBranches.tiankui,
      placementRuleId: `dynamic.${params.flowType}.tiankui.flow-stem`,
      debug: {
        stem: params.stem
      }
    }),
    createDynamicFlowingStar({
      chart: params.chart,
      flowType: params.flowType,
      starId: ASSISTANT_STAR_IDS.tianyue,
      branch: kuiYueBranches.tianyue,
      placementRuleId: `dynamic.${params.flowType}.tianyue.flow-stem`,
      debug: {
        stem: params.stem
      }
    })
  ]
}

function createDynamicFlowingStar(params: {
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
    throw new Error(`Unknown dynamic flowing star id: ${params.starId}`)
  }

  if (!palace) {
    throw new Error(`Missing palace for dynamic flowing star: ${params.branch}`)
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
