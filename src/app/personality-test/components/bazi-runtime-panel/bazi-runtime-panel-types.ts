/**
 * 当前文件负责：定义八字动态面板展示组件使用的局部类型。
 */

import type {
  BaziRuntimeFlowLevel,
  BaziRuntimeProfile,
  BaziRuntimeTimeSelection as CoreBaziRuntimeTimeSelection
} from "../../../../ai/bazi-core/bazi-gateway"

export type BaziRuntimeProfileView = BaziRuntimeProfile

export type BaziRuntimeActiveLevel = BaziRuntimeFlowLevel

export type BaziRuntimeTimeSelection = CoreBaziRuntimeTimeSelection
