/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Ziwei Engine
 * ======================================================
 *
 * 【文件定位】
 * 这是正式排盘引擎文件。
 *
 * 它只负责：
 * 1. 使用固定地支物理索引（0=寅 ... 11=丑）
 * 2. 计算命宫 / 身宫
 * 3. 根据命宫逆排十二宫
 * 4. 根据命宫干支计算五行局
 * 5. 计算紫微星位置
 * 6. 计算天府星位置
 * 7. 安放 14 主星
 * 8. 统计空宫
 * 9. 生成借星记录
 *
 * ------------------------------------------------------
 * 【核心原则】
 * 1. 地支物理位置固定，不旋转
 * 2. 宫位名称（命、兄、妻、子...）才会旋转
 * 3. 星曜落点先落在“地支索引”上
 * 4. 宫名和地支的对应关系由命宫决定
 *
 * ------------------------------------------------------
 * 【固定地支物理索引】
 * 0: 寅
 * 1: 卯
 * 2: 辰
 * 3: 巳
 * 4: 午
 * 5: 未
 * 6: 申
 * 7: 酉
 * 8: 戌
 * 9: 亥
 * 10: 子
 * 11: 丑
 *
 * ------------------------------------------------------
 * 【当前算法版本】
 * 命宫公式：
 *   L = (Month - Hour) mod 12
 *
 * 其中：
 * - Month 使用农历月 1~12
 * - Hour 使用时辰编号 1~12（子=1 ... 亥=12）
 *
 * 为了避免 1 基 / 0 基混乱，程序内部统一先转成 0 基：
 * - monthIndex = lunarMonth - 1
 * - hourIndex = timeBranchNumber - 1
 *
 * 则：
 *   L = (monthIndex - hourIndex + 12) mod 12
 *
 * 身宫：
 *   B = (monthIndex + hourIndex) mod 12
 *
 * 十二宫：
 *   PalaceZhi[i] = (L - i + 12) mod 12
 *
 * 这样天然满足：
 * - 命宫 = i=0
 * - 迁移 = i=6
 * - 命迁必对宫
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
 * 固定地支物理顺序（寅起 0）
 * ======================================================
 */
