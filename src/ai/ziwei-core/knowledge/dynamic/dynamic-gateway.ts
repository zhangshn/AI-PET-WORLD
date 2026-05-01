/**
 * 当前文件负责：提供紫微动态运势模块的统一调用入口。
 */

import type {
  BirthPattern,
  BranchPalace,
  ElementGate
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

  /**
   * 当前 BirthPattern 暂时没有 elementGate，
   * 所以动态层先显式接收。
   */
  elementGate: ElementGate

  currentAge: number
  currentYear: number
  currentLunarMonth: number
  currentLunarDay: number
  currentTimeBranch: BranchPalace
}

/**
 * 只构建动态盘，不合成行为影响。
 * 适合调试页使用。
 */
export function buildZiweiDynamicChartOnly(
  input: BuildZiweiDynamicInfluenceInput
): ZiweiDynamicResult<ZiweiDynamicChart> {
  return buildZiweiDynamicChart(input)
}

/**
 * 构建完整动态行为影响。
 */
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