/**
 * 当前文件负责：集中管理 personality-test 页面使用的展示常量。
 */

import type { BranchPalace, SectorName } from "../../ai/ziwei-core/schema"

export const BRANCH_LABELS: Record<BranchPalace, string> = {
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

export const BRANCH_FULL_LABELS: Record<BranchPalace, string> = {
  yin: "寅宫",
  mao: "卯宫",
  chen: "辰宫",
  si: "巳宫",
  wu: "午宫",
  wei: "未宫",
  shen: "申宫",
  you: "酉宫",
  xu: "戌宫",
  hai: "亥宫",
  zi: "子宫",
  chou: "丑宫"
}

export const SECTOR_LABELS_FALLBACK: Record<SectorName, string> = {
  life: "命宫",
  siblings: "兄弟",
  spouse: "夫妻",
  children: "子女",
  wealth: "财帛",
  health: "疾厄",
  travel: "迁移",
  friends: "交友",
  career: "官禄",
  property: "田宅",
  fortune: "福德",
  parents: "父母"
}

export const ZIWEI_LAYOUT: (BranchPalace | null)[][] = [
  ["si", "wu", "wei", "shen"],
  ["chen", null, null, "you"],
  ["mao", null, null, "xu"],
  ["yin", "chou", "zi", "hai"]
]

export const TIME_BRANCH_BY_HOUR: BranchPalace[] = [
  "zi",
  "chou",
  "chou",
  "yin",
  "yin",
  "mao",
  "mao",
  "chen",
  "chen",
  "si",
  "si",
  "wu",
  "wu",
  "wei",
  "wei",
  "shen",
  "shen",
  "you",
  "you",
  "xu",
  "xu",
  "hai",
  "hai",
  "zi"
]

export const ELEMENT_GATE_LABELS: Record<string, string> = {
  water_2: "水二局",
  wood_3: "木三局",
  metal_4: "金四局",
  earth_5: "土五局",
  fire_6: "火六局"
}

export const WUXING_LABELS: Record<string, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水"
}

export const DYNAMIC_FLOW_LABELS: Record<string, string> = {
  natal: "本命",
  daYun: "大运",
  liuNian: "流年",
  liuYue: "流月",
  liuRi: "流日",
  liuShi: "流时"
}

export const DYNAMIC_BIAS_LABELS: Record<string, string> = {
  careBias: "照护倾向",
  observeBias: "观察倾向",
  protectBias: "保护倾向",
  exploreBias: "探索倾向",
  recordBias: "记录倾向",
  routineBias: "秩序倾向",
  repairBias: "修复倾向",
  boundaryBias: "边界倾向"
}

export const POSITION_BIAS_LABELS: Record<string, string> = {
  near_incubator: "靠近孵化器",
  near_nest: "靠近巢穴",
  near_door: "靠近门口",
  near_desk: "靠近记录桌",
  patrol_room: "房间巡查"
}

export const OBSERVATION_DISTANCE_LABELS: Record<string, string> = {
  close: "近距离观察",
  medium: "中距离观察",
  distant: "远距离观察"
}

export const TONE_BIAS_LABELS: Record<string, string> = {
  gentle: "温和",
  rational: "理性",
  concise: "简洁",
  protective: "保护性",
  curious: "好奇"
}