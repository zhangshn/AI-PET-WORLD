import type { SceneTile } from "@/world/procedural-painter/scene-composer/scene-composer-schema"
import type { SpaceGrid } from "@/world/space"

import type { WorldViewTile, WorldViewTileKind } from "./world-view-model-schema"

export function mapSceneTilesToWorldViewTiles(input: {
  tiles: SceneTile[]
  tileSize: number
  spaceGrid: SpaceGrid
}): WorldViewTile[] {
  return input.tiles.map((tile) =>
    mapSceneTileToWorldViewTile({
      tile,
      tileSize: input.tileSize,
      spaceGrid: input.spaceGrid,
    })
  )
}

function mapSceneTileToWorldViewTile(input: {
  tile: SceneTile
  tileSize: number
  spaceGrid: SpaceGrid
}): WorldViewTile {
  const relatedCell = findNearestSpaceCell(input.spaceGrid, input.tile)
  const visualKind = input.tile.visualKind ?? "grass"
  const kind =
    relatedCell?.regionKind === "boundary"
      ? "boundary"
      : relatedCell?.terrainKind === "built"
        ? "built"
        : relatedCell?.terrainKind === "soil"
          ? "soil"
          : mapSceneTileVisualKind(visualKind)

  return {
    id: input.tile.id,
    x: input.tile.x,
    y: input.tile.y,
    width: input.tileSize,
    height: input.tileSize,
    kind,
    variant: input.tile.variant,
    traceIntensity: input.tile.traceVisualIntensity ?? relatedCell?.traceStrength ?? 0,
    traceSource: input.tile.traceVisualSource ?? relatedCell?.traceLevel ?? "none",
    passable: relatedCell?.passable ?? true,
  }
}

function mapSceneTileVisualKind(value: string): WorldViewTileKind {
  if (value === "pressed_grass") return "pressed_grass"
  if (value === "worn_grass") return "worn_grass"
  if (value === "exposed_soil") return "exposed_soil"
  if (value === "ecology_transition") return "ecology_transition"
  if (value === "recovery_growth") return "recovery_growth"

  return "grass"
}

function findNearestSpaceCell(spaceGrid: SpaceGrid, tile: SceneTile) {
  const centerX = tile.x + spaceGrid.tileSize / 2
  const centerY = tile.y + spaceGrid.tileSize / 2

  return spaceGrid.cells.reduce(
    (nearest, cell) => {
      const distance = Math.hypot(cell.x - centerX, cell.y - centerY)

      if (!nearest || distance < nearest.distance) {
        return {
          cell,
          distance,
        }
      }

      return nearest
    },
    null as { cell: SpaceGrid["cells"][number]; distance: number } | null
  )?.cell
}
