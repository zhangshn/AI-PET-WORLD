# AI-PET-WORLD Space Base v0

## Purpose

Space Base v0 is a read-only derived spatial model for AI-PET-WORLD. It reads `HomeMapState` and derives a stable `SpaceGrid`, `SpaceCell`, and `SpaceRegion` model for later systems.

It does not mutate `HomeMapState`, create world facts, create gameplay, or define a separate travel-network architecture.

## Boundaries

Coordinates are the positioning base, not the generation algorithm. `x` and `y` identify planar location. `z` and `layer` provide height, occlusion, foreground/background, or future floor-level hints.

`SpaceGrid` is derived from `HomeMapState.mapSize`, placements, resources, and ecology state. It is a read-only projection.

`SpaceCell` represents one stable world-space unit. It contains region, terrain, passability, movement cost, occupancy, and trace-strength hints.

`SpaceRegion` aggregates cells into coarse areas such as home, yard, nature, structure, and boundary.

## Fields

`passability` answers whether a cell can be entered: passable, blocked, restricted, or unknown.

`movementCost` answers how expensive it is to enter a cell. Blocked cells use a high sentinel cost and are excluded from effective average movement-cost summaries.

`occupancyKind` and `occupancyIds` describe whether a cell is occupied by natural, structure, life, event-anchor, or unknown objects. Occupancy is derived from placements and does not write back to placements.

`traceStrength` and `traceLevel` are spatial hints only. They are not full `TraceFact` records. During migration, legacy movement-trace placement inputs may be read for compatibility, but the derived model exposes them as trace strength.

## Next Modules

M3 can build formal `TraceFact`, `TraceField`, and `TraceLifecycle` concepts on top of this spatial base.

This module must remain a read-only derivation layer.
