/**
 * 当前文件负责：展示紫微盘宫格内的本命、大命、年命、月命、日命、时命标记列表。
 */

import { ZiweiFlowMarkerBadge } from "./ZiweiFlowMarkerBadge"
import type { ZiweiChartFlowMarker } from "./ziwei-chart-types"

export function ZiweiFlowMarkers({
  markers
}: {
  markers: ZiweiChartFlowMarker[]
}) {
  if (markers.length === 0) {
    return null
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        marginBottom: 8
      }}
    >
      {markers.map((marker) => {
        return (
          <ZiweiFlowMarkerBadge
            key={`${marker.kind}-${marker.palace}`}
            marker={marker}
          />
        )
      })}
    </div>
  )
}