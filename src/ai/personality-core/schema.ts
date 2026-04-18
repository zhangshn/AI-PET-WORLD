/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Schema
 * ======================================================
 *
 * 【文件职责】
 * 本文件是整个人格核心系统的数据协议中心。
 *
 * 它的作用是：
 * 1. 定义出生输入的数据结构
 * 2. 定义农历转换后的中间结构
 * 3. 定义紫微排盘层的数据结构
 * 4. 定义业务适配层 BirthPattern
 * 5. 定义人格映射结果结构
 *
 * ------------------------------------------------------
 * 【当前系统分层】
 *
 * 一、输入层
 * - BirthInput
 *
 * 二、农历转换层
 * - LunarBirthInfo
 *
 * 三、紫微排盘层（更底层、偏原始）
 * - BranchPalace
 * - BranchPalaceStars
 * - ZiweiEngineResult
 *
 * 四、业务适配层（给 mapper / personality engine 用）
 * - BirthPattern
 *
 * 五、人格结果层
 * - CorePersonality
 * - PersonalityTraits
 * - PersonalityProfile
 *
 * ------------------------------------------------------
 * 【这次重构的重要原则】
 *
 * 现在系统已经从“旧 core_symbol 直推人格”
 * 逐步切换到：
 *
 * 1. 先在地支宫位层排盘
 * 2. 再映射到业务宫位层
 * 3. 再通过 starProfiles / pairProfiles 生成人格
 *
 * 所以：
 * - 地支层结构要保留
 * - 业务层结构也要保留
 * - engine 字段不应该再混成复杂对象
 *
 * ======================================================
 */

/**
 * ======================================================
 * 星曜 ID
 * ======================================================
 *
 * 说明：
 * - star_00 = 空位占位（工程用途）
 * - star_01 ~ star_14 = 当前项目使用的 14 主星
 *
 * 注意：
 * 当前版本主要围绕 14 主星做人格分析，
 * 后续如果要加入辅星、煞星、吉星，
 * 可以继续扩展这个联合类型。
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
 * 业务宫位名称（项目内部使用）
 * ======================================================
 *
 * 说明：
 * 这是 AI-PET-WORLD 当前用于产品逻辑的人格业务宫位。
 *
 * 它们不是传统紫微斗数术语本身，
 * 而是项目内部用于表达“生活、关系、事业、健康”等维度的业务抽象。
 *
 * 后续 mapper.ts、traits、summary 输出，
 * 主要消费的会是这层结构。
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
 * 地支宫位（紫微排盘原始层）
 * ======================================================
 *
 * 说明：
 * 这是紫微排盘真正的底层坐标系。
 *
 * 以后这些内容都应该优先在这个层级计算：
 * - 命宫
 * - 身宫
 * - 主星安放
 * - 对宫
 * - 三方四正
 * - 空宫
 * - 借宫
 *
 * 当前项目不再建议直接在 SectorName 层做排盘。
 * ======================================================
 */
export type BranchPalace =
  | "zi"
  | "chou"
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

/**
 * ======================================================
 * 十二时辰
 * ======================================================
 *
 * 当前项目里，时辰地支与地支宫位共用同一套字面量。
 *
 * 也就是说：
 * - 子时 = "zi"
 * - 丑时 = "chou"
 * - 寅时 = "yin"
 * ...
 *
 * 所以这里直接复用 BranchPalace。
 * ======================================================
 */
export type TimeBranch = BranchPalace

/**
 * ======================================================
 * 天干
 * ======================================================
 *
 * 用于：
 * - 农历出生信息中的年干
 * - 后续可能扩展五行局、命盘规则判断
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
 *
 * 当前保留这个结构，是为了兼容 / 预留正式紫微引擎层。
 *
 * 当前 calculator.ts 简化版未必全部用到，
 * 但 ZiweiEngineResult 层可以先保留。
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
 * 业务宫位内的星曜分布
 * ======================================================
 *
 * 结构示例：
 * {
 *   life: ["star_01", "star_02"],
 *   spouse: ["star_03"],
 *   ...
 * }
 * ======================================================
 */
export type SectorStars = Record<SectorName, StarId[]>

/**
 * ======================================================
 * 地支宫位内的星曜分布
 * ======================================================
 *
 * 结构示例：
 * {
 *   zi: ["star_03", "star_04"],
 *   chou: ["star_01", "star_02"],
 *   ...
 * }
 *
 * 这是排盘层最基础的盘面结构。
 * ======================================================
 */
export type BranchPalaceStars = Record<BranchPalace, StarId[]>

