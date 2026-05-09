/**
 * 当前文件负责：定义当前生命运行动态数据包。
 */

import type {
  CurrentDynamicProfile
} from "../destiny-core/ziwei-core/ziwei-gateway"

import type {
  BaziCurrentTendencyProfile,
  BaziRuntimeProfile
} from "../destiny-core/bazi-core/bazi-gateway"

import type {
  CurrentLifeTendencyProfile
} from "./life-tendency-schema"

export interface CurrentLifeRuntimeBundle {
  /**
   * 紫微当前动态人格。
   * 出生时间未知时可能为 null。
   */
  ziweiDynamicProfile: CurrentDynamicProfile | null

  /**
   * 八字当前动态运行层。
   */
  baziRuntimeProfile: BaziRuntimeProfile

  /**
   * 八字当前流动气质与行动趋向。
   */
  baziTendencyProfile: BaziCurrentTendencyProfile

  /**
   * 紫微主导 + 八字辅助 + 五维映射后的当前生命趋向。
   */
  lifeTendencyProfile: CurrentLifeTendencyProfile

  debug: {
    hasZiweiDynamicProfile: boolean
    hasBaziRuntimeProfile: boolean
    runtimeSource: "life-runtime-bundle"
  }
}