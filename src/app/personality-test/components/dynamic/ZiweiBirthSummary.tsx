/**
 * 当前文件负责：展示紫微命盘的出生与本命摘要。
 */

import type { BirthPattern } from "../../../../ai/ziwei-core/schema"

import {
  BRANCH_FULL_LABELS,
  BRANCH_LABELS,
  ELEMENT_GATE_LABELS
} from "../../constants"

import { ValueLine } from "../common/ValueLine"

export function ZiweiBirthSummary({
  pattern
}: {
  pattern: BirthPattern
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
        lineHeight: 1.8,
        marginBottom: 16
      }}
    >
      <ValueLine label="Birth Key" value={pattern.birthKey} />
      <ValueLine
        label="农历"
        value={`${pattern.lunarInfo.lunarYear}-${pattern.lunarInfo.lunarMonth}-${pattern.lunarInfo.lunarDay}`}
      />
      <ValueLine
        label="出生时辰"
        value={`${pattern.timeBranch}（${BRANCH_LABELS[pattern.timeBranch]}）`}
      />
      <ValueLine
        label="五行局"
        value={`${pattern.elementGate}（${
          ELEMENT_GATE_LABELS[pattern.elementGate] ?? pattern.elementGate
        }）`}
      />
      <ValueLine
        label="本命命宫"
        value={`${pattern.primaryBranchPalace}（${BRANCH_FULL_LABELS[pattern.primaryBranchPalace]}）`}
      />
      <ValueLine
        label="身宫"
        value={`${pattern.bodyBranchPalace}（${BRANCH_FULL_LABELS[pattern.bodyBranchPalace]}）`}
      />
    </div>
  )
}