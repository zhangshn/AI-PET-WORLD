import type { HomeMapState, MapPlacement } from "@/world/map-state/home-map-state-schema"
import type { SpaceGrid } from "@/world/space"
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
  return input.homeMapState.placements
    .filter(isRenderablePlacement)
    .map((placement) =>
      mapPlacementToWorldViewObject({
        placement,
        homeMapState: input.homeMapState,
        spaceGrid: input.spaceGrid,
      })
    )
    .sort((left, right) => {
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
  }
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

function deterministicHash(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0)
}
