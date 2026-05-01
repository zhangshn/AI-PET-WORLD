/**
 * 当前文件负责：构建八字动态时间表数据（大运/流年/流月/流日/流时）。
 */

import type {
  BaziDaYunResult,
  BaziHourTimeOption,
  BaziLiuNianTimeOption,
  BaziRuntimeTimeSelection,
  BaziRuntimeTimeTable,
  BaziSimpleTimeOption,
} from "./bazi-runtime-schema"

const BAZI_MONTH_LABELS = [
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

const BAZI_DAY_LABELS = [
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

const BAZI_HOUR_OPTIONS: ReadonlyArray<Omit<BaziHourTimeOption, "level" | "subtitle">> = [
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
]

function resolveActiveDaYunIndex(params: {
  currentYear: number
  daYun: BaziDaYunResult
}): number | null {
  const found = params.daYun.daYunList.find((item) => {
    return (
      params.currentYear >= item.startYear &&
      params.currentYear <= item.endYear
    )
  })

  return found ? found.index : null
}

function buildLiuNianOptions(params: {
  birthYear: number
  activeDaYun: BaziDaYunResult["currentDaYun"] | null
}): BaziLiuNianTimeOption[] {
  if (!params.activeDaYun) {
    return Array.from({ length: 12 }, (_, index) => {
      const year = params.birthYear + index
      const age = year - params.birthYear + 1

      return {
        level: "liuNian",
        year,
        age,
        title: String(year),
        subtitle: `${age}岁`,
      }
    })
  }

  const startYear = params.activeDaYun.startYear
  const endYear = params.activeDaYun.endYear

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const year = startYear + index
    const age = year - params.birthYear + 1

    return {
      level: "liuNian",
      year,
      age,
      title: String(year),
      subtitle: `${age}岁`,
    }
  })
}

function buildLiuYueOptions(): BaziSimpleTimeOption[] {
  return BAZI_MONTH_LABELS.map((label, index) => {
    return {
      level: "liuYue",
      value: index + 1,
      title: label,
    }
  })
}

function buildLiuRiOptions(): BaziSimpleTimeOption[] {
  return BAZI_DAY_LABELS.map((label, index) => {
    return {
      level: "liuRi",
      value: index + 1,
      title: label,
    }
  })
}

function buildLiuShiOptions(): BaziHourTimeOption[] {
  return BAZI_HOUR_OPTIONS.map((option) => {
    return {
      level: "liuShi",
      hour: option.hour,
      branch: option.branch,
      title: option.title,
      subtitle: `${option.hour}`,
    }
  })
}

function buildSelectedSummary(selection: BaziRuntimeTimeSelection): string {
  const hourLabel =
    selection.currentHour === null
      ? "时辰未知"
      : `小时 ${selection.currentHour}`

  return `当前选择：年份 ${selection.currentYear}；月份 ${selection.currentMonth}；日期 ${selection.currentDay}；${hourLabel}`
}

export function buildBaziRuntimeTimeTable(input: {
  birthYear: number
  daYun: BaziDaYunResult
  selection: BaziRuntimeTimeSelection
}): BaziRuntimeTimeTable {
  const activeDaYunIndex = resolveActiveDaYunIndex({
    currentYear: input.selection.currentYear,
    daYun: input.daYun,
  })

  const activeDaYun =
    activeDaYunIndex === null
      ? null
      : input.daYun.daYunList[activeDaYunIndex] ?? null

  const daYunOptions = input.daYun.daYunList.map((item) => {
    const inRange =
      input.selection.currentYear >= item.startYear &&
      input.selection.currentYear <= item.endYear

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
      active: inRange,
    }
  })

  return {
    daYunOptions,
    liuNianOptions: buildLiuNianOptions({
      birthYear: input.birthYear,
      activeDaYun,
    }),
    liuYueOptions: buildLiuYueOptions(),
    liuRiOptions: buildLiuRiOptions(),
    liuShiOptions: buildLiuShiOptions(),
    selectedSummary: buildSelectedSummary(input.selection),
    activeDaYunIndex,
  }
}
