/**
 * 当前文件负责：展示紫微十二宫盘布局。
 */

import type {
  BirthPattern,
  BranchPalace
} from "../../../ai/ziwei-core/schema"

import { ZIWEI_LAYOUT } from "../constants"

import { ZiweiPalaceCell } from "./chart/ZiweiPalaceCell"

import {
  getFlowMarkersByBranch
} from "./chart/ziwei-chart-utils"

import type {
  ZiweiChartFlowMarker,
  ZiweiChartSectorMap
} from "./chart/ziwei-chart-types"

export function ZiweiChartBoard({
  pattern,
  activePalace,
  branchToSectorMap,
  flowMarkers = []
}: {
  pattern: BirthPattern
  activePalace?: BranchPalace

  /**
   * 如果传入，则按动态命宫重排后的宫名显示。
   * 如果不传，则显示原生命盘宫名。
   */
  branchToSectorMap?: ZiweiChartSectorMap

  /**
   * 多层命宫标记。
   *
   * 例如：
   * 本命 / 大命 / 年命 / 月命 / 日命 / 时命
   */
  flowMarkers?: ZiweiChartFlowMarker[]
}) {
  const displayBranchToSectorMap = branchToSectorMap ?? pattern.branchToSectorMap

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
                  minHeight: 168,
                  borderRadius: 8,
                  background: "#f7f7f7"
                }}
              />
            )
          }

          return (
            <ZiweiPalaceCell
              key={branch}
              pattern={pattern}
              branch={branch}
              sector={displayBranchToSectorMap[branch]}
              activePalace={activePalace}
              markers={getFlowMarkersByBranch(branch, flowMarkers)}
            />
          )
        })
      })}
    </div>
  )
}