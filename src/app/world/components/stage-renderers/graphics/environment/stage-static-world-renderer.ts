/**
 * 当前文件负责：组合渲染世界舞台中的静态地图、地图结构与氛围层。
 */

import type { Container } from "pixi.js"

import type { HomeState } from "@/types/home"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import {
  drawAmbientNature,
  drawForegroundAtmosphere,
  drawStageBackground,
} from "./stage-atmosphere-renderer"
import { drawMvpAssetScene } from "../assets/stage-mvp-asset-scene-renderer"
import {
  drawGarden,
  drawHomeConstruction,
  resolveStageStructureLayout,
} from "../structures/stage-structure-renderer"
import { drawWorldTiles } from "../tiles/stage-tile-renderer"

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
  home: HomeState | null
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

  drawWorldStructures({
    layer: structureLayer,
    home: input.home,
    structureLayout,
  })

  drawMvpAssetScene({
    structureLayer,
    natureLayer,
    map,
    home: input.home,
    structureLayout,
  })

  if (foregroundLayer) {
    drawForegroundAtmosphere({
      layer: foregroundLayer,
      mapWidth,
      mapHeight,
    })
  }
}

function drawWorldStructures(input: {
  layer: Container
  home: HomeState | null
  structureLayout: ReturnType<typeof resolveStageStructureLayout>
}) {
  const constructionStage = input.home?.constructionStage ?? "temporary_shelter"

  /**
   * MVP PNG 世界拼装阶段：临时住所与初始照护点改由 PNG 素材层承载。
   * 这里保留后续正式家园、花园的 Graphics 结构，避免一次性重构世界渲染链。
   */
  if (
    constructionStage === "foundation" ||
    constructionStage === "frame" ||
    constructionStage === "roof" ||
    constructionStage === "interior" ||
    constructionStage === "garden" ||
    constructionStage === "completed"
  ) {
    drawHomeConstruction(
      input.layer,
      input.structureLayout.homeConstruction,
      input.home
    )
  }

  if (constructionStage === "garden" || constructionStage === "completed") {
    drawGarden(input.layer, input.structureLayout.garden, input.home)
  }
}

export function getStaticWorldRenderKey(input: {
  runtime: WorldRuntimeState | null
  home: HomeState | null
}): string {
  const map = input.runtime?.map

  if (!map) return "empty-map"

  return [
    map.id,
    map.size.width,
    map.size.height,
    map.tileSize,
    input.home?.status ?? "no-home",
    input.home?.constructionStage ?? "no-stage",
    input.home?.progress ?? 0,
    input.home?.gardenProgress ?? 0,
    input.home?.comfort ?? 0,
    input.home?.stability ?? 0,
    input.home?.expansion ?? 0,
  ].join("-")
}
