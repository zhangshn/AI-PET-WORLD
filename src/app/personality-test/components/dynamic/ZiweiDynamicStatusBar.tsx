/**
 * 当前文件负责：展示紫微动态测试的当前状态栏。
 */

import type {
  ZiweiFlowResult
} from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import {
  BRANCH_FULL_LABELS,
  BRANCH_LABELS
} from "../../constants"

import type { DynamicGenderInput } from "../../types"
import { ValueLine } from "../common/ValueLine"
import type { ZiweiDynamicTimeSelection } from "../ZiweiDynamicTimeTable"

export function ZiweiDynamicStatusBar({
  dynamicGender,
  timeSelection,
  activeFlowResult
}: {
  dynamicGender: DynamicGenderInput
  timeSelection: ZiweiDynamicTimeSelection
  activeFlowResult: ZiweiFlowResult | null
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        alignItems: "center",
        marginBottom: 12,
        lineHeight: 1.8
      }}
    >
      <ValueLine label="动态性别" value={dynamicGender || "未选择"} />
      <ValueLine label="当前年龄" value={timeSelection.currentAge} />
      <ValueLine
        label="当前时辰"
        value={`${timeSelection.currentTimeBranch}（${
          BRANCH_LABELS[timeSelection.currentTimeBranch]
        }）`}
      />

      {activeFlowResult && (
        <ValueLine
          label="当前动态命宫"
          value={`${activeFlowResult.palace}（${
            BRANCH_FULL_LABELS[activeFlowResult.palace]
          }）`}
        />
      )}
    </div>
  )
}