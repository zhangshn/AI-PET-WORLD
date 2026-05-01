/**
 * 当前文件负责：提供紫微动态运势模块的统一调用入口。
 */

import type {
  BirthPattern,
  BranchPalace
} from "../schema"

import {
  buildZiweiDynamicChart
} from "./dynamic-flow-engine"

import {
  composeZiweiDynamicInfluence
} from "./dynamic-influence-composer"

import type {
  ZiweiDynamicChart,
  ZiweiDynamicInfluence,
  ZiweiDynamicResult
} from "./dynamic-schema"

export interface BuildZiweiDynamicInfluenceInput {
  pattern: BirthPattern

  /**
   * 必填。
   * 不允许 unknown fallback。
   */
  gender: unknown

  currentAge: number
  currentYear: number
  currentLunarMonth: number
  currentLunarDay: number
  currentTimeBranch: BranchPalace
}

export function buildZiweiDynamicChartOnly(
  input: BuildZiweiDynamicInfluenceInput
): ZiweiDynamicResult<ZiweiDynamicChart> {
  return buildZiweiDynamicChart(input)
}

export function buildZiweiDynamicInfluence(
  input: BuildZiweiDynamicInfluenceInput
): ZiweiDynamicResult<ZiweiDynamicInfluence> {
  const chartResult = buildZiweiDynamicChart(input)

  if (!chartResult.ok) {
    return chartResult
  }

  return {
    ok: true,
    data: composeZiweiDynamicInfluence(chartResult.data)
  }
}