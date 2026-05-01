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

type LunarDateInfo = {
  relatedYear: number
  month: number
  day: number
  monthLabel: string
  dayLabel: string
  fullLabel: string
  isLeapMonth: boolean
}

type LunarSolarMapItem = {
  lunar: LunarDateInfo
  solarYear: number
  solarMonth: number
  solarDay: number
}

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

const LUNAR_MONTH_INDEX: Record<string, number> = {
  正月: 1,
  二月: 2,
  三月: 3,
  四月: 4,
  五月: 5,
  六月: 6,
  七月: 7,
  八月: 8,
  九月: 9,
  十月: 10,
  冬月: 11,
  腊月: 12,
  十一月: 11,
  十二月: 12,
}

const LUNAR_DAY_INDEX: Record<string, number> = {
  初一: 1,
  初二: 2,
  初三: 3,
  初四: 4,
  初五: 5,
  初六: 6,
  初七: 7,
  初八: 8,
  初九: 9,
  初十: 10,
  十一: 11,
  十二: 12,
  十三: 13,
  十四: 14,
  十五: 15,
  十六: 16,
  十七: 17,
  十八: 18,
  十九: 19,
  二十: 20,
  廿一: 21,
  廿二: 22,
  廿三: 23,
  廿四: 24,
  廿五: 25,
  廿六: 26,
  廿七: 27,
  廿八: 28,
  廿九: 29,
  三十: 30,
}

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

function getChineseCalendarParts(params: {
  year: number
  month: number
  day: number
}): Intl.DateTimeFormatPart[] {
  const date = buildSafeLocalDate(params)

  try {
    return new Intl.DateTimeFormat("zh-Hans-u-ca-chinese", {
      month: "long",
      day: "numeric",
    }).formatToParts(date)
  } catch {
    return []
  }
}

function parseLunarInfo(params: {
  year: number
  month: number
  day: number
}): LunarDateInfo {
  const parts = getChineseCalendarParts(params)

  const monthText =
    parts.find((part) => part.type === "month")?.value ?? "农历月待换算"

  const dayText =
    parts.find((part) => part.type === "day")?.value ?? "农历日待换算"

  const isLeapMonth = monthText.includes("闰")
  const normalizedMonthText = monthText.replace("闰", "")

  return {
    relatedYear: params.year,
    month: LUNAR_MONTH_INDEX[normalizedMonthText] ?? params.month,
    day: LUNAR_DAY_INDEX[dayText] ?? params.day,
    monthLabel: isLeapMonth ? `闰${normalizedMonthText}` : normalizedMonthText,
    dayLabel: dayText,
    fullLabel: `${isLeapMonth ? `闰${normalizedMonthText}` : normalizedMonthText}${dayText}`,
    isLeapMonth,
  }
}

function buildSolarToLunarMap(year: number): LunarSolarMapItem[] {
  const items: LunarSolarMapItem[] = []

  for (let solarMonth = 1; solarMonth <= 12; solarMonth += 1) {
    const dayCount = getDaysInSolarMonth({
      year,
      month: solarMonth,
    })

    for (let solarDay = 1; solarDay <= dayCount; solarDay += 1) {
      items.push({
        lunar: parseLunarInfo({
          year,
          month: solarMonth,
          day: solarDay,
        }),
        solarYear: year,
        solarMonth,
        solarDay,
      })
    }
  }

  return items
}

function findSolarByLunar(params: {
  year: number
  lunarMonth: number
  lunarDay: number
}): LunarSolarMapItem | null {
  const yearMap = buildSolarToLunarMap(params.year)

  const foundInYear = yearMap.find((item) => {
    return (
      item.lunar.month === params.lunarMonth &&
      item.lunar.day === params.lunarDay &&
      !item.lunar.isLeapMonth
    )
  })

  if (foundInYear) {
    return foundInYear
  }

  const nextYearMap = buildSolarToLunarMap(params.year + 1)

  return nextYearMap.find((item) => {
    return (
      item.lunar.month === params.lunarMonth &&
      item.lunar.day === params.lunarDay &&
      !item.lunar.isLeapMonth
    )
  }) ?? null
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
    const lunarMonth = index + 1

    const mapped = findSolarByLunar({
      year: selection.currentYear,
      lunarMonth,
      lunarDay: 1,
    })

    const solarYear = mapped?.solarYear ?? selection.currentYear
    const solarMonth = mapped?.solarMonth ?? selection.currentMonth
    const solarDay = mapped?.solarDay ?? 1

    const chart = buildRuntimeChart({
      year: solarYear,
      month: solarMonth,
      day: solarDay,
      hour: selection.currentHour,
    })

    const title = mapped
      ? `${mapped.lunar.monthLabel} · ${chart.monthPillar.label}`
      : `农历${lunarMonth}月 · ${chart.monthPillar.label}`

    return {
      level: "liuYue",
      value: solarMonth,
      title,
      subtitle: mapped
        ? `公历${solarYear}-${solarMonth}-${solarDay} · 节气月令`
        : "公历日期待换算 · 节气月令",
      pillarLabel: chart.monthPillar.label,
      active: selection.currentMonth === solarMonth,
    }
  })
}

function buildLiuRiOptions(
  selection: BaziRuntimeTimeSelection
): BaziSimpleTimeOption[] {
  const currentLunar = parseLunarInfo({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: clampSolarDay({
      year: selection.currentYear,
      month: selection.currentMonth,
      day: selection.currentDay,
    }),
  })

  const dayOptions = Array.from({ length: 30 }, (_, index) => index + 1)

  return dayOptions.flatMap((lunarDay) => {
    const mapped = findSolarByLunar({
      year: selection.currentYear,
      lunarMonth: currentLunar.month,
      lunarDay,
    })

    if (!mapped) {
      return []
    }

    const chart = buildRuntimeChart({
      year: mapped.solarYear,
      month: mapped.solarMonth,
      day: mapped.solarDay,
      hour: selection.currentHour,
    })

    return [
      {
        level: "liuRi" as const,
        value: mapped.solarDay,
        title: `${mapped.lunar.monthLabel}${mapped.lunar.dayLabel} · ${chart.dayPillar.label}`,
        subtitle: `公历${mapped.solarYear}-${mapped.solarMonth}-${mapped.solarDay}`,
        pillarLabel: chart.dayPillar.label,
        active:
          selection.currentYear === mapped.solarYear &&
          selection.currentMonth === mapped.solarMonth &&
          selection.currentDay === mapped.solarDay,
      },
    ]
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

  const lunar = parseLunarInfo({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: safeDay,
  })

  const chart = buildRuntimeChart({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: safeDay,
    hour: selection.currentHour,
  })

  return [
    `当前选择：年份 ${selection.currentYear}`,
    `农历 ${lunar.fullLabel}`,
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