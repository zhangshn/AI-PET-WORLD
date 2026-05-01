/**
 * 当前文件负责：展示紫微宫格顶部的宫名、地支与本命/身宫标记。
 */

import type {
  BranchPalace,
  SectorName
} from "../../../../ai/ziwei-core/schema"

import { BRANCH_LABELS } from "../../constants"
import { getSectorLabel } from "../../utils"

export function ZiweiPalaceHeader({
  branch,
  sector,
  isDynamicLife,
  isNatalLife,
  isBody
}: {
  branch: BranchPalace
  sector: SectorName
  isDynamicLife: boolean
  isNatalLife: boolean
  isBody: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 8,
        gap: 8
      }}
    >
      <div style={{ fontWeight: "bold" }}>
        {getSectorLabel(sector)}
        {isDynamicLife ? " ◆命" : ""}
        {isNatalLife && !isDynamicLife ? " ☆本命" : ""}
        {isBody ? " ◎身" : ""}
      </div>

      <div style={{ color: "#666", fontSize: 12 }}>
        {BRANCH_LABELS[branch]}
      </div>
    </div>
  )
}