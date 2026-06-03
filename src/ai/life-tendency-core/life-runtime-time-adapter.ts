/**
 * 褰撳墠鏂囦欢璐熻矗锛氭妸涓栫晫鏃堕棿杞崲涓虹敓鍛借秼鍚戞牳蹇冨彲璇诲彇鐨勮繍琛屾椂闂淬€? */

import type {
  BranchPalace
} from "../destiny-core/ziwei-core/ziwei-core-schema"

import {
  clampSolarDay,
  getBaziLunarInfoBySolar
} from "../destiny-core/bazi-core/bazi-runtime/bazi-lunar-date-utils"

import type {
  LifeTendencyRuntimeTime
} from "./life-tendency-runtime-gateway"

export interface LifeRuntimeWorldTimeInput {
  /**
   * 涓栫晫褰撳墠绗嚑澶┿€?   * 绾﹀畾锛欴ay 1 鏄笘鐣岃捣濮嬫棩鏈熷綋澶┿€?   */
  day: number

  /**
   * 涓栫晫褰撳墠灏忔椂銆?   */
  hour: number
}

export interface LifeRuntimeWorldStartDate {
  year: number
  month: number
  day: number
}

export interface BuildLifeRuntimeTimeFromWorldInput {
  /**
   * 涓栫晫褰撳墠鏃堕棿銆?   */
  worldTime: LifeRuntimeWorldTimeInput

  /**
   * 涓栫晫 Day 1 瀵瑰簲鐨勭湡瀹炲叕鍘嗘棩鏈熴€?   * 娴嬭瘯 / runtime 鍙互鍏堢敤瀹犵墿棰嗗吇瀹℃煡鏃ユ湡浣滀负涓栫晫璧峰鏃ユ湡銆?   */
  worldStartDate: LifeRuntimeWorldStartDate

  /**
   * 鐢熷懡浣撳嚭鐢熷叕鍘嗘棩鏈熴€?   * 鐢ㄤ簬璁＄畻褰撳墠骞撮緞銆?   */
  birthDate: LifeRuntimeWorldStartDate
}

function normalizeHour(hour: number): number {
  if (!Number.isFinite(hour)) {
    return 0
  }

  const normalized = Math.trunc(hour) % 24

  if (normalized < 0) {
    return normalized + 24
  }

  return normalized
}

function getTimeBranchFromHour(hour: number): BranchPalace {
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

function addDaysToSolarDate(input: {
  startDate: LifeRuntimeWorldStartDate
  dayOffset: number
}): LifeRuntimeWorldStartDate {
  const start = new Date(
    Date.UTC(
      input.startDate.year,
      input.startDate.month - 1,
      input.startDate.day,
      12,
      0,
      0
    )
  )

  start.setUTCDate(start.getUTCDate() + input.dayOffset)

  const year = start.getUTCFullYear()
  const month = start.getUTCMonth() + 1
  const day = clampSolarDay({
    year,
    month,
    day: start.getUTCDate(),
  })

  return {
    year,
    month,
    day,
  }
}

function resolveCurrentAge(input: {
  birthDate: LifeRuntimeWorldStartDate
  currentDate: LifeRuntimeWorldStartDate
}): number {
  const yearDiff = input.currentDate.year - input.birthDate.year

  const hasReachedBirthday =
    input.currentDate.month > input.birthDate.month ||
    (
      input.currentDate.month === input.birthDate.month &&
      input.currentDate.day >= input.birthDate.day
    )

  return Math.max(1, yearDiff + (hasReachedBirthday ? 1 : 0))
}

export function buildLifeRuntimeTimeFromWorld(
  input: BuildLifeRuntimeTimeFromWorldInput
): LifeTendencyRuntimeTime {
  const worldDay = Math.max(1, Math.trunc(input.worldTime.day))
  const hour = normalizeHour(input.worldTime.hour)

  const currentSolarDate = addDaysToSolarDate({
    startDate: input.worldStartDate,
    dayOffset: worldDay - 1,
  })

  const lunarInfo = getBaziLunarInfoBySolar({
    year: currentSolarDate.year,
    month: currentSolarDate.month,
    day: currentSolarDate.day,
  })

  return {
    currentYear: currentSolarDate.year,
    currentMonth: currentSolarDate.month,
    currentDay: currentSolarDate.day,
    currentHour: hour,

    currentAge: resolveCurrentAge({
      birthDate: input.birthDate,
      currentDate: currentSolarDate,
    }),

    currentLunarMonth: lunarInfo.lunarMonth,
    currentLunarDay: lunarInfo.lunarDay,
    currentTimeBranch: getTimeBranchFromHour(hour),
  }
}
