/**
 * 当前文件负责：构建当前生命运行动态数据包。
 */

import {
  buildZiweiCurrentDynamicProfile
} from "../destiny-core/ziwei-core/ziwei-gateway"

import {
  buildBaziCurrentTendencyProfile,
  buildBaziRuntimeProfile
} from "../destiny-core/bazi-core/bazi-gateway"

import type {
  BaziRuntimeGender
} from "../destiny-core/bazi-core/bazi-gateway"

import {
  buildCurrentLifeTendencyProfile
} from "./life-tendency-composer"

import type {
  BuildCurrentLifeTendencyFromRuntimeInput,
  LifeTendencyRuntimeGender
} from "./life-tendency-runtime-gateway"

import type {
  CurrentLifeRuntimeBundle
} from "./life-runtime-bundle-schema"

function resolveBaziGender(
  gender: LifeTendencyRuntimeGender
): BaziRuntimeGender {
  if (gender === "male" || gender === "female") {
    return gender
  }

  return "unknown"
}

export function buildCurrentLifeRuntimeBundle(
  input: BuildCurrentLifeTendencyFromRuntimeInput
): CurrentLifeRuntimeBundle {
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

  const ziweiDynamicProfile =
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

  const lifeTendencyProfile = buildCurrentLifeTendencyProfile({
    ziweiProfile: ziweiDynamicProfile,
    baziTendencyProfile,
    fallbackTraits: input.baseProfile?.traits ?? null,
  })

  return {
    ziweiDynamicProfile,
    baziRuntimeProfile,
    baziTendencyProfile,
    lifeTendencyProfile,
    debug: {
      hasZiweiDynamicProfile: ziweiDynamicProfile !== null,
      hasBaziRuntimeProfile: true,
      runtimeSource: "life-runtime-bundle",
    },
  }
}