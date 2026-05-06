/**
 * 当前文件负责：根据运行时输入构建当前生命趋向。
 */

import type {
  BirthPattern,
  BranchPalace,
  PersonalityProfile
} from "../ziwei-core/schema"

import type {
  BaziProfile
} from "../bazi-core/bazi-gateway"

import {
  buildCurrentLifeRuntimeBundle
} from "./life-runtime-bundle-gateway"

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

export function buildCurrentLifeTendencyFromRuntime(
  input: BuildCurrentLifeTendencyFromRuntimeInput
): CurrentLifeTendencyProfile {
  return buildCurrentLifeRuntimeBundle(input).lifeTendencyProfile
}