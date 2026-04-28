/**
 * 当前文件负责：定义世界地图瓦片主题与未来 tileset 选择策略。
 */

import type { WorldMapTileType } from "@/world/map/world-map"

import { STAGE_ASSET_MANIFEST } from "./asset-manifest"
import { getStageTileVisual } from "./stage-visual-config"

export type StageTileThemeMode = "procedural_graphics" | "asset_tileset"

export type StageTileThemeDefinition = {
  tileType: WorldMapTileType
  mode: StageTileThemeMode
  assetIds: string[]
  baseColor: number
  edgeColor: number
  detailColor: number
}

export function getStageTileTheme(
  tileType: WorldMapTileType
): StageTileThemeDefinition {
  const visual = getStageTileVisual(tileType)

  return {
    tileType,
    mode: "procedural_graphics",
    assetIds: STAGE_ASSET_MANIFEST.tiles[tileType] ?? [],
    baseColor: visual.base,
    edgeColor: visual.edge,
    detailColor: visual.detail,
  }
}