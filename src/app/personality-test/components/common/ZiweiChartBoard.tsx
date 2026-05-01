/**
 * 当前文件负责：展示紫微十二宫盘，并高亮当前动态流落宫。
 */

import type {
  BirthPattern,
  BranchPalace,
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
  activePalace
}: {
  pattern: BirthPattern
  activePalace?: BranchPalace
}) {
  function renderBranchCell(branch: BranchPalace) {
    const sector = pattern.branchToSectorMap[branch]
    const stars = pattern.branchPalaces[branch] || []
    const borrowedStars = getBorrowedStarsByBranch(branch, pattern.borrowedPalaces)

    const isPrimary = branch === pattern.primaryBranchPalace
    const isBody = branch === pattern.bodyBranchPalace
    const isSupport = pattern.supportBranchPalaces.includes(branch)
    const isOpposite = branch === pattern.oppositeBranchPalace
    const isActive = branch === activePalace
    const isEmpty = stars.length === 0

    let border = "1px solid #ccc"
    let background = "#fff"

    if (isPrimary) {
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
            {isPrimary ? " ⭐命" : ""}
            {isBody ? " ◎身" : ""}
            {isActive ? " ◆流" : ""}
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