/**
 * 当前文件负责：提供紫微测试盘展示组件使用的工具函数。
 */

import type {
  BirthPattern,
  BranchPalace,
  StarId
} from "../../../../ai/ziwei-core/schema"

import type { ZiweiChartFlowMarker } from "./ziwei-chart-types"

export function getBorrowedStarsByBranch(
  branch: BranchPalace,
  borrowedPalaces: BirthPattern["borrowedPalaces"]
): StarId[] {
  const item = borrowedPalaces.find((palace) => {
    return palace.targetPalace === branch
  })

  return item?.stars ?? []
}

export function getFlowMarkersByBranch(
  branch: BranchPalace,
  flowMarkers: ZiweiChartFlowMarker[]
): ZiweiChartFlowMarker[] {
  return flowMarkers.filter((marker) => {
    return marker.palace === branch
  })
}