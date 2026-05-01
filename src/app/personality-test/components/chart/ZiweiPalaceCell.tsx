/**
 * 当前文件负责：组装紫微测试盘中的单个宫格。
 */

import type {
  BirthPattern,
  BranchPalace,
  SectorName
} from "../../../../ai/ziwei-core/schema"

import { ZiweiBorrowedStarList } from "./ZiweiBorrowedStarList"
import { ZiweiFlowMarkers } from "./ZiweiFlowMarkers"
import { ZiweiPalaceHeader } from "./ZiweiPalaceHeader"
import { ZiweiStarList } from "./ZiweiStarList"

import {
  getBorrowedStarsByBranch
} from "./ziwei-chart-utils"

import {
  getZiweiPalaceCellStyle
} from "./ziwei-palace-style"

import type { ZiweiChartFlowMarker } from "./ziwei-chart-types"

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

  const { border, background } = getZiweiPalaceCellStyle({
    isNatalLife,
    isDynamicLife,
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
      <ZiweiPalaceHeader
        branch={branch}
        sector={sector}
        isDynamicLife={isDynamicLife}
        isNatalLife={isNatalLife}
        isBody={isBody}
      />

      <ZiweiFlowMarkers markers={markers} />

      <ZiweiStarList stars={stars} />

      <ZiweiBorrowedStarList
        branch={branch}
        borrowedStars={borrowedStars}
        visible={isEmpty}
      />
    </div>
  )
}