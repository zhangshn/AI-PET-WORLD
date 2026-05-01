/**
 * 当前文件负责：计算紫微动态运势层的大运、流年、流月、流日、流时落宫。
 */

import type {
  BirthPattern,
  BranchPalace,
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
   * 当前年龄。
   */
  currentAge: number

  /**
   * 当前公历年份。
   */
  currentYear: number

  /**
   * 当前农历月份。
   */
  currentLunarMonth: number

  /**
   * 当前农历日期。
   */
  currentLunarDay: number

  /**
   * 当前时辰。
   */
  currentTimeBranch: BranchPalace
}

export function getYearBranch(currentYear: number): BranchPalace {
  const offset = safeModulo(currentYear - 2020, 12)
  return YEAR_BRANCH_ORDER[offset]
}

export function getTimeBranchOffset(timeBranch: BranchPalace): number {
  const index = TIME_BRANCH_ORDER.indexOf(timeBranch)

  if (index < 0) {
    return 0
  }

  return index
}

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

function getStarsByPalace(
  pattern: BirthPattern,
  palace: BranchPalace
): StarId[] {
  return [...(pattern.branchPalaces[palace] ?? [])]
}

function getSectorNameByPalace(
  pattern: BirthPattern,
  palace: BranchPalace
): string {
  return pattern.branchToSectorMap[palace] ?? "unknown"
}

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

export function getLiuNianPalace(currentYear: number): BranchPalace {
  return getYearBranch(currentYear)
}

export function getLiuYuePalace(params: {
  liuNianPalace: BranchPalace
  currentLunarMonth: number
}): BranchPalace {
  const month = normalizeLunarMonth(params.currentLunarMonth)
  return moveBranch(params.liuNianPalace, month - 1)
}

export function getLiuRiPalace(params: {
  liuYuePalace: BranchPalace
  currentLunarDay: number
}): BranchPalace {
  const day = normalizeLunarDay(params.currentLunarDay)
  return moveBranch(params.liuYuePalace, day - 1)
}

export function getLiuShiPalace(params: {
  liuRiPalace: BranchPalace
  currentTimeBranch: BranchPalace
}): BranchPalace {
  const offset = getTimeBranchOffset(params.currentTimeBranch)
  return moveBranch(params.liuRiPalace, offset)
}

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

  const startAge = getElementGateStartAge(input.pattern.elementGate)

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