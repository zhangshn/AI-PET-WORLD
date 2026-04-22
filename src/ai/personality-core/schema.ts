/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Schema
 * ======================================================
 *
 * 【文件职责】
 * 这是整个人格核心系统的数据协议中心。
 *
 * 它负责定义：
 * 1. 外部输入层（BirthInput）
 * 2. 农历转换层（LunarBirthInfo）
 * 3. 紫微排盘引擎层（ZiweiEngineResult）
 * 4. 业务适配层（BirthPattern）
 * 5. 人格中间层（CorePersonality / PersonalityTraits）
 * 6. 最终输出层（PersonalityProfile）
 *
 * ------------------------------------------------------
 * 【当前系统分层】
 *
 * 一、输入层
 *   BirthInput
 *
 * 二、农历转换层
 *   LunarBirthInfo
 *
 * 三、紫微排盘层
 *   ZiweiEngineResult
 *
 * 四、业务适配层
 *   BirthPattern
 *
 * 五、人格输出层
 *   PersonalityProfile
 *
 * ------------------------------------------------------
 * 【这次 schema 重构的关键点】
 *
 * 1. 正式区分“排盘层”和“业务层”
 *    - ZiweiEngineResult 是底层排盘结果
 *    - BirthPattern 是给 mapper / UI / 业务逻辑使用的适配结果
 *
 * 2. 引入动态宫位映射
 *    - branchToSectorMap：地支槽位 -> 当前宫名
 *    - sectorToBranchMap：当前宫名 -> 当前落在哪个地支槽位
 *
 * 3. BirthPattern.engine 不再存整个排盘对象
 *    - 它表示“当前人格引擎名称”
 *    - 不是 ZiweiEngineResult
 * ======================================================
 */

/**
 * ======================================================
 * 星曜 ID
 * ======================================================
 *
 * 说明：
 * - star_00：空位工程占位
 * - star_01 ~ star_14：当前项目使用的 14 主星
 * ======================================================
 */
export type StarId =
  | "star_00"
  | "star_01" // 紫微
  | "star_02" // 贪狼
  | "star_03" // 巨门
  | "star_04" // 廉贞
  | "star_05" // 武曲
  | "star_06" // 破军
  | "star_07" // 天府
  | "star_08" // 天机
  | "star_09" // 天相
  | "star_10" // 天梁
  | "star_11" // 天同
  | "star_12" // 七杀
  | "star_13" // 太阳
  | "star_14" // 太阴

/**
 * ======================================================
 * 业务宫位名称
 * ======================================================
 */
export type SectorName =
  | "life"
  | "siblings"
  | "spouse"
  | "children"
  | "wealth"
  | "health"
  | "travel"
  | "friends"
  | "career"
  | "property"
  | "fortune"
  | "parents"

/**
 * ======================================================
 * 地支宫位（排盘底层）
 * ======================================================
 */
export type BranchPalace =
  | "yin"
  | "mao"
  | "chen"
  | "si"
  | "wu"
  | "wei"
  | "shen"
  | "you"
  | "xu"
  | "hai"
  | "zi"
  | "chou"

/**
 * ======================================================
 * 十二时辰
 * ======================================================
 */
export type TimeBranch = BranchPalace

/**
 * ======================================================
 * 天干
 * ======================================================
 */
export type HeavenlyStem =
  | "jia"
  | "yi"
  | "bing"
  | "ding"
  | "wu"
  | "ji"
  | "geng"
  | "xin"
  | "ren"
  | "gui"

/**
 * ======================================================
 * 五行局
 * ======================================================
 */
export type ElementGate =
  | "water_2"
  | "wood_3"
  | "metal_4"
  | "earth_5"
  | "fire_6"

/**
 * ======================================================
 * 业务宫位内星曜分布
 * ======================================================
 */
export type SectorStars = Record<SectorName, StarId[]>

/**
 * ======================================================
 * 地支宫位内星曜分布
 * ======================================================
 */
export type BranchPalaceStars = Record<BranchPalace, StarId[]>

/**
 * ======================================================
 * 人格引擎名称
 * ======================================================
 */
export type PersonalityEngineName =
  | "legacy-core-symbol"
  | "star-pair-engine"

/**
 * ======================================================
 * 引擎层借宫信息
 * ======================================================
 */
export interface BorrowedPalaceInfo {
  palace: BranchPalace
  sourcePalace: BranchPalace
  borrowedStars: StarId[]
  weight: number
}

/**
 * ======================================================
 * 业务层借宫信息
 * ======================================================
 */
export interface BorrowedPalace {
  targetPalace: BranchPalace
  sourcePalace: BranchPalace
  stars: StarId[]
}

/**
 * ======================================================
 * 外部输入
 * ======================================================
 */
export interface BirthInput {
  year: number
  month: number
  day: number
  hour: number
  minute?: number
}

/**
 * ======================================================
 * 农历出生信息
 * ======================================================
 */
