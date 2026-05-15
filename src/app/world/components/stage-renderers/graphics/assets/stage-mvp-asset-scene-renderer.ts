/**
 * 当前文件负责：在 Pixi 世界舞台中渲染 MVP 阶段 PNG 素材拼装测试层。
 */

import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js"

import type { HomeState } from "@/types/home"
import type { WorldMapState } from "@/world/map/world-map"

import {
  getMvpWorldAssetPath,
  type MvpWorldAssetId,
} from "../../assets/mvp-world-assets"
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
  col: number
  row: number
  scale: number
  alpha?: number
}

type MvpPathTile = {
  col: number
  row: number
}

const TILE_SIZE = 32
const MAP_COLUMNS = 40
const MAP_ROWS = 22
const MAP_ORIGIN_X = 0
const MAP_ORIGIN_Y = 8

const COORDINATE_LABEL_STYLE = new TextStyle({
  fill: 0xf8fafc,
  fontFamily: "monospace",
  fontSize: 10,
  fontWeight: "600",
  stroke: {
    color: 0x1f2a1d,
    width: 2,
  },
})

export function drawMvpAssetScene(input: DrawMvpAssetSceneInput) {
  drawMvpGround(input.structureLayer)
  drawMvpPaths(input.structureLayer)
  drawMvpZones(input.structureLayer)
  drawMvpObjects(input.structureLayer, input.natureLayer, input.home)
  drawCoordinateGrid(input.structureLayer)
}

function drawMvpGround(layer: Container) {
  const backdrop = new Graphics()

  backdrop
    .rect(
      MAP_ORIGIN_X,
      MAP_ORIGIN_Y,
      MAP_COLUMNS * TILE_SIZE,
      MAP_ROWS * TILE_SIZE
    )
    .fill(0x4c7337)

  layer.addChild(backdrop)

  for (let row = 0; row < MAP_ROWS; row += 1) {
    for (let column = 0; column < MAP_COLUMNS; column += 1) {
      const sprite = createMvpSprite("groundGrassBase01")

      sprite.anchor.set(0, 0)
      sprite.x = tileLeft(column)
      sprite.y = tileTop(row)
      sprite.width = TILE_SIZE
      sprite.height = TILE_SIZE
      sprite.alpha = 0.98

      layer.addChild(sprite)
    }
  }
}

function drawMvpPaths(layer: Container) {
  const pathTiles: MvpPathTile[] = [
    { col: 7, row: 10 },
    { col: 8, row: 10 },
    { col: 9, row: 10 },
    { col: 10, row: 10 },
    { col: 11, row: 10 },
    { col: 12, row: 10 },
    { col: 13, row: 10 },
    { col: 14, row: 10 },
    { col: 15, row: 10 },
    { col: 16, row: 10 },
    { col: 17, row: 10 },
    { col: 18, row: 10 },
    { col: 19, row: 10 },
    { col: 20, row: 10 },
    { col: 21, row: 10 },
    { col: 22, row: 10 },
    { col: 23, row: 10 },
    { col: 24, row: 10 },
    { col: 25, row: 10 },
    { col: 26, row: 10 },
    { col: 27, row: 10 },
    { col: 28, row: 10 },
    { col: 29, row: 10 },
    { col: 30, row: 10 },
    { col: 31, row: 10 },
    { col: 32, row: 10 },
    { col: 20, row: 11 },
    { col: 20, row: 12 },
    { col: 20, row: 13 },
    { col: 20, row: 14 },
    { col: 21, row: 14 },
    { col: 22, row: 14 },
    { col: 23, row: 14 },
    { col: 24, row: 14 },
    { col: 25, row: 14 },
    { col: 26, row: 14 },
    { col: 27, row: 14 },
    { col: 28, row: 14 },
    { col: 29, row: 14 },
    { col: 30, row: 14 },
  ]

  for (const pathTile of pathTiles) {
    const sprite = createMvpSprite("pathDirtHorizontal01")

    sprite.anchor.set(0, 0)
    sprite.x = tileLeft(pathTile.col)
    sprite.y = tileTop(pathTile.row)
    sprite.width = TILE_SIZE
    sprite.height = TILE_SIZE
    sprite.alpha = 0.94

    layer.addChild(sprite)
  }
}

function drawMvpZones(layer: Container) {
  addSpritePlacements(layer, [
    {
      assetId: "zoneInitialEmptyLandTrace01",
      col: 7,
      row: 10,
      scale: 0.72,
      alpha: 0.9,
    },
    {
      assetId: "zoneInitialEmptyLandTrace01",
      col: 20,
      row: 15,
      scale: 0.54,
      alpha: 0.72,
    },
    {
      assetId: "zoneInitialEmptyLandTrace01",
      col: 29,
      row: 15,
      scale: 0.56,
      alpha: 0.72,
    },
  ])
}

