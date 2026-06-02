/**
 * 当前文件负责：定义世界地图素材注册表的数据结构。
 */

export type WorldMapAssetCategory =
  | "ground"
  | "path"
  | "edge"
  | "zone"
  | "structure"
  | "facility"
  | "nature"
  | "surface_decoration"
  | "actor"

export type WorldMapAssetAnchor = "top-left" | "bottom-center" | "center"

export type WorldMapAssetSize = 24 | 32 | 64 | 128

export type WorldMapAssetCanvasMeta = {
  sourceRect?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type WorldMapAssetDefinition = {
  id: string
  category: WorldMapAssetCategory
  baseSize: WorldMapAssetSize
  anchor: WorldMapAssetAnchor
  description: string
  canvas?: WorldMapAssetCanvasMeta
}
