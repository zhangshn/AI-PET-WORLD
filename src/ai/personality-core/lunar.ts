/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Lunar
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只负责：
 * 1. 校验阳历输入
 * 2. 小时 -> 十二时辰
 * 3. 时辰 -> 时辰索引 / 时辰数
 * 4. 阳历 -> 农历信息
 * 5. 农历月 + 时辰编号 -> 命宫索引
 *
 * ------------------------------------------------------
 * 【重要边界】
 * - 正式版本：出生时间来自系统记录的宠物出生时刻
 * - 测试页：出生时间来自手动输入
 * - 但不管来源是什么，到了这里都只接受 BirthInput
 *
 * ------------------------------------------------------
 * 【当前实现说明】
 * - 农历转换使用 Intl.DateTimeFormat 的 Chinese Calendar
 * - 当前环境下通常可用
 * - 如果未来要换成更专业的农历库，只替换：
 *   convertSolarDateToLunarDate()
 *
 * ======================================================
 */

import type {
  BirthInput,
  HeavenlyStem,
  LunarBirthInfo,
  TimeBranch
} from "./schema"

/**
 * ======================================================
 * 十二时辰顺序表
 *
 * 说明：
 * 这是“子=1, 丑=2 ... 亥=12”这套顺序，
 * 主要用于 timeBranchIndex 的顺序编号。
 * ======================================================
 */
const TIME_BRANCH_ORDER: TimeBranch[] = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai"
]

/**
 * ======================================================
 * 中文农历月份映射
 * ======================================================
 */
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

/**
 * ======================================================
 * 小时 -> 十二时辰
 *
 * 正式规则：
 * - 子：23:00 - 00:59
 * - 丑：01:00 - 02:59
 * - 寅：03:00 - 04:59
 * - 卯：05:00 - 06:59
 * - 辰：07:00 - 08:59
 * - 巳：09:00 - 10:59
 * - 午：11:00 - 12:59
 * - 未：13:00 - 14:59
 * - 申：15:00 - 16:59
 * - 酉：17:00 - 18:59
 * - 戌：19:00 - 20:59
 * - 亥：21:00 - 22:59
 * ======================================================
 */
export function getTimeBranchFromHour(hour: number): TimeBranch {
  if (hour === 23 || hour === 0) return "zi"
  if (hour === 1 || hour === 2) return "chou"
  if (hour === 3 || hour === 4) return "yin"
  if (hour === 5 || hour === 6) return "mao"
  if (hour === 7 || hour === 8) return "chen"
  if (hour === 9 || hour === 10) return "si"
  if (hour === 11 || hour === 12) return "wu"
  if (hour === 13 || hour === 14) return "wei"
  if (hour === 15 || hour === 16) return "shen"
  if (hour === 17 || hour === 18) return "you"
  if (hour === 19 || hour === 20) return "xu"
  return "hai"
}

/**
 * ======================================================
 * 时辰 -> 顺序索引
 *
 * 规则：
 * 子=1, 丑=2 ... 亥=12
 *
 * 说明：
 * - 这是当前 schema 里的 timeBranchIndex
 * - 主要用于调试和部分简化公式兼容
 * ======================================================
 */
export function getTimeBranchIndex(branch: TimeBranch): number {
  const index = TIME_BRANCH_ORDER.indexOf(branch)

  if (index < 0) {
    return 1
  }

  return index + 1
}

/**
 * ======================================================
 * 时辰 -> 时辰数
 *
 * 规则：
 * 子=1，丑=2，寅=3，卯=4，辰=5，巳=6，
 * 午=7，未=8，申=9，酉=10，戌=11，亥=12
 *
 * 说明：
 * - 这是你当前命宫简化公式中使用的“时辰数”
 * - 与 timeBranchIndex 保持同一顺序定义
 * ======================================================
 */
function getTimeBranchNumber(branch: TimeBranch): number {
  switch (branch) {
    case "zi":
      return 1
    case "chou":
      return 2
    case "yin":
      return 3
    case "mao":
      return 4
    case "chen":
      return 5
    case "si":
      return 6
    case "wu":
      return 7
    case "wei":
      return 8
    case "shen":
      return 9
    case "you":
      return 10
    case "xu":
      return 11
    case "hai":
      return 12
    default:
      return 1
  }
}

/**
 * ======================================================
 * 输入校验
 * ======================================================
 */
export function validateBirthInput(input: BirthInput): void {
  if (!Number.isInteger(input.year) || input.year <= 0) {
    throw new Error("出生年份无效")
  }

  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error("出生月份无效")
  }

  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 31) {
    throw new Error("出生日期无效")
  }

  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error("出生小时无效")
  }

  if (
    input.minute !== undefined &&
    (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59)
  ) {
    throw new Error("出生分钟无效")
  }
}

/**
 * ======================================================
 * 公历年份 -> 天干
 *
 * 说明：
 * - 以公历 4 年对应甲干循环起点
 * - 这里只取天干，不取地支
 * - 这是当前工程版近似处理，后续如需更严格，
 *   可改为直接从农历干支结果解析
 * ======================================================
 */
function getYearStem(year: number): HeavenlyStem {
  const stems: HeavenlyStem[] = [
    "jia",
    "yi",
    "bing",
    "ding",
    "wu",
    "ji",
    "geng",
    "xin",
    "ren",
    "gui"
  ]

  const index = ((year - 4) % 10 + 10) % 10
  return stems[index]
}

