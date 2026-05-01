/**
 * 当前文件负责：定义紫微测试盘展示组件使用的局部类型。
 */

import type {
  BranchPalace,
  SectorName
} from "../../../../ai/ziwei-core/schema"

export type ZiweiChartFlowMarkerKind =
  | "natal"
  | "daYun"
  | "liuNian"
  | "liuYue"
  | "liuRi"
  | "liuShi"

export type ZiweiChartFlowMarker = {
  kind: ZiweiChartFlowMarkerKind
  label: string
  palace: BranchPalace
  active: boolean
  inactive?: boolean
}

export type ZiweiChartSectorMap = Record<BranchPalace, SectorName>