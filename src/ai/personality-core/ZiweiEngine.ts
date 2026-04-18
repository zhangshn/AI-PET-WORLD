/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - ZiweiEngine
 * ======================================================
 *
 * 【文件职责】
 * 这是“正式版紫微排盘引擎”的核心文件。
 *
 * 它负责：
 * 1. 根据 LunarBirthInfo 计算命宫 / 身宫
 * 2. 计算 12 宫在地支坐标系中的分布
 * 3. 根据年干 + 命宫干支 + 纳音，计算五行局
 * 4. 根据 农历生日 + 五行局 计算紫微星位置
 * 5. 由紫微星联动安放紫微星系
 * 6. 由天府星联动安放天府星系
 * 7. 统计空宫
 * 8. 为空宫生成借星记录（借对宫，权重 0.65）
 * 9. 输出 ZiweiEngineResult
 *
 * ------------------------------------------------------
 * 【重要说明】
 * 这版不是你当前 calculator.ts 中的“固定顺序 14 主星简化排法”，
 * 而是按你刚刚给出的“正式 ZiweiEngine 数学架构”来实现。
 *
 * ------------------------------------------------------
 * 【坐标系】
 * 本文件严格使用你给出的“紫微公式坐标系”：
 *
 * 寅=0, 卯=1, 辰=2, 巳=3, 午=4, 未=5,
 * 申=6, 酉=7, 戌=8, 亥=9, 子=10, 丑=11
 *
 * 这和你当前 calculator.ts 里使用的 zi->chou 顺序不同，
 * 所以这里会单独维护自己的公式坐标数组。
 * ======================================================
 */

import type {
  BranchPalace,
  BranchPalaceStars,
  BorrowedPalaceInfo,
  ElementGate,
  HeavenlyStem,
  LunarBirthInfo,
  StarId,
  ZiweiEngineResult
} from "./schema"

/**
 * ======================================================
 * 紫微公式坐标系：寅为 0
 * ======================================================
 *
 * 这是你提供的正式公式坐标系，所有核心计算都以它为准。
 */
const FORMULA_BRANCH_ORDER: BranchPalace[] = [
  "yin",  // 0
  "mao",  // 1
  "chen", // 2
  "si",   // 3
  "wu",   // 4
  "wei",  // 5
  "shen", // 6
  "you",  // 7
  "xu",   // 8
  "hai",  // 9
  "zi",   // 10
  "chou"  // 11
]

/**
 * ======================================================
 * 天干顺序
 * ======================================================
 */
