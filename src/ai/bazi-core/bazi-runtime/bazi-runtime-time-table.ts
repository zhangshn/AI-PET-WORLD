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

const LUNAR_DAY_LABELS = [
  "",
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
] as const

const lunarSolarMapCache = new Map<number, LunarSolarMapItem[]>()
const lunarMapScopeCache = new Map<number, LunarSolarMapItem[]>()
let chineseCalendarFormatter: Intl.DateTimeFormat | null = null

function getChineseCalendarFormatter(): Intl.DateTimeFormat | null {
  if (chineseCalendarFormatter) {
    return chineseCalendarFormatter
  }

  try {
    chineseCalendarFormatter = new Intl.DateTimeFormat("zh-Hans-u-ca-chinese", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    return chineseCalendarFormatter
  } catch {
    return null
  }
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
  const formatter = getChineseCalendarFormatter()

  if (!formatter) {
    return []
  }

  try {
    return formatter.formatToParts(date)
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

  const relatedYearText =
    parts.find((part) => (part.type as string) === "relatedYear")?.value ?? ""

  const monthText =
    parts.find((part) => part.type === "month")?.value ?? "农历月待换算"

  const dayText = parts.find((part) => part.type === "day")?.value ?? ""

  const isLeapMonth = monthText.includes("闰")
  const normalizedMonthText = monthText.replace("闰", "")
  const monthNumberByLabel = LUNAR_MONTH_INDEX[normalizedMonthText]
  const monthNumberByDigits = Number(normalizedMonthText.replace(/\D/g, ""))
  const month = Number.isFinite(monthNumberByLabel)
    ? monthNumberByLabel
    : (monthNumberByDigits >= 1 && monthNumberByDigits <= 12
      ? monthNumberByDigits
      : params.month)

  const directDayNumber = LUNAR_DAY_INDEX[dayText]
  const dayNumberFromDigits = Number(dayText.replace(/\D/g, ""))
  const day = Number.isFinite(directDayNumber)
    ? directDayNumber
    : (dayNumberFromDigits >= 1 && dayNumberFromDigits <= 30
      ? dayNumberFromDigits
      : params.day)

  const relatedYearNumber = Number(relatedYearText)
  const relatedYear = Number.isFinite(relatedYearNumber)
    ? relatedYearNumber
    : params.year
  const monthLabel =
    (isLeapMonth ? "闰" : "") +
    (LUNAR_MONTH_LABELS[month - 1] ?? normalizedMonthText)
  const dayLabel = LUNAR_DAY_LABELS[day] ?? dayText ?? "农历日待换算"

  return {
    relatedYear,
    month,
    day,
    monthLabel,
    dayLabel,
    fullLabel: `${monthLabel}${dayLabel}`,
    isLeapMonth,
  }
}

function buildSolarToLunarMap(year: number): LunarSolarMapItem[] {
  const cached = lunarSolarMapCache.get(year)
  if (cached) {
    return cached
  }

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

  lunarSolarMapCache.set(year, items)
  return items
}

function getLunarMapScope(year: number): LunarSolarMapItem[] {
  const cached = lunarMapScopeCache.get(year)
  if (cached) {
    return cached
  }

  const scoped = [
    ...buildSolarToLunarMap(year - 1),
    ...buildSolarToLunarMap(year),
    ...buildSolarToLunarMap(year + 1),
  ]

  lunarMapScopeCache.set(year, scoped)
  return scoped
}

function findSolarByLunar(params: {
  year: number
  lunarMonth: number
  lunarDay: number
}): LunarSolarMapItem | null {
  const mapScope = getLunarMapScope(params.year)
  const matches = mapScope.filter((item) => {
    return (
      item.lunar.relatedYear === params.year &&
      item.lunar.month === params.lunarMonth &&
      item.lunar.day === params.lunarDay &&
      !item.lunar.isLeapMonth
    )
  })

  if (matches.length === 0) {
    return null
  }

  return matches.sort((a, b) => {
    const aDate = new Date(a.solarYear, a.solarMonth - 1, a.solarDay).getTime()
    const bDate = new Date(b.solarYear, b.solarMonth - 1, b.solarDay).getTime()
    return aDate - bDate
  })[0] ?? null
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
  const startYear = params.activeDaYun?.startYear ?? params.birthYear
  const endYear = params.activeDaYun
    ? params.activeDaYun.endYear
    : params.birthYear + 11

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
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
  const safeDay = clampSolarDay({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: selection.currentDay,
  })

  const currentLunar = parseLunarInfo({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: safeDay,
  })
  const runtimeLunarYear = currentLunar.relatedYear

  return LUNAR_MONTH_LABELS.map((defaultMonthLabel, index) => {
    const lunarMonth = index + 1

    const mapped = findSolarByLunar({
      year: runtimeLunarYear,
      lunarMonth,
      lunarDay: 1,
    })

    const targetYear = mapped?.solarYear ?? selection.currentYear
    const targetMonth = mapped?.solarMonth ?? selection.currentMonth
    const targetDay = mapped?.solarDay ?? 1

    const chart = buildRuntimeChart({
      year: targetYear,
      month: targetMonth,
      day: targetDay,
      hour: selection.currentHour,
    })

    const monthLabel = mapped?.lunar.monthLabel ?? defaultMonthLabel

    return {
      level: "liuYue",
      value: lunarMonth,
      title: `${monthLabel} · ${chart.monthPillar.label}`,
      subtitle: mapped
        ? `公历${targetYear}-${targetMonth}-${targetDay} · 节气月令`
        : "公历日期待换算 · 节气月令",
      pillarLabel: chart.monthPillar.label,
      active: !currentLunar.isLeapMonth && currentLunar.month === lunarMonth,
      targetYear,
      targetMonth,
      targetDay,
    }
  })
}

function buildLiuRiOptions(
  selection: BaziRuntimeTimeSelection
): BaziSimpleTimeOption[] {
  const safeDay = clampSolarDay({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: selection.currentDay,
  })

  const currentLunar = parseLunarInfo({
    year: selection.currentYear,
    month: selection.currentMonth,
    day: safeDay,
  })

  const dayOptions = Array.from({ length: 30 }, (_, index) => index + 1)

  return dayOptions.flatMap((lunarDay) => {
    const mapped = findSolarByLunar({
      year: currentLunar.relatedYear,
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
        value: lunarDay,
        title: `${mapped.lunar.monthLabel}${mapped.lunar.dayLabel} · ${chart.dayPillar.label}`,
        subtitle: `公历${mapped.solarYear}-${mapped.solarMonth}-${mapped.solarDay}`,
        pillarLabel: chart.dayPillar.label,
        active:
          selection.currentYear === mapped.solarYear &&
          selection.currentMonth === mapped.solarMonth &&
          selection.currentDay === mapped.solarDay,
        targetYear: mapped.solarYear,
        targetMonth: mapped.solarMonth,
        targetDay: mapped.solarDay,
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

  const hourText =
    selection.currentHour === null
      ? "时辰未知"
      : `${selection.currentHour}:00（${chart.hourPillar?.label ?? "未知"}）`

  return [
    `当前选择：农历 ${lunar.fullLabel}`,
    `公历 ${selection.currentYear}-${selection.currentMonth}-${safeDay}`,
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
