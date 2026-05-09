/**
 * 当前文件负责：构建八字动态时间表数据（大运、流年、流月、流日、流时）。
 */

import { calculateBaziChart } from "../bazi-calculator"

import {
  clampSolarDay,
  findSolarByBaziLunarDate,
  getBaziLunarInfoBySolar,
  getBaziLunarMonthDays,
  getBaziLunarMonthStart,
} from "./bazi-lunar-date-utils"

import type { BaziLunarDateInfo } from "./bazi-lunar-date-utils"
import type {
  BaziDaYunItem,
  BaziDaYunResult,
  BaziHourTimeOption,
  BaziLiuNianTimeOption,
  BaziRuntimeTimeSelection,
  BaziRuntimeTimeTable,
  BaziSimpleTimeOption,
} from "./bazi-runtime-schema"

const BAZI_HOUR_OPTIONS = [
  { title: "子时", branch: "子", hour: 0 },
  { title: "丑时", branch: "丑", hour: 2 },
  { title: "寅时", branch: "寅", hour: 4 },
  { title: "卯时", branch: "卯", hour: 6 },
  { title: "辰时", branch: "辰", hour: 8 },
  { title: "巳时", branch: "巳", hour: 10 },
  { title: "午时", branch: "午", hour: 12 },
  { title: "未时", branch: "未", hour: 14 },
  { title: "申时", branch: "申", hour: 16 },
  { title: "酉时", branch: "酉", hour: 18 },
  { title: "戌时", branch: "戌", hour: 20 },
  { title: "亥时", branch: "亥", hour: 22 },
] as const

const LUNAR_MONTH_LABELS = [
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月",
] as const

function findActiveDaYun(params: {
  currentYear: number
  daYun: BaziDaYunResult
}): BaziDaYunItem | null {
  return params.daYun.daYunList.find((item) => {
    return (
      params.currentYear >= item.startYear &&
      params.currentYear <= item.endYear
    )
  }) ?? null
}

function buildRuntimeChart(params: {
  year: number
  month: number
  day: number
  hour?: number | null
}) {
  return calculateBaziChart({
    year: params.year,
    month: params.month,
    day: clampSolarDay({
      year: params.year,
      month: params.month,
      day: params.day,
    }),
    hour: params.hour ?? null,
  })
}

function buildDaYunOptions(params: {
  daYun: BaziDaYunResult
  selection: BaziRuntimeTimeSelection
}) {
  return params.daYun.daYunList.map((item) => {
    const active =
      params.selection.currentYear >= item.startYear &&
      params.selection.currentYear <= item.endYear

    return {
      level: "daYun" as const,
      index: item.index,
      title: `${item.startAge}-${item.endAge}`,
      subtitle: `${item.startYear}-${item.endYear}`,
      startAge: item.startAge,
      endAge: item.endAge,
      startYear: item.startYear,
      endYear: item.endYear,
      pillarLabel: item.pillar.label,
      active,
    }
  })
}

function buildLiuNianOptions(params: {
  birthYear: number
  activeDaYun: BaziDaYunItem | null
  selection: BaziRuntimeTimeSelection
  currentLunar: BaziLunarDateInfo
}): BaziLiuNianTimeOption[] {
  const startYear = params.activeDaYun?.startYear ?? params.birthYear
  const endYear = params.activeDaYun
    ? params.activeDaYun.endYear
    : params.birthYear + 11

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const year = startYear + index
    const age = year - params.birthYear + 1

    const mapped =
      findSolarByBaziLunarDate({
        lunarYear: year,
        lunarMonth: params.currentLunar.lunarMonth,
        lunarDay: params.currentLunar.lunarDay,
        includeLeapMonth: params.currentLunar.isLeapMonth,
      }) ??
      getBaziLunarMonthStart({
        lunarYear: year,
        lunarMonth: 1,
      })

    const targetYear = mapped?.solarYear ?? year
    const targetMonth = mapped?.solarMonth ?? 1
    const targetDay = mapped?.solarDay ?? 1

    const chart = buildRuntimeChart({
      year: targetYear,
      month: targetMonth,
      day: targetDay,
      hour: params.selection.currentHour,
    })

    return {
      level: "liuNian",
      year,
      age,
      title: String(year),
      subtitle: `${chart.yearPillar.label} · ${age}岁 · 农历${params.currentLunar.monthLabel}${params.currentLunar.dayLabel}`,
      pillarLabel: chart.yearPillar.label,
      active: params.currentLunar.lunarYear === year,
      targetYear,
      targetMonth,
      targetDay,
    }
  })
}

function buildLiuYueOptions(params: {
  selection: BaziRuntimeTimeSelection
  currentLunar: BaziLunarDateInfo
}): BaziSimpleTimeOption[] {
  const activeLunarYear = params.currentLunar.lunarYear

  return Array.from({ length: 12 }, (_, index) => {
    const lunarMonth = index + 1

    const mapped = getBaziLunarMonthStart({
      lunarYear: activeLunarYear,
      lunarMonth,
    })
    const fallbackStart = mapped
      ? null
      : findSolarByBaziLunarDate({
        lunarYear: activeLunarYear,
        lunarMonth,
        lunarDay: 1,
        includeLeapMonth: true,
      })

    const targetYear =
      mapped?.solarYear ?? fallbackStart?.solarYear ?? params.selection.currentYear
    const targetMonth =
      mapped?.solarMonth ?? fallbackStart?.solarMonth ?? params.selection.currentMonth
    const targetDay =
      mapped?.solarDay ?? fallbackStart?.solarDay ?? 1

    const chart = buildRuntimeChart({
      year: targetYear,
      month: targetMonth,
      day: targetDay,
      hour: params.selection.currentHour,
    })

    const monthLabel =
      mapped?.lunar.monthLabel ??
      fallbackStart?.lunar.monthLabel ??
      LUNAR_MONTH_LABELS[lunarMonth - 1]

    return {
      level: "liuYue",
      value: lunarMonth,
      title: `${monthLabel} · ${chart.monthPillar.label}`,
      subtitle: `公历${targetYear}-${targetMonth}-${targetDay} · 节气月令`,
      pillarLabel: chart.monthPillar.label,
      active:
        params.currentLunar.lunarYear === activeLunarYear &&
        params.currentLunar.lunarMonth === lunarMonth &&
        !params.currentLunar.isLeapMonth,
      targetYear,
      targetMonth,
      targetDay,
    }
  })
}

