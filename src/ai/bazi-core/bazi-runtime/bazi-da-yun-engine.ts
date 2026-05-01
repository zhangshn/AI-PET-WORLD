/**
 * 当前文件负责：计算八字大运方向、起运岁数、大运列表与当前大运。
 */

import type {
  BaziChart,
  YinYang
} from "../bazi-schema"

import type {
  BaziDaYunDirection,
  BaziDaYunItem,
  BaziDaYunResult,
  BaziRuntimeGender
} from "./bazi-runtime-schema"

import { BAZI_MONTH_BOUNDARIES } from "../bazi-data/bazi-solar-terms-data"
import { movePillarByStep, getCurrentAge } from "./bazi-runtime-utils"

function getDaYunDirection(params: {
  gender: BaziRuntimeGender
  yearStemYinYang: YinYang
}): BaziDaYunDirection {
  if (params.gender === "unknown") {
    return "forward"
  }

  const isYangYear = params.yearStemYinYang === "yang"

  if (params.gender === "male") {
    return isYangYear ? "forward" : "backward"
  }

  return isYangYear ? "backward" : "forward"
}

function toUtcDate(params: {
  year: number
  month: number
  day: number
}): Date {
  return new Date(Date.UTC(params.year, params.month - 1, params.day))
}

function getBoundaryDatesAroundBirth(params: {
  year: number
}): Date[] {
  const dates: Date[] = []

  for (const year of [params.year - 1, params.year, params.year + 1]) {
    BAZI_MONTH_BOUNDARIES.forEach((boundary) => {
      dates.push(
        toUtcDate({
          year,
          month: boundary.month,
          day: boundary.day,
        })
      )
    })
  }

  return dates.sort((a, b) => {
    return a.getTime() - b.getTime()
  })
}

function getDaysBetween(a: Date, b: Date): number {
  return Math.abs(
    Math.round((a.getTime() - b.getTime()) / 86400000)
  )
}

/**
 * 工程版起运岁数：
 * 顺行取出生后最近节气，逆行取出生前最近节气。
 * 三天折一年，最小 1 岁，最大 10 岁。
 */
function calculateStartAge(params: {
  birthYear: number
  birthMonth: number
  birthDay: number
  direction: BaziDaYunDirection
}): number {
  const birthDate = toUtcDate({
    year: params.birthYear,
    month: params.birthMonth,
    day: params.birthDay,
  })

  const boundaries = getBoundaryDatesAroundBirth({
    year: params.birthYear,
  })

  const targetBoundary =
    params.direction === "forward"
      ? boundaries.find((date) => date.getTime() > birthDate.getTime())
      : [...boundaries].reverse().find((date) => date.getTime() < birthDate.getTime())

  if (!targetBoundary) {
    return 3
  }

  const days = getDaysBetween(targetBoundary, birthDate)
  const age = Math.round(days / 3)

  return Math.max(1, Math.min(10, age))
}

function buildDaYunList(params: {
  chart: BaziChart
  direction: BaziDaYunDirection
  startAge: number
  currentAge: number
}): BaziDaYunItem[] {
  const directionStep = params.direction === "forward" ? 1 : -1
  const birthYear = params.chart.input.year

  return Array.from({ length: 10 }, (_, index) => {
    const startAge = params.startAge + index * 10
    const endAge = startAge + 9
    const startYear = birthYear + startAge - 1
    const endYear = startYear + 9

    const pillar = movePillarByStep({
      basePillar: params.chart.monthPillar,
      step: directionStep * (index + 1),
    })

    return {
      index,
      startAge,
      endAge,
      startYear,
      endYear,
      pillar,
      active:
        params.currentAge >= startAge &&
        params.currentAge <= endAge,
    }
  })
}

export function buildBaziDaYunResult(params: {
  chart: BaziChart
  gender: BaziRuntimeGender
  currentYear: number
}): BaziDaYunResult {
  const currentAge = getCurrentAge({
    birthYear: params.chart.input.year,
    currentYear: params.currentYear,
  })

  const direction = getDaYunDirection({
    gender: params.gender,
    yearStemYinYang: params.chart.yearPillar.yinYang,
  })

  const startAge = calculateStartAge({
    birthYear: params.chart.input.year,
    birthMonth: params.chart.input.month,
    birthDay: params.chart.input.day,
    direction,
  })

  const daYunList = buildDaYunList({
    chart: params.chart,
    direction,
    startAge,
    currentAge,
  })

  const currentDaYun = daYunList.find((item) => item.active) ?? null

  return {
    direction,
    startAge,
    isStarted: currentAge >= startAge,
    currentAge,
    currentDaYun,
    daYunList,
  }
}