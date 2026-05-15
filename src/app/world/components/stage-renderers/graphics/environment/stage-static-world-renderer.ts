/**
 * 当前文件负责：组合渲染世界舞台中的静态地图、地图结构与氛围层。
 */

import type { Container } from "pixi.js"

import type { HomeState } from "@/types/home"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import { drawStageBackground } from "./stage-atmosphere-renderer"
import { drawMvpAssetScene } from "../assets/stage-mvp-asset-scene-renderer"

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

  drawStageBackground({
    layer: backgroundLayer,
    mapWidth,
    mapHeight,
  })

  /**
   * MVP PNG 坐标地图阶段：
   * 旧 Graphics 草地、水体、森林、旧建筑、旧区域全部停止渲染。
   * 当前外部世界只读取 initial-home 分层坐标数据进行 PNG 拼装。
   */
  drawMvpAssetScene({
    terrainLayer,
    structureLayer,
    natureLayer,
    coordinateLayer: foregroundLayer ?? structureLayer,
    map,
    home: input.home,
  })
}

export function getStaticWorldRenderKey(input: {
  runtime: WorldRuntimeState | null
  home: HomeState | null
}): string {
  const map = input.runtime?.map

  if (!map) return "mvp-initial-home-empty-map"

  return [
    "mvp-initial-home",
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
