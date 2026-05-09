/**
 * 当前文件负责：兼容旧版八字解释入口。
 */

import type {
  BaziBehaviorTag,
  BaziDynamicsVector,
  WuXingElement
} from "./bazi-schema"

import { interpretBaziDynamics as interpretBaziDynamicsInternal } from "./bazi-summary"

export function interpretBaziDynamics(input: {
  dominantElements: WuXingElement[]
  dynamics: BaziDynamicsVector
  behaviorTags: BaziBehaviorTag[]
}) {
  return interpretBaziDynamicsInternal({
    ...input,
    mode: "FOUR_PILLARS",
  })
}