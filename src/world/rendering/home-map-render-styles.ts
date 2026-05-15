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
  page: {
    background: "#10200f",
    minHeight: "100vh",
  },
  viewport: {
    height: "100vh",
    overflow: "auto",
    width: "100vw",
  },
  mapCanvas: {
    background: "#4c7337",
    imageRendering: "pixelated",
    position: "relative",
  },
  ground: {
    backgroundColor: "#4c7337",
    left: 0,
    position: "absolute",
    top: 0,
    zIndex: LAYER_Z_INDEX.ground,
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
  grid: {
    backgroundImage:
      "linear-gradient(to right, rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,.34) 2px, transparent 2px), linear-gradient(to bottom, rgba(255,255,255,.34) 2px, transparent 2px)",
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    zIndex: 450,
  },
  label: {
    alignItems: "center",
    background: "rgba(16, 24, 15, 0.86)",
    color: "#ffffff",
    display: "flex",
    fontFamily: "Arial, Microsoft YaHei, sans-serif",
    fontSize: 12,
    fontWeight: 800,
    height: 14,
    justifyContent: "center",
    lineHeight: "14px",
    pointerEvents: "none",
    position: "absolute",
    zIndex: 500,
  },
  hiddenStatus: {
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: 1,
  },
} satisfies Record<string, CSSProperties>
