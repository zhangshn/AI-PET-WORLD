/**
 * 当前文件职责：从家园地图状态统一派生生态环境状态。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type { EnvironmentState } from "./environment-schema"
import { buildEcologyState } from "./ecology-state-builder"
import { buildMaterialState } from "./material-state-builder"
import { buildTerrainStateFromHomeMap } from "./terrain-state-builder"

export type BuildEnvironmentStateFromHomeMapInput = {
  homeMapState: HomeMapState
  generatedAt?: number
}

export function buildEnvironmentStateFromHomeMap(
  input: BuildEnvironmentStateFromHomeMapInput
): EnvironmentState {
  const terrain = buildTerrainStateFromHomeMap({
    homeMapState: input.homeMapState,
  })
  const ecology = buildEcologyState({
    homeMapState: input.homeMapState,
    terrainState: terrain,
  })
  const materials = buildMaterialState({
    homeMapState: input.homeMapState,
    terrainState: terrain,
  })

  return {
    worldId: input.homeMapState.worldId,
    generatedAt: input.generatedAt ?? input.homeMapState.updatedAt,
    terrain,
    ecology,
    materials,
    tags: Array.from(
      new Set(["environment_v0", ...ecology.tags, ...materials.tags])
    ),
  }
}
