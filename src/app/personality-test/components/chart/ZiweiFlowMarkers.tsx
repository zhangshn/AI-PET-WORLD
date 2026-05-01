/**
 * 当前文件负责：展示紫微盘宫格内的本命、大命、年命、月命、日命、时命标记。
 */

import type { ZiweiChartFlowMarker } from "./ziwei-chart-types"

function getMarkerColor(marker: ZiweiChartFlowMarker): {
  border: string
  background: string
  color: string
} {
  if (marker.inactive) {
    return {
      border: "#ddd",
      background: "#f5f5f5",
      color: "#999"
    }
  }

  if (marker.active) {
    return {
      border: "#722ed1",
      background: "#722ed1",
      color: "#fff"
    }
  }

  if (marker.kind === "natal") {
    return {
      border: "#ff4d4f",
      background: "#fff1f0",
      color: "#a8071a"
    }
  }

  if (marker.kind === "daYun") {
    return {
      border: "#1677ff",
      background: "#e6f4ff",
      color: "#0958d9"
    }
  }

  if (marker.kind === "liuNian") {
    return {
      border: "#fa8c16",
      background: "#fff7e6",
      color: "#ad4e00"
    }
  }

  if (marker.kind === "liuYue") {
    return {
      border: "#52c41a",
      background: "#f6ffed",
      color: "#237804"
    }
  }

  if (marker.kind === "liuRi") {
    return {
      border: "#13c2c2",
      background: "#e6fffb",
      color: "#006d75"
    }
  }

  return {
    border: "#eb2f96",
    background: "#fff0f6",
    color: "#c41d7f"
  }
}

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
        const color = getMarkerColor(marker)

        return (
          <span
            key={`${marker.kind}-${marker.palace}`}
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
      })}
    </div>
  )
}