/**
 * 当前文件负责：在 Pixi 世界舞台中渲染 MVP 初始家园 PNG 分层地图。
 */

import {
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js"

import type { HomeState } from "@/types/home"
import {
  WORLD_MAP_ASSETS,
  getWorldMapAssetPath,
  type WorldMapAssetId,
} from "@/world/map-assets/world-map-asset-registry"
import type { WorldMapState } from "@/world/map/world-map"
import {
  INITIAL_HOME_MAP_LAYOUT,
  INITIAL_HOME_SPRITE_LAYERS,
} from "@/world/maps/home/initial-home/initial-home-map-layout"
import type {
  InitialHomeSpritePlacement,
  InitialHomeTileCoordinate,
} from "@/world/maps/home/initial-home/initial-home-map-schema"

export type DrawMvpAssetSceneInput = {
  terrainLayer: Container
  structureLayer: Container
  natureLayer: Container | null
  coordinateLayer: Container
  map: WorldMapState | null
  home: HomeState | null
}

type MvpMapLayout = {
  columns: number
  rows: number
  tileSize: number
  originX: number
  originY: number
}

const FALLBACK_COLUMNS = INITIAL_HOME_MAP_LAYOUT.columns
const FALLBACK_ROWS = INITIAL_HOME_MAP_LAYOUT.rows
const FALLBACK_TILE_SIZE = INITIAL_HOME_MAP_LAYOUT.tileSize

const MVP_TEXTURE_CACHE = new Map<WorldMapAssetId, Texture>()
const MVP_TEXTURE_PROMISE_CACHE = new Map<WorldMapAssetId, Promise<Texture>>()

const COORDINATE_LABEL_STYLE = new TextStyle({
  fill: 0xffffff,
  fontFamily: "Arial, Microsoft YaHei, sans-serif",
  fontSize: 12,
  fontWeight: "700",
})

export function drawMvpAssetScene(input: DrawMvpAssetSceneInput) {
  const layout = resolveMvpMapLayout(input.map)

  drawMvpGround(input.terrainLayer, layout)
  drawMvpPath(input.terrainLayer, layout, INITIAL_HOME_MAP_LAYOUT.pathLayer.tiles)
  drawMvpSpriteLayers({
    structureLayer: input.structureLayer,
    natureLayer: input.natureLayer,
    layout,
  })
  drawCoordinateGrid(input.coordinateLayer, layout)
}

function resolveMvpMapLayout(map: WorldMapState | null): MvpMapLayout {
  return {
    columns: map?.size.width ?? FALLBACK_COLUMNS,
    rows: map?.size.height ?? FALLBACK_ROWS,
    tileSize: map?.tileSize ?? FALLBACK_TILE_SIZE,
    originX: 0,
    originY: 0,
  }
}

function drawMvpGround(layer: Container, layout: MvpMapLayout) {
  const backdrop = new Graphics()

  backdrop
    .rect(
      layout.originX,
      layout.originY,
      layout.columns * layout.tileSize,
      layout.rows * layout.tileSize
    )
    .fill(0x4c7337)

  layer.addChild(backdrop)

  for (let y = 1; y <= layout.rows; y += 1) {
    for (let x = 1; x <= layout.columns; x += 1) {
      const sprite = createMvpSprite(INITIAL_HOME_MAP_LAYOUT.groundAssetId)

      sprite.anchor.set(0, 0)
      sprite.x = tileLeft(layout, x)
      sprite.y = tileTop(layout, y)
      sprite.width = layout.tileSize
      sprite.height = layout.tileSize
      sprite.alpha = 0.98

      layer.addChild(sprite)
    }
  }
}

function drawMvpPath(
  layer: Container,
  layout: MvpMapLayout,
  tiles: InitialHomeTileCoordinate[]
) {
  for (const tile of tiles) {
    if (!isTileInsideLayout(layout, tile.x, tile.y)) continue

    const sprite = createMvpSprite(INITIAL_HOME_MAP_LAYOUT.pathAssetId)

    sprite.anchor.set(0, 0)
    sprite.x = tileLeft(layout, tile.x)
    sprite.y = tileTop(layout, tile.y)
    sprite.width = layout.tileSize
    sprite.height = layout.tileSize
    sprite.alpha = 0.94

    layer.addChild(sprite)
  }
}

function drawMvpSpriteLayers(input: {
  structureLayer: Container
  natureLayer: Container | null
  layout: MvpMapLayout
}) {
  for (const spriteLayer of INITIAL_HOME_SPRITE_LAYERS) {
    const targetLayer =
      spriteLayer.id === INITIAL_HOME_MAP_LAYOUT.natureLayer.id ||
      spriteLayer.id === INITIAL_HOME_MAP_LAYOUT.surfaceDecorationLayer.id
        ? input.natureLayer ?? input.structureLayer
        : input.structureLayer

    addSpritePlacements(targetLayer, input.layout, spriteLayer.placements)
  }
}

function addSpritePlacements(
  layer: Container,
  layout: MvpMapLayout,
  placements: readonly InitialHomeSpritePlacement[]
) {
  for (const placement of placements) {
    if (!isTileInsideLayout(layout, placement.x, placement.y)) continue

    const sprite = createMvpSprite(placement.assetId)
    const asset = WORLD_MAP_ASSETS[placement.assetId]
    const scale = (layout.tileSize / 32) * placement.scale

    if (asset.anchor === "top-left") {
      sprite.anchor.set(0, 0)
      sprite.x = tileLeft(layout, placement.x)
      sprite.y = tileTop(layout, placement.y)
    } else if (asset.anchor === "center") {
      sprite.anchor.set(0.5, 0.5)
      sprite.x = objectX(layout, placement.x)
      sprite.y = tileTop(layout, placement.y) + layout.tileSize / 2
    } else {
      sprite.anchor.set(0.5, 1)
      sprite.x = objectX(layout, placement.x)
      sprite.y = objectY(layout, placement.y)
    }

    sprite.scale.set(scale)
    sprite.alpha = placement.alpha ?? 1
    sprite.zIndex = placement.layer

    layer.sortableChildren = true
    layer.addChild(sprite)
  }
}

function drawCoordinateGrid(layer: Container, layout: MvpMapLayout) {
  const grid = new Graphics()
  const mapWidth = layout.columns * layout.tileSize
  const mapHeight = layout.rows * layout.tileSize

  for (let x = 1; x <= layout.columns + 1; x += 1) {
    const columnIndex = x - 1
    const lineX = layout.originX + columnIndex * layout.tileSize
    const isMajorLine = columnIndex % 5 === 0

    grid
      .moveTo(lineX, layout.originY)
      .lineTo(lineX, layout.originY + mapHeight)
      .stroke({
        color: 0xf8fafc,
        alpha: isMajorLine ? 0.35 : 0.13,
        width: isMajorLine ? 2 : 1,
      })
  }

  for (let y = 1; y <= layout.rows + 1; y += 1) {
    const rowIndex = y - 1
    const lineY = layout.originY + rowIndex * layout.tileSize
    const isMajorLine = rowIndex % 5 === 0

    grid
      .moveTo(layout.originX, lineY)
      .lineTo(layout.originX + mapWidth, lineY)
      .stroke({
        color: 0xf8fafc,
        alpha: isMajorLine ? 0.35 : 0.13,
        width: isMajorLine ? 2 : 1,
      })
  }

  grid
    .rect(layout.originX, layout.originY, mapWidth, mapHeight)
    .stroke({
      color: 0xf8fafc,
      alpha: 0.7,
      width: 2,
    })

  layer.addChild(grid)

  drawAxisLabels(layer, layout)
}

function drawAxisLabels(layer: Container, layout: MvpMapLayout) {
  for (let x = 1; x <= layout.columns; x += 1) {
    const label = createCoordinateLabel(String(x), layout.tileSize - 2)

    label.x = Math.round(tileLeft(layout, x) + 1)
    label.y = Math.round(layout.originY + 1)

    layer.addChild(label)
  }

  for (let y = 1; y <= layout.rows; y += 1) {
    const label = createCoordinateLabel(String(y), layout.tileSize - 2)

    label.x = Math.round(layout.originX + 1)
    label.y = Math.round(tileTop(layout, y) + 1)

    layer.addChild(label)
  }
}

function createCoordinateLabel(text: string, width: number): Container {
  const label = new Container()
  const background = new Graphics()
  const textNode = new Text({
    text,
    style: COORDINATE_LABEL_STYLE,
  })

  background.rect(0, 0, width, 14).fill({
    color: 0x10180f,
    alpha: 0.86,
  })

  textNode.x = Math.round((width - textNode.width) / 2)
  textNode.y = 0

  label.addChild(background)
  label.addChild(textNode)

  return label
}

function createMvpSprite(assetId: WorldMapAssetId): Sprite {
  const cachedTexture = MVP_TEXTURE_CACHE.get(assetId)
  const sprite = new Sprite(cachedTexture ?? Texture.EMPTY)

  sprite.anchor.set(0.5, 1)
  sprite.roundPixels = true

  if (!cachedTexture) {
    applyMvpTextureWhenLoaded(assetId, sprite)
  }

  return sprite
}

function applyMvpTextureWhenLoaded(assetId: WorldMapAssetId, sprite: Sprite) {
  void loadMvpTexture(assetId).then((texture) => {
    if (sprite.destroyed) return

    const targetWidth = sprite.width
    const targetHeight = sprite.height
    const targetScaleX = sprite.scale.x
    const targetScaleY = sprite.scale.y

    sprite.texture = texture

    if (targetWidth > 1 && targetHeight > 1) {
      sprite.width = targetWidth
      sprite.height = targetHeight
      return
    }

    sprite.scale.set(targetScaleX, targetScaleY)
  })
}

function loadMvpTexture(assetId: WorldMapAssetId): Promise<Texture> {
  const cachedTexture = MVP_TEXTURE_CACHE.get(assetId)

  if (cachedTexture) {
    return Promise.resolve(cachedTexture)
  }

  const cachedPromise = MVP_TEXTURE_PROMISE_CACHE.get(assetId)

  if (cachedPromise) {
    return cachedPromise
  }

  const texturePromise = Assets.load<Texture>(getWorldMapAssetPath(assetId)).then(
    (texture) => {
      MVP_TEXTURE_CACHE.set(assetId, texture)
      return texture
    }
  )

  MVP_TEXTURE_PROMISE_CACHE.set(assetId, texturePromise)

  return texturePromise
}

function tileLeft(layout: MvpMapLayout, x: number): number {
  return layout.originX + (x - 1) * layout.tileSize
}

function tileTop(layout: MvpMapLayout, y: number): number {
  return layout.originY + (y - 1) * layout.tileSize
}

function objectX(layout: MvpMapLayout, x: number): number {
  return tileLeft(layout, x) + layout.tileSize / 2
}

function objectY(layout: MvpMapLayout, y: number): number {
  return tileTop(layout, y) + layout.tileSize
}

function isTileInsideLayout(
  layout: MvpMapLayout,
  x: number,
  y: number
): boolean {
  return x >= 1 && y >= 1 && x <= layout.columns && y <= layout.rows
}
