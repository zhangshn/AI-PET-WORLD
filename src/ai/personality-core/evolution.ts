/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Evolution
 *
 * 功能：
 * 1. 将基础人格结果与孵化阶段的成长信息进行融合
 * 2. 输出最终人格档案
 *
 * 设计目标：
 * - 让人格不是“出生瞬间突然出现”
 * - 而是“人格种子 + 孵化过程 + 出生时间”共同形成
 *
 * 说明：
 * - 这一层不负责出生输入计算
 * - 不负责基础结构生成
 * - 只负责“如何把成长影响融合进最终人格”
 * ======================================================
 */

import type {
  PersonalityProfile,
  PersonalityTraits
} from "./schema"

/**
 * 孵化阶段成长印记
 *
 * 字段说明：
 * - calmGrowth：
 *   孵化阶段整体是否更平稳、安静
 *
 * - activeGrowth：
 *   孵化阶段是否更偏活跃发展
 *
 * - stableGrowth：
 *   孵化阶段整体是否更稳定
 *
 * - sensitiveGrowth：
 *   孵化阶段是否更容易产生波动
 */
export type IncubationImprint = {
  calmGrowth: number
  activeGrowth: number
  stableGrowth: number
  sensitiveGrowth: number
}

/**
 * ======================================================
 * 限制单个数值范围
 * ======================================================
 */
function clampValue(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value)
}

/**
 * ======================================================
 * 限制 traits 范围
 * ======================================================
 */
function clampTraits(traits: PersonalityTraits): PersonalityTraits {
  return {
    activity: clampValue(traits.activity),
    restPreference: clampValue(traits.restPreference),
    appetite: clampValue(traits.appetite),
    discipline: clampValue(traits.discipline),
    curiosity: clampValue(traits.curiosity),
    emotionalSensitivity: clampValue(traits.emotionalSensitivity),
    stability: clampValue(traits.stability),
    caregiving: clampValue(traits.caregiving),
    buildingPreference: clampValue(traits.buildingPreference)
  }
}

/**
 * ======================================================
 * 合并两组摘要
 *
 * 说明：
 * - 去重
 * - 保留顺序
 * ======================================================
 */
function mergeSummaries(base: string[], extra: string[]): string[] {
  const set = new Set<string>()
  const merged: string[] = []

  for (const item of [...base, ...extra]) {
    if (!set.has(item)) {
      set.add(item)
      merged.push(item)
    }
  }

  return merged
}

/**
 * ======================================================
 * 根据成长印记构造补充摘要
 * ======================================================
 */
function buildEvolutionSummaries(
  imprint: IncubationImprint
): string[] {
  const summaries: string[] = []

  if (imprint.calmGrowth >= 60) {
    summaries.push("孵化阶段表现出安静稳定的倾向")
  }

  if (imprint.activeGrowth >= 60) {
    summaries.push("孵化阶段积累了较强的行动倾向")
  }

  if (imprint.stableGrowth >= 60) {
    summaries.push("孵化过程整体较稳定")
  }

  if (imprint.sensitiveGrowth >= 60) {
    summaries.push("孵化阶段对环境变化较敏感")
  }

  return summaries
}

/**
 * ======================================================
 * 融合人格
 *
 * 输入：
 * - seedProfile：
 *   胚胎阶段的人格种子
 *
 * - birthProfile：
 *   根据出生时刻生成的基础人格
 *
 * - imprint：
 *   孵化过程形成的成长印记
 *
 * 输出：
 * - 最终人格档案
 *
 * 规则说明：
 * - 以出生时刻的人格为主
 * - 保留部分胚胎种子倾向
 * - 再叠加孵化阶段成长印记
 * ======================================================
 */
export function evolveProfile(
  seedProfile: PersonalityProfile,
  birthProfile: PersonalityProfile,
  imprint: IncubationImprint
): PersonalityProfile {
  const seedTraits = seedProfile.traits
  const birthTraits = birthProfile.traits

  /**
   * 融合权重说明：
   * - 出生时刻人格：主导层
   * - 胚胎种子人格：保留层
   * - 孵化成长印记：微调层
   */
  const mergedTraits: PersonalityTraits = {
    activity:
      birthTraits.activity * 0.6 +
      seedTraits.activity * 0.25 +
      imprint.activeGrowth * 0.15,

    restPreference:
      birthTraits.restPreference * 0.6 +
      seedTraits.restPreference * 0.25 +
      imprint.calmGrowth * 0.15,

    appetite:
      birthTraits.appetite * 0.7 +
      seedTraits.appetite * 0.3,

    discipline:
      birthTraits.discipline * 0.65 +
      seedTraits.discipline * 0.2 +
      imprint.stableGrowth * 0.15,

    curiosity:
      birthTraits.curiosity * 0.75 +
      seedTraits.curiosity * 0.25,

    emotionalSensitivity:
      birthTraits.emotionalSensitivity * 0.6 +
      seedTraits.emotionalSensitivity * 0.2 +
      imprint.sensitiveGrowth * 0.2,

    stability:
      birthTraits.stability * 0.6 +
      seedTraits.stability * 0.2 +
      imprint.stableGrowth * 0.2,

    caregiving:
      birthTraits.caregiving * 0.7 +
      seedTraits.caregiving * 0.3,

    buildingPreference:
      birthTraits.buildingPreference * 0.7 +
      seedTraits.buildingPreference * 0.3
  }

  const normalizedTraits = clampTraits(mergedTraits)

  const evolutionSummaries = buildEvolutionSummaries(imprint)

  return {
    /**
     * 当前 MVP 方案：
     * pattern 先保留“出生时刻结构”作为最终结构
     */
    pattern: birthProfile.pattern,

    /**
     * 摘要 = 出生时刻摘要 + 胚胎种子摘要 + 孵化成长摘要
     */
    summaries: mergeSummaries(
      birthProfile.summaries,
      [...seedProfile.summaries, ...evolutionSummaries]
    ),

    /**
     * traits 使用融合后的最终结果
     */
    traits: normalizedTraits
  }
}