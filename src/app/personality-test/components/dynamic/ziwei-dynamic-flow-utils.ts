/**
 * 当前文件负责：提供紫微动态流结果读取工具。
 */

import type {
  ZiweiDynamicChart,
  ZiweiFlowResult
} from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import type { ActiveDynamicFlow } from "../../types"

export function getActiveFlowResult(
  chart: ZiweiDynamicChart,
  activeFlow: ActiveDynamicFlow
): ZiweiFlowResult {
  return chart[activeFlow]
}