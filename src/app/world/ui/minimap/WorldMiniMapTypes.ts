/**
 * 当前文件负责：提供 WorldMiniMap 组件共享类型。
 */

export type WorldMiniMapMarkerTone =
  | "pet"
  | "butler"
  | "incubator"
  | "home"
  | "quiet"

export type WorldMiniMapMarker = {
  id: string
  label: string
  helperText: string
  x: number
  y: number
  tone: WorldMiniMapMarkerTone
  isVisible: boolean
}