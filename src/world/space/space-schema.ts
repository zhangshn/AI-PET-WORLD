export type SpaceCoordinate = {
  x: number
  y: number
  z: number
  layer: number
}

export type SpaceRegionKind =
  | "home"
  | "yard"
  | "nature"
  | "structure"
  | "boundary"
  | "unopened"
  | "unknown"

export type SpaceTerrainKind =
  | "grass"
  | "soil"
  | "forest_floor"
  | "sand"
  | "wetland"
  | "stone"
  | "built"
  | "unknown"

export type SpacePassability =
  | "passable"
  | "blocked"
  | "restricted"
  | "unknown"

export type SpaceOccupancyKind =
  | "empty"
  | "natural_object"
  | "structure_object"
  | "life_object"
  | "event_anchor"
  | "unknown"

export type SpaceTraceStrength = "none" | "weak" | "medium" | "strong"

export type SpaceBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type SpaceCell = SpaceCoordinate & {
  id: string
  row: number
  column: number
  regionKind: SpaceRegionKind
  terrainKind: SpaceTerrainKind
  passability: SpacePassability
  movementCost: number
  occupancyKind: SpaceOccupancyKind
  occupancyIds: string[]
  traceStrength: number
  traceLevel: SpaceTraceStrength
  moistureHint: number
  ecologyHealthHint: number
}

export type SpaceRegion = {
  id: string
  kind: SpaceRegionKind
  label: string
  bounds: SpaceBounds
  cellIds: string[]
  passableCells: number
  blockedCells: number
  averageMovementCost: number
  averageTraceStrength: number
}

export type SpaceGridSummary = {
  totalCells: number
  passableCells: number
  blockedCells: number
  restrictedCells: number
  occupiedCells: number
  averageMovementCost: number
  averageTraceStrength: number
  regionCounts: Record<SpaceRegionKind, number>
  terrainCounts: Record<SpaceTerrainKind, number>
  occupancyCounts: Record<SpaceOccupancyKind, number>
}

export type SpaceGrid = {
  id: string
  worldId: string
  columns: number
  rows: number
  tileSize: number
  width: number
  height: number
  cells: SpaceCell[]
  regions: SpaceRegion[]
  summary: SpaceGridSummary
}
