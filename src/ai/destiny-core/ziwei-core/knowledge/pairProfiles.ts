/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge / Pair Profiles
 *
 * 功能：
 * 1. 单独定义双星组合特性
 * 2. 不负责定义组合关系
 * 3. 这里只负责：
 *    - pairLabel
 *    - summaryText
 *    - pairTraits
 *    - personalityTags
 * ======================================================
 */

import { PersonalityTraits } from "../schema"

export type PairProfile = {
  pairId: string
  pairLabel: string
  summaryText: string
  pairTraits: Partial<PersonalityTraits>
  personalityTags: string[]
}

export const PAIR_PROFILE_MAP: Record<string, PairProfile> = {
  pair_01: {
    pairId: "pair_01",
    pairLabel: "强势破立型",
    summaryText: "有冲劲，也有先破后立的倾向。",
    pairTraits: { activity: 10, stability: -4, discipline: 4 },
    personalityTags: ["破立", "冲劲", "起伏"]
  },
  pair_02: {
    pairId: "pair_02",
    pairLabel: "格局稳控型",
    summaryText: "整体格局与稳定感都更强。",
    pairTraits: { stability: 14, caregiving: 10, discipline: 8 },
    personalityTags: ["格局", "稳定", "掌控"]
  },
  pair_03: {
    pairId: "pair_03",
    pairLabel: "掌控享受型",
    summaryText: "多才多动，也更重体验与享受。",
    pairTraits: { activity: 10, appetite: 8, curiosity: 8 },
    personalityTags: ["享受", "多动", "体验"]
  },
  pair_04: {
    pairId: "pair_04",
    pairLabel: "体面秩序型",
    summaryText: "贵气、体面和秩序感更明显。",
    pairTraits: { discipline: 8, stability: 8, caregiving: 6 },
    personalityTags: ["体面", "秩序", "贵气"]
  },
  pair_05: {
    pairId: "pair_05",
    pairLabel: "权力爆发型",
    summaryText: "果断高效，爆发力更强。",
    pairTraits: { activity: 8, discipline: 8, stability: -2 },
    personalityTags: ["爆发", "果断", "权力感"]
  },

  pair_06: {
    pairId: "pair_06",
    pairLabel: "建设守成型",
    summaryText: "建设与守成能力都更强。",
    pairTraits: { buildingPreference: 14, discipline: 10, stability: 10 },
    personalityTags: ["建设", "守成", "秩序"]
  },
  pair_07: {
    pairId: "pair_07",
    pairLabel: "欲望执行型",
    summaryText: "欲望与执行力并行。",
    pairTraits: { activity: 8, appetite: 8, discipline: 8 },
    personalityTags: ["欲望", "执行", "目标感"]
  },
  pair_08: {
    pairId: "pair_08",
    pairLabel: "专业秩序型",
    summaryText: "专业感、原则性和秩序感更明显。",
    pairTraits: { discipline: 10, stability: 8, caregiving: 4 },
    personalityTags: ["专业", "原则", "秩序"]
  },
  pair_09: {
    pairId: "pair_09",
    pairLabel: "刚硬推进型",
    summaryText: "刚毅果决，推进力更强。",
    pairTraits: { activity: 8, discipline: 8, stability: -4 },
    personalityTags: ["刚硬", "推进", "果决"]
  },
  pair_10: {
    pairId: "pair_10",
    pairLabel: "冲撞起家型",
    summaryText: "敢打敢拼，但起伏感更明显。",
    pairTraits: { activity: 10, buildingPreference: 6, stability: -8 },
    personalityTags: ["冲撞", "起家", "波动"]
  },

  pair_11: {
    pairId: "pair_11",
    pairLabel: "能攻能守型",
    summaryText: "稳中带锋芒，能守也能攻。",
    pairTraits: { discipline: 8, stability: 8, activity: 4 },
    personalityTags: ["能攻能守", "锋芒", "稳定"]
  },
  pair_12: {
    pairId: "pair_12",
    pairLabel: "魅力张力型",
    summaryText: "艺术感、魅力和情感张力更强。",
    pairTraits: { activity: 8, appetite: 8, emotionalSensitivity: 6 },
    personalityTags: ["魅力", "张力", "欲望"]
  },
  pair_13: {
    pairId: "pair_13",
    pairLabel: "自律责任型",
    summaryText: "责任感和自我约束更明显。",
    pairTraits: { discipline: 10, stability: 6 },
    personalityTags: ["自律", "责任", "约束"]
  },
  pair_14: {
    pairId: "pair_14",
    pairLabel: "高压硬推型",
    summaryText: "在艰苦环境中推进力更强。",
    pairTraits: { activity: 10, discipline: 6, stability: -4 },
    personalityTags: ["高压", "推进", "硬度"]
  },
  pair_15: {
    pairId: "pair_15",
    pairLabel: "偏激波动型",
    summaryText: "变动性强，起伏感也更明显。",
    pairTraits: { activity: 8, emotionalSensitivity: 8, stability: -10 },
    personalityTags: ["偏激", "波动", "不稳定"]
  },

  pair_16: {
    pairId: "pair_16",
    pairLabel: "细腻敏锐型",
    summaryText: "细致、敏锐，也更温柔多感。",
    pairTraits: { curiosity: 8, emotionalSensitivity: 10, restPreference: 6 },
    personalityTags: ["细腻", "敏锐", "温柔"]
  },
  pair_17: {
    pairId: "pair_17",
    pairLabel: "机谋善辩型",
    summaryText: "口才、分析力与思虑深度都更明显。",
    pairTraits: { curiosity: 12, emotionalSensitivity: 8, stability: -4 },
    personalityTags: ["善辩", "机谋", "多思"]
  },
  pair_18: {
    pairId: "pair_18",
    pairLabel: "聪稳策划型",
    summaryText: "聪明且稳，更善于策划与照护。",
    pairTraits: { curiosity: 10, stability: 8, caregiving: 6 },
    personalityTags: ["策划", "聪稳", "照护"]
  },

  pair_19: {
    pairId: "pair_19",
    pairLabel: "阴阳层次型",
    summaryText: "内外并存，性格层次感更明显。",
    pairTraits: { activity: 4, restPreference: 4, emotionalSensitivity: 8 },
    personalityTags: ["层次", "内外并存", "纠结感"]
  },
  pair_20: {
    pairId: "pair_20",
    pairLabel: "外向争议型",
    summaryText: "表达欲更强，也更容易引发争议感。",
    pairTraits: { activity: 8, curiosity: 10, emotionalSensitivity: 4 },
    personalityTags: ["外向", "表达", "争议"]
  },
  pair_21: {
    pairId: "pair_21",
    pairLabel: "正直外护型",
    summaryText: "正直感、责任感与外向表现更明显。",
    pairTraits: { activity: 8, caregiving: 8, stability: 6 },
    personalityTags: ["正直", "责任", "外护"]
  },

  pair_22: {
    pairId: "pair_22",
    pairLabel: "温婉安静型",
    summaryText: "更温婉、安静，也更偏舒适导向。",
    pairTraits: { restPreference: 14, emotionalSensitivity: 6, activity: -6 },
    personalityTags: ["温婉", "安静", "舒适"]
  },
  pair_23: {
    pairId: "pair_23",
    pairLabel: "细腻压抑型",
    summaryText: "内心细腻，但更容易有压抑感。",
    pairTraits: { emotionalSensitivity: 10, stability: -4 },
    personalityTags: ["细腻", "压抑", "隐痛"]
  },
  pair_24: {
    pairId: "pair_24",
    pairLabel: "安稳被护型",
    summaryText: "更安稳，也更容易得到帮助与保护。",
    pairTraits: { restPreference: 10, caregiving: 12, stability: 8 },
    personalityTags: ["安稳", "被护", "逢助"]
  }
}

export function getPairProfile(pairId: string): PairProfile | undefined {
  return PAIR_PROFILE_MAP[pairId]
}