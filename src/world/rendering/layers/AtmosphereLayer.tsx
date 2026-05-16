"use client"

/**
 * 当前文件负责：渲染地图氛围层。
 */

import { HOME_MAP_RENDER_STYLES } from "../home-map-render-styles"

export type AtmosphereLayerProps = {
  width: number
  height: number
}

export function AtmosphereLayer({ width, height }: AtmosphereLayerProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...HOME_MAP_RENDER_STYLES.dayNightAtmosphere,
        height,
        width,
      }}
    />
  )
}
