/**
 * 当前文件负责：定义紫微动态层各时间流的影响权重。
 */

export const ZIWEI_DYNAMIC_FLOW_WEIGHTS = {
  natal: 1,
  daYun: 0.45,
  liuNian: 0.32,
  liuYue: 0.22,
  liuRi: 0.14,
  liuShi: 0.08
} as const

export type ZiweiDynamicFlowWeightKey =
  keyof typeof ZIWEI_DYNAMIC_FLOW_WEIGHTS

export function getZiweiDynamicFlowWeight(
  key: ZiweiDynamicFlowWeightKey
): number {
  return ZIWEI_DYNAMIC_FLOW_WEIGHTS[key]
}