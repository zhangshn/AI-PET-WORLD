import type { HomeMapState, MapPlacement } from "@/world/map-state/home-map-state-schema"
import type { SpaceCell, SpaceGrid } from "@/world/space"
import type { TraceField } from "@/world/trace"

import type {
  WorldViewLayer,
  WorldViewObject,
  WorldViewObjectKind,
} from "./world-view-model-schema"

export function buildWorldViewObjectsFromHomeMapState(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  traceField?: TraceField
}): WorldViewObject[] {
  const factObjects = input.homeMapState.placements
    .filter(isRenderablePlacement)
    .map((placement) =>
      mapPlacementToWorldViewObject({
        placement,
        homeMapState: input.homeMapState,
        spaceGrid: input.spaceGrid,
      })
    )
  const derivedVisualObjects = buildDerivedVisualObjects(input)

  return [...factObjects, ...derivedVisualObjects].sort((left, right) => {
    if (layerOrder(left.layer) !== layerOrder(right.layer)) {
      return layerOrder(left.layer) - layerOrder(right.layer)
    }

    return left.y - right.y
  })
}

function mapPlacementToWorldViewObject(input: {
  placement: MapPlacement
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
}): WorldViewObject {
  const point = placementToPixelPoint({
    x: input.placement.x,
    y: input.placement.y,
    homeMapState: input.homeMapState,
  })
  const kind = resolveObjectKind(input.placement)
  const scale = resolveObjectScale(input.placement)
  const health = resolveObjectHealth(input.placement)

  return {
    id: `world_view_object_${input.placement.id}`,
    kind,
    x: point.x,
    y: point.y,
    layer: resolveObjectLayer({
      placement: input.placement,
      kind,
    }),
    scale,
    opacity: Math.max(0.56, Math.min(0.98, input.placement.alpha)),
    health,
    growthStage: resolveGrowthStage(input.placement, health),
    label: input.placement.label || labelForObjectKind(kind),
    source: "world_fact",
    tags: ["world_fact", "home_map_placement", ...input.placement.tags],
  }
}

function buildDerivedVisualObjects(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  traceField?: TraceField
}): WorldViewObject[] {
  const resources = input.homeMapState.resources
  const objectDensity = resolveDerivedObjectDensity(input.homeMapState)
  const candidates = input.spaceGrid.cells.filter((cell) => isDerivedVisualCandidate(cell))
  const derivedObjects: WorldViewObject[] = []
  const maxDerivedObjects = Math.max(
    36,
    Math.min(220, Math.round(candidates.length * objectDensity))
  )

  for (const cell of candidates) {
    if (derivedObjects.length >= maxDerivedObjects) break

    const roll = stableUnit(`${input.homeMapState.seed}:${cell.id}:derived_visual_object`)
    const localDensity = resolveCellVisualDensity({
      cell,
      groundHealth: resources.groundHealth,
      naturalGrowth: resources.naturalGrowth,
      spacePressure: resources.spacePressure,
    })

    if (roll > localDensity) continue

    const kind = resolveDerivedObjectKind({
      cell,
      seed: input.homeMapState.seed,
      groundHealth: resources.groundHealth,
      naturalGrowth: resources.naturalGrowth,
    })
    const point = resolveDerivedObjectPoint({
      cell,
      seed: input.homeMapState.seed,
      tileSize: input.spaceGrid.tileSize || input.homeMapState.mapSize.tileSize,
    })
    const health = resolveDerivedObjectHealth({
      cell,
      groundHealth: resources.groundHealth,
      naturalGrowth: resources.naturalGrowth,
    })

    derivedObjects.push({
      id: `derived_visual_${kind}_${cell.id}`,
      kind,
      x: point.x,
      y: point.y,
      layer: resolveDerivedLayer(kind),
      scale: resolveDerivedScale({
        kind,
        seed: input.homeMapState.seed,
        cellId: cell.id,
      }),
      opacity: resolveDerivedOpacity({
        cell,
        health,
      }),
      health,
      growthStage: health < 48 ? "declining" : health > 78 ? "mature" : "young",
      label: labelForObjectKind(kind),
      source: "derived_visual_only",
      tags: [
        "derived_visual_only",
        "not_world_fact",
        "rule_asset_projection",
        "no_runtime_write",
        `region_${cell.regionKind}`,
        `terrain_${cell.terrainKind}`,
      ],
    })
  }

  return derivedObjects
}

