/**
 * 当前文件负责：构建八字动态时间表数据（大运、流年、流月、流日、流时）。
 */

import type {
  BaziDaYunItem,
  BaziDaYunResult,
  BaziHourTimeOption,
  BaziLiuNianTimeOption,
  BaziRuntimeTimeSelection,
  BaziRuntimeTimeTable,
  BaziSimpleTimeOption
} from "./bazi-runtime-schema"

const BAZI_SOLAR_MONTH_OPTIONS = [
  { value: 1, title: "公历1月", subtitle: "流月按节气切换" },
  { value: 2, title: "公历2月", subtitle: "流月按节气切换" },
  { value: 3, title: "公历3月", subtitle: "流月按节气切换" },
  { value: 4, title: "公历4月", subtitle: "流月按节气切换" },
  { value: 5, title: "公历5月", subtitle: "流月按节气切换" },
  { value: 6, title: "公历6月", subtitle: "流月按节气切换" },
  { value: 7, title: "公历7月", subtitle: "流月按节气切换" },
  { value: 8, title: "公历8月", subtitle: "流月按节气切换" },
  { value: 9, title: "公历9月", subtitle: "流月按节气切换" },
  { value: 10, title: "公历10月", subtitle: "流月按节气切换" },
  { value: 11, title: "公历11月", subtitle: "流月按节气切换" },
  { value: 12, title: "公历12月", subtitle: "流月按节气切换" },
] as const

const BAZI_SOLAR_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const value = index + 1

  return {
    value,
    title: `${value}日`,
    subtitle: "公历日",
  }
})

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

    return {
      level: "liuNian",
      year,
      age,
      title: String(year),
      subtitle: `${age}岁`,
      active: params.selection.currentYear === year,
    }
  })
}

function buildLiuYueOptions(
  selection: BaziRuntimeTimeSelection
): BaziSimpleTimeOption[] {
  return BAZI_SOLAR_MONTH_OPTIONS.map((option) => {
    return {
      level: "liuYue",
      value: option.value,
      title: option.title,
      subtitle: option.subtitle,
      active: selection.currentMonth === option.value,
    }
  })
}

function buildLiuRiOptions(
  selection: BaziRuntimeTimeSelection
): BaziSimpleTimeOption[] {
  return BAZI_SOLAR_DAY_OPTIONS.map((option) => {
    return {
      level: "liuRi",
      value: option.value,
      title: option.title,
      subtitle: option.subtitle,
      active: selection.currentDay === option.value,
    }
  })
}

function buildLiuShiOptions(
  selection: BaziRuntimeTimeSelection
): BaziHourTimeOption[] {
  return BAZI_HOUR_OPTIONS.map((option) => {
    return {
      level: "liuShi",
      hour: option.hour,
      branch: option.branch,
      title: option.title,
      subtitle: `${option.hour}:00`,
      active: selection.currentHour === option.hour,
    }
  })
}

function getMonthLabel(month: number): string {
  const found = BAZI_SOLAR_MONTH_OPTIONS.find((option) => {
    return option.value === month
  })

  return found ? found.title : `公历${month}月`
}

function getDayLabel(day: number): string {
  const found = BAZI_SOLAR_DAY_OPTIONS.find((option) => {
    return option.value === day
  })

  return found ? found.title : `${day}日`
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

function buildSelectedSummary(selection: BaziRuntimeTimeSelection): string {
  return `当前选择：年份 ${selection.currentYear}；月份 ${getMonthLabel(
    selection.currentMonth
  )}；日期 ${getDayLabel(selection.currentDay)}；${getHourLabel(
    selection.currentHour
  )}；流月以节气月令计算`
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