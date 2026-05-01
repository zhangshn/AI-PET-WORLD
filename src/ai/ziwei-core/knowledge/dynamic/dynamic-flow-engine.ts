/**
 * 当前文件负责：计算紫微动态运势层的大运、流年、流月、流日、流时落宫。
 */

import type {
  BirthPattern,
  BranchPalace,
  ElementGate,
  StarId
} from "../schema"

import { getElementGateStartAge } from "../knowledge/elementGates"
import { getZiweiDynamicFlowWeight } from "../knowledge/dynamicWeights"
import { getPairRelation } from "../knowledge/pairRelations"

import {
  moveBranch,
  safeModulo
} from "./branch-utils"

import { resolveZiweiCycleDirection } from "./cycle-direction"

import type {
  ZiweiCycleDirection,
  ZiweiDynamicChart,
  ZiweiDynamicResult,
  ZiweiFlowResult
} from "./dynamic-schema"

/**
 * 公历年份对应地支时，必须使用传统生肖地支顺序：
 * 子、丑、寅、卯、辰、巳、午、未、申、酉、戌、亥
 *
 * 注意：
 * 这不是 ziwei-engine.ts 的物理宫位顺序。
 *
 * ziwei-engine.ts 的宫位物理顺序是：
 * 寅、卯、辰、巳、午、未、申、酉、戌、亥、子、丑
 *
 * 两者不能混用。
 */
const YEAR_BRANCH_ORDER: BranchPalace[] = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai"
]

/**
 * 流时偏移必须使用传统时辰顺序：
 * 子、丑、寅、卯、辰、巳、午、未、申、酉、戌、亥
 */
const TIME_BRANCH_ORDER: BranchPalace[] = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai"
]

export interface BuildZiweiDynamicChartInput {
  pattern: BirthPattern

  /**
   * 大运顺逆必须依赖性别。
   * 缺失性别时不能 fallback。
   */
  gender: unknown

  /**
   * 当前 BirthPattern 里暂时没有 elementGate，
   * 所以动态层入口先显式要求传入五行局。
   */
  elementGate: ElementGate

  /**
   * 当前年龄。
   * 用于计算大运移动步数。
   */
  currentAge: number

  /**
   * 当前公历年份。
   * 用于计算流年地支宫。
   */
  currentYear: number

  /**
   * 当前农历月份。
   * v1 规则：正月 = 流年命宫，二月 = 下一宫。
   */
  currentLunarMonth: number

  /**
   * 当前农历日期。
   * v1 规则：初一 = 流月命宫，初二 = 下一宫。
   */
  currentLunarDay: number

  /**
   * 当前时辰。
   * v1 规则：子时 = 流日命宫，丑时 = 下一宫。
   */
  currentTimeBranch: BranchPalace
}

/**
 * 年份转地支。
 *
 * 2020 是庚子年，所以以 2020 = 子 作为稳定锚点。
 */
export function getYearBranch(currentYear: number): BranchPalace {
  const offset = safeModulo(currentYear - 2020, 12)
  return YEAR_BRANCH_ORDER[offset]
}

/**
 * 获取时辰偏移。
 *
 * 子时 = 0
 * 丑时 = 1
 * 寅时 = 2
 */
export function getTimeBranchOffset(timeBranch: BranchPalace): number {
  const index = TIME_BRANCH_ORDER.indexOf(timeBranch)

  if (index < 0) {
    return 0
  }

  return index
}

/**
 * 规整农历月份。
 */
function normalizeLunarMonth(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  const month = Math.trunc(value)

  if (month < 1) {
    return 1
  }

  if (month > 12) {
    return 12
  }

  return month
}

/**
 * 规整农历日期。
 */
function normalizeLunarDay(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  const day = Math.trunc(value)

  if (day < 1) {
    return 1
  }

  if (day > 30) {
    return 30
  }

  return day
}

/**
 * 根据宫位取原盘星曜。
 */
function getStarsByPalace(
  pattern: BirthPattern,
  palace: BranchPalace
): StarId[] {
  return [...(pattern.branchPalaces[palace] ?? [])]
}

/**
 * 根据宫位取业务宫名。
 */
function getSectorNameByPalace(
  pattern: BirthPattern,
  palace: BranchPalace
): string {
  return pattern.branchToSectorMap[palace] ?? "unknown"
}

/**
 * 检测某宫星曜命中的双星组合。
 */
function detectPairIds(stars: StarId[]): string[] {
  const deduped = Array.from(new Set(stars)).filter((star) => {
    return star !== "star_00"
  })

  const pairIds = new Set<string>()

  for (let i = 0; i < deduped.length; i++) {
    for (let j = i + 1; j < deduped.length; j++) {
      const relation = getPairRelation(deduped[i], deduped[j])

      if (relation?.enabledByDefault) {
        pairIds.add(relation.pairId)
      }
    }
  }

  return Array.from(pairIds)
}

/**
 * 创建单个动态流结果。
 */
