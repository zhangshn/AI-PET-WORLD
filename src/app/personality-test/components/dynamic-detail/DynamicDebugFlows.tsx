/**
 * 当前文件负责：展示紫微动态影响中的 debug flows。
 */

import type { ZiweiDynamicInfluence } from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import {
  BRANCH_FULL_LABELS,
  DYNAMIC_FLOW_LABELS
} from "../../constants"

export function DynamicDebugFlows({
  influence
}: {
  influence: ZiweiDynamicInfluence
}) {
  return (
    <div style={{ lineHeight: 1.8 }}>
      <strong>Debug Active Flows</strong>

      <div style={{ marginTop: 10 }}>
        {influence.debug.activeFlows.length > 0 ? (
          influence.debug.activeFlows.map((flow) => {
            return (
              <div key={`${flow.type}-${flow.palace}`}>
                {DYNAMIC_FLOW_LABELS[flow.type] ?? flow.type}：
                {flow.palace}（{BRANCH_FULL_LABELS[flow.palace]}）
                ，权重 {flow.influence}
                {!flow.isActive ? "，未生效" : ""}
              </div>
            )
          })
        ) : (
          <div style={{ color: "#999" }}>暂无 active flows</div>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        topBiases：
        {influence.debug.topBiases.length > 0
          ? influence.debug.topBiases.join(" / ")
          : "无"}
      </div>
    </div>
  )
}