function drawMvpObjects(
  structureLayer: Container,
  natureLayer: Container | null,
  home: HomeState | null
) {
  const naturePlacements: MvpSpritePlacement[] = [
    { assetId: "natureBushRoundLow01", col: 3, row: 5, scale: 0.78 },
    { assetId: "surfaceGrassTuftLow01", col: 5, row: 8, scale: 0.72 },
    { assetId: "natureBushRoundLow01", col: 35, row: 5, scale: 0.82 },
    { assetId: "surfaceGrassTuftLow01", col: 34, row: 17, scale: 0.68 },
    { assetId: "natureBushRoundLow01", col: 4, row: 19, scale: 0.78 },
  ]

  const structurePlacements: MvpSpritePlacement[] = [
    {
      assetId: "arrivalPointGrassRingSoft01",
      col: 7,
      row: 10,
      scale: 0.74,
    },
    {
      assetId: "buildingTempShelterCanvasTent01",
      col: 29,
      row: 9,
      scale: resolveShelterScale(home),
    },
    {
      assetId: "facilityPetBedNeat01",
      col: 28,
      row: 14,
      scale: 0.58,
    },
    {
      assetId: "facilityLampOn01",
      col: 31,
      row: 14,
      scale: 0.46,
    },
    {
      assetId: "facilityFoodBowlFull01",
      col: 19,
      row: 15,
      scale: 0.42,
    },
    {
      assetId: "facilityWaterBowlFull01",
      col: 21,
      row: 15,
      scale: 0.42,
    },
  ]

  addSpritePlacements(natureLayer ?? structureLayer, naturePlacements)
  addSpritePlacements(structureLayer, structurePlacements)
}

function drawCoordinateGrid(layer: Container) {
  const grid = new Graphics()
  const mapWidth = MAP_COLUMNS * TILE_SIZE
  const mapHeight = MAP_ROWS * TILE_SIZE

  for (let column = 0; column <= MAP_COLUMNS; column += 1) {
    const x = MAP_ORIGIN_X + column * TILE_SIZE
    const alpha = column % 5 === 0 ? 0.34 : 0.16
    const width = column % 5 === 0 ? 2 : 1

    grid
      .moveTo(x, MAP_ORIGIN_Y)
      .lineTo(x, MAP_ORIGIN_Y + mapHeight)
      .stroke({ color: 0xf8fafc, alpha, width })
  }

  for (let row = 0; row <= MAP_ROWS; row += 1) {
    const y = MAP_ORIGIN_Y + row * TILE_SIZE
    const alpha = row % 5 === 0 ? 0.34 : 0.16
    const width = row % 5 === 0 ? 2 : 1

    grid
      .moveTo(MAP_ORIGIN_X, y)
      .lineTo(MAP_ORIGIN_X + mapWidth, y)
      .stroke({ color: 0xf8fafc, alpha, width })
  }

  grid
    .rect(MAP_ORIGIN_X, MAP_ORIGIN_Y, mapWidth, mapHeight)
    .stroke({ color: 0xf8fafc, alpha: 0.65, width: 2 })

  layer.addChild(grid)

  drawAxisLabels(layer)
}

function drawAxisLabels(layer: Container) {
  for (let column = 0; column < MAP_COLUMNS; column += 1) {
    const label = createCoordinateLabel(`X${column}`)

    label.x = tileLeft(column) + 3
    label.y = MAP_ORIGIN_Y + 2
    label.alpha = column % 5 === 0 ? 0.95 : 0.58

    layer.addChild(label)
  }

  for (let row = 0; row < MAP_ROWS; row += 1) {
    const label = createCoordinateLabel(`Y${row}`)

    label.x = MAP_ORIGIN_X + 3
    label.y = tileTop(row) + 15
    label.alpha = row % 5 === 0 ? 0.95 : 0.58

    layer.addChild(label)
  }
}

function createCoordinateLabel(text: string): Text {
  return new Text({
    text,
    style: COORDINATE_LABEL_STYLE,
  })
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

    sprite.x = objectX(placement.col)
    sprite.y = objectY(placement.row)
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

function tileLeft(column: number): number {
  return MAP_ORIGIN_X + column * TILE_SIZE
}

function tileTop(row: number): number {
  return MAP_ORIGIN_Y + row * TILE_SIZE
}

function objectX(column: number): number {
  return tileLeft(column) + TILE_SIZE / 2
}

function objectY(row: number): number {
  return tileTop(row) + TILE_SIZE
}
