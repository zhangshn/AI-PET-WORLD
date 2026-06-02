/**
 * 当前文件负责：提供紫微动态运势模块的统一调用入口。
 */

import type {
  BirthPattern,
  BranchPalace,
  PersonalityProfile
} from "../ziwei-core-schema"

import {
  buildZiweiDynamicChart
} from "./dynamic-flow-engine"

import {
  composeZiweiDynamicInfluence
} from "./dynamic-influence-composer"

import {
  buildCurrentDynamicProfile
} from "./current-profile/current-dynamic-profile-composer"

import type {
  CurrentDynamicProfile
} from "./current-profile/current-dynamic-profile-schema"

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

export interface BuildZiweiCurrentDynamicProfileInput
  extends BuildZiweiDynamicInfluenceInput {
  baseProfile: PersonalityProfile
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

export function buildZiweiCurrentDynamicProfile(
  input: BuildZiweiCurrentDynamicProfileInput
): ZiweiDynamicResult<CurrentDynamicProfile> {
  const chartResult = buildZiweiDynamicChart(input)

  if (!chartResult.ok) {
    return chartResult
  }

  const influence = composeZiweiDynamicInfluence(chartResult.data)

  return {
    ok: true,
    data: buildCurrentDynamicProfile({
      baseProfile: input.baseProfile,
      chart: chartResult.data,
      influence
    })
  }
}

export type {
  CurrentDynamicBiases,
  CurrentDynamicFlowSummary,
  CurrentDynamicLabels,
  CurrentDynamicPreference,
  CurrentDynamicProfile,
  CurrentDynamicTendencies
} from "./current-profile/current-dynamic-profile-schema"