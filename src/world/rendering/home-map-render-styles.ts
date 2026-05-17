/**
 * 当前文件负责：集中管理家园地图渲染样式。
 */

import type { CSSProperties } from "react"

import type { MapPlacementLayer } from "@/world/map-state/home-map-state-schema"

export const LAYER_Z_INDEX: Record<MapPlacementLayer, number> = {
  ground: 1,
  path: 10,
  edge: 15,
  zone: 20,
  structure: 55,
  facility: 70,
  nature: 80,
  "surface-decoration": 90,
  actor: 120,
  atmosphere: 200,
}

export const HOME_MAP_RENDER_STYLES = {
  renderer: {
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    minHeight: "100%",
    minWidth: "100%",
    padding: 32,
  },
  mapCanvas: {
    background:
      "radial-gradient(circle at 38% 30%, rgba(124, 171, 81, 0.38), transparent 34%), radial-gradient(circle at 70% 72%, rgba(51, 96, 45, 0.32), transparent 38%), linear-gradient(135deg, #5b7f3e 0%, #54783b 46%, #486f35 100%)",
    boxShadow: "0 28px 80px rgba(5, 18, 9, 0.36)",
    imageRendering: "pixelated",
    overflow: "hidden",
    position: "relative",
  },
  ground: {
    backgroundColor: "#4c7337",
    left: 0,
    position: "absolute",
    top: 0,
    zIndex: LAYER_Z_INDEX.ground,
  },
  groundCanvas: {
    imageRendering: "pixelated",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
  },
  canvasLayer: {
    imageRendering: "pixelated",
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    zIndex: 0,
  },
  sprite: {
    boxSizing: "border-box",
    imageRendering: "pixelated",
    pointerEvents: "none",
    position: "absolute",
  },
  dayNightAtmosphere: {
    background:
      "linear-gradient(180deg, rgba(255, 226, 145, 0.08), transparent 42%, rgba(26, 40, 76, 0.14))",
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    zIndex: LAYER_Z_INDEX.atmosphere,
  },
} satisfies Record<string, CSSProperties>
