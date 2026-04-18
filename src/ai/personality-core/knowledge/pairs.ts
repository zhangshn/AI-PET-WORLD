/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge / Pairs
 *
 * 功能：
 * 1. 定义完整 24 组双单元组合
 * 2. 定义组合命中后的附加 traits
 * 3. 定义组合命中后的摘要文本
 *
 * 当前版本关键原则：
 * - pair 的命中逻辑以 unitIds 为准
 * - 不以中文标签判断
 * - pairId 只是内部编号
 * - unitIds 才是组合关系本体
 * ======================================================
 */

import { TraitWeights } from "./units"

/**
 * 双单元组合知识结构
 */
export type PairKnowledge = {
  pairId: string
  unitIds: [string, string]
  displayKey: string
  pairLabel: string
  pairTraits: TraitWeights
  summaryText: string
  enabledByDefault: boolean
}

/**
 * 根据两个 unitId 生成稳定组合 key
 *
 * 说明：
 * - unit_01 + unit_07
 * - unit_07 + unit_01
 * 最终都会归一为同一个 key
 *
 * 这意味着：
 * - 命中逻辑依赖 unitIds
 * - 而不是靠 pair 中文名判断
 */
export function buildPairKey(unitIds: [string, string]): string {
  return [...unitIds].sort().join("__")
}

/**
 * 完整 24 组双单元组合知识表
 *
 * unitId 内部映射：
 * - unit_01 -> 紫微
 * - unit_02 -> 贪狼
 * - unit_03 -> 巨门
 * - unit_04 -> 廉贞
 * - unit_05 -> 武曲
 * - unit_06 -> 破军
 * - unit_07 -> 天府
 * - unit_08 -> 天机
 * - unit_09 -> 天相
 * - unit_10 -> 天梁
 * - unit_11 -> 天同
 * - unit_12 -> 七杀
 * - unit_13 -> 太阳
 * - unit_14 -> 太阴
 */
