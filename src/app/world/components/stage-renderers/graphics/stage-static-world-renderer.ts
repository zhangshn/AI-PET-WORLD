/**
 * 当前文件负责：组合渲染世界舞台中的静态地图、地图结构与氛围层。
 */

import type { Container } from "pixi.js"

import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import {
  drawAmbientNature,
  drawForegroundAtmosphere,
  drawStageBackground,
} from "./stage-atmosphere-renderer"
import {
  drawGarden,
  drawHomeConstruction,
  drawTempShelter,
  resolveStageStructureLayout,
} from "./stage-structure-renderer"
import { drawWorldTiles } from "./stage-tile-renderer"

export type StaticWorldLayerRefs = {
  backgroundLayer: Container | null
  terrainLayer: Container | null
  structureLayer: Container | null
  natureLayer: Container | null
  foregroundLayer: Container | null
}

export type DrawStaticWorldInput = {
  layers: StaticWorldLayerRefs
  runtime: WorldRuntimeState | null
  fallbackWidth: number
  fallbackHeight: number
}

export function drawStaticWorld(input: DrawStaticWorldInput) {
  const backgroundLayer = input.layers.backgroundLayer
  const terrainLayer = input.layers.terrainLayer
  const structureLayer = input.layers.structureLayer
  const natureLayer = input.layers.natureLayer
  const foregroundLayer = input.layers.foregroundLayer

  if (
    !backgroundLayer ||
    !terrainLayer ||
    !structureLayer ||
    !natureLayer ||
    !foregroundLayer
  ) {
    return
  }

  backgroundLayer.removeChildren()
  terrainLayer.removeChildren()
  structureLayer.removeChildren()
  natureLayer.removeChildren()
  foregroundLayer.removeChildren()

  const map = input.runtime?.map ?? null
  const mapWidth = map ? map.size.width * map.tileSize : input.fallbackWidth
  const mapHeight = map ? map.size.height * map.tileSize : input.fallbackHeight
  const structureLayout = resolveStageStructureLayout(map)

  drawStageBackground({
    layer: backgroundLayer,
    mapWidth,
    mapHeight,
  })

  drawWorldTiles({
    terrainLayer,
    detailLayer: natureLayer,
    map,
  })

  drawAmbientNature({
    layer: natureLayer,
    mapWidth,
    mapHeight,
  })

  drawTempShelter(structureLayer, structureLayout.tempShelter)
  drawHomeConstruction(structureLayer, structureLayout.homeConstruction)
  drawGarden(structureLayer, structureLayout.garden)

  drawForegroundAtmosphere({
    layer: foregroundLayer,
    mapWidth,
    mapHeight,
  })
}

export function getStaticWorldRenderKey(
  runtime: WorldRuntimeState | null
): string {
  const map = runtime?.map

  if (!map) return "empty-map"

  return `${map.id}-${map.size.width}-${map.size.height}-${map.tileSize}`
}