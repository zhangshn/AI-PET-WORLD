/**
 * 当前文件负责：聚合世界地图、生态、实体、空间与文明运行状态。
 */

import type { TimeState } from "../../engine/timeSystem"
import {
  buildNextWorldEcologyState,
  type WorldEcologyState,
} from "../ecology/ecology-engine"
import { generateStarterWorldMap } from "../map/map-generator"
import type { WorldMapState } from "../map/world-map"
import {
  createEmptyEntityRuntime,
  removeExpiredWorldEntities,
  type EntityRuntimeState,
} from "./entity-runtime"
import {
  createEmptySpatialRuntime,
  type SpatialRuntimeState,
} from "./spatial-runtime"
import {
  createInitialCivilizationRuntime,
  stepCivilizationRuntime,
  type CivilizationRuntimeState,
} from "./civilization-runtime"
import { resolveWorldBiome, type WorldBiomeState } from "../map/biome-system"
import { resolveWeatherRuntimeEffect, type WeatherRuntimeEffect } from "./weather-runtime"

export type WorldRuntimeState = {
  tick: number
  map: WorldMapState
  ecology: WorldEcologyState
  biome: WorldBiomeState
  weatherEffect: WeatherRuntimeEffect
  entities: EntityRuntimeState
  spatial: SpatialRuntimeState
  civilization: CivilizationRuntimeState
}

export function createInitialWorldRuntimeState(input: {
  time: TimeState
}): WorldRuntimeState {
  const ecology = buildNextWorldEcologyState({
    tick: 0,
    time: input.time,
    previousEnvironment: null,
    previousZones: null,
  })

  return {
    tick: 0,
    map: generateStarterWorldMap(),
    ecology,
    biome: resolveWorldBiome(ecology.environment),
    weatherEffect: resolveWeatherRuntimeEffect(ecology.environment),
    entities: createEmptyEntityRuntime(),
    spatial: createEmptySpatialRuntime(),
    civilization: createInitialCivilizationRuntime(),
  }
}

export function stepWorldRuntime(input: {
  previous: WorldRuntimeState
  tick: number
  time: TimeState
  homeLevel: number
  petCount: number
  hasHospital: boolean
  hasShop: boolean
  hasPark: boolean
}): WorldRuntimeState {
  const ecology = buildNextWorldEcologyState({
    tick: input.tick,
    time: input.time,
    previousEnvironment: input.previous.ecology.environment,
    previousZones: input.previous.ecology.zones,
  })

  const entities = removeExpiredWorldEntities({
    state: input.previous.entities,
    tick: input.tick,
  })

  const civilization = stepCivilizationRuntime({
    state: input.previous.civilization,
    tick: input.tick,
    hasHospital: input.hasHospital,
    hasShop: input.hasShop,
    hasPark: input.hasPark,
    homeLevel: input.homeLevel,
    petCount: input.petCount,
  })

  return {
    ...input.previous,
    tick: input.tick,
    ecology,
    biome: resolveWorldBiome(ecology.environment),
    weatherEffect: resolveWeatherRuntimeEffect(ecology.environment),
    entities,
    civilization,
  }
}