/**
 * 当前文件负责：定义 ziwei-core 的核心数据结构。
 */

export type StarId =
  | "star_00"
  | "star_01"
  | "star_02"
  | "star_03"
  | "star_04"
  | "star_05"
  | "star_06"
  | "star_07"
  | "star_08"
  | "star_09"
  | "star_10"
  | "star_11"
  | "star_12"
  | "star_13"
  | "star_14"

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

export type TimeBranch = BranchPalace

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

export type ElementGate =
  | "water_2"
  | "wood_3"
  | "metal_4"
  | "earth_5"
  | "fire_6"

export type SectorStars = Record<SectorName, StarId[]>

export type BranchPalaceStars = Record<BranchPalace, StarId[]>

export type PersonalityEngineName =
  | "legacy-core-symbol"
  | "star-pair-engine"

export interface BorrowedPalaceInfo {
  palace: BranchPalace
  sourcePalace: BranchPalace
  borrowedStars: StarId[]
  weight: number
}

export interface BorrowedPalace {
  targetPalace: BranchPalace
  sourcePalace: BranchPalace
  stars: StarId[]
}

export interface BirthInput {
  year: number
  month: number
  day: number
  hour: number
  minute?: number
}

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

export interface ZiweiEngineResult {
  lunarInfo: LunarBirthInfo

  lifePalace: BranchPalace
  bodyPalace: BranchPalace

  /**
   * palaceSequence[0] = 命宫所在的地支
   * palaceSequence[1] = 兄弟宫所在的地支
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

export interface CorePersonality {
  activity: number
  curiosity: number
  dependency: number
  confidence: number
  sensitivity: number
}

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

export interface MatchedPairResult {
  pairId: string
  starIds: [StarId, StarId]
  pairLabel: string
}

export interface BirthPattern {
  birthKey: string

  lunarInfo: LunarBirthInfo
  timeBranch: TimeBranch

  /**
   * 当前人格引擎名称。
   */
  engine: PersonalityEngineName

  /**
   * 命宫 / 身宫。
   */
  primaryBranchPalace: BranchPalace
  bodyBranchPalace: BranchPalace

  /**
   * 五行局信息。
   *
   * elementGate 用于动态运势模块计算起运岁数。
   * elementBase 是五行局数值。
   */
  elementGate: ElementGate
  elementBase: 2 | 3 | 4 | 5 | 6

  /**
   * 原生主星地支盘。
   */
  branchPalaces: BranchPalaceStars

  /**
   * 地支槽位 -> 当前宫名。
   */
  branchToSectorMap: Record<BranchPalace, SectorName>

  /**
   * 当前宫名 -> 地支槽位。
   */
  sectorToBranchMap: Record<SectorName, BranchPalace>

  /**
   * 借宫信息。
   */
  borrowedPalaces: BorrowedPalace[]

  /**
   * 业务宫位盘。
   */
  sectors: SectorStars

  /**
   * 当前命宫对应的业务宫位。
   */
  primarySector: SectorName

  /**
   * support 信息。
   */
  supportSectors: SectorName[]
  supportBranchPalaces: BranchPalace[]
  supportStars: StarId[]
  supportSymbols: StarId[]

  /**
   * 命宫原生主星。
   */
  primaryStars: StarId[]

  /**
   * 命宫是否为空宫。
   */
  isEmptyPrimary: boolean

  /**
   * 对宫信息。
   */
  oppositeSector: SectorName
  oppositeBranchPalace: BranchPalace
  borrowedStars: StarId[]

  /**
   * 业务层空宫数量。
   */
  emptySectorCount: number
}

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

export type PersonalityResult = PersonalityProfile