export const PAIR_KNOWLEDGE_LIST: PairKnowledge[] = [
  {
    pairId: "pair_01",
    unitIds: ["unit_01", "unit_06"],
    displayKey: "label_pair_01",
    pairLabel: "强势破立型",
    pairTraits: { activity: 10, stability: -4, discipline: 4 },
    summaryText: "有冲劲的主导感中带有明显破立特征。",
    enabledByDefault: true
  },
  {
    pairId: "pair_02",
    unitIds: ["unit_01", "unit_07"],
    displayKey: "label_pair_02",
    pairLabel: "格局稳控型",
    pairTraits: { stability: 14, caregiving: 10, discipline: 8 },
    summaryText: "整体格局与稳定感都更强。",
    enabledByDefault: true
  },
  {
    pairId: "pair_03",
    unitIds: ["unit_01", "unit_02"],
    displayKey: "label_pair_03",
    pairLabel: "掌控体验型",
    pairTraits: { activity: 10, appetite: 8, curiosity: 8 },
    summaryText: "掌控感与体验欲并存，整体更活跃。",
    enabledByDefault: false
  },
  {
    pairId: "pair_04",
    unitIds: ["unit_01", "unit_09"],
    displayKey: "label_pair_04",
    pairLabel: "秩序贵气型",
    pairTraits: { discipline: 8, stability: 8, caregiving: 6 },
    summaryText: "秩序感、体面感与协调性更明显。",
    enabledByDefault: false
  },
  {
    pairId: "pair_05",
    unitIds: ["unit_01", "unit_12"],
    displayKey: "label_pair_05",
    pairLabel: "权力爆发型",
    pairTraits: { activity: 8, discipline: 8, stability: -2 },
    summaryText: "果断与爆发力更强，行动推进更直接。",
    enabledByDefault: false
  },

  {
    pairId: "pair_06",
    unitIds: ["unit_05", "unit_07"],
    displayKey: "label_pair_06",
    pairLabel: "建设守成型",
    pairTraits: { buildingPreference: 14, discipline: 10, stability: 10 },
    summaryText: "建设与秩序倾向更强，也更能守成。",
    enabledByDefault: true
  },
  {
    pairId: "pair_07",
    unitIds: ["unit_05", "unit_02"],
    displayKey: "label_pair_07",
    pairLabel: "欲望执行型",
    pairTraits: { activity: 8, appetite: 8, discipline: 8 },
    summaryText: "欲望与执行力并行，目标感更强。",
    enabledByDefault: true
  },
  {
    pairId: "pair_08",
    unitIds: ["unit_05", "unit_09"],
    displayKey: "label_pair_08",
    pairLabel: "专业秩序型",
    pairTraits: { discipline: 10, stability: 8, caregiving: 4 },
    summaryText: "专业感、秩序感与原则性更明显。",
    enabledByDefault: false
  },
  {
    pairId: "pair_09",
    unitIds: ["unit_05", "unit_12"],
    displayKey: "label_pair_09",
    pairLabel: "刚硬推进型",
    pairTraits: { activity: 8, discipline: 8, stability: -4 },
    summaryText: "推进感强，但整体更刚硬直接。",
    enabledByDefault: false
  },
  {
    pairId: "pair_10",
    unitIds: ["unit_05", "unit_06"],
    displayKey: "label_pair_10",
    pairLabel: "冲撞建设型",
    pairTraits: { activity: 10, buildingPreference: 6, stability: -8 },
    summaryText: "敢打敢拼，建设欲与起伏感并存。",
    enabledByDefault: false
  },

  {
    pairId: "pair_11",
    unitIds: ["unit_04", "unit_07"],
    displayKey: "label_pair_11",
    pairLabel: "能攻能守型",
    pairTraits: { discipline: 8, stability: 8, activity: 4 },
    summaryText: "稳中带锋芒，兼具守成与进取。",
    enabledByDefault: false
  },
  {
    pairId: "pair_12",
    unitIds: ["unit_04", "unit_02"],
    displayKey: "label_pair_12",
    pairLabel: "魅力张力型",
    pairTraits: { activity: 8, appetite: 8, emotionalSensitivity: 6 },
    summaryText: "整体张力、魅力与欲望感更强。",
    enabledByDefault: true
  },
  {
    pairId: "pair_13",
    unitIds: ["unit_04", "unit_09"],
    displayKey: "label_pair_13",
    pairLabel: "自律责任型",
    pairTraits: { discipline: 10, stability: 6 },
    summaryText: "责任感、自律性与约束感更明显。",
    enabledByDefault: false
  },
  {
    pairId: "pair_14",
    unitIds: ["unit_04", "unit_12"],
    displayKey: "label_pair_14",
    pairLabel: "高压硬推型",
    pairTraits: { activity: 10, discipline: 6, stability: -4 },
    summaryText: "在高压环境下推进力更强。",
    enabledByDefault: false
  },
  {
    pairId: "pair_15",
    unitIds: ["unit_04", "unit_06"],
    displayKey: "label_pair_15",
    pairLabel: "偏激波动型",
    pairTraits: { activity: 8, emotionalSensitivity: 8, stability: -10 },
    summaryText: "不受拘束，波动感与偏激感更明显。",
    enabledByDefault: false
  },

  {
    pairId: "pair_16",
    unitIds: ["unit_08", "unit_14"],
    displayKey: "label_pair_16",
    pairLabel: "细腻敏锐型",
    pairTraits: { curiosity: 8, emotionalSensitivity: 10, restPreference: 6 },
    summaryText: "更细致、敏锐，也更温柔敏感。",
    enabledByDefault: true
  },
  {
    pairId: "pair_17",
    unitIds: ["unit_08", "unit_03"],
    displayKey: "label_pair_17",
    pairLabel: "机谋善辩型",
    pairTraits: { curiosity: 12, emotionalSensitivity: 8, stability: -4 },
    summaryText: "分析力与表达性更强，也更容易多想。",
    enabledByDefault: true
  },
  {
    pairId: "pair_18",
    unitIds: ["unit_08", "unit_10"],
    displayKey: "label_pair_18",
    pairLabel: "聪稳策划型",
    pairTraits: { curiosity: 10, stability: 8, caregiving: 6 },
    summaryText: "聪明且稳，更善于策划和照料。",
    enabledByDefault: false
  },

  {
    pairId: "pair_19",
    unitIds: ["unit_13", "unit_14"],
    displayKey: "label_pair_19",
    pairLabel: "阴阳层次型",
    pairTraits: { activity: 4, restPreference: 4, emotionalSensitivity: 8 },
    summaryText: "内外并存，整体层次感更明显。",
    enabledByDefault: true
  },
  {
    pairId: "pair_20",
    unitIds: ["unit_13", "unit_03"],
    displayKey: "label_pair_20",
    pairLabel: "外向争议型",
    pairTraits: { activity: 8, curiosity: 10, emotionalSensitivity: 4 },
    summaryText: "外向表达欲更强，也更容易引发争议感。",
    enabledByDefault: false
  },
  {
    pairId: "pair_21",
    unitIds: ["unit_13", "unit_10"],
    displayKey: "label_pair_21",
    pairLabel: "正直外护型",
    pairTraits: { activity: 8, caregiving: 8, stability: 6 },
    summaryText: "正直感、表现力与照护感更明显。",
    enabledByDefault: false
  },

  {
    pairId: "pair_22",
    unitIds: ["unit_11", "unit_14"],
    displayKey: "label_pair_22",
    pairLabel: "温婉安静型",
    pairTraits: { restPreference: 14, emotionalSensitivity: 6, activity: -6 },
    summaryText: "更安静、柔和，也更偏舒适导向。",
    enabledByDefault: true
  },
  {
    pairId: "pair_23",
    unitIds: ["unit_11", "unit_03"],
    displayKey: "label_pair_23",
    pairLabel: "细腻压抑型",
    pairTraits: { emotionalSensitivity: 10, stability: -4 },
    summaryText: "温和外表下更细腻，也更容易有压抑感。",
    enabledByDefault: false
  },
  {
    pairId: "pair_24",
    unitIds: ["unit_11", "unit_10"],
    displayKey: "label_pair_24",
    pairLabel: "安稳被护型",
    pairTraits: { restPreference: 10, caregiving: 12, stability: 8 },
    summaryText: "更温和安稳，也更容易得到保护感。",
    enabledByDefault: true
  }
]

/**
 * 组合索引表
 *
 * 用途：
 * 根据 buildPairKey(unitIds) 快速命中组合
 */
export const PAIR_KNOWLEDGE_MAP: Record<string, PairKnowledge> =
  PAIR_KNOWLEDGE_LIST.reduce<Record<string, PairKnowledge>>((acc, item) => {
    acc[buildPairKey(item.unitIds)] = item
    return acc
  }, {})

/**
 * 根据两个 unitId 获取组合知识
 *
 * 说明：
 * 命中逻辑完全基于 unitIds
 * 不基于 pair 中文名
 */
export function getPairKnowledge(
  unitIdA: string,
  unitIdB: string
): PairKnowledge | undefined {
  return PAIR_KNOWLEDGE_MAP[buildPairKey([unitIdA, unitIdB])]
}