/**
 * ======================================================
 * 当前人格引擎名称
 * ======================================================
 *
 * 说明：
 * 这个字段是“当前 BirthPattern / PersonalityProfile
 * 使用的是哪一套人格推导引擎”。
 *
 * 它不是紫微排盘结果对象。
 *
 * 当前保留两类：
 * - legacy-core-symbol：旧版符号人格引擎
 * - star-pair-engine：新版 star + pair 人格引擎
 *
 * 后续如果升级版本，可以继续加：
 * - star-pair-v2
 * - star-pair-weighted
 * 等等
 * ======================================================
 */
export type PersonalityEngineName =
  | "legacy-core-symbol"
  | "star-pair-engine"

/**
 * ======================================================
 * 借宫信息（业务层使用）
 * ======================================================
 *
 * 说明：
 * 这是 BirthPattern 当前需要的“借宫记录”结构。
 *
 * targetPalace：
 * - 哪个宫位需要借星
 *
 * sourcePalace：
 * - 它借的是哪个来源宫位
 *
 * stars：
 * - 借来的星曜列表
 *
 * 这个结构更适合业务层和 mapper 层使用。
 * ======================================================
 */
export interface BorrowedPalace {
  targetPalace: BranchPalace
  sourcePalace: BranchPalace
  stars: StarId[]
}

/**
 * ======================================================
 * 借星信息（引擎层使用）
 * ======================================================
 *
 * 说明：
 * 这是更偏“排盘引擎层”的借星结构。
 *
 * 和 BorrowedPalace 的区别：
 * - 这个版本带 weight
 * - 字段命名更贴近排盘引擎内部逻辑
 *
 * 如果后面你正式做“空宫借对宫 / 借三方 / 借权重”，
 * 这个结构会很有用。
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
 * 外部输入：出生时间
 * ======================================================
 *
 * 说明：
 * - 正式环境：来自宠物诞生瞬间
 * - 测试页：来自开发者手动输入
 *
 * minute 为可选，是因为有些测试时只会输入到小时。
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
 *
 * 这是“阳历 -> 农历”转换后的标准结构。
 *
 * 它会被后续排盘逻辑使用。
 *
 * 字段说明：
 * - solarXxx：原始阳历时间
 * - lunarXxx：转换后的农历时间
 * - yearStem：年干
 * - timeBranch：时辰地支
 * - timeBranchIndex：内部时辰索引
 * - timeBranchNumber：命宫公式使用的时辰数
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

  /**
   * 年干
   */
  yearStem: HeavenlyStem

  /**
   * 时辰地支
   */
  timeBranch: TimeBranch

  /**
   * 时辰索引（系统内部索引）
   *
   * 当前项目里通常与 BRANCH_PALACE_ORDER 对齐：
   * zi=0, chou=1, yin=2 ... hai=11
   *
   * 注意：
   * 你之前旧逻辑里也出现过另一套注释顺序，
   * 所以后续请统一以实际 lunar.ts 返回值为准。
   */
  timeBranchIndex: number

  /**
   * 命宫公式里使用的时辰数
   *
   * 示例：
   * 子=1, 丑=2, 寅=3 ... 亥=12
   *
   * 这个字段主要是为了兼容你现在的公式层和调试展示层。
   */
  timeBranchNumber: number
}

/**
 * ======================================================
 * 紫微排盘引擎输出（底层原始结果）
 * ======================================================
 *
 * 说明：
 * 这是“更底层”的排盘引擎结果，不是最终业务输出。
 *
 * 它更适合：
 * - 做正式紫微引擎
 * - 做调试
 * - 做真实身宫 / 五行局 / 借宫运算
 *
 * 当前项目即使暂时没完全启用，也建议保留这个接口。
 * ======================================================
 */
export interface ZiweiEngineResult {
  /**
   * 农历基础信息
   */
  lunarInfo: LunarBirthInfo

  /**
   * 命宫 / 身宫（地支层）
   */
  lifePalace: BranchPalace
  bodyPalace: BranchPalace

  /**
   * 十二业务宫位在地支坐标系上的分布序列
   *
   * 例如：
   * 索引 0 代表命宫
   * 索引 1 代表兄弟
   * 索引 2 代表夫妻
   * ...
   *
   * 这个字段主要用于正式紫微引擎做结构追踪。
   */
  palaceSequence: BranchPalace[]

  /**
   * 五行局
   */
  elementGate: ElementGate
  elementBase: 2 | 3 | 4 | 5 | 6

  /**
   * 紫微星 / 天府星的定位
   *
   * 这些字段在正式紫微推演里会很重要。
   */
  ziweiStarPalace: BranchPalace
  tianfuStarPalace: BranchPalace

  /**
   * 原生主星分布（不含借星）
   */
  nativeStars: BranchPalaceStars

