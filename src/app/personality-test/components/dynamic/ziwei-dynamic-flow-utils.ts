/**
 * 当前文件负责：提供紫微动态流结果读取工具。
 */

import type {
  ZiweiDynamicChart,
  ZiweiFlowResult
} from "../../../../ai/destiny-core/ziwei-core/dynamic/dynamic-schema"

import type { ActiveDynamicFlow } from "../../personality-test-types"

export function getActiveFlowResult(
  chart: ZiweiDynamicChart,
  activeFlow: ActiveDynamicFlow
): ZiweiFlowResult {
  return chart[activeFlow]
}