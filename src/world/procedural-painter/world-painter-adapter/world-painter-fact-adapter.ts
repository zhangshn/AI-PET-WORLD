// 该文件负责把正式 HomeMapState 只读转换为 World Painter 绘画事实。

import type { HomeMapState, MapPlacement } from "@/world/map-state/home-map-state-schema"
import type {
  SceneComposerBiome,
  SceneComposerFact,
} from "@/world/procedural-painter/scene-composer/scene-composer-schema"
import {
  clamp,
  stableUnit,
} from "@/world/procedural-painter/scene-composer/scene-composer-random"

export type WorldPainterFactAdapterInput = {
  homeMapState: HomeMapState
}

export type WorldPainterFactAdapterResult = {
  sceneFact: SceneComposerFact
  sourceSummary: {
    worldId: string
    naturalPlacements: number
    pathPlacements: number
    structurePlacements: number
    mapDiffs: number
    groundHealth: number
    naturalGrowth: number
    spacePressure: number
  }
}

export function adaptHomeMapStateToSceneComposerFact(
  input: WorldPainterFactAdapterInput
): WorldPainterFactAdapterResult {
  const homeMapState = input.homeMapState
  const naturalPlacements = countPlacementsByLayerOrTag(homeMapState.placements, "nature", "world_nature_fact")
  const pathPlacements = countPlacementsByLayerOrTag(homeMapState.placements, "path", "path")
  const structurePlacements = countPlacementsByLayerOrTag(homeMapState.placements, "structure", "structure")
  const biome = resolveSceneBiome(homeMapState)
  const moisture = resolveMoisture(homeMapState)
  const decorationDensity = resolveDecorationDensity({
    homeMapState,
    naturalPlacements,
    pathPlacements,
    structurePlacements,
  })
  const roadShape = resolveRoadShape({ homeMapState, pathPlacements })

  return {
    sceneFact: {
      id: `world_painter_${homeMapState.worldId}`,
      biome,
      moisture,
      decorationDensity,
      roadShape,
      worldSeed: `${homeMapState.seed}:${homeMapState.worldId}:world-painter-v1`,
    },
    sourceSummary: {
      worldId: homeMapState.worldId,
      naturalPlacements,
      pathPlacements,
      structurePlacements,
      mapDiffs: homeMapState.mapDiffs.length,
      groundHealth: homeMapState.resources.groundHealth,
      naturalGrowth: homeMapState.resources.naturalGrowth,
      spacePressure: homeMapState.resources.spacePressure,
    },
  }
}

function resolveSceneBiome(homeMapState: HomeMapState): SceneComposerBiome {
  const biomeType = homeMapState.ecologyState?.biomeType

  if (
    biomeType === "forest" ||
    biomeType === "grassland" ||
    biomeType === "desert" ||
    biomeType === "oasis"
  ) {
    return biomeType
  }

  const fromTags = homeMapState.tags.find(isSceneBiome)
  if (fromTags) {
    return fromTags
  }

  const roll = stableUnit(`${homeMapState.seed}:${homeMapState.worldId}:fallback-biome`)

  if (roll < 0.25) {
    return "grassland"
  }

  if (roll < 0.5) {
    return "forest"
  }

  if (roll < 0.75) {
    return "desert"
  }

  return "oasis"
}

function resolveMoisture(homeMapState: HomeMapState): number {
  const resources = homeMapState.resources
  const climateComfort = 100 - resources.spacePressure
  const value = Math.round(
    resources.groundHealth * 0.44 +
      resources.naturalGrowth * 0.26 +
      resources.careReadiness * 0.12 +
      climateComfort * 0.18
  )

  return clamp(value, 0, 100)
}

function resolveDecorationDensity(input: {
  homeMapState: HomeMapState
  naturalPlacements: number
  pathPlacements: number
  structurePlacements: number
}): number {
  const resources = input.homeMapState.resources
  const worldObjectSignal =
    input.naturalPlacements * 7 + input.pathPlacements * 3 + input.structurePlacmentsCorrection()

  const value = Math.round(
    resources.naturalGrowth * 0.56 +
      resources.groundHealth * 0.16 +
      worldObjectSignal +
      input.homeMapState.mapDiffs.length * 1.4
  )

  return clamp(value, 8, 100)
}

function resolveRoadShape(input: {
  homeMapState: HomeMapState
  pathPlacements: number
}): number {
  const pathPlacements = input.homeMapState.placements.filter(
    (placement) => placement.layer === "path" || placement.tags.includes("path")
  )

  if (pathPlacements.length > 0) {
    const averageX = pathPlacements.reduce((sum, placement) => sum + placement.x, 0) / pathPlacements.length
    const averageY = pathPlacements.reduce((sum, placement) => sum + placement.y, 0) / pathPlacements.length
    const mapWidth = Math.max(1, input.homeMapState.mapSize.columns * input.homeMapState.mapSize.tileSize)
    const mapHeight = Math.max(1, input.homeMapState.mapSize.rows * input.homeMapState.mapSize.tileSize)
    const xSignal = averageX / mapWidth
    const ySignal = averageY / mapHeight

    return clamp(Math.round((xSignal * 0.64 + ySignal * 0.36) * 100), 0, 100)
  }

  const base = stableUnit(`${input.homeMapState.seed}:${input.homeMapState.worldId}:road-shape`)
  const resourceBias =
    (input.homeMapState.resources.groundHealth - input.homeMapState.resources.spacePressure) / 220

  return clamp(Math.round((base * 0.7 + 0.15 + resourceBias) * 100), 0, 100)
}

function countPlacementsByLayerOrTag(
  placements: MapPlacement[],
  layer: MapPlacement["layer"],
  tag: string
): number {
  return placements.filter(
    (placement) => placement.layer === layer || placement.tags.includes(tag)
  ).length
}

function isSceneBiome(value: string): value is SceneComposerBiome {
  return (
    value === "forest" ||
    value === "grassland" ||
    value === "desert" ||
    value === "oasis"
  )
}
