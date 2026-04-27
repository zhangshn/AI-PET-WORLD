/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Calculator
 * ======================================================
 *
 * 【文件定位】
 * 这是 personality-core 的“业务适配层”。
 *
 * 它不是底层排盘引擎，也不是人格生成器。
 *
 * ------------------------------------------------------
 * 【它负责什么】
 * 当前文件只负责：
 *
 * 1. 接收最外层 BirthInput
 * 2. 调用 lunar.ts，得到 LunarBirthInfo
 * 3. 调用 ziwei-engine.ts，得到 ZiweiEngineResult
 * 4. 根据 palaceSequence 动态建立：
 *    - 地支 -> 宫名
 *    - 宫名 -> 地支
 * 5. 把引擎层结果适配成业务层 BirthPattern
 *
 * ------------------------------------------------------
 * 【它不负责什么】
 * 当前文件不负责：
 * - 命宫公式
 * - 身宫公式
 * - 五行局
 * - 紫微 / 天府
 * - 主星安放
 * - 借星底层规则
 *
 * 这些全部交给：
 *
 *   src/ai/personality-core/ziwei-engine.ts
 *
 * ------------------------------------------------------
 * 【为什么这个文件必须存在】
 * 因为：
 * - ziwei-engine.ts 输出的是“底层地支物理盘”
 * - UI / mapper.ts / 业务层更适合消费“适配后的业务结构”
 *
 * 所以需要一个单独的中间层，把：
 *
 *   ZiweiEngineResult
 *      ↓
 *   BirthPattern
 *
 * 这一步做干净。
 *
 * ------------------------------------------------------
 * 【这次修复最关键的点】
 * 过去的错误是：
 * - 把宫名固定贴在地支上
 * - 用固定 branch -> sector 映射
 *
 * 现在正确逻辑是：
 * - 地支槽位固定
 * - 宫名根据命宫旋转
 *
 * 所以当前文件最重要的工作就是：
 *
 *   根据 palaceSequence 动态建立宫名映射
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
import { calculateZiweiEngine, getOppositePalace } from "./ziwei-engine"

/**
 * ======================================================
 * 十二宫角色顺序（固定）
 * ======================================================
 *
 * 说明：
 * 这是“十二宫名称的逻辑顺序”，不是固定贴在地支上的顺序。
 *
 * 即：
 * 0  -> 命宫
 * 1  -> 兄弟
 * 2  -> 夫妻
 * 3  -> 子女
 * 4  -> 财帛
 * 5  -> 疾厄
 * 6  -> 迁移
 * 7  -> 交友
 * 8  -> 官禄
 * 9  -> 田宅
 * 10 -> 福德
 * 11 -> 父母
 *
 * 当前项目里使用的业务命名为：
 * - life
 * - siblings
 * - spouse
 * ...
 *
 * 注意：
 * 宫名顺序固定，但它们落在哪个地支槽位上，是动态的。
 * ======================================================
 */
