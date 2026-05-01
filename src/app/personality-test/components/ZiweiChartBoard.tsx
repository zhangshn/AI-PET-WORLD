/**
 * 当前文件负责：展示紫微十二宫盘，并支持动态命宫重排后的宫名显示。
 */

import type {
  BirthPattern,
  BranchPalace,
  SectorName,
  StarId
} from "../../../ai/ziwei-core/schema"

import {
  BRANCH_LABELS,
  ZIWEI_LAYOUT
} from "../constants"

import {
  getSectorLabel,
  getStarDisplay
} from "../utils"

function getBorrowedStarsByBranch(
  branch: BranchPalace,
  borrowedPalaces: BirthPattern["borrowedPalaces"]
): StarId[] {
  const item = borrowedPalaces.find((palace) => {
    return palace.targetPalace === branch
  })

  return item?.stars ?? []
}

export function ZiweiChartBoard({
  pattern,
  activePalace,
  branchToSectorMap
}: {
  pattern: BirthPattern
  activePalace?: BranchPalace

  /**
   * 如果传入，则按动态命宫重排后的宫名显示。
   * 如果不传，则显示原生命盘宫名。
   */
  branchToSectorMap?: Record<BranchPalace, SectorName>
}) {
  const displayBranchToSectorMap = branchToSectorMap ?? pattern.branchToSectorMap

  function renderBranchCell(branch: BranchPalace) {
    const sector = displayBranchToSectorMap[branch]
    const stars = pattern.branchPalaces[branch] || []
    const borrowedStars = getBorrowedStarsByBranch(branch, pattern.borrowedPalaces)

    const isDynamicLife = sector === "life"
    const isNatalLife = branch === pattern.primaryBranchPalace
    const isBody = branch === pattern.bodyBranchPalace
    const isSupport = pattern.supportBranchPalaces.includes(branch)
    const isOpposite = branch === pattern.oppositeBranchPalace
    const isActive = branch === activePalace
    const isEmpty = stars.length === 0

    let border = "1px solid #ccc"
    let background = "#fff"

    if (isNatalLife) {
      border = "2px solid #ff4d4f"
      background = "#fff1f0"
    }

    if (isOpposite) {
      border = "2px solid #faad14"
      background = "#fffbe6"
    }

    if (isSupport) {
      border = "2px dashed #1677ff"
      background = "#f0f8ff"
    }

    if (isDynamicLife) {
      border = "3px solid #722ed1"
      background = "#f9f0ff"
    }

    if (isActive) {
      border = "3px solid #722ed1"
      background = "#f9f0ff"
    }

    return (
      <div
        key={branch}
        style={{
          border,
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
          minHeight: 150,
          background
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8
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

        <div style={{ lineHeight: 1.6, marginBottom: 6 }}>
          {stars.length > 0 ? (
            <>
              <div style={{ color: "#333", marginBottom: 4 }}>原生星：</div>
              {stars.map((starId) => (
                <div key={starId}>{getStarDisplay(starId)}</div>
              ))}
            </>
          ) : (
            <div style={{ color: "#999" }}>原生：空宫</div>
          )}
        </div>

        {isEmpty && borrowedStars.length > 0 && (
          <div style={{ lineHeight: 1.6, marginTop: 8, color: "#666" }}>
            <div style={{ marginBottom: 4 }}>借星：</div>
            {borrowedStars.map((starId) => (
              <div key={`borrowed-${branch}-${starId}`}>
                {getStarDisplay(starId)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12
      }}
    >
      {ZIWEI_LAYOUT.flatMap((row, rowIndex) => {
        return row.map((branch, colIndex) => {
          if (!branch) {
            return (
              <div
                key={`empty-${rowIndex}-${colIndex}`}
                style={{
                  minHeight: 150,
                  borderRadius: 8,
                  background: "#f7f7f7"
                }}
              />
            )
          }

          return renderBranchCell(branch)
        })
      })}
    </div>
  )
}