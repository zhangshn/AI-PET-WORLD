/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge - Index
 * ======================================================
 *
 * 【文件职责】
 * 这是人格知识层的统一出口文件。
 *
 * 它负责：
 * 1. 对外统一导出 knowledge 层能力
 * 2. 屏蔽内部文件拆分细节
 * 3. 让 mapper.ts / gateway.ts / 其他模块
 *    不需要知道 knowledge 内部具体拆成了多少文件
 *
 * ------------------------------------------------------
 * 【当前正式方向】
 * knowledge 层已经正式切换到：
 *
 * - stars.ts               -> 星曜定义
 * - starProfiles.ts        -> 单星人格知识
 * - pairRelations.ts       -> 双星组合关系
 * - pairProfiles/registry  -> 双星组合人格知识
 * - labels.ts              -> 中文名 / 动态组合名
 * - priorities.ts          -> 是否启用组合
 * - summaries.ts           -> 摘要生成与去重
 *
 * ------------------------------------------------------
 * 【当前注意事项】
 * 1. 旧文件 pairs.ts / units.ts 不应再作为正式入口导出
 * 2. mapper.ts 后续应只通过这里拿：
 *    - getStarProfile
 *    - getPairRelation
 *    - getPairProfile
 *    - getStarLabel
 *    - getPairLabelByStars
 *    - buildTraitSummaries
 *    - mergeUniqueSummaries
 *    - isEnabledPair
 *
 * ======================================================
 */

/**
 * ======================================================
 * 星曜定义
 * ======================================================
 */
export {
  stars,
  getStarById,
  getAllStars
} from "./stars"

/**
 * ======================================================
 * 单星人格知识
 * ======================================================
 */
export {
  starProfiles,
  getStarProfile,
  getAllStarProfiles
} from "./starProfiles"

/**
 * ======================================================
 * 双星组合关系
 * ======================================================
 *
 * 说明：
 * - 这里只负责“谁和谁构成组合”
 * - 不负责组合人格内容
 */
export {
  pairRelations,
  getPairRelation,
  getAllPairRelations
} from "./pairRelations"

/**
 * ======================================================
 * 双星组合人格知识
 * ======================================================
 *
 * 说明：
 * - 正式走 pairProfiles/registry.ts
 * - 不再走旧的大 pairProfiles.ts 或 pairs.ts
 */
export {
  allPairProfiles,
  getPairProfile,
  getAllPairProfiles
} from "./pairProfiles/registry"

/**
 * ======================================================
 * 名称与标签
 * ======================================================
 */
export {
  getStarLabel,
  getPairLabelByStars
} from "./labels"

/**
 * ======================================================
 * 启用规则
 * ======================================================
 */
export {
  ENABLED_PAIR_IDS,
  isEnabledPair
} from "./priorities"

/**
 * ======================================================
 * 摘要处理
 * ======================================================
 */
export {
  buildTraitSummaries,
  mergeUniqueSummaries
} from "./summaries"