function isDerivedVisualCandidate(cell: SpaceCell): boolean {
  if (!cell.passable) return false
  if (cell.regionKind === "boundary") return false
  if (cell.regionKind === "blocked") return false
  if (cell.regionKind === "locked") return false
  if (cell.regionKind === "unopened") return false
  if (cell.terrainKind === "built") return false
  if (cell.terrainKind === "stone") return false
  if (cell.occupancyKind !== "empty") return false

  return true
}

function resolveDerivedObjectDensity(homeMapState: HomeMapState): number {
  const resources = homeMapState.resources
  const growth = clamp01(resources.naturalGrowth / 100)
  const care = clamp01(resources.careReadiness / 100)
  const pressurePenalty = clamp01(resources.spacePressure / 100) * 0.045
  const base = 0.026 + growth * 0.028 + care * 0.014 - pressurePenalty

  return Math.max(0.018, Math.min(0.074, base))
}

function resolveCellVisualDensity(input: {
  cell: SpaceCell
  groundHealth: number
  naturalGrowth: number
  spacePressure: number
}): number {
  const regionBonus =
    input.cell.regionKind === "nature"
      ? 0.09
      : input.cell.regionKind === "yard"
        ? 0.045
        : input.cell.regionKind === "home"
          ? 0.018
          : 0
  const humidityBonus = clamp01((input.cell.moistureHint - 32) / 90) * 0.075
  const ecologyBonus = clamp01((input.cell.ecologyHealthHint - 34) / 90) * 0.075
  const tracePenalty = clamp01(input.cell.traceStrength / 100) * 0.06
  const pressurePenalty = clamp01(input.spacePressure / 100) * 0.025
  const recoveryBonus = input.groundHealth < 44 ? 0.018 : 0

  return Math.max(
    0.012,
    Math.min(
      0.22,
      0.03 + regionBonus + humidityBonus + ecologyBonus + recoveryBonus - tracePenalty - pressurePenalty
    )
  )
}

function resolveDerivedObjectKind(input: {
  cell: SpaceCell
  seed: string
  groundHealth: number
  naturalGrowth: number
}): WorldViewObjectKind {
  const roll = stableUnit(`${input.seed}:${input.cell.id}:derived_kind`)
  const wet = input.cell.moistureHint > 62
  const healthy = input.cell.ecologyHealthHint > 64 && input.groundHealth > 48
  const strongGrowth = input.naturalGrowth > 58

  if (wet && input.cell.ecologyHealthHint < 52 && roll < 0.18) return "mushroom"
  if (healthy && strongGrowth && input.cell.regionKind === "nature" && roll < 0.22) return "tree"
  if (healthy && roll < 0.48) return "bush"
  if (input.cell.traceStrength > 54 && roll < 0.58) return "stone"
  if (healthy && roll < 0.74) return "flower"
  if (wet && roll < 0.84) return "insect_signal"

  return roll < 0.64 ? "bush" : "stone"
}

function resolveDerivedObjectPoint(input: {
  cell: SpaceCell
  seed: string
  tileSize: number
}): { x: number; y: number } {
  const jitterX = Math.round((stableUnit(`${input.seed}:${input.cell.id}:x`) - 0.5) * input.tileSize * 0.52)
  const jitterY = Math.round((stableUnit(`${input.seed}:${input.cell.id}:y`) - 0.5) * input.tileSize * 0.52)

  return {
    x: input.cell.column * input.tileSize + input.tileSize / 2 + jitterX,
    y: input.cell.row * input.tileSize + input.tileSize / 2 + jitterY,
  }
}

function resolveDerivedScale(input: {
  kind: WorldViewObjectKind
  seed: string
  cellId: string
}): number {
  const roll = stableUnit(`${input.seed}:${input.cellId}:scale`)
  const base = input.kind === "tree" ? 1.08 : input.kind === "stone" ? 0.78 : 0.72

  return Number(Math.max(0.46, Math.min(1.36, base + roll * 0.34)).toFixed(2))
}

function resolveDerivedObjectHealth(input: {
  cell: SpaceCell
  groundHealth: number
  naturalGrowth: number
}): number {
  const base = input.groundHealth * 0.46 + input.naturalGrowth * 0.28 + input.cell.ecologyHealthHint * 0.26

  return Math.round(Math.max(26, Math.min(96, base)))
}

function resolveDerivedOpacity(input: { cell: SpaceCell; health: number }): number {
  const tracePenalty = clamp01(input.cell.traceStrength / 100) * 0.18
  const healthBonus = clamp01(input.health / 100) * 0.18

  return Number(Math.max(0.42, Math.min(0.9, 0.56 + healthBonus - tracePenalty)).toFixed(2))
}

