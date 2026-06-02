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
import { buildSpaceGridFromHomeMapState } from "@/world/space"
import {
  adaptTraceFieldToSceneTraceFacts,
  buildTraceFieldFromWorld,
} from "@/world/trace"
import { adaptPlacementsToSceneObjects } from "./placement-to-scene-object-adapter"

export type WorldPainterFactAdapterInput = {
  homeMapState: HomeMapState
}

export type WorldPainterFactAdapterResult = {
  sceneFact: SceneComposerFact
  sourceSummary: {
    worldId: string
    naturalPlacements: number
    movementTracePlacements: number
    structurePlacements: number
    boundFactObjects: number
    skippedFactObjects: number
    mapDiffs: number
    groundHealth: number
    naturalGrowth: number
    spacePressure: number
    spaceCells: number
    passableCells: number
    blockedCells: number
    restrictedCells: number
    occupiedCells: number
    averageMovementCost: number
    averageTraceStrength: number
    traceFacts: number
    spatialUseTraces: number
    movementTraces: number
    ecologyChangeTraces: number
    weakTraces: number
    mediumTraces: number
    strongTraces: number
    landmarkTraces: number
    averageTraceFactStrength: number
  }
}

export function adaptHomeMapStateToSceneComposerFact(
  input: WorldPainterFactAdapterInput
): WorldPainterFactAdapterResult {
  const homeMapState = input.homeMapState
  const naturalPlacements = countPlacementsByLayerOrTag(
    homeMapState.placements,
    "nature",
    "world_nature_fact"
  )
  const movementTracePlacements = countPlacementsByLayerOrTag(
    homeMapState.placements,
    "path",
    "path"
  )
  const structurePlacements = countPlacementsByLayerOrTag(
    homeMapState.placements,
    "structure",
    "structure"
  )
  const biome = resolveSceneBiome(homeMapState)
  const moisture = resolveMoisture(homeMapState)
  const decorationDensity = resolveDecorationDensity({
    homeMapState,
    naturalPlacements,
    movementTracePlacements,
    structurePlacements,
  })
  const traceShape = resolveTraceShape({ homeMapState })
  const placementAdapterResult = adaptPlacementsToSceneObjects({
    homeMapState,
  })
  const spaceGrid = buildSpaceGridFromHomeMapState({
    homeMapState,
  })
  const spaceSummary = spaceGrid.summary
  const traceField = buildTraceFieldFromWorld({
    homeMapState,
    spaceGrid,
  })
  const traceSummary = traceField.summary
  const sceneTraceFacts = adaptTraceFieldToSceneTraceFacts({
    traceField,
  })
  const hasTraceFact = traceSummary.totalTraces > 0

  return {
    sceneFact: {
      id: `world_painter_${homeMapState.worldId}`,
      biome,
      moisture,
      decorationDensity,
      traceShape,
      traceDensity: resolveTraceDensity({
        decorationDensity,
        movementTracePlacements,
        averageTraceFactStrength: traceSummary.averageStrength,
      }),
      hasTraceFact,
      traceFacts: sceneTraceFacts,
      includeActorPlaceholder: false,
      factObjects: placementAdapterResult.boundObjects,
      worldSeed: `${homeMapState.seed}:${homeMapState.worldId}:world-painter-v1`,
    },
    sourceSummary: {
      worldId: homeMapState.worldId,
      naturalPlacements,
      movementTracePlacements,
      structurePlacements,
      boundFactObjects: placementAdapterResult.boundObjects.length,
      skippedFactObjects: placementAdapterResult.skippedPlacements.length,
      mapDiffs: homeMapState.mapDiffs.length,
      groundHealth: homeMapState.resources.groundHealth,
      naturalGrowth: homeMapState.resources.naturalGrowth,
      spacePressure: homeMapState.resources.spacePressure,
      spaceCells: spaceSummary.totalCells,
      passableCells: spaceSummary.passableCells,
      blockedCells: spaceSummary.blockedCells,
      restrictedCells: spaceSummary.restrictedCells,
      occupiedCells: spaceSummary.occupiedCells,
      averageMovementCost: spaceSummary.averageMovementCost,
      averageTraceStrength: spaceSummary.averageTraceStrength,
      traceFacts: traceSummary.totalTraces,
      spatialUseTraces: traceSummary.spatialUseTraces,
      movementTraces: traceSummary.movementTraces,
      ecologyChangeTraces: traceSummary.ecologyChangeTraces,
      weakTraces: traceSummary.weakTraces,
      mediumTraces: traceSummary.mediumTraces,
      strongTraces: traceSummary.strongTraces,
      landmarkTraces: traceSummary.landmarkTraces,
      averageTraceFactStrength: traceSummary.averageStrength,
    },
  }
}

function resolveSceneBiome(homeMapState: HomeMapState): SceneComposerBiome {
  const biomeType = homeMapState.ecologyState?.biomeType

  if (isSceneBiome(biomeType)) {
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
  movementTracePlacements: number
  structurePlacements: number
}): number {
  const resources = input.homeMapState.resources
  const worldObjectSignal =
    input.naturalPlacements * 7 +
    input.movementTracePlacements * 3 +
    input.structurePlacements * 2

  const value = Math.round(
    resources.naturalGrowth * 0.56 +
      resources.groundHealth * 0.16 +
      worldObjectSignal +
      input.homeMapState.mapDiffs.length * 1.4
  )

  return clamp(value, 8, 100)
}

function resolveTraceShape(input: { homeMapState: HomeMapState }): number {
  const tracePlacements = input.homeMapState.placements.filter(
    (placement) => placement.layer === "path" || placement.tags.includes("path")
  )

  if (tracePlacements.length > 0) {
    const averageX =
      tracePlacements.reduce((sum, placement) => sum + placement.x, 0) /
      tracePlacements.length
    const averageY =
      tracePlacements.reduce((sum, placement) => sum + placement.y, 0) /
      tracePlacements.length
    const mapWidth = Math.max(
      1,
      input.homeMapState.mapSize.columns * input.homeMapState.mapSize.tileSize
    )
    const mapHeight = Math.max(
      1,
      input.homeMapState.mapSize.rows * input.homeMapState.mapSize.tileSize
    )
    const xSignal = averageX / mapWidth
    const ySignal = averageY / mapHeight

    return clamp(Math.round((xSignal * 0.64 + ySignal * 0.36) * 100), 0, 100)
  }

  const base = stableUnit(
    `${input.homeMapState.seed}:${input.homeMapState.worldId}:trace-shape`
  )
  const resourceBias =
    (input.homeMapState.resources.groundHealth -
      input.homeMapState.resources.spacePressure) /
    220

  return clamp(Math.round((base * 0.7 + 0.15 + resourceBias) * 100), 0, 100)
}

function resolveTraceDensity(input: {
  decorationDensity: number
  movementTracePlacements: number
  averageTraceFactStrength: number
}): number {
  return clamp(
    Math.round(
      input.decorationDensity * 0.52 +
        input.movementTracePlacements * 4 +
        input.averageTraceFactStrength * 0.36
    ),
    0,
    100
  )
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

function isSceneBiome(value: unknown): value is SceneComposerBiome {
  return (
    value === "forest" ||
    value === "grassland" ||
    value === "desert" ||
    value === "oasis"
  )
}
