import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { SpaceCell, SpaceGrid } from "@/world/space"
import type { TraceField, TraceType } from "@/world/trace"

import type { WorldViewTile, WorldViewTileKind } from "./world-view-model-schema"

export function buildWorldViewTilesFromSpaceGrid(input: {
  spaceGrid: SpaceGrid
  homeMapState: HomeMapState
  traceField?: TraceField
}): WorldViewTile[] {
  const tileSize = input.spaceGrid.tileSize || input.homeMapState.mapSize.tileSize
  const traceTypeByCellId = buildTraceTypeByCellId(input.traceField)

  return input.spaceGrid.cells.map((cell) => {
    const traceType = traceTypeByCellId[cell.id]

    return {
      id: `world_view_tile_${cell.id}`,
      x: cell.column * tileSize,
      y: cell.row * tileSize,
      width: tileSize,
      height: tileSize,
      kind: resolveTileKind({
        cell,
        traceType,
      }),
      variant: stableVariant({
        worldId: input.homeMapState.worldId,
        cellId: cell.id,
        tick: 0,
      }),
      traceIntensity: Math.max(
        cell.traceStrength,
        cell.traceInfluenceStrength ?? 0
      ),
      traceSource: traceType ?? cell.traceLevel,
      passable: cell.passable,
    }
  })
}

function resolveTileKind(input: {
  cell: SpaceCell
  traceType?: TraceType
}): WorldViewTileKind {
  const { cell, traceType } = input

  if (cell.regionKind === "boundary") return "boundary"
  if (cell.terrainKind === "built") return "built"
  if (cell.terrainKind === "soil") return "soil"
  if (traceType === "ecology_change") {
    return cell.ecologyHealthHint >= 62 ? "recovery_growth" : "ecology_transition"
  }

  if (
    cell.traceStrength >= 72 &&
    (traceType === "movement" || traceType === "spatial_use")
  ) {
    return cell.ecologyHealthHint < 44 ? "exposed_soil" : "worn_grass"
  }

  if (cell.traceStrength >= 44 || cell.traceInfluenceStrength >= 44) {
    return "pressed_grass"
  }

  if (cell.ecologyHealthHint < 38) return "ecology_transition"
  if (cell.ecologyHealthHint > 74 && cell.humidity && cell.humidity > 54) {
    return "recovery_growth"
  }

  return "grass"
}

function buildTraceTypeByCellId(
  traceField: TraceField | undefined
): Record<string, TraceType> {
  if (!traceField) return {}

  return traceField.traces.reduce<Record<string, TraceType>>((result, trace) => {
    trace.relatedCellIds.forEach((cellId) => {
      if (!result[cellId] || trace.strength >= 54) {
        result[cellId] = trace.type
      }
    })

    trace.scope.cellIds.forEach((cellId) => {
      if (!result[cellId] || trace.strength >= 54) {
        result[cellId] = trace.type
      }
    })

    return result
  }, {})
}

function stableVariant(input: {
  worldId: string
  cellId: string
  tick: number
}): number {
  return deterministicHash(
    `${input.worldId}:${input.cellId}:world_view_tile:${input.tick}`
  ) % 8
}

function deterministicHash(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0)
}
