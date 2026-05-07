/**
 * 当前文件负责：展示圆形小地图内部点位。
 */

import type { WorldMiniMapMarker } from "./WorldMiniMapTypes"

import styles from "@/styles/world-styles/minimap/world-mini-map-markers.module.css"

type Props = {
  markers: WorldMiniMapMarker[]
}

function getMarkerToneClass(marker: WorldMiniMapMarker): string {
  if (marker.tone === "pet") return styles.pet
  if (marker.tone === "butler") return styles.butler
  if (marker.tone === "incubator") return styles.incubator
  if (marker.tone === "home") return styles.home

  return styles.quiet
}

export default function WorldMiniMapMarkers({ markers }: Props) {
  return (
    <>
      {markers.map((marker) => {
        if (!marker.isVisible) return null

        return (
          <div
            className={`${styles.marker} ${getMarkerToneClass(marker)}`}
            key={marker.id}
            style={{
              left: `${marker.x}%`,
              top: `${marker.y}%`,
            }}
            title={`${marker.label}：${marker.helperText}`}
          >
            <span />
          </div>
        )
      })}
    </>
  )
}