const PALACE_ROLE_TO_SECTOR: SectorName[] = [
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
 * 创建空的业务宫位盘
 * ======================================================
 *
 * 返回：
 * {
 *   life: [],
 *   siblings: [],
 *   spouse: [],
 *   ...
 *   parents: []
 * }
 *
 * 用于：
 * - 在把地支主星盘适配成业务宫位盘前，
 *   先创建完整骨架
 * ======================================================
 */
function createEmptySectors(): SectorStars {
  const sectors = {} as SectorStars

  PALACE_ROLE_TO_SECTOR.forEach((name) => {
    sectors[name] = []
  })

  return sectors
}

/**
 * ======================================================
 * 根据 palaceSequence 构建动态映射
 * ======================================================
 *
 * 输入：
 * - palaceSequence
 *
 * palaceSequence 含义：
 * - palaceSequence[0] = 命宫所在地支
 * - palaceSequence[1] = 兄弟宫所在地支
 * - palaceSequence[2] = 夫妻宫所在地支
 * - ...
 *
 * ------------------------------------------------------
 * 输出两个映射：
 *
 * 1. branchToSectorMap
 *    表示：
 *    当前这个地支槽位，属于哪个宫名
 *
 * 2. sectorToBranchMap
 *    表示：
 *    当前这个宫名，落在哪个地支槽位
 *
 * ------------------------------------------------------
 * 这一步是整次修复中最重要的一步。
 * 因为你页面乱，不是地支乱，而是“宫名贴错地支”。
 * ======================================================
 */
function buildDynamicPalaceMaps(
  palaceSequence: BranchPalace[]
): {
  branchToSectorMap: Record<BranchPalace, SectorName>
  sectorToBranchMap: Record<SectorName, BranchPalace>
} {
  const branchToSectorMap = {} as Record<BranchPalace, SectorName>
  const sectorToBranchMap = {} as Record<SectorName, BranchPalace>

  PALACE_ROLE_TO_SECTOR.forEach((sectorName, index) => {
    const branch = palaceSequence[index]
    branchToSectorMap[branch] = sectorName
    sectorToBranchMap[sectorName] = branch
  })

  return {
    branchToSectorMap,
    sectorToBranchMap
  }
}

/**
 * ======================================================
 * 地支主星盘 -> 业务宫位盘
 * ======================================================
 *
 * 输入：
 * - branchPalaces：地支层原生主星盘
 * - sectorToBranchMap：当前盘动态生成的“宫名 -> 地支”映射
 *
 * 输出：
 * - sectors：业务宫位盘
 *
 * ------------------------------------------------------
 * 注意：
 * 这里不能再使用固定映射。
 * 必须严格根据当前盘的动态宫位旋转结果来转换。
 * ======================================================
 */
function mapBranchPalacesToSectors(
  branchPalaces: BranchPalaceStars,
  sectorToBranchMap: Record<SectorName, BranchPalace>
): SectorStars {
  const sectors = createEmptySectors()

  PALACE_ROLE_TO_SECTOR.forEach((sectorName) => {
    const branch = sectorToBranchMap[sectorName]
    sectors[sectorName] = [...branchPalaces[branch]]
  })

  return sectors
}

/**
 * ======================================================
 * support 宫位（按宫位角色顺序）
 * ======================================================
 *
 * 当前规则：
 * - +4
 * - +8
 * - +6（对宫）
 *
 * 例子：
 * 如果 primarySector = life（命宫）
 * 那么：
 * - +4 -> wealth（财帛）
 * - +8 -> career（官禄）
 * - +6 -> travel（迁移）
 *
 * 这比按固定地支顺序去推 support 更合理，
 * 因为 support 本质上是“宫位关系”，不是“固定地支关系”。
 * ======================================================
 */
function getSupportSectors(primarySector: SectorName): SectorName[] {
  const index = PALACE_ROLE_TO_SECTOR.indexOf(primarySector)

  if (index === -1) {
    throw new Error(`未知业务宫位: ${primarySector}`)
  }

  const mod12 = (n: number) => ((n % 12) + 12) % 12

  return [
    PALACE_ROLE_TO_SECTOR[mod12(index + 4)],
    PALACE_ROLE_TO_SECTOR[mod12(index + 8)],
    PALACE_ROLE_TO_SECTOR[mod12(index + 6)]
  ]
}

/**
 * ======================================================
 * support 宫名 -> support 地支
 * ======================================================
 *
 * 输入：
 * - supportSectors
 * - sectorToBranchMap
 *
 * 输出：
 * - 对应 support 宫位所落的地支槽位
 * ======================================================
 */
function mapSupportSectorsToBranches(
  supportSectors: SectorName[],
  sectorToBranchMap: Record<SectorName, BranchPalace>
): BranchPalace[] {
  return supportSectors.map((sector) => sectorToBranchMap[sector])
}

/**
 * ======================================================
 * 收集 supportStars
 * ======================================================
 *
 * 输入：
 * - branchPalaces：原生主星盘
 * - supportBranchPalaces：support 对应的地支槽位
 *
 * 输出：
 * - 这些 support 宫位中的所有星曜合集
 *
 * 用 Set 去重，确保结果干净。
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
 * 统计业务宫位空宫数量
 * ======================================================
 *
 * 注意：
 * 这里统计的是业务层 sectors 的空宫数，
 * 不是引擎层 nativeStars 的空宫数。
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
 * 引擎层借宫信息 -> 业务层借宫信息
 * ======================================================
 *
 * 输入：
 *   BorrowedPalaceInfo[]
 *
 * 输出：
 *   BorrowedPalace[]
 *
 * 为什么要转换：
 * - 引擎层结构更偏底层规则
 * - 业务层结构更适合 mapper / UI / 展示
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
 * 主函数：根据出生输入生成 BirthPattern
 * ======================================================
 *
 * 输入：
 * - BirthInput
 *
 * 输出：
 * - BirthPattern
 *
 * 流程：
 * 1. BirthInput -> LunarBirthInfo
 * 2. LunarBirthInfo -> ZiweiEngineResult
 * 3. 根据 palaceSequence 建立动态宫位映射
 * 4. 适配成业务层 BirthPattern
 * ======================================================
 */
export function calculateBirthPattern(
  input: BirthInput
): BirthPattern {
  /**
   * Step 1：阳历 -> 农历与时辰信息
   */
  const lunarInfo = convertSolarToLunarInfo(input)

  /**
   * Step 2：调用正式排盘引擎
   */
  const engineResult = calculateZiweiEngine(lunarInfo)

  /**
   * Step 3：取出引擎层核心结果
   */
  const primaryBranchPalace = engineResult.lifePalace
  const bodyBranchPalace = engineResult.bodyPalace
  const branchPalaces = engineResult.nativeStars
  const borrowedPalaces = mapBorrowedPalaces(engineResult.borrowedPalaces)

  /**
   * Step 4：根据 palaceSequence 动态建立“宫名 <-> 地支”映射
   *
   * 这是本文件最关键的一步。
   */
  const { branchToSectorMap, sectorToBranchMap } = buildDynamicPalaceMaps(
    engineResult.palaceSequence
  )

  /**
   * Step 5：把地支主星盘适配成业务宫位盘
   */
  const sectors = mapBranchPalacesToSectors(
    branchPalaces,
    sectorToBranchMap
  )

  /**
   * Step 6：命宫业务字段
   */
  const primarySector = branchToSectorMap[primaryBranchPalace]
  const primaryStars = [...branchPalaces[primaryBranchPalace]]
  const isEmptyPrimary = primaryStars.length === 0

  /**
   * Step 7：对宫字段
   *
   * 对宫仍由引擎层地支逻辑决定；
   * 对宫属于哪个业务宫位，再通过动态映射得到。
   */
  const oppositeBranchPalace = getOppositePalace(primaryBranchPalace)
  const oppositeSector = branchToSectorMap[oppositeBranchPalace]
  const borrowedStars = [...branchPalaces[oppositeBranchPalace]]

  /**
   * Step 8：support 字段
   *
   * 这里按“宫位角色关系”来算 support，
   * 不是按固定地支关系。
   */
  const supportSectors = getSupportSectors(primarySector)
  const supportBranchPalaces = mapSupportSectorsToBranches(
    supportSectors,
    sectorToBranchMap
  )
  const supportStars = collectSupportStars(
    branchPalaces,
    supportBranchPalaces
  )

  /**
   * Step 9：统计业务层空宫数
   */
  const emptySectorCount = countEmptySectors(sectors)

  /**
   * Step 10：生成唯一出生键
   */
  const birthKey =
    `${input.year}-${input.month}-${input.day}-` +
    `${input.hour}-${input.minute ?? 0}`

  /**
   * Step 11：返回最终 BirthPattern
   */
  return {
    birthKey,

    lunarInfo,
    timeBranch: lunarInfo.timeBranch,

    /**
     * 当前人格引擎名称
     *
     * 注意：
     * 这里不是排盘引擎对象
     */
    engine: "star-pair-engine",

    /**
     * 命宫 / 身宫（地支层）
     */
    primaryBranchPalace,
    bodyBranchPalace,

    /**
     * 原生主星地支盘
     */
    branchPalaces,

    /**
     * 动态宫位映射
     *
     * 这是当前盘真正的：
     * - 地支 -> 宫名
     * - 宫名 -> 地支
     */
    branchToSectorMap,
    sectorToBranchMap,

    /**
     * 借宫信息（业务层）
     */
    borrowedPalaces,

    /**
     * 业务宫位盘
     */
    sectors,

    /**
     * 当前命宫所属业务宫位
     */
    primarySector,

    /**
     * support / 三方四正信息
     */
    supportSectors,
    supportBranchPalaces,
    supportStars,

    /**
     * 兼容旧字段
     *
     * 当前先让它等于 supportStars
     */
    supportSymbols: [...supportStars],

    /**
     * 命宫原生主星
     */
    primaryStars,

    /**
     * 命宫是否为空宫
     */
    isEmptyPrimary,

    /**
     * 对宫相关字段
     */
    oppositeSector,
    oppositeBranchPalace,
    borrowedStars,

    /**
     * 业务层空宫数
     */
    emptySectorCount
  }
}