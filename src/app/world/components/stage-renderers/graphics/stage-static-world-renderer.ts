/**
 * 当前文件负责：组合渲染世界舞台中的静态地图、地图结构与氛围层。
 */

import { Graphics, type Container } from "pixi.js"

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

  /**
   * 背景、地形、结构是外部世界的最低必需层。
   * 氛围层和前景层允许暂时为空，避免整个世界被跳过。
   */
  if (!backgroundLayer || !terrainLayer || !structureLayer) {
    return
  }

  backgroundLayer.removeChildren()
  terrainLayer.removeChildren()
  structureLayer.removeChildren()
  natureLayer?.removeChildren()
  foregroundLayer?.removeChildren()

  const map = input.runtime?.map ?? null
  const mapWidth = map ? map.size.width * map.tileSize : input.fallbackWidth
  const mapHeight = map ? map.size.height * map.tileSize : input.fallbackHeight
  const structureLayout = resolveStageStructureLayout(map)

  drawStageBackground({
    layer: backgroundLayer,
    mapWidth,
    mapHeight,
  })

  /**
   * 临时调试块：
   * 如果这个红色方块能显示，说明 Pixi 图层和 camera 没问题，
   * 问题在 tile/structure 的绘制逻辑。
   *
   * 如果红色方块也看不到，说明 worldLayer/camera/layer 挂载有问题。
   */
  const debugBox = new Graphics()

  debugBox.rect(40, 40, 120, 80).fill({
    color: 0xff0000,
    alpha: 0.85,
  })

  structureLayer.addChild(debugBox)

  drawWorldTiles({
    terrainLayer,
    detailLayer: natureLayer ?? terrainLayer,
    map,
  })

  if (natureLayer) {
    drawAmbientNature({
      layer: natureLayer,
      mapWidth,
      mapHeight,
    })
  }

  drawTempShelter(structureLayer, structureLayout.tempShelter)
  drawHomeConstruction(structureLayer, structureLayout.homeConstruction)
  drawGarden(structureLayer, structureLayout.garden)

  if (foregroundLayer) {
    drawForegroundAtmosphere({
      layer: foregroundLayer,
      mapWidth,
      mapHeight,
    })
  }
}

export function getStaticWorldRenderKey(
  runtime: WorldRuntimeState | null
): string {
  const map = runtime?.map

  if (!map) return "empty-map"

  return `${map.id}-${map.size.width}-${map.size.height}-${map.tileSize}`
}