export interface LunarBirthInfo {
  solarYear: number
  solarMonth: number
  solarDay: number
  solarHour: number
  solarMinute: number

  lunarYear: number
  lunarMonth: number
  lunarDay: number

  yearStem: HeavenlyStem
  timeBranch: TimeBranch

  /**
   * 业务顺序索引：
   * 子=1，丑=2 ... 亥=12
   */
  timeBranchIndex: number

  /**
   * 口诀时辰编号：
   * 子=1，丑=2，寅=3 ... 亥=12
   */
  timeBranchNumber: number

  /**
   * 紫微公式索引：
   * 寅=0，卯=1，辰=2，巳=3，午=4，未=5，
   * 申=6，酉=7，戌=8，亥=9，子=10，丑=11
   */
  formulaTimeIndex: number
}

/**
 * ======================================================
 * 紫微排盘引擎输出
 * ======================================================
 */
export interface ZiweiEngineResult {
  lunarInfo: LunarBirthInfo

  lifePalace: BranchPalace
  bodyPalace: BranchPalace

  /**
   * palaceSequence[0] = 命宫所在的地支
   * palaceSequence[1] = 兄弟宫所在的地支
   * ...
   * palaceSequence[11] = 父母宫所在的地支
   */
  palaceSequence: BranchPalace[]

  elementGate: ElementGate
  elementBase: 2 | 3 | 4 | 5 | 6

  ziweiStarPalace: BranchPalace
  tianfuStarPalace: BranchPalace

  nativeStars: BranchPalaceStars
  borrowedPalaces: BorrowedPalaceInfo[]
  emptyPalaceCount: number
}

/**
 * ======================================================
 * 紫微核心 5 维人格
 * ======================================================
 */
export interface CorePersonality {
  activity: number
  curiosity: number
  dependency: number
  confidence: number
  sensitivity: number
}

/**
 * ======================================================
 * 行为层 traits
 * ======================================================
 */
export interface PersonalityTraits {
  activity: number
  restPreference: number
  appetite: number
  discipline: number
  curiosity: number
  emotionalSensitivity: number
  stability: number
  caregiving: number
  buildingPreference: number
  [key: string]: number
}

/**
 * ======================================================
 * 命中的双星组合结果
 * ======================================================
 */
export interface MatchedPairResult {
  pairId: string
  starIds: [StarId, StarId]
  pairLabel: string
}

/**
 * ======================================================
 * BirthPattern
 * ======================================================
 *
 * 这是 calculator.ts 输出给 UI / mapper 的业务层结构。
 * ======================================================
 */
export interface BirthPattern {
  birthKey: string

  lunarInfo: LunarBirthInfo
  timeBranch: TimeBranch

  /**
   * 当前人格引擎名称
   */
  engine: PersonalityEngineName

  /**
   * 命宫 / 身宫（地支层）
   */
  primaryBranchPalace: BranchPalace
  bodyBranchPalace: BranchPalace

  /**
   * 原生主星地支盘
   */
  branchPalaces: BranchPalaceStars

  /**
   * 动态宫位映射：
   * 当前这张盘里，某个地支槽位对应哪个宫名
   */
  branchToSectorMap: Record<BranchPalace, SectorName>

  /**
   * 动态宫位映射：
   * 当前这张盘里，某个宫名落在哪个地支槽位
   */
  sectorToBranchMap: Record<SectorName, BranchPalace>

  /**
   * 借宫信息（业务层）
   */
  borrowedPalaces: BorrowedPalace[]

  /**
   * 业务宫位盘
   */
  sectors: SectorStars

  /**
   * 当前命宫对应的业务宫位
   */
  primarySector: SectorName

  /**
   * support 信息
   */
  supportSectors: SectorName[]
  supportBranchPalaces: BranchPalace[]
  supportStars: StarId[]
  supportSymbols: StarId[]

  /**
   * 命宫原生主星
   */
  primaryStars: StarId[]

  /**
   * 命宫是否为空宫
   */
  isEmptyPrimary: boolean

  /**
   * 对宫信息
   */
  oppositeSector: SectorName
  oppositeBranchPalace: BranchPalace
  borrowedStars: StarId[]

  /**
   * 业务层空宫数量
   */
  emptySectorCount: number
}

/**
 * ======================================================
 * 最终人格档案
 * ======================================================
 */
export interface PersonalityProfile {
  pattern: BirthPattern
  corePersonality: CorePersonality
  traits: PersonalityTraits
  summaries: string[]
  tags: string[]
  debug?: {
    primarySector: SectorName
    primaryStars: StarId[]
    supportSectors: SectorName[]
    supportStars: StarId[]
    borrowedStars: StarId[]
    isEmptyPrimary: boolean
    hitPairs: MatchedPairResult[]
    supportPairs: MatchedPairResult[]
  }
}

/**
 * ======================================================
 * 兼容旧命名
 * ======================================================
 */
export type PersonalityResult = PersonalityProfile