/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Calculator
 * ======================================================
 *
 * 【文件职责】
 * 这个文件是“业务层出生盘面计算器”。
 *
 * 它不再负责底层紫微主星排布公式本身，
 * 而是负责：
 *
 * 1. 接收外部 BirthInput
 * 2. 调用 lunar.ts 完成阳历 -> 农历转换
 * 3. 调用 ZiweiEngine.ts 完成正式紫微排盘
 * 4. 把底层地支宫位盘映射成业务宫位盘
 * 5. 补齐 BirthPattern 中业务层需要的字段
 * 6. 输出给 mapper.ts / 前端 / debug 页面使用
 *
 * ------------------------------------------------------
 * 【新的分层原则】
 *
 * 底层排盘：
 * - lunar.ts
 * - ZiweiEngine.ts
 *
 * 当前文件：
 * - 负责“业务适配”
 * - 负责“把 engine result 转成 BirthPattern”
 *
 * 这样可以避免：
 * - calculator.ts 里混着时间换算、排星、业务映射、人格逻辑
 * - 类型越来越乱
 * - 算法升级时牵一发而动全身
 *
 * ======================================================
 */

import type {
  BirthInput,
  BirthPattern,
  BranchPalace,
  BranchPalaceStars,
  BorrowedPalace,
  BorrowedPalaceInfo,
  SectorName,
  SectorStars,
  StarId
} from "./schema"

import { convertSolarToLunarInfo } from "./lunar"
import { calculateZiweiEngine, getOppositePalace } from "./ZiweiEngine"

/**
 * ======================================================
 * 地支宫位顺序（业务映射层使用）
 * ======================================================
 *
 * 注意：
 * 这里的顺序不是 ZiweiEngine 里的“公式坐标顺序”，
 * 而是当前项目业务映射时使用的自然地支顺序：
 *
 * 子 -> 丑 -> 寅 -> 卯 -> 辰 -> 巳 -> 午 -> 未 -> 申 -> 酉 -> 戌 -> 亥
 *
 * 用途：
 * - 创建空的 branch palaces 结构时参考
 * - 地支宫位转业务宫位时使用
 *
 * 真正的命宫 / 身宫 / 紫微 / 天府位置计算，
 * 已经交给 ZiweiEngine.ts 处理。
 * ======================================================
 */
