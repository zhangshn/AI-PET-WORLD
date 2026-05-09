/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Lunar
 * ======================================================
 *
 * 【文件定位】
 * 这是排盘前置的“时间转换层”。
 *
 * 它只负责：
 * 1. 接收最外层 BirthInput
 * 2. 做基础输入校验
 * 3. 把小时转换成十二时辰地支
 * 4. 生成当前排盘所需的时辰编号
 * 5. 阳历 -> 农历年月日
 * 6. 组装统一的 LunarBirthInfo
 *
 * ------------------------------------------------------
 * 【这个文件不负责什么】
 * 不负责：
 * - 命宫公式
 * - 身宫公式
 * - 五行局
 * - 紫微 / 天府
 * - 主星安放
 *
 * 这些都应该交给：
 *
 *   src/ai/personality-core/ziwei-engine.ts
 *
 * ------------------------------------------------------
 * 【当前最关键的字段】
 * 这次最重要的是：
 *
 *   timeBranchNumber
 *
 * 它必须严格使用：
 *   子=1，丑=2，寅=3，卯=4，辰=5，巳=6，
 *   午=7，未=8，申=9，酉=10，戌=11，亥=12
 *
 * 因为你当前新版 ziwei-engine.ts 的命宫算法，
 * 就是直接用这套编号：
 *
 *   L = (Month - Hour) mod 12
 *
 * ------------------------------------------------------
 * 【关于 formulaTimeIndex】
 * 当前仍然保留 formulaTimeIndex，原因是：
 * - 调试方便
 * - 后续如果某些算法需要 0=寅...11=丑 的物理索引，可以直接取用
 *
 * 但你当前新版 ziwei-engine.ts 主流程，
 * 核心依赖的是：
 *   timeBranchNumber
 *
 * ------------------------------------------------------
 * 【重要提醒】
 * 如果后面发现排盘仍然不对，
 * 先核查：
 * 1. 农历月日是否正确
 * 2. 时辰划分是否正确
 * 3. timeBranchNumber 是否符合 子=1...亥=12
 *
 * 而不是先去改 calculator.ts 或 page.tsx。
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
 * 十二时辰地支顺序（业务展示顺序）
 * ======================================================
 *
 * 当前顺序：
 * 子、丑、寅、卯、辰、巳、午、未、申、酉、戌、亥
 *
 * 主要用于：
 * - timeBranchIndex
 * - 展示
 * - 调试
 *
 * 注意：
 * 这不是地支物理索引顺序，也不是“寅起 0”的公式顺序。
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
 * 农历月份文本 -> 数字
 * ======================================================
 *
 * Intl Chinese Calendar 返回的月份可能是：
 * - 正月
 * - 二月
 * - 冬月
 * - 腊月
 * - 闰四月
 *
 * 这里统一做解析。
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
 * 小时 -> 时辰地支
 * ======================================================
 *
 * 规则：
 * 子时：23:00 - 00:59
 * 丑时：01:00 - 02:59
 * 寅时：03:00 - 04:59
 * 卯时：05:00 - 06:59
 * 辰时：07:00 - 08:59
 * 巳时：09:00 - 10:59
 * 午时：11:00 - 12:59
 * 未时：13:00 - 14:59
 * 申时：15:00 - 16:59
 * 酉时：17:00 - 18:59
 * 戌时：19:00 - 20:59
 * 亥时：21:00 - 22:59
 *
 * 返回：
 * - "zi" / "chou" / "yin" ...
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
 * ======================================================
 *
 * 当前返回值：
 * 子=1，丑=2，寅=3 ... 亥=12
 *
 * 这其实和 timeBranchNumber 数值相同，
 * 但这里保留两个概念，方便你后面理解：
 *
 * - timeBranchIndex：顺序位置
 * - timeBranchNumber：排盘公式使用的时辰编号
 *
 * 当前两者值相同。
 * ======================================================
 */
export function getTimeBranchIndex(branch: TimeBranch): number {
  const index = TIME_BRANCH_ORDER.indexOf(branch)

  if (index < 0) {
    throw new Error(`无法识别时辰地支：${branch}`)
  }

  return index + 1
}

