/**
 * 当前文件负责：维护 personality-test 页面统一动态时间状态。
 */

import { useMemo, useState } from "react"

import type { BranchPalace } from "../../../ai/ziwei-core/schema"

import {
  clampSolarDay,
  findSolarByBaziLunarDate,
  getBaziLunarInfoBySolar,
} from "../../../ai/bazi-core/bazi-runtime/bazi-lunar-date-utils"

import type { BaziRuntimeTimeSelection } from "../components/bazi-runtime-panel/bazi-runtime-panel-types"
import type { ZiweiDynamicTimeSelection } from "../components/ZiweiDynamicTimeTable"

import type { PersonalityTestRuntimeTime } from "./personality-test-runtime-time-types"

const BRANCH_TO_REPRESENTATIVE_HOUR: Record<BranchPalace, number> = {
  zi: 0,
  chou: 2,
  yin: 4,
  mao: 6,
  chen: 8,
  si: 10,
  wu: 12,
  wei: 14,
  shen: 16,
  you: 18,
  xu: 20,
  hai: 22,
}

function getTimeBranchFromHour(hour: number | null): BranchPalace {
  if (hour === null) {
    return "zi"
  }

  if (hour === 23 || hour === 0) {
    return "zi"
  }

  if (hour >= 1 && hour <= 2) {
    return "chou"
  }

  if (hour >= 3 && hour <= 4) {
    return "yin"
  }

  if (hour >= 5 && hour <= 6) {
    return "mao"
  }

  if (hour >= 7 && hour <= 8) {
    return "chen"
  }

  if (hour >= 9 && hour <= 10) {
    return "si"
  }

  if (hour >= 11 && hour <= 12) {
    return "wu"
  }

  if (hour >= 13 && hour <= 14) {
    return "wei"
  }

  if (hour >= 15 && hour <= 16) {
    return "shen"
  }

  if (hour >= 17 && hour <= 18) {
    return "you"
  }

  if (hour >= 19 && hour <= 20) {
    return "xu"
  }

  return "hai"
}

function resolveAge(params: {
  birthYear: number
  currentYear: number
}): number {
  return Math.max(1, params.currentYear - params.birthYear + 1)
}

function buildBirthKey(params: {
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
  lunarMonth: number
  lunarDay: number
}): string {
  return [
    params.birthYear,
    params.birthMonth,
    params.birthDay,
    params.birthHour ?? "unknown",
    params.lunarMonth,
    params.lunarDay,
  ].join("-")
}

function buildInitialRuntimeTime(params: {
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
  lunarMonth: number
  lunarDay: number
}): PersonalityTestRuntimeTime {
  return {
    currentYear: params.birthYear,
    currentMonth: params.birthMonth,
    currentDay: params.birthDay,
    currentHour: params.birthHour,

    currentAge: 1,

    currentLunarMonth: params.lunarMonth,
    currentLunarDay: params.lunarDay,
    currentTimeBranch: getTimeBranchFromHour(params.birthHour),
  }
}

function resolveSolarDateFromZiweiSelection(params: {
  birthYear: number
  selection: ZiweiDynamicTimeSelection
  fallback: PersonalityTestRuntimeTime
}): {
  currentYear: number
  currentMonth: number
  currentDay: number
} {
  const targetLunarYear = params.birthYear + params.selection.currentAge - 1

  const mapped = findSolarByBaziLunarDate({
    lunarYear: targetLunarYear,
    lunarMonth: params.selection.currentLunarMonth,
    lunarDay: params.selection.currentLunarDay,
    includeLeapMonth: true,
  })

  if (mapped) {
    return {
      currentYear: mapped.solarYear,
      currentMonth: mapped.solarMonth,
      currentDay: mapped.solarDay,
    }
  }

  return {
    currentYear: params.selection.currentYear,
    currentMonth: params.fallback.currentMonth,
    currentDay: clampSolarDay({
      year: params.selection.currentYear,
      month: params.fallback.currentMonth,
      day: params.fallback.currentDay,
    }),
  }
}

export function usePersonalityTestRuntimeTime({
  birthYear,
  birthMonth,
  birthDay,
  birthHour,
  lunarMonth,
  lunarDay,
}: {
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
  lunarMonth: number
  lunarDay: number
}) {
  const birthKey = useMemo(() => {
    return buildBirthKey({
      birthYear,
      birthMonth,
      birthDay,
      birthHour,
      lunarMonth,
      lunarDay,
    })
  }, [
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    lunarMonth,
    lunarDay,
  ])

  const initialRuntimeTime = useMemo(() => {
    return buildInitialRuntimeTime({
      birthYear,
      birthMonth,
      birthDay,
      birthHour,
      lunarMonth,
      lunarDay,
    })
  }, [
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    lunarMonth,
    lunarDay,
  ])

  const [runtimeState, setRuntimeState] = useState<{
    birthKey: string
    runtimeTime: PersonalityTestRuntimeTime
  }>(() => {
    return {
      birthKey,
      runtimeTime: initialRuntimeTime,
    }
  })

  const runtimeTime =
    runtimeState.birthKey === birthKey
      ? runtimeState.runtimeTime
      : initialRuntimeTime

  function setRuntimeTime(nextRuntimeTime: PersonalityTestRuntimeTime) {
    setRuntimeState({
      birthKey,
      runtimeTime: nextRuntimeTime,
    })
  }

  function setFromZiweiSelection(selection: ZiweiDynamicTimeSelection) {
    const representativeHour =
      BRANCH_TO_REPRESENTATIVE_HOUR[selection.currentTimeBranch]

    const solarDate = resolveSolarDateFromZiweiSelection({
      birthYear,
      selection,
      fallback: runtimeTime,
    })

    setRuntimeTime({
      ...runtimeTime,

      currentYear: solarDate.currentYear,
      currentMonth: solarDate.currentMonth,
      currentDay: solarDate.currentDay,
      currentHour: representativeHour,

      currentAge: selection.currentAge,

      currentLunarMonth: selection.currentLunarMonth,
      currentLunarDay: selection.currentLunarDay,
      currentTimeBranch: selection.currentTimeBranch,
    })
  }

  function setFromBaziSelection(selection: BaziRuntimeTimeSelection) {
    const nextHour = selection.currentHour ?? runtimeTime.currentHour

    const safeDay = clampSolarDay({
      year: selection.currentYear,
      month: selection.currentMonth,
      day: selection.currentDay,
    })

    const lunarInfo = getBaziLunarInfoBySolar({
      year: selection.currentYear,
      month: selection.currentMonth,
      day: safeDay,
    })

    setRuntimeTime({
      ...runtimeTime,

      currentYear: selection.currentYear,
      currentMonth: selection.currentMonth,
      currentDay: safeDay,
      currentHour: nextHour,

      currentAge: resolveAge({
        birthYear,
        currentYear: selection.currentYear,
      }),

      currentLunarMonth: lunarInfo.lunarMonth,
      currentLunarDay: lunarInfo.lunarDay,
      currentTimeBranch: getTimeBranchFromHour(nextHour),
    })
  }

  return {
    runtimeTime,
    setRuntimeTime,
    setFromZiweiSelection,
    setFromBaziSelection,
  }
}