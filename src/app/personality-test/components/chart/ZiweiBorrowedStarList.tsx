/**
 * 当前文件负责：展示紫微宫格中的借星信息。
 */

import type {
  BranchPalace,
  StarId
} from "../../../../ai/ziwei-core/schema"

import { getStarDisplay } from "../../utils"

export function ZiweiBorrowedStarList({
  branch,
  borrowedStars,
  visible
}: {
  branch: BranchPalace
  borrowedStars: StarId[]
  visible: boolean
}) {
  if (!visible || borrowedStars.length === 0) {
    return null
  }

  return (
    <div style={{ lineHeight: 1.6, marginTop: 8, color: "#666" }}>
      <div style={{ marginBottom: 4 }}>借星：</div>
      {borrowedStars.map((starId) => (
        <div key={`borrowed-${branch}-${starId}`}>
          {getStarDisplay(starId)}
        </div>
      ))}
    </div>
  )
}