/**
 * 当前文件负责：提供八字动态层农历/公历映射与缓存工具。
 */

export type BaziLunarDateInfo = {
  lunarYear: number
  lunarMonth: number
  lunarDay: number
  monthLabel: string
  dayLabel: string
  fullLabel: string
  isLeapMonth: boolean
}

export type BaziLunarSolarMapItem = {
  lunar: BaziLunarDateInfo
  solarYear: number
  solarMonth: number
  solarDay: number
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

const lunarSolarMapCache = new Map<number, BaziLunarSolarMapItem[]>()
const lunarYearMapCache = new Map<number, BaziLunarSolarMapItem[]>()

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

export function getDaysInSolarMonth(input: {
  year: number
  month: number
}): number {
  return new Date(Date.UTC(input.year, input.month, 0)).getUTCDate()
}

export function clampSolarDay(input: {
  year: number
  month: number
  day: number
}): number {
  const maxDay = getDaysInSolarMonth({
    year: input.year,
    month: input.month,
  })

  return Math.max(1, Math.min(input.day, maxDay))
}

function buildSafeLocalDate(input: {
  year: number
  month: number
  day: number
}): Date {
  return new Date(input.year, input.month - 1, input.day, 12, 0, 0)
}

function getChineseCalendarParts(input: {
  year: number
  month: number
  day: number
}): Intl.DateTimeFormatPart[] {
  const formatter = getChineseCalendarFormatter()
  if (!formatter) {
    return []
  }

  try {
    return formatter.formatToParts(
      buildSafeLocalDate({
        year: input.year,
        month: input.month,
        day: input.day,
      })
    )
  } catch {
    return []
  }
}

function parseMonthInfo(input: {
  monthText: string
  fallbackMonth: number
}): {
  lunarMonth: number
  monthLabel: string
  isLeapMonth: boolean
} {
  const isLeapMonth = input.monthText.includes("闰")
  const normalizedMonthText = input.monthText.replace("闰", "")

  const monthByLabel = LUNAR_MONTH_INDEX[normalizedMonthText]
  const monthByDigits = Number(normalizedMonthText.replace(/\D/g, ""))

  const lunarMonth = Number.isFinite(monthByLabel)
    ? monthByLabel
    : (monthByDigits >= 1 && monthByDigits <= 12
      ? monthByDigits
      : input.fallbackMonth)

  const baseLabel =
    LUNAR_MONTH_LABELS[lunarMonth - 1] ??
    normalizedMonthText ??
    "农历月待换算"

  return {
    lunarMonth,
    monthLabel: isLeapMonth ? `闰${baseLabel}` : baseLabel,
    isLeapMonth,
  }
}

function parseDayInfo(input: {
  dayText: string
  fallbackDay: number
}): {
  lunarDay: number
  dayLabel: string
} {
  const dayByLabel = LUNAR_DAY_INDEX[input.dayText]
  const dayByDigits = Number(input.dayText.replace(/\D/g, ""))

  const lunarDay = Number.isFinite(dayByLabel)
    ? dayByLabel
    : (dayByDigits >= 1 && dayByDigits <= 30
      ? dayByDigits
      : input.fallbackDay)

  return {
    lunarDay,
    dayLabel:
      LUNAR_DAY_LABELS[lunarDay] ??
      input.dayText ??
      "农历日待换算",
  }
}

export function getBaziLunarInfoBySolar(input: {
  year: number
  month: number
  day: number
}): BaziLunarDateInfo {
  const safeDay = clampSolarDay({
    year: input.year,
    month: input.month,
    day: input.day,
  })

  const parts = getChineseCalendarParts({
    year: input.year,
    month: input.month,
    day: safeDay,
  })

  const relatedYearText =
    parts.find((part) => (part.type as string) === "relatedYear")?.value ?? ""
  const monthText =
    parts.find((part) => part.type === "month")?.value ?? "农历月待换算"
  const dayText = parts.find((part) => part.type === "day")?.value ?? ""

  const parsedYear = Number(relatedYearText.replace(/\D/g, ""))
  const lunarYear = Number.isFinite(parsedYear) ? parsedYear : input.year

  const monthInfo = parseMonthInfo({
    monthText,
    fallbackMonth: input.month,
  })

  const dayInfo = parseDayInfo({
    dayText,
    fallbackDay: safeDay,
  })

  return {
    lunarYear,
    lunarMonth: monthInfo.lunarMonth,
    lunarDay: dayInfo.lunarDay,
    monthLabel: monthInfo.monthLabel,
    dayLabel: dayInfo.dayLabel,
    fullLabel: `${monthInfo.monthLabel}${dayInfo.dayLabel}`,
    isLeapMonth: monthInfo.isLeapMonth,
  }
}

function getSolarToLunarMap(solarYear: number): BaziLunarSolarMapItem[] {
  const cached = lunarSolarMapCache.get(solarYear)
  if (cached) {
    return cached
  }

  const items: BaziLunarSolarMapItem[] = []

  for (let solarMonth = 1; solarMonth <= 12; solarMonth += 1) {
    const days = getDaysInSolarMonth({
      year: solarYear,
      month: solarMonth,
    })

    for (let solarDay = 1; solarDay <= days; solarDay += 1) {
      items.push({
        lunar: getBaziLunarInfoBySolar({
          year: solarYear,
          month: solarMonth,
          day: solarDay,
        }),
        solarYear,
        solarMonth,
        solarDay,
      })
    }
  }

  lunarSolarMapCache.set(solarYear, items)
  return items
}

function getLunarYearMap(lunarYear: number): BaziLunarSolarMapItem[] {
  const cached = lunarYearMapCache.get(lunarYear)
  if (cached) {
    return cached
  }

  const items = [
    ...getSolarToLunarMap(lunarYear - 1),
    ...getSolarToLunarMap(lunarYear),
    ...getSolarToLunarMap(lunarYear + 1),
  ]
    .filter((item) => item.lunar.lunarYear === lunarYear)
    .sort((a, b) => {
      const aTime = new Date(a.solarYear, a.solarMonth - 1, a.solarDay).getTime()
      const bTime = new Date(b.solarYear, b.solarMonth - 1, b.solarDay).getTime()
      return aTime - bTime
    })

  lunarYearMapCache.set(lunarYear, items)
  return items
}

export function findSolarByBaziLunarDate(input: {
  lunarYear: number
  lunarMonth: number
  lunarDay: number
  includeLeapMonth?: boolean
}): BaziLunarSolarMapItem | null {
  const includeLeapMonth = input.includeLeapMonth ?? false
  const yearMap = getLunarYearMap(input.lunarYear)

  const found = yearMap.find((item) => {
    if (!includeLeapMonth && item.lunar.isLeapMonth) {
      return false
    }

    return (
      item.lunar.lunarMonth === input.lunarMonth &&
      item.lunar.lunarDay === input.lunarDay
    )
  })

  return found ?? null
}

export function getBaziLunarMonthStart(input: {
  lunarYear: number
  lunarMonth: number
}): BaziLunarSolarMapItem | null {
  return findSolarByBaziLunarDate({
    lunarYear: input.lunarYear,
    lunarMonth: input.lunarMonth,
    lunarDay: 1,
  })
}

export function getBaziLunarMonthDays(input: {
  lunarYear: number
  lunarMonth: number
}): BaziLunarSolarMapItem[] {
  const yearMap = getLunarYearMap(input.lunarYear)

  const regularMonthDays = yearMap.filter((item) => {
    return item.lunar.lunarMonth === input.lunarMonth && !item.lunar.isLeapMonth
  })

  if (regularMonthDays.length > 0) {
    return regularMonthDays
  }

  return yearMap.filter((item) => {
    return item.lunar.lunarMonth === input.lunarMonth && item.lunar.isLeapMonth
  })
}
