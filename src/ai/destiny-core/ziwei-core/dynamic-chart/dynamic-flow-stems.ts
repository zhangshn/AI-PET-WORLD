import type { HeavenlyStem, TimeBranch } from "../contracts"
import { getYearStem } from "../birth/ganzhi-resolver"
import { getStemByIndex, getStemIndex } from "../shared"
import { findSolarByBaziLunarDate } from "../../bazi-core/bazi-runtime/bazi-lunar-date-utils"

const TIME_BRANCH_INDEX: Record<TimeBranch, number> = {
  zi: 0,
  chou: 1,
  yin: 2,
  mao: 3,
  chen: 4,
  si: 5,
  wu: 6,
  wei: 7,
  shen: 8,
  you: 9,
  xu: 10,
  hai: 11
}

export function getLiuNianStem(currentYear: number): HeavenlyStem {
  return getYearStem(currentYear)
}

export function getLiuYueStem(params: {
  currentYear: number
  currentLunarMonth: number
}): HeavenlyStem {
  const yearStem = getLiuNianStem(params.currentYear)
  const yinMonthStartStem = getYinMonthStartStem(yearStem)
  const monthOffset = normalizeLunarMonth(params.currentLunarMonth) - 1

  return getStemByIndex(getStemIndex(yinMonthStartStem) + monthOffset)
}

export function getLiuRiStem(params: {
  currentYear: number
  currentLunarMonth: number
  currentLunarDay: number
}): HeavenlyStem {
  const solarDate = resolveSolarDateByCurrentLunarDate(params)

  return getDayStemBySolarDate(solarDate)
}

export function getLiuShiStem(params: {
  currentYear: number
  currentLunarMonth: number
  currentLunarDay: number
  currentTimeBranch: TimeBranch
}): HeavenlyStem {
  const dayStem = getLiuRiStem(params)
  const ziHourStartStem = getZiHourStartStem(dayStem)
  const timeOffset = TIME_BRANCH_INDEX[params.currentTimeBranch]

  return getStemByIndex(getStemIndex(ziHourStartStem) + timeOffset)
}

function getYinMonthStartStem(yearStem: HeavenlyStem): HeavenlyStem {
  if (yearStem === "jia" || yearStem === "ji") return "bing"
  if (yearStem === "yi" || yearStem === "geng") return "wu"
  if (yearStem === "bing" || yearStem === "xin") return "geng"
  if (yearStem === "ding" || yearStem === "ren") return "ren"
  return "jia"
}

function getZiHourStartStem(dayStem: HeavenlyStem): HeavenlyStem {
  if (dayStem === "jia" || dayStem === "ji") return "jia"
  if (dayStem === "yi" || dayStem === "geng") return "bing"
  if (dayStem === "bing" || dayStem === "xin") return "wu"
  if (dayStem === "ding" || dayStem === "ren") return "geng"
  return "ren"
}

function resolveSolarDateByCurrentLunarDate(params: {
  currentYear: number
  currentLunarMonth: number
  currentLunarDay: number
}): {
  year: number
  month: number
  day: number
} {
  const candidates = [
    params.currentYear,
    params.currentYear - 1,
    params.currentYear + 1
  ].flatMap((lunarYear) => {
    const match = findSolarByBaziLunarDate({
      lunarYear,
      lunarMonth: normalizeLunarMonth(params.currentLunarMonth),
      lunarDay: normalizeLunarDay(params.currentLunarDay),
      includeLeapMonth: false
    })

    return match ? [match] : []
  })
  const selected =
    candidates.find((item) => item.solarYear === params.currentYear) ??
    candidates[0]

  if (!selected) {
    throw new Error(
      `Missing solar date for dynamic lunar date: ${params.currentYear}-${params.currentLunarMonth}-${params.currentLunarDay}`
    )
  }

  return {
    year: selected.solarYear,
    month: selected.solarMonth,
    day: selected.solarDay
  }
}

function getDayStemBySolarDate(input: {
  year: number
  month: number
  day: number
}): HeavenlyStem {
  const baseDate = Date.UTC(1900, 0, 31)
  const targetDate = Date.UTC(input.year, input.month - 1, input.day)
  const diffDays = Math.floor((targetDate - baseDate) / 86400000)

  return getStemByIndex(40 + diffDays)
}

function normalizeLunarMonth(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(Math.trunc(value), 12))
}

function normalizeLunarDay(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(Math.trunc(value), 30))
}
