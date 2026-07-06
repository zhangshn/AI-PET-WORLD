import type { ZiweiDynamicFlowType } from "@/ai/destiny-core/ziwei-core/contracts"

export const ZIWEI_DYNAMIC_FLOW_DEPTH: Record<ZiweiDynamicFlowType, number> = {
  natal: 0,
  daYun: 1,
  liuNian: 2,
  liuYue: 3,
  liuRi: 4,
  liuShi: 5
}

export function isZiweiDynamicFlowWithinSelectedDepth(params: {
  selectedFlowType: ZiweiDynamicFlowType
  targetFlowType: ZiweiDynamicFlowType
}): boolean {
  return (
    ZIWEI_DYNAMIC_FLOW_DEPTH[params.selectedFlowType] >=
    ZIWEI_DYNAMIC_FLOW_DEPTH[params.targetFlowType]
  )
}