function buildLiuRiOptions(params: {
  selection: BaziRuntimeTimeSelection
  currentLunar: BaziLunarDateInfo
}): BaziSimpleTimeOption[] {
  const monthDays = getBaziLunarMonthDays({
    lunarYear: params.currentLunar.lunarYear,
    lunarMonth: params.currentLunar.lunarMonth,
  })

  const sameLeapTypeDays = monthDays.filter((item) => {
    return item.lunar.isLeapMonth === params.currentLunar.isLeapMonth
  })

  const displayDays = sameLeapTypeDays.length > 0 ? sameLeapTypeDays : monthDays

  return displayDays.map((item) => {
    const chart = buildRuntimeChart({
      year: item.solarYear,
      month: item.solarMonth,
      day: item.solarDay,
      hour: params.selection.currentHour,
    })

    return {
      level: "liuRi" as const,
      value: item.lunar.lunarDay,
      title: `${item.lunar.monthLabel}${item.lunar.dayLabel} · ${chart.dayPillar.label}`,
      subtitle: `公历${item.solarYear}-${item.solarMonth}-${item.solarDay}`,
      pillarLabel: chart.dayPillar.label,
      active:
        params.selection.currentYear === item.solarYear &&
        params.selection.currentMonth === item.solarMonth &&
        params.selection.currentDay === item.solarDay,
      targetYear: item.solarYear,
      targetMonth: item.solarMonth,
      targetDay: item.solarDay,
    }
  })
}

function buildLiuShiOptions(
  selection: BaziRuntimeTimeSelection
): BaziHourTimeOption[] {
  return BAZI_HOUR_OPTIONS.map((option) => {
    const chart = buildRuntimeChart({
      year: selection.currentYear,
      month: selection.currentMonth,
      day: selection.currentDay,
      hour: option.hour,
    })

    return {
      level: "liuShi",
      hour: option.hour,
      branch: option.branch,
      title: `${option.title} · ${chart.hourPillar?.label ?? "未知"}`,
      subtitle: `${option.hour}:00`,
      pillarLabel: chart.hourPillar?.label ?? "未知",
      active: selection.currentHour === option.hour,
    }
  })
}

function buildSelectedSummary(params: {
  selection: BaziRuntimeTimeSelection
  currentLunar: BaziLunarDateInfo
}): string {
  const safeDay = clampSolarDay({
    year: params.selection.currentYear,
    month: params.selection.currentMonth,
    day: params.selection.currentDay,
  })

  const chart = buildRuntimeChart({
    year: params.selection.currentYear,
    month: params.selection.currentMonth,
    day: safeDay,
    hour: params.selection.currentHour,
  })

  const hourText =
    params.selection.currentHour === null
      ? "时辰未知"
      : `${params.selection.currentHour}:00（${chart.hourPillar?.label ?? "未知"}）`

  return [
    `当前选择：农历 ${params.currentLunar.lunarYear}年${params.currentLunar.fullLabel}`,
    `公历 ${params.selection.currentYear}-${params.selection.currentMonth}-${safeDay}`,
    `流年 ${chart.yearPillar.label}`,
    `流月 ${chart.monthPillar.label}`,
    `流日 ${chart.dayPillar.label}`,
    `流时 ${hourText}`,
    "流月以节气月令计算",
  ].join("；")
}

export function buildBaziRuntimeTimeTable(input: {
  birthYear: number
  daYun: BaziDaYunResult
  selection: BaziRuntimeTimeSelection
}): BaziRuntimeTimeTable {
  const safeDay = clampSolarDay({
    year: input.selection.currentYear,
    month: input.selection.currentMonth,
    day: input.selection.currentDay,
  })

  const currentLunar = getBaziLunarInfoBySolar({
    year: input.selection.currentYear,
    month: input.selection.currentMonth,
    day: safeDay,
  })

  const activeDaYun = findActiveDaYun({
    currentYear: input.selection.currentYear,
    daYun: input.daYun,
  })

  const daYunOptions = buildDaYunOptions({
    daYun: input.daYun,
    selection: input.selection,
  })

  return {
    daYunOptions,
    liuNianOptions: buildLiuNianOptions({
      birthYear: input.birthYear,
      activeDaYun,
      selection: input.selection,
      currentLunar,
    }),
    liuYueOptions: buildLiuYueOptions({
      selection: input.selection,
      currentLunar,
    }),
    liuRiOptions: buildLiuRiOptions({
      selection: input.selection,
      currentLunar,
    }),
    liuShiOptions: buildLiuShiOptions(input.selection),
    selectedSummary: buildSelectedSummary({
      selection: input.selection,
      currentLunar,
    }),
    activeDaYunIndex: activeDaYun?.index ?? null,
  }
}
