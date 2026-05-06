/**
 * 当前文件负责：根据世界时间构建当前生命运行动态数据包。
 */

import type {
  BirthPattern,
  PersonalityProfile
} from "../ziwei-core/schema"

import type {
  BaziProfile
} from "../bazi-core/bazi-gateway"

import {
  buildCurrentLifeRuntimeBundle
} from "./life-runtime-bundle-gateway"

import {
  buildLifeRuntimeTimeFromWorld
} from "./life-runtime-time-adapter"

import type {
  CurrentLifeRuntimeBundle
} from "./life-runtime-bundle-schema"

import type {
  LifeTendencyRuntimeGender
} from "./life-tendency-runtime-gateway"

import type {
  LifeRuntimeWorldStartDate,
  LifeRuntimeWorldTimeInput
} from "./life-runtime-time-adapter"

export interface BuildCurrentLifeRuntimeBundleFromWorldInput {
  /**
   * 紫微底盘。
   */
  pattern: BirthPattern | null

  /**
   * 紫微原始人格。
   */
  baseProfile: PersonalityProfile | null

  /**
   * 八字原局人格。
   */
  baziProfile: BaziProfile

  /**
   * 当前动态性别视角。
   */
  gender: LifeTendencyRuntimeGender

  /**
   * 世界当前时间。
   */
  worldTime: LifeRuntimeWorldTimeInput

  /**
   * 世界 Day 1 对应的真实公历日期。
   */
  worldStartDate: LifeRuntimeWorldStartDate

  /**
   * 生命体出生公历日期。
   */
  birthDate: LifeRuntimeWorldStartDate
}

export function buildCurrentLifeRuntimeBundleFromWorld(
  input: BuildCurrentLifeRuntimeBundleFromWorldInput
): CurrentLifeRuntimeBundle {
  const runtimeTime = buildLifeRuntimeTimeFromWorld({
    worldTime: input.worldTime,
    worldStartDate: input.worldStartDate,
    birthDate: input.birthDate,
  })

  return buildCurrentLifeRuntimeBundle({
    pattern: input.pattern,
    baseProfile: input.baseProfile,
    baziProfile: input.baziProfile,
    gender: input.gender,
    runtimeTime,
  })
}