function createFlowResult(params: {
  pattern: BirthPattern
  type: ZiweiFlowResult["type"]
  palace: BranchPalace
  influence: number
}): ZiweiFlowResult {
  const stars = getStarsByPalace(params.pattern, params.palace)

  return {
    type: params.type,
    palace: params.palace,
    sectorName: getSectorNameByPalace(params.pattern, params.palace),
    stars,
    pairIds: detectPairIds(stars),
    influence: params.influence
  }
}

/**
 * 计算大运落宫。
 *
 * 规则：
 * currentAge < startAge
 * → 大运仍在命宫
 *
 * currentAge >= startAge
 * → 进入第一步大运宫，之后每 10 年移动一宫
 */
export function getDaYunPalace(params: {
  lifePalace: BranchPalace
  direction: ZiweiCycleDirection
  startAge: number
  currentAge: number
}): BranchPalace {
  if (params.currentAge < params.startAge) {
    return params.lifePalace
  }

  const movedSteps = Math.floor(
    (params.currentAge - params.startAge) / 10
  ) + 1

  const finalSteps =
    params.direction === "forward"
      ? movedSteps
      : -movedSteps

  return moveBranch(params.lifePalace, finalSteps)
}

/**
 * 计算流年落宫。
 *
 * 流年命宫固定落在当前年份地支宫。
 */
export function getLiuNianPalace(currentYear: number): BranchPalace {
  return getYearBranch(currentYear)
}

/**
 * 计算流月落宫。
 *
 * v1：
 * 正月 = 流年命宫
 * 二月 = 下一宫
 */
export function getLiuYuePalace(params: {
  liuNianPalace: BranchPalace
  currentLunarMonth: number
}): BranchPalace {
  const month = normalizeLunarMonth(params.currentLunarMonth)
  return moveBranch(params.liuNianPalace, month - 1)
}

/**
 * 计算流日落宫。
 *
 * v1：
 * 初一 = 流月命宫
 * 初二 = 下一宫
 */
export function getLiuRiPalace(params: {
  liuYuePalace: BranchPalace
  currentLunarDay: number
}): BranchPalace {
  const day = normalizeLunarDay(params.currentLunarDay)
  return moveBranch(params.liuYuePalace, day - 1)
}

/**
 * 计算流时落宫。
 *
 * v1：
 * 子时 = 流日命宫
 * 丑时 = 下一宫
 * 寅时 = 再下一宫
 */
export function getLiuShiPalace(params: {
  liuRiPalace: BranchPalace
  currentTimeBranch: BranchPalace
}): BranchPalace {
  const offset = getTimeBranchOffset(params.currentTimeBranch)
  return moveBranch(params.liuRiPalace, offset)
}

/**
 * 构建完整动态盘。
 */
export function buildZiweiDynamicChart(
  input: BuildZiweiDynamicChartInput
): ZiweiDynamicResult<ZiweiDynamicChart> {
  const directionResult = resolveZiweiCycleDirection({
    birthYearStem: input.pattern.lunarInfo.yearStem,
    gender: input.gender
  })

  if (!directionResult.ok) {
    return directionResult
  }

  const startAge = getElementGateStartAge(input.elementGate)

  const natalPalace = input.pattern.primaryBranchPalace

  const daYunPalace = getDaYunPalace({
    lifePalace: natalPalace,
    direction: directionResult.data.direction,
    startAge,
    currentAge: input.currentAge
  })

  const liuNianPalace = getLiuNianPalace(input.currentYear)

  const liuYuePalace = getLiuYuePalace({
    liuNianPalace,
    currentLunarMonth: input.currentLunarMonth
  })

  const liuRiPalace = getLiuRiPalace({
    liuYuePalace,
    currentLunarDay: input.currentLunarDay
  })

  const liuShiPalace = getLiuShiPalace({
    liuRiPalace,
    currentTimeBranch: input.currentTimeBranch
  })

  return {
    ok: true,
    data: {
      natal: createFlowResult({
        pattern: input.pattern,
        type: "natal",
        palace: natalPalace,
        influence: getZiweiDynamicFlowWeight("natal")
      }),

      daYun: createFlowResult({
        pattern: input.pattern,
        type: "daYun",
        palace: daYunPalace,
        influence: getZiweiDynamicFlowWeight("daYun")
      }),

      liuNian: createFlowResult({
        pattern: input.pattern,
        type: "liuNian",
        palace: liuNianPalace,
        influence: getZiweiDynamicFlowWeight("liuNian")
      }),

      liuYue: createFlowResult({
        pattern: input.pattern,
        type: "liuYue",
        palace: liuYuePalace,
        influence: getZiweiDynamicFlowWeight("liuYue")
      }),

      liuRi: createFlowResult({
        pattern: input.pattern,
        type: "liuRi",
        palace: liuRiPalace,
        influence: getZiweiDynamicFlowWeight("liuRi")
      }),

      liuShi: createFlowResult({
        pattern: input.pattern,
        type: "liuShi",
        palace: liuShiPalace,
        influence: getZiweiDynamicFlowWeight("liuShi")
      }),

      debug: {
        direction: directionResult.data.direction,
        startAge
      }
    }
  }
}