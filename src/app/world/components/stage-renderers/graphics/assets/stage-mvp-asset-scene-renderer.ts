/**
 * 当前文件负责：在 Pixi 世界舞台中渲染 MVP 阶段 PNG 素材拼装层。
 */

import { Container, Sprite } from "pixi.js"

import type { HomeState } from "@/types/home"
import type { WorldMapState } from "@/world/map/world-map"

import { MVP_WORLD_ASSETS } from "../../assets/mvp-world-assets"

type StageStructurePoint = {
  x: number
  y: number
}

type StageStructureLayout = {
  tempShelter: StageStructurePoint
  incubator: StageStructurePoint
}

type DrawMvpAssetSceneInput = {
  structureLayer: Container
  natureLayer: Container | null
  map: WorldMapState | null
  home: HomeState | null
  structureLayout: StageStructureLayout
}

type SpritePlacement = {
  assetPath: string
  x: number
  y: number
  width?: number
  height?: number
  scale?: number
  alpha?: number
}

export function drawMvpAssetScene(input: DrawMvpAssetSceneInput) {
  const map = input.map
  const tileSize = map?.tileSize ?? 24
  const shelter = input.structureLayout.tempShelter
  const incubator = input.structureLayout.incubator
  const homeProgress = input.home?.progress ?? 0

  drawNatureSprites({
    layer: input.natureLayer ?? input.structureLayer,
    shelterX: shelter.x,
    shelterY: shelter.y,
    incubatorX: incubator.x,
    incubatorY: incubator.y,
    tileSize,
  })

  drawStructureSprites({
    layer: input.structureLayer,
    shelterX: shelter.x,
    shelterY: shelter.y,
    incubatorX: incubator.x,
    incubatorY: incubator.y,
    tileSize,
    homeProgress,
  })
}

function drawNatureSprites(input: {
  layer: Container
  shelterX: number
  shelterY: number
  incubatorX: number
  incubatorY: number
  tileSize: number
}) {
  const placements: SpritePlacement[] = [
    {
      assetPath: MVP_WORLD_ASSETS.zoneInitialEmptyLandTrace,
      x: input.incubatorX + 22,
      y: input.incubatorY + 58,
      width: input.tileSize * 3.2,
    },
    {
      assetPath: MVP_WORLD_ASSETS.surfaceGrassTuftLow,
      x: input.incubatorX - 36,
      y: input.incubatorY + 92,
      scale: 0.82,
      alpha: 0.92,
    },
    {
      assetPath: MVP_WORLD_ASSETS.surfaceGrassTuftLow,
      x: input.shelterX + 152,
      y: input.shelterY + 132,
      scale: 0.82,
      alpha: 0.9,
    },
    {
      assetPath: MVP_WORLD_ASSETS.natureBushRoundLow,
      x: input.shelterX - 38,
      y: input.shelterY + 122,
      width: input.tileSize * 2.55,
    },
    {
      assetPath: MVP_WORLD_ASSETS.natureBushRoundLow,
      x: input.shelterX + 172,
      y: input.shelterY + 78,
      width: input.tileSize * 2.35,
      alpha: 0.94,
    },
  ]

  placements.forEach((placement) => addGroundedSprite(input.layer, placement))
}

function drawStructureSprites(input: {
  layer: Container
  shelterX: number
  shelterY: number
  incubatorX: number
  incubatorY: number
  tileSize: number
  homeProgress: number
}) {
  const shelterScale = input.homeProgress >= 60 ? 1 : 0.94

  const placements: SpritePlacement[] = [
    {
      assetPath: MVP_WORLD_ASSETS.arrivalPointGrassRingSoft,
      x: input.incubatorX + 26,
      y: input.incubatorY + 68,
      width: input.tileSize * 4.5,
    },
    {
      assetPath: MVP_WORLD_ASSETS.buildingTempShelterCanvasTent,
      x: input.shelterX + 72,
      y: input.shelterY + 132,
      width: input.tileSize * 5.35 * shelterScale,
    },
    {
      assetPath: MVP_WORLD_ASSETS.facilityPetBedNeat,
      x: input.shelterX + 152,
      y: input.shelterY + 136,
      width: input.tileSize * 2.15,
    },
    {
      assetPath: MVP_WORLD_ASSETS.facilityLampOn,
      x: input.shelterX + 34,
      y: input.shelterY + 125,
      width: input.tileSize * 1.5,
    },
    {
      assetPath: MVP_WORLD_ASSETS.facilityFoodBowlFull,
      x: input.shelterX + 82,
      y: input.shelterY + 178,
      width: input.tileSize * 1.72,
    },
    {
      assetPath: MVP_WORLD_ASSETS.facilityWaterBowlFull,
      x: input.shelterX + 128,
      y: input.shelterY + 178,
      width: input.tileSize * 1.72,
    },
  ]

  placements.forEach((placement) => addGroundedSprite(input.layer, placement))
}

function addGroundedSprite(layer: Container, placement: SpritePlacement) {
  const sprite = Sprite.from(placement.assetPath)

  sprite.anchor.set(0.5, 1)
  sprite.position.set(Math.round(placement.x), Math.round(placement.y))
  sprite.roundPixels = true

  if (placement.alpha !== undefined) {
    sprite.alpha = placement.alpha
  }

  if (placement.width !== undefined) {
    sprite.width = Math.round(placement.width)
    sprite.scale.y = sprite.scale.x
  } else if (placement.height !== undefined) {
    sprite.height = Math.round(placement.height)
    sprite.scale.x = sprite.scale.y
  } else if (placement.scale !== undefined) {
    sprite.scale.set(placement.scale)
  }

  layer.addChild(sprite)
}
