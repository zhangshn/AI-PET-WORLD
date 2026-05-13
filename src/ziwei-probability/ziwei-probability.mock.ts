/**
 * 当前文件负责：提供紫微概率解释的 mock 输入。
 */

import {
  buildZiweiProbabilityProfile,
} from "./ziwei-probability-aggregator"
import type {
  ZiweiProbabilityInput,
  ZiweiProbabilityProfile,
} from "./ziwei-probability.types"

export const mockZiweiProbabilityInputs: ZiweiProbabilityInput[] = [
  {
    primaryStars: ["ziwei", "wuqu", "tianfu"],
    pairIds: ["ziwei_tianfu", "wuqu_tianfu"],
    source: "mock",
  },
  {
    primaryStars: ["tiantong", "taiyin", "tianliang"],
    pairIds: [
      "tiantong_taiyin",
      "tiantong_tianliang",
      "taiyin_tianliang",
    ],
    source: "mock",
  },
  {
    primaryStars: ["qisha", "lianzhen", "jumen"],
    pairIds: ["lianzhen_qisha", "tianji_jumen"],
    source: "mock",
  },
  {
    primaryStars: ["tanlang", "lianzhen", "taiyang"],
    pairIds: ["lianzhen_tanlang", "wuqu_tanlang", "taiyang_jumen"],
    source: "mock",
  },
  {
    primaryStars: ["taiyin", "tianfu", "jumen"],
    pairIds: ["tianji_taiyin", "tiantong_jumen", "taiyin_tianliang"],
    source: "mock",
  },
  {
    primaryStars: ["tianji", "pojun", "qisha"],
    pairIds: ["ziwei_pojun", "wuqu_pojun", "qisha_pojun"],
    source: "mock",
  },
]

export const mockZiweiProbabilityProfiles: ZiweiProbabilityProfile[] =
  mockZiweiProbabilityInputs.map(buildZiweiProbabilityProfile)
