/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge - Star Profiles
 *
 * 职责：
 * 1. 定义单星人格知识
 * 2. 当前正式以 5 维核心人格为主：
 *    - activity
 *    - curiosity
 *    - dependency
 *    - confidence
 *    - sensitivity
 * 3. 同时保留 baseTraits 作为行为层兼容输出
 *
 * 说明：
 * - star_00 = 空宫
 * - star_01 ~ star_14 = 14 主星
 * - 当前数值是“简化紫微人格模型”的工程化表达
 * - 范围：
 *   corePersonality = 0 ~ 1
 *   baseTraits = 0 ~ 100
 * ======================================================
 */

import type {
  CorePersonality,
  PersonalityTraits,
  StarId
} from "../schema"

/**
 * ======================================================
 * 单星类别
 * ======================================================
 */
export type StarCategory =
  | "empty"
  | "initiative" // 开创型
  | "leadership" // 领导型
  | "support"    // 支援型
  | "cooperation" // 合作型

/**
 * ======================================================
 * 单星档案结构
 * ======================================================
 */
export interface StarProfile {
  starId: StarId
  label: string
  category: StarCategory

  /**
   * 单星核心人格（正式输出源）
   */
  baseCorePersonality: CorePersonality

  /**
   * 行为层兼容 traits
   * 说明：
   * - 当前先保留，方便旧系统兼容
   * - 长期真正核心仍然是 baseCorePersonality
   */
  baseTraits: Partial<PersonalityTraits>

  /**
   * 摘要标签
   */
  summaryTags: string[]
}

/**
 * ======================================================
 * 工具函数：把 5 维核心人格映射为基础行为层 traits
 *
 * 这是 knowledge 层里的静态映射，
 * 用于让单星资料自带一个兼容版行为轮廓。
 * ======================================================
 */
function mapCoreToBaseTraits(core: CorePersonality): Partial<PersonalityTraits> {
  return {
    activity: Math.round(core.activity * 100),
    restPreference: Math.round((1 - core.activity) * 100),
    appetite: Math.round((core.activity * 0.45 + core.sensitivity * 0.55) * 100),
    discipline: Math.round((core.confidence * 0.75 + (1 - core.dependency) * 0.25) * 100),
    curiosity: Math.round(core.curiosity * 100),
    emotionalSensitivity: Math.round(core.sensitivity * 100),
    stability: Math.round(((1 - core.sensitivity) * 0.6 + core.confidence * 0.4) * 100),
    caregiving: Math.round((core.dependency * 0.55 + core.sensitivity * 0.45) * 100),
    buildingPreference: Math.round(
      (
        core.confidence * 0.5 +
        (1 - core.curiosity) * 0.2 +
        (1 - core.dependency) * 0.3
      ) * 100
    )
  }
}

/**
 * ======================================================
 * 便捷函数：创建单星档案
 * ======================================================
 */
function createStarProfile(params: {
  starId: StarId
  label: string
  category: StarCategory
  baseCorePersonality: CorePersonality
  summaryTags: string[]
}): StarProfile {
  return {
    starId: params.starId,
    label: params.label,
    category: params.category,
    baseCorePersonality: params.baseCorePersonality,
    baseTraits: mapCoreToBaseTraits(params.baseCorePersonality),
    summaryTags: params.summaryTags
  }
}

/**
 * ======================================================
 * 单星人格知识表
 *
 * 数值设计原则：
 * - 开创型：高 activity / 高 confidence / 低 dependency
 * - 领导型：高 confidence / 中高 activity / 中低 dependency
 * - 支援型：高 curiosity / 中 activity / 中 sensitivity
 * - 合作型：高 sensitivity / 中高 dependency / 中低 confidence
 *
 * 注意：
 * 这些不是传统命理原文，而是为了 AI 行为系统而做的“统一数值人格表达”
 * ======================================================
 */