const HEAVENLY_STEMS: HeavenlyStem[] = [
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

/**
 * ======================================================
 * 12 宫业务顺序（紫微十二宫）
 * ======================================================
 *
 * 索引说明：
 * 0: 命宫
 * 1: 兄弟
 * 2: 夫妻
 * 3: 子女
 * 4: 财帛
 * 5: 疾厄
 * 6: 迁移
 * 7: 交友
 * 8: 官禄
 * 9: 田宅
 * 10: 福德
 * 11: 父母
 *
 * 这个顺序只是为了说明 palaceSequence 的业务含义，
 * ZiweiEngineResult 里存的是对应的 BranchPalace[]。
 */
export const PALACE_ROLE_ORDER = [
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
] as const

/**
 * ======================================================
 * 星曜 ID 常量映射
 * ======================================================
 *
 * 当前只放 14 主星。
 */
const STAR = {
  ziwei: "star_01",   // 紫微
  tanlang: "star_02", // 贪狼
  jumen: "star_03",   // 巨门
  lianzhen: "star_04",// 廉贞
  wuqu: "star_05",    // 武曲
  pojun: "star_06",   // 破军
  tianfu: "star_07",  // 天府
  tianji: "star_08",  // 天机
  tianxiang: "star_09",// 天相
  tianliang: "star_10",// 天梁
  tiantong: "star_11", // 天同
  qisha: "star_12",    // 七杀
  taiyang: "star_13",  // 太阳
  taiyin: "star_14"    // 太阴
} satisfies Record<string, StarId>

/**
 * ======================================================
 * 工具：安全取模
 * ======================================================
 *
 * 确保索引始终落在 0~11 之间。
 */
function mod12(n: number): number {
  return ((n % 12) + 12) % 12
}

/**
 * ======================================================
 * 工具：安全取模（10）
 * ======================================================
 *
 * 天干是 10 轮循环。
 */
function mod10(n: number): number {
  return ((n % 10) + 10) % 10
}

/**
 * ======================================================
 * 根据 BranchPalace 获取公式坐标索引
 * ======================================================
 *
 * 公式坐标系：
 * 寅=0 ... 丑=11
 */
function getFormulaBranchIndex(branch: BranchPalace): number {
  const index = FORMULA_BRANCH_ORDER.indexOf(branch)

  if (index === -1) {
    throw new Error(`未知地支宫位: ${branch}`)
  }

  return index
}

/**
 * ======================================================
 * 根据公式坐标索引获取 BranchPalace
 * ======================================================
 */
function getBranchByFormulaIndex(index: number): BranchPalace {
  return FORMULA_BRANCH_ORDER[mod12(index)]
}

/**
 * ======================================================
 * 创建空的地支星曜盘
 * ======================================================
 *
 * 输出结构：
 * {
 *   yin: [],
 *   mao: [],
 *   ...
 *   chou: []
 * }
 */
function createEmptyBranchPalaces(): BranchPalaceStars {
  const palaces = {} as BranchPalaceStars

  FORMULA_BRANCH_ORDER.forEach((branch) => {
    palaces[branch] = []
  })

  return palaces
}

/**
 * ======================================================
 * 获取对宫
 * ======================================================
 *
 * 对宫 = 当前宫位索引 + 6
 */
export function getOppositePalace(branch: BranchPalace): BranchPalace {
  const index = getFormulaBranchIndex(branch)
  return getBranchByFormulaIndex(index + 6)
}

/**
 * ======================================================
 * Step 1：计算命宫 / 身宫
 * ======================================================
 *
 * 输入：
 * - lunarMonth: 农历月（1~12）
 * - timeBranch: 出生时辰地支
 *
 * 公式：
 * Life Palace:
 *   L = (M - 1 - (H - 10) + 12) mod 12
 *
 * Body Palace:
 *   B = (M - 1 + (H - 10)) mod 12
 *
 * 这里 H 使用的是“公式坐标索引”：
 * 寅=0 ... 亥=9 子=10 丑=11
 *
 * 为什么要用 H - 10？
 * 因为你给的公式以“子=10”为基准来做时辰偏移。
 */
export function calculateLifeAndBodyPalace(
  lunarMonth: number,
  timeBranch: BranchPalace
): {
  lifePalace: BranchPalace
  bodyPalace: BranchPalace
  lifeIndex: number
  bodyIndex: number
} {
  const H = getFormulaBranchIndex(timeBranch)
  const offsetFromZi = H - 10

  const L = mod12((lunarMonth - 1) - offsetFromZi)
  const B = mod12((lunarMonth - 1) + offsetFromZi)

  return {
    lifePalace: getBranchByFormulaIndex(L),
    bodyPalace: getBranchByFormulaIndex(B),
    lifeIndex: L,
    bodyIndex: B
  }
}

/**
 * ======================================================
 * Step 2：根据命宫生成十二宫分布序列
 * ======================================================
 *
 * 你给的公式：
 * P_i = (L - i + 12) mod 12
 *
 * 说明：
 * - 从命宫开始
 * - 按逆时针方向排列十二宫
 *
 * 返回结果：
 * palaceSequence[0] = 命宫所在地支
 * palaceSequence[1] = 兄弟宫所在地支
 * ...
 * palaceSequence[11] = 父母宫所在地支
 */
export function calculatePalaceSequence(
  lifePalace: BranchPalace
): BranchPalace[] {
  const L = getFormulaBranchIndex(lifePalace)

  return Array.from({ length: 12 }, (_, i) => {
    return getBranchByFormulaIndex(L - i)
  })
}

/**
 * ======================================================
 * Step 3：五虎遁起寅干
 * ======================================================
 *
 * 规则：
 * 甲己起丙寅
 * 乙庚起戊寅
 * 丙辛起庚寅
 * 丁壬起壬寅
 * 戊癸起甲寅
 *
 * 这是“根据年干推寅宫起干”的标准入口。
 *
 * 返回的是“寅宫”的天干。
 */
function getYinStartStemByYearStem(yearStem: HeavenlyStem): HeavenlyStem {
  switch (yearStem) {
    case "jia":
    case "ji":
      return "bing"

    case "yi":
    case "geng":
      return "wu"

    case "bing":
    case "xin":
      return "geng"

    case "ding":
    case "ren":
      return "ren"

    case "wu":
    case "gui":
      return "jia"

    default:
      throw new Error(`未知年干: ${yearStem}`)
  }
}

/**
 * ======================================================
 * Step 4：根据年干推出 12 地支宫位的天干
 * ======================================================
 *
 * 逻辑：
 * - 先算出寅宫起干
 * - 然后沿着公式地支顺序（寅 -> 卯 -> 辰 ... -> 丑）顺推
 * - 天干按 10 循环
 *
 * 返回：
 * Record<BranchPalace, HeavenlyStem>
 *
 * 例如：
 * {
 *   yin: "bing",
 *   mao: "ding",
 *   chen: "wu",
 *   ...
 * }
 */
export function buildPalaceStemMap(
  yearStem: HeavenlyStem
): Record<BranchPalace, HeavenlyStem> {
  const yinStartStem = getYinStartStemByYearStem(yearStem)
  const startStemIndex = HEAVENLY_STEMS.indexOf(yinStartStem)

  const result = {} as Record<BranchPalace, HeavenlyStem>

  FORMULA_BRANCH_ORDER.forEach((branch, formulaIndex) => {
    result[branch] = HEAVENLY_STEMS[mod10(startStemIndex + formulaIndex)]
  })

  return result
}

/**
 * ======================================================
 * Step 5：纳音 -> 五行局映射
 * ======================================================
 *
 * 这里不是直接用“年柱纳音”，
 * 而是用“命宫干支”对应的六十甲子纳音来确定五行局。
 *
 * 这是对你“根据命宫地支和年干查表”这一句的可编码实现。
 *
 * 每个干支组合会落入：
 * - water_2
 * - wood_3
 * - metal_4
 * - earth_5
 * - fire_6
 *
 * 只保留五行局结果，不保留纳音中文名。
 */
const NAYIN_ELEMENT_GATE_MAP: Record<string, ElementGate> = {
  // 海中金
  "jia-zi": "metal_4",
  "yi-chou": "metal_4",

  // 炉中火
  "bing-yin": "fire_6",
  "ding-mao": "fire_6",

  // 大林木
  "wu-chen": "wood_3",
  "ji-si": "wood_3",

  // 路旁土
  "geng-wu": "earth_5",
  "xin-wei": "earth_5",

  // 剑锋金
  "ren-shen": "metal_4",
  "gui-you": "metal_4",

  // 山头火
  "jia-xu": "fire_6",
  "yi-hai": "fire_6",

  // 涧下水
  "bing-zi": "water_2",
  "ding-chou": "water_2",

  // 城头土
  "wu-yin": "earth_5",
  "ji-mao": "earth_5",

  // 白蜡金
  "geng-chen": "metal_4",
  "xin-si": "metal_4",

  // 杨柳木
  "ren-wu": "wood_3",
  "gui-wei": "wood_3",

  // 泉中水
  "jia-shen": "water_2",
  "yi-you": "water_2",

  // 屋上土
  "bing-xu": "earth_5",
  "ding-hai": "earth_5",

  // 霹雳火
  "wu-zi": "fire_6",
  "ji-chou": "fire_6",

  // 松柏木
  "geng-yin": "wood_3",
  "xin-mao": "wood_3",

  // 长流水
  "ren-chen": "water_2",
  "gui-si": "water_2",

  // 砂石金
  "jia-wu": "metal_4",
  "yi-wei": "metal_4",

  // 山下火
  "bing-shen": "fire_6",
  "ding-you": "fire_6",

  // 平地木
  "wu-xu": "wood_3",
  "ji-hai": "wood_3",

  // 壁上土
  "geng-zi": "earth_5",
  "xin-chou": "earth_5",

  // 金箔金
  "ren-yin": "metal_4",
  "gui-mao": "metal_4",

  // 覆灯火
  "jia-chen": "fire_6",
  "yi-si": "fire_6",

  // 天河水
  "bing-wu": "water_2",
  "ding-wei": "water_2",

  // 大驿土
  "wu-shen": "earth_5",
  "ji-you": "earth_5",

  // 钗钏金
  "geng-xu": "metal_4",
  "xin-hai": "metal_4",

  // 桑柘木
  "ren-zi": "wood_3",
  "gui-chou": "wood_3",

  // 大溪水
  "jia-yin": "water_2",
  "yi-mao": "water_2",

  // 沙中土
  "bing-chen": "earth_5",
  "ding-si": "earth_5",

  // 天上火
  "wu-wu": "fire_6",
  "ji-wei": "fire_6",

  // 石榴木
  "geng-shen": "wood_3",
  "xin-you": "wood_3",

  // 大海水
  "ren-xu": "water_2",
  "gui-hai": "water_2"
}

/**
 * ======================================================
 * Step 6：根据命宫干支计算五行局
 * ======================================================
 *
 * 计算过程：
 * 1. 根据年干推出 12 地支宫位的天干
 * 2. 取命宫所在地支的天干
 * 3. 拼成“命宫干支”
 * 4. 查纳音 -> 五行局
 *
 * 返回：
 * - elementGate
 * - elementBase
 *
 * 例如：
 * - water_2 -> 2
 * - wood_3  -> 3
 * - metal_4 -> 4
 * - earth_5 -> 5
 * - fire_6  -> 6
 */
export function calculateElementGate(
  yearStem: HeavenlyStem,
  lifePalace: BranchPalace
): {
  elementGate: ElementGate
  elementBase: 2 | 3 | 4 | 5 | 6
  palaceStem: HeavenlyStem
} {
  const palaceStemMap = buildPalaceStemMap(yearStem)
  const palaceStem = palaceStemMap[lifePalace]
  const key = `${palaceStem}-${lifePalace}`

  const elementGate = NAYIN_ELEMENT_GATE_MAP[key]

  if (!elementGate) {
    throw new Error(`无法根据命宫干支计算五行局，缺少纳音映射: ${key}`)
  }

  const elementBaseMap: Record<ElementGate, 2 | 3 | 4 | 5 | 6> = {
    water_2: 2,
    wood_3: 3,
    metal_4: 4,
    earth_5: 5,
    fire_6: 6
  }

  return {
    elementGate,
    elementBase: elementBaseMap[elementGate],
    palaceStem
  }
}

/**
 * ======================================================
 * Step 7：计算紫微星位置
 * ======================================================
 *
 * 你给的公式：
 * 1. X = ceil(D / Base)
 * 2. Y = (Base * X) - D
 * 3. 若 Y 为偶数：Z = (X + Y) mod 12
 * 4. 若 Y 为奇数：Z = (X - Y + 12) mod 12
 *
 * 这里返回的是“公式坐标索引 Z”
 * 后续再转成 BranchPalace。
 *
 * 注意：
 * 这里严格按你给的公式来写。
 */
export function calculateZiweiIndex(
  lunarDay: number,
  elementBase: 2 | 3 | 4 | 5 | 6
): number {
  const X = Math.ceil(lunarDay / elementBase)
  const Y = (elementBase * X) - lunarDay

  if (Y % 2 === 0) {
    return mod12(X + Y)
  }

  return mod12(X - Y)
}

/**
 * ======================================================
 * Step 8：由紫微星位置联动安放紫微星系
 * ======================================================
 *
 * 规则（逆时针偏移）：
 * 紫微: Z
 * 天机: Z - 1
 * 太阳: Z - 3
 * 武曲: Z - 4
 * 天同: Z - 5
 * 廉贞: Z - 8
 *
 * 这里的输入 Z 为公式坐标索引。
 */
function placeZiweiSystemStars(
  nativeStars: BranchPalaceStars,
  ziweiIndex: number
): void {
  const placements: Array<{ starId: StarId; index: number }> = [
    { starId: STAR.ziwei, index: ziweiIndex },
    { starId: STAR.tianji, index: ziweiIndex - 1 },
    { starId: STAR.taiyang, index: ziweiIndex - 3 },
    { starId: STAR.wuqu, index: ziweiIndex - 4 },
    { starId: STAR.tiantong, index: ziweiIndex - 5 },
    { starId: STAR.lianzhen, index: ziweiIndex - 8 }
  ]

  placements.forEach(({ starId, index }) => {
    const palace = getBranchByFormulaIndex(index)
    nativeStars[palace].push(starId)
  })
}

/**
 * ======================================================
 * Step 9：由紫微星位置计算天府星位置
 * ======================================================
 *
 * 规则：
 * F = (12 - Z) mod 12
 *
 * 特殊点：
 * - 若 Z=0（寅）或 Z=6（申），会自动出现 Z=F
 * - 因为公式本身就满足这一点
 */
export function calculateTianfuIndex(ziweiIndex: number): number {
  return mod12(12 - ziweiIndex)
}

/**
 * ======================================================
 * Step 10：由天府星位置联动安放天府星系
 * ======================================================
 *
 * 规则（顺时针偏移）：
 * 天府: F
 * 太阴: F + 1
 * 贪狼: F + 2
 * 巨门: F + 3
 * 天相: F + 4
 * 天梁: F + 5
 * 七杀: F + 6
 * 破军: F + 10
 *
 * 这里的输入 F 为公式坐标索引。
 */
function placeTianfuSystemStars(
  nativeStars: BranchPalaceStars,
  tianfuIndex: number
): void {
  const placements: Array<{ starId: StarId; index: number }> = [
    { starId: STAR.tianfu, index: tianfuIndex },
    { starId: STAR.taiyin, index: tianfuIndex + 1 },
    { starId: STAR.tanlang, index: tianfuIndex + 2 },
    { starId: STAR.jumen, index: tianfuIndex + 3 },
    { starId: STAR.tianxiang, index: tianfuIndex + 4 },
    { starId: STAR.tianliang, index: tianfuIndex + 5 },
    { starId: STAR.qisha, index: tianfuIndex + 6 },
    { starId: STAR.pojun, index: tianfuIndex + 10 }
  ]

  placements.forEach(({ starId, index }) => {
    const palace = getBranchByFormulaIndex(index)
    nativeStars[palace].push(starId)
  })
}

/**
 * ======================================================
 * Step 11：统计原生空宫数量
 * ======================================================
 *
 * 注意：
 * 这里统计的是 nativeStars，不包含借星。
 */
function countEmptyNativePalaces(nativeStars: BranchPalaceStars): number {
  return FORMULA_BRANCH_ORDER.reduce((count, palace) => {
    return nativeStars[palace].length === 0 ? count + 1 : count
  }, 0)
}

/**
 * ======================================================
 * Step 12：为空宫生成借星记录
 * ======================================================
 *
 * 规则：
 * - 若宫位原生无主星
 * - 则借对宫主星
 * - 权重固定 0.65
 *
 * 注意：
 * 这里不把借星直接写回 nativeStars
 * 因为 nativeStars 代表“原生主星分布”
 * 借星单独放在 borrowedPalaces 中。
 */
function buildBorrowedPalaces(
  nativeStars: BranchPalaceStars
): BorrowedPalaceInfo[] {
  const borrowed: BorrowedPalaceInfo[] = []

  FORMULA_BRANCH_ORDER.forEach((palace) => {
    if (nativeStars[palace].length > 0) {
      return
    }

    const sourcePalace = getOppositePalace(palace)

    borrowed.push({
      palace,
      sourcePalace,
      borrowedStars: [...nativeStars[sourcePalace]],
      weight: 0.65
    })
  })

  return borrowed
}

/**
 * ======================================================
 * 调试辅助：获取某宫的中文摘要
 * ======================================================
 *
 * 这个函数不是必须，但开发时非常有用。
 */
export function describePalace(branch: BranchPalace): string {
  const labelMap: Record<BranchPalace, string> = {
    yin: "寅",
    mao: "卯",
    chen: "辰",
    si: "巳",
    wu: "午",
    wei: "未",
    shen: "申",
    you: "酉",
    xu: "戌",
    hai: "亥",
    zi: "子",
    chou: "丑"
  }

  return labelMap[branch]
}

/**
 * ======================================================
 * 调试辅助：获取五行局中文摘要
 * ======================================================
 */
export function describeElementGate(elementGate: ElementGate): string {
  const labelMap: Record<ElementGate, string> = {
    water_2: "水二局",
    wood_3: "木三局",
    metal_4: "金四局",
    earth_5: "土五局",
    fire_6: "火六局"
  }

  return labelMap[elementGate]
}

/**
 * ======================================================
 * 主函数：根据 LunarBirthInfo 计算 ZiweiEngineResult
 * ======================================================
 *
 * 输入：
 * - 已经完成阳历 -> 农历转换的 LunarBirthInfo
 *
 * 输出：
 * - ZiweiEngineResult
 *
 * 这是你后续 calculator.ts 应该消费的正式引擎入口。
 */
export function calculateZiweiEngine(
  lunarInfo: LunarBirthInfo
): ZiweiEngineResult {
  /**
   * ------------------------------------------------------
   * Step A：计算命宫 / 身宫
   * ------------------------------------------------------
   */
  const {
    lifePalace,
    bodyPalace
  } = calculateLifeAndBodyPalace(
    lunarInfo.lunarMonth,
    lunarInfo.timeBranch
  )

  /**
   * ------------------------------------------------------
   * Step B：生成十二宫分布
   * ------------------------------------------------------
   */
  const palaceSequence = calculatePalaceSequence(lifePalace)

  /**
   * ------------------------------------------------------
   * Step C：计算五行局
   * ------------------------------------------------------
   */
  const {
    elementGate,
    elementBase
  } = calculateElementGate(
    lunarInfo.yearStem,
    lifePalace
  )

  /**
   * ------------------------------------------------------
   * Step D：计算紫微 / 天府位置
   * ------------------------------------------------------
   */
  const ziweiIndex = calculateZiweiIndex(
    lunarInfo.lunarDay,
    elementBase
  )

  const tianfuIndex = calculateTianfuIndex(ziweiIndex)

  const ziweiStarPalace = getBranchByFormulaIndex(ziweiIndex)
  const tianfuStarPalace = getBranchByFormulaIndex(tianfuIndex)

  /**
   * ------------------------------------------------------
   * Step E：安放 14 主星
   * ------------------------------------------------------
   *
   * 先创建空盘，再分别安放紫微星系与天府星系。
   */
  const nativeStars = createEmptyBranchPalaces()

  placeZiweiSystemStars(nativeStars, ziweiIndex)
  placeTianfuSystemStars(nativeStars, tianfuIndex)

  /**
   * ------------------------------------------------------
   * Step F：统计空宫 & 生成借星记录
   * ------------------------------------------------------
   */
  const emptyPalaceCount = countEmptyNativePalaces(nativeStars)
  const borrowedPalaces = buildBorrowedPalaces(nativeStars)

  /**
   * ------------------------------------------------------
   * Step G：返回完整引擎结果
   * ------------------------------------------------------
   */
  return {
    lunarInfo,

    lifePalace,
    bodyPalace,

    palaceSequence,

    elementGate,
    elementBase,

    ziweiStarPalace,
    tianfuStarPalace,

    nativeStars,

    borrowedPalaces,

    emptyPalaceCount
  }
}