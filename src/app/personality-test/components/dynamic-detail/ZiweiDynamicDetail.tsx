/**
 * 当前文件负责：组装紫微动态详情展示。
 */

import type {
  ZiweiDynamicInfluence,
  ZiweiFlowResult
} from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import { DynamicBiasGrid } from "./DynamicBiasGrid"
import { DynamicDebugFlows } from "./DynamicDebugFlows"
import { DynamicFlowSummary } from "./DynamicFlowSummary"
import { DynamicPreferenceLines } from "./DynamicPreferenceLines"

export function ZiweiDynamicDetail({
  flow,
  influence
}: {
  flow: ZiweiFlowResult
  influence: ZiweiDynamicInfluence
}) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 14,
        background: "#fafafa"
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 18
        }}
      >
        <DynamicFlowSummary flow={flow} />
        <DynamicPreferenceLines influence={influence} />
        <DynamicBiasGrid influence={influence} />
        <DynamicDebugFlows influence={influence} />
      </div>
    </div>
  )
}