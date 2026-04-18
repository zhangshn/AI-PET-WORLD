/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Constants
 *
 * 功能：
 * 存放核心人格模块中的固定常量
 *
 * 为什么要单独拆出来：
 * 1. 避免 calculator / mapper 里塞满硬编码
 * 2. 后续调规则时，只改这里更清晰
 * 3. 让核心模块内部更容易维护
 * ======================================================
 */

import { CoreSymbol, SectorName } from "./schema"

/**
 * 固定的 12 区域顺序
 *
 * 说明：
 * 所有位置计算都以这个数组作为基础坐标系。
 */
export const SECTOR_ORDER: SectorName[] = [
  "sector_1",
  "sector_2",
  "sector_3",
  "sector_4",
  "sector_5",
  "sector_6",
  "sector_7",
  "sector_8",
  "sector_9",
  "sector_10",
  "sector_11",
  "sector_12"
]

/**
 * 当前版本支持的核心符号顺序
 *
 * 说明：
 * - 顺序固定
 * - 后续底层分配逻辑会用到
 */
export const SYMBOL_ORDER: CoreSymbol[] = [
  "core_alpha",
  "core_beta",
  "core_gamma",
  "core_delta",
  "core_epsilon",
  "core_zeta"
]

/**
 * 默认 traits 基础值
 *
 * 说明：
 * 当前 MVP 使用 50 作为中位基准。
 */
export const DEFAULT_TRAIT_VALUE = 50

/**
 * traits 数值允许的最小值
 */
export const MIN_TRAIT_VALUE = 0

/**
 * traits 数值允许的最大值
 */
export const MAX_TRAIT_VALUE = 100