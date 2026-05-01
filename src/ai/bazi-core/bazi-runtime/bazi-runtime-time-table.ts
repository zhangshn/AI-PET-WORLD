/**
 * 当前文件负责：构建八字动态时间表数据（大运、流年、流月、流日、流时）。
 */

import { calculateBaziChart } from "../bazi-calculator"

import type {
  BaziDaYunItem,
  BaziDaYunResult,
  BaziHourTimeOption,
  BaziLiuNianTimeOption,
  BaziRuntimeTimeSelection,
  BaziRuntimeTimeTable,
  BaziSimpleTimeOption
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

function getDaysInSolarMonth(params: {
  year: number
  month: number
}): number {
  return new Date(Date.UTC(params.year, params.month, 0)).getUTCDate()
}

function clampSolarDay(params: {
  year: number
  month: number
  day: number
}): number {
  const maxDay = getDaysInSolarMonth({
    year: params.year,
    month: params.month,
  })

  return Math.max(1, Math.min(params.day, maxDay))
}

function buildSafeLocalDate(params: {
  year: number
  month: number
  day: number
}): Date {
  return new Date(params.year, params.month - 1, params.day, 12, 0, 0)
}

function formatChineseCalendar(params: {
  year: number
  month: number
  day: number
  monthOnly?: boolean
}): string {
  const date = buildSafeLocalDate(params)

  try {
    const formatter = new Intl.DateTimeFormat("zh-Hans-u-ca-chinese", {
      month: "long",
      day: params.monthOnly ? undefined : "numeric",
    })

    const text = formatter.format(date)

    if (text && text.trim().length > 0) {
      return text
    }
  } catch {
    return params.monthOnly ? "农历月待换算" : "农历日期待换算"
  }

  return params.monthOnly ? "农历月待换算" : "农历日期待换算"
}

function getLunarMonthTitle(params: {
  year: number
  month: number
  day: number
}): string {
  const safeDay = clampSolarDay(params)
  const lunarText = formatChineseCalendar({
    year: params.year,
    month: params.month,
    day: safeDay,
    monthOnly: true,
  })

  return lunarText.startsWith("农历") ? lunarText : `农历${lunarText}`
}

function getLunarDateTitle(params: {
  year: number
  month: number
  day: number
}): string {
  const safeDay = clampSolarDay(params)
  const lunarText = formatChineseCalendar({
    year: params.year,
    month: params.month,
    day: safeDay,
  })

  return lunarText.startsWith("农历") ? lunarText : `农历${lunarText}`
}

function getHourLabel(hour: number | null): string {
  if (hour === null) {
    return "时辰未知"
  }

  const found = BAZI_HOUR_OPTIONS.find((option) => {
    return option.hour === hour
  })

  return found ? `${found.title}（${found.hour}:00）` : `小时 ${hour}`
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
}): BaziLiuNianTimeOption[] {
  const startYear = params.activeDaYun
    ? params.activeDaYun.startYear
    : params.birthYear

  const length = params.activeDaYun ? 10 : 12

  return Array.from({ length }, (_, index) => {
    const year = startYear + index
    const age = year - params.birthYear + 1
    const chart = buildRuntimeChart({
      year,
      month: params.selection.currentMonth,
      day: params.selection.currentDay,
      hour: params.selection.currentHour,
    })

    return {
      level: "liuNian",
      year,
      age,
      title: String(year),
      subtitle: `${chart.yearPillar.label} · ${age}岁`,
      pillarLabel: chart.yearPillar.label,
      active: params.selection.currentYear === year,
    }
  })
}

function buildLiuYueOptions(
  selection: BaziRuntimeTimeSelection
): BaziSimpleTimeOption[] {
  return Array.from({ length: 12 }, (_, index) => {
    const value = index + 1
    const safeDay = clampSolarDay({
      year: selection.currentYear,
      month: value,
      day: selection.currentDay,
    })

    const chart = buildRuntimeChart({
      year: selection.currentYear,
      month: value,
      day: safeDay,
      hour: selection.currentHour,
    })

    return {
      level: "liuYue",
      value,
      title: `${getLunarMonthTitle({
        year: selection.currentYear,
        month: value,
        day: safeDay,
      })} · ${chart.monthPillar.label}`,
      subtitle: `公历${value}月 · 节气月令`,
      pillarLabel: chart.monthPillar.label,
      active: selection.currentMonth === value,
    }
  })
}

function buildLiuRiOptions(
  selection: BaziRuntimeTimeSelection
): BaziSimpleTimeOption[] {
  const dayCount = getDaysInSolarMonth({
    year: selection.currentYear,
    month: selection.currentMonth,
  })

  return Array.from({ length: dayCount }, (_, index) => {
    const value = index + 1
    const chart = buildRuntimeChart({
      year: selection.currentYear,
      month: selection.currentMonth,
      day: value,
      hour: selection.currentHour,
    })

    return {
      level: "liuRi",
      value,
      title: `${getLunarDateTitle({
        year: selection.currentYear,
        month: selection.currentMonth,
        day: value,
      })} · ${chart.dayPillar.label}`,
      subtitle: `公历${selection.currentMonth}月${value}日`,
      pillarLabel: chart.dayPillar.label,
      active: selection.currentDay === value,
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

function buildSelectedSummary(selection: BaziRuntimeTimeSelection): string {
  const safeDay = clampSolarDay({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: selection.currentDay,
  })

  const chart = buildRuntimeChart({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: safeDay,
    hour: selection.currentHour,
  })

  return [
    `当前选择：年份 ${selection.currentYear}`,
    `农历月 ${getLunarMonthTitle({
      year: selection.currentYear,
      month: selection.currentMonth,
      day: safeDay,
    })}`,
    `农历日 ${getLunarDateTitle({
      year: selection.currentYear,
      month: selection.currentMonth,
      day: safeDay,
    })}`,
    `公历 ${selection.currentYear}-${selection.currentMonth}-${safeDay}`,
    getHourLabel(selection.currentHour),
    `流年 ${chart.yearPillar.label}`,
    `流月 ${chart.monthPillar.label}`,
    `流日 ${chart.dayPillar.label}`,
    `流时 ${chart.hourPillar?.label ?? "未知"}`,
    "流月以节气月令计算",
  ].join("；")
}

export function buildBaziRuntimeTimeTable(input: {
  birthYear: number
  daYun: BaziDaYunResult
  selection: BaziRuntimeTimeSelection
}): BaziRuntimeTimeTable {
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
    }),
    liuYueOptions: buildLiuYueOptions(input.selection),
    liuRiOptions: buildLiuRiOptions(input.selection),
    liuShiOptions: buildLiuShiOptions(input.selection),
    selectedSummary: buildSelectedSummary(input.selection),
    activeDaYunIndex: activeDaYun?.index ?? null,
  }
}