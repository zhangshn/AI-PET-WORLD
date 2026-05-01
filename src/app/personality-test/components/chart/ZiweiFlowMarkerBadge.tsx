/**
 * 当前文件负责：展示单个紫微动态命宫标记。
 */

import type { ZiweiChartFlowMarker } from "./ziwei-chart-types"
import { getZiweiFlowMarkerColor } from "./ziwei-flow-marker-style"

export function ZiweiFlowMarkerBadge({
  marker
}: {
  marker: ZiweiChartFlowMarker
}) {
  const color = getZiweiFlowMarkerColor(marker)

  return (
    <span
      title={marker.inactive ? `${marker.label}：尚未生效` : marker.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2px 6px",
        borderRadius: 999,
        border: `1px solid ${color.border}`,
        background: color.background,
        color: color.color,
        fontSize: 11,
        fontWeight: marker.active ? 800 : 600,
        lineHeight: 1.4,
        opacity: marker.inactive ? 0.65 : 1
      }}
    >
      {marker.label}
    </span>
  )
}