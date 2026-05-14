/**
 * 当前文件负责：在 Pixi 世界舞台中渲染 MVP 阶段 PNG 素材拼装测试层。
 */

import { Container, Sprite, Texture } from "pixi.js"

import type { HomeState } from "@/types/home"
import type { WorldMapState } from "@/world/map/world-map"

import { getMvpWorldAssetPath, type MvpWorldAssetId } from "../../assets/mvp-world-assets"
import type { StagePoint, StageStructureLayout } from "../structures/stage-structure-renderer"

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

export function drawMvpAssetScene(input: DrawMvpAssetSceneInput) {
  const tileSize = input.map?.tileSize ?? 24
  const tempShelter = input.structureLayout.tempShelter
  const arrivalPoint = resolveArrivalPoint(tempShelter, input.structureLayout.incubator)

  const naturePlacements: MvpSpritePlacement[] = [
    {
      assetId: "surfaceGrassTuftLow01",
      x: arrivalPoint.x - tileSize * 2.2,
      y: arrivalPoint.y + tileSize * 1.4,
      scale: 0.78,
      alpha: 0.92,
    },
    {
      assetId: "natureBushRoundLow01",
      x: tempShelter.x - tileSize * 1.4,
      y: tempShelter.y + tileSize * 4.9,
      scale: 0.86,
      alpha: 0.96,
    },
    {
      assetId: "surfaceGrassTuftLow01",
      x: tempShelter.x + tileSize * 6.8,
      y: tempShelter.y + tileSize * 5.1,
      scale: 0.68,
      alpha: 0.86,
    },
  ]

  const structurePlacements: MvpSpritePlacement[] = [
    {
      assetId: "zoneInitialEmptyLandTrace01",
      x: arrivalPoint.x,
      y: arrivalPoint.y + tileSize * 0.6,
      scale: 0.88,
      alpha: 0.9,
    },
    {
      assetId: "arrivalPointGrassRingSoft01",
      x: arrivalPoint.x,
      y: arrivalPoint.y + tileSize * 0.9,
      scale: 0.82,
      alpha: 0.96,
    },
    {
      assetId: "buildingTempShelterCanvasTent01",
      x: tempShelter.x + tileSize * 2.75,
      y: tempShelter.y + tileSize * 4.75,
      scale: resolveShelterScale(input.home),
    },
    {
      assetId: "facilityPetBedNeat01",
      x: tempShelter.x + tileSize * 6.15,
      y: tempShelter.y + tileSize * 4.95,
      scale: 0.72,
    },
    {
      assetId: "facilityLampOn01",
      x: tempShelter.x + tileSize * 5.0,
      y: tempShelter.y + tileSize * 4.25,
      scale: 0.54,
    },
    {
      assetId: "facilityFoodBowlFull01",
      x: tempShelter.x + tileSize * 2.55,
      y: tempShelter.y + tileSize * 6.25,
      scale: 0.52,
    },
    {
      assetId: "facilityWaterBowlFull01",
      x: tempShelter.x + tileSize * 3.65,
      y: tempShelter.y + tileSize * 6.2,
      scale: 0.52,
    },
  ]

  if (input.natureLayer) {
    addSpritePlacements(input.natureLayer, naturePlacements)
  } else {
    addSpritePlacements(input.structureLayer, naturePlacements)
  }

  addSpritePlacements(input.structureLayer, structurePlacements)
}

function resolveArrivalPoint(
  tempShelter: StagePoint,
  incubator: StagePoint
): StagePoint {
  return {
    x: Math.min(incubator.x - 24, tempShelter.x - 82),
    y: Math.max(incubator.y + 28, tempShelter.y + 84),
  }
}

function resolveShelterScale(home: HomeState | null): number {
  if (!home) return 0.86
  if (home.status === "completed") return 0.92
  if (home.progress >= 70) return 0.9
  if (home.progress >= 35) return 0.86

  return 0.82
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