/**
 * ======================================================
 * 时辰 -> 排盘公式编号
 * ======================================================
 *
 * 当前最重要的字段。
 *
 * 规则必须严格为：
 * 子=1
 * 丑=2
 * 寅=3
 * 卯=4
 * 辰=5
 * 巳=6
 * 午=7
 * 未=8
 * 申=9
 * 酉=10
 * 戌=11
 * 亥=12
 *
 * 当前新版 ziwei-engine.ts 就是按这套编号计算：
 *   命宫 = (Month - Hour) mod 12
 * ======================================================
 */
export function getTimeBranchNumber(branch: TimeBranch): number {
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
      throw new Error(`无法识别时辰编号：${branch}`)
  }
}

/**
 * ======================================================
 * 时辰 -> 物理地支索引（寅起 0）
 * ======================================================
 *
 * 规则：
 * 寅=0，卯=1，辰=2，巳=3，午=4，未=5，
 * 申=6，酉=7，戌=8，亥=9，子=10，丑=11
 *
 * 说明：
 * - 这是固定物理地支索引
 * - 当前新版 ziwei-engine.ts 主流程未直接用它算命宫
 * - 但保留它有利于调试和后续扩展
 * ======================================================
 */
export function getFormulaTimeIndex(branch: TimeBranch): number {
  switch (branch) {
    case "yin":
      return 0
    case "mao":
      return 1
    case "chen":
      return 2
    case "si":
      return 3
    case "wu":
      return 4
    case "wei":
      return 5
    case "shen":
      return 6
    case "you":
      return 7
    case "xu":
      return 8
    case "hai":
      return 9
    case "zi":
      return 10
    case "chou":
      return 11
    default:
      throw new Error(`无法识别物理时辰索引：${branch}`)
  }
}

/**
 * ======================================================
 * 输入校验
 * ======================================================
 *
 * 做基础合法性检查：
 * - 年
 * - 月
 * - 日
 * - 时
 * - 分
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
 * ======================================================
 *
 * 当前实现说明：
 * - 使用年份循环推天干
 * - 工程上可用
 * - 后续如需更严谨，可升级为节气边界算法
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
 *
 * 支持：
 * - 正月
 * - 冬月
 * - 腊月
 * - 闰四月
 *
 * 当前：
 * - 去掉“闰”
 * - 不单独保存闰月标记
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
 * 阳历 -> 农历日期
 * ======================================================
 *
 * 当前使用：
 * Intl.DateTimeFormat("zh-Hans-u-ca-chinese")
 *
 * 返回：
 * - lunarYear
 * - lunarMonth
 * - lunarDay
 *
 * 注意：
 * 如果你后面发现盘还是不准，
 * 这里是第一怀疑对象之一。
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
    throw new Error("农历转换失败：无法读取农历年月日")
  }

  const lunarYear = Number(relatedYear)
  const lunarMonth = parseLunarMonthText(monthText)
  const lunarDay = Number(dayText)

  if (
    !Number.isInteger(lunarYear) ||
    !Number.isInteger(lunarMonth) ||
    !Number.isInteger(lunarDay)
  ) {
    throw new Error("农历转换失败：解析后的年月日无效")
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
 * 阳历输入 -> LunarBirthInfo
 * ======================================================
 *
 * 这是 personality-core 统一时间入口。
 *
 * 当前输出会同时保留：
 * - 业务顺序字段
 * - 排盘公式字段
 * - 调试字段
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
  const formulaTimeIndex = getFormulaTimeIndex(timeBranch)

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
    timeBranchNumber,
    formulaTimeIndex
  }
}

/**
 * ======================================================
 * 旧兼容函数：命宫索引
 * ======================================================
 *
 * 注意：
 * 当前新版主排盘逻辑已经主要使用 ziwei-engine.ts。
 * 这里保留此函数只是为了兼容旧测试或旧代码。
 * ======================================================
 */
export function calculatePrimarySectorIndex(
  lunarMonth: number,
  timeBranchNumber: number
): number {
  const monthIndex = lunarMonth - 1
  const hourIndex = timeBranchNumber - 1
  return ((monthIndex - hourIndex) % 12 + 12) % 12
}

/**
 * ======================================================
 * 时辰中文标签
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
 * 时辰完整展示文本
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