const BRANCH_PALACE_ORDER: BranchPalace[] = [
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
 * 业务宫位顺序
 * ======================================================
 *
 * 当前项目内部使用的业务宫位顺序。
 *
 * 用于：
 * - 创建空的 sectors 结构
 * - 保证 sectors 的字段完整性
 * ======================================================
 */
const SECTOR_ORDER: SectorName[] = [
  "life",
  "siblings",
  "spouse",
  "children",
  "wealth",
  "health",
  "travel",
  "friends",
  "career",
  "property",
  "fortune",
  "parents"
]

/**
 * ======================================================
 * 地支宫位 -> 业务宫位映射
 * ======================================================
 *
 * 当前项目固定采用这套映射关系：
 *
 * 子 -> spouse
 * 丑 -> life
 * 寅 -> friends
 * 卯 -> children
 * 辰 -> wealth
 * 巳 -> health
 * 午 -> parents
 * 未 -> fortune
 * 申 -> property
 * 酉 -> career
 * 戌 -> travel
 * 亥 -> siblings
 *
 * 说明：
 * 这不是传统紫微“十二宫名 = 地支”的一一对应概念，
 * 而是你项目产品层自定义的业务表达结构。
 * ======================================================
 */
const BRANCH_TO_SECTOR_MAP: Record<BranchPalace, SectorName> = {
  zi: "spouse",
  chou: "life",
  yin: "friends",
  mao: "children",
  chen: "wealth",
  si: "health",
  wu: "parents",
  wei: "fortune",
  shen: "property",
  you: "career",
  xu: "travel",
  hai: "siblings"
}

/**
 * ======================================================
 * 创建空的业务宫位盘
 * ======================================================
 *
 * 用于把 branchPalaces 映射成 sectors 前，先创建完整骨架。
 * ======================================================
 */
function createEmptySectors(): SectorStars {
  const sectors = {} as SectorStars

  SECTOR_ORDER.forEach((name) => {
    sectors[name] = []
  })

  return sectors
}

/**
 * ======================================================
 * 地支宫位盘 -> 业务宫位盘
 * ======================================================
 *
 * 说明：
 * ZiweiEngine 返回的是地支层原生主星盘：
 *
 * {
 *   yin: [...],
 *   mao: [...],
 *   ...
 * }
 *
 * 当前项目业务层和 UI 更习惯消费：
 *
 * {
 *   life: [...],
 *   spouse: [...],
 *   wealth: [...],
 *   ...
 * }
 *
 * 所以需要在这里做一层映射。
 * ======================================================
 */
function mapBranchPalacesToSectors(
  branchPalaces: BranchPalaceStars
): SectorStars {
  const sectors = createEmptySectors()

  BRANCH_PALACE_ORDER.forEach((palace) => {
    const sector = BRANCH_TO_SECTOR_MAP[palace]
    sectors[sector] = [...branchPalaces[palace]]
  })

  return sectors
}

/**
 * ======================================================
 * 收集 support 宫位
 * ======================================================
 *
 * 当前项目沿用你之前统一过的简化 support 规则：
 * - +4 宫
 * - +8 宫
 * - 对宫（+6 宫）
 *
 * 注意：
 * 这里仍然是业务人格层的“support 结构”，
 * 不是完整传统流派意义下的全部三方四正细则。
 * ======================================================
 */
function getSupportBranchPalaces(
  palace: BranchPalace
): BranchPalace[] {
  const index = BRANCH_PALACE_ORDER.indexOf(palace)

  if (index === -1) {
    throw new Error(`未知地支宫位: ${palace}`)
  }

  const mod12 = (n: number) => ((n % 12) + 12) % 12

  return [
    BRANCH_PALACE_ORDER[mod12(index + 4)],
    BRANCH_PALACE_ORDER[mod12(index + 8)],
    BRANCH_PALACE_ORDER[mod12(index + 6)]
  ]
}

/**
 * ======================================================
 * 收集 supportStars
 * ======================================================
 *
 * 从 3 个 support 宫位中，把所有星曜合并出来。
 *
 * 用 Set 去重，避免重复星曜重复加入。
 * ======================================================
 */
function collectSupportStars(
  branchPalaces: BranchPalaceStars,
  supportBranchPalaces: BranchPalace[]
): StarId[] {
  const set = new Set<StarId>()

  supportBranchPalaces.forEach((palace) => {
    branchPalaces[palace].forEach((starId) => {
      set.add(starId)
    })
  })

  return Array.from(set)
}

/**
 * ======================================================
 * 统计空宫数量（按业务宫位）
 * ======================================================
 *
 * 注意：
 * ZiweiEngineResult 里已经有 emptyPalaceCount，
 * 但那个是“按原生地支宫位”统计的。
 *
 * 这里 BirthPattern 里保留的 emptySectorCount，
 * 还是按最终业务宫位 sectors 统计，
 * 以保证和你当前前端展示、旧逻辑字段一致。
 * ======================================================
 */
function countEmptySectors(sectors: SectorStars): number {
  let count = 0

  Object.values(sectors).forEach((stars) => {
    if (stars.length === 0) {
      count++
    }
  })

  return count
}

/**
 * ======================================================
 * 引擎层借宫结构 -> 业务层借宫结构
 * ======================================================
 *
 * ZiweiEngine 返回的是 BorrowedPalaceInfo[]：
 * {
 *   palace,
 *   sourcePalace,
 *   borrowedStars,
 *   weight
 * }
 *
 * 但 BirthPattern 当前使用的是 BorrowedPalace[]：
 * {
 *   targetPalace,
 *   sourcePalace,
 *   stars
 * }
 *
 * 所以这里做一层结构适配。
 * ======================================================
 */
function mapBorrowedPalaces(
  engineBorrowedPalaces: BorrowedPalaceInfo[]
): BorrowedPalace[] {
  return engineBorrowedPalaces.map((item) => ({
    targetPalace: item.palace,
    sourcePalace: item.sourcePalace,
    stars: [...item.borrowedStars]
  }))
}

/**
 * ======================================================
 * 主函数：根据出生输入计算 BirthPattern
 * ======================================================
 *
 * 这是当前文件唯一对外暴露的入口。
 *
 * 新流程：
 * 1. 阳历 -> 农历
 * 2. 调用正式 ZiweiEngine
 * 3. 把引擎结果转成业务层 BirthPattern
 * ======================================================
 */
export function calculateBirthPattern(
  input: BirthInput
): BirthPattern {
  /**
   * ------------------------------------------------------
   * Step 1：阳历 -> 农历出生信息
   * ------------------------------------------------------
   *
   * 得到：
   * - 农历年月日
   * - 年干
   * - 时辰地支
   * - timeBranchIndex
   * - timeBranchNumber
   */
  const lunarInfo = convertSolarToLunarInfo(input)

  /**
   * ------------------------------------------------------
   * Step 2：调用正式紫微排盘引擎
   * ------------------------------------------------------
   *
   * 这里开始，主星安放、命宫、身宫、五行局、借宫，
   * 全部交给 ZiweiEngine.ts。
   *
   * 当前 calculator.ts 不再自己排星。
   */
  const engineResult = calculateZiweiEngine(lunarInfo)

  /**
   * ------------------------------------------------------
   * Step 3：取出引擎层核心结果
   * ------------------------------------------------------
   */
  const primaryBranchPalace = engineResult.lifePalace
  const bodyBranchPalace = engineResult.bodyPalace

  /**
   * 这里的 branchPalaces 直接使用“原生主星盘”
   *
   * 注意：
   * - 不包含借星
   * - 借宫记录单独放在 borrowedPalaces
   */
  const branchPalaces = engineResult.nativeStars

  /**
   * 引擎层借宫记录 -> 业务层借宫记录
   */
  const borrowedPalaces = mapBorrowedPalaces(engineResult.borrowedPalaces)

  /**
   * ------------------------------------------------------
   * Step 4：映射为业务宫位盘
   * ------------------------------------------------------
   */
  const sectors = mapBranchPalacesToSectors(branchPalaces)

  /**
   * ------------------------------------------------------
   * Step 5：命宫相关信息
   * ------------------------------------------------------
   */
  const primarySector = BRANCH_TO_SECTOR_MAP[primaryBranchPalace]
  const primaryStars = [...branchPalaces[primaryBranchPalace]]
  const isEmptyPrimary = primaryStars.length === 0

  /**
   * ------------------------------------------------------
   * Step 6：对宫相关信息
   * ------------------------------------------------------
   *
   * oppositeBranchPalace：
   * 直接调用 ZiweiEngine 导出的对宫函数
   *
   * borrowedStars：
   * 当前项目仍保留这个快捷字段，
   * 用“对宫原生主星”表示命宫可借参考星。
   */
  const oppositeBranchPalace = getOppositePalace(primaryBranchPalace)
  const oppositeSector = BRANCH_TO_SECTOR_MAP[oppositeBranchPalace]
  const borrowedStars = [...branchPalaces[oppositeBranchPalace]]

  /**
   * ------------------------------------------------------
   * Step 7：support 信息
   * ------------------------------------------------------
   *
   * 当前继续沿用你的简化 support 结构：
   * - 两组三方
   * - 一组对宫
   */
  const supportBranchPalaces = getSupportBranchPalaces(primaryBranchPalace)

  const supportSectors = supportBranchPalaces.map(
    (palace) => BRANCH_TO_SECTOR_MAP[palace]
  )

  const supportStars = collectSupportStars(
    branchPalaces,
    supportBranchPalaces
  )

  /**
   * ------------------------------------------------------
   * Step 8：统计业务层空宫数
   * ------------------------------------------------------
   */
  const emptySectorCount = countEmptySectors(sectors)

  /**
   * ------------------------------------------------------
   * Step 9：生成唯一 birthKey
   * ------------------------------------------------------
   */
  const birthKey =
    `${input.year}-${input.month}-${input.day}-` +
    `${input.hour}-${input.minute ?? 0}`

  /**
   * ------------------------------------------------------
   * Step 10：输出 BirthPattern
   * ------------------------------------------------------
   *
   * 注意：
   * 当前 engine 字段仍然是“人格引擎名称”，
   * 不是 ZiweiEngineResult 对象。
   *
   * 如果你后面想在 debug 中保留 engineResult，
   * 可以新增一个 debugEngineResult 字段，
   * 但不要塞进 engine。
   */
  const pattern: BirthPattern = {
    birthKey,

    lunarInfo,
    timeBranch: lunarInfo.timeBranch,

    engine: "star-pair-engine",

    primaryBranchPalace,
    bodyBranchPalace,

    branchPalaces,
    borrowedPalaces,

    sectors,
    primarySector,

    supportSectors,
    supportBranchPalaces,
    supportStars,
    supportSymbols: [...supportStars],

    primaryStars,
    isEmptyPrimary,

    oppositeSector,
    oppositeBranchPalace,
    borrowedStars,

    emptySectorCount
  }

  return pattern
}