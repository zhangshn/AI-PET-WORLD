/**
 * 当前文件负责：根据八字原局与测试时间生成八字大运、流年、流月、流日、流时动态结果。
 */

import { useMemo } from "react"

import {
  buildBaziRuntimeProfile,
  type BaziRuntimeGender
} from "../../../ai/bazi-core/bazi-gateway"

import type { BaziProfile } from "../../../ai/bazi-core/bazi-gateway"
import type { DynamicGenderInput } from "../types"

function resolveBaziRuntimeGender(
  dynamicGender: DynamicGenderInput
): BaziRuntimeGender {
  if (dynamicGender === "male" || dynamicGender === "female") {
    return dynamicGender
  }

  return "unknown"
}

export function useBaziRuntimeState({
  baziProfile,
  dynamicGender,
  currentYear,
  currentMonth,
  currentDay,
  currentHour
}: {
  baziProfile: BaziProfile
  dynamicGender: DynamicGenderInput
  currentYear: number
  currentMonth: number
  currentDay: number
  currentHour: number | null
}) {
  return useMemo(() => {
    return buildBaziRuntimeProfile({
      birthChart: baziProfile.chart,
      gender: resolveBaziRuntimeGender(dynamicGender),
      currentYear,
      currentMonth,
      currentDay,
      currentHour
    })
  }, [
    baziProfile,
    dynamicGender,
    currentYear,
    currentMonth,
    currentDay,
    currentHour
  ])
}