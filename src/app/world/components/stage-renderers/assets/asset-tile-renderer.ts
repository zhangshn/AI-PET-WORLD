/**
 * 当前文件负责：预留未来基于真实像素瓦片素材的地图渲染入口。
 */

import type { Container } from "pixi.js"

import type { WorldMapState } from "@/world/map/world-map"

export type DrawAssetWorldTilesInput = {
  terrainLayer: Container | null
  detailLayer: Container | null
  map: WorldMapState | null
}

export function drawAssetWorldTiles(input: DrawAssetWorldTilesInput) {
  void input
}