  /**
   * 借星信息（引擎层）
   */
  borrowedPalaces: BorrowedPalaceInfo[]

  /**
   * 空宫数量（按原生主星统计）
   */
  emptyPalaceCount: number
}

/**
 * ======================================================
 * 紫微核心 5 维人格
 * ======================================================
 *
 * 这是你的人格中间层抽象。
 *
 * 后续 traits 层可以由这个层再映射出来。
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
 * 行为层 9 维 traits
 * ======================================================
 *
 * 这是更贴近产品行为表达的一层。
 *
 * 例如：
 * - 活跃度
 * - 作息偏好
 * - 食欲
 * - 纪律性
 * - 情绪敏感度
 * - 建造偏好
 *
 * 保留 [key: string]: number
 * 是为了以后继续动态加维度。
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
 *
 * 说明：
 * 这是新版 star + pair 系统里非常重要的结构。
 *
 * pairId：
 * - 组合唯一 ID
 *
 * starIds：
 * - 命中的两颗星
 *
 * pairLabel：
 * - 这个双星组合对应的标签 / 名称
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
 * 说明：
 * 这是 calculator.ts 的标准输出结构。
 *
 * 它是：
 * - 排盘层结果
 * - 业务适配层结果
 * - mapper.ts 输入
 *
 * 当前最重要的一点：
 * engine 不再是 ZiweiEngineResult
 * 而是“当前人格引擎名称”。
 *
 * 因为：
 * - ZiweiEngineResult 是底层排盘对象
 * - engine 是人格计算引擎标识
 *
 * 这两个概念不能混在一起。
 * ======================================================
 */
export interface BirthPattern {
  /**
   * 出生盘唯一键
   *
   * 用于：
   * - 缓存
   * - 调试
   * - 唯一标识当前出生盘
   */
  birthKey: string

  /**
   * 农历出生信息
   */
  lunarInfo: LunarBirthInfo

  /**
   * 时辰地支
   *
   * 这里保留一份快捷字段，
   * 方便上层消费，不必每次都从 lunarInfo 里取。
   */
  timeBranch: TimeBranch

  /**
   * 当前人格引擎名称
   *
   * 注意：
   * 这不是引擎结果对象，
   * 而是一个“标识当前使用哪套人格推导逻辑”的字符串枚举。
   */
  engine: PersonalityEngineName

  /**
   * 命宫 / 身宫（地支层）
   */
  primaryBranchPalace: BranchPalace
  bodyBranchPalace: BranchPalace

  /**
   * 原生主星盘（地支宫位层）
   */
  branchPalaces: BranchPalaceStars

  /**
   * 借宫信息（业务层）
   *
   * 当前 calculator.ts 可以先简单返回：
   * - 命宫空 -> 借对宫
   * - 命宫不空 -> []
   *
   * 后续可以扩展成完整借宫体系。
   */
  borrowedPalaces: BorrowedPalace[]

  /**
   * 映射后的业务宫位盘
   */
  sectors: SectorStars

  /**
   * 当前项目内部定义的“命宫”
   */
  primarySector: SectorName

  /**
   * 三方四正 / support 联动宫位
   */
  supportSectors: SectorName[]
  supportBranchPalaces: BranchPalace[]
  supportStars: StarId[]

  /**
   * 兼容旧字段
   *
   * 当前先让 supportSymbols = supportStars
   * 方便旧代码继续运行。
   *
   * 后续如果彻底移除旧 symbol 兼容层，
   * 可以考虑删除它。
   */
  supportSymbols: StarId[]

  /**
   * 命宫上的原生主星
   */
  primaryStars: StarId[]

  /**
   * 当前命宫是否为空宫
   */
  isEmptyPrimary: boolean

  /**
   * 对宫信息
   */
  oppositeSector: SectorName
  oppositeBranchPalace: BranchPalace

  /**
   * 当前简化借星字段
   *
   * 一般直接取对宫原生主星，
   * 作为命宫可参考的 borrowedStars。
   */
  borrowedStars: StarId[]

  /**
   * 空宫数量
   *
   * 当前通常按业务宫位 sectors 统计。
   */
  emptySectorCount: number
}

/**
 * ======================================================
 * 最终人格档案
 * ======================================================
 *
 * 这是对外最终输出结构。
 *
 * 包含：
 * - 原始盘面 pattern
 * - 核心人格
 * - traits
 * - summaries
 * - tags
 * - debug 调试信息
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
 *
 * 有些旧文件可能还在用 PersonalityResult，
 * 所以这里继续做一层别名兼容。
 * ======================================================
 */
export type PersonalityResult = PersonalityProfile