function resolveDerivedLayer(kind: WorldViewObjectKind): WorldViewLayer {
  if (kind === "tree") return "back"
  if (kind === "flower" || kind === "mushroom" || kind === "insect_signal") return "front"

  return "middle"
}

function isRenderablePlacement(placement: MapPlacement): boolean {
  if (placement.layer === "actor") return false
  if (placement.layer === "ground") return false
  if (placement.layer === "path") return false
  if (placement.layer === "edge") return false
  if (placement.layer === "zone") return false
  if (placement.layer === "atmosphere") return false

  return true
}

function resolveObjectKind(placement: MapPlacement): WorldViewObjectKind {
  const tokens = placementTokens(placement)

  if (tokens.some((token) => token.includes("tree") || token.includes("树"))) {
    return "tree"
  }

  if (tokens.some((token) => token.includes("bush") || token.includes("灌木"))) {
    return "bush"
  }

  if (tokens.some((token) => token.includes("stone") || token.includes("rock") || token.includes("石"))) {
    return "stone"
  }

  if (tokens.some((token) => token.includes("flower") || token.includes("花"))) {
    return "flower"
  }

  if (tokens.some((token) => token.includes("mushroom") || token.includes("蘑菇"))) {
    return "mushroom"
  }

  if (
    tokens.some(
      (token) =>
        token.includes("insect") ||
        token.includes("signal") ||
        token.includes("ecology")
    )
  ) {
    return "insect_signal"
  }

  if (
    placement.layer === "facility" ||
    tokens.some((token) => token.includes("facility") || token.includes("incubator"))
  ) {
    return "facility"
  }

  if (
    placement.layer === "structure" ||
    tokens.some(
      (token) =>
        token.includes("structure") ||
        token.includes("building") ||
        token.includes("home") ||
        token.includes("house")
    )
  ) {
    return "structure"
  }

  if (placement.layer === "nature") return "bush"

  return "facility"
}

function resolveObjectLayer(input: {
  placement: MapPlacement
  kind: WorldViewObjectKind
}): WorldViewLayer {
  if (input.kind === "tree" && input.placement.scale >= 1) return "back"
  if (input.kind === "flower" || input.kind === "mushroom") return "front"
  if (input.kind === "insect_signal") return "front"
  if (input.placement.layer === "surface-decoration") return "front"

  return "middle"
}

function resolveObjectScale(placement: MapPlacement): number {
  const base = placement.scale || 1
  const variant = (deterministicHash(`${placement.id}:scale`) % 9) / 100

  return Number(Math.max(0.58, Math.min(1.45, base + variant)).toFixed(2))
}

function resolveObjectHealth(placement: MapPlacement): number {
  const tokens = placementTokens(placement)

  if (tokens.some((token) => token.includes("declining") || token.includes("wilt"))) {
    return 42
  }

  if (tokens.some((token) => token.includes("healthy") || token.includes("growth"))) {
    return 86
  }

  return 72 + (deterministicHash(`${placement.id}:health`) % 18)
}

function resolveGrowthStage(placement: MapPlacement, health: number): string {
  const tokens = placementTokens(placement)

  if (tokens.some((token) => token.includes("sprout"))) return "sprout"
  if (tokens.some((token) => token.includes("young"))) return "young"
  if (tokens.some((token) => token.includes("old"))) return "old"
  if (health < 48) return "declining"

  return "mature"
}

function placementToPixelPoint(input: {
  x: number
  y: number
  homeMapState: HomeMapState
}): { x: number; y: number } {
  const scale =
    input.x <= input.homeMapState.mapSize.columns &&
    input.y <= input.homeMapState.mapSize.rows
      ? input.homeMapState.mapSize.tileSize
      : 1

  return {
    x: input.x * scale,
    y: input.y * scale,
  }
}

function placementTokens(placement: MapPlacement): string[] {
  return [
    placement.id,
    placement.assetId,
    placement.label,
    placement.layer,
    ...placement.tags,
  ].map((token) => token.toLowerCase())
}

function labelForObjectKind(kind: WorldViewObjectKind): string {
  if (kind === "tree") return "树"
  if (kind === "bush") return "灌木"
  if (kind === "stone") return "石头"
  if (kind === "flower") return "花"
  if (kind === "mushroom") return "蘑菇"
  if (kind === "insect_signal") return "生态信号"
  if (kind === "structure") return "建筑"

  return "设施"
}

function layerOrder(layer: WorldViewLayer): number {
  if (layer === "back") return 1
  if (layer === "front") return 3

  return 2
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function stableUnit(value: string): number {
  return deterministicHash(value) / 4294967295
}

function deterministicHash(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0)
}
