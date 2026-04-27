/**
 * 当前文件负责：根据出生日期生成八字 MVP 三柱/四柱。
 * 当前版本：年柱按立春切年，月柱按节气月令，日柱按甲子日循环基准。
 */

import type {
  BaziChart,
  BaziInput,
  EarthlyBranch,
  HeavenlyStem,
} from "./bazi-types"
import {
  HEAVENLY_STEMS,
  buildPillarByIndex,
  buildPillarByStemBranch,
  normalizeCycleIndex,
} from "./ganzhi"

function isValidHour(hour?: number | null): hour is number {
  return typeof hour === "number" && hour >= 0 && hour <= 23
}

function isBeforeLiChun(month: number, day: number): boolean {
  return month < 2 || (month === 2 && day < 4)
}

function getBaziYear(year: number, month: number, day: number): number {
  return isBeforeLiChun(month, day) ? year - 1 : year
}

function getYearPillarIndex(year: number, month: number, day: number): number {
  const baziYear = getBaziYear(year, month, day)
  return baziYear - 1984
}

type MonthBranchResult = {
  branch: EarthlyBranch
  monthIndexFromYin: number
}

function getMonthBranch(month: number, day: number): MonthBranchResult {
  if (month === 1 && day < 6) return { branch: "子", monthIndexFromYin: 10 }
  if (month === 1) return { branch: "丑", monthIndexFromYin: 11 }
  if (month === 2 && day < 4) return { branch: "丑", monthIndexFromYin: 11 }
  if (month === 2) return { branch: "寅", monthIndexFromYin: 0 }
  if (month === 3 && day < 6) return { branch: "寅", monthIndexFromYin: 0 }
  if (month === 3) return { branch: "卯", monthIndexFromYin: 1 }
  if (month === 4 && day < 5) return { branch: "卯", monthIndexFromYin: 1 }
  if (month === 4) return { branch: "辰", monthIndexFromYin: 2 }
  if (month === 5 && day < 6) return { branch: "辰", monthIndexFromYin: 2 }
  if (month === 5) return { branch: "巳", monthIndexFromYin: 3 }
  if (month === 6 && day < 6) return { branch: "巳", monthIndexFromYin: 3 }
  if (month === 6) return { branch: "午", monthIndexFromYin: 4 }
  if (month === 7 && day < 7) return { branch: "午", monthIndexFromYin: 4 }
  if (month === 7) return { branch: "未", monthIndexFromYin: 5 }
  if (month === 8 && day < 8) return { branch: "未", monthIndexFromYin: 5 }
  if (month === 8) return { branch: "申", monthIndexFromYin: 6 }
  if (month === 9 && day < 8) return { branch: "申", monthIndexFromYin: 6 }
  if (month === 9) return { branch: "酉", monthIndexFromYin: 7 }
  if (month === 10 && day < 8) return { branch: "酉", monthIndexFromYin: 7 }
  if (month === 10) return { branch: "戌", monthIndexFromYin: 8 }
  if (month === 11 && day < 7) return { branch: "戌", monthIndexFromYin: 8 }
  if (month === 11) return { branch: "亥", monthIndexFromYin: 9 }
  if (month === 12 && day < 7) return { branch: "亥", monthIndexFromYin: 9 }

  return { branch: "子", monthIndexFromYin: 10 }
}

function getYinMonthStartStem(yearStem: HeavenlyStem): HeavenlyStem {
  if (yearStem === "甲" || yearStem === "己") return "丙"
  if (yearStem === "乙" || yearStem === "庚") return "戊"
  if (yearStem === "丙" || yearStem === "辛") return "庚"
  if (yearStem === "丁" || yearStem === "壬") return "壬"
  return "甲"
}

function getMonthStem(input: {
  yearStem: HeavenlyStem
  monthIndexFromYin: number
}): HeavenlyStem {
  const startStem = getYinMonthStartStem(input.yearStem)
  const startIndex = HEAVENLY_STEMS.indexOf(startStem)
  return HEAVENLY_STEMS[
    normalizeCycleIndex(startIndex + input.monthIndexFromYin, 10)
  ]
}

function getMonthPillar(input: {
  yearStem: HeavenlyStem
  month: number
  day: number
}) {
  const monthBranch = getMonthBranch(input.month, input.day)
  const stem = getMonthStem({
    yearStem: input.yearStem,
    monthIndexFromYin: monthBranch.monthIndexFromYin,
  })

  return buildPillarByStemBranch({
    stem,
    branch: monthBranch.branch,
  })
}

function getDayPillarIndex(year: number, month: number, day: number): number {
  const baseDate = Date.UTC(1900, 0, 31)
  const targetDate = Date.UTC(year, month - 1, day)
  const diffDays = Math.floor((targetDate - baseDate) / 86400000)

  return 40 + diffDays
}

function getHourBranchIndex(hour: number): number {
  if (hour === 23 || hour === 0) return 0
  return Math.floor((hour + 1) / 2)
}

function getZiHourStartStem(dayStem: HeavenlyStem): HeavenlyStem {
  if (dayStem === "甲" || dayStem === "己") return "甲"
  if (dayStem === "乙" || dayStem === "庚") return "丙"
  if (dayStem === "丙" || dayStem === "辛") return "戊"
  if (dayStem === "丁" || dayStem === "壬") return "庚"
  return "壬"
}

function getHourPillar(input: {
  dayStem: HeavenlyStem
  hour: number
}) {
  const branchIndex = getHourBranchIndex(input.hour)
  const startStem = getZiHourStartStem(input.dayStem)
  const startStemIndex = HEAVENLY_STEMS.indexOf(startStem)

  const stem = HEAVENLY_STEMS[
    normalizeCycleIndex(startStemIndex + branchIndex, 10)
  ]

  const branchMap: EarthlyBranch[] = [
    "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
  ]

  return buildPillarByStemBranch({
    stem,
    branch: branchMap[branchIndex],
  })
}

export function calculateBaziChart(input: BaziInput): BaziChart {
  const yearPillar = buildPillarByIndex(
    getYearPillarIndex(input.year, input.month, input.day)
  )

  const monthPillar = getMonthPillar({
    yearStem: yearPillar.stem,
    month: input.month,
    day: input.day,
  })

  const dayPillar = buildPillarByIndex(
    getDayPillarIndex(input.year, input.month, input.day)
  )

  const hour = isValidHour(input.hour) ? input.hour : null

  return {
    input,
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar:
      hour !== null
        ? getHourPillar({
            dayStem: dayPillar.stem,
            hour,
          })
        : null,
    hasHour: hour !== null,
  }
}