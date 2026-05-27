import type { SpaceCell, SpaceGrid } from "@/world/space"

import type {
  WorldViewTile,
  WorldViewTileKind,
} from "./world-view-model-schema"

export function buildWorldViewTilesFromSpaceGrid(input: {
  spaceGrid: SpaceGrid
}): WorldViewTile[] {
  return input.spaceGrid.cells.map((cell) => ({
    id: `world_view_tile_${cell.id}`,
    x: cell.column * input.spaceGrid.tileSize,
    y: cell.row * input.spaceGrid.tileSize,
    width: input.spaceGrid.tileSize,
    height: input.spaceGrid.tileSize,
    kind: resolveWorldViewTileKind(cell),
    variant: stableHash(`${cell.id}:${cell.traceStrength}:${cell.movementCost}`) % 8,
    traceIntensity: clamp(Math.round(Math.max(cell.traceStrength, cell.traceInfluenceStrength)), 0, 100),
    traceSource: resolveTraceSource(cell),
    passable: cell.passable,
  }))
}

function resolveWorldViewTileKind(cell: SpaceCell): WorldViewTileKind {
  const traceSource = resolveTraceSource(cell)
  const traceStrength = Math.max(cell.traceStrength, cell.traceInfluenceStrength)

  if (
    cell.regionKind === "boundary" ||
    cell.regionKind === "blocked" ||
    cell.regionKind === "unopened" ||
    cell.regionKind === "locked" ||
    cell.passability === "blocked"
  ) {
    return "boundary"
  }

  if (
    cell.terrainKind === "built" ||
    cell.regionKind === "structure" ||
    cell.occupancyKind === "structure_object"
  ) {
    return "built"
  }

  if (traceSource === "movement") {
    if (traceStrength >= 72) return "exposed_soil"
    if (traceStrength >= 48) return "worn_grass"
    if (traceStrength >= 24) return "pressed_grass"
  }

  if (traceSource === "spatial_use") {
    if (traceStrength >= 64) return "worn_grass"
    if (traceStrength >= 28) return "pressed_grass"
  }

  if (traceSource === "ecology_change") {
    if (cell.traceInfluenceFactors.some((factor) => factor.lifecyclePhase === "repaired")) {
      return "recovery_growth"
    }

    if (traceStrength >= 28) return "ecology_transition"
  }

  if (traceSource === "construction_maintenance") {
    if (traceStrength >= 36) return "recovery_growth"
  }

  if (cell.terrainKind === "soil" || cell.terrainKind === "sand") return "soil"
  if (cell.terrainKind === "wetland" || cell.terrainKind === "forest_floor") {
    return "ecology_transition"
  }

  return "grass"
}

function resolveTraceSource(cell: SpaceCell): string {
  const strongestFactor = cell.traceInfluenceFactors.reduce(
    (strongest, factor) => {
      if (!strongest || factor.strength > strongest.strength) return factor
      return strongest
    },
    undefined as SpaceCell["traceInfluenceFactors"][number] | undefined
  )

  if (strongestFactor) return strongestFactor.traceType
  if (cell.traceStrength > 0) return cell.traceLevel

  return "none"
}

function stableHash(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
