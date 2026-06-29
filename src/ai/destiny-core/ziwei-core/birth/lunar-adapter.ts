import type {
  LunarBirthInfo,
  NormalizedZiweiBirthInput,
  ZiweiBirthInput
} from "../contracts"

import { normalizeZiweiBirthInput } from "./birth-input-normalizer"
import { getYearBranch, getYearStem } from "./ganzhi-resolver"
import {
  getFormulaTimeIndex,
  getTimeBranchFromHour,
  getTimeBranchIndex,
  getTimeBranchNumber
} from "./time-branch-resolver"

const LUNAR_MONTH_TEXT_TO_NUMBER: Record<string, number> = {
  "正月": 1,
  "一月": 1,
  "二月": 2,
  "三月": 3,
  "四月": 4,
  "五月": 5,
  "六月": 6,
  "七月": 7,
  "八月": 8,
  "九月": 9,
  "十月": 10,
  "冬月": 11,
  "十一月": 11,
  "腊月": 12,
  "十二月": 12
}

export function convertZiweiBirthInputToLunarInfo(
  input: ZiweiBirthInput
): LunarBirthInfo {
  const normalized = normalizeZiweiBirthInput(input)
  return convertNormalizedZiweiBirthInputToLunarInfo(normalized)
}

export function convertNormalizedZiweiBirthInputToLunarInfo(
  input: NormalizedZiweiBirthInput
): LunarBirthInfo {
  if (input.calendarType !== "solar") {
    throw new Error("Only solar calendar input is currently supported.")
  }

  const timeBranch = getTimeBranchFromHour(input.hour)
  const lunarDate = convertSolarDateToLunarDate(input)

  return {
    solarYear: input.year,
    solarMonth: input.month,
    solarDay: input.day,
    solarHour: input.hour,
    solarMinute: input.minute,

    lunarYear: lunarDate.lunarYear,
    lunarMonth: lunarDate.lunarMonth,
    lunarDay: lunarDate.lunarDay,
    lunarIsLeapMonth: lunarDate.lunarIsLeapMonth,

    yearStem: getYearStem(lunarDate.lunarYear),
    yearBranch: getYearBranch(lunarDate.lunarYear),
    timeBranch,
    timeBranchIndex: getTimeBranchIndex(timeBranch),
    timeBranchNumber: getTimeBranchNumber(timeBranch),
    formulaTimeIndex: getFormulaTimeIndex(timeBranch)
  }
}

function convertSolarDateToLunarDate(
  input: NormalizedZiweiBirthInput
): {
  lunarYear: number
  lunarMonth: number
  lunarDay: number
  lunarIsLeapMonth: boolean
} {
  const date = new Date(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    0,
    0
  )

  const formatter = new Intl.DateTimeFormat("zh-Hans-u-ca-chinese", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })

  const parts = formatter.formatToParts(date)
  const relatedYear = parts.find(
    (part) => String(part.type) === "relatedYear"
  )?.value
  const monthText = parts.find((part) => part.type === "month")?.value
  const dayText = parts.find((part) => part.type === "day")?.value

  if (!relatedYear || !monthText || !dayText) {
    throw new Error("Failed to read lunar date parts.")
  }

  const lunarYear = Number(relatedYear)
  const lunarMonth = parseLunarMonthText(monthText)
  const lunarDay = Number(dayText)

  if (
    !Number.isInteger(lunarYear) ||
    !Number.isInteger(lunarMonth) ||
    !Number.isInteger(lunarDay)
  ) {
    throw new Error("Invalid parsed lunar date.")
  }

  return {
    lunarYear,
    lunarMonth,
    lunarDay,
    lunarIsLeapMonth: monthText.includes("闰")
  }
}

function parseLunarMonthText(monthText: string): number {
  const normalized = monthText.replace("闰", "")
  const month = LUNAR_MONTH_TEXT_TO_NUMBER[normalized]

  if (!month) {
    throw new Error(`Unknown lunar month text: ${monthText}`)
  }

  return month
}
