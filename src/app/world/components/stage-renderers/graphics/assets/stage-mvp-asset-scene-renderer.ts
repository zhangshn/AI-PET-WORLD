/**
 * 当前文件负责：在 Pixi 世界舞台中渲染 MVP 阶段 PNG 素材拼装测试层。
 */

import { Container, Graphics, Sprite, Texture } from "pixi.js"

import type { HomeState } from "@/types/home"
import type { WorldMapState } from "@/world/map/world-map"

import { getMvpWorldAssetPath, type MvpWorldAssetId } from "../../assets/mvp-world-assets"
import type { StageStructureLayout } from "../structures/stage-structure-renderer"

export type DrawMvpAssetSceneInput = {
  structureLayer: Container
  natureLayer: Container | null
  map: WorldMapState | null
  home: HomeState | null
  structureLayout: StageStructureLayout
}

type MvpSpritePlacement = {
  assetId: MvpWorldAssetId
  x: number
  y: number
  scale: number
  alpha?: number
}

const TILE_SIZE = 32
const MAP_COLUMNS = 18
const MAP_ROWS = 12
const MAP_ORIGIN_X = 220
const MAP_ORIGIN_Y = 118

export function drawMvpAssetScene(input: DrawMvpAssetSceneInput) {
  drawMvpGround(input.structureLayer)
  drawMvpPaths(input.structureLayer)
  drawMvpZones(input.structureLayer)

  const naturePlacements: MvpSpritePlacement[] = [
    { assetId: "natureBushRoundLow01", x: tileX(2.3), y: tileY(2.6), scale: 0.72 },
    { assetId: "surfaceGrassTuftLow01", x: tileX(4.7), y: tileY(3.2), scale: 0.72 },
    { assetId: "natureBushRoundLow01", x: tileX(14.9), y: tileY(1.9), scale: 0.78 },
    { assetId: "surfaceGrassTuftLow01", x: tileX(15.6), y: tileY(8.8), scale: 0.68 },
    { assetId: "natureBushRoundLow01", x: tileX(2.0), y: tileY(10.6), scale: 0.74 },
  ]

  const structurePlacements: MvpSpritePlacement[] = [
    { assetId: "arrivalPointGrassRingSoft01", x: tileX(3.5), y: tileY(4.3), scale: 0.72 },
    { assetId: "buildingTempShelterCanvasTent01", x: tileX(12.7), y: tileY(4.2), scale: resolveShelterScale(input.home) },
    { assetId: "facilityPetBedNeat01", x: tileX(11.8), y: tileY(6.35), scale: 0.58 },
    { assetId: "facilityLampOn01", x: tileX(13.7), y: tileY(6.1), scale: 0.46 },
    { assetId: "facilityFoodBowlFull01", x: tileX(7.9), y: tileY(8.2), scale: 0.42 },
    { assetId: "facilityWaterBowlFull01", x: tileX(9.0), y: tileY(8.2), scale: 0.42 },
  ]

  if (input.natureLayer) {
    addSpritePlacements(input.natureLayer, naturePlacements)
  } else {
    addSpritePlacements(input.structureLayer, naturePlacements)
  }

  addSpritePlacements(input.structureLayer, structurePlacements)
}

function drawMvpGround(layer: Container) {
  const backdrop = new Graphics()

  backdrop.rect(
    MAP_ORIGIN_X - TILE_SIZE,
    MAP_ORIGIN_Y - TILE_SIZE,
    (MAP_COLUMNS + 2) * TILE_SIZE,
    (MAP_ROWS + 2) * TILE_SIZE
  ).fill(0x587e3d)

  layer.addChild(backdrop)

  for (let row = 0; row < MAP_ROWS; row += 1) {
    for (let column = 0; column < MAP_COLUMNS; column += 1) {
      const sprite = createMvpSprite("groundGrassBase01")

      sprite.anchor.set(0, 0)
      sprite.x = MAP_ORIGIN_X + column * TILE_SIZE
      sprite.y = MAP_ORIGIN_Y + row * TILE_SIZE
      sprite.width = TILE_SIZE
      sprite.height = TILE_SIZE
      sprite.alpha = 0.98

      layer.addChild(sprite)
    }
  }
}

function drawMvpPaths(layer: Container) {
  const pathTiles = [
    [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9],
    [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [9, 5], [10, 5], [11, 5], [12, 5],
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8],
  ] as const

  for (const [column, row] of pathTiles) {
    const sprite = createMvpSprite("pathDirtHorizontal01")

    sprite.anchor.set(0, 0)
    sprite.x = MAP_ORIGIN_X + column * TILE_SIZE
    sprite.y = MAP_ORIGIN_Y + row * TILE_SIZE
    sprite.width = TILE_SIZE
    sprite.height = TILE_SIZE
    sprite.alpha = 0.94

    layer.addChild(sprite)
  }
}

function drawMvpZones(layer: Container) {
  addSpritePlacements(layer, [
    { assetId: "zoneInitialEmptyLandTrace01", x: tileX(3.5), y: tileY(4.6), scale: 0.72, alpha: 0.9 },
    { assetId: "zoneInitialEmptyLandTrace01", x: tileX(8.4), y: tileY(8.8), scale: 0.52, alpha: 0.7 },
    { assetId: "zoneInitialEmptyLandTrace01", x: tileX(12.5), y: tileY(6.8), scale: 0.54, alpha: 0.7 },
  ])
}

function resolveShelterScale(home: HomeState | null): number {
  if (!home) return 0.66
  if (home.status === "completed") return 0.7
  if (home.progress >= 70) return 0.68

  return 0.64
}

function addSpritePlacements(layer: Container, placements: MvpSpritePlacement[]) {
  for (const placement of placements) {
    const sprite = createMvpSprite(placement.assetId)

    sprite.x = Math.round(placement.x)
    sprite.y = Math.round(placement.y)
    sprite.scale.set(placement.scale)
    sprite.alpha = placement.alpha ?? 1

    layer.addChild(sprite)
  }
}

function createMvpSprite(assetId: MvpWorldAssetId): Sprite {
  const sprite = new Sprite(Texture.from(getMvpWorldAssetPath(assetId)))

  sprite.anchor.set(0.5, 1)
  sprite.roundPixels = true

  return sprite
}

function tileX(column: number): number {
  return MAP_ORIGIN_X + column * TILE_SIZE
}

function tileY(row: number): number {
  return MAP_ORIGIN_Y + row * TILE_SIZE
}
