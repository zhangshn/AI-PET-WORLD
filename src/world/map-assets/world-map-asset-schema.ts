/**
 * Defines world fact asset identifiers used by runtime placement data.
 * These are semantic world assets, not renderer sprites or programmatic drawing assets.
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

export type WorldMapAssetDefinition = {
  id: string
  category: WorldMapAssetCategory
  baseSize: WorldMapAssetSize
  anchor: WorldMapAssetAnchor
  description: string
}
