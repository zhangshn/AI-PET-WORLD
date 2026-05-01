/**
 * 当前文件负责：展示紫微测试盘中的单个宫格。
 */

import type {
  BirthPattern,
  BranchPalace,
  SectorName,
  StarId
} from "../../../../ai/ziwei-core/schema"

import { BRANCH_LABELS } from "../../constants"
import {
  getSectorLabel,
  getStarDisplay
} from "../../utils"

import { ZiweiFlowMarkers } from "./ZiweiFlowMarkers"
import type { ZiweiChartFlowMarker } from "./ziwei-chart-types"

function getBorrowedStarsByBranch(
  branch: BranchPalace,
  borrowedPalaces: BirthPattern["borrowedPalaces"]
): StarId[] {
  const item = borrowedPalaces.find((palace) => {
    return palace.targetPalace === branch
  })

  return item?.stars ?? []
}

function getCellStyle(params: {
  isNatalLife: boolean
  isDynamicLife: boolean
  isBody: boolean
  isSupport: boolean
  isOpposite: boolean
  isActive: boolean
  hasActiveMarker: boolean
}): {
  border: string
  background: string
} {
  let border = "1px solid #ccc"
  let background = "#fff"

  if (params.isNatalLife) {
    border = "2px solid #ff4d4f"
    background = "#fff1f0"
  }

  if (params.isOpposite) {
    border = "2px solid #faad14"
    background = "#fffbe6"
  }

  if (params.isSupport) {
    border = "2px dashed #1677ff"
    background = "#f0f8ff"
  }

  if (params.isDynamicLife || params.isActive || params.hasActiveMarker) {
    border = "3px solid #722ed1"
    background = "#f9f0ff"
  }

  return {
    border,
    background
  }
}

export function ZiweiPalaceCell({
  pattern,
  branch,
  sector,
  activePalace,
  markers
}: {
  pattern: BirthPattern
  branch: BranchPalace
  sector: SectorName
  activePalace?: BranchPalace
  markers: ZiweiChartFlowMarker[]
}) {
  const stars = pattern.branchPalaces[branch] || []
  const borrowedStars = getBorrowedStarsByBranch(branch, pattern.borrowedPalaces)

  const isDynamicLife = sector === "life"
  const isNatalLife = branch === pattern.primaryBranchPalace
  const isBody = branch === pattern.bodyBranchPalace
  const isSupport = pattern.supportBranchPalaces.includes(branch)
  const isOpposite = branch === pattern.oppositeBranchPalace
  const isActive = branch === activePalace
  const isEmpty = stars.length === 0
  const hasActiveMarker = markers.some((marker) => {
    return marker.active
  })

  const { border, background } = getCellStyle({
    isNatalLife,
    isDynamicLife,
    isBody,
    isSupport,
    isOpposite,
    isActive,
    hasActiveMarker
  })

  return (
    <div
      style={{
        border,
        borderRadius: 8,
        padding: 10,
        fontSize: 12,
        minHeight: 168,
        background
      }}
    >
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

      <ZiweiFlowMarkers markers={markers} />

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