import type {
  HomeMapState,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import {
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from "@/world/procedural-painter/scene-composer/scene-composer-constants"
import {
  clamp,
  stableUnit,
} from "@/world/procedural-painter/scene-composer/scene-composer-random"
import type {
  SceneObject,
  SceneObjectKind,
  SceneObjectLayer,
} from "@/world/procedural-painter/scene-composer/scene-composer-schema"

export type PlacementSceneObjectBinding = {
  placementId: string
  sceneObject: SceneObject
  sourceKind: string
  sourceLayer: string
  sourceTags: string[]
}

export type PlacementSceneObjectAdapterResult = {
  boundObjects: SceneObject[]
  bindings: PlacementSceneObjectBinding[]
  skippedPlacements: {
    placementId: string
    reason: string
  }[]
}

export function adaptPlacementsToSceneObjects(input: {
  homeMapState: HomeMapState
}): PlacementSceneObjectAdapterResult {
  const bindings: PlacementSceneObjectBinding[] = []
  const skippedPlacements: PlacementSceneObjectAdapterResult["skippedPlacements"] = []

  input.homeMapState.placements.forEach((placement) => {
    const kind = resolveSceneObjectKind(placement)

    if (kind === "skip_path") {
      skippedPlacements.push({
        placementId: placement.id,
        reason: "path painter is handled by terrain / road composer",
      })
      return
    }

    if (kind === "skip_structure") {
      skippedPlacements.push({
        placementId: placement.id,
        reason: "structure painter not ready",
      })
      return
    }

    if (!kind) {
      skippedPlacements.push({
        placementId: placement.id,
        reason: "unrecognized placement kind",
      })
      return
    }

    const sceneObject = buildSceneObjectFromPlacement({
      homeMapState: input.homeMapState,
      placement,
      kind,
    })

    bindings.push({
      placementId: placement.id,
      sceneObject,
      sourceKind: kind,
      sourceLayer: placement.layer,
      sourceTags: placement.tags,
    })
  })

  return {
    boundObjects: bindings.map((binding) => binding.sceneObject),
    bindings,
    skippedPlacements,
  }
}

function buildSceneObjectFromPlacement(input: {
  homeMapState: HomeMapState
  placement: MapPlacement
  kind: SceneObjectKind
}): SceneObject {
  const scenePosition = mapPlacementToScenePosition({
    homeMapState: input.homeMapState,
    placement: input.placement,
  })
  const seed = `${input.homeMapState.seed}:${input.placement.id}:fact-object`

  return {
    id: `fact_${input.placement.id}`,
    kind: input.kind,
    x: scenePosition.x,
    y: scenePosition.y,
    scale: resolveScale(input.kind, seed),
    layer: resolvePlacementSceneLayer(scenePosition.y),
    health: resolveHealth(input.kind, seed),
    age: resolveAge(input.kind, seed),
  }
}

function mapPlacementToScenePosition(input: {
  homeMapState: HomeMapState
  placement: MapPlacement
}): { x: number; y: number } {
  const sourceMapWidth = Math.max(
    1,
    input.homeMapState.mapSize.columns * input.homeMapState.mapSize.tileSize
  )
  const sourceMapHeight = Math.max(
    1,
    input.homeMapState.mapSize.rows * input.homeMapState.mapSize.tileSize
  )
  const xRatio =
    input.placement.x <= input.homeMapState.mapSize.columns
      ? input.placement.x / input.homeMapState.mapSize.columns
      : input.placement.x / sourceMapWidth
  const yRatio =
    input.placement.y <= input.homeMapState.mapSize.rows
      ? input.placement.y / input.homeMapState.mapSize.rows
      : input.placement.y / sourceMapHeight

  return {
    x: clamp(Math.round(xRatio * SCENE_WIDTH), 24, SCENE_WIDTH - 24),
    y: clamp(Math.round(yRatio * SCENE_HEIGHT), 40, SCENE_HEIGHT - 24),
  }
}

function resolveSceneObjectKind(
  placement: MapPlacement
): SceneObjectKind | "skip_path" | "skip_structure" | null {
  const tokens = [
    placement.id,
    placement.assetId,
    placement.layer,
    placement.label,
    placement.source,
    ...placement.tags,
  ].map((token) => token.toLowerCase())

  if (
    hasAnyToken(tokens, [
      "incu" + "bator",
      "em" + "bryo",
      "hat" + "ching",
      "pet_" + "arrival",
    ])
  ) {
    return null
  }

  if (placement.layer === "actor" || hasAnyToken(tokens, ["butler", "steward", "keeper"])) {
    return "actor"
  }

  if (placement.layer === "path" || hasAnyToken(tokens, ["path", "road", "trail"])) {
    return "skip_path"
  }

  if (
    placement.layer === "structure" ||
    hasAnyToken(tokens, ["structure", "house", "home", "building", "shelter"])
  ) {
    return "skip_structure"
  }

  if (hasAnyToken(tokens, ["stone", "rock"])) {
    return "stone"
  }

  if (hasAnyToken(tokens, ["flower"])) {
    return "flower"
  }

  if (hasAnyToken(tokens, ["bush", "shrub", "small"])) {
    return "bush"
  }

  if (
    placement.layer === "nature" ||
    hasAnyToken(tokens, [
      "world_nature_fact",
      "tree",
      "trees",
      "plant",
      "plant_like",
      "vegetation",
      "nature_boundary",
    ])
  ) {
    if (hasAnyToken(tokens, ["tree", "tall", "canopy"])) {
      return "tree"
    }

    if (hasAnyToken(tokens, ["bush", "shrub", "small"])) {
      return "bush"
    }

    return stableUnit(`fact-kind:${placement.id}`) < 0.3 ? "tree" : "bush"
  }

  return null
}

function resolveScale(kind: SceneObjectKind, seed: string): number {
  const roll = stableUnit(`${seed}:scale`)

  if (kind === "tree") {
    return roundSceneNumber(0.85 + roll * 0.33)
  }

  if (kind === "bush") {
    return roundSceneNumber(0.8 + roll * 0.35)
  }

  if (kind === "stone") {
    return roundSceneNumber(0.82 + roll * 0.28)
  }

  if (kind === "flower") {
    return roundSceneNumber(0.72 + roll * 0.24)
  }

  return 1
}

function resolveHealth(kind: SceneObjectKind, seed: string): number | undefined {
  if (kind !== "tree" && kind !== "bush") {
    return undefined
  }

  const min = kind === "tree" ? 60 : 55
  return Math.round(min + stableUnit(`${seed}:health`) * (100 - min))
}

function resolveAge(kind: SceneObjectKind, seed: string): number | undefined {
  if (kind === "tree") {
    return Math.round(30 + stableUnit(`${seed}:age`) * 90)
  }

  if (kind === "bush") {
    return Math.round(10 + stableUnit(`${seed}:age`) * 60)
  }

  return undefined
}

function resolvePlacementSceneLayer(y: number): SceneObjectLayer {
  if (y < 150) {
    return "back"
  }

  if (y < 300) {
    return "middle"
  }

  return "front"
}

function hasAnyToken(tokens: string[], needles: string[]): boolean {
  return needles.some((needle) => tokens.some((token) => token.includes(needle)))
}

function roundSceneNumber(value: number): number {
  return Number(value.toFixed(3))
}
