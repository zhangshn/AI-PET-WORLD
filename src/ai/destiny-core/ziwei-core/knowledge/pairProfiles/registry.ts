/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - Registry
 * ======================================================
 *
 * 【文件职责】
 * 这个文件是“双星组合人格资料”的统一注册表。
 *
 * 它负责：
 * 1. 汇总所有按星曜拆分的组合文件
 * 2. 对外提供统一查询入口
 * 3. 屏蔽内部拆分细节
 *
 * ------------------------------------------------------
 * 【为什么需要 registry.ts】
 * 因为我们现在已经决定：
 * - 组合星资料不做成一个巨大 pairProfiles.ts
 * - 而是拆成：
 *   ziweiPairs.ts
 *   tanlangPairs.ts
 *   jumenPairs.ts
 *   ...
 *
 * 但是外部算法（比如 mapper.ts）不应该知道内部拆成了多少文件。
 * 外部应该只会做一件事：
 *
 *   getPairProfile(pairId)
 *
 * 所以需要 registry.ts 作为统一入口。
 *
 * ------------------------------------------------------
 * 【重要规则】
 * 每个组合只能定义一次，不能重复。
 *
 * 例如：
 * - 紫微 + 破军
 *   只写在 ziweiPairs.ts
 *   不再在 pojunPairs.ts 重复写一遍
 *
 * 这样可以避免：
 * - 重复定义
 * - pairId 冲突
 * - 数据覆盖
 * - 后期维护混乱
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

import { ziweiPairs } from "./ziweiPairs"
import { tanlangPairs } from "./tanlangPairs"
import { jumenPairs } from "./jumenPairs"
import { lianzhenPairs } from "./lianzhenPairs"
import { wuquPairs } from "./wuquPairs"
import { pojunPairs } from "./pojunPairs"
import { tianfuPairs } from "./tianfuPairs"
import { tianjiPairs } from "./tianjiPairs"
import { tianxiangPairs } from "./tianxiangPairs"
import { tianliangPairs } from "./tianliangPairs"
import { tiantongPairs } from "./tiantongPairs"
import { qishaPairs } from "./qishaPairs"
import { taiyangPairs } from "./taiyangPairs"
import { taiyinPairs } from "./taiyinPairs"

/**
 * ======================================================
 * 所有组合人格资料总表
 * ======================================================
 *
 * 说明：
 * - 这里按文件顺序统一展开
 * - 以后 mapper / summaries / debug 都应该从这里获取 pairProfile
 */
export const allPairProfiles: PairProfile[] = [
  ...ziweiPairs,
  ...tanlangPairs,
  ...jumenPairs,
  ...lianzhenPairs,
  ...wuquPairs,
  ...pojunPairs,
  ...tianfuPairs,
  ...tianjiPairs,
  ...tianxiangPairs,
  ...tianliangPairs,
  ...tiantongPairs,
  ...qishaPairs,
  ...taiyangPairs,
  ...taiyinPairs
]

/**
 * ======================================================
 * 通过 pairId 获取组合人格资料
 * ======================================================
 */
export function getPairProfile(pairId: string): PairProfile | null {
  return allPairProfiles.find((item) => item.pairId === pairId) ?? null
}

/**
 * ======================================================
 * 获取全部组合人格资料
 * ======================================================
 */
export function getAllPairProfiles(): PairProfile[] {
  return allPairProfiles
}