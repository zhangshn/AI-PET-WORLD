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

const BAZI_LUNAR_MONTH_LABELS = [
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

const BAZI_LUNAR_DAY_LABELS = [
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十",
  "三十一",
] as const

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

function getLunarMonthLabel(month: number): string {
  return BAZI_LUNAR_MONTH_LABELS[month - 1] ?? `${month}月`
}

function getLunarDayLabel(day: number): string {
  return BAZI_LUNAR_DAY_LABELS[day - 1] ?? `${day}日`
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
    const chart = buildRuntimeChart({
      year: selection.currentYear,
      month: value,
      day: selection.currentDay,
      hour: selection.currentHour,
    })

    return {
      level: "liuYue",
      value,
      title: getLunarMonthLabel(value),
      subtitle: `${chart.monthPillar.label} · 公历${value}月 · 节气月令`,
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
      title: getLunarDayLabel(value),
      subtitle: `${chart.dayPillar.label} · 公历${selection.currentMonth}月${value}日`,
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
      title: option.title,
      subtitle: `${chart.hourPillar?.label ?? "未知"} · ${option.hour}:00`,
      pillarLabel: chart.hourPillar?.label ?? "未知",
      active: selection.currentHour === option.hour,
    }
  })
}

function buildSelectedSummary(selection: BaziRuntimeTimeSelection): string {
  const chart = buildRuntimeChart({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: selection.currentDay,
    hour: selection.currentHour,
  })

  return [
    `当前选择：年份 ${selection.currentYear}`,
    `月份 ${getLunarMonthLabel(selection.currentMonth)}（公历${selection.currentMonth}月）`,
    `日期 ${getLunarDayLabel(selection.currentDay)}（公历${selection.currentMonth}月${selection.currentDay}日）`,
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