/**
 * ======================================================
 * 解析农历月份文本
 * ======================================================
 */
function parseLunarMonthText(monthText: string): number {
  const normalized = monthText.replace("闰", "")
  const month = LUNAR_MONTH_TEXT_TO_NUMBER[normalized]

  if (!month) {
    throw new Error(`无法解析农历月份：${monthText}`)
  }

  return month
}

/**
 * ======================================================
 * 阳历日期 -> 农历日期
 *
 * 说明：
 * - 使用 Intl Chinese Calendar
 * - 从 formatToParts 中提取：
 *   relatedYear / yearName / month / day
 *
 * 注意：
 * - TS 对 chinese calendar 的 part.type 支持不完整
 * - 所以这里统一转 string 再比较
 * ======================================================
 */
function convertSolarDateToLunarDate(input: BirthInput): {
  lunarYear: number
  lunarMonth: number
  lunarDay: number
  lunarYearName: string
  lunarMonthText: string
} {
  const date = new Date(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute ?? 0,
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

  const yearName = parts.find(
    (part) => String(part.type) === "yearName"
  )?.value

  const monthText = parts.find(
    (part) => String(part.type) === "month"
  )?.value

  const dayText = parts.find(
    (part) => String(part.type) === "day"
  )?.value

  if (!relatedYear || !monthText || !dayText) {
    throw new Error("农历转换失败：无法从 Intl 中读取农历年月日")
  }

  const lunarYear = Number(relatedYear)
  const lunarMonth = parseLunarMonthText(monthText)
  const lunarDay = Number(dayText)

  if (
    !Number.isInteger(lunarYear) ||
    !Number.isInteger(lunarMonth) ||
    !Number.isInteger(lunarDay)
  ) {
    throw new Error("农历转换失败：农历年月日解析异常")
  }

  return {
    lunarYear,
    lunarMonth,
    lunarDay,
    lunarYearName: yearName ?? "",
    lunarMonthText: monthText
  }
}

/**
 * ======================================================
 * 阳历输入 -> 农历排盘信息
 *
 * 说明：
 * - 这是 personality-core 中统一的前置入口
 * - 后续 ziwei-engine / calculator 都只应调这个函数
 * ======================================================
 */
export function convertSolarToLunarInfo(
  input: BirthInput
): LunarBirthInfo {
  validateBirthInput(input)

  const solarMinute = input.minute ?? 0
  const timeBranch = getTimeBranchFromHour(input.hour)
  const timeBranchIndex = getTimeBranchIndex(timeBranch)
  const timeBranchNumber = getTimeBranchNumber(timeBranch)

  const lunarDate = convertSolarDateToLunarDate(input)

  return {
    solarYear: input.year,
    solarMonth: input.month,
    solarDay: input.day,
    solarHour: input.hour,
    solarMinute,

    lunarYear: lunarDate.lunarYear,
    lunarMonth: lunarDate.lunarMonth,
    lunarDay: lunarDate.lunarDay,

    yearStem: getYearStem(lunarDate.lunarYear),

    timeBranch,
    timeBranchIndex,
    timeBranchNumber
  }
}

/**
 * ======================================================
 * 农历月 + 时辰编号 -> 命宫索引
 *
 * 当前保留这条简化公式供兼容/调试使用：
 * 命宫 = (2 + 农历月数 - 时辰数) mod 12
 *
 * 注意：
 * - 真正紫微排盘主流程后续应优先走 ziwei-engine.ts
 * - 这里保留是为了兼容你之前的测试逻辑与调试展示
 * ======================================================
 */
export function calculatePrimarySectorIndex(
  lunarMonth: number,
  timeBranchNumber: number
): number {
  const raw = 2 + lunarMonth - timeBranchNumber
  return ((raw % 12) + 12) % 12
}

/**
 * ======================================================
 * 时辰中文
 * ======================================================
 */
export function getTimeBranchLabel(branch: TimeBranch): string {
  switch (branch) {
    case "zi":
      return "子"
    case "chou":
      return "丑"
    case "yin":
      return "寅"
    case "mao":
      return "卯"
    case "chen":
      return "辰"
    case "si":
      return "巳"
    case "wu":
      return "午"
    case "wei":
      return "未"
    case "shen":
      return "申"
    case "you":
      return "酉"
    case "xu":
      return "戌"
    case "hai":
      return "亥"
    default:
      return branch
  }
}

/**
 * ======================================================
 * 时辰完整说明
 * ======================================================
 */
export function getTimeBranchDisplayText(branch: TimeBranch): string {
  switch (branch) {
    case "zi":
      return "子时（23:00 - 00:59）"
    case "chou":
      return "丑时（01:00 - 02:59）"
    case "yin":
      return "寅时（03:00 - 04:59）"
    case "mao":
      return "卯时（05:00 - 06:59）"
    case "chen":
      return "辰时（07:00 - 08:59）"
    case "si":
      return "巳时（09:00 - 10:59）"
    case "wu":
      return "午时（11:00 - 12:59）"
    case "wei":
      return "未时（13:00 - 14:59）"
    case "shen":
      return "申时（15:00 - 16:59）"
    case "you":
      return "酉时（17:00 - 18:59）"
    case "xu":
      return "戌时（19:00 - 20:59）"
    case "hai":
      return "亥时（21:00 - 22:59）"
    default:
      return branch
  }
}