const PHYSICAL_BRANCH_ORDER: BranchPalace[] = [
  "yin",   // 0
  "mao",   // 1
  "chen",  // 2
  "si",    // 3
  "wu",    // 4
  "wei",   // 5
  "shen",  // 6
  "you",   // 7
  "xu",    // 8
  "hai",   // 9
  "zi",    // 10
  "chou"   // 11
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
 * 14 主星 ID 映射
 * ======================================================
 */
const STAR = {
  ziwei: "star_01",     // 紫微
  tanlang: "star_02",   // 贪狼
  jumen: "star_03",     // 巨门
  lianzhen: "star_04",  // 廉贞
  wuqu: "star_05",      // 武曲
  pojun: "star_06",     // 破军
  tianfu: "star_07",    // 天府
  tianji: "star_08",    // 天机
  tianxiang: "star_09", // 天相
  tianliang: "star_10", // 天梁
  tiantong: "star_11",  // 天同
  qisha: "star_12",     // 七杀
  taiyang: "star_13",   // 太阳
  taiyin: "star_14"     // 太阴
} satisfies Record<string, StarId>

/**
 * ======================================================
 * 纳音 -> 五行局映射表
 * ======================================================
 */
const NAYIN_ELEMENT_GATE_MAP: Record<string, ElementGate> = {
  "jia-zi": "metal_4",
  "yi-chou": "metal_4",

  "bing-yin": "fire_6",
  "ding-mao": "fire_6",

  "wu-chen": "wood_3",
  "ji-si": "wood_3",

  "geng-wu": "earth_5",
  "xin-wei": "earth_5",

  "ren-shen": "metal_4",
  "gui-you": "metal_4",

  "jia-xu": "fire_6",
  "yi-hai": "fire_6",

  "bing-zi": "water_2",
  "ding-chou": "water_2",

  "wu-yin": "earth_5",
  "ji-mao": "earth_5",

  "geng-chen": "metal_4",
  "xin-si": "metal_4",

  "ren-wu": "wood_3",
  "gui-wei": "wood_3",

  "jia-shen": "water_2",
  "yi-you": "water_2",

  "bing-xu": "earth_5",
  "ding-hai": "earth_5",

  "wu-zi": "fire_6",
  "ji-chou": "fire_6",

  "geng-yin": "wood_3",
  "xin-mao": "wood_3",

  "ren-chen": "water_2",
  "gui-si": "water_2",

  "jia-wu": "metal_4",
  "yi-wei": "metal_4",

  "bing-shen": "fire_6",
  "ding-you": "fire_6",

  "wu-xu": "wood_3",
  "ji-hai": "wood_3",

  "geng-zi": "earth_5",
  "xin-chou": "earth_5",

  "ren-yin": "metal_4",
  "gui-mao": "metal_4",

  "jia-chen": "fire_6",
  "yi-si": "fire_6",

  "bing-wu": "water_2",
  "ding-wei": "water_2",

  "wu-shen": "earth_5",
  "ji-you": "earth_5",

  "geng-xu": "metal_4",
  "xin-hai": "metal_4",

  "ren-zi": "wood_3",
  "gui-chou": "wood_3",

  "jia-yin": "water_2",
  "yi-mao": "water_2",

  "bing-chen": "earth_5",
  "ding-si": "earth_5",

  "wu-wu": "fire_6",
  "ji-wei": "fire_6",

  "geng-shen": "wood_3",
  "xin-you": "wood_3",

  "ren-xu": "water_2",
  "gui-hai": "water_2"
}

/**
 * ======================================================
 * 安全取模（12）
 * ======================================================
 */
function mod12(n: number): number {
  return ((n % 12) + 12) % 12
}

/**
 * ======================================================
 * 安全取模（10）
 * ======================================================
 */
function mod10(n: number): number {
  return ((n % 10) + 10) % 10
}

/**
 * ======================================================
 * 地支 -> 物理索引
 * ======================================================
 */
function getBranchIndex(branch: BranchPalace): number {
  const index = PHYSICAL_BRANCH_ORDER.indexOf(branch)

  if (index === -1) {
    throw new Error(`未知地支宫位: ${branch}`)
  }

  return index
}

/**
 * ======================================================
 * 物理索引 -> 地支
 * ======================================================
 */
function getBranchByIndex(index: number): BranchPalace {
  return PHYSICAL_BRANCH_ORDER[mod12(index)]
}

/**
 * ======================================================
 * 创建空地支主星盘
 * ======================================================
 */
function createEmptyBranchPalaces(): BranchPalaceStars {
  const palaces = {} as BranchPalaceStars

  PHYSICAL_BRANCH_ORDER.forEach((branch) => {
    palaces[branch] = []
  })

  return palaces
}

/**
 * ======================================================
 * 对宫
 * ======================================================
 *
 * 对宫 = 当前索引 + 6
 * ======================================================
 */
export function getOppositePalace(branch: BranchPalace): BranchPalace {
  return getBranchByIndex(getBranchIndex(branch) + 6)
}

/**
 * ======================================================
 * 计算命宫 / 身宫
 * ======================================================
 *
 * 输入：
 * - lunarMonth：农历月（1~12）
 * - timeBranchNumber：子=1，丑=2 ... 亥=12
 *
 * 处理方式：
 * - 先统一转成 0 基索引
 * - monthIndex = lunarMonth - 1
 * - hourIndex = timeBranchNumber - 1
 *
 * 命宫：
 *   L = (monthIndex - hourIndex + 12) mod 12
 *
 * 身宫：
 *   B = (monthIndex + hourIndex) mod 12
 *
 * 返回：
 * - lifePalace：命宫地支
 * - bodyPalace：身宫地支
 * - lifeIndex：命宫物理索引
 * - bodyIndex：身宫物理索引
 * ======================================================
 */
export function calculateLifeAndBodyPalace(
  lunarMonth: number,
  timeBranchNumber: number
): {
  lifePalace: BranchPalace
  bodyPalace: BranchPalace
  lifeIndex: number
  bodyIndex: number
} {
  const monthIndex = lunarMonth - 1
  const hourIndex = timeBranchNumber - 1

  const lifeIndex = mod12(monthIndex - hourIndex)
  const bodyIndex = mod12(monthIndex + hourIndex)

  return {
    lifePalace: getBranchByIndex(lifeIndex),
    bodyPalace: getBranchByIndex(bodyIndex),
    lifeIndex,
    bodyIndex
  }
}

/**
 * ======================================================
 * 根据命宫逆排十二宫
 * ======================================================
 *
 * 核心逻辑：
 * - 命宫索引 = L
 * - 兄弟 = L - 1
 * - 夫妻 = L - 2
 * - ...
 * - 迁移 = L - 6
 *
 * 返回数组含义：
 * palaceSequence[0] = 命宫在哪个地支
 * palaceSequence[1] = 兄弟宫在哪个地支
 * palaceSequence[2] = 夫妻宫在哪个地支
 * ...
 *
 * 只要这一步正确，就一定满足：
 * - 命迁对宫
 * - 兄友相对
 * - 夫妻官禄相对
 * ======================================================
 */
export function calculatePalaceSequence(
  lifePalace: BranchPalace
): BranchPalace[] {
  const L = getBranchIndex(lifePalace)

  return Array.from({ length: 12 }, (_, i) => {
    return getBranchByIndex(L - i)
  })
}

/**
 * ======================================================
 * 根据年干求寅宫起干（五虎遁）
 * ======================================================
 *
 * 甲己起丙寅
 * 乙庚起戊寅
 * 丙辛起庚寅
 * 丁壬起壬寅
 * 戊癸起甲寅
 * ======================================================
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
 * 根据年干推出全盘 12 地支宫位天干
 * ======================================================
 */
export function buildPalaceStemMap(
  yearStem: HeavenlyStem
): Record<BranchPalace, HeavenlyStem> {
  const yinStartStem = getYinStartStemByYearStem(yearStem)
  const startStemIndex = HEAVENLY_STEMS.indexOf(yinStartStem)

  const result = {} as Record<BranchPalace, HeavenlyStem>

  PHYSICAL_BRANCH_ORDER.forEach((branch, index) => {
    result[branch] = HEAVENLY_STEMS[mod10(startStemIndex + index)]
  })

  return result
}

/**
 * ======================================================
 * 根据命宫干支计算五行局
 * ======================================================
 *
 * 过程：
 * 1. 根据年干推出 12 宫天干
 * 2. 取命宫所在地支的天干
 * 3. 拼命宫干支 key
 * 4. 查纳音 -> 五行局
 * ======================================================
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
    throw new Error(`无法根据命宫干支计算五行局: ${key}`)
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
 * 计算紫微星位置
 * ======================================================
 *
 * 输入：
 * - lunarDay：农历日
 * - elementBase：局数（2~6）
 *
 * 规则：
 * 1. 余数 R = Day % Base
 * 2. 若 R=0：
 *    Quotient = Day / Base
 *    Z = (Quotient - 1) mod 12
 * 3. 若 R!=0：
 *    找最小 Add，使 Day + Add 可被 Base 整除
 *    Quotient = (Day + Add) / Base
 *    Add 偶数：
 *      Z = (Quotient - 1 + Add) mod 12
 *    Add 奇数：
 *      Z = (Quotient - 1 - Add + 12) mod 12
 *
 * 返回：
 * - 紫微星地支物理索引
 * ======================================================
 */
export function calculateZiweiIndex(
  lunarDay: number,
  elementBase: 2 | 3 | 4 | 5 | 6
): number {
  const remainder = lunarDay % elementBase

  if (remainder === 0) {
    const quotient = lunarDay / elementBase
    return mod12(quotient - 1)
  }

  let add = 1
  while ((lunarDay + add) % elementBase !== 0) {
    add++
  }

  const quotient = (lunarDay + add) / elementBase

  if (add % 2 === 0) {
    return mod12((quotient - 1) + add)
  }

  return mod12((quotient - 1) - add)
}

/**
 * ======================================================
 * 安放紫微星系
 * ======================================================
 *
 * 紫微: Z
 * 天机: Z - 1
 * 太阳: Z - 3
 * 武曲: Z - 4
 * 天同: Z - 5
 * 廉贞: Z - 8
 * ======================================================
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
    const palace = getBranchByIndex(index)
    nativeStars[palace].push(starId)
  })
}

/**
 * ======================================================
 * 计算天府星位置
 * ======================================================
 *
 * 天府与紫微关于寅申轴对称：
 * F = (12 - Z) mod 12
 * ======================================================
 */
export function calculateTianfuIndex(ziweiIndex: number): number {
  return mod12(12 - ziweiIndex)
}

/**
 * ======================================================
 * 安放天府星系
 * ======================================================
 *
 * 天府: F
 * 太阴: F + 1
 * 贪狼: F + 2
 * 巨门: F + 3
 * 天相: F + 4
 * 天梁: F + 5
 * 七杀: F + 6
 * 破军: F + 10
 * ======================================================
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
    const palace = getBranchByIndex(index)
    nativeStars[palace].push(starId)
  })
}

/**
 * ======================================================
 * 统计原生空宫数
 * ======================================================
 */
function countEmptyNativePalaces(nativeStars: BranchPalaceStars): number {
  return PHYSICAL_BRANCH_ORDER.reduce((count, palace) => {
    return nativeStars[palace].length === 0 ? count + 1 : count
  }, 0)
}

/**
 * ======================================================
 * 构造借宫记录
 * ======================================================
 *
 * 规则：
 * - 若某宫无原生主星
 * - 借对宫主星
 * - 借星权重 0.6
 * ======================================================
 */
function buildBorrowedPalaces(
  nativeStars: BranchPalaceStars
): BorrowedPalaceInfo[] {
  const borrowed: BorrowedPalaceInfo[] = []

  PHYSICAL_BRANCH_ORDER.forEach((palace) => {
    if (nativeStars[palace].length > 0) {
      return
    }

    const sourcePalace = getOppositePalace(palace)

    borrowed.push({
      palace,
      sourcePalace,
      borrowedStars: [...nativeStars[sourcePalace]],
      weight: 0.6
    })
  })

  return borrowed
}

/**
 * ======================================================
 * 调试辅助：地支中文
 * ======================================================
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
 * 调试辅助：五行局中文
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
 * 主函数：生成 ZiweiEngineResult
 * ======================================================
 *
 * 输入：
 * - LunarBirthInfo
 *
 * 关键前提：
 * - lunarInfo.timeBranchNumber 必须是：
 *   子=1，丑=2 ... 亥=12
 * ======================================================
 */
export function calculateZiweiEngine(
  lunarInfo: LunarBirthInfo
): ZiweiEngineResult {
  const {
    lifePalace,
    bodyPalace
  } = calculateLifeAndBodyPalace(
    lunarInfo.lunarMonth,
    lunarInfo.timeBranchNumber
  )

  const palaceSequence = calculatePalaceSequence(lifePalace)

  const {
    elementGate,
    elementBase
  } = calculateElementGate(
    lunarInfo.yearStem,
    lifePalace
  )

  const ziweiIndex = calculateZiweiIndex(
    lunarInfo.lunarDay,
    elementBase
  )

  const tianfuIndex = calculateTianfuIndex(ziweiIndex)

  const ziweiStarPalace = getBranchByIndex(ziweiIndex)
  const tianfuStarPalace = getBranchByIndex(tianfuIndex)

  const nativeStars = createEmptyBranchPalaces()

  placeZiweiSystemStars(nativeStars, ziweiIndex)
  placeTianfuSystemStars(nativeStars, tianfuIndex)

  const emptyPalaceCount = countEmptyNativePalaces(nativeStars)
  const borrowedPalaces = buildBorrowedPalaces(nativeStars)

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