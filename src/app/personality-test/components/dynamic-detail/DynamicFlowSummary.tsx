/**
 * 当前文件负责：展示当前紫微动态流的基础摘要。
 */

import type { ZiweiFlowResult } from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import {
  BRANCH_FULL_LABELS,
  DYNAMIC_FLOW_LABELS
} from "../../constants"

import {
  getSectorLabel,
  getStarDisplay
} from "../../utils"

import { ValueLine } from "../common/ValueLine"

export function DynamicFlowSummary({
  flow
}: {
  flow: ZiweiFlowResult
}) {
  return (
    <div style={{ lineHeight: 1.9 }}>
      <ValueLine
        label="当前层级"
        value={DYNAMIC_FLOW_LABELS[flow.type] ?? flow.type}
      />
      <ValueLine
        label="动态命宫"
        value={`${flow.palace}（${BRANCH_FULL_LABELS[flow.palace]}）`}
      />
      <ValueLine
        label="动态宫名"
        value={getSectorLabel(flow.sectorName)}
      />
      <ValueLine
        label="是否生效"
        value={flow.isActive ? "是" : "否"}
      />
      <ValueLine
        label="影响权重"
        value={flow.influence}
      />
      <ValueLine
        label="星曜"
        value={
          flow.stars.length > 0
            ? flow.stars.map(getStarDisplay).join(" / ")
            : "空宫"
        }
      />
      <ValueLine
        label="组合"
        value={flow.pairIds.length > 0 ? flow.pairIds.join(" / ") : "无"}
      />

      {!flow.isActive && flow.inactiveReason && (
        <div style={{ color: "#8c6d1f", marginTop: 8 }}>
          {flow.inactiveReason}
        </div>
      )}
    </div>
  )
}