export const starProfiles: Record<StarId, StarProfile> = {
  /**
   * ----------------------------------------------------
   * star_00 空宫
   *
   * 空宫不是 bug，也不是 fallback。
   * 它是一种“虚位状态”。
   *
   * 这里的数值只是基础底色，
   * 真正空宫人格以 mapper 里的：
   * 借对宫 → 三方四正 → 空宫虚化滤镜
   * 为准。
   * ----------------------------------------------------
   */
  star_00: createStarProfile({
    starId: "star_00",
    label: "空宫",
    category: "empty",
    baseCorePersonality: {
      activity: 0.42,
      curiosity: 0.64,
      dependency: 0.68,
      confidence: 0.36,
      sensitivity: 0.72
    },
    summaryTags: [
      "更容易受环境影响",
      "适应力强但稳定性偏弱",
      "气质偏虚，变化性较高",
      "安全感较低，外部牵引明显"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_01 紫微
   * 领导型：核心主导、掌控感、地位意识
   * ----------------------------------------------------
   */
  star_01: createStarProfile({
    starId: "star_01",
    label: "紫微",
    category: "leadership",
    baseCorePersonality: {
      activity: 0.68,
      curiosity: 0.52,
      dependency: 0.26,
      confidence: 0.92,
      sensitivity: 0.38
    },
    summaryTags: [
      "主导意识强",
      "自尊与掌控欲明显",
      "天然带有中心气场",
      "更倾向于成为秩序建立者"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_02 贪狼
   * 开创型：欲望、社交、体验、变化
   * ----------------------------------------------------
   */
  star_02: createStarProfile({
    starId: "star_02",
    label: "贪狼",
    category: "initiative",
    baseCorePersonality: {
      activity: 0.84,
      curiosity: 0.83,
      dependency: 0.36,
      confidence: 0.72,
      sensitivity: 0.58
    },
    summaryTags: [
      "对新鲜体验欲望强",
      "探索欲与社交性明显",
      "容易被有趣事物吸引",
      "情绪与欲望驱动较强"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_03 巨门
   * 支援型：思辨、怀疑、口才、辩证
   * ----------------------------------------------------
   */
  star_03: createStarProfile({
    starId: "star_03",
    label: "巨门",
    category: "support",
    baseCorePersonality: {
      activity: 0.48,
      curiosity: 0.78,
      dependency: 0.46,
      confidence: 0.58,
      sensitivity: 0.67
    },
    summaryTags: [
      "思辨欲强",
      "容易多想，也容易怀疑",
      "表达能力与分辨力明显",
      "常会从不同角度反复衡量"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_04 廉贞
   * 开创型：强意志、原则、控制、执拗
   * ----------------------------------------------------
   */
  star_04: createStarProfile({
    starId: "star_04",
    label: "廉贞",
    category: "initiative",
    baseCorePersonality: {
      activity: 0.73,
      curiosity: 0.57,
      dependency: 0.24,
      confidence: 0.82,
      sensitivity: 0.52
    },
    summaryTags: [
      "原则感强",
      "控制欲与边界感明显",
      "行动带有决绝色彩",
      "不容易轻易妥协"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_05 武曲
   * 领导型：执行、现实、资源掌控、稳硬
   * ----------------------------------------------------
   */
  star_05: createStarProfile({
    starId: "star_05",
    label: "武曲",
    category: "leadership",
    baseCorePersonality: {
      activity: 0.71,
      curiosity: 0.42,
      dependency: 0.22,
      confidence: 0.87,
      sensitivity: 0.29
    },
    summaryTags: [
      "执行力很强",
      "现实感与资源意识明显",
      "偏务实，不喜欢空谈",
      "稳定、刚硬、抗压能力强"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_06 破军
   * 开创型：破旧立新、变动、冲劲、激烈
   * ----------------------------------------------------
   */
  star_06: createStarProfile({
    starId: "star_06",
    label: "破军",
    category: "initiative",
    baseCorePersonality: {
      activity: 0.91,
      curiosity: 0.74,
      dependency: 0.18,
      confidence: 0.81,
      sensitivity: 0.34
    },
    summaryTags: [
      "破坏与重建倾向明显",
      "强烈偏好变化",
      "不喜欢被旧秩序束缚",
      "行动激烈，转向也快"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_07 天府
   * 领导型：稳定、包容、持有、稳重
   * ----------------------------------------------------
   */
  star_07: createStarProfile({
    starId: "star_07",
    label: "天府",
    category: "leadership",
    baseCorePersonality: {
      activity: 0.56,
      curiosity: 0.43,
      dependency: 0.34,
      confidence: 0.83,
      sensitivity: 0.46
    },
    summaryTags: [
      "稳重感强",
      "更擅长维持与承载",
      "包容度较高",
      "有资源整合与守成倾向"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_08 天机
   * 支援型：机敏、脑力、变化、分析
   * ----------------------------------------------------
   */
  star_08: createStarProfile({
    starId: "star_08",
    label: "天机",
    category: "support",
    baseCorePersonality: {
      activity: 0.57,
      curiosity: 0.92,
      dependency: 0.41,
      confidence: 0.49,
      sensitivity: 0.61
    },
    summaryTags: [
      "脑力与应变能力强",
      "好奇心很高",
      "容易快速分析环境",
      "思维灵活，但也容易多变"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_09 天相
   * 领导型：秩序、平衡、协调、体面
   * ----------------------------------------------------
   */
  star_09: createStarProfile({
    starId: "star_09",
    label: "天相",
    category: "leadership",
    baseCorePersonality: {
      activity: 0.54,
      curiosity: 0.48,
      dependency: 0.44,
      confidence: 0.73,
      sensitivity: 0.57
    },
    summaryTags: [
      "讲秩序与体面",
      "协调能力较强",
      "更倾向于维持平衡",
      "处理关系时会顾及全局"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_10 天梁
   * 合作型：保护、慈悲、原则、庇护
   * ----------------------------------------------------
   */
  star_10: createStarProfile({
    starId: "star_10",
    label: "天梁",
    category: "cooperation",
    baseCorePersonality: {
      activity: 0.42,
      curiosity: 0.53,
      dependency: 0.58,
      confidence: 0.56,
      sensitivity: 0.79
    },
    summaryTags: [
      "保护欲与责任感明显",
      "容易站在照顾者位置",
      "慈悲心较强",
      "更在意长期安全与道义"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_11 天同
   * 合作型：和气、知足、依恋、舒适
   * ----------------------------------------------------
   */
  star_11: createStarProfile({
    starId: "star_11",
    label: "天同",
    category: "cooperation",
    baseCorePersonality: {
      activity: 0.33,
      curiosity: 0.47,
      dependency: 0.74,
      confidence: 0.31,
      sensitivity: 0.76
    },
    summaryTags: [
      "追求舒适与和气",
      "依恋感较强",
      "不喜欢激烈冲突",
      "偏向顺势与安稳"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_12 七杀
   * 开创型：决断、孤锋、强冲劲、高自我
   * ----------------------------------------------------
   */
  star_12: createStarProfile({
    starId: "star_12",
    label: "七杀",
    category: "initiative",
    baseCorePersonality: {
      activity: 0.89,
      curiosity: 0.58,
      dependency: 0.16,
      confidence: 0.91,
      sensitivity: 0.28
    },
    summaryTags: [
      "决断力很强",
      "独立性极高",
      "敢冲敢断，不喜欢拖延",
      "带有孤锋与压迫感"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_13 太阳
   * 支援型：外放、热情、表现、照耀
   * ----------------------------------------------------
   */
  star_13: createStarProfile({
    starId: "star_13",
    label: "太阳",
    category: "support",
    baseCorePersonality: {
      activity: 0.76,
      curiosity: 0.63,
      dependency: 0.34,
      confidence: 0.74,
      sensitivity: 0.49
    },
    summaryTags: [
      "外放与热情明显",
      "喜欢表达与带动氛围",
      "有照亮他人的倾向",
      "更容易主动介入环境"
    ]
  }),

  /**
   * ----------------------------------------------------
   * star_14 太阴
   * 合作型：细腻、柔和、内敛、情绪感受强
   * ----------------------------------------------------
   */
  star_14: createStarProfile({
    starId: "star_14",
    label: "太阴",
    category: "cooperation",
    baseCorePersonality: {
      activity: 0.38,
      curiosity: 0.51,
      dependency: 0.69,
      confidence: 0.37,
      sensitivity: 0.87
    },
    summaryTags: [
      "情绪感受力很强",
      "更细腻、柔和、内敛",
      "安全感需求较高",
      "偏好安静而稳定的关系环境"
    ]
  })
}

/**
 * ======================================================
 * 获取单星档案
 * ======================================================
 */
export function getStarProfile(starId: StarId): StarProfile | null {
  return starProfiles[starId] ?? null
}

/**
 * ======================================================
 * 获取全部单星档案
 * ======================================================
 */
export function getAllStarProfiles(): StarProfile[] {
  return Object.values(starProfiles)
}