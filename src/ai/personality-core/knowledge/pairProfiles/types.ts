/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - Types
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只负责：
 * 1. 定义“双星组合人格资料”的统一数据结构
 * 2. 让 pairProfiles 目录下所有组合文件都使用同一套类型协议
 *
 * ------------------------------------------------------
 * 【为什么要单独拆这个文件】
 * 因为我们已经决定：
 * - 组合星资料不再写成一个超大文件
 * - 而是按“星曜入口”拆分成多个文件
 *
 * 这样拆开以后，所有文件都要使用同一种结构，
 * 所以需要一个统一的 types.ts 来约束数据格式。
 *
 * ------------------------------------------------------
 * 【当前正式原则】
 * 1. 组合人格以 5 维核心人格为主：
 *    - activity
 *    - curiosity
 *    - dependency
 *    - confidence
 *    - sensitivity
 *
 * 2. pairTraits 只是兼容层，可选
 *    - 当前如果 mapper 只吃 pairCorePersonality，也可以不写 pairTraits
 *    - 后续如果某些旧系统临时还会用到，可保留 pairTraits
 *
 * 3. 组合名称最终不要写死在这里做展示名
 *    - 展示层应优先通过 labels.ts 动态生成
 *    - 这里更关注“人格结构”和“摘要”
 *
 * ======================================================
 */

import type {
  CorePersonality,
  PersonalityTraits,
  StarId
} from "../../schema"

/**
 * ======================================================
 * PairProfile
 * ======================================================
 *
 * 双星组合人格档案结构
 *
 * 字段说明：
 *
 * - pairId
 *   组合唯一 ID
 *   例如：
 *   pair_ziwei_tianfu
 *   pair_tianji_taiyin
 *
 * - starIds
 *   参与组合的两颗主星
 *   固定写成 [StarId, StarId]
 *
 * - pairCorePersonality
 *   双星组合后的核心 5 维人格
 *   这是正式人格输出源
 *
 * - pairTraits
 *   行为层兼容 traits，可选
 *   当前阶段可以不写，后续由 mapper 用 pairCorePersonality 再映射也可以
 *
 * - summaryText
 *   组合人格摘要
 *   用于：
 *   1. summaries 输出
 *   2. debug 展示
 *   3. 测试页解释
 *
 * - personalityTags
 *   组合人格标签
 *   用于后续：
 *   1. 文案生成
 *   2. 行为风格标签
 *   3. 筛选 / 调试
 * ======================================================
 */
export interface PairProfile {
  /**
   * 组合唯一 ID
   */
  pairId: string

  /**
   * 组成该组合的两颗主星
   *
   * 约定：
   * - 顺序必须固定
   * - 不要在不同文件里反过来重复写
   */
  starIds: [StarId, StarId]

  /**
   * 双星组合后的核心 5 维人格
   *
   * 范围：
   * 0 ~ 1
   */
  pairCorePersonality: CorePersonality

  /**
   * 行为层 traits（兼容层，可选）
   *
   * 说明：
   * - 当前不是必填
   * - 如果不写，mapper 可通过 pairCorePersonality 再映射
   */
  pairTraits?: Partial<PersonalityTraits>

  /**
   * 组合摘要
   */
  summaryText: string

  /**
   * 组合标签
   */
  personalityTags: string[]
}