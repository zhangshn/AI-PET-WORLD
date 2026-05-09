/**
 * 当前文件负责：根据出生日期生成八字三柱/四柱原盘。
 */

import type {
  BaziChart,
  BaziInput,
  BaziMode,
  BaziPillar,
  HeavenlyStem
} from "./bazi-schema"

import {
  BAZI_EARTHLY_BRANCHES,
  BAZI_HEAVENLY_STEMS,
  buildBaziPillarByIndex,
  buildBaziPillarByStemBranch
} from "./bazi-data/bazi-ganzhi-data"

import {
  getBaziMonthBoundary,
  isBeforeLiChun
} from "./bazi-data/bazi-solar-terms-data"

import { safeModulo } from "./bazi-utils"

function normalizeInteger(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.trunc(value)
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function normalizeBaziInput(input: BaziInput): BaziInput {
  const year = normalizeInteger(input.year, 2000)
  const rawMonth = normalizeInteger(input.month, 1)
  const month = Math.max(1, Math.min(rawMonth, 12))

  const rawDay = normalizeInteger(input.day, 1)
  const maxDay = getDaysInMonth(year, month)
  const day = Math.max(1, Math.min(rawDay, maxDay))

  const hour =
    typeof input.hour === "number" && Number.isFinite(input.hour)
      ? Math.trunc(input.hour)
      : null

  return {
    ...input,
    year,
    month,
    day,
    hour,
  }
}

function hasValidHour(hour?: number | null): hour is number {
  return typeof hour === "number" && Number.isInteger(hour) && hour >= 0 && hour <= 23
}

function getBaziYear(input: {
  year: number
  month: number
  day: number
}): number {
  return isBeforeLiChun(input.month, input.day)
    ? input.year - 1
    : input.year
}

function getYearPillar(input: {
  year: number
  month: number
  day: number
}): BaziPillar {
  const baziYear = getBaziYear(input)

  return buildBaziPillarByIndex(baziYear - 1984)
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
  const startStemIndex = BAZI_HEAVENLY_STEMS.indexOf(startStem)

  return BAZI_HEAVENLY_STEMS[
    safeModulo(startStemIndex + input.monthIndexFromYin, 10)
  ]
}

function getMonthPillar(input: {
  yearStem: HeavenlyStem
  month: number
  day: number
}): BaziPillar {
  const boundary = getBaziMonthBoundary(input.month, input.day)
  const stem = getMonthStem({
    yearStem: input.yearStem,
    monthIndexFromYin: boundary.monthIndexFromYin,
  })

  return buildBaziPillarByStemBranch({
    stem,
    branch: boundary.branch,
  })
}

function getDayPillar(input: {
  year: number
  month: number
  day: number
}): BaziPillar {
  const baseDate = Date.UTC(1900, 0, 31)
  const targetDate = Date.UTC(input.year, input.month - 1, input.day)
  const diffDays = Math.floor((targetDate - baseDate) / 86400000)

  return buildBaziPillarByIndex(40 + diffDays)
}

function getHourBranchIndex(hour: number): number {
  if (hour === 23 || hour === 0) {
    return 0
  }

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
}): BaziPillar {
  const branchIndex = getHourBranchIndex(input.hour)
  const startStem = getZiHourStartStem(input.dayStem)
  const startStemIndex = BAZI_HEAVENLY_STEMS.indexOf(startStem)

  const stem = BAZI_HEAVENLY_STEMS[
    safeModulo(startStemIndex + branchIndex, 10)
  ]

  const branch = BAZI_EARTHLY_BRANCHES[branchIndex]

  return buildBaziPillarByStemBranch({
    stem,
    branch,
  })
}

export function calculateBaziChart(rawInput: BaziInput): BaziChart {
  const input = normalizeBaziInput(rawInput)

  const yearPillar = getYearPillar({
    year: input.year,
    month: input.month,
    day: input.day,
  })

  const monthPillar = getMonthPillar({
    yearStem: yearPillar.stem,
    month: input.month,
    day: input.day,
  })

  const dayPillar = getDayPillar({
    year: input.year,
    month: input.month,
    day: input.day,
  })

  const hour = hasValidHour(input.hour) ? input.hour : null

  const hourPillar =
    hour !== null
      ? getHourPillar({
          dayStem: dayPillar.stem,
          hour,
        })
      : null

  const mode: BaziMode = hourPillar ? "FOUR_PILLARS" : "THREE_PILLARS"

  return {
    input,
    mode,
    hasHour: hourPillar !== null,
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar,
    dayMaster: dayPillar.stem,
    pillars: [
      yearPillar,
      monthPillar,
      dayPillar,
      ...(hourPillar ? [hourPillar] : []),
    ],
  }
}