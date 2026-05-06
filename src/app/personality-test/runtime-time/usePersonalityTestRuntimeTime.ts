/**
 * 当前文件负责：维护 personality-test 页面统一动态时间状态。
 */

import { useMemo, useState } from "react"

import type { BranchPalace } from "../../../ai/ziwei-core/schema"

import type { BaziRuntimeTimeSelection } from "../components/bazi-runtime-panel/bazi-runtime-panel-types"
import type { ZiweiDynamicTimeSelection } from "../components/ZiweiDynamicTimeTable"

import type { PersonalityTestRuntimeTime } from "./personality-test-runtime-time-types"

const BRANCH_TO_REPRESENTATIVE_HOUR: Record<BranchPalace, number> = {
  zi: 23,
  chou: 1,
  yin: 3,
  mao: 5,
  chen: 7,
  si: 9,
  wu: 11,
  wei: 13,
  shen: 15,
  you: 17,
  xu: 19,
  hai: 21,
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

    setRuntimeTime({
      ...runtimeTime,
      currentYear: selection.currentYear,
      currentMonth: selection.currentLunarMonth,
      currentDay: selection.currentLunarDay,
      currentHour: representativeHour,

      currentAge: selection.currentAge,

      currentLunarMonth: selection.currentLunarMonth,
      currentLunarDay: selection.currentLunarDay,
      currentTimeBranch: selection.currentTimeBranch,
    })
  }

  function setFromBaziSelection(selection: BaziRuntimeTimeSelection) {
    const nextHour = selection.currentHour ?? runtimeTime.currentHour

    setRuntimeTime({
      ...runtimeTime,
      currentYear: selection.currentYear,
      currentMonth: selection.currentMonth,
      currentDay: selection.currentDay,
      currentHour: nextHour,

      currentAge: resolveAge({
        birthYear,
        currentYear: selection.currentYear,
      }),

      /**
       * 测试页当前先做同步调试：
       * 公历月日同步到紫微动态月日。
       * 后续如果接入完整农历转换，这里再替换成真实农历运行时间。
       */
      currentLunarMonth: selection.currentMonth,
      currentLunarDay: selection.currentDay,
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