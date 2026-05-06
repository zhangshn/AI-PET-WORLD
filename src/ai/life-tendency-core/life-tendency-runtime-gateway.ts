/**
 * 当前文件负责：根据运行时输入构建当前生命趋向。
 */

import {
  buildZiweiCurrentDynamicProfile
} from "../ziwei-core/ziwei-gateway"

import type {
  BirthPattern,
  PersonalityProfile
} from "../ziwei-core/schema"

import {
  buildBaziCurrentTendencyProfile,
  buildBaziRuntimeProfile
} from "../bazi-core/bazi-gateway"

import type {
  BaziProfile,
  BaziRuntimeGender
} from "../bazi-core/bazi-gateway"

import type {
  BranchPalace
} from "../ziwei-core/schema"

import {
  buildCurrentLifeTendencyProfile
} from "./life-tendency-composer"

import type {
  CurrentLifeTendencyProfile
} from "./life-tendency-schema"

export type LifeTendencyRuntimeGender =
  | "male"
  | "female"
  | "unknown"

export interface LifeTendencyRuntimeTime {
  currentYear: number
  currentMonth: number
  currentDay: number
  currentHour: number | null

  currentAge: number

  currentLunarMonth: number
  currentLunarDay: number
  currentTimeBranch: BranchPalace
}

export interface BuildCurrentLifeTendencyFromRuntimeInput {
  /**
   * 紫微底盘。
   * 出生时间未知时允许为 null。
   */
  pattern: BirthPattern | null

  /**
   * 紫微原始人格。
   * 出生时间未知时允许为 null。
   */
  baseProfile: PersonalityProfile | null

  /**
   * 八字原局人格。
   * 八字允许三柱模式，所以这里必须存在。
   */
  baziProfile: BaziProfile

  /**
   * 当前动态性别视角。
   */
  gender: LifeTendencyRuntimeGender

  /**
   * 当前运行时间。
   * 未来真实游戏里，这里应该来自 world time。
   */
  runtimeTime: LifeTendencyRuntimeTime
}

function resolveBaziGender(
  gender: LifeTendencyRuntimeGender
): BaziRuntimeGender {
  if (gender === "male" || gender === "female") {
    return gender
  }

  return "unknown"
}

export function buildCurrentLifeTendencyFromRuntime(
  input: BuildCurrentLifeTendencyFromRuntimeInput
): CurrentLifeTendencyProfile {
  const ziweiDynamicResult =
    input.pattern && input.baseProfile
      ? buildZiweiCurrentDynamicProfile({
          pattern: input.pattern,
          baseProfile: input.baseProfile,
          gender: input.gender,
          currentAge: input.runtimeTime.currentAge,
          currentYear: input.runtimeTime.currentYear,
          currentLunarMonth: input.runtimeTime.currentLunarMonth,
          currentLunarDay: input.runtimeTime.currentLunarDay,
          currentTimeBranch: input.runtimeTime.currentTimeBranch,
        })
      : null

  const ziweiProfile =
    ziweiDynamicResult && ziweiDynamicResult.ok
      ? ziweiDynamicResult.data
      : null

  const baziRuntimeProfile = buildBaziRuntimeProfile({
    birthChart: input.baziProfile.chart,
    gender: resolveBaziGender(input.gender),
    currentYear: input.runtimeTime.currentYear,
    currentMonth: input.runtimeTime.currentMonth,
    currentDay: input.runtimeTime.currentDay,
    currentHour: input.runtimeTime.currentHour,
  })

  const baziTendencyProfile = buildBaziCurrentTendencyProfile({
    baseProfile: input.baziProfile,
    runtimeProfile: baziRuntimeProfile,
  })

  return buildCurrentLifeTendencyProfile({
    ziweiProfile,
    baziTendencyProfile,
    fallbackTraits: input.baseProfile?